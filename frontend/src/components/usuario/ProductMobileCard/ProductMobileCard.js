import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductImage from '../ProductImage';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { usePublicConfig } from '../../../context/PublicConfigContext';
import { trackWhatsAppClick } from '../../../services/crmTracking';
import { getPriceForUser, formatCurrency } from '../../../utils/pricing';
import { buildWhatsAppHref, generateLeadCode } from '../../../utils/whatsappLead';
import { buildNestedVariantsWithFallback, summarizeNestedVariants } from '../../../utils/inventory';
import { HeartIcon } from '@heroicons/react/24/outline';

const ProductMobileCard = ({ product, variant = 'default' }) => {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isAuthenticated, membershipLevel } = useAuth();
  const { settings, isModuleEnabled } = usePublicConfig();

  const [isCardPressed, setIsCardPressed] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const resetTimerRef = useRef(null);

  const availableSizes = useMemo(
    () => Object.entries(product.stockBySize || {}).filter(([, qty]) => qty > 0),
    [product.stockBySize]
  );

  const availableColors = useMemo(
    () => (Array.isArray(product.colors) ? product.colors.filter(Boolean) : []),
    [product.colors]
  );

  const stockSummary = useMemo(
    () => summarizeNestedVariants(
      buildNestedVariantsWithFallback(product.stockByColorSize, product.stockBySize)
    ),
    [product.stockByColorSize, product.stockBySize]
  );

  const priceForUser = useMemo(
    () => getPriceForUser(product, membershipLevel),
    [product, membershipLevel]
  );

  const compareAtPrice = useMemo(() => {
    const candidate = Number(product.compareAtPrice || 0);
    return candidate > priceForUser ? candidate : 0;
  }, [priceForUser, product.compareAtPrice]);

  const clearNavigateFeedback = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearNavigateFeedback();
  }, [clearNavigateFeedback]);

  const handleViewDetails = useCallback(() => {
    if (!product?._id) return;
    setIsNavigating(true);
    navigate(`/product/${product._id}`);
    clearNavigateFeedback();
    resetTimerRef.current = setTimeout(() => {
      setIsNavigating(false);
      resetTimerRef.current = null;
    }, 900);
  }, [clearNavigateFeedback, navigate, product?._id]);

  const handleCardKeyDown = useCallback(
    event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleViewDetails();
      }
    },
    [handleViewDetails]
  );

  const handleQuickAdd = useCallback(async event => {
    event?.stopPropagation();
    if (availableSizes.length !== 1) {
      handleViewDetails();
      return;
    }

    const [size] = availableSizes[0];
    try {
      await addItem({
        productId: product._id,
        size,
        quantity: 1,
        unitPrice: priceForUser,
        title: product.name,
        imageUrl: product.images?.[0]?.url || '',
        color: availableColors.length === 1 ? availableColors[0] : ''
      });

      if (!isAuthenticated) {
        setIsNavigating(true);
        clearNavigateFeedback();
        resetTimerRef.current = setTimeout(() => {
          setIsNavigating(false);
          resetTimerRef.current = null;
        }, 700);
      }
    } catch (error) {
      console.error('Error al agregar al carrito', error);
    }
  }, [addItem, availableColors, availableSizes, clearNavigateFeedback, handleViewDetails, isAuthenticated, priceForUser, product]);

  const getWhatsAppHref = useCallback(leadCode =>
    buildWhatsAppHref({
      phone: settings?.whatsapp || '',
      title: product?.name || '',
      price: formatCurrency(priceForUser || 0),
      url: `${window.location.origin}/product/${product?._id}`,
      leadCode
    }),
  [priceForUser, product?._id, product?.name, settings?.whatsapp]);

  const handleWhatsAppClick = useCallback(async event => {
    event.stopPropagation();
    event.preventDefault();

    const leadCode = generateLeadCode();
    const href = getWhatsAppHref(leadCode);

    if (isModuleEnabled('crm') && product?._id) {
      await trackWhatsAppClick({
        productId: product._id,
        title: product.name,
        href,
        leadCode
      });
    }

    if (typeof window !== 'undefined') {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  }, [getWhatsAppHref, isModuleEnabled, product]);

  const handlePressStart = () => setIsCardPressed(true);
  const handlePressEnd = () => setIsCardPressed(false);

  const stockBadge = product.onSale
    ? 'Oferta'
    : stockSummary.total <= 0
      ? 'Sin stock'
      : stockSummary.total <= 3
        ? 'Ultimas unidades'
        : 'Disponible';

  const quickActionLabel = availableSizes.length === 1
    ? 'Agregar rapido'
    : 'Elegir variantes';

  const isCompact = variant === 'compact';
  const isMarket = variant === 'market';

  if (isMarket) {
    return (
      <article
        className={`group relative flex h-full flex-col rounded-[16px] bg-transparent transition-all duration-300 ${
          isCardPressed ? 'scale-[0.98]' : 'hover:-translate-y-1 active:scale-[0.99]'
        }`}
        tabIndex={0}
        role="button"
        onClick={handleViewDetails}
        onKeyDown={handleCardKeyDown}
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerLeave={handlePressEnd}
        onPointerCancel={handlePressEnd}
        onTouchEnd={handlePressEnd}
      >
        <div className="relative overflow-hidden rounded-[18px] bg-white">
          <ProductImage
            src={product.images?.[0]?.url || ''}
            alt={product.name}
            className="h-[152px] w-full object-contain p-4 transition duration-500 ease-out group-hover:scale-105 sm:h-[164px] lg:h-[172px]"
          />
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
            }}
            className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-black/5"
            aria-label="Guardar producto"
          >
            <HeartIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1 px-1 pt-3 text-left">
          <h3 className="line-clamp-2 min-h-[2.7rem] text-[13px] font-semibold leading-[1.18] text-white sm:text-sm">
            {product.name}
          </h3>
          <p className="text-[11px] font-medium text-white/65">
            {product.brand || 'Seleccion destacada'}
          </p>
          <p className="text-[17px] font-semibold leading-none text-white sm:text-[1.35rem]">
            {formatCurrency(priceForUser)}
          </p>
          <div className="pt-1">
            <span className="inline-flex items-center rounded-md bg-[#2a2a2a] px-2 py-1 text-[10px] font-semibold text-white/90 ring-1 ring-white/10">
              {product.onSale ? 'Oferta' : stockSummary.total <= 0 ? 'Sin stock' : 'Express Ship'}
            </span>
          </div>
        </div>
      </article>
    );
  }

  if (isCompact) {
    return (
      <article
        className={`group relative flex h-full flex-col rounded-[14px] bg-transparent transition-all duration-300 ${
          isCardPressed ? 'scale-[0.98]' : 'hover:-translate-y-1 active:scale-[0.99]'
        }`}
        tabIndex={0}
        role="button"
        onClick={handleViewDetails}
        onKeyDown={handleCardKeyDown}
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerLeave={handlePressEnd}
        onPointerCancel={handlePressEnd}
        onTouchEnd={handlePressEnd}
      >
        <div className="relative overflow-hidden rounded-[14px] bg-white">
          <ProductImage
            src={product.images?.[0]?.url || ''}
            alt={product.name}
            className="h-28 w-full object-contain p-4 transition duration-500 ease-out group-hover:scale-105 sm:h-32"
          />
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
            }}
            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-black/5"
            aria-label="Guardar producto"
          >
            <HeartIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1 px-1 pt-3 text-left">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-[1.15] text-white sm:text-sm">
            {product.name}
          </h3>
          <p className="text-[11px] font-medium text-white/65">Lowest Ask</p>
          <p className="text-[17px] font-semibold leading-none text-white sm:text-[1.35rem]">
            {formatCurrency(priceForUser)}
          </p>
          <div className="pt-1">
            <span className="inline-flex items-center rounded bg-[#2a2a2a] px-2 py-1 text-[10px] font-semibold text-white/90 ring-1 ring-white/10">
              {product.onSale ? 'Oferta' : stockSummary.total <= 0 ? 'Sin stock' : 'Express Ship'}
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-white/30 bg-white/90 shadow-lg shadow-slate-900/5 ring-1 ring-slate-100 transition-all duration-300 ${
        isCardPressed ? 'scale-[0.97]' : 'hover:-translate-y-2 hover:shadow-2xl active:scale-[0.98]'
      }`}
      tabIndex={0}
      role="button"
      onClick={handleViewDetails}
      onKeyDown={handleCardKeyDown}
      onPointerDown={handlePressStart}
      onPointerUp={handlePressEnd}
      onPointerLeave={handlePressEnd}
      onPointerCancel={handlePressEnd}
      onTouchEnd={handlePressEnd}
    >
      <div className="relative overflow-hidden rounded-[16px] bg-slate-100">
        <ProductImage
          src={product.images?.[0]?.url || ''}
          alt={product.name}
          className="h-40 w-full object-cover transition duration-500 ease-out group-hover:scale-105 sm:h-48 lg:h-56"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-lg shadow-slate-900/10 sm:right-4 sm:top-4 sm:gap-2 sm:px-3 sm:text-xs">
          {isNavigating ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-slate-900" />
              Abriendo...
            </>
          ) : (
            <>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              {stockBadge}
            </>
          )}
        </div>
        {product.collection && (
          <div className="absolute bottom-3 left-3 rounded-full bg-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur sm:bottom-4 sm:left-4 sm:px-4 sm:text-[11px]">
            {product.collection}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3.5 sm:p-4 lg:p-5">
        <header>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 sm:text-xs">{product.gender || 'Unisex'}</p>
          <h3 className="mt-1 text-sm font-semibold leading-snug text-slate-900 line-clamp-2 sm:text-base lg:text-lg">{product.name}</h3>
        </header>

        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase text-slate-400 sm:text-xs">Desde</span>
            <p className="text-lg font-semibold text-slate-900 sm:text-xl lg:text-2xl">{formatCurrency(priceForUser)}</p>
            {compareAtPrice > 0 && (
              <p className="text-xs text-slate-400 line-through sm:text-sm">{formatCurrency(compareAtPrice)}</p>
            )}
          </div>
          {product.brand && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 sm:px-3 sm:text-xs">
              {product.brand}
            </span>
          )}
        </div>

        {availableColors.length > 0 && (
          <div className="hidden flex-wrap gap-1.5 sm:flex">
            {availableColors.slice(0, 3).map(color => (
              <span key={color} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {color}
              </span>
            ))}
            {availableColors.length > 3 && (
              <span className="text-xs text-slate-500">+{availableColors.length - 3} colores</span>
            )}
          </div>
        )}

        {availableSizes.length > 0 && (
          <div className="hidden flex-wrap gap-1 text-xs text-slate-500 sm:flex">
            {availableSizes.slice(0, 4).map(([size]) => (
              <span key={size} className="rounded-full border border-slate-200 px-3 py-1 text-slate-700">
                {size}
              </span>
            ))}
            {availableSizes.length > 4 && (
              <span className="text-xs text-slate-500">+{availableSizes.length - 4}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>{stockSummary.total > 0 ? `${stockSummary.total} unidades visibles` : 'Sin disponibilidad'}</span>
          {product.type ? <span>{product.type}</span> : null}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleQuickAdd}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 active:scale-[0.98]"
          >
            {quickActionLabel}
            <span className="text-base">+</span>
          </button>
          <a
            href={getWhatsAppHref('')}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWhatsAppClick}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-500/50 bg-white px-4 py-2.5 text-sm font-semibold text-green-600 shadow-sm transition hover:border-green-500 hover:bg-green-50"
          >
            Pedir por WhatsApp
          </a>
        </div>

        {availableSizes.length === 0 && (
          <p className="text-xs font-medium text-rose-500">Sin stock disponible.</p>
        )}
      </div>
    </article>
  );
};

export default ProductMobileCard;
