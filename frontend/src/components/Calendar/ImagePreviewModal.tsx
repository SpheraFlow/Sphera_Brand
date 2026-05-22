/**
 * STORY-008 — Modal de preview da imagem gerada por IA (Imagen 3).
 *
 * Mostra a imagem em tamanho grande e oferece 3 botões de download
 * correspondentes aos formatos de Instagram (Feed 1:1, Stories 9:16, Feed Vertical 4:5).
 *
 * Nota de escopo: nesta primeira versão todos os downloads baixam a MESMA imagem
 * gerada. O aspectRatio será usado no futuro quando múltiplos sizes forem
 * efetivamente renderizados pelo backend.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { apiOrigin, type ImageAspectRatio } from '../../services/api';

interface ImagePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string | null;
    calendarItemId: string | null;
}

interface DownloadOption {
    label: string;
    aspectRatio: ImageAspectRatio;
    suffix: string;
}

const DOWNLOAD_OPTIONS: DownloadOption[] = [
    { label: 'Feed 1:1', aspectRatio: '1:1', suffix: 'feed-1x1' },
    { label: 'Stories 9:16', aspectRatio: '9:16', suffix: 'stories-9x16' },
    { label: 'Feed Vertical 4:5', aspectRatio: '4:5', suffix: 'feed-4x5' },
];

// Resolve o URL absoluto a partir do path relativo retornado pelo backend
// (ex: "/storage/creative-assets/{cliente}/{job}.png").
function resolveImageSrc(imageUrl: string): string {
    if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
    return `${apiOrigin}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
}

export default function ImagePreviewModal({
    isOpen,
    onClose,
    imageUrl,
    calendarItemId,
}: ImagePreviewModalProps) {
    const [downloading, setDownloading] = useState<ImageAspectRatio | null>(null);

    if (!isOpen || !imageUrl) return null;

    const src = resolveImageSrc(imageUrl);

    const handleDownload = async (option: DownloadOption) => {
        setDownloading(option.aspectRatio);
        try {
            const response = await fetch(src);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            const baseName = calendarItemId ? calendarItemId.slice(0, 8) : 'arte';
            anchor.download = `arte-${baseName}-${option.suffix}.png`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(objectUrl);
        } catch (err) {
            console.error('Erro ao baixar imagem:', err);
            toast.error('Não foi possível baixar a imagem. Tente novamente.');
        } finally {
            setDownloading(null);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={onClose}
        >
            <div
                className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-gray-900 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-700 px-5 py-3">
                    <h2 className="text-lg font-semibold text-white">Arte gerada</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1 text-gray-400 transition hover:bg-gray-800 hover:text-white"
                        aria-label="Fechar"
                    >
                        ✕
                    </button>
                </div>

                {/* Imagem */}
                <div className="flex flex-1 items-center justify-center overflow-auto bg-gray-950 p-4">
                    <img
                        src={src}
                        alt="Arte gerada por IA"
                        className="max-h-[60vh] max-w-full rounded-lg object-contain"
                    />
                </div>

                {/* Downloads */}
                <div className="border-t border-gray-700 px-5 py-4">
                    <p className="mb-3 text-sm text-gray-400">Baixar em:</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {DOWNLOAD_OPTIONS.map((option) => (
                            <button
                                key={option.aspectRatio}
                                type="button"
                                disabled={downloading !== null}
                                onClick={() => handleDownload(option)}
                                className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {downloading === option.aspectRatio ? (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                ) : null}
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
