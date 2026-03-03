import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../services/api';

type DataComemorativa = {
  id: string;
  data: string; // ISO yyyy-mm-dd
  titulo: string;
  categorias: string[];
  descricao: string | null;
  relevancia: number;
  criado_em: string;
};

type EditForm = {
  id?: string;
  data: string;
  titulo: string;
  categorias: string;
  descricao: string;
  relevancia: number;
};

const monthLabelPtBr = (month: number) => {
  const labels = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  return labels[month - 1] || `Mês ${month}`;
};

const categoryColorClass = (category: string) => {
  const key = (category || '').toLowerCase();

  // 📅 Categorias de Calendário (fixas)
  if (key.includes('feriado')) return 'border-red-600/50 bg-red-600/10 text-red-300';
  if (key.includes('ponto facultativo')) return 'border-yellow-600/50 bg-yellow-600/10 text-yellow-300';
  if (key === 'geral' || key.includes('geral')) return 'border-gray-600 bg-gray-800 text-gray-200';

  const palette = [
    'border-blue-500/50 bg-blue-500/10 text-blue-200',
    'border-emerald-500/50 bg-emerald-500/10 text-emerald-200',
    'border-violet-500/50 bg-violet-500/10 text-violet-200',
    'border-amber-500/50 bg-amber-500/10 text-amber-200',
    'border-cyan-500/50 bg-cyan-500/10 text-cyan-200',
    'border-rose-500/50 bg-rose-500/10 text-rose-200',
    'border-orange-500/50 bg-orange-500/10 text-orange-200',
    'border-lime-500/50 bg-lime-500/10 text-lime-200',
    'border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-200',
    'border-indigo-500/50 bg-indigo-500/10 text-indigo-200',
    'border-teal-500/50 bg-teal-500/10 text-teal-200',
    'border-sky-500/50 bg-sky-500/10 text-sky-200',
    'border-stone-500/50 bg-stone-500/10 text-stone-200',
    'border-zinc-500/50 bg-zinc-500/10 text-zinc-200',
  ];

  const normalized = key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }

  return palette[hash % palette.length] || 'border-gray-600 bg-gray-800 text-gray-200';
};

const buildBadges = (categorias: string[]) => {
  const unique = Array.from(new Set((categorias || []).map((c) => String(c).trim()).filter(Boolean)));
  return unique;
};

