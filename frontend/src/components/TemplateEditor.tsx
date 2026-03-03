import { useRef, useEffect } from 'react';

// — Tokens que vêm do DNA da Marca (preservados automaticamente, não podem ser removidos)
const LOCKED_TOKENS: Record<string, string> = {
  DNA_DA_MARCA: 'Personalidade, voz, arquétipo e identidade da marca',
  DATAS_COMEMORATIVAS: 'Calendário de datas estratégicas do mês',
  REGRAS_OBRIGATORIAS: 'Diretrizes e restrições definidas no branding',
  DOCS_EXTRAS: 'Documentos de referência adicionais da marca',
};

// — Tokens dinâmicos (preenchidos no momento da geração)
const DYNAMIC_TOKENS: Record<string, string> = {
  MIX_POSTS: 'Distribuição de formatos (Reels, Carrossel, Static…)',
  MES: 'Mês e ano da geração',
  DATA_HOJE: 'Data atual da geração',
  BRIEFING: 'Briefing específico inserido pelo usuário',
  REFERENCIAS_MES: 'Referências de mês adicionadas pelo usuário',
  CONTINUIDADE: 'Contexto do calendário anterior (evita repetição)',
  INSTRUCOES_AVANCADAS: 'Prompt avançado personalizado do usuário',
  INSTRUCOES_POR_FORMATO: 'Instruções específicas por formato de conteúdo',
};

type Segment =
  | { type: 'text'; value: string; index: number }
  | { type: 'locked'; token: string }
  | { type: 'dynamic'; token: string };

function parseBody(body: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /\{\{([A-Z_]+)\}\}/g;
  let lastIndex = 0;
  let textIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: body.slice(lastIndex, match.index), index: textIndex++ });
    }
    const token = match[1];
    if (LOCKED_TOKENS[token]) {
      segments.push({ type: 'locked', token });
    } else if (DYNAMIC_TOKENS[token]) {
      segments.push({ type: 'dynamic', token });
    } else {
      segments.push({ type: 'text', value: match[0], index: textIndex++ });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < body.length) {
    segments.push({ type: 'text', value: body.slice(lastIndex), index: textIndex++ });
  }

  return segments;
}

function rebuildBody(segments: Segment[], textValues: Record<number, string>): string {
  return segments
    .map((seg) => {
      if (seg.type === 'text') return textValues[seg.index] ?? seg.value;
      return `{{${seg.token}}}`;
    })
    .join('');
}

interface AutoResizeTextareaProps {
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}

function AutoResizeTextarea({ value, onChange, readOnly }: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full resize-none bg-transparent text-[13px] font-mono leading-7 outline-none border-0 p-0 text-slate-200 ${readOnly
          ? 'cursor-default opacity-60'
          : 'focus:bg-cyan-950/20 rounded transition-colors px-1 -mx-1'
        }`}
      style={{ minHeight: '1.5rem', overflow: 'hidden' }}
    />
  );
}

interface TemplateEditorProps {
  body: string;
  onChange: (newBody: string) => void;
  readOnly?: boolean;
}

export default function TemplateEditor({ body, onChange, readOnly = false }: TemplateEditorProps) {
  const segments = parseBody(body);

  const textValues: Record<number, string> = {};
  segments.forEach((seg) => {
    if (seg.type === 'text') {
      textValues[seg.index] = seg.value;
    }
  });

  const handleTextChange = (index: number, newValue: string) => {
    const updatedValues = { ...textValues, [index]: newValue };
    const newBody = rebuildBody(segments, updatedValues);
    onChange(newBody);
  };

  // Detectar quais tokens estão presentes no body
  const presentLocked = Object.keys(LOCKED_TOKENS).filter((t) => body.includes(`{{${t}}}`));
  const missingRequired = Object.keys(LOCKED_TOKENS).filter((t) => !body.includes(`{{${t}}}`));

  return (
    <div className="flex flex-col gap-5">

      {/* — Legenda de Tokens */}
      <div className="grid grid-cols-2 gap-3">
        {/* Coluna esquerda: tokens da marca */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-500 mb-2">
            🔒 DNA da Marca — imutáveis
          </p>
          {Object.entries(LOCKED_TOKENS).map(([token, desc]) => (
            <div key={token} className="flex items-start gap-2">
              <span
                className={`flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border ${presentLocked.includes(token)
                    ? 'bg-cyan-950/50 text-cyan-400 border-cyan-700/50'
                    : 'bg-red-950/40 text-red-400 border-red-700/40'
                  }`}
              >
                {token}
              </span>
              <span className="text-[11px] text-slate-500 leading-tight">{desc}</span>
            </div>
          ))}
        </div>

        {/* Coluna direita: tokens dinâmicos */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400 mb-2">
            ⚙ Dinâmicos — preenchidos na geração
          </p>
          {Object.entries(DYNAMIC_TOKENS).map(([token, desc]) => (
            <div key={token} className="flex items-start gap-2">
              <span className="flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border bg-violet-950/40 text-violet-400 border-violet-700/40">
                {token}
              </span>
              <span className="text-[11px] text-slate-500 leading-tight">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* — Aviso de tokens faltando */}
      {missingRequired.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-700/40 bg-amber-950/20 px-4 py-3">
          <span className="text-amber-400 text-sm">⚠</span>
          <p className="text-[12px] text-amber-300/80">
            <strong>Atenção:</strong> os tokens essenciais{' '}
            <code className="text-amber-400">{missingRequired.map(t => `{{${t}}}`).join(', ')}</code>{' '}
            foram removidos do template. Eles serão preservados automaticamente ao salvar para garantir a geração correta.
          </p>
        </div>
      )}

      {/* — Editor real */}
      <div
        className={`rounded-lg border bg-[#080c12] p-5 min-h-[400px] ${readOnly ? 'border-slate-700/30' : 'border-slate-600/50 focus-within:border-cyan-700/50 transition-colors'
          }`}
      >
        {!readOnly && (
          <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-4 font-semibold">
            ✎ Edite o texto entre os tokens — os tokens são preservados automaticamente
          </p>
        )}
        <div className="font-mono text-[13px] leading-7">
          {segments.map((seg, i) => {
            if (seg.type === 'text') {
              return (
                <AutoResizeTextarea
                  key={`text-${seg.index}-${i}`}
                  value={textValues[seg.index] ?? seg.value}
                  onChange={(v) => handleTextChange(seg.index, v)}
                  readOnly={readOnly}
                />
              );
            }

            if (seg.type === 'locked') {
              return (
                <span
                  key={`locked-${i}`}
                  title={LOCKED_TOKENS[seg.token] ?? 'Token do DNA da Marca'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-700/60 mx-0.5 my-0.5 select-none cursor-help"
                >
                  <span className="opacity-70">🔒</span>
                  {seg.token}
                </span>
              );
            }

            // dynamic
            return (
              <span
                key={`dynamic-${i}`}
                title={DYNAMIC_TOKENS[seg.token] ?? 'Token dinâmico'}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold font-mono bg-violet-950/50 text-violet-300 border border-violet-700/50 mx-0.5 my-0.5 select-none cursor-help"
              >
                <span className="opacity-70">⚙</span>
                {seg.token}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
