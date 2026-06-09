import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiChevronDown, FiSearch, FiSliders, FiX } from 'react-icons/fi';
import axios from '../../api/axiosInstance';
import ProductMobileCard from '../../components/usuario/ProductMobileCard/ProductMobileCard';
import ProductFilters from '../../components/usuario/ProductFilters/ProductFilters';
import {
  buildProductFilterSearch,
  sanitizeFiltersForQuery
} from '../../utils/productFilters';

const SCROLL_STORAGE_KEY = 'niway:product-list-scroll';
const FILTER_STORAGE_KEY = 'niway:last-product-filters';
const SERVER_FILTER_KEYS = new Set([
  'brand',
  'type',
  'gender',
  'size',
  'collection',
  'onSale',
  'minPrice',
  'maxPrice'
]);
const SKELETON_COUNT = 8;
const SORT_OPTIONS = [
  { value: 'featured', label: 'Destacados' },
  { value: 'price-asc', label: 'Precio menor' },
  { value: 'price-desc', label: 'Precio mayor' },
  { value: 'name-asc', label: 'Nombre A-Z' }
];

const ProductSkeletonCard = () => (
  <div className="animate-pulse">
    <div className="h-[152px] rounded-[18px] bg-[#f1f1f1] sm:h-[164px] lg:h-[172px]" />
    <div className="mt-3 h-4 w-4/5 rounded-full bg-white/10" />
    <div className="mt-2 h-3 w-2/5 rounded-full bg-white/10" />
    <div className="mt-2 h-5 w-1/3 rounded-full bg-white/10" />
    <div className="mt-3 h-6 w-24 rounded-md bg-white/10" />
  </div>
);

const ProductSkeletonGrid = ({ count = SKELETON_COUNT }) => (
  <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
    {Array.from({ length: count }).map((_, idx) => (
      <ProductSkeletonCard key={`skeleton-${idx}`} />
    ))}
  </div>
);

