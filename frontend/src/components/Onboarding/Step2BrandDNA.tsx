// STORY-010 Step 2 — DNA de marca guiado (perguntas conversacionais).
// Os dados ficam apenas no estado local do wizard até a Step 4/5.
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { TONE_OPTIONS, type WizardState } from './wizardTypes';

interface Props {
  state: WizardState;
  patch: (p: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step2BrandDNA({ state, patch, onNext, onBack }: Props) {
  const { dnaAnswers } = state;
  const setAns = (k: keyof WizardState['dnaAnswers'], v: string) =>
    patch({ dnaAnswers: { ...dnaAnswers, [k]: v } });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">DNA de Marca Guiado</h2>
        <p className="text-sm text-gray-400 mt-1">
          Responda às perguntas abaixo. A IA usa essas respostas para montar o DNA completo da marca.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-sm font-semibold text-gray-200 block mb-1">Tom de voz</label>
          <p className="text-xs text-gray-500 mb-2">
            Como sua marca fala? Ex: técnico e formal, descontraído e próximo, inspirador e motivacional.
          </p>
          <div className="flex flex-wrap gap-2 mb-2">
            {TONE_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAns('tom_de_voz', t)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  dnaAnswers.tom_de_voz === t
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            value={dnaAnswers.tom_de_voz}
            onChange={(e) => setAns('tom_de_voz', e.target.value)}
            placeholder="Ou descreva o tom de voz com suas palavras"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-200 block mb-1">Público-alvo</label>
          <p className="text-xs text-gray-500 mb-2">Quem é seu cliente ideal? Idade, profissão, dores principais.</p>
          <textarea
            value={dnaAnswers.publico_alvo}
            onChange={(e) => setAns('publico_alvo', e.target.value)}
            rows={2}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-200 block mb-1">Posicionamento</label>
          <p className="text-xs text-gray-500 mb-2">Em que sua empresa é diferente dos concorrentes?</p>
          <textarea
            value={dnaAnswers.posicionamento}
            onChange={(e) => setAns('posicionamento', e.target.value)}
            rows={2}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-200 block mb-1">Valores</label>
          <p className="text-xs text-gray-500 mb-2">Quais são os 3 valores inegociáveis da sua marca?</p>
          <input
            value={dnaAnswers.valores}
            onChange={(e) => setAns('valores', e.target.value)}
            placeholder="Ex: transparência, excelência, inovação"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-200 block mb-1">Objetivos de conteúdo</label>
          <p className="text-xs text-gray-500 mb-2">O que você quer que seu conteúdo cause? Ex: autoridade, vendas, comunidade.</p>
          <input
            value={dnaAnswers.objetivos_conteudo}
            onChange={(e) => setAns('objetivos_conteudo', e.target.value)}
            placeholder="Ex: gerar autoridade e atrair leads qualificados"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-sm rounded-xl transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-2"
        >
          Próximo <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
