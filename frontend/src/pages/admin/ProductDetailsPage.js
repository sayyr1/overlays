import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from '../../api/axiosInstance';
import ProductImage from '../../components/usuario/ProductImage';
import ProductInterestPanel from '../../components/crm/ProductInterestPanel';
import { usePublicConfig } from '../../context/PublicConfigContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/pricing';
import {
  buildNestedVariantsWithFallback,
  normalizeVariantColor
} from '../../utils/inventory';

const getInventoryHealthMeta = totalStock => {
  if (!totalStock) {
    return {
      label: 'Sin stock',
      className: 'border border-red-200 bg-red-50 text-red-700'
    };
  }

  if (totalStock <= 5) {
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

  if (qty <= 5) {
    return 'border border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border border-surface-200 bg-white text-slate-700';
};

const ProductDetailsPage = () => {
  const { isModuleEnabled, settings } = usePublicConfig();
  const { hasPermission } = useAuth();
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const inventoryEnabled = isModuleEnabled('inventory') && hasPermission('inventory.view');
  const canViewProductInterest = isModuleEnabled('crm') && hasPermission('crm.productInterestView');
  const imageVisibilityEnabled = Boolean(settings?.enableInternalProductImages);

  useEffect(() => {
    axios
      .get(`/api/products/${id}`)
      .then(res => setProduct(res.data))
      .catch(() => setError('No se pudo cargar el producto.'));
  }, [id]);

  const variantMatrix = useMemo(() => {
    if (!product) {
      return {};
    }

    const nested = buildNestedVariantsWithFallback(
      product.stockByColorSize,
      product.stockBySize
    );
    const result = { ...nested };

    (product.colors || []).forEach(color => {
      const normalized = normalizeVariantColor(color);
      if (!result[normalized]) {
        result[normalized] = {};
      }
    });

    return result;
  }, [product]);

  const colorLabelMap = useMemo(() => {
    const map = {};
    (product?.colors || []).forEach(color => {
      map[normalizeVariantColor(color)] = color;
    });
    return map;
  }, [product]);

  const totalStock = useMemo(
    () =>
      Object.values(variantMatrix).reduce((acc, sizes) => {
        const subtotal = Object.values(sizes || {}).reduce(
          (inner, qty) => inner + Number(qty || 0),
          0
        );
        return acc + subtotal;
      }, 0),
    [variantMatrix]
  );

  const inventoryMeta = useMemo(
    () => getInventoryHealthMeta(totalStock),
    [totalStock]
  );

  const publicImages = Array.isArray(product?.images) ? product.images : [];
  const internalImages = Array.isArray(product?.internalImages) ? product.internalImages : [];
  const coverImageId = publicImages[0]?.public_id || publicImages[0]?.url || '';

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 text-red-600">
        {error}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 text-slate-500">
        Cargando producto...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm lg:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold text-slate-900">{product.name}</h1>
                {inventoryEnabled && (
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${inventoryMeta.className}`}>
                    {inventoryMeta.label}
                  </span>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    product.storeReady
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  {product.storeReady ? 'Visible en tienda' : 'Oculto en tienda'}
                </span>
                {product.onSale && (
                  <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-700">
                    En promocion
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                <span>Cod. {product.code}</span>
                <span>{product.gender || 'Sin genero'}</span>
                <span>{product.type || 'Sin tipo'}</span>
                {product.brand && <span>{product.brand}</span>}
                {product.collection && <span>{product.collection}</span>}
              </div>
              <p className="max-w-3xl text-sm text-slate-500">
                {product.description || 'Sin descripcion registrada para este producto.'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Retail</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {formatCurrency(product.price?.retail ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Gold</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {formatCurrency(product.price?.gold ?? product.price?.retail ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Premium</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {formatCurrency(product.price?.premium ?? product.price?.retail ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Platinum</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {formatCurrency(product.price?.platinum ?? product.price?.retail ?? 0)}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Galeria</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">Imagenes del producto</h2>
              </div>
              <Link
                to="/dashboard"
                className="rounded-xl border border-surface-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
              >
                Volver al inventario
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                Tienda
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {product.publicImageCount ?? publicImages.length} fotos visibles
              </span>
              <span className="text-xs text-slate-500">
                Estas son las imagenes que ve el cliente en el catalogo y en el detalle del producto.
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
              {publicImages.length ? (
                publicImages.map(image => {
                  const imageKey = image.public_id || image.url;
                  const isCover = imageKey === coverImageId;

                  return (
                  <div
                    key={imageKey}
                    className="relative overflow-hidden rounded-3xl border border-surface-200 bg-surface-50"
                  >
                    {isCover && (
                      <span className="absolute left-3 top-3 z-10 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm">
                        Portada tienda
                      </span>
                    )}
                    <ProductImage
                      src={image.url}
                      alt={product.name}
                      className="aspect-[4/5] w-full object-cover"
                    />
                  </div>
                  );
                })
              ) : (
                <div className="col-span-full rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-10 text-center text-sm text-slate-500">
                  Este producto no tiene fotos publicas cargadas.
                </div>
              )}
            </div>

            {imageVisibilityEnabled && (
              <div className="mt-6">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Referencia interna</p>
                <h3 className="mt-2 text-base font-semibold text-slate-900">Fotos para el equipo</h3>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    Interna
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {product.internalImageCount ?? internalImages.length} fotos operativas
                  </span>
                  <span className="text-xs text-slate-500">
                    Sirven como referencia de bodega, detalles o soporte interno y no salen en tienda.
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
                  {internalImages.length ? (
                    internalImages.map(image => (
                      <div
                        key={`internal-${image.public_id}`}
                        className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950/5"
                      >
                        <ProductImage
                          src={image.url}
                          alt={`${product.name} interna`}
                          className="aspect-[4/5] w-full object-cover"
                        />
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-center text-sm text-slate-500">
                      No hay fotos internas cargadas para este producto.
                    </div>
                  )}
                </div>
              </div>
            )}

            {product.colors?.length > 0 && (
              <div className="mt-6">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Colores</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Array.from(new Set(product.colors)).map(color => (
                    <span
                      key={color}
                      className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700"
                    >
                      {color}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </article>

          <article className="space-y-6">
            <section className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Ficha</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">Resumen operativo</h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Categoria</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {product.category || product.type || 'Sin categoria'}
                  </p>
                </div>
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Genero</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {product.gender || 'Sin genero'}
                  </p>
                </div>
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Marca</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {product.brand || 'Sin marca'}
                  </p>
                </div>
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Coleccion</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {product.collection || 'Sin coleccion'}
                  </p>
                </div>
                {inventoryEnabled && (
                  <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 sm:col-span-2">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Stock total</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{totalStock}</p>
                    <p className="text-xs text-slate-500">
                      {Object.keys(variantMatrix).length} colores registrados
                    </p>
                  </div>
                )}
              </div>
            </section>

            {inventoryEnabled && (
              <section className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Inventario</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">Stock por color y talla</h2>

                {Object.keys(variantMatrix).length ? (
                  <div className="mt-5 space-y-4">
                    {Object.entries(variantMatrix).map(([color, sizes]) => {
                      const totalByColor = Object.values(sizes || {}).reduce(
                        (acc, qty) => acc + Number(qty || 0),
                        0
                      );
                      const displayColor = colorLabelMap[color] || color;
                      return (
                        <div
                          key={color}
                          className="rounded-2xl border border-surface-200 bg-surface-50 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-slate-900">{displayColor}</p>
                            <span className="text-sm text-slate-500">Total {totalByColor}</span>
                          </div>

                          {Object.keys(sizes || {}).length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {Object.entries(sizes).map(([size, qty]) => (
                                <span
                                  key={`${color}-${size}`}
                                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${getVariantPillClassName(Number(qty || 0))}`}
                                >
                                  <span>{size}</span>
                                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                    {qty}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-slate-500">
                              Sin tallas registradas para este color.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-center text-sm text-slate-500">
                    No hay variantes registradas.
                  </div>
                )}
              </section>
            )}
          </article>
        </section>

        {canViewProductInterest && (
          <section className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <ProductInterestPanel productId={product._id} />
          </section>
        )}
      </div>
    </div>
  );
};

export default ProductDetailsPage;