const matchesSearch = (product, searchTerm) => {
  if (!searchTerm) return true;
  const haystack = [
    product.name,
    product.brand,
    product.type,
    product.collection,
    product.gender,
    product.code
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(searchTerm.toLowerCase());
};

const ProductListPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const scrollRestoredRef = useRef(false);
  const restoredSearchRef = useRef(null);

  const searchTerm = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get('search') || '').trim();
  }, [location.search]);

  const sortKey = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('sort') || 'featured';
  }, [location.search]);

  const extraFilters = useMemo(() => {
    const raw = new URLSearchParams(location.search);
    const extras = {};
    raw.forEach((value, key) => {
      if (!SERVER_FILTER_KEYS.has(key) && key !== 'search' && key !== 'sort') {
        extras[key] = value;
      }
    });
    return extras;
  }, [location.search]);

  const urlFilters = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const initial = {};
    ['brand', 'type', 'gender', 'size', 'collection'].forEach(key => {
      if (params.has(key)) {
        initial[key] = params.get(key);
      }
    });
    if (params.has('onSale')) {
      initial.onSale = params.get('onSale') === 'true';
    }
    if (params.has('minPrice')) {
      initial.minPrice = params.get('minPrice');
    }
    if (params.has('maxPrice')) {
      initial.maxPrice = params.get('maxPrice');
    }
    return initial;
  }, [location.search]);

  const activeFilters = useMemo(
    () => sanitizeFiltersForQuery(urlFilters),
    [urlFilters]
  );

  const requestFilters = useMemo(
    () => ({ ...activeFilters, ...extraFilters }),
    [activeFilters, extraFilters]
  );

  const visibleProducts = useMemo(() => {
    const filtered = products.filter(product => matchesSearch(product, searchTerm));
    const sorted = [...filtered];

    switch (sortKey) {
      case 'price-asc':
        sorted.sort((a, b) => Number(a?.price?.retail || 0) - Number(b?.price?.retail || 0));
        break;
      case 'price-desc':
        sorted.sort((a, b) => Number(b?.price?.retail || 0) - Number(a?.price?.retail || 0));
        break;
      case 'name-asc':
        sorted.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'es'));
        break;
      case 'featured':
      default:
        break;
    }

    return sorted;
  }, [products, searchTerm, sortKey]);

  const activeFilterCount = useMemo(() => {
    const filterKeys = Object.keys(activeFilters).length;
    return searchTerm ? filterKeys + 1 : filterKeys;
  }, [activeFilters, searchTerm]);

  useEffect(() => {
    setSearchDraft(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    const updateViewport = () => {
      if (typeof window === 'undefined') return;
      setIsMobileViewport(window.innerWidth < 640);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const updateUrl = useCallback((nextFilters, nextSearch = searchTerm, nextSort = sortKey) => {
    const params = new URLSearchParams(buildProductFilterSearch(nextFilters));
    Object.entries(extraFilters).forEach(([key, value]) => {
      if (value != null && value !== '') {
        params.set(key, value);
      }
    });
    const normalizedSearch = String(nextSearch || '').trim();
    if (normalizedSearch) {
      params.set('search', normalizedSearch);
    }
    if (nextSort && nextSort !== 'featured') {
      params.set('sort', nextSort);
    }
    const query = params.toString();
    navigate(query ? `/productos?${query}` : '/productos');
  }, [extraFilters, navigate, searchTerm, sortKey]);

  const fetchProducts = useCallback(async filters => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams(buildProductFilterSearch(filters));
      Object.entries(filters || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '' || value === false) return;
        if (!params.has(key)) {
          params.set(key, String(value));
        }
      });
      const url = params.toString() ? `/api/products/filter?${params.toString()}` : '/api/products';
      const { data } = await axios.get(url);
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando productos:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(requestFilters);
  }, [fetchProducts, requestFilters]);

  useEffect(() => {
    if (!isLoading) {
      setIsRefreshing(false);
      return;
    }
    if (products.length) {
      setIsRefreshing(true);
    }
  }, [isLoading, products.length]);

  useEffect(() => {
    if (typeof window === 'undefined' || scrollRestoredRef.current) return;
    try {
      const stored = window.sessionStorage.getItem(SCROLL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        restoredSearchRef.current = parsed.search || null;
        if (parsed.search === location.search) {
          window.requestAnimationFrame(() => {
            window.scrollTo({ top: parsed.scrollY ?? 0, behavior: 'auto' });
          });
        }
      }
    } catch {
      // ignore storage issues
    } finally {
      scrollRestoredRef.current = true;
    }
  }, [location.search]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let frame = null;
    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        try {
          window.sessionStorage.setItem(
            SCROLL_STORAGE_KEY,
            JSON.stringify({ search: location.search, scrollY: window.scrollY })
          );
        } catch {
          // ignore storage issues
        } finally {
          frame = null;
        }
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [location.search]);

  useEffect(() => {
    if (!scrollRestoredRef.current) return;
    if (restoredSearchRef.current === location.search) {
      restoredSearchRef.current = null;
      return;
    }
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, [location.search]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({ search: location.search, filters: activeFilters, timestamp: Date.now() })
      );
    } catch {
      // ignore storage issues
    }
  }, [activeFilters, location.search]);

  const handleSearchSubmit = event => {
    event.preventDefault();
    updateUrl(activeFilters, searchDraft, sortKey);
  };

  const clearSearch = () => {
    setSearchDraft('');
    updateUrl(activeFilters, '', sortKey);
  };

  const mobileHero = useMemo(() => {
    const titleParts = [activeFilters.brand, activeFilters.type, activeFilters.gender].filter(Boolean);
    const title = titleParts.length > 0
      ? titleParts.join(' - ')
      : activeFilters.collection || 'Coleccion destacada';

    const description = activeFilters.brand
      ? `${activeFilters.brand} concentra una seleccion mas curada para navegar rapido desde movil.`
      : 'Explora productos, filtra rapido y descubre colecciones en un formato mas limpio.';

    const breadcrumb = [
      { label: 'Inicio', to: '/' },
      activeFilters.brand ? { label: 'Marcas', to: '/categorias' } : null,
      activeFilters.brand
        ? { label: activeFilters.brand, to: `/productos?brand=${encodeURIComponent(activeFilters.brand)}` }
        : activeFilters.collection
          ? { label: activeFilters.collection, to: `/productos?collection=${encodeURIComponent(activeFilters.collection)}` }
          : { label: 'Catalogo', to: '/productos' }
    ].filter(Boolean);

    return { title, description, breadcrumb };
  }, [activeFilters.brand, activeFilters.collection, activeFilters.gender, activeFilters.type]);

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="hidden overflow-hidden rounded-[22px] border border-white/10 bg-[#1a1a1a] p-5 sm:block lg:hidden">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 lg:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-md border border-white/10 bg-[#222] px-4 py-3">
              <FiSearch className="text-white/40" />
              <input
                type="search"
                value={searchDraft}
                onChange={event => setSearchDraft(event.target.value)}
                placeholder="Search for brand, color, product"
                className="w-full bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="inline-flex flex-1 items-center justify-center rounded-md bg-brand px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(prev => !prev)}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-[#222] px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 lg:hidden"
              >
                <FiSliders />
                Filtros
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
            </div>
          </form>

          {(activeFilterCount > 0 || Object.keys(extraFilters).length > 0) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {searchTerm ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white"
                >
                  Busqueda: {searchTerm} x
                </button>
              ) : null}
              {Object.entries(activeFilters).map(([key, value]) => (
                <span key={`${key}-${value}`} className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                  {key}: {String(value)}
                </span>
              ))}
              {Object.entries(extraFilters).map(([key, value]) => (
                <span key={`${key}-${value}`} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  {key}: {String(value)}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="sm:hidden space-y-4">
          <div className="rounded-[22px] border border-white/10 bg-[#272723] p-4">
            <h1 className="text-[1.65rem] font-semibold leading-tight text-white">{mobileHero.title}</h1>
            <p className="mt-3 text-sm leading-6 text-white/80">{mobileHero.description}</p>
            <Link
              to="/categorias"
              className="mt-4 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Ver mas
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
            {mobileHero.breadcrumb.map((item, index) => (
              <React.Fragment key={`${item.label}-${index}`}>
                {index > 0 ? <span>/</span> : null}
                <Link to={item.to} className="transition hover:text-white">
                  {item.label}
                </Link>
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-[#2b2b2b] px-4 py-3 text-sm font-semibold text-white"
            >
              Filtro {activeFilterCount > 0 ? activeFilterCount : ''}
              <FiChevronDown className="text-white/70" />
            </button>

            <div className="relative min-w-0 flex-1">
              <select
                value={sortKey}
                onChange={event => updateUrl(activeFilters, searchTerm, event.target.value)}
                className="w-full appearance-none rounded-full border border-white/10 bg-[#2b2b2b] px-4 py-3 pr-10 text-sm font-semibold text-white focus:outline-none"
              >
                {SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    Ordenar: {option.label}
                  </option>
                ))}
              </select>
              <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/70" />
            </div>
          </div>
        </section>

        {showFilters && isMobileViewport && (
          <div className="fixed inset-0 z-[70] sm:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowFilters(false)}
              aria-label="Cerrar filtros"
            />
            <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-[28px] border-t border-white/10 bg-[#141414] shadow-2xl">
              <div className="mx-auto mt-2 h-1.5 w-14 rounded-full bg-white/15" />
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                <span className="w-8" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-white">Filtrar</h2>
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
                >
                  <FiX />
                </button>
              </div>

              <div className="max-h-[calc(88vh-10.5rem)] overflow-y-auto px-4 py-4">
                <div className="mb-4 flex flex-wrap gap-2">
                  {activeFilterCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => updateUrl({}, searchTerm, sortKey)}
                      className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Limpiar todo
                    </button>
                  ) : null}
                  {searchTerm ? (
                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85">
                      Busqueda: {searchTerm}
                    </span>
                  ) : null}
                  {Object.entries(activeFilters).map(([key, value]) => (
                    <span key={`${key}-${value}`} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85">
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>

                <ProductFilters
                  variant="sheet"
                  activeFilters={urlFilters}
                  onFilterChange={nextFilters => updateUrl(nextFilters, searchDraft, sortKey)}
                  refreshKey={location.search}
                />
              </div>

              <div className="border-t border-white/10 bg-[#141414] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="w-full rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white"
                >
                  Ver {visibleProducts.length} resultados
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="hidden lg:flex lg:items-start lg:gap-6 xl:gap-8">
          <aside className="w-[260px] shrink-0 xl:w-[300px]">
            <div className="sticky top-28">
              <ProductFilters
                variant="sidebar"
                activeFilters={urlFilters}
                onFilterChange={nextFilters => updateUrl(nextFilters, searchDraft)}
                refreshKey={location.search}
              />
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-5">
            <section className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  {visibleProducts.length} productos {searchTerm ? 'relevantes para tu busqueda' : 'disponibles'}
                </p>
                <p className="text-sm text-white/45">
                  Grid compacto estilo marketplace.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:justify-end">
                {isRefreshing && (
                  <div
                    className="rounded-full bg-[#222] px-4 py-2 text-center text-sm text-white/70 ring-1 ring-white/10"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="mr-2 inline-flex h-2 w-2 animate-ping rounded-full bg-brand" />
                    Actualizando catalogo...
                  </div>
                )}

                <div className="relative w-full sm:w-[220px]">
                  <select
                    value={sortKey}
                    onChange={event => updateUrl(activeFilters, searchTerm, event.target.value)}
                    className="w-full appearance-none rounded-full border border-white/10 bg-[#2b2b2b] px-4 py-3 pr-10 text-sm font-semibold text-white focus:outline-none"
                  >
                    {SORT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        Ordenar: {option.label}
                      </option>
                    ))}
                  </select>
                  <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/70" />
                </div>
              </div>
            </section>

            {isLoading && products.length === 0 ? (
              <ProductSkeletonGrid />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 xl:grid-cols-4 2xl:grid-cols-5">
                  {visibleProducts.map(product => (
                    <ProductMobileCard key={product._id} product={product} variant="market" />
                  ))}
                </div>
                {!visibleProducts.length && !isLoading && (
                  <div className="rounded-[22px] border border-dashed border-white/10 bg-[#1a1a1a] px-6 py-12 text-center text-white/50" role="status" aria-live="polite">
                    No encontramos productos con esos filtros o esa busqueda.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="lg:hidden">
          <section className="hidden flex-col gap-2 sm:flex sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                {visibleProducts.length} productos {searchTerm ? 'relevantes para tu busqueda' : 'disponibles'}
              </p>
              <p className="text-sm text-white/45">
                Grid compacto estilo marketplace.
              </p>
            </div>
            {isRefreshing && (
              <div
                className="rounded-full bg-[#222] px-4 py-2 text-center text-sm text-white/70 ring-1 ring-white/10"
                role="status"
                aria-live="polite"
              >
                <span className="mr-2 inline-flex h-2 w-2 animate-ping rounded-full bg-brand" />
                Actualizando catalogo...
              </div>
            )}
          </section>

          {isLoading && products.length === 0 ? (
            <ProductSkeletonGrid />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
                {visibleProducts.map(product => (
                  <ProductMobileCard key={product._id} product={product} variant="market" />
                ))}
              </div>
              {!visibleProducts.length && !isLoading && (
                <div className="rounded-[22px] border border-dashed border-white/10 bg-[#1a1a1a] px-6 py-12 text-center text-white/50" role="status" aria-live="polite">
                  No encontramos productos con esos filtros o esa busqueda.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductListPage;
