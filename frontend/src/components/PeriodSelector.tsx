import { useState, useEffect, useRef } from 'react';

interface PeriodSelectorProps {
  availableMonths: string[];
  selectedMonths: string[];
  periodMode: 'ultimo' | 'unico' | 'multiplos';
  onPeriodChange: (mode: 'ultimo' | 'unico' | 'multiplos', months: string[]) => void;
  onFetchMonths: () => void;
}

export default function PeriodSelector({
  availableMonths,
  selectedMonths,
  periodMode,
  onPeriodChange,
  onFetchMonths
}: PeriodSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDisplayText = () => {
    if (periodMode === 'ultimo') {
      return '🗓️ Último calendário';
    }
    if (periodMode === 'unico' && selectedMonths.length === 1) {
      return `🗓️ ${selectedMonths[0]}`;
    }
    if (periodMode === 'multiplos' && selectedMonths.length > 0) {
      return `🗓️ ${selectedMonths.length} ${selectedMonths.length === 1 ? 'mês' : 'meses'}`;
    }
    return '🗓️ Selecionar período';
  };

  const handleModeChange = (mode: 'ultimo' | 'unico' | 'multiplos') => {
    if (mode === 'unico' || mode === 'multiplos') {
      onFetchMonths();
    }
    onPeriodChange(mode, mode === 'ultimo' ? [] : selectedMonths);
  };

  const handleMonthToggle = (month: string) => {
    if (periodMode === 'unico') {
      onPeriodChange('unico', [month]);
    } else if (periodMode === 'multiplos') {
      const newSelection = selectedMonths.includes(month)
        ? selectedMonths.filter(m => m !== month)
        : [...selectedMonths, month];
      onPeriodChange('multiplos', newSelection);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 text-sm border border-gray-600"
      >
        {getDisplayText()}
        <span className="text-xs">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50 min-w-[280px] p-4">
          <h3 className="text-sm font-bold text-white mb-3">📅 Selecionar Período</h3>
          
          {/* Opção: Último calendário */}
          <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-700 cursor-pointer mb-2">
            <input
              type="radio"
              name="period-mode"
              checked={periodMode === 'ultimo'}
              onChange={() => handleModeChange('ultimo')}
              className="w-4 h-4"
            />
            <div>
              <div className="text-white text-sm font-medium">Último calendário</div>
              <div className="text-gray-400 text-xs">Usa o calendário mais recente</div>
            </div>
          </label>

          {/* Opção: Mês específico */}
          <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-700 cursor-pointer mb-2">
            <input
              type="radio"
              name="period-mode"
              checked={periodMode === 'unico'}
              onChange={() => handleModeChange('unico')}
              className="w-4 h-4"
            />
            <div>
              <div className="text-white text-sm font-medium">Mês específico</div>
              <div className="text-gray-400 text-xs">Escolha um único mês</div>
            </div>
          </label>

          {periodMode === 'unico' && availableMonths.length > 0 && (
            <div className="ml-6 mb-2 space-y-1">
              {availableMonths.map((month) => (
                <label
                  key={month}
                  className="flex items-center gap-2 p-2 rounded hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="single-month"
                    checked={selectedMonths.includes(month)}
                    onChange={() => handleMonthToggle(month)}
                    className="w-4 h-4"
                  />
                  <span className="text-white text-sm">{month}</span>
                </label>
              ))}
            </div>
          )}

          {/* Opção: Múltiplos meses */}
          <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-700 cursor-pointer mb-2">
            <input
              type="radio"
              name="period-mode"
              checked={periodMode === 'multiplos'}
              onChange={() => handleModeChange('multiplos')}
              className="w-4 h-4"
            />
            <div>
              <div className="text-white text-sm font-medium">Múltiplos meses</div>
              <div className="text-gray-400 text-xs">Combine vários meses</div>
            </div>
          </label>

          {periodMode === 'multiplos' && availableMonths.length > 0 && (
            <div className="ml-6 mb-2 space-y-1">
              {availableMonths.map((month) => (
                <label
                  key={month}
                  className="flex items-center gap-2 p-2 rounded hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedMonths.includes(month)}
                    onChange={() => handleMonthToggle(month)}
                    className="w-4 h-4"
                  />
                  <span className="text-white text-sm">{month}</span>
                </label>
              ))}
            </div>
          )}

          {(periodMode === 'unico' || periodMode === 'multiplos') && availableMonths.length === 0 && (
            <div className="ml-6 text-gray-400 text-xs italic">
              Carregando meses disponíveis...
            </div>
          )}

          <button
            onClick={() => setIsOpen(false)}
            className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
