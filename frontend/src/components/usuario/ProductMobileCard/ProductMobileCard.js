import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductImage from '../ProductImage';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { usePublicConfig } from '../../../context/PublicConfigContext';
import { trackWhatsAppClick } from '../../../services/crmTracking';
import { getPriceForUser, formatCurrency } from '../../../utils/pricing';
import { buildWhatsAppHref, generateLeadCode } from '../../../utils/whatsappLead';

const ProductMobileCard = ({ product }) => {
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

  const priceForUser = useMemo(
    () => getPriceForUser(product, membershipLevel),
    [product, membershipLevel]
  );

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

  const getWhatsAppHref = leadCode =>
    buildWhatsAppHref({
      phone: settings?.whatsapp || '',
      title: product?.name || '',
      price: formatCurrency(priceForUser || 0),
      url: `${window.location.origin}/product/${product?._id}`,
      leadCode
    });

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
  }, [isModuleEnabled, product, priceForUser, settings]);

  const handlePressStart = () => setIsCardPressed(true);
  const handlePressEnd = () => setIsCardPressed(false);

  const stockBadge = product.onSale
    ? 'Promo'
    : availableSizes.length || Object.keys(product.stockBySize || {}).length
      ? 'Disponible'
      : 'Sin stock';

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/30 bg-white/90 shadow-lg shadow-slate-900/5 ring-1 ring-slate-100 transition-all duration-300 ${
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
      <div className="relative overflow-hidden rounded-[24px] bg-slate-100">
        <ProductImage
          src={product.images?.[0]?.url || ''}
          alt={product.name}
          className="h-56 w-full object-cover transition duration-500 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
        <div className="absolute top-4 right-4 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-lg shadow-slate-900/10">
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
          <div className="absolute bottom-4 left-4 rounded-full bg-white/20 px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            {product.collection}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <header>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{product.gender || 'Unisex'}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900 line-clamp-2">{product.name}</h3>
        </header>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs uppercase text-slate-400">Desde</span>
            <p className="text-2xl font-semibold text-slate-900">{formatCurrency(priceForUser)}</p>
          </div>
          {product.brand && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {product.brand}
            </span>
          )}
        </div>

        {availableColors.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {availableColors.slice(0, 4).map(color => (
              <span key={color} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {color}
              </span>
            ))}
            {availableColors.length > 4 && (
              <span className="text-xs text-slate-500">+{availableColors.length - 4} colores</span>
            )}
          </div>
        )}

        {availableSizes.length > 0 && (
          <div className="flex flex-wrap gap-1 text-xs text-slate-500">
            {availableSizes.slice(0, 6).map(([size]) => (
              <span key={size} className="rounded-full border border-slate-200 px-3 py-1 text-slate-700">
                {size}
              </span>
            ))}
            {availableSizes.length > 6 && (
              <span className="text-xs text-slate-500">+{availableSizes.length - 6}</span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleQuickAdd}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 active:scale-[0.98]"
          >
            Agregar rapido
            <span className="text-base">＋</span>
          </button>
          <a
            href={getWhatsAppHref('')}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWhatsAppClick}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-green-500/50 bg-white px-4 py-3 text-sm font-semibold text-green-600 shadow-sm transition hover:border-green-500 hover:bg-green-50"
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
