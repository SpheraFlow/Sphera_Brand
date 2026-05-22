// STORY-010 — Indicador de progresso do wizard (steps numerados 1/6 ... 6/6).
import { Check } from 'lucide-react';
import type { WizardStep } from './wizardTypes';

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 1, label: 'Dados Básicos' },
  { id: 2, label: 'DNA Guiado' },
  { id: 3, label: 'Materiais' },
  { id: 4, label: 'IA Preenche' },
  { id: 5, label: 'Revisão' },
  { id: 6, label: 'Calendário' },
];

export default function StepIndicator({ current }: { current: WizardStep }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Passo {current} de {STEPS.length}
        </span>
        <span className="text-xs text-gray-500">{STEPS[current - 1]?.label}</span>
      </div>

      <div className="flex items-center">
        {STEPS.map((s, idx) => {
          const done = s.id < current;
          const active = s.id === current;
          return (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                    done
                      ? 'bg-green-600 border-green-500 text-white'
                      : active
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-600 text-gray-500'
                  }`}
                >
                  {done ? <Check className="w-4 h-4" /> : s.id}
                </div>
                <span
                  className={`text-[10px] mt-1 whitespace-nowrap ${
                    active ? 'text-blue-300' : done ? 'text-green-400' : 'text-gray-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 mb-4 transition-colors ${
                    s.id < current ? 'bg-green-500' : 'bg-gray-700'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
