import React, { useEffect, useMemo, useState } from 'react';
import {
  HiOutlineFolderPlus,
  HiOutlineHashtag,
  HiOutlineMagnifyingGlass,
  HiOutlineShieldCheck,
  HiOutlineSquares2X2,
  HiOutlineTag,
  HiOutlineTrash
} from 'react-icons/hi2';
import axios from '../../api/axiosInstance';

const PROTECTED_KEYS = new Set(['brand', 'type', 'size', 'collection', 'gender', 'color']);

const normalizeCategories = (payload = {}) => {
  const out = {};
  if (payload && typeof payload === 'object') {
    Object.entries(payload).forEach(([k, v]) => {
      out[k] = Array.isArray(v) ? v : [];
    });
  }
  PROTECTED_KEYS.forEach(k => {
    if (!Object.prototype.hasOwnProperty.call(out, k)) {
      out[k] = [];
    }
  });
  return out;
};

const normalizeKeyName = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const CategoryManagerPage = () => {
  const [categories, setCategories] = useState({});
  const [catForm, setCatForm] = useState({ key: '', value: '' });
  const [newKey, setNewKey] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const keys = useMemo(() => Object.keys(categories).sort((a, b) => a.localeCompare(b)), [categories]);

  const summary = useMemo(() => {
    const totalKeys = keys.length;
    const protectedCount = keys.filter(key => PROTECTED_KEYS.has(key)).length;
    const totalValues = keys.reduce((acc, key) => acc + (categories[key]?.length || 0), 0);
    const customKeys = totalKeys - protectedCount;

    return {
      totalKeys,
      protectedCount,
      totalValues,
      customKeys
    };
  }, [categories, keys]);

  const filteredKeys = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) {
      return keys;
    }

    return keys.filter(key => {
      const values = categories[key] || [];
      return (
        key.toLowerCase().includes(needle) ||
        values.some(value => String(value).toLowerCase().includes(needle))
      );
    });
  }, [categories, keys, searchTerm]);

  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get('/api/categories');
        const normalized = normalizeCategories(data);
        setCategories(normalized);
        setCatForm(prev => {
          const currentKey =
            prev.key && Object.prototype.hasOwnProperty.call(normalized, prev.key)
              ? prev.key
              : Object.keys(normalized)[0] || '';
          return { ...prev, key: currentKey };
        });
        setError('');
      } catch {
        setError('No se pudieron cargar las categorias.');
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, []);

  const syncCategories = nextCategories => {
    const normalized = normalizeCategories(nextCategories);
    setCategories(normalized);
    setCatForm(prev => {
      const nextKey =
        prev.key && Object.prototype.hasOwnProperty.call(normalized, prev.key)
          ? prev.key
          : Object.keys(normalized)[0] || '';
      return { ...prev, key: nextKey };
    });
  };

  const handleAddCategory = async () => {
    const { key, value } = catForm;
    const trimmed = String(value || '').trim();
    if (!key || !trimmed) return;

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const { data } = await axios.post('/api/categories', { key, value: trimmed });
      syncCategories(data);
      setCatForm(prev => ({ ...prev, value: '' }));
      setMessage(`Valor agregado en ${key}.`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al crear el valor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (key, value) => {
    if (!window.confirm(`Eliminar "${value}" de ${key}?`)) return;

    setError('');
    setMessage('');

    try {
      const { data } = await axios.delete('/api/categories', { data: { key, value } });
      syncCategories(data);
      setMessage(`Valor "${value}" eliminado de ${key}.`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al eliminar el valor.');
    }
  };

  const handleAddKey = async () => {
    const key = normalizeKeyName(newKey);
    if (!key) return;

    setError('');
    setMessage('');

    try {
      const { data } = await axios.post('/api/categories/key', { key });
      syncCategories(data);
      setCatForm(prev => ({ ...prev, key }));
      setNewKey('');
      setMessage(`Clave "${key}" creada correctamente.`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al crear la clave.');
    }
  };

  const handleDeleteKey = async key => {
    if (PROTECTED_KEYS.has(key)) {
      setError('No se puede eliminar una clave por defecto.');
      return;
    }
    if (!window.confirm(`Eliminar la clave "${key}" y todos sus valores?`)) return;

    setError('');
    setMessage('');

    try {
      const { data } = await axios.delete('/api/categories/key', { data: { key } });
      syncCategories(data);
      setMessage(`Clave "${key}" eliminada.`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al eliminar la clave.');
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[2rem] bg-white p-6 shadow-brand-sm">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Catalogo</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">Gestion de categorias</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Administra claves y valores que alimentan filtros, fichas de producto y menu comercial.
              </p>
            </div>
            <div className="grid gap-3 rounded-3xl border border-surface-200 bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Claves</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.totalKeys}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Valores</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.totalValues}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Protegidas</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.protectedCount}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Personalizadas</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.customKeys}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <HiOutlineTag className="text-2xl" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Agregar valor</h2>
                <p className="text-sm text-slate-500">Asigna nuevos valores a una clave existente.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-[0.9fr_1.2fr_auto]">
              <label className="text-sm text-slate-600">
                Clave
                <select
                  value={catForm.key}
                  onChange={event => setCatForm(prev => ({ ...prev, key: event.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                >
                  {keys.map(key => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Nuevo valor
                <input
                  value={catForm.value}
                  onChange={event => setCatForm(prev => ({ ...prev, value: event.target.value }))}
                  placeholder="Ej: Chaquetas"
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                />
              </label>
              <div className="flex items-end">
                <button
                  onClick={handleAddCategory}
                  disabled={submitting || !catForm.key || !catForm.value.trim()}
                  className="w-full rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Agregando...' : 'Agregar'}
                </button>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <HiOutlineFolderPlus className="text-2xl" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Crear clave nueva</h2>
                <p className="text-sm text-slate-500">Ejemplo: `material`, `temporada`, `fit`.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
              <label className="text-sm text-slate-600">
                Nombre de clave
                <input
                  value={newKey}
                  onChange={event => setNewKey(event.target.value)}
                  placeholder="Ej: material"
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5"
                />
              </label>
              <div className="flex items-end">
                <button
                  onClick={handleAddKey}
                  disabled={!newKey.trim()}
                  className="w-full rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Crear clave
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              La clave se normaliza a minúsculas y reemplaza espacios por `_`.
            </p>
          </article>
        </section>

        {(error || message) && (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              error
                ? 'border border-red-200 bg-red-50 text-red-700'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {error || message}
          </div>
        )}

        <section className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <HiOutlineSquares2X2 className="text-2xl" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Claves y valores</h2>
                <p className="text-sm text-slate-500">Busca rapidamente una clave o alguno de sus valores.</p>
              </div>
            </div>

            <label className="relative block w-full md:w-80">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <HiOutlineMagnifyingGlass className="text-lg" />
              </span>
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Buscar clave o valor"
                className="w-full rounded-2xl border border-surface-200 px-10 py-2.5 text-sm text-slate-700"
              />
            </label>
          </div>

          {loading ? (
            <div className="mt-6 rounded-2xl border border-dashed border-surface-200 px-4 py-8 text-center text-sm text-slate-500">
              Cargando categorias...
            </div>
          ) : filteredKeys.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredKeys.map(key => {
                const values = categories[key] || [];
                const isProtected = PROTECTED_KEYS.has(key);

                return (
                  <article key={key} className="rounded-3xl border border-surface-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-950">{key}</h3>
                          {isProtected ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                              <HiOutlineShieldCheck className="text-sm" />
                              Protegida
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                              <HiOutlineHashtag className="text-sm" />
                              Personalizada
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                          {values.length} valor{values.length === 1 ? '' : 'es'} cargado{values.length === 1 ? '' : 's'}.
                        </p>
                      </div>

                      <button
                        onClick={() => handleDeleteKey(key)}
                        disabled={isProtected}
                        className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                          isProtected
                            ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                            : 'bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                        title={isProtected ? 'Clave protegida' : 'Eliminar clave'}
                      >
                        <HiOutlineTrash className="text-base" />
                        Eliminar
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {values.length ? (
                        values.map(value => (
                          <div
                            key={value}
                            className="inline-flex items-center gap-2 rounded-full border border-surface-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
                          >
                            <span>{value}</span>
                            <button
                              onClick={() => handleDeleteCategory(key, value)}
                              className="text-slate-400 transition hover:text-red-600"
                              title="Eliminar valor"
                            >
                              <HiOutlineTrash className="text-sm" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-surface-200 bg-white px-4 py-5 text-sm text-slate-500">
                          No hay valores cargados en esta clave.
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-surface-200 px-4 py-8 text-center text-sm text-slate-500">
              No hay resultados para tu busqueda.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CategoryManagerPage;
