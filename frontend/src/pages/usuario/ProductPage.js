import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../../api/axiosInstance';
import ProductImage from '../../components/usuario/ProductImage';
import { usePublicConfig } from '../../context/PublicConfigContext';
import { useAuth } from '../../context/AuthContext';
import {
  buildNestedVariantsWithFallback,
  normalizeVariantColor
} from '../../utils/inventory';

const LOW_STOCK_THRESHOLD = 5;

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

const formatCurrency = amount =>
  new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(amount || 0));

const buildInventorySummary = product => {
  const matrix = buildVariantMatrix(product);
  const colorLabelMap = getColorLabelMap(product);
  const variantEntries = [];
  let totalUnits = 0;
  let colorsWithStock = 0;

  Object.entries(matrix).forEach(([color, sizes]) => {
    const sizeEntries = Object.entries(sizes || {});
    let totalByColor = 0;

    sizeEntries.forEach(([size, qty]) => {
      const numericQty = Number(qty || 0);
      totalUnits += numericQty;
      totalByColor += numericQty;
      variantEntries.push({
        key: `${color}-${size}`,
        color,
        colorLabel: colorLabelMap[color] || color,
        size,
        qty: numericQty
      });
    });

    if (totalByColor > 0) {
      colorsWithStock += 1;
    }
  });

  const activeVariants = variantEntries.filter(variant => variant.qty > 0);
  const lowStockVariants = activeVariants.filter(variant => variant.qty <= LOW_STOCK_THRESHOLD);
  const previewVariants = [...variantEntries]
    .sort((left, right) => left.qty - right.qty || left.colorLabel.localeCompare(right.colorLabel))
    .slice(0, 6);

  return {
    totalUnits,
    variantEntries,
    activeVariants,
    lowStockVariants,
    previewVariants,
    colorCount: Object.keys(matrix).length,
    colorsWithStock
  };
};

const getInventoryHealthMeta = inventory => {
  if (!inventory.totalUnits) {
    return {
      label: 'Sin stock',
      className: 'border border-red-200 bg-red-50 text-red-700'
    };
  }

  if (
    inventory.totalUnits <= LOW_STOCK_THRESHOLD ||
    inventory.lowStockVariants.length > 0
  ) {
    return {
      label: 'Stock bajo',
      className: 'border border-amber-200 bg-amber-50 text-amber-700'
    };
  }

  return {
    label: 'Estable',
    className: 'border border-emerald-200 bg-emerald-50 text-emerald-700'
  };
};

const getVariantPillClassName = qty => {
  if (qty === 0) {
    return 'border border-red-200 bg-red-50 text-red-700';
  }
  if (qty <= LOW_STOCK_THRESHOLD) {
    return 'border border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border border-surface-200 bg-surface-50 text-slate-700';
};

const STOCK_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'low', label: 'Stock bajo' },
  { value: 'out', label: 'Sin stock' },
  { value: 'healthy', label: 'Estables' }
];

const SORT_OPTIONS = [
  { value: 'risk', label: 'Priorizar riesgo' },
  { value: 'stock-asc', label: 'Menor stock' },
  { value: 'stock-desc', label: 'Mayor stock' },
  { value: 'name', label: 'Nombre A-Z' },
  { value: 'price-desc', label: 'Precio mayor' }
];

