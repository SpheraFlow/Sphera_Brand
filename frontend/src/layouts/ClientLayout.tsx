import { useState, useEffect } from 'react';
import { Outlet, useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';

interface Cliente {
  id: string;
  nome: string;
  persona_atualizada: string | null;
  criado_em: string;
}

export default function ClientLayout() {
  const { clientId } = useParams<{ clientId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clientId) {
      loadCliente();
    }
  }, [clientId]);

  const loadCliente = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/clients/${clientId}`);
      setCliente(response.data.cliente);
    } catch (error) {
      console.error('Erro ao carregar cliente:', error);
    } finally {
      setLoading(false);
    }
  };

  const isActive = (path: string) => {
    return location.pathname.includes(path);
  };

  const menuItems = [
    {
      path: `/client/${clientId}/dashboard`,
      label: 'Dashboard',
      icon: '📊',
    },
    {
      path: `/client/${clientId}/campaign`,
      label: 'Planejamento de Campanha',
      icon: '🧩',
    },
    {
      path: `/client/${clientId}/branding`,
      label: 'DNA da Marca',
      icon: '🎨',
    },
    {
      path: `/client/${clientId}/calendar`,
      label: 'Calendário',
      icon: '📅',
    },
    {
      path: `/client/${clientId}/references`,
      label: 'Referências & Materiais',
      icon: '🗂️',
    },
    {
      path: `/client/${clientId}/knowledge`,
      label: 'Inteligência & Prompts',
      icon: '🧠',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Cliente não encontrado</div>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg"
          >
            Voltar para Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col no-print">
        {/* Header da Sidebar */}
        <div className="p-6 border-b border-gray-700">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white text-sm mb-4 flex items-center gap-2"
          >
            ← Voltar para Clientes
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
              {cliente.nome
                .split(' ')
                .map((word) => word[0])
                .join('')
                .toUpperCase()
                .substring(0, 2)}
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">{cliente.nome}</h2>
              <p className="text-gray-400 text-xs">Cliente Ativo</p>
            </div>
          </div>
        </div>

        {/* Menu de Navegação */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer da Sidebar */}
        <div className="p-4 border-t border-gray-700">
          <div className="text-xs text-gray-500">
            <div>Cliente desde</div>
            <div className="text-gray-400 font-medium">
              {new Date(cliente.criado_em).toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 overflow-auto bg-gray-900">
        <Outlet />
      </main>
    </div>
  );
}

