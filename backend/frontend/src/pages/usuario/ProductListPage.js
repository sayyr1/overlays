import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from '../../api/axiosInstance';
import ProductImage from '../../components/usuario/ProductImage';
import { useAuth } from '../../context/AuthContext';
import { getPriceForUser, formatCurrency } from '../../utils/pricing';
import {
  buildProductFilterSearch,
  sanitizeFiltersForQuery
} from '../../utils/productFilters';

const SCROLL_STORAGE_KEY = 'niway:product-list-scroll';
const FILTER_STORAGE_KEY = 'niway:last-product-filters';
const SKELETON_COUNT = 8;

const ProductSkeletonCard = () => (
  <div className="animate-pulse rounded-[28px] bg-white/60 p-4 shadow-inner shadow-slate-200 ring-1 ring-slate-100">
    <div className="h-52 rounded-2xl bg-slate-200" />
    <div className="mt-4 h-4 w-2/3 rounded-full bg-slate-200" />
    <div className="mt-2 h-4 w-1/2 rounded-full bg-slate-200" />
    <div className="mt-6 h-11 rounded-2xl bg-slate-200" />
  </div>
);

const ProductSkeletonGrid = ({ count = SKELETON_COUNT }) => (
  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {Array.from({ length: count }).map((_, idx) => (
      <ProductSkeletonCard key={`skeleton-${idx}`} />
    ))}
  </div>
);

const ProductListPage = () => {
  const location = useLocation();
  const { membershipLevel } = useAuth();

  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pressedCardId, setPressedCardId] = useState(null);
  const [pendingProductId, setPendingProductId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const scrollRestoredRef = useRef(false);
  const restoredSearchRef = useRef(null);
  const pendingTimerRef = useRef(null);

  const extraFilters = useMemo(() => {
    const raw = new URLSearchParams(location.search);
    const knownKeys = new Set(['brand', 'type', 'gender', 'size', 'collection', 'onSale', 'minPrice', 'maxPrice']);
    const extras = {};
    raw.forEach((value, key) => {
      if (!knownKeys.has(key)) extras[key] = value;
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

  const fetchProducts = useCallback(async filters => {
    setIsLoading(true);
    try {
      const known = new URLSearchParams(buildProductFilterSearch(filters));
      const raw = new URLSearchParams(location.search);
      const knownKeys = new Set(['brand', 'type', 'gender', 'size', 'collection', 'onSale', 'minPrice', 'maxPrice']);
      raw.forEach((value, key) => {
        if (!knownKeys.has(key) && value != null) {
          known.append(key, value);
        }
      });
      const combined = known.toString();
      const url = combined ? `/api/products/filter?${combined}` : '/api/products';
      const { data } = await axios.get(url);
      setProducts(data);
    } catch (error) {
      console.error('Error cargando productos:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [location.search]);

  useEffect(() => {
    fetchProducts(activeFilters);
  }, [fetchProducts, activeFilters]);

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

  useEffect(() => () => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
    }
  }, []);

  const handleCardPressStart = useCallback(productId => {
    setPressedCardId(productId);
  }, []);

  const handleCardPressEnd = useCallback(() => {
    setPressedCardId(null);
  }, []);

  const handleNavigateFeedback = useCallback(productId => {
    setPendingProductId(productId);
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
    }
    pendingTimerRef.current = setTimeout(() => {
      setPendingProductId(prev => (prev === productId ? null : prev));
    }, 1200);
  }, []);

  const renderProductCard = product => {
    const price = formatCurrency(getPriceForUser(product, membershipLevel));
    const isPressed = pressedCardId === product._id;
    const isPending = pendingProductId === product._id;

    return (
      <Link
        key={product._id}
        to={`/product/${product._id}`}
        className={`group relative flex h-full flex-col overflow-hidden rounded-[28px] bg-white/95 shadow-lg shadow-slate-900/5 ring-1 ring-slate-100 transition-all duration-300 ${
          isPressed ? 'scale-[0.97]' : 'hover:-translate-y-2 hover:shadow-2xl active:scale-[0.98]'
        } focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400`}
        onPointerDown={() => handleCardPressStart(product._id)}
        onPointerUp={handleCardPressEnd}
        onPointerLeave={handleCardPressEnd}
        onPointerCancel={handleCardPressEnd}
        onTouchEnd={handleCardPressEnd}
        onClick={() => handleNavigateFeedback(product._id)}
      >
        <div className="relative overflow-hidden rounded-[24px] bg-slate-100">
          <ProductImage
            src={product.images?.[0]?.url}
            alt={product.name}
            className="h-64 w-full object-cover transition duration-500 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/10 to-transparent" />
          <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-white">
            {product.onSale && (
              <span className="rounded-full bg-rose-500/90 px-3 py-1 shadow-sm shadow-rose-900/40">Promo</span>
            )}
            {product.collection && (
              <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">
                {product.collection}
              </span>
            )}
          </div>
          <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-lg shadow-slate-900/10">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            En stock
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <header>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{product.gender || 'Unisex'}</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900 line-clamp-2">{product.name}</h3>
          </header>
          <div className="flex flex-col gap-1 text-slate-500">
            <p className="text-sm font-medium">
              Marca: <span className="text-slate-800">{product.brand || 'Niway'}</span>
            </p>
            {product.type && <p className="text-sm">Tipo: {product.type}</p>}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs uppercase text-slate-400">Desde</span>
              <p className="text-2xl font-semibold text-slate-900">{price}</p>
            </div>
            {product.onSale && (
              <span className="rounded-xl bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-500 shadow-inner shadow-rose-100">
                -{product.discount || 10}%
              </span>
            )}
          </div>
          <div className="group/button inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition group-hover:bg-slate-800">
            {isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Abriendo...
              </>
            ) : (
              <>
                Ver producto
                <span className="transition-transform group-hover/button:translate-x-1">→</span>
              </>
            )}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto space-y-6 p-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Cat�logo</p>
          <h1 className="text-3xl font-semibold text-gray-800 sm:text-4xl">Tienda en l�nea</h1>
          <p className="mt-2 text-sm text-slate-500">
            Experiencia fluida inspirada en apps modernas: desplaza, toca y descubre.
          </p>
        </div>
        {Object.keys(extraFilters).length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {Object.entries(extraFilters).map(([k, v]) => (
              <span key={`${k}-${v}`} className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                {k}: {v}
              </span>
            ))}
          </div>
        )}

        {isRefreshing && (
          <div
            className="mx-auto max-w-md rounded-full bg-white/80 px-4 py-2 text-center text-sm text-slate-600 shadow-lg shadow-slate-900/5 ring-1 ring-slate-100"
            role="status"
            aria-live="polite"
          >
            <span className="mr-2 inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400" />
            Actualizando cat�logo...
          </div>
        )}

        {isLoading && products.length === 0 ? (
          <ProductSkeletonGrid />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map(renderProductCard)}
            </div>
            {!products.length && !isLoading && (
              <p className="text-center text-gray-500" role="status" aria-live="polite">
                No encontramos productos con esos filtros.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProductListPage;

