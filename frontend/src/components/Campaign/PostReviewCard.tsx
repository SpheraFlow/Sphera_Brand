
import { Draggable } from '@hello-pangea/dnd';
import {
    Lock,
    Unlock
} from 'lucide-react';

interface Post {
    data: string;
    tema: string;
    formato: string;
    ideia_visual: string;
    copy_sugestao: string;
    objetivo: string;
    image_generation_prompt?: string;
    referencias?: string;
    status?: 'sugerido' | 'aprovado' | 'publicado';
}

interface PostReviewCardProps {
    post: Post;
    index: number; // Global index in the posts array
    isSelected: boolean;
    onToggleSelect: (index: number) => void;
    onToggleStatus: (index: number) => void;
    onEdit: (post: Post, index: number) => void;
    viewMode: 'grid' | 'board';
}

export default function PostReviewCard({
    post,
    index,
    isSelected,
    onToggleSelect,
    onToggleStatus,
    onEdit,
    viewMode
}: PostReviewCardProps) {

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'aprovado': return 'border-green-500 bg-green-500/5';
            case 'publicado': return 'border-blue-500 bg-blue-500/5';
            default: return 'border-yellow-500/50 bg-yellow-500/5'; // sugerido
        }
    };

    const getFormatIcon = (formato: string) => {
        const lower = formato?.toLowerCase() || '';
        if (lower.includes('reel') || lower.includes('vídeo')) return '🎬';
        if (lower.includes('carrossel')) return '📸';
        if (lower.includes('static') || lower.includes('estático')) return '🖼️';
        if (lower.includes('stories')) return '📱';
        return '📄';
    };

    const isApproved = post.status === 'aprovado' || post.status === 'publicado';

    return (
        <Draggable draggableId={`post-${index}`} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`
            relative group transition-all duration-200
            ${viewMode === 'grid' ? 'h-full min-h-[160px]' : 'mb-3'}
            bg-gray-800 rounded-lg border-l-4 border-r border-y border-r-gray-700 border-y-gray-700
            ${getStatusColor(post.status)}
            ${isSelected ? 'ring-2 ring-blue-500' : ''}
            ${snapshot.isDragging ? 'shadow-2xl scale-105 z-50' : 'hover:bg-gray-700/50'}
          `}
                    onClick={(e) => {
                        // Se clicar com CTRL/CMD ou no checkbox, seleciona
                        if (e.ctrlKey || e.metaKey) {
                            onToggleSelect(index);
                        }
                    }}
                >
                    {/* Header do Card */}
                    <div className="p-3">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        onToggleSelect(index);
                                    }}
                                    className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-offset-gray-900"
                                />
                                <span className="text-xs font-mono text-gray-500">
                                    {getFormatIcon(post.formato)} {post.data}
                                </span>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleStatus(index);
                                }}
                                className={`p-1 rounded-full transition-colors ${isApproved ? 'text-green-400 hover:bg-green-500/20' : 'text-gray-500 hover:bg-gray-700'
                                    }`}
                                title={isApproved ? "Aprovado (Clique para desbloquear)" : "Sugerido (Clique para aprovar)"}
                            >
                                {isApproved ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            </button>
                        </div>

                        {/* Conteúdo */}
                        <div
                            className="cursor-pointer"
                            onClick={() => onEdit(post, index)}
                        >
                            <h4 className="text-sm font-bold text-gray-200 line-clamp-2 mb-1 leading-snug">
                                {post.tema || 'Sem tema'}
                            </h4>
                            <p className="text-xs text-gray-400 line-clamp-3">
                                {post.copy_sugestao || post.ideia_visual}
                            </p>
                        </div>

                        {/* Footer Info */}
                        {viewMode === 'board' && (
                            <div className="mt-3 pt-2 border-t border-gray-700/50 flex items-center justify-between text-xs text-gray-500">
                                <span>{post.objetivo}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Draggable>
    );
}
