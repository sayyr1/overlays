import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from '../../../api/axiosInstance';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { getPriceForUser, formatCurrency } from '../../../utils/pricing';
import {
  buildNestedVariantsWithFallback,
  normalizeVariantColor
} from '../../../utils/inventory';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import './style.css';

const MODAL_ZOOM_SCALE = 2.5;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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
      return { color, size: sizeKeys[0] };
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

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [isModalZoomed, setIsModalZoomed] = useState(false);
  const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
  const [isZoomDragging, setIsZoomDragging] = useState(false);
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
  const { isAuthenticated, membershipLevel } = useAuth();

  const resetZoomDragState = useCallback(() => {
    const pointerId = zoomDragRef.current.pointerId;
    if (pointerId != null && zoomImageRef.current?.releasePointerCapture) {
      try {
        zoomImageRef.current.releasePointerCapture(pointerId);
      } catch (error) {
        // Ignorar si el puntero ya no está capturado
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
    axios
      .get(`/api/products/${id}`)
      .then((res) => {
        const productData = res.data;
        setProduct(productData);
        const matrix = buildVariantMatrix(productData);
        const defaults = findFirstVariant(matrix);
        setSelectedColor(defaults.color);
        setSelectedSize(defaults.size);
        setActiveImageIndex(0);
        setModalImageIndex(0);
        setIsModalZoomed(false);
        setZoomOffset({ x: 0, y: 0 });
        setIsZoomDragging(false);
        resetZoomDragState();
      })
      .catch((err) => console.error('Error cargando producto:', err));
  }, [id, resetZoomDragState]);

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

  const priceForUser = useMemo(() => getPriceForUser(product, membershipLevel), [product, membershipLevel]);

  const variantMatrix = useMemo(() => buildVariantMatrix(product), [product]);
  const colorLabelMap = useMemo(() => getColorLabelMap(product), [product]);
  const colorOptions = useMemo(() => Object.keys(variantMatrix), [variantMatrix]);
  const sizesForSelectedColor = useMemo(
    () => Object.entries(variantMatrix[selectedColor] || {}),
    [variantMatrix, selectedColor]
  );
  const availableForSelected = selectedColor && selectedSize
    ? Number(variantMatrix[selectedColor]?.[selectedSize] || 0)
    : 0;
  const maxQuantity = availableForSelected ? Math.min(availableForSelected, 99) : 99;
  const disableAddToCart =
    !selectedColor ||
    !selectedSize ||
    availableForSelected <= 0;

  const handleSelectSize = size => {
    setSelectedSize(size);
    setQuantity(1);
    setFeedback('');
  };

  const handleSelectColor = color => {
    const normalized = normalizeVariantColor(color);
    setSelectedColor(normalized);
    const nextSizes = Object.keys(variantMatrix[normalized] || {});
    setSelectedSize(nextSizes[0] || '');
    setQuantity(1);
    setFeedback('');
  };

  const handleQuantityChange = value => {
    const numeric = parseInt(value, 10) || 1;
    const clamped = Math.min(Math.max(numeric, 1), maxQuantity);
    setQuantity(clamped);
  };

  const handleNavigateLogin = () => {
    navigate('/login?redirect=/');
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      setFeedback('Inicia sesión para agregar productos al carrito.');
      navigate('/login?redirect=/');
      return;
    }

    if (!selectedColor || !selectedSize) {
      setFeedback('Selecciona un color y una talla antes de agregar al carrito.');
      return;
    }

    if (availableForSelected <= 0) {
      setFeedback('No hay stock disponible para la combinacion seleccionada.');
      return;
    }

    try {
      await addItem({
        productId: product._id,
        size: selectedSize,
        quantity,
        unitPrice: priceForUser,
        title: product.name,
        imageUrl: product.images?.[0]?.url || '',
        color: selectedColor
      });
      setFeedback('Producto agregado a tu carrito.');
    } catch (error) {
      console.error('Error al agregar al carrito', error);
      setFeedback('No se pudo agregar el producto al carrito.');
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

  const openModalAt = useCallback((idx) => {
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

  const handleModalTouchMove = useCallback((event) => {
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
  const currentActiveIndex = hasImages
    ? Math.min(activeImageIndex, images.length - 1)
    : 0;
  const activeImage = hasImages ? images[currentActiveIndex] : null;
  const modalActiveImage = hasImages
    ? images[Math.min(modalImageIndex, images.length - 1)]
    : null;

  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowRight') {
        showNextImage();
      } else if (event.key === 'ArrowLeft') {
        showPrevImage();
      } else if (event.key === 'Escape') {
        handleCloseModal();
      } else if (event.key === '+' || event.key === '=') {
        // Allow keyboard toggle with '+' key
        toggleModalZoom();
      } else if (event.key === '-') {
        if (isModalZoomed) {
          toggleModalZoom();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCloseModal, isModalOpen, isModalZoomed, showNextImage, showPrevImage, toggleModalZoom]);
  const handleMainTouchStart = useCallback((event) => {
    if (!hasMultipleImages || event.touches.length !== 1) return;
    const { clientX, clientY } = event.touches[0];
    const state = mainSwipeDetailsRef.current;
    state.startX = clientX;
    state.startY = clientY;
    state.isTracking = true;
    state.swiped = false;
    state.preventClick = false;
  }, [hasMultipleImages]);

  const handleMainTouchMove = useCallback((event) => {
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
    if (!surfaceEl || !imageEl) {
      return { x: 0, y: 0 };
    }
    const surfaceWidth = surfaceEl.clientWidth;
    const surfaceHeight = surfaceEl.clientHeight;
    const imageWidth = imageEl.offsetWidth;
    const imageHeight = imageEl.offsetHeight;
    const maxX = Math.max(0, (imageWidth * MODAL_ZOOM_SCALE - surfaceWidth) / 2);
    const maxY = Math.max(0, (imageHeight * MODAL_ZOOM_SCALE - surfaceHeight) / 2);
    return { x: maxX, y: maxY };
  }, []);

  const { x: zoomOffsetX, y: zoomOffsetY } = zoomOffset;

  const handleZoomPointerDown = useCallback((event) => {
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

  const handleZoomPointerMove = useCallback((event) => {
    if (!isModalZoomed || !zoomDragRef.current.isDragging) return;
    event.preventDefault();
    const deltaX = event.clientX - zoomDragRef.current.startX;
    const deltaY = event.clientY - zoomDragRef.current.startY;
    const bounds = getZoomBounds();
    const nextX = clamp(zoomDragRef.current.startOffsetX + deltaX, -bounds.x, bounds.x);
    const nextY = clamp(zoomDragRef.current.startOffsetY + deltaY, -bounds.y, bounds.y);
    setZoomOffset({ x: nextX, y: nextY });
  }, [getZoomBounds, isModalZoomed]);

  const handleZoomPointerEnd = useCallback((event) => {
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

  if (!product) {
    return <p className="text-center py-8">Cargando producto...</p>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="scroll-px-5 mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg sm:p-6 p-0">
          <div className="flex flex-col lg:flex-row gap-4">
            {hasImages && (
              <div className="order-2 lg:order-1 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto lg:max-h-[500px] pb-2 lg:pb-0 pr-1">
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
                    className={`relative flex-shrink-0 h-20 w-20 rounded-lg border-2 transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                      idx === currentActiveIndex
                        ? 'border-blue-600 shadow-md'
                        : 'border-transparent hover:border-blue-300'
                    }`}
                    aria-label={`Mostrar imagen ${idx + 1}`}
                  >
                    <img
                      src={img.url}
                      alt={img.public_id || `Imagen ${idx + 1}`}
                      className="h-full w-full object-cover rounded-md"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="order-1 lg:order-2 relative flex-1 h-[350px] sm:h-[400px] md:h-[500px] lg:h-[500px] rounded-lg overflow-hidden bg-gray-100 group">
              {activeImage ? (
                <>
                  <img
                    src={activeImage.url}
                    alt={activeImage.public_id || `Imagen ${currentActiveIndex + 1}`}
                    className="w-full h-full object-cover cursor-pointer zoom-image"
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
                    className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow transition-opacity duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    aria-label="Ampliar imagen"
                  >
                    <MagnifyingGlassPlusIcon className="h-5 w-5" />
                  </button>
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                  Sin imagen disponible
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="container">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">{product.name}</h1>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-2xl font-semibold text-gray-900">{formatCurrency(priceForUser)}</span>
            {product.onSale && (
              <span className="px-2 py-1 bg-red-100 text-red-600 text-sm rounded">
                En promoción
              </span>
            )}
          </div>

          {colorOptions.length > 0 && (
            <div className="mb-4">
              <h2 className="text-sm font-medium text-gray-600 mb-2 uppercase">Colores disponibles</h2>
              <div className="flex gap-2 flex-wrap">
                {colorOptions.map(color => (
                  <button
                    type="button"
                    key={color}
                    onClick={() => handleSelectColor(color)}
                    className={`px-3 py-1 border rounded-full text-sm ${
                      selectedColor === color
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {colorLabelMap[color] || color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sizesForSelectedColor.length > 0 ? (
            <div className="mb-4">
              <h2 className="text-sm font-medium text-gray-600 mb-2 uppercase">Tallas</h2>
              <div className="flex gap-2 flex-wrap">
                {sizesForSelectedColor.map(([size, qty]) => (
                  <button
                    key={size}
                    type="button"
                    disabled={qty <= 0}
                    onClick={() => handleSelectSize(size)}
                    className={`px-4 py-2 border rounded transition ${
                      selectedSize === size ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-100'
                    } ${qty <= 0 ? 'opacity 50 cursor-not-allowed' : ''}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              {sizesForSelectedColor.length > 0 && !selectedSize && (
                <p className="mt-2 text-sm text-gray-500">Selecciona una talla para continuar.</p>
              )}
            </div>
          ) : (
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                No hay tallas registradas para el color seleccionado.
              </p>
            </div>
          )}
          {isAuthenticated ? (
            <>
              <div className="mb-4 flex items-center gap-3">
                <label className="text-sm font-medium text-gray-600" htmlFor="quantity-input">
                  Cantidad
                </label>
                <input
                  id="quantity-input"
                  type="number"
                  min="1"
                  max={maxQuantity}
                  value={quantity}
                  onChange={e => handleQuantityChange(e.target.value)}
                  className="w-24 border border-gray-300 rounded-md p-2 text-center"
                />
                {selectedColor && selectedSize && (
                  <span className="text-xs text-gray-500">Disponible: {availableForSelected}</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={disableAddToCart}
                className={`w-full py-3 mb-4 text-center font-semibold rounded-lg transition ${
                  disableAddToCart
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Agregar al carrito
              </button>
            </>
          ) : (
            <div className="mb-6 rounded-lg border border-dashed border-blue-300 bg-blue-50 p-4">
              <p className="text-sm text-blue-800 mb-3">
                Inicia sesión para comprar este producto.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <button
                  type="button"
                  onClick={handleNavigateLogin}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                  aria-label="Inicia sesión para comprar"
                >
                  Inicia sesión para comprar
                </button>
                <Link
                  to="/register?redirect=/"
                  className="text-sm text-blue-700 hover:text-blue-900 font-medium"
                >
                  ¿No tienes cuenta? Regístrate
                </Link>
              </div>
            </div>
          )}
          {feedback && <p className="mb-4 text-sm text-green-600">{feedback}</p>}

          <div className="text-gray-700 space-y-4 mb-4">
            <p>{showFullDescription ? product.description : `${product.description?.slice(0, 150) ?? ''}...`}</p>
            {product.description && product.description.length > 150 && (
              <button
                onClick={() => setShowFullDescription(!showFullDescription)}
                className="text-blue-600 font-medium"
              >
                {showFullDescription ? 'Ver menos' : 'Ver más'}
              </button>
            )}
          </div>

          <div className="text-gray-600 space-y-1">
            <div><strong>Marca:</strong> {product.brand || '—'}</div>
            <div><strong>Género:</strong> {product.gender || '—'}</div>
            <div><strong>Tipo:</strong> {product.type || '—'}</div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm px-4 sm:px-6"
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
                aria-label="Cerrar galería"
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
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
