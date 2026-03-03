import { useState, useEffect } from 'react';
import { Users, Plus, Shield, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface User {
    id: string;
    nome: string;
    email: string;
    role: 'admin' | 'atendente';
    permissions?: Record<string, boolean>;
    ativo: boolean;
    criado_em: string;
}

export default function TeamManagement() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserRole, setNewUserRole] = useState<'admin' | 'atendente'>('atendente');

    // Permissions State
    const [permissions, setPermissions] = useState({
        dashboard_view: false,
        clients_manage: false,
        team_manage: false,
        content_generate: true,
        content_approve: false
    });

    const handlePermissionChange = (key: keyof typeof permissions) => {
        setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const res = await api.get('/users');
            if (res.data.success) {
                setUsers(res.data.users);
            }
        } catch (error: any) {
            toast.error('Erro ao carregar usuários.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUserName || !newUserEmail || !newUserPassword) {
            toast.error('Preencha todos os campos!');
            return;
        }

        try {
            const res = await api.post('/users', {
                nome: newUserName,
                email: newUserEmail,
                password: newUserPassword,
                role: newUserRole,
                permissions: newUserRole === 'admin' ? {
                    dashboard_view: true,
                    clients_manage: true,
                    team_manage: true,
                    content_generate: true,
                    content_approve: true
                } : permissions
            });

            if (res.data.success) {
                toast.success('Usuário criado com sucesso!');
                setIsModalOpen(false);
                setNewUserName('');
                setNewUserEmail('');
                setNewUserPassword('');
                setNewUserRole('atendente');
                setPermissions({
                    dashboard_view: false,
                    clients_manage: false,
                    team_manage: false,
                    content_generate: true,
                    content_approve: false
                });
                loadUsers();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao criar usuário.');
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const res = await api.put(`/users/${id}/status`, { ativo: !currentStatus });
            if (res.data.success) {
                toast.success(res.data.message);
                setUsers(users.map(u => u.id === id ? { ...u, ativo: !currentStatus } : u));
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao alterar status.');
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Users className="w-8 h-8 text-primary-500" />
                        Gestão de Equipe
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Administre quem tem acesso à agência e defina seus papéis.
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Novo Membro
                </button>
            </div>

            {/* Users List */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center">
                        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : users.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        Nenhum usuário encontrado.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-950/50 border-b border-gray-800 text-sm text-gray-400">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Usuário</th>
                                    <th className="px-6 py-4 font-medium">Papel</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium">Criado em</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800 text-sm">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center border border-gray-700">
                                                    <span className="text-primary-400 font-bold uppercase">{user.nome.charAt(0)}</span>
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white">{user.nome}</div>
                                                    <div className="text-gray-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.role === 'admin' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                    <Shield className="w-4 h-4" /> Admin
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                    <Users className="w-4 h-4" /> Atendente
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.ativo ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20">
                                                    <CheckCircle className="w-4 h-4" /> Ativo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                                                    <XCircle className="w-4 h-4" /> Inativo
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-400">
                                            {new Date(user.criado_em).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => toggleStatus(user.id, user.ativo)}
                                                className={`text-sm hover:underline ${user.ativo ? 'text-red-400' : 'text-green-400'}`}
                                            >
                                                {user.ativo ? 'Desativar' : 'Ativar'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create User Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">Novo Membro</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Nome</label>
                                <input required type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-white" placeholder="Ex: João Silva" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">E-mail</label>
                                <input required type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-white" placeholder="joao@agencia.com" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Senha Temporária</label>
                                <input required type="text" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-white" placeholder="Senha123!" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Papel na Agência</label>
                                <select value={newUserRole} onChange={e => setNewUserRole(e.target.value as 'admin' | 'atendente')} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-white">
                                    <option value="atendente">Atendente (Acesso restrito & Customizável)</option>
                                    <option value="admin">Administrador (Permissões Totais Indiscutíveis)</option>
                                </select>
                            </div>

                            {/* Permissões Granulares - Múltipla Escolha apenas se não for Admin */}
                            {newUserRole === 'atendente' && (
                                <div className="space-y-3 mt-4">
                                    <h4 className="text-sm font-medium text-gray-400 border-b border-gray-800 pb-2">Permissões Específicas</h4>

                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={permissions.dashboard_view} onChange={() => handlePermissionChange('dashboard_view')} className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-primary-500 focus:ring-primary-500 focus:ring-offset-gray-900" />
                                        <span className="text-sm text-gray-300">Visualizar Dashboard e Analytics Globais</span>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={permissions.clients_manage} onChange={() => handlePermissionChange('clients_manage')} className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-primary-500 focus:ring-primary-500 focus:ring-offset-gray-900" />
                                        <span className="text-sm text-gray-300">Criar/Editar Clientes (Contas da Agência)</span>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={permissions.team_manage} onChange={() => handlePermissionChange('team_manage')} className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-primary-500 focus:ring-primary-500 focus:ring-offset-gray-900" />
                                        <span className="text-sm text-gray-300">Gerenciar Equipe (Adicionar/Remover Pessoas)</span>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={permissions.content_generate} onChange={() => handlePermissionChange('content_generate')} className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-primary-500 focus:ring-primary-500 focus:ring-offset-gray-900" />
                                        <span className="text-sm text-gray-300">Usar IA para Gerar Campanhas / Módulo de Criação</span>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={permissions.content_approve} onChange={() => handlePermissionChange('content_approve')} className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-primary-500 focus:ring-primary-500 focus:ring-offset-gray-900" />
                                        <span className="text-sm text-gray-300">Aprovar Posts e Modificar Status para 'Pronto'</span>
                                    </label>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white font-medium">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-medium">Criar Usuário</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
