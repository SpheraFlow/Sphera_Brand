import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface Cliente {
  id: string;
  nome: string;
  status: string;
  avatarUrl: string | null;
  criado_em: string;
}

interface ClientCalendarOverview {
  statusLabel: string;
  statusIcon: string;
  statusColorClass: string;
  deadlineLabel: string;
  pendingCount: number;
}

export default function ClientsHome() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [calendarsOverview, setCalendarsOverview] = useState<Record<string, ClientCalendarOverview>>({});
  const [logoOverrides, setLogoOverrides] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('clientLogos');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/clients');
      const lista = response.data.clientes || [];
      setClientes(lista);

      // Carregar overview de calendário para cada cliente
      await loadCalendarsOverview(lista);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadLogo = async (clientId: string, file: File | null | undefined) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/client-logos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const url = res.data?.url as string | undefined;
      if (!url) {
        alert('Erro ao fazer upload da logo.');
        return;
      }

      const updated = { ...logoOverrides, [clientId]: url };
      setLogoOverrides(updated);
      try {
        localStorage.setItem('clientLogos', JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
    } catch (error: any) {
      console.error('Erro ao fazer upload da logo:', error);
      alert('Erro ao fazer upload da logo.');
    }
  };

  const loadCalendarsOverview = async (lista: Cliente[]) => {
    const overviews: Record<string, ClientCalendarOverview> = {};

    await Promise.all(
      lista.map(async (cliente) => {
        try {
          const res = await api.get(`/calendars/${cliente.id}`);
          const calendar = res.data.calendar;
          const posts = calendar?.posts || [];

          const today = new Date();

          // Converter datas DD/MM para Date do ano atual
          const parsePostDate = (dataStr: string): Date | null => {
            if (!dataStr) return null;
            const [dayStr, monthStr] = dataStr.split('/');
            const day = parseInt(dayStr, 10);
            const month = parseInt(monthStr, 10);
            if (isNaN(day) || isNaN(month)) return null;
            const year = today.getFullYear();
            return new Date(year, month - 1, day);
          };

          const postsComData = posts
            .map((p: any) => ({
              ...p,
              _date: parsePostDate(p.data),
            }))
            .filter((p: any) => p._date instanceof Date && !isNaN(p._date.getTime()));

          const futuros = postsComData.filter((p: any) => p._date >= today).sort(
            (a: any, b: any) => a._date.getTime() - b._date.getTime()
          );

          let statusLabel = '⏳ Em andamento';
          let statusIcon = '⏳';
          let statusColorClass = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';

          if (!posts || posts.length === 0) {
            statusLabel = '❌ Pendente';
            statusIcon = '❌';
            statusColorClass = 'bg-red-500/20 text-red-300 border-red-500/50';
          } else if (futuros.length === 0) {
            statusLabel = '✅ Concluído';
            statusIcon = '✅';
            statusColorClass = 'bg-green-500/20 text-green-300 border-green-500/50';
          }

          let deadlineLabel = 'Sem deadlines futuros';
          if (futuros.length > 0) {
            const next = futuros[0]._date as Date;
            const diffMs = next.getTime() - today.getTime();
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays <= 0) {
              deadlineLabel = 'Aprovação hoje';
            } else if (diffDays === 1) {
              deadlineLabel = 'Aprovação em 1 dia';
            } else {
              deadlineLabel = `Aprovação em ${diffDays} dias`;
            }
          }

          const pendingCount = posts.filter((p: any) => {
            const status = p.status || 'sugerido';
            return status !== 'aprovado' && status !== 'publicado';
          }).length;

          overviews[cliente.id] = {
            statusLabel,
            statusIcon,
            statusColorClass,
            deadlineLabel,
            pendingCount,
          };
        } catch (error: any) {
          // Se não houver calendário (404), mantemos como pendente
          if (error?.response?.status === 404) {
            overviews[cliente.id] = {
              statusLabel: '❌ Pendente',
              statusIcon: '❌',
              statusColorClass: 'bg-red-500/20 text-red-300 border-red-500/50',
              deadlineLabel: 'Nenhum calendário gerado ainda',
              pendingCount: 0,
            };
          } else {
            console.error('Erro ao carregar overview de calendário para cliente', cliente.id, error);
          }
        }
      })
    );

    setCalendarsOverview(overviews);
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      alert('Por favor, insira o nome do cliente');
      return;
    }

    try {
      console.log('Criando cliente:', newClientName);
      const response = await api.post('/clients', {
        nome: newClientName,
      });
      console.log('Cliente criado com sucesso:', response.data);
      setNewClientName('');
      setShowNewClientModal(false);
      loadClientes();
    } catch (error: any) {
      console.error('Erro detalhado ao criar cliente:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
      });
      const errorMessage = error.response?.data?.error || error.message || 'Erro ao criar cliente';
      alert(`Erro: ${errorMessage}`);
    }
  };

  const handleAccessClient = (clientId: string) => {
    // Ir direto para o calendário do cliente
    navigate(`/client/${clientId}/calendar`);
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir o cliente "${clientName}"?\n\nIsso também irá remover calendários, branding e dados vinculados a ele.`
    );

    if (!confirmDelete) return;

    try {
      await api.delete(`/clients/${clientId}`);
      await loadClientes();
    } catch (error: any) {
      console.error('Erro ao excluir cliente:', error);
      alert('Erro ao excluir cliente: ' + (error.response?.data?.error || error.message));
    }
  };

  const getInitials = (nome: string) => {
    return nome
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Carregando clientes...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Meus Clientes</h1>
              <p className="text-gray-400 mt-1">
                Selecione um cliente para acessar o painel
              </p>
            </div>
            <button
              onClick={() => setShowNewClientModal(true)}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              + Novo Cliente
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Clientes */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {clientes.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-400 text-lg mb-4">
              Nenhum cliente cadastrado ainda
            </div>
            <button
              onClick={() => setShowNewClientModal(true)}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Criar Primeiro Cliente
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clientes.map((cliente) => (
              <div
                key={cliente.id}
                className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-all cursor-pointer group"
                onClick={() => handleAccessClient(cliente.id)}
              >
                {/* Avatar/Ícone */}
                <div className="flex items-center mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold overflow-hidden">
                    {logoOverrides[cliente.id] || cliente.avatarUrl ? (
                      <img
                        src={logoOverrides[cliente.id] || (cliente.avatarUrl as string)}
                        alt={cliente.nome}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getInitials(cliente.nome)
                    )}
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-xl font-semibold group-hover:text-blue-400 transition-colors">
                      {cliente.nome}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {cliente.status}
                    </p>
                  </div>
                  <div className="ml-2 flex flex-col items-end gap-1">
                    <label
                      className="text-xs text-gray-400 hover:text-blue-400 underline cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span
                        onClick={() => {
                          const input = document.getElementById(`logo-input-${cliente.id}`) as HTMLInputElement | null;
                          input?.click();
                        }}
                      >
                        Logo PNG
                      </span>
                    </label>
                    <input
                      id={`logo-input-${cliente.id}`}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleUploadLogo(cliente.id, e.target.files?.[0])}
                    />
                    <button
                      className="text-[11px] text-red-400 hover:text-red-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClient(cliente.id, cliente.nome);
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </div>

                {/* Visão Rápida do Calendário */}
                <div className="text-xs text-gray-300 mb-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">
                      Criado em {new Date(cliente.criado_em).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  {calendarsOverview[cliente.id] && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-400">
                        Próximo deadline:{' '}
                        <span className="text-gray-100">
                          {calendarsOverview[cliente.id].deadlineLabel}
                        </span>
                      </span>
                      <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 text-[11px]">
                        {calendarsOverview[cliente.id].pendingCount} posts pendentes
                      </span>
                    </div>
                  )}
                </div>

                {/* Botão */}
                <button
                  className="w-full bg-gray-700 hover:bg-blue-600 py-2 rounded-lg font-medium transition-colors group-hover:bg-blue-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAccessClient(cliente.id);
                  }}
                >
                  Acessar Painel →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Novo Cliente */}
      {showNewClientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <h2 className="text-2xl font-bold mb-4">Novo Cliente</h2>
            <input
              type="text"
              placeholder="Nome do cliente"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:border-blue-500"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleCreateClient();
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNewClientModal(false);
                  setNewClientName('');
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateClient}
                className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-medium transition-colors"
              >
                Criar Cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

