import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { A11y, FreeMode, Navigation } from 'swiper/modules';
import axios from '../../../api/axiosInstance';
import ProductMobileCard from '../ProductMobileCard/ProductMobileCard';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { usePublicConfig } from '../../../context/PublicConfigContext';
import { trackProductView, trackWhatsAppClick } from '../../../services/crmTracking';
import { getPriceForUser, formatCurrency } from '../../../utils/pricing';
import { ORDER_HOLD_LABEL } from '../../../utils/orderConstants';
import {
  getPrimaryCatalogBrowseMeta,
  getPrimaryCatalogValue
} from '../../../utils/catalogProfile';
import { buildWhatsAppHref, generateLeadCode } from '../../../utils/whatsappLead';
import {
  buildNestedVariantsWithFallback,
  normalizeVariantColor,
  DEFAULT_COLOR_LABEL
} from '../../../utils/inventory';
import {
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  HeartIcon,
  InformationCircleIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ShareIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  TruckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import 'swiper/css';
import 'swiper/css/navigation';
import './style.css';

const MODAL_ZOOM_SCALE = 2.5;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const sumMapValues = source =>
  Object.values(source || {}).reduce((acc, value) => acc + Number(value || 0), 0);

const buildVariantMatrix = product => {
  const nested = buildNestedVariantsWithFallback(
    product?.stockByColorSize,
    product?.stockBySize
  );
  const result = { ...nested };
  (product?.colors || []).forEach(color => {
    const normalized = normalizeVariantColor(color);
    if (!result[normalized]) {
      result[normalized] = {};
    }
  });
  return result;
};

const findFirstVariant = matrix => {
  for (const [color, sizes] of Object.entries(matrix)) {
    const sizeKeys = Object.keys(sizes || {});
    if (sizeKeys.length) {
      return { color: sizes[sizeKeys[0]] > 0 ? color : color, size: sizeKeys[0] };
    }
  }
  const colors = Object.keys(matrix);
  return { color: colors[0] || '', size: '' };
};

const getColorLabelMap = product => {
  const map = {};
  (product?.colors || []).forEach(color => {
    map[normalizeVariantColor(color)] = color;
  });
  return map;
};

const buildMarketFiltersHref = (product, profileKey) => {
  const params = new URLSearchParams();
  const primaryCatalogValue = getPrimaryCatalogValue(product, profileKey);
  if (product?.brand) params.set('brand', product.brand);
  if (primaryCatalogValue) {
    params.set(profileKey === 'footwear' ? 'model' : 'type', primaryCatalogValue);
  }
  if (product?.gender) params.set('gender', product.gender);
  const query = params.toString();
  return query ? `/productos?${query}` : '/productos';
};

const DEFAULT_ACCORDIONS = {
  purchase: false,
  promise: false,
  process: false,
  details: false
};

const AccordionRow = ({ id, title, icon: Icon = null, children, open, onToggle, rightContent = null }) => (
  <div className="border-t border-white/10">
    <button
      type="button"
      onClick={() => onToggle(id)}
      className="flex w-full items-center justify-between gap-3 py-3 text-left"
    >
      <div className="flex items-center gap-3">
        {Icon ? <Icon className="h-4 w-4 flex-shrink-0 text-white/80" /> : null}
        <span className="text-[15px] font-semibold text-white">{title}</span>
      </div>
      <div className="flex items-center gap-2.5">
        {rightContent}
        <ChevronDownIcon className={`h-4 w-4 text-white/55 transition ${open ? 'rotate-180' : ''}`} />
      </div>
    </button>
    {open ? <div className="pb-3 text-[13px] leading-5 text-white/65">{children}</div> : null}
  </div>
);

const SelectorModal = ({ open, title, subtitle = '', onClose, children }) => {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[950] flex items-end justify-center bg-black/55 px-4 py-6 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-[26px] border border-white/10 bg-[#111111] p-4 shadow-2xl shadow-black/40 sm:p-5"
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-white/45">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Cerrar selector"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
};

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [isModalZoomed, setIsModalZoomed] = useState(false);
  const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
  const [isZoomDragging, setIsZoomDragging] = useState(false);
  const [activeSelectorModal, setActiveSelectorModal] = useState(null);
  const [accordionState, setAccordionState] = useState(DEFAULT_ACCORDIONS);

  const modalSwipeDetailsRef = useRef({
    startX: 0,
    startY: 0,
    isTracking: false
  });
  const mainSwipeDetailsRef = useRef({
    startX: 0,
    startY: 0,
    isTracking: false,
    swiped: false,
    preventClick: false
  });
  const modalSurfaceRef = useRef(null);
  const zoomImageRef = useRef(null);
  const zoomDragRef = useRef({
    isDragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0
  });

  const { addItem } = useCart();
  const { membershipLevel } = useAuth();
  const { textMap, isModuleEnabled, settings } = usePublicConfig();
  const primaryBrowseMeta = getPrimaryCatalogBrowseMeta(settings?.catalogProfile);
  const modalRoot = typeof document !== 'undefined' ? document.body : null;

  const resetZoomDragState = useCallback(() => {
    const pointerId = zoomDragRef.current.pointerId;
    if (pointerId != null && zoomImageRef.current?.releasePointerCapture) {
      try {
        zoomImageRef.current.releasePointerCapture(pointerId);
      } catch {
        // noop
      }
    }
    zoomDragRef.current.isDragging = false;
    zoomDragRef.current.pointerId = null;
    zoomDragRef.current.startX = 0;
    zoomDragRef.current.startY = 0;
    zoomDragRef.current.startOffsetX = 0;
    zoomDragRef.current.startOffsetY = 0;
  }, []);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    const load = async () => {
      try {
        const { data: productData } = await axios.get(`/api/products/${id}`);
        if (cancelled) return;
        setProduct(productData);
        const primaryCatalogValue = getPrimaryCatalogValue(productData, settings?.catalogProfile);
        const matrix = buildVariantMatrix(productData);
        const defaults = findFirstVariant(matrix);
        setSelectedColor(defaults.color);
        setSelectedSize(defaults.size);
        setActiveImageIndex(0);
        setModalImageIndex(0);
        setIsModalZoomed(false);
        setZoomOffset({ x: 0, y: 0 });
        setIsZoomDragging(false);
        setActiveSelectorModal(null);
        resetZoomDragState();

        const { data: allProducts } = await axios.get('/api/products');
        if (cancelled) return;
        const related = (Array.isArray(allProducts) ? allProducts : [])
          .filter(item => item._id !== productData._id)
          .filter(item =>
            (productData.brand && item.brand === productData.brand) ||
            (
              primaryCatalogValue &&
              getPrimaryCatalogValue(item, settings?.catalogProfile) === primaryCatalogValue
            ) ||
            (productData.collection && item.collection === productData.collection)
          )
          .slice(0, 8);
        setRelatedProducts(related);
      } catch (error) {
        console.error('Error cargando producto:', error);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, resetZoomDragState, settings?.catalogProfile]);

  useEffect(() => {
    if (!product?._id || !isModuleEnabled('crm')) {
      return;
    }

    trackProductView({
      productId: product._id,
      title: product.name,
      path: typeof window !== 'undefined' ? window.location.pathname : ''
    });
  }, [isModuleEnabled, product]);

  useEffect(() => {
    if (!product?.images?.length) {
      setActiveImageIndex(0);
      setModalImageIndex(0);
      setZoomOffset({ x: 0, y: 0 });
      setIsZoomDragging(false);
      resetZoomDragState();
      return;
    }
    setActiveImageIndex(prev => (prev < product.images.length ? prev : 0));
    setModalImageIndex(prev => (prev < product.images.length ? prev : 0));
    resetZoomDragState();
  }, [product, resetZoomDragState]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const body = document.body;
    if (isModalOpen) {
      body.classList.add('modal-open');
      body.style.overflow = 'hidden';
    } else {
      body.classList.remove('modal-open');
      body.style.overflow = '';
    }
    return () => {
      body.classList.remove('modal-open');
      body.style.overflow = '';
    };
  }, [isModalOpen]);

  const priceForUser = useMemo(() => getPriceForUser(product, membershipLevel), [product, membershipLevel]);
  const compareAtPrice = useMemo(() => {
    const candidate = Number(product?.compareAtPrice || 0);
    return candidate > priceForUser ? candidate : 0;
  }, [priceForUser, product?.compareAtPrice]);

  const variantMatrix = useMemo(() => buildVariantMatrix(product), [product]);
  const colorLabelMap = useMemo(() => getColorLabelMap(product), [product]);
  const colorOptions = useMemo(() => Object.keys(variantMatrix), [variantMatrix]);
  const sizesForSelectedColor = useMemo(
    () => Object.entries(variantMatrix[selectedColor] || {}),
    [selectedColor, variantMatrix]
  );

  const allAvailableSizes = useMemo(
    () => Array.from(new Set(
      Object.values(variantMatrix).flatMap(sizes =>
        Object.entries(sizes || {})
          .filter(([, qty]) => Number(qty) > 0)
          .map(([size]) => size)
      )
    )),
    [variantMatrix]
  );

  const hasAnySizes = useMemo(() => {
    if (Object.keys(product?.stockBySize || {}).length > 0) return true;
    return Object.values(variantMatrix || {}).some(sizes => Object.keys(sizes || {}).length > 0);
  }, [product, variantMatrix]);

  const totalStock = useMemo(() => {
    const stockBySize = sumMapValues(product?.stockBySize);
    if (stockBySize > 0) return stockBySize;
    return Object.values(variantMatrix || {}).reduce(
      (acc, sizes) => acc + sumMapValues(sizes),
      0
    );
  }, [product?.stockBySize, variantMatrix]);

  const totalSold = useMemo(() => {
    const soldBySize = sumMapValues(product?.soldBySize);
    if (soldBySize > 0) return soldBySize;
    return sumMapValues(product?.soldByColorSize);
  }, [product?.soldByColorSize, product?.soldBySize]);

  const totalReserved = useMemo(() => {
    const reservedBySize = sumMapValues(product?.reservedBySize);
    if (reservedBySize > 0) return reservedBySize;
    return sumMapValues(product?.reservedByColorSize);
  }, [product?.reservedByColorSize, product?.reservedBySize]);

  const availableForSelected = useMemo(() => {
    if (!selectedColor) return 0;
    if (!hasAnySizes) {
      return Math.max(totalStock, 1);
    }
    if (!selectedSize) {
      return 0;
    }
    let qty = Number(variantMatrix[selectedColor]?.[selectedSize] || 0);
    if (qty > 0) return qty;
    qty = Number(variantMatrix[DEFAULT_COLOR_LABEL]?.[selectedSize] || 0);
    if (qty > 0) return qty;
    qty = Number(product?.stockBySize?.[selectedSize] || 0);
    return qty;
  }, [hasAnySizes, product, selectedColor, selectedSize, totalStock, variantMatrix]);

  const disableAddToCart = !selectedColor || (hasAnySizes && !selectedSize) || availableForSelected <= 0;
  const sizeOptions = useMemo(() => {
    if (sizesForSelectedColor.length > 0) {
      return sizesForSelectedColor.map(([size, qty]) => ({
        size,
        qty: Number(qty || 0),
        disabled: Number(qty || 0) <= 0
      }));
    }

    return allAvailableSizes.map(size => ({
      size,
      qty: Number(product?.stockBySize?.[size] || 0),
      disabled: false
    }));
  }, [allAvailableSizes, product?.stockBySize, sizesForSelectedColor]);

  const stockLabel = useMemo(() => {
    if (!selectedColor) return 'Selecciona un color';
    if (hasAnySizes && !selectedSize) return 'Selecciona una talla';
    if (availableForSelected <= 0) return 'Sin disponibilidad';
    if (availableForSelected <= 3) return `Solo ${availableForSelected} disponibles`;
    return 'Disponible ahora';
  }, [availableForSelected, hasAnySizes, selectedColor, selectedSize]);

  const primaryCatalogValue = useMemo(
    () => getPrimaryCatalogValue(product, settings?.catalogProfile),
    [product, settings?.catalogProfile]
  );
  const marketFiltersHref = useMemo(
    () => buildMarketFiltersHref(product, settings?.catalogProfile),
    [product, settings?.catalogProfile]
  );
  const marketPulseLabel = useMemo(() => {
    if (totalSold >= 12) return `${totalSold} vendidos recientemente`;
    if (totalReserved >= 3) return `${totalReserved} reservas activas`;
    if (totalStock <= 3) return 'Alta demanda';
    return stockLabel;
  }, [stockLabel, totalReserved, totalSold, totalStock]);

  const lastSaleLabel = useMemo(() => {
    if (!product?.lastSoldAt) return 'Sin venta registrada';
    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: 'short'
    }).format(new Date(product.lastSoldAt));
  }, [product?.lastSoldAt]);

  const handleSelectColor = color => {
    const normalized = normalizeVariantColor(color);
    setSelectedColor(normalized);
    const nextSizes = Object.entries(variantMatrix[normalized] || {})
      .filter(([, qty]) => Number(qty) > 0)
      .map(([size]) => size);
    setSelectedSize(nextSizes[0] || '');
    setActiveSelectorModal(null);
    setQuantity(1);
    setFeedback('');
  };

  const handleSelectSize = size => {
    setSelectedSize(size);
    setActiveSelectorModal(null);
    setQuantity(1);
    setFeedback('');
  };

  const handleAddToCart = async () => {
    if (!selectedColor || (hasAnySizes && !selectedSize)) {
      setFeedback('Selecciona color y talla antes de continuar.');
      return false;
    }

    if (availableForSelected <= 0) {
      setFeedback('No hay stock disponible para la combinacion seleccionada.');
      return false;
    }

    try {
      await addItem({
        productId: product._id,
        size: hasAnySizes ? selectedSize : '',
        quantity,
        unitPrice: priceForUser,
        title: product.name,
        imageUrl: product.images?.[0]?.url || '',
        color: selectedColor
      });
      setFeedback('Producto agregado al carrito.');
      return true;
    } catch (error) {
      console.error('Error al agregar al carrito', error);
      setFeedback('No se pudo agregar el producto al carrito.');
      return false;
    }
  };

  const handleBuyNow = async () => {
    const added = await handleAddToCart();
    if (added) {
      navigate('/cart');
    }
  };

  const getWhatsAppHref = leadCode =>
    buildWhatsAppHref({
      phone: settings?.whatsapp || '',
      title: product?.name || '',
      price: formatCurrency(priceForUser || 0),
      url: typeof window !== 'undefined' ? window.location.href : '',
      leadCode
    });

  const handleWhatsAppClick = async event => {
    event.preventDefault();
    const leadCode = generateLeadCode();
    const href = getWhatsAppHref(leadCode);

    if (product?._id && isModuleEnabled('crm')) {
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
  };

  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const shareData = {
      title: product?.name || 'Producto',
      text: `${product?.name || 'Producto'} por ${formatCurrency(priceForUser || 0)}`,
      url: shareUrl
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData);
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setFeedback('Enlace copiado al portapapeles.');
      }
    } catch (error) {
      console.error('No se pudo compartir el producto', error);
    }
  };

  const showNextImage = useCallback(() => {
    const total = product?.images?.length || 0;
    if (total < 2) return;
    setModalImageIndex(prev => {
      const next = (prev + 1) % total;
      setActiveImageIndex(next);
      return next;
    });
    setIsModalZoomed(false);
    setZoomOffset({ x: 0, y: 0 });
    setIsZoomDragging(false);
    resetZoomDragState();
  }, [product, resetZoomDragState]);

  const showPrevImage = useCallback(() => {
    const total = product?.images?.length || 0;
    if (total < 2) return;
    setModalImageIndex(prev => {
      const next = (prev - 1 + total) % total;
      setActiveImageIndex(next);
      return next;
    });
    setIsModalZoomed(false);
    setZoomOffset({ x: 0, y: 0 });
    setIsZoomDragging(false);
    resetZoomDragState();
  }, [product, resetZoomDragState]);

  const openModalAt = useCallback(idx => {
    if (!product?.images?.length) return;
    const clampedIndex = Math.max(0, Math.min(idx, product.images.length - 1));
    setIsModalZoomed(false);
    setZoomOffset({ x: 0, y: 0 });
    setIsZoomDragging(false);
    resetZoomDragState();
    setActiveImageIndex(clampedIndex);
    setModalImageIndex(clampedIndex);
    setIsModalOpen(true);
  }, [product, resetZoomDragState]);

  const handleCloseModal = useCallback(() => {
    setIsModalZoomed(false);
    setIsModalOpen(false);
    modalSwipeDetailsRef.current = { startX: 0, startY: 0, isTracking: false };
    setZoomOffset({ x: 0, y: 0 });
    setIsZoomDragging(false);
    resetZoomDragState();
  }, [resetZoomDragState]);

  const toggleModalZoom = useCallback(() => {
    setZoomOffset({ x: 0, y: 0 });
    setIsZoomDragging(false);
    resetZoomDragState();
    setIsModalZoomed(prev => !prev);
  }, [resetZoomDragState]);

  const handleModalTouchStart = useCallback(event => {
    if (isModalZoomed || event.touches.length !== 1) return;
    const { clientX, clientY } = event.touches[0];
    modalSwipeDetailsRef.current = {
      startX: clientX,
      startY: clientY,
      isTracking: true
    };
  }, [isModalZoomed]);

  const handleModalTouchMove = useCallback(event => {
    if (isModalZoomed || !modalSwipeDetailsRef.current.isTracking || event.touches.length !== 1) return;
    const { clientX, clientY } = event.touches[0];
    const deltaX = clientX - modalSwipeDetailsRef.current.startX;
    const deltaY = clientY - modalSwipeDetailsRef.current.startY;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
      if (deltaX > 0) {
        showPrevImage();
      } else {
        showNextImage();
      }
      modalSwipeDetailsRef.current.isTracking = false;
    }
  }, [isModalZoomed, showNextImage, showPrevImage]);

  const handleModalTouchEnd = useCallback(() => {
    modalSwipeDetailsRef.current = { startX: 0, startY: 0, isTracking: false };
  }, []);

  const images = Array.isArray(product?.images) ? product.images : [];
  const hasImages = images.length > 0;
  const hasMultipleImages = images.length > 1;
  const currentActiveIndex = hasImages ? Math.min(activeImageIndex, images.length - 1) : 0;
  const activeImage = hasImages ? images[currentActiveIndex] : null;
  const modalActiveImage = hasImages ? images[Math.min(modalImageIndex, images.length - 1)] : null;

  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = event => {
      if (event.key === 'ArrowRight') {
        showNextImage();
      } else if (event.key === 'ArrowLeft') {
        showPrevImage();
      } else if (event.key === 'Escape') {
        handleCloseModal();
      } else if (event.key === '+' || event.key === '=') {
        toggleModalZoom();
      } else if (event.key === '-' && isModalZoomed) {
        toggleModalZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCloseModal, isModalOpen, isModalZoomed, showNextImage, showPrevImage, toggleModalZoom]);

  const handleMainTouchStart = useCallback(event => {
    if (!hasMultipleImages || event.touches.length !== 1) return;
    const { clientX, clientY } = event.touches[0];
    const state = mainSwipeDetailsRef.current;
    state.startX = clientX;
    state.startY = clientY;
    state.isTracking = true;
    state.swiped = false;
    state.preventClick = false;
  }, [hasMultipleImages]);

  const handleMainTouchMove = useCallback(event => {
    if (!hasMultipleImages || event.touches.length !== 1) return;
    const state = mainSwipeDetailsRef.current;
    if (!state.isTracking) return;
    const { clientX, clientY } = event.touches[0];
    const deltaX = clientX - state.startX;
    const deltaY = clientY - state.startY;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 35) {
      event.preventDefault();
      if (deltaX > 0) {
        showPrevImage();
      } else {
        showNextImage();
      }
      state.isTracking = false;
      state.swiped = true;
      state.preventClick = true;
    }
  }, [hasMultipleImages, showNextImage, showPrevImage]);

  const handleMainTouchEnd = useCallback(() => {
    const state = mainSwipeDetailsRef.current;
    state.isTracking = false;
    state.startX = 0;
    state.startY = 0;
    if (state.preventClick) {
      setTimeout(() => {
        mainSwipeDetailsRef.current.preventClick = false;
      }, 0);
    }
  }, []);

  const handleMainImageClick = () => {
    if (mainSwipeDetailsRef.current.preventClick) {
      mainSwipeDetailsRef.current.preventClick = false;
      return;
    }
    openModalAt(currentActiveIndex);
  };

  const handleMainImageKeyDown = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openModalAt(currentActiveIndex);
    }
  };

  const getZoomBounds = useCallback(() => {
    const surfaceEl = modalSurfaceRef.current;
    const imageEl = zoomImageRef.current;
    if (!surfaceEl || !imageEl) return { x: 0, y: 0 };
    const surfaceWidth = surfaceEl.clientWidth;
    const surfaceHeight = surfaceEl.clientHeight;
    const imageWidth = imageEl.offsetWidth;
    const imageHeight = imageEl.offsetHeight;
    const maxX = Math.max(0, (imageWidth * MODAL_ZOOM_SCALE - surfaceWidth) / 2);
    const maxY = Math.max(0, (imageHeight * MODAL_ZOOM_SCALE - surfaceHeight) / 2);
    return { x: maxX, y: maxY };
  }, []);

  const { x: zoomOffsetX, y: zoomOffsetY } = zoomOffset;

  const handleZoomPointerDown = useCallback(event => {
    if (!isModalZoomed) return;
    event.preventDefault();
    const target = event.currentTarget;
    zoomDragRef.current = {
      isDragging: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: zoomOffsetX,
      startOffsetY: zoomOffsetY
    };
    setIsZoomDragging(true);
    if (target && target.setPointerCapture) {
      target.setPointerCapture(event.pointerId);
    }
  }, [isModalZoomed, zoomOffsetX, zoomOffsetY]);

  const handleZoomPointerMove = useCallback(event => {
    if (!isModalZoomed || !zoomDragRef.current.isDragging) return;
    event.preventDefault();
    const deltaX = event.clientX - zoomDragRef.current.startX;
    const deltaY = event.clientY - zoomDragRef.current.startY;
    const bounds = getZoomBounds();
    const nextX = clamp(zoomDragRef.current.startOffsetX + deltaX, -bounds.x, bounds.x);
    const nextY = clamp(zoomDragRef.current.startOffsetY + deltaY, -bounds.y, bounds.y);
    setZoomOffset({ x: nextX, y: nextY });
  }, [getZoomBounds, isModalZoomed]);

  const handleZoomPointerEnd = useCallback(event => {
    if (!zoomDragRef.current.isDragging) return;
    setIsZoomDragging(false);
    if (event?.currentTarget && event.pointerId != null && event.currentTarget.releasePointerCapture) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resetZoomDragState();
  }, [resetZoomDragState]);

  const zoomTransform = useMemo(() => {
    if (!isModalZoomed) {
      return 'translate3d(0px, 0px, 0) scale(1)';
    }
    return `translate3d(${zoomOffsetX}px, ${zoomOffsetY}px, 0) scale(${MODAL_ZOOM_SCALE})`;
  }, [isModalZoomed, zoomOffsetX, zoomOffsetY]);

  const zoomImageClassName = [
    'zoom-target',
    isModalZoomed ? 'is-zoomed' : '',
    isZoomDragging ? 'is-dragging' : ''
  ].filter(Boolean).join(' ');

  const breadcrumbItems = [
    { label: 'Home', to: '/' },
    primaryCatalogValue
      ? { label: primaryCatalogValue, to: `/categoria/${encodeURIComponent(primaryCatalogValue)}` }
      : null,
    product?.gender ? { label: product.gender, to: `/productos?gender=${encodeURIComponent(product.gender)}` } : null,
    product?.brand ? { label: product.brand, to: `/productos?brand=${encodeURIComponent(product.brand)}` } : null
  ].filter(Boolean);

  const toggleAccordion = id => {
    setAccordionState(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedColorLabel = colorLabelMap[selectedColor] || selectedColor;
  const imageProgress = hasMultipleImages && hasImages
    ? `${(currentActiveIndex / Math.max(images.length - 1, 1)) * 100}%`
    : '0%';

  if (!product) {
    return <p className="py-12 text-center text-white/60">Cargando producto...</p>;
  }

  return (
    <div className="mx-auto max-w-[1120px] space-y-8 xl:max-w-[1040px]">
      <div className="flex flex-wrap items-center gap-2 text-sm text-white/55">
        {breadcrumbItems.map((item, index) => (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 ? <span>/</span> : null}
            <Link to={item.to} className="transition hover:text-white">{item.label}</Link>
          </React.Fragment>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.78fr] xl:items-start">
        <section className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-[#171717] p-3 sm:p-4">
            <div className="relative overflow-hidden rounded-[22px] bg-white">
              {activeImage ? (
                <>
                  <img
                    src={activeImage.url}
                    alt={activeImage.public_id || `Imagen ${currentActiveIndex + 1}`}
                    className="h-[290px] w-full cursor-pointer object-contain sm:h-[390px] lg:h-[430px]"
                    onClick={handleMainImageClick}
                    onTouchStart={handleMainTouchStart}
                    onTouchMove={handleMainTouchMove}
                    onTouchEnd={handleMainTouchEnd}
                    onKeyDown={handleMainImageKeyDown}
                    role="button"
                    tabIndex={0}
                  />
                  <button
                    type="button"
                    onClick={() => openModalAt(currentActiveIndex)}
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
                    aria-label="Ampliar imagen"
                  >
                    <MagnifyingGlassPlusIcon className="h-4 w-4" />
                  </button>
                  {hasMultipleImages ? (
                    <>
                      <button
                        type="button"
                        onClick={showPrevImage}
                        className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/80 text-white transition hover:bg-black sm:inline-flex"
                        aria-label="Imagen anterior"
                      >
                        <ChevronLeftIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={showNextImage}
                        className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/80 text-white transition hover:bg-black sm:inline-flex"
                        aria-label="Imagen siguiente"
                      >
                        <ChevronRightIcon className="h-4 w-4" />
                      </button>
                    </>
                  ) : null}
                </>
              ) : (
                <div className="flex h-[360px] items-center justify-center text-sm text-slate-500">
                  Sin imagen disponible
                </div>
              )}
            </div>

            {hasMultipleImages ? (
              <div className="mt-5 flex justify-center">
                <div className="relative h-1 w-36 rounded-full bg-black/10">
                  <span
                    className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-black shadow-[0_6px_18px_rgba(0,0,0,0.18)]"
                    style={{ left: imageProgress, transform: 'translate(-50%, -50%)' }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {hasImages && (
            <div className="flex items-center justify-center gap-3 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  type="button"
                  key={img.public_id || idx}
                  onClick={() => {
                    setActiveImageIndex(idx);
                    setModalImageIndex(idx);
                    setIsModalZoomed(false);
                    setZoomOffset({ x: 0, y: 0 });
                    setIsZoomDragging(false);
                    resetZoomDragState();
                  }}
                  className={`relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full transition ${
                    idx === currentActiveIndex ? 'ring-2 ring-white' : 'opacity-60 hover:opacity-100'
                  }`}
                  aria-label={`Mostrar imagen ${idx + 1}`}
                >
                  <img
                    src={img.url}
                    alt={img.public_id || `Imagen ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-[1.85rem] font-semibold leading-tight text-white lg:text-[2.15rem]">{product.name}</h1>
              <p className="text-lg text-white/85">{selectedColorLabel || product.collection || product.brand || 'Seleccion destacada'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10">
                <HeartIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
              >
                <ShareIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-white/75">
            <TruckIcon className="h-5 w-5" />
            <span>{marketPulseLabel}</span>
          </div>

          <div className="space-y-4 rounded-[22px] border border-white/10 bg-[#181818] p-4">
            {colorOptions.length > 0 && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setActiveSelectorModal(prev => (prev === 'color' ? null : 'color'))}
                  className="flex w-full items-center justify-between rounded-xl border border-white/20 bg-transparent px-4 py-3 text-left text-white transition hover:border-white/35"
                >
                  <span className="text-sm font-semibold">Color</span>
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {selectedColorLabel || 'Seleccionar'}
                    <ChevronDownIcon className={`h-4 w-4 text-white/70 transition ${activeSelectorModal === 'color' ? 'rotate-180' : ''}`} />
                  </span>
                </button>
              </div>
            )}

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (!hasAnySizes) return;
                  setActiveSelectorModal(prev => (prev === 'size' ? null : 'size'));
                }}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                  hasAnySizes
                    ? 'border-white/20 bg-transparent text-white hover:border-white/35'
                    : 'border-white/10 bg-white/[0.03] text-white/55'
                }`}
                disabled={!hasAnySizes}
              >
                <span className="text-sm font-semibold">{hasAnySizes ? 'Talla' : 'Formato'}</span>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {hasAnySizes ? (selectedSize || 'Seleccionar') : 'Unico'}
                  {hasAnySizes ? (
                    <ChevronDownIcon className={`h-4 w-4 text-white/70 transition ${activeSelectorModal === 'size' ? 'rotate-180' : ''}`} />
                  ) : null}
                </span>
              </button>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-[#121212] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-white/55">Comprar ahora por</p>
                  <p className="mt-1 text-[2rem] font-semibold leading-none text-white">{formatCurrency(priceForUser)}</p>
                  {compareAtPrice > 0 && (
                    <p className="mt-1 text-sm text-white/35 line-through">{formatCurrency(compareAtPrice)}</p>
                  )}
                </div>
                <div className="max-w-[180px] text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand">Demanda</p>
                  <p className="mt-1 text-sm font-semibold text-white">{marketPulseLabel}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={disableAddToCart}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                    disableAddToCart
                      ? 'cursor-not-allowed bg-white/10 text-white/35'
                      : 'border border-white/25 bg-transparent text-white hover:bg-white/8'
                  }`}
                >
                  {textMap.product_primary_button || 'Agregar al carrito'}
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={disableAddToCart}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                    disableAddToCart
                      ? 'cursor-not-allowed bg-white/10 text-white/35'
                      : 'bg-[#a8cfa9] text-slate-950 hover:brightness-105'
                  }`}
                >
                  Comprar ahora
                </button>
              </div>

              <a
                href={getWhatsAppHref('')}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleWhatsAppClick}
                className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-[#a8cfa9]/40 bg-[#a8cfa9]/10 px-5 py-2.5 text-sm font-semibold text-[#b8ddb7] transition hover:bg-[#a8cfa9]/20 hover:text-white"
              >
                Comprar por WhatsApp
              </a>

              <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/40">Ultima venta</p>
                  <div className="mt-1 flex items-center gap-2.5">
                    <p className="text-base font-semibold text-white">{formatCurrency(priceForUser)}</p>
                    <span className="text-white/45">{lastSaleLabel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    to={marketFiltersHref}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition hover:text-white"
                  >
                    Ver mercado
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {feedback ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-200">
                {feedback}
              </div>
            ) : null}

            <div className="border-b border-white/10">
              <AccordionRow
                id="purchase"
                title="Compra segura"
                icon={ShoppingBagIcon}
                open={accordionState.purchase}
                onToggle={toggleAccordion}
              >
                <div className="space-y-2">
                  <p>Compra sin crear cuenta. Completa tus datos y reservamos el stock durante {ORDER_HOLD_LABEL}.</p>
                  <p>Si prefieres atencion manual, puedes continuar la conversacion por WhatsApp con el producto ya identificado.</p>
                </div>
              </AccordionRow>
              <AccordionRow
                id="promise"
                title="Acompanamiento comercial"
                icon={ShieldCheckIcon}
                open={accordionState.promise}
                onToggle={toggleAccordion}
              >
                <div className="space-y-2">
                  <p>Te mostramos disponibilidad real segun variantes y te acompanamos hasta la confirmacion del pedido.</p>
                  <p>La experiencia esta pensada para cerrar rapido, no para obligarte a navegar pasos innecesarios.</p>
                </div>
              </AccordionRow>
              <AccordionRow
                id="process"
                title="Nuestro proceso"
                icon={Cog6ToothIcon}
                open={accordionState.process}
                onToggle={toggleAccordion}
                rightContent={<span className="text-[13px] text-brand">Condicion: Nuevo</span>}
              >
                <div className="space-y-2">
                  <p>Seleccionas variante, reservas stock y finalizas por carrito o WhatsApp segun tu preferencia.</p>
                  <p>El equipo valida el pedido y actualiza su estado para seguimiento posterior.</p>
                </div>
              </AccordionRow>
              <AccordionRow
                id="details"
                title="Detalles del producto"
                icon={InformationCircleIcon}
                open={accordionState.details}
                onToggle={toggleAccordion}
              >
                <div className="space-y-3">
                  {product.description ? (
                    <p>{product.description}</p>
                  ) : (
                    <p>Sin descripcion extensa registrada.</p>
                  )}
                  <div className="grid gap-2 text-[13px] sm:grid-cols-2">
                    <div><span className="text-white/45">Marca:</span> <span className="text-white">{product.brand || '—'}</span></div>
                    <div><span className="text-white/45">Genero:</span> <span className="text-white">{product.gender || '—'}</span></div>
                    <div><span className="text-white/45">{primaryBrowseMeta.filterLabel}:</span> <span className="text-white">{primaryCatalogValue || '—'}</span></div>
                    <div><span className="text-white/45">Coleccion:</span> <span className="text-white">{product.collection || '—'}</span></div>
                  </div>
                </div>
              </AccordionRow>
            </div>
          </div>
        </section>
      </div>

      {relatedProducts.length > 0 && (
        <section className="border-t border-white/10 pt-7">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-white">Productos relacionados</h2>
            <Link to="/productos" className="text-xs font-semibold uppercase tracking-wide text-brand transition hover:text-white">
              Ver todo
            </Link>
          </div>

          <Swiper
            modules={[Navigation, FreeMode, A11y]}
            navigation
            grabCursor
            freeMode={{ enabled: true, momentumRatio: 0.35 }}
            spaceBetween={12}
            slidesPerView={1.2}
            breakpoints={{
              480: { slidesPerView: 1.5, spaceBetween: 12 },
              640: { slidesPerView: 2.2, spaceBetween: 12 },
              768: { slidesPerView: 3.1, spaceBetween: 14 },
              1024: { slidesPerView: 4.4, spaceBetween: 14 },
              1280: { slidesPerView: 5.1, spaceBetween: 14 }
            }}
            className="market-swiper !pb-10"
          >
            {relatedProducts.map(item => (
              <SwiperSlide key={item._id}>
                <div className="market-swiper-card px-0.5 sm:px-1">
                  <ProductMobileCard product={item} variant="compact" />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </section>
      )}

      <SelectorModal
        open={activeSelectorModal === 'color'}
        title="Selecciona un color"
        subtitle={`${colorOptions.length} opciones disponibles`}
        onClose={() => setActiveSelectorModal(null)}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {colorOptions.map(color => (
            <button
              type="button"
              key={color}
              onClick={() => handleSelectColor(color)}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                selectedColor === color
                  ? 'border-[#a8cfa9] bg-[#a8cfa9]/10 text-white'
                  : 'border-white/15 bg-transparent text-white hover:border-white/35'
              }`}
            >
              <span className="block text-sm font-semibold">{colorLabelMap[color] || color}</span>
              <span className="mt-0.5 block text-xs text-white/55">
                {Object.values(variantMatrix[color] || {}).reduce((acc, qty) => acc + Number(qty || 0), 0) > 0
                  ? 'Disponible'
                  : 'Sin stock'}
              </span>
            </button>
          ))}
        </div>
      </SelectorModal>

      <SelectorModal
        open={activeSelectorModal === 'size'}
        title="Selecciona tu talla"
        subtitle={selectedColorLabel || 'General'}
        onClose={() => setActiveSelectorModal(null)}
      >
        {sizeOptions.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {sizeOptions.map(({ size, qty, disabled }) => (
              <button
                key={size}
                type="button"
                disabled={disabled}
                onClick={() => handleSelectSize(size)}
                className={`rounded-xl border px-3 py-3 text-center transition ${
                  selectedSize === size
                    ? 'border-[#a8cfa9] bg-[#a8cfa9]/10 text-white'
                    : 'border-white/15 bg-transparent text-white hover:border-white/35'
                } ${disabled ? 'cursor-not-allowed opacity-35' : ''}`}
              >
                <span className="block text-sm font-semibold">{size}</span>
                <span className="mt-0.5 block text-xs text-white/55">
                  {disabled ? 'Sin stock' : qty > 0 ? `${qty} disponibles` : 'Disponible'}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/45">No hay tallas registradas para este producto.</p>
        )}
      </SelectorModal>

      {isModalOpen && modalRoot
        ? createPortal(
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm px-4 sm:px-6"
            onClick={handleCloseModal}
          >
            <div
              className="relative flex w-full max-w-5xl flex-col items-center"
              onClick={event => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div
                ref={modalSurfaceRef}
                className={`modal-zoom-surface ${isModalZoomed ? 'modal-zoomed' : ''}`}
                onTouchStart={handleModalTouchStart}
                onTouchMove={handleModalTouchMove}
                onTouchEnd={handleModalTouchEnd}
                style={{ touchAction: isModalZoomed ? 'none' : 'pan-y' }}
              >
                {modalActiveImage ? (
                  <img
                    ref={zoomImageRef}
                    src={modalActiveImage.url}
                    alt={modalActiveImage.public_id || `Imagen ${modalImageIndex + 1}`}
                    className={zoomImageClassName}
                    draggable={false}
                    style={{
                      transform: zoomTransform,
                      transition: isZoomDragging ? 'none' : 'transform 300ms ease',
                      touchAction: isModalZoomed ? 'none' : 'pan-y'
                    }}
                    onPointerDown={handleZoomPointerDown}
                    onPointerMove={handleZoomPointerMove}
                    onPointerUp={handleZoomPointerEnd}
                    onPointerLeave={handleZoomPointerEnd}
                    onPointerCancel={handleZoomPointerEnd}
                    onDoubleClick={toggleModalZoom}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
                    Sin imagen disponible
                  </div>
                )}
              </div>

              <div className="modal-controls">
                <button
                  type="button"
                  onClick={showPrevImage}
                  className="modal-nav-button"
                  aria-label="Imagen anterior"
                  disabled={!hasMultipleImages}
                >
                  <ChevronLeftIcon className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="modal-nav-button"
                  aria-label="Cerrar galeria"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  className="modal-nav-button"
                  aria-label="Imagen siguiente"
                  disabled={!hasMultipleImages}
                >
                  <ChevronRightIcon className="h-6 w-6" />
                </button>
              </div>

              <button
                type="button"
                onClick={toggleModalZoom}
                className="modal-zoom-toggle"
                aria-label={isModalZoomed ? 'Reducir zoom' : 'Ampliar zoom'}
              >
                {isModalZoomed ? (
                  <MagnifyingGlassMinusIcon className="h-5 w-5" />
                ) : (
                  <MagnifyingGlassPlusIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>,
          modalRoot
        )
        : null}
    </div>
  );
};

export default ProductDetail;