const ProductPage = () => {
  const { isModuleEnabled, loading: modulesLoading } = usePublicConfig();
  const { hasPermission } = useAuth();
  const [products, setProducts] = useState([]);
  const [modalData, setModalData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortBy, setSortBy] = useState('risk');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const inventoryEnabled = isModuleEnabled('inventory');
  const canEditProducts = hasPermission('products.edit');
  const canDeleteProducts = hasPermission('products.delete');
  const canAdjustInventory = hasPermission('inventory.adjust');
  const canViewInventory = hasPermission('inventory.view') || canAdjustInventory;
  const inventoryVisible = inventoryEnabled && canViewInventory;

  const fetchProducts = async () => {
    setIsRefreshing(true);
    try {
      const res = await axios.get('/api/products');
      setProducts(res.data);
    } catch (err) {
      console.error('Error al cargar productos', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('Seguro que deseas eliminar este producto y sus imagenes?')) return;
    try {
      await axios.delete(`/api/products/${id}`, { withCredentials: true });
      alert('Producto e imagenes eliminados correctamente');
      fetchProducts();
    } catch (err) {
      console.error('Error al eliminar producto:', err);
      alert('No se pudo eliminar el producto');
    }
  };

  const openModal = (product, mode) => {
    const matrix = buildVariantMatrix(product);
    const defaults = findFirstVariant(matrix);
    setModalData({
      product,
      mode,
      color: defaults.color,
      size: defaults.size,
      quantity: 1
    });
  };

  const handleModalSubmit = async () => {
    const { product, mode, color, size, quantity } = modalData || {};
    if (!product || !color || !size || Number.isNaN(quantity) || quantity <= 0) {
      alert('Datos invalidos');
      return;
    }

    const matrix = buildVariantMatrix(product);
    const available = Number(matrix[color]?.[size] || 0);
    if (!available) {
      alert('No hay stock disponible para la combinacion seleccionada.');
      return;
    }
    if (quantity > available) {
      alert(`Solo hay ${available} unidades disponibles.`);
      return;
    }

    const url = `/api/products/${mode}/${product._id}`;
    try {
      await axios.post(url, { color, size, quantity }, { withCredentials: true });
      alert(mode === 'order' ? 'Pedido registrado' : 'Venta registrada');
      fetchProducts();
      setModalData(null);
    } catch (err) {
      console.error('Error al registrar:', err);
      alert('Error al registrar la accion');
    }
  };

  useEffect(() => {
    if (modulesLoading) return;
    fetchProducts();
  }, [modulesLoading]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get('query') ?? '');
  }, [location.search]);

  const catalogItems = useMemo(
    () =>
      products.map(product => ({
        product,
        inventory: buildInventorySummary(product)
      })),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    const matchesSearch = item => {
      if (!normalized) return true;
      const { product } = item;
      const searchable = [
        product.name,
        product.code,
        product.sku,
        product.brand,
        product.collection
      ];
      return searchable.some(value =>
        String(value || '').toLowerCase().includes(normalized)
      );
    };

    const matchesStockFilter = item => {
      if (!inventoryVisible) return true;
      const { inventory } = item;
      if (stockFilter === 'out') return inventory.totalUnits === 0;
      if (stockFilter === 'low') {
        return inventory.totalUnits > 0 && (
          inventory.totalUnits <= LOW_STOCK_THRESHOLD ||
          inventory.lowStockVariants.length > 0
        );
      }
      if (stockFilter === 'healthy') {
        return inventory.totalUnits > LOW_STOCK_THRESHOLD && inventory.lowStockVariants.length === 0;
      }
      return true;
    };

    return catalogItems
      .filter(item => matchesSearch(item) && matchesStockFilter(item))
      .sort((left, right) => {
        if (sortBy === 'name') {
          return (left.product.name || '').localeCompare(right.product.name || '');
        }
        if (sortBy === 'stock-asc') {
          return left.inventory.totalUnits - right.inventory.totalUnits;
        }
        if (sortBy === 'stock-desc') {
          return right.inventory.totalUnits - left.inventory.totalUnits;
        }
        if (sortBy === 'price-desc') {
          return Number(right.product.price?.retail || 0) - Number(left.product.price?.retail || 0);
        }

        const leftRiskScore =
          (left.inventory.totalUnits === 0 ? 1000 : 0) +
          left.inventory.lowStockVariants.length * 100 -
          left.inventory.totalUnits;
        const rightRiskScore =
          (right.inventory.totalUnits === 0 ? 1000 : 0) +
          right.inventory.lowStockVariants.length * 100 -
          right.inventory.totalUnits;

        return rightRiskScore - leftRiskScore;
      });
  }, [catalogItems, inventoryVisible, searchTerm, sortBy, stockFilter]);

  const catalogStats = useMemo(() => {
    const totalCount = catalogItems.length;
    const visibleCount = filteredProducts.length;
    const totalUnits = catalogItems.reduce((acc, item) => acc + item.inventory.totalUnits, 0);
    const lowStockCount = catalogItems.filter(
      item =>
        item.inventory.totalUnits > 0 &&
        (
          item.inventory.totalUnits <= LOW_STOCK_THRESHOLD ||
          item.inventory.lowStockVariants.length > 0
        )
    ).length;
    const outOfStockCount = catalogItems.filter(item => item.inventory.totalUnits === 0).length;

    return {
      totalCount,
      visibleCount,
      totalUnits,
      lowStockCount,
      outOfStockCount
    };
  }, [catalogItems, filteredProducts]);

  const headingTitle = searchTerm
    ? `Resultados para "${searchTerm}"`
    : inventoryVisible
      ? 'Inventario activo'
      : 'Catalogo activo';

  const modalVariantMatrix = useMemo(() => {
    if (!modalData?.product) return null;
    return buildVariantMatrix(modalData.product);
  }, [modalData?.product]);

  const modalColorLabelMap = useMemo(() => {
    if (!modalData?.product) return {};
    return getColorLabelMap(modalData.product);
  }, [modalData?.product]);

  const modalAvailable = useMemo(() => {
    if (!modalData || !modalVariantMatrix) return 0;
    return Number(modalVariantMatrix[modalData.color]?.[modalData.size] || 0);
  }, [modalData, modalVariantMatrix]);

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm lg:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold text-slate-900">{headingTitle}</h2>
                <span className="metric-chip">
                  {catalogStats.visibleCount} de {catalogStats.totalCount}
                </span>
                {isRefreshing && (
                  <span className="metric-chip border border-brand/20 bg-brand/5 text-brand">
                    Actualizando
                  </span>
                )}
              </div>
              <p className="max-w-3xl text-sm text-slate-500">
                {inventoryVisible
                  ? 'Revisa stock, detecta productos en riesgo y ejecuta movimientos sin salir del catalogo.'
                  : 'Vista de catalogo para revisar fichas, precios y estructura del producto.'}
              </p>
              {!inventoryVisible && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Inventario no disponible para tu perfil. Solo se muestran datos de catalogo.
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Stock bajo</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {inventoryVisible ? catalogStats.lowStockCount : '--'}
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Sin stock</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {inventoryVisible ? catalogStats.outOfStockCount : '--'}
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Unidades</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {inventoryVisible ? catalogStats.totalUnits : '--'}
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Modo</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {inventoryVisible ? 'Inventario operativo' : 'Solo catalogo'}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-surface-200 bg-white p-4 shadow-sm lg:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {inventoryVisible && STOCK_FILTERS.map(filter => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStockFilter(filter.value)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    stockFilter === filter.value
                      ? 'bg-slate-950 text-white'
                      : 'border border-surface-200 bg-white text-slate-600 hover:border-brand/30 hover:text-brand'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <select
                value={sortBy}
                onChange={event => setSortBy(event.target.value)}
                className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                {SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={fetchProducts}
                className="rounded-xl border border-surface-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
              >
                Actualizar
              </button>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="rounded-xl bg-brand/10 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/20"
                >
                  Limpiar busqueda
                </button>
              )}
            </div>
          </div>
        </section>

        {filteredProducts.length ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {filteredProducts.map(({ product, inventory }) => {
                const inventoryMeta = getInventoryHealthMeta(inventory);

                return (
                  <article key={product._id} className="rounded-3xl border border-surface-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="h-20 w-20 flex-none overflow-hidden rounded-2xl bg-surface-100">
                        <ProductImage
                          src={product.images?.[0]?.url || ''}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold text-slate-900">{product.name}</h3>
                          {inventoryVisible && (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${inventoryMeta.className}`}>
                              {inventoryMeta.label}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          Cod. {product.code} {product.brand ? `· ${product.brand}` : ''}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {formatCurrency(product.price?.retail)}
                        </p>
                        {inventoryVisible && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="metric-chip">Stock {inventory.totalUnits}</span>
                            <span className="metric-chip">{inventory.activeVariants.length} variantes</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {inventoryVisible && inventory.previewVariants.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {inventory.previewVariants.slice(0, 4).map(variant => (
                          <span
                            key={variant.key}
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${getVariantPillClassName(variant.qty)}`}
                          >
                            <span>{variant.colorLabel}/{variant.size}</span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              {variant.qty}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/product-private/${product._id}`)}
                        className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                      >
                        Ver
                      </button>
                      {canEditProducts && (
                        <button
                          type="button"
                          onClick={() => navigate(`/editar-producto/${product._id}`)}
                          className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          Editar
                        </button>
                      )}
                      {inventoryVisible && canAdjustInventory && (
                        <>
                          <button
                            type="button"
                            onClick={() => openModal(product, 'order')}
                            className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                          >
                            Pedido
                          </button>
                          <button
                            type="button"
                            onClick={() => openModal(product, 'sell')}
                            className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white"
                          >
                            Venta
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <section className="hidden overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-surface-200">
                  <thead className="bg-surface-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Producto</th>
                      <th className="px-4 py-3 font-semibold">Retail</th>
                      <th className="px-4 py-3 font-semibold">Niveles</th>
                      {inventoryVisible && (
                        <>
                          <th className="px-4 py-3 font-semibold">Estado</th>
                          <th className="px-4 py-3 font-semibold">Stock</th>
                          <th className="px-4 py-3 font-semibold">Variantes</th>
                        </>
                      )}
                      <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-200 text-sm text-slate-700">
                    {filteredProducts.map(({ product, inventory }) => {
                      const inventoryMeta = getInventoryHealthMeta(inventory);

                      return (
                        <tr key={product._id} className="align-top">
                          <td className="px-4 py-4">
                            <div className="flex items-start gap-3">
                              <div className="h-16 w-16 flex-none overflow-hidden rounded-2xl bg-surface-100">
                                <ProductImage
                                  src={product.images?.[0]?.url || ''}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900">{product.name}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                                  {product.gender || 'Sin genero'} / {product.type || 'Sin tipo'}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                  <span>Cod. {product.code}</span>
                                  {product.brand && <span>{product.brand}</span>}
                                  {product.collection && <span>{product.collection}</span>}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 font-semibold text-slate-900">
                            {formatCurrency(product.price?.retail)}
                          </td>

                          <td className="px-4 py-4">
                            <div className="space-y-1 text-xs text-slate-500">
                              <p>Gold: <span className="font-semibold text-slate-700">{formatCurrency(product.price?.gold ?? product.price?.retail)}</span></p>
                              <p>Premium: <span className="font-semibold text-slate-700">{formatCurrency(product.price?.premium ?? product.price?.retail)}</span></p>
                              <p>Platinum: <span className="font-semibold text-slate-700">{formatCurrency(product.price?.platinum ?? product.price?.retail)}</span></p>
                            </div>
                          </td>

                          {inventoryVisible && (
                            <>
                              <td className="px-4 py-4">
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${inventoryMeta.className}`}>
                                  {inventoryMeta.label}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <div className="space-y-1 text-xs text-slate-500">
                                  <p className="text-sm font-semibold text-slate-900">{inventory.totalUnits} uds</p>
                                  <p>{inventory.activeVariants.length} variantes activas</p>
                                  <p>{inventory.colorsWithStock}/{inventory.colorCount} colores</p>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex max-w-[360px] flex-wrap gap-2">
                                  {inventory.previewVariants.length ? (
                                    inventory.previewVariants.map(variant => (
                                      <span
                                        key={variant.key}
                                        className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-medium ${getVariantPillClassName(variant.qty)}`}
                                      >
                                        <span className="max-w-[120px] truncate">
                                          {variant.colorLabel}/{variant.size}
                                        </span>
                                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                          {variant.qty}
                                        </span>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-slate-400">Sin variantes</span>
                                  )}
                                </div>
                              </td>
                            </>
                          )}

                          <td className="px-4 py-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => navigate(`/product-private/${product._id}`)}
                                className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                              >
                                Ver detalle
                              </button>
                              {canEditProducts && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/editar-producto/${product._id}`)}
                                  className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                                >
                                  Editar
                                </button>
                              )}
                              {inventoryVisible && canAdjustInventory && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openModal(product, 'order')}
                                    className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                                  >
                                    Pedido
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openModal(product, 'sell')}
                                    className="rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark"
                                  >
                                    Venta
                                  </button>
                                </>
                              )}
                              {canDeleteProducts && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(product._id)}
                                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                                >
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-surface-200 bg-white px-6 py-14 text-center text-slate-500">
            <p className="mb-2 text-lg font-semibold text-slate-700">Sin resultados</p>
            <p className="text-sm">
              No encontramos productos con los filtros actuales.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                Volver al inventario
              </button>
              {inventoryVisible && (
                <button
                  type="button"
                  onClick={() => setStockFilter('all')}
                  className="rounded-full border border-surface-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                >
                  Quitar filtro
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {modalData && modalVariantMatrix && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-card-lg">
            <div className="mb-5">
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                {modalData.mode === 'order' ? 'Registrar pedido' : 'Registrar venta'}
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                {modalData.product?.name}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Selecciona la variante exacta antes de confirmar el movimiento.
              </p>
            </div>

            <label className="block text-sm font-medium text-slate-600">Color</label>
            <select
              value={modalData.color}
              onChange={event => {
                const nextColor = event.target.value;
                const sizeKeys = Object.keys(modalVariantMatrix[nextColor] || {});
                setModalData(prev => ({
                  ...prev,
                  color: nextColor,
                  size: sizeKeys[0] || '',
                  quantity: 1
                }));
              }}
              className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              {Object.keys(modalVariantMatrix).map(color => (
                <option key={color} value={color}>
                  {modalColorLabelMap[color] || color}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-sm font-medium text-slate-600">Talla</label>
            <select
              value={modalData.size}
              onChange={event => setModalData({ ...modalData, size: event.target.value })}
              className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              <option value="">Selecciona una talla</option>
              {Object.keys(modalVariantMatrix[modalData.color] || {}).map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-sm font-medium text-slate-600">Cantidad</label>
            <input
              type="number"
              min="1"
              max={modalAvailable || undefined}
              value={modalData.quantity}
              onChange={event => {
                const next = parseInt(event.target.value, 10) || 1;
                const clamped = modalAvailable ? Math.min(next, modalAvailable) : next;
                setModalData({ ...modalData, quantity: clamped });
              }}
              className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
            />

            <div className="mt-3 rounded-2xl border border-surface-200 bg-surface-50 px-3 py-3 text-sm">
              {modalAvailable ? (
                <p className="text-slate-600">
                  Disponible para esta variante: <strong className="text-slate-900">{modalAvailable}</strong>
                </p>
              ) : (
                <p className="text-red-600">No hay stock para la combinacion seleccionada.</p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalData(null)}
                className="rounded-xl border border-surface-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleModalSubmit}
                disabled={!canAdjustInventory}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand-sm hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPage;
