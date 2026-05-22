// STORY-010 Step 3 — Upload de materiais (opcional, pode pular).
// Reutiliza POST /api/branding-upload/branding/extract-from-upload, que aceita
// até 3 imagens (jpeg/png/webp, máx 10MB cada) e já extrai um DNA inicial.
import { useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, UploadCloud, X, Loader2, CheckCircle } from 'lucide-react';
import api, { type OnboardingExtractedBranding } from '../../services/api';
import type { WizardState } from './wizardTypes';

interface Props {
  state: WizardState;
  patch: (p: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
  // Quando o upload extrai um DNA, repassamos para o orquestrador usar na Step 4.
  onExtracted: (data: OnboardingExtractedBranding) => void;
}

const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 3;

interface LocalFile {
  file: File;
  preview: string;
}

export default function Step3Upload({ state, patch, onNext, onBack, onExtracted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const addFiles = (selected: FileList | null) => {
    if (!selected) return;
    setError(null);
    const incoming = Array.from(selected);
    const next: LocalFile[] = [...files];
    for (const f of incoming) {
      if (next.length >= MAX_FILES) {
        setError(`Máximo de ${MAX_FILES} arquivos.`);
        break;
      }
      if (!ACCEPTED.includes(f.type)) {
        setError(`"${f.name}" não é uma imagem suportada (JPEG, PNG ou WEBP).`);
        continue;
      }
      if (f.size > MAX_SIZE) {
        setError(`"${f.name}" excede 10MB.`);
        continue;
      }
      next.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setFiles(next);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      if (removed) URL.revokeObjectURL(removed.preview);
      return copy;
    });
  };

  const handleUpload = async () => {
    if (files.length === 0 || !state.clientId || uploading) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('clienteId', state.clientId);
      if (state.dnaAnswers.tom_de_voz) {
        form.append('captions', `Tom de voz desejado: ${state.dnaAnswers.tom_de_voz}`);
      }
      files.forEach((lf) => form.append('images', lf.file));

      const res = await api.post('/branding-upload/branding/extract-from-upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      patch({ uploadedFiles: files.map((lf) => lf.file.name) });

      // Se o backend extraiu um DNA das imagens, repassa para a Step 4 reusar.
      const extracted = res?.data?.data?.extracted as OnboardingExtractedBranding | undefined;
      if (extracted) onExtracted(extracted);

      setDone(true);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Falha no upload. Você pode pular esta etapa.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Upload de Materiais</h2>
        <p className="text-sm text-gray-400 mt-1">
          Envie logo, exemplos de posts ou referências visuais (opcional). A IA usa essas imagens para enriquecer o DNA.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {!done ? (
        <>
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
          >
            <UploadCloud className="w-10 h-10 text-gray-500 mx-auto mb-3" />
            <p className="text-sm text-gray-300">Clique para selecionar imagens</p>
            <p className="text-xs text-gray-500 mt-1">JPEG, PNG ou WEBP · até {MAX_FILES} arquivos · máx 10MB cada</p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(',')}
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {files.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {files.map((lf, idx) => (
                <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-600">
                  <img src={lf.preview} alt={lf.file.name} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeFile(idx)}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 rounded-full p-1 text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-6 flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-300">{files.length} arquivo(s) enviado(s) com sucesso!</p>
            <p className="text-xs text-gray-400 mt-0.5">A IA já analisou os materiais. Avance para revisar o DNA.</p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-2">
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-sm rounded-xl transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="flex gap-3">
          <button
            onClick={onNext}
            className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-xl transition-colors"
          >
            Pular Upload
          </button>
          {!done ? (
            <button
              onClick={handleUpload}
              disabled={files.length === 0 || uploading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {uploading ? 'Enviando...' : 'Enviar e Continuar'}
            </button>
          ) : (
            <button
              onClick={onNext}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-2"
            >
              Próximo <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