export default function GeneralCalendarPage() {
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [syncLoading, setSyncLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [datas, setDatas] = useState<DataComemorativa[]>([]);

  const [showModal, setShowModal] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [form, setForm] = useState<EditForm>({
    data: new Date().toISOString().slice(0, 10),
    titulo: '',
    categorias: 'geral',
    descricao: '',
    relevancia: 5,
  });

  const fetchDatas = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = { mes: month, ano: year };
      if (categoryFilter.trim()) params.categorias = categoryFilter.trim();

      const res = await api.get('/datas-comemorativas', { params });
      setDatas(res.data?.datas || []);
    } catch (e: any) {
      console.error(e);
      setError(e?.response?.data?.error || 'Erro ao carregar datas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, categoryFilter]);

  const allCategories = useMemo(() => {
    const fixedCategories = ['Feriado', 'Feriado Nacional', 'Ponto Facultativo', 'Geral'];
    const set = new Set<string>();

    for (const c of fixedCategories) set.add(c);
    for (const d of datas) {
      const cats = Array.isArray(d.categorias) ? d.categorias : [];
      for (const c of cats) set.add(String(c));
    }

    const fixedOrder = new Map<string, number>(fixedCategories.map((c, i) => [c.toLowerCase(), i]));
    return Array.from(set).sort((a, b) => {
      const ai = fixedOrder.get(String(a).toLowerCase());
      const bi = fixedOrder.get(String(b).toLowerCase());
      if (ai != null && bi != null) return ai - bi;
      if (ai != null) return -1;
      if (bi != null) return 1;
      return a.localeCompare(b);
    });
  }, [datas]);

  const openCreate = () => {
    setForm({
      data: new Date(year, month - 1, Math.min(15, new Date(year, month, 0).getDate())).toISOString().slice(0, 10),
      titulo: '',
      categorias: categoryFilter.trim() || 'geral',
      descricao: '',
      relevancia: 5,
    });
    setShowModal(true);
  };

  const openEdit = (d: DataComemorativa) => {
    setForm({
      id: d.id,
      data: (d.data || '').slice(0, 10),
      titulo: d.titulo || '',
      categorias: buildBadges(d.categorias).join(', '),
      descricao: d.descricao || '',
      relevancia: Number.isFinite(Number(d.relevancia)) ? Number(d.relevancia) : 0,
    });
    setShowModal(true);
  };

  const save = async () => {
    try {
      setSaving(true);
      setError(null);

      const payload = {
        data: form.data,
        titulo: form.titulo,
        categorias: form.categorias,
        descricao: form.descricao,
        relevancia: form.relevancia,
      };

      if (!payload.data || !payload.titulo.trim()) {
        setError("Preencha 'Data' e 'Título'.");
        return;
      }

      if (form.id) {
        await api.put(`/datas-comemorativas/${form.id}`, payload);
      } else {
        await api.post('/datas-comemorativas', payload);
      }

      setShowModal(false);
      await fetchDatas();
    } catch (e: any) {
      console.error(e);
      setError(e?.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const ok = window.confirm('Deseja remover esta data?');
    if (!ok) return;

    try {
      setSaving(true);
      setError(null);
      await api.delete(`/datas-comemorativas/${id}`);
      await fetchDatas();
    } catch (e: any) {
      console.error(e);
      setError(e?.response?.data?.error || 'Erro ao remover.');
    } finally {
      setSaving(false);
    }
  };

  const syncHolidays = async () => {
    try {
      setSyncLoading(true);
      setError(null);
      await api.post('/datas-comemorativas/sync', null, { params: { ano: year } });
      await fetchDatas();
    } catch (e: any) {
      console.error(e);
      setError(e?.response?.data?.error || 'Erro ao sincronizar feriados.');
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <Link
                to="/"
                className="inline-flex items-center text-sm text-gray-400 hover:text-white mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para o Início
              </Link>
              <h1 className="text-3xl font-bold">Calendário Geral</h1>
              <p className="text-gray-400 mt-1">
                Central de datas e feriados para orientar todos os calendários de conteúdo
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={syncHolidays}
                disabled={syncLoading}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-medium"
                title="Busca feriados nacionais via internet (BrasilAPI) e grava no banco"
              >
                {syncLoading ? 'Sincronizando…' : `Sincronizar feriados (${year})`}
              </button>
              <button
                onClick={openCreate}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold"
              >
                + Adicionar data
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
              <label className="block text-xs text-gray-400 mb-1">Mês</label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 focus:outline-none"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {monthLabelPtBr(i + 1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
              <label className="block text-xs text-gray-400 mb-1">Ano</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 focus:outline-none"
              />
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Filtrar por nicho/categoria</label>
              <div className="flex items-center gap-2">
                <input
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  placeholder="Ex: saude, fitness, kids, geral"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 focus:outline-none"
                />
                <button
                  onClick={() => setCategoryFilter('')}
                  className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-md text-sm"
                >
                  Limpar
                </button>
              </div>
              {allCategories.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {allCategories.slice(0, 10).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategoryFilter(c)}
                      className={`text-[11px] px-2 py-1 rounded-full border ${categoryColorClass(c)}`}
                      title="Clique para filtrar"
                      type="button"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-gray-300">Carregando…</div>
        ) : datas.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-400 text-lg mb-2">Nenhuma data cadastrada para este mês</div>
            <div className="text-gray-500 text-sm mb-6">
              Dica: sincronize feriados do ano ou adicione datas por nicho.
            </div>
            <button
              onClick={openCreate}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold"
            >
              + Adicionar primeira data
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datas.map((d) => {
              const cats = buildBadges(d.categorias);
              const primary = cats[0] || 'geral';
              const dateLabel = (() => {
                try {
                  if (!d.data || typeof d.data !== 'string') return 'Data inválida';
                  const raw = d.data.slice(0, 10);
                  // Parse ISO date string (YYYY-MM-DD) sem conversão UTC
                  const parts = raw.split('-');
                  if (parts.length !== 3) return d.data;
                  const [year, month, day] = parts.map(Number);
                  if (isNaN(year) || isNaN(month) || isNaN(day)) return d.data;
                  const dt = new Date(year, month - 1, day);
                  if (isNaN(dt.getTime())) return d.data;
                  return dt.toLocaleDateString('pt-BR');
                } catch {
                  return d.data || 'Data inválida';
                }
              })();

              return (
                <div
                  key={d.id}
                  className={`border rounded-xl p-4 transition-colors hover:border-blue-500 ${categoryColorClass(primary)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-gray-300">{dateLabel}</div>
                      <h3 className="text-lg font-semibold text-white mt-1">{d.titulo}</h3>
                    </div>
                    <div className="text-xs text-gray-300">Relevância: {d.relevancia ?? 0}</div>
                  </div>

                  {cats.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {cats.map((c) => (
                        <span key={c} className={`text-[11px] px-2 py-1 rounded-full border ${categoryColorClass(c)}`}>
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {d.descricao && (
                    <p className="mt-3 text-sm text-gray-200/90 leading-relaxed">
                      {d.descricao}
                    </p>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => openEdit(d)}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove(d.id)}
                      className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 px-3 py-2 rounded-lg text-sm text-red-200"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg border border-gray-700">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold">{form.id ? 'Editar data' : 'Adicionar data'}</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Data</label>
                <input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Relevância</label>
                <input
                  type="number"
                  value={form.relevancia}
                  onChange={(e) => setForm((p) => ({ ...p, relevancia: parseInt(e.target.value, 10) }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Título</label>
                <input
                  value={form.titulo}
                  onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Dia Mundial da Saúde"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Categorias (separadas por vírgula)</label>
                <input
                  value={form.categorias}
                  onChange={(e) => setForm((p) => ({ ...p, categorias: e.target.value }))}
                  placeholder="geral, saude, fitness, kids"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Descrição (opcional)</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                  placeholder="Contexto/observações para orientar os conteúdos"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none min-h-[90px]"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg font-medium"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={save}
                className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-semibold disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
