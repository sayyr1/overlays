import React, { useEffect, useMemo, useState } from 'react';
import {
  HiOutlineChevronDown,
  HiOutlineChevronUp,
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
  const [brandModels, setBrandModels] = useState({});
  const [catForm, setCatForm] = useState({ key: '', value: '' });
  const [brandModelForm, setBrandModelForm] = useState({ brand: '', model: '' });
  const [newKey, setNewKey] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [brandModelSearchTerm, setBrandModelSearchTerm] = useState('');
  const [brandModelView, setBrandModelView] = useState('all');
  const [expandedBrand, setExpandedBrand] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const keys = useMemo(() => Object.keys(categories).sort((a, b) => a.localeCompare(b)), [categories]);
  const brandList = useMemo(
    () => [...(categories.brand || [])].sort((a, b) => a.localeCompare(b)),
    [categories.brand]
  );
  const totalBrandModels = useMemo(
    () => Object.values(brandModels).reduce((acc, items) => acc + (Array.isArray(items) ? items.length : 0), 0),
    [brandModels]
  );
  const mappedBrandsCount = useMemo(
    () => brandList.filter(brand => (brandModels[brand] || []).length > 0).length,
    [brandList, brandModels]
  );
  const unmappedBrandsCount = Math.max(brandList.length - mappedBrandsCount, 0);

  const summary = useMemo(() => {
    const totalKeys = keys.length;
    const protectedCount = keys.filter(key => PROTECTED_KEYS.has(key)).length;
    const totalValues = keys.reduce((acc, key) => acc + (categories[key]?.length || 0), 0);
    const customKeys = totalKeys - protectedCount;

    return {
      totalKeys,
      protectedCount,
      totalValues,
      customKeys,
      totalBrandModels
    };
  }, [categories, keys, totalBrandModels]);

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

  const filteredBrandCards = useMemo(() => {
    const needle = brandModelSearchTerm.trim().toLowerCase();

    return brandList
      .map(brand => {
        const models = Array.isArray(brandModels[brand]) ? [...brandModels[brand]].sort((a, b) => a.localeCompare(b)) : [];
        return {
          brand,
          models,
          hasModels: models.length > 0
        };
      })
      .filter(item => {
        if (brandModelView === 'mapped' && !item.hasModels) {
          return false;
        }
        if (brandModelView === 'pending' && item.hasModels) {
          return false;
        }
        if (!needle) {
          return true;
        }

        return (
          item.brand.toLowerCase().includes(needle) ||
          item.models.some(model => model.toLowerCase().includes(needle))
        );
      })
      .sort((left, right) => {
        if (left.hasModels !== right.hasModels) {
          return left.hasModels ? -1 : 1;
        }
        return left.brand.localeCompare(right.brand);
      });
  }, [brandList, brandModelSearchTerm, brandModelView, brandModels]);

  useEffect(() => {
    if (!filteredBrandCards.length) {
      setExpandedBrand('');
      return;
    }

    setExpandedBrand(prev =>
      prev && filteredBrandCards.some(item => item.brand === prev)
        ? prev
        : filteredBrandCards[0].brand
    );
  }, [filteredBrandCards]);

  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      try {
        const [{ data }, { data: brandModelMap }] = await Promise.all([
          axios.get('/api/categories'),
          axios.get('/api/categories/brand-models')
        ]);
        const normalized = normalizeCategories(data);
        setCategories(normalized);
        setBrandModels(brandModelMap || {});
        setCatForm(prev => {
          const currentKey =
            prev.key && Object.prototype.hasOwnProperty.call(normalized, prev.key)
              ? prev.key
              : Object.keys(normalized)[0] || '';
          return { ...prev, key: currentKey };
        });
        setBrandModelForm(prev => ({
          ...prev,
          brand:
            prev.brand && (normalized.brand || []).includes(prev.brand)
              ? prev.brand
              : normalized.brand?.[0] || ''
        }));
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
    setBrandModelForm(prev => ({
      ...prev,
      brand:
        prev.brand && (normalized.brand || []).includes(prev.brand)
          ? prev.brand
          : normalized.brand?.[0] || ''
    }));
  };

  const syncBrandModels = nextBrandModels => {
    setBrandModels(nextBrandModels && typeof nextBrandModels === 'object' ? nextBrandModels : {});
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
      if (key === 'brand') {
        setBrandModels(prev => {
          const next = { ...prev };
          delete next[value];
          return next;
        });
      }
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

  const handleAddBrandModel = async () => {
    const brand = String(brandModelForm.brand || '').trim();
    const model = String(brandModelForm.model || '').trim();
    if (!brand || !model) return;

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const { data } = await axios.post('/api/categories/brand-models', { brand, model });
      syncBrandModels(data);
      setCategories(prev => ({
        ...prev,
        type: Array.from(new Set([...(prev.type || []), model]))
      }));
      setBrandModelForm(prev => ({ ...prev, model: '' }));
      setMessage(`Modelo "${model}" agregado a ${brand}.`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al agregar el modelo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBrandModel = async (brand, model) => {
    if (!window.confirm(`Eliminar "${model}" de ${brand}?`)) return;

    setError('');
    setMessage('');

    try {
      const { data } = await axios.delete('/api/categories/brand-models', {
        data: { brand, model }
      });
      syncBrandModels(data);
      setMessage(`Modelo "${model}" eliminado de ${brand}.`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al eliminar el modelo.');
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
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Modelos ligados</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.totalBrandModels}</p>
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

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-3xl border border-surface-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <HiOutlineTag className="text-2xl" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Conectar modelos a marcas</h2>
                <p className="text-sm text-slate-500">
                  Define qué modelos aparecen para cada marca en el formulario de productos.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[0.9fr_1.2fr_auto] md:gap-4">
              <label className="text-sm text-slate-600">
                Marca
                <select
                  value={brandModelForm.brand}
                  onChange={event => setBrandModelForm(prev => ({ ...prev, brand: event.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-3 text-base sm:py-2.5 sm:text-sm"
                >
                  <option value="">Selecciona una marca</option>
                  {brandList.map(brand => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Modelo
                <input
                  value={brandModelForm.model}
                  onChange={event => setBrandModelForm(prev => ({ ...prev, model: event.target.value }))}
                  placeholder="Ej: Samba, Gazelle, Air Force 1"
                  className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-3 text-base sm:py-2.5 sm:text-sm"
                />
              </label>
              <div className="flex items-end">
                <button
                  onClick={handleAddBrandModel}
                  disabled={submitting || !brandModelForm.brand || !brandModelForm.model.trim()}
                  className="w-full rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:py-3"
                >
                  Agregar modelo
                </button>
              </div>
            </div>

            {brandModelForm.brand && (
              <div className="mt-3 rounded-2xl border border-brand/15 bg-brand/5 px-4 py-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-800">{brandModelForm.brand}</span>
                {' '}tiene{' '}
                <span className="font-semibold text-slate-800">
                  {(brandModels[brandModelForm.brand] || []).length}
                </span>
                {' '}modelo{(brandModels[brandModelForm.brand] || []).length === 1 ? '' : 's'} conectado{(brandModels[brandModelForm.brand] || []).length === 1 ? '' : 's'}.
              </div>
            )}

            {!brandList.length && (
              <div className="mt-4 rounded-2xl border border-dashed border-surface-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Primero agrega marcas en la clave `brand` para poder mapear modelos.
              </div>
            )}
          </article>

          <article className="rounded-3xl border border-surface-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <HiOutlineSquares2X2 className="text-2xl" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Mapa marca -> modelos</h2>
                <p className="text-sm text-slate-500">
                  Aqui se ve exactamente qué modelos quedarán disponibles por cada marca.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
                <div className="min-w-[132px] rounded-2xl border border-surface-200 bg-slate-50 px-4 py-3 sm:min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Marcas</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{brandList.length}</p>
                </div>
                <div className="min-w-[132px] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-600">Con modelos</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-800">{mappedBrandsCount}</p>
                </div>
                <div className="min-w-[132px] rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-amber-600">Pendientes</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-800">{unmappedBrandsCount}</p>
                </div>
              </div>

              <div className="sticky top-3 z-10 -mx-1 rounded-[1.4rem] border border-surface-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[
                    { value: 'all', label: 'Todas' },
                    { value: 'mapped', label: 'Con modelos' },
                    { value: 'pending', label: 'Pendientes' }
                  ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setBrandModelView(option.value)}
                      className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition ${
                        brandModelView === option.value
                          ? 'bg-slate-950 text-white'
                          : 'border border-surface-200 bg-white text-slate-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <label className="relative mt-3 block sm:mt-3">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                    <HiOutlineMagnifyingGlass className="text-lg" />
                  </span>
                  <input
                    value={brandModelSearchTerm}
                    onChange={event => setBrandModelSearchTerm(event.target.value)}
                    placeholder="Buscar marca o modelo"
                    className="w-full rounded-2xl border border-surface-200 px-10 py-3 text-base text-slate-700 sm:py-2.5 sm:text-sm"
                  />
                </label>
              </div>
              {brandList.length ? (
                filteredBrandCards.length ? (
                filteredBrandCards.map(({ brand, models, hasModels }) => {
                  const isExpanded = expandedBrand === brand;

                  return (
                    <article
                      key={brand}
                      className={`overflow-hidden rounded-3xl border transition ${
                        isExpanded
                          ? 'border-brand/20 bg-white shadow-sm'
                          : 'border-surface-200 bg-slate-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedBrand(prev => (prev === brand ? '' : brand))}
                        className="flex w-full flex-col items-start gap-3 px-3.5 py-3.5 text-left sm:flex-row sm:items-start sm:justify-between sm:px-4 sm:py-4"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-950 sm:text-lg">{brand}</h3>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                                hasModels
                                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                  : 'bg-amber-50 text-amber-700 ring-amber-200'
                              }`}
                            >
                              {hasModels ? 'Lista' : 'Pendiente'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                            {models.length} modelo{models.length === 1 ? '' : 's'} conectado{models.length === 1 ? '' : 's'}.
                          </p>
                        </div>
                        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-surface-200 sm:px-3 sm:text-xs">
                            Marca
                          </span>
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-surface-200 bg-white text-slate-500">
                            {isExpanded ? <HiOutlineChevronUp className="text-base" /> : <HiOutlineChevronDown className="text-base" />}
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-surface-200 px-3.5 py-3.5 sm:px-4 sm:py-4">
                          <div className="grid gap-2 sm:flex sm:flex-wrap">
                            {models.length ? (
                              models.map(model => (
                                <div
                                  key={`${brand}-${model}`}
                                  className="inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-surface-200 bg-white px-3 py-3 text-sm text-slate-700 shadow-sm sm:w-auto sm:justify-start sm:rounded-full sm:py-2"
                                >
                                  <span className="truncate">{model}</span>
                                  <button
                                    onClick={() => handleDeleteBrandModel(brand, model)}
                                    className="rounded-full p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                    title="Eliminar modelo"
                                  >
                                    <HiOutlineTrash className="text-sm" />
                                  </button>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-2xl border border-dashed border-surface-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                Esta marca aun no tiene modelos asociados.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })
                ) : (
                  <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-8 text-center text-sm text-slate-500">
                    No encontramos coincidencias para esa marca o modelo.
                  </div>
                )
              ) : (
                <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-8 text-center text-sm text-slate-500">
                  No hay marcas disponibles para mapear modelos.
                </div>
              )}
            </div>
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
