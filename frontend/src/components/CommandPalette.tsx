
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Search,
    User,
    Calendar,
    Briefcase,
    Layout,
    Package,
    Home,
    Plus,
    ArrowRight
} from 'lucide-react';
import { clientService } from '../services/api';

interface CommandItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    action: () => void;
    group: 'Ações Rápidas' | 'Navegação' | 'Clientes' | 'Contexto Atual';
}

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [items, setItems] = useState<CommandItem[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [clients, setClients] = useState<any[]>([]);

    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Extrair clientId da URL se existir (manual parser pois CommandPalette pode estar fora do Routes com params)
    // Mas se estiver dentro do BrowserRouter, useParams funciona?
    // O CommandPalette vai estar no Layout ou App. Se for filho de Route, ok.
    // Se for global fora das rotas específicas, useParams pode ser vazio.
    // Vou usar location.pathname regex pra garantir.
    const getClientIdFromUrl = () => {
        const match = location.pathname.match(/\/client\/([^/]+)/);
        return match ? match[1] : null;
    };

    const clientId = getClientIdFromUrl();

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setIsOpen((open) => !open);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            loadClients();
            // Focus input
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const loadClients = async () => {
        try {
            const list = await clientService.getClients();
            setClients(list);
        } catch (e) {
            console.error(e);
        }
    };

    // Build items based on query and context
    useEffect(() => {
        const cmds: CommandItem[] = [];

        // Contexto do Cliente Atual
        if (clientId) {
            cmds.push(
                { id: 'ctx-hub', label: 'Ir para Dashboard do Cliente', icon: <Layout className="w-4 h-4" />, group: 'Contexto Atual', action: () => navigate(`/client/${clientId}`) },
                { id: 'ctx-new-campaign', label: 'Nova Campanha', icon: <Plus className="w-4 h-4" />, group: 'Contexto Atual', action: () => navigate(`/client/${clientId}/campaign-wizard`) },
                { id: 'ctx-campaigns', label: 'Ver Campanhas', icon: <Calendar className="w-4 h-4" />, group: 'Contexto Atual', action: () => navigate(`/client/${clientId}/campaigns`) },
                { id: 'ctx-jobs', label: 'Jobs em Progresso', icon: <Briefcase className="w-4 h-4" />, group: 'Contexto Atual', action: () => navigate(`/client/${clientId}/jobs`) },
                { id: 'ctx-deliveries', label: 'Entregas', icon: <Package className="w-4 h-4" />, group: 'Contexto Atual', action: () => navigate(`/client/${clientId}/deliveries`) },
            );
        }

        // Navegação Global
        cmds.push(
            { id: 'nav-home', label: 'Ir para Home', icon: <Home className="w-4 h-4" />, group: 'Navegação', action: () => navigate('/') },
            { id: 'nav-clients', label: 'Listar Todos Clientes', icon: <User className="w-4 h-4" />, group: 'Navegação', action: () => navigate('/clients') },
        );

        // Clientes
        clients.forEach(c => {
            cmds.push({
                id: `client-${c.id}`,
                label: `Abrir ${c.nome}`,
                icon: <User className="w-4 h-4" />,
                group: 'Clientes',
                action: () => navigate(`/client/${c.id}`)
            });
        });

        // Filtrar
        const filtered = cmds.filter(item =>
            item.label.toLowerCase().includes(query.toLowerCase()) ||
            item.group.toLowerCase().includes(query.toLowerCase())
        );

        setItems(filtered);
        setSelectedIndex(0);

    }, [query, clients, clientId]);

    const handleSelect = (index: number) => {
        const item = items[index];
        if (item) {
            item.action();
            setIsOpen(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % items.length);
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + items.length) % items.length);
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSelect(selectedIndex);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-start justify-center pt-[15vh] p-4 animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[60vh] animate-in slide-in-from-top-4 duration-200">

                {/* Input */}
                <div className="flex items-center px-4 py-3 border-b border-gray-800">
                    <Search className="w-5 h-5 text-gray-500 mr-3" />
                    <input
                        ref={inputRef}
                        className="bg-transparent w-full text-lg text-white placeholder-gray-500 focus:outline-none"
                        placeholder="O que você precisa? (Digite para buscar...)"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="hidden md:flex items-center gap-1 text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                        <span>ESC</span>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    {items.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            Nenhum resultado encontrado.
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {items.map((item, index) => {
                                // Render group header if first item of group
                                const prev = items[index - 1];
                                const showHeader = !prev || prev.group !== item.group;

                                return (
                                    <div key={item.id}>
                                        {showHeader && (
                                            <div className="text-xs font-bold text-gray-500 uppercase px-3 py-2 mt-2 sticky top-0 bg-gray-900/95 backdrop-blur">
                                                {item.group}
                                            </div>
                                        )}
                                        <button
                                            onClick={() => handleSelect(index)}
                                            onMouseEnter={() => setSelectedIndex(index)}
                                            className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm transition-colors ${index === selectedIndex ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                {item.icon}
                                                <span>{item.label}</span>
                                            </div>
                                            {index === selectedIndex && <ArrowRight className="w-4 h-4 opacity-50" />}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 bg-gray-800 text-xs text-gray-500 border-t border-gray-700 flex justify-end gap-3">
                    <span>Use setas para navegar</span>
                    <span>Enter para selecionar</span>
                </div>
            </div>
        </div>
    );
}
