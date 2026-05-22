// STORY-010 — Barra de completude do DNA com badge colorido (AC6/AC8).
//   verde (>=80%), amarelo (40-79%), vermelho (<40%).

interface Props {
  percentual: number;
  label?: string;
  compact?: boolean;
}

function colorFor(pct: number): { bar: string; text: string; badge: string } {
  if (pct >= 80) return { bar: 'bg-green-500', text: 'text-green-400', badge: 'bg-green-500/20 text-green-300 border-green-500/40' };
  if (pct >= 40) return { bar: 'bg-yellow-500', text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' };
  return { bar: 'bg-red-500', text: 'text-red-400', badge: 'bg-red-500/20 text-red-300 border-red-500/40' };
}

export default function DnaCompletenessBar({ percentual, label = 'DNA da Marca', compact = false }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(percentual)));
  const c = colorFor(pct);

  if (compact) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-gray-400">{label}</span>
          <span className={`text-[11px] font-bold ${c.text}`}>{pct}%</span>
        </div>
        <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
          <div className={`h-1.5 rounded-full transition-all duration-500 ${c.bar}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-300">{label}</span>
        <span className={`text-sm font-bold px-2 py-0.5 rounded-full border ${c.badge}`}>{pct}%</span>
      </div>
      <div className="w-full bg-gray-700 h-2.5 rounded-full overflow-hidden">
        <div className={`h-2.5 rounded-full transition-all duration-500 ${c.bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
