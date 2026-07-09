import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../../../api/axiosInstance';
import { usePublicConfig } from '../../../context/PublicConfigContext';
import {
  DEFAULT_FILTER_STATE,
  areFiltersDifferent,
  normalizeFiltersForState,
  sanitizeFiltersForQuery
} from '../../../utils/productFilters';

const sortOptions = values =>
  Array.from(
    new Set(
      (values || [])
        .map(item => (typeof item === 'string' ? item.trim() : item))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

const ProductFilters = ({ onFilterChange, refreshKey, storeSlug, activeFilters, variant = 'panel' }) => {
  const { settings } = usePublicConfig();
  const [filters, setFilters] = useState(() => normalizeFiltersForState(activeFilters));
  const [options, setOptions] = useState({
    brands: [],
    types: [],
    models: [],
    genders: [],
    collections: [],
    sizes: [],
    minPrice: null,
    maxPrice: null
  });
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState(null);

  const fetchOptions = useCallback(async () => {
    setLoadingOptions(true);
    setError(null);

    try {
      const filtersRequest = storeSlug
        ? axios.get('/api/products/filters-options', { params: { store: storeSlug } })
        : axios.get('/api/products/filters-options');
      const [filtersResponse, categoriesResponse] = await Promise.all([
        filtersRequest,
        axios.get('/api/categories')
      ]);

      const filtersData = filtersResponse?.data || {};
      const categoriesData = categoriesResponse?.data || {};

      setOptions({
        brands: sortOptions(filtersData.brands || []),
        types: sortOptions(filtersData.types || []),
        models: sortOptions(filtersData.models || []),
        genders: sortOptions(filtersData.genders || []),
        collections: sortOptions(filtersData.collections || []),
        sizes: sortOptions(categoriesData.size || []),
        minPrice: Number.isFinite(Number(filtersData.minPrice)) ? Number(filtersData.minPrice) : null,
        maxPrice: Number.isFinite(Number(filtersData.maxPrice)) ? Number(filtersData.maxPrice) : null
      });
    } catch (err) {
      console.error('Error fetching filter options', err);
      setError('No pudimos cargar las opciones de filtros. Intenta de nuevo mas tarde.');
    } finally {
      setLoadingOptions(false);
    }
  }, [storeSlug]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions, refreshKey, storeSlug]);

  useEffect(() => {
    const normalized = normalizeFiltersForState(activeFilters);
    setFilters(prev => {
      return areFiltersDifferent(prev, normalized) ? normalized : prev;
    });
  }, [activeFilters]);

  const hasActiveFilters = useMemo(() => {
    const payload = sanitizeFiltersForQuery(filters);
    return Object.keys(payload).length > 0;
  }, [filters]);
  const primaryCatalogFieldName = settings?.catalogProfile === 'footwear' ? 'model' : 'type';
  const primaryCatalogLabel = settings?.catalogProfile === 'footwear' ? 'Modelo' : 'Categoria';
  const primaryCatalogPlaceholder = settings?.catalogProfile === 'footwear' ? 'Todos los modelos' : 'Todos los tipos';
  const primaryCatalogOptions = primaryCatalogFieldName === 'model' ? options.models : options.types;

  const isSheet = variant === 'sheet';
  const isSidebar = variant === 'sidebar';

  const handleFieldChange = event => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;

    setFilters(prev => {
      const candidate = { ...prev, [name]: nextValue };
      if (name === 'model') {
        candidate.type = '';
      }
      if (name === 'type') {
        candidate.model = '';
      }
      if (!areFiltersDifferent(prev, candidate)) {
        return prev;
      }

      onFilterChange?.(sanitizeFiltersForQuery(candidate));
      return candidate;
    });
  };

  const handleClearFilters = useCallback(() => {
    setFilters(prev => {
      if (!areFiltersDifferent(prev, DEFAULT_FILTER_STATE)) {
        return prev;
      }

      onFilterChange?.({});
      return { ...DEFAULT_FILTER_STATE };
    });
  }, [onFilterChange]);

  if (isSidebar) {
    return (
      <section className="space-y-5 rounded-[22px] border border-white/10 bg-[#141414] p-5">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <h2 className="text-lg font-semibold text-white">Filtros</h2>
          <div className="flex items-center gap-3">
            {loadingOptions && <span className="text-sm text-white/45">Cargando...</span>}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-sm font-medium text-brand transition hover:text-white"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
              Marca
            </label>
            <select
              name="brand"
              value={filters.brand}
              onChange={handleFieldChange}
              disabled={loadingOptions}
              className="w-full rounded-xl border border-white/10 bg-[#222] px-4 py-3 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="">Todas las marcas</option>
              {options.brands.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
              {primaryCatalogLabel}
            </label>
            <select
              name={primaryCatalogFieldName}
              value={filters[primaryCatalogFieldName]}
              onChange={handleFieldChange}
              disabled={loadingOptions}
              className="w-full rounded-xl border border-white/10 bg-[#222] px-4 py-3 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="">{primaryCatalogPlaceholder}</option>
              {primaryCatalogOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
              Genero
            </label>
            <select
              name="gender"
              value={filters.gender}
              onChange={handleFieldChange}
              disabled={loadingOptions}
              className="w-full rounded-xl border border-white/10 bg-[#222] px-4 py-3 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="">Todos los generos</option>
              {options.genders.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
              Coleccion
            </label>
            <select
              name="collection"
              value={filters.collection}
              onChange={handleFieldChange}
              disabled={loadingOptions}
              className="w-full rounded-xl border border-white/10 bg-[#222] px-4 py-3 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="">Todas las colecciones</option>
              {options.collections.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
              Talla
            </label>
            <select
              name="size"
              value={filters.size}
              onChange={handleFieldChange}
              disabled={loadingOptions}
              className="w-full rounded-xl border border-white/10 bg-[#222] px-4 py-3 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="">Todas las tallas</option>
              {options.sizes.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
              Precio
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                name="minPrice"
                value={filters.minPrice}
                onChange={handleFieldChange}
                disabled={loadingOptions}
                min="0"
                placeholder={options.minPrice != null ? `Desde ${options.minPrice}` : 'Desde'}
                className="w-full rounded-xl border border-white/10 bg-[#222] px-4 py-3 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <input
                type="number"
                name="maxPrice"
                value={filters.maxPrice}
                onChange={handleFieldChange}
                disabled={loadingOptions}
                min="0"
                placeholder={options.maxPrice != null ? `Hasta ${options.maxPrice}` : 'Hasta'}
                className="w-full rounded-xl border border-white/10 bg-[#222] px-4 py-3 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <label className="inline-flex items-center gap-2 text-sm text-white/75">
            <input
              type="checkbox"
              name="onSale"
              checked={filters.onSale}
              onChange={handleFieldChange}
              disabled={loadingOptions}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Solo productos en oferta
          </label>
        </div>
      </section>
    );
  }

  return (
    <section className={`${isSheet ? 'space-y-5' : 'rounded-[22px] border border-white/10 bg-[#1a1a1a] p-4 space-y-4'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${isSheet ? 'text-sm font-semibold uppercase tracking-[0.22em] text-white/55' : 'text-lg font-semibold text-white'}`}>
          Filtros
        </h2>
        <div className="flex items-center gap-3">
          {loadingOptions && <span className="text-sm text-white/45">Cargando opciones...</span>}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className={`${isSheet ? 'rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white' : 'text-sm font-medium text-brand hover:text-white'}`}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className={`grid grid-cols-1 ${isSheet ? 'gap-3' : 'gap-4 sm:grid-cols-2 lg:grid-cols-4'}`}>
        <select
          name="brand"
          value={filters.brand}
          onChange={handleFieldChange}
          disabled={loadingOptions}
          className={`w-full border border-white/10 bg-[#222] text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand ${isSheet ? 'rounded-xl px-4 py-3 text-sm' : 'rounded-md py-2 px-3 text-sm'}`}
        >
          <option value="">Todas las marcas</option>
          {options.brands.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name={primaryCatalogFieldName}
          value={filters[primaryCatalogFieldName]}
          onChange={handleFieldChange}
          disabled={loadingOptions}
          className={`w-full border border-white/10 bg-[#222] text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand ${isSheet ? 'rounded-xl px-4 py-3 text-sm' : 'rounded-md py-2 px-3 text-sm'}`}
        >
          <option value="">{primaryCatalogPlaceholder}</option>
          {primaryCatalogOptions.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="gender"
          value={filters.gender}
          onChange={handleFieldChange}
          disabled={loadingOptions}
          className={`w-full border border-white/10 bg-[#222] text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand ${isSheet ? 'rounded-xl px-4 py-3 text-sm' : 'rounded-md py-2 px-3 text-sm'}`}
        >
          <option value="">Todos los generos</option>
          {options.genders.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="collection"
          value={filters.collection}
          onChange={handleFieldChange}
          disabled={loadingOptions}
          className={`w-full border border-white/10 bg-[#222] text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand ${isSheet ? 'rounded-xl px-4 py-3 text-sm' : 'rounded-md py-2 px-3 text-sm'}`}
        >
          <option value="">Todas las colecciones</option>
          {options.collections.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="size"
          value={filters.size}
          onChange={handleFieldChange}
          disabled={loadingOptions}
          className={`w-full border border-white/10 bg-[#222] text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand ${isSheet ? 'rounded-xl px-4 py-3 text-sm' : 'rounded-md py-2 px-3 text-sm'}`}
        >
          <option value="">Todas las tallas</option>
          {options.sizes.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <div className={`flex items-center gap-3 ${isSheet ? 'grid grid-cols-2' : ''}`}>
          <input
            type="number"
            name="minPrice"
            value={filters.minPrice}
            onChange={handleFieldChange}
            disabled={loadingOptions}
            min="0"
            placeholder={
              options.minPrice != null ? `Desde ${options.minPrice}` : 'Precio minimo'
            }
            className={`w-full border border-white/10 bg-[#222] text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand ${isSheet ? 'rounded-xl px-4 py-3 text-sm' : 'rounded-md py-2 px-3 text-sm'}`}
          />
          <input
            type="number"
            name="maxPrice"
            value={filters.maxPrice}
            onChange={handleFieldChange}
            disabled={loadingOptions}
            min="0"
            placeholder={
              options.maxPrice != null ? `Hasta ${options.maxPrice}` : 'Precio maximo'
            }
            className={`w-full border border-white/10 bg-[#222] text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand ${isSheet ? 'rounded-xl px-4 py-3 text-sm' : 'rounded-md py-2 px-3 text-sm'}`}
          />
        </div>
      </div>

      <div className={`flex flex-wrap items-center gap-4 ${isSheet ? 'border-t border-white/10 pt-4' : ''}`}>
        <label className={`inline-flex items-center gap-2 text-white/75 ${isSheet ? 'text-base' : 'text-sm'}`}>
          <input
            type="checkbox"
            name="onSale"
            checked={filters.onSale}
            onChange={handleFieldChange}
            disabled={loadingOptions}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Solo productos en oferta
        </label>
      </div>
    </section>
  );
};

export default ProductFilters;
