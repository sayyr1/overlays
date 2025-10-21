import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from '../../../api/axiosInstance';
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

const ProductFilters = ({ onFilterChange, refreshKey, storeSlug, activeFilters }) => {
  const [filters, setFilters] = useState(() => normalizeFiltersForState(activeFilters));
  const [options, setOptions] = useState({
    brands: [],
    types: [],
    genders: [],
    collections: [],
    sizes: [],
    minPrice: null,
    maxPrice: null
  });
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState(null);

  const syncingRef = useRef(true);

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
      if (areFiltersDifferent(prev, normalized)) {
        syncingRef.current = true;
        return normalized;
      }
      return prev;
    });
  }, [activeFilters]);

  useEffect(() => {
    if (syncingRef.current) {
      syncingRef.current = false;
      return;
    }
    if (!onFilterChange) return;
    onFilterChange(sanitizeFiltersForQuery(filters));
  }, [filters, onFilterChange]);

  const hasActiveFilters = useMemo(() => {
    const payload = sanitizeFiltersForQuery(filters);
    return Object.keys(payload).length > 0;
  }, [filters]);

  const handleFieldChange = event => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;

    setFilters(prev => {
      const candidate = { ...prev, [name]: nextValue };
      return areFiltersDifferent(prev, candidate) ? candidate : prev;
    });
  };

  const handleClearFilters = useCallback(() => {
    setFilters(prev => (areFiltersDifferent(prev, DEFAULT_FILTER_STATE) ? { ...DEFAULT_FILTER_STATE } : prev));
  }, []);

  return (
    <section className="bg-white rounded-lg shadow-md p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-800">Filtros</h2>
        <div className="flex items-center gap-3">
          {loadingOptions && <span className="text-sm text-gray-500">Cargando opciones...</span>}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <select
          name="brand"
          value={filters.brand}
          onChange={handleFieldChange}
          disabled={loadingOptions}
          className="w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todas las marcas</option>
          {options.brands.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          name="type"
          value={filters.type}
          onChange={handleFieldChange}
          disabled={loadingOptions}
          className="w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todos los tipos</option>
          {options.types.map(option => (
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
          className="w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          className="w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          className="w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todas las tallas</option>
          {options.sizes.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-3">
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
            className="w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
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
