import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Package, Plus, Edit2, Trash2, X, ExternalLink } from 'lucide-react';
import { produtosService, Produto } from '../services/api';

export default function ProdutosPage() {
    const { clientId } = useParams<{ clientId: string }>();
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduto, setEditingProduto] = useState<Produto | null>(null);

    // Modal Form State
    const [nome, setNome] = useState('');
    const [categoria, setCategoria] = useState('');
    const [preco, setPreco] = useState('');
    const [descricao, setDescricao] = useState('');
    const [linkReferencia, setLinkReferencia] = useState('');
    const [ativo, setAtivo] = useState(true);

    useEffect(() => {
        if (clientId) {
            loadProdutos();
        }
    }, [clientId]);

    const loadProdutos = async () => {
        if (!clientId) return;
        try {
            setLoading(true);
            const data = await produtosService.getProdutos(clientId);
            setProdutos(data);
        } catch (error) {
            console.error('Erro ao carregar produtos:', error);
            alert('Não foi possível carregar a lista de produtos.');
        } finally {
            setLoading(false);
        }
    };

    const openForm = (produto?: Produto) => {
        if (produto) {
            setEditingProduto(produto);
            setNome(produto.nome);
            setCategoria(produto.categoria || '');
            setPreco(produto.preco ? String(produto.preco) : '');
            setDescricao(produto.descricao || '');
            setLinkReferencia(produto.link_referencia || '');
            setAtivo(produto.ativo);
        } else {
            setEditingProduto(null);
            setNome('');
            setCategoria('');
            setPreco('');
            setDescricao('');
            setLinkReferencia('');
            setAtivo(true);
        }
        setIsModalOpen(true);
    };

    const closeForm = () => {
        setIsModalOpen(false);
        setEditingProduto(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientId) return;

        if (!nome.trim()) {
            alert('O nome do produto é obrigatório.');
            return;
        }

        const payload: Partial<Produto> = {
            nome: nome.trim(),
            categoria: categoria.trim() || null,
            preco: preco ? parseFloat(preco.replace(',', '.')) : null,
            descricao: descricao.trim() || null,
            link_referencia: linkReferencia.trim() || null,
            ativo
        };

        try {
            if (editingProduto) {
                await produtosService.updateProduto(editingProduto.id, payload);
            } else {
                await produtosService.createProduto(clientId, payload);
            }
            closeForm();
            loadProdutos();
        } catch (error: any) {
            console.error('Erro ao salvar produto:', error);
            alert(error.response?.data?.error || 'Erro ao salvar o produto.');
        }
    };

    const handleDelete = async (produto: Produto) => {
        if (!confirm(`Tem certeza que deseja excluir o produto "${produto.nome}"?`)) return;
        try {
            await produtosService.deleteProduto(produto.id);
            loadProdutos();
        } catch (error) {
            console.error('Erro ao excluir produto:', error);
            alert('Erro ao excluir produto.');
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[50vh]">
                <div className="text-gray-400">Carregando produtos...</div>
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Package className="w-6 h-6 text-blue-500" />
                        Produtos e Serviços
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Cadastre o portfólio do cliente para uso em campanhas e geração de conteúdo.
                    </p>
                </div>
                <button
                    onClick={() => openForm()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Novo Produto
                </button>
            </div>

            {/* Tabela de Produtos */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                {produtos.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="text-lg mb-2">Nenhum produto cadastrado.</p>
                        <p className="text-sm">Clique no botão acima para adicionar o primeiro produto ou serviço.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-900/50 border-b border-gray-700">
                                <th className="p-4 text-sm font-semibold text-gray-400">Status</th>
                                <th className="p-4 text-sm font-semibold text-gray-400">Nome do Produto</th>
                                <th className="p-4 text-sm font-semibold text-gray-400">Categoria</th>
                                <th className="p-4 text-sm font-semibold text-gray-400">Preço</th>
                                <th className="p-4 text-sm font-semibold text-gray-400 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {produtos.map((p) => (
                                <tr key={p.id} className="hover:bg-gray-750 transition-colors">
                                    <td className="p-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${p.ativo ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                                            {p.ativo ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <p className="text-white font-medium">{p.nome}</p>
                                        {p.link_referencia && (
                                            <a href={p.link_referencia} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 mt-1 truncate max-w-[200px]" title={p.link_referencia}>
                                                <ExternalLink className="w-3 h-3" /> Link
                                            </a>
                                        )}
                                    </td>
                                    <td className="p-4 text-gray-300">{p.categoria || '-'}</td>
                                    <td className="p-4 text-gray-300">
                                        {p.preco ? (
                                            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(p.preco))
                                        ) : '-'}
                                    </td>
                                    <td className="p-4 flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => openForm(p)}
                                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(p)}
                                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal de Formulário */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-gray-700 bg-gray-900/50">
                            <h2 className="text-xl font-bold text-white">
                                {editingProduto ? 'Editar Produto' : 'Novo Produto'}
                            </h2>
                            <button
                                onClick={closeForm}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Nome do Produto / Serviço *
                                </label>
                                <input
                                    type="text"
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    placeholder="Ex: Consultoria Gold"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Categoria
                                    </label>
                                    <input
                                        type="text"
                                        value={categoria}
                                        onChange={(e) => setCategoria(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        placeholder="Ex: Serviços B2B"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Preço (Opcional)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={preco}
                                        onChange={(e) => setPreco(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        placeholder="Ex: 199.90"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    URL de Referência (Site / E-commerce)
                                </label>
                                <input
                                    type="url"
                                    value={linkReferencia}
                                    onChange={(e) => setLinkReferencia(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    placeholder="https://..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Instruções para a IA (Diferenciais, dores que resolve)
                                </label>
                                <textarea
                                    value={descricao}
                                    onChange={(e) => setDescricao(e.target.value)}
                                    rows={4}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                                    placeholder="Descreva aqui o que torna este produto especial, quais objeções quebrar ao vendê-lo, etc."
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="ativo"
                                    checked={ativo}
                                    onChange={(e) => setAtivo(e.target.checked)}
                                    className="w-4 h-4 bg-gray-900 border-gray-700 rounded text-blue-600 focus:ring-blue-600 focus:ring-offset-gray-800"
                                />
                                <label htmlFor="ativo" className="text-sm text-gray-300 cursor-pointer">
                                    Produto Ativo (Disponível para focar em campanhas)
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-700">
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Salvar Produto
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
