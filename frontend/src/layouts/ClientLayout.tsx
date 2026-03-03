
import { useState, useEffect } from 'react';
import { Outlet, useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Cliente {
  id: string;
  nome: string;
  persona_atualizada: string | null;
  criado_em: string;
  readiness_score?: number; // Optional mock for now
}

export default function ClientLayout() {
  const { clientId } = useParams<{ clientId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const { hasPermission } = useAuth();

  useEffect(() => {
    if (clientId) {
      loadCliente();
      localStorage.setItem('lastClientId', clientId);
    }
  }, [clientId]);

  const loadCliente = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/clients/${clientId}`);
      // Mock readiness score if not present
      const clientData = response.data.cliente;
      if (clientData && typeof clientData.readiness_score === 'undefined') {
        clientData.readiness_score = 85;
      }
      setCliente(clientData);
    } catch (error) {
      console.error('Erro ao carregar cliente:', error);
    } finally {
      setLoading(false);
    }
  };

  const isActive = (path: string) => {
    // Exact match for root/index or standard includes for sub-routes
    if (path === `/client/${clientId}`) {
      return location.pathname === path || location.pathname === `${path}/`;
    }
    return location.pathname.includes(path);
  };

  const navSections = [
    {
      title: 'Principal',
      items: [
        {
          path: `/client/${clientId}`, // Index route
          label: 'Visão Geral',
          icon: '🏠',
        },
        {
          path: `/client/${clientId}/dashboard`,
          label: 'Dashboard de Métricas',
          icon: '📊',
        },
      ]
    },
    {
      title: 'Planejamento',
      items: [
        ...(hasPermission('content_generate') ? [{
          path: `/client/${clientId}/campaigns`,
          label: 'Campanhas',
          icon: '🚀',
        }] : []),
        ...(hasPermission('content_generate') ? [{
          path: `/client/${clientId}/jobs`,
          label: 'Jobs & Processos',
          icon: '⚙️',
        }] : []),
        {
          path: `/client/${clientId}/deliveries`,
          label: 'Entregas',
          icon: '📦',
        }
      ]
    },
    {
      title: 'Conteúdo & Estratégia',
      items: [
        {
          path: `/client/${clientId}/produtos`,
          label: 'Produtos / Serviços',
          icon: '📦',
        },
        ...(hasPermission('content_generate') ? [{
          path: `/client/${clientId}/calendar`,
          label: 'Calendário Editorial',
          icon: '📅',
        }] : []),
        {
          path: `/client/${clientId}/branding`,
          label: 'DNA da Marca',
          icon: '🎨',
        },
        {
          path: `/client/${clientId}/references`,
          label: 'Referências',
          icon: '🗂️',
        },
        // Base de Conhecimento — oculto do menu (rota e dados preservados)
        // { path: `/client/${clientId}/knowledge`, label: 'Base de Conhecimento', icon: '🧠' },
        ...(hasPermission('content_generate') ? [{
          path: `/client/${clientId}/prompt-template`,
          label: 'Template do Prompt',
          icon: '📝',
        }] : []),
      ]
    }
  ];

  // Filtra seções vazias para não ficar um título sem itens na navbar
  const filteredNavSections = navSections.filter(section => section.items.length > 0);

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
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col no-print h-screen sticky top-0 overflow-y-auto">
        {/* Header da Sidebar */}
        <div className="p-6 border-b border-gray-700 bg-gray-800 z-10">
          <button
            onClick={() => navigate('/')} // Back to Agency Home
            className="text-gray-400 hover:text-white text-xs mb-4 flex items-center gap-2 uppercase font-bold tracking-wider"
          >
            ← Voltar
          </button>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {cliente.nome
                  .split(' ')
                  .map((word) => word[0])
                  .join('')
                  .toUpperCase()
                  .substring(0, 2)}
              </div>
              <div>
                <h2 className="text-white font-bold text-sm leading-tight">{cliente.nome}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
                  <span className="text-gray-400 text-xs">Ativo</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Menu de Navegação */}
        <nav className="flex-1 p-4 space-y-6">
          {filteredNavSections.map((section, idx) => (
            <div key={idx}>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-2">
                {section.title}
              </h3>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium ${isActive(item.path)
                        ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                        : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                        }`}
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer da Sidebar */}
        <div className="p-4 border-t border-gray-700 bg-gray-800">
          <div className="text-xs text-center text-gray-600">
            Sphere Brand © 2026
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 overflow-auto bg-gray-900 scroll-smooth">
        <Outlet />
      </main>
    </div>
  );
}


