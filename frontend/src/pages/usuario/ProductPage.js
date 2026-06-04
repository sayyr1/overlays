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

const ProductPage = () => {
  const { isModuleEnabled, loading: modulesLoading } = usePublicConfig();
  const { hasPermission } = useAuth();
  const [products, setProducts] = useState([]);
  const [modalData, setModalData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const inventoryEnabled = isModuleEnabled('inventory');
  const canEditProducts = hasPermission('products.edit');
  const canDeleteProducts = hasPermission('products.delete');
  const canAdjustInventory = hasPermission('inventory.adjust');
  const canViewInventory = hasPermission('inventory.view') || canAdjustInventory;

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
    if (modulesLoading) {
      return;
    }
    fetchProducts();
  }, [modulesLoading]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get('query') ?? '');
  }, [location.search]);

  const filteredProducts = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter(product => {
      const name = (product.name ?? '').toLowerCase();
      const code = (product.code ?? '').toString().toLowerCase();
      const sku = (product.sku ?? '').toLowerCase();
      return [name, code, sku].some(value => value.includes(normalized));
    });
  }, [products, searchTerm]);

  const headingTitle = searchTerm
    ? `Resultados para "${searchTerm}"`
    : inventoryEnabled && canViewInventory
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
    return Number(
      modalVariantMatrix[modalData.color]?.[modalData.size] || 0
    );
  }, [modalData, modalVariantMatrix]);

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="container mx-auto px-4 py-8 lg:px-10">
        <div className="flex flex-col gap-3 border-b border-surface-200 pb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-semibold text-slate-900">{headingTitle}</h2>
            <span className="metric-chip">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'}
            </span>
            {isRefreshing && canViewInventory && (
              <span className="metric-chip border border-brand/20 bg-brand/5 text-brand">
                Sincronizando inventario...
              </span>
            )}
          </div>
          <p className="max-w-3xl text-sm text-slate-500">
            {inventoryEnabled && canViewInventory
              ? 'Gestiona tu catalogo, registra pedidos y controla existencias en tiempo real. Usa la busqueda superior para filtrar por nombre, codigo o SKU.'
              : 'Gestiona el catalogo base del cliente. El modulo de inventario esta desactivado, por lo que no se muestran movimientos ni stock operativo.'}
          </p>
          {(!inventoryEnabled || !canViewInventory) && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Inventario no disponible para tu perfil. Puedes revisar y depurar fichas de producto, pero no registrar ventas, pedidos ni stock.
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={fetchProducts}
              className="inline-flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
            >
              Actualizar datos
            </button>
            {searchTerm && (
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-brand/10 px-4 py-2 text-xs font-semibold text-brand transition hover:bg-brand/20"
              >
                Limpiar filtro
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map(product => {
            const variantMatrix = buildVariantMatrix(product);
            const colorLabelMap = getColorLabelMap(product);
            const totalUnits = Object.values(variantMatrix).reduce((acc, sizes) => {
              const subtotal = Object.values(sizes || {}).reduce(
                (inner, qty) => inner + Number(qty || 0),
                0
              );
              return acc + subtotal;
            }, 0);

            return (
              <div key={product._id} className="surface-card overflow-hidden">
                <ProductImage
                  src={product.images?.[0]?.url || ''}
                  alt={product.name}
                  className="h-64 w-full object-cover"
                />
                <div className="space-y-5 p-6">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-slate-400">
                      {product.gender} / {product.type}
                    </p>
                    <p className="text-sm text-slate-500">Codigo interno: {product.code}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
                    <div>
                      <span className="block text-xs uppercase text-slate-400">Retail</span>
                      <strong className="text-slate-900">${product.price?.retail ?? 0}</strong>
                    </div>
                    <div>
                      <span className="block text-xs uppercase text-slate-400">Gold</span>
                      <strong className="text-slate-900">
                        ${product.price?.gold ?? product.price?.retail ?? 0}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-xs uppercase text-slate-400">Premium</span>
                      <strong className="text-slate-900">
                        ${product.price?.premium ?? product.price?.retail ?? 0}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-xs uppercase text-slate-400">Platinum</span>
                      <strong className="text-slate-900">
                        ${product.price?.platinum ?? product.price?.retail ?? 0}
                      </strong>
                    </div>
                  </div>

                  {inventoryEnabled && canViewInventory && (
                    <div className="rounded-lg border border-slate-100 p-3">
                      <div className="flex items-center justify-between text-xs uppercase text-slate-400">
                        <span>Inventario</span>
                        <span>Total {totalUnits}</span>
                      </div>
                      <div className="mt-3 space-y-3">
                        {Object.entries(variantMatrix).map(([color, sizes]) => {
                          const totalByColor = Object.values(sizes || {}).reduce(
                            (acc, qty) => acc + Number(qty || 0),
                            0
                          );
                          const displayColor = colorLabelMap[color] || color;
                          const sizeEntries = Object.entries(sizes || {});

                          return (
                            <div key={color}>
                              <div className="flex items-center justify-between text-sm font-medium text-slate-600">
                                <span>{displayColor}</span>
                                <span className="text-xs text-slate-400">Total {totalByColor}</span>
                              </div>
                              {sizeEntries.length ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {sizeEntries.map(([size, qty]) => (
                                    <span key={`${color}-${size}`} className="metric-chip">
                                      {size}
                                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white font-semibold text-slate-700 shadow-inner">
                                        {qty}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-1 text-xs text-slate-400">
                                  Sin tallas registradas para este color.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {inventoryEnabled && canAdjustInventory && (
                      <>
                        <button
                          type="button"
                          onClick={() => openModal(product, 'order')}
                          className="inline-flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand/40 hover:text-brand"
                        >
                          Registrar pedido
                        </button>
                        <button
                          type="button"
                          onClick={() => openModal(product, 'sell')}
                          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand-sm transition hover:bg-brand-dark"
                        >
                          Registrar venta
                        </button>
                      </>
                    )}
                    {canDeleteProducts && (
                      <button
                        type="button"
                        onClick={() => handleDelete(product._id)}
                        className="ml-auto inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm font-semibold text-brand">
                    {canEditProducts ? (
                      <a href={`/editar-producto/${product._id}`} className="hover:text-brand-dark">
                        Editar ficha
                      </a>
                    ) : (
                      <span className="text-slate-400">Solo lectura</span>
                    )}
                    <a href={`/product-private/${product._id}`} className="hover:text-brand-dark">
                      Ver detalle
                    </a>
                  </div>
                </div>
              </div>
            );
          })}

          {!filteredProducts.length && (
            <div className="col-span-full rounded-3xl border border-dashed border-surface-200 bg-white/70 px-6 py-16 text-center text-slate-500">
              <p className="mb-2 text-lg font-semibold text-slate-600">Sin resultados</p>
              <p className="text-sm">
                No encontramos coincidencias para "{searchTerm}". Intenta con otro termino o vuelve al inventario completo.
              </p>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-brand-sm transition hover:bg-brand-dark"
              >
                Volver al inventario
              </button>
            </div>
          )}
        </div>
      </div>

      {modalData && modalVariantMatrix && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card-lg">
            <h3 className="mb-4 text-xl font-semibold text-slate-900">
              {modalData.mode === 'order' ? 'Registrar pedido' : 'Registrar venta'}
            </h3>

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
            {modalAvailable ? (
              <p className="mt-1 text-xs text-slate-400">
                Disponible: {modalAvailable} unidades
              </p>
            ) : (
              <p className="mt-1 text-xs text-red-500">
                No hay stock para la combinacion seleccionada.
              </p>
            )}

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
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand-sm hover:bg-brand-dark"
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
