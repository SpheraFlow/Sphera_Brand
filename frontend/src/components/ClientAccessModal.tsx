import { useState, useEffect } from 'react';
import { X, ShieldAlert, Check } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface User {
    id: string;
    nome: string;
    email: string;
    role: string;
}

interface ClientAccessModalProps {
    clientId: string;
    clientName: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function ClientAccessModal({ clientId, clientName, isOpen, onClose }: ClientAccessModalProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [assignedUsers, setAssignedUsers] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, clientId]);

    const loadData = async () => {
        try {
            setLoading(true);
            // Carrega todos os usuários para listar no modal
            const resUsers = await api.get('/users');
            // Carrega quem já tem acesso a este cliente
            const resAcessos = await api.get(`/clients/${clientId}/users`);

            if (resUsers.data.success) {
                setUsers(resUsers.data.users);
            }

            if (resAcessos.data.success) {
                const ids = resAcessos.data.users.map((u: any) => u.id);
                setAssignedUsers(new Set(ids));
            }
        } catch (error) {
            toast.error('Erro ao carregar permissões.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleAccess = async (userId: string, hasAccess: boolean) => {
        try {
            const action = hasAccess ? 'remove' : 'add';
            const res = await api.put(`/clients/${clientId}/assign`, {
                user_id: userId,
                action
            });

            if (res.data.success) {
                toast.success(res.data.message);
                setAssignedUsers(prev => {
                    const next = new Set(prev);
                    if (hasAccess) next.delete(userId);
                    else next.add(userId);
                    return next;
                });
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao alterar permissão.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-950/50">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-primary-500" />
                            Acessos do Cliente
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">{clientName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <div className="active-spinner"></div>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {users.map(user => {
                                const isAdmin = user.role === 'admin';
                                const hasAccess = assignedUsers.has(user.id) || isAdmin;

                                return (
                                    <div key={user.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-800 bg-gray-950/30">
                                        <div>
                                            <div className="font-medium text-white flex items-center gap-2">
                                                {user.nome}
                                                {isAdmin && (
                                                    <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                                                        Admin
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-500">{user.email}</div>
                                        </div>

                                        <button
                                            onClick={() => !isAdmin && handleToggleAccess(user.id, hasAccess)}
                                            disabled={isAdmin}
                                            className={`relative w-12 h-6 rounded-full transition-colors flex items-center ${hasAccess ? 'bg-primary-600' : 'bg-gray-700'
                                                } ${isAdmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            <span className={`absolute w-4 h-4 rounded-full bg-white transition-transform transform flex items-center justify-center ${hasAccess ? 'translate-x-7' : 'translate-x-1'
                                                }`}>
                                                {hasAccess && <Check className="w-3 h-3 text-primary-600" />}
                                            </span>
                                        </button>
                                    </div>
                                );
                            })}

                            {users.length === 0 && (
                                <p className="text-center text-gray-500">Nenhum usuário cadastrado.</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-800 bg-gray-950/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
