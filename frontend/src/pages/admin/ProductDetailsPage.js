import React, { useEffect, useMemo, useState } from 'react';
import axios from '../../api/axiosInstance';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../usuario/Navbar';
import ProductImage from '../../components/usuario/ProductImage';
import ProductInterestPanel from '../../components/crm/ProductInterestPanel';
import { usePublicConfig } from '../../context/PublicConfigContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/pricing';
import {
  buildNestedVariantsWithFallback,
  normalizeVariantColor
} from '../../utils/inventory';

const ProductDetailsPage = () => {
  const { isModuleEnabled } = usePublicConfig();
  const { hasPermission } = useAuth();
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const inventoryEnabled = isModuleEnabled('inventory') && hasPermission('inventory.view');
  const canViewProductInterest = isModuleEnabled('crm') && hasPermission('crm.productInterestView');

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

  const totalStock = useMemo(() => {
    return Object.values(variantMatrix).reduce((acc, sizes) => {
      const subtotal = Object.values(sizes || {}).reduce(
        (inner, qty) => inner + Number(qty || 0),
        0
      );
      return acc + subtotal;
    }, 0);
  }, [variantMatrix]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-600">
        {error}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        Cargando...
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Navbar />
      <div className="container mx-auto p-6">
        <h2 className="text-3xl font-semibold text-gray-800 mb-4">{product.name}</h2>
        <p className="text-lg text-gray-700 mb-4">
          <strong>Codigo:</strong> {product.code}
        </p>

        <div className="flex gap-6 flex-wrap mb-6">
          {product.images?.map(image => (
            <ProductImage
              key={image.public_id}
              src={image.url}
              alt={image.public_id}
              className="w-1/3 sm:w-1/4 md:w-1/5 rounded-lg border border-gray-200 shadow-sm"
            />
          ))}
        </div>

        <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 mb-6 text-sm text-gray-700">
          <p>
            <strong>Precio retail:</strong> {formatCurrency(product.price?.retail ?? 0)}
          </p>
          <p>
            <strong>Precio Gold:</strong>{' '}
            {formatCurrency(product.price?.gold ?? product.price?.retail ?? 0)}
          </p>
          <p>
            <strong>Precio Premium:</strong>{' '}
            {formatCurrency(product.price?.premium ?? product.price?.retail ?? 0)}
          </p>
          <p>
            <strong>Precio Platinum:</strong>{' '}
            {formatCurrency(product.price?.platinum ?? product.price?.retail ?? 0)}
          </p>
        </section>

        <p className="text-lg text-gray-700 mb-3">
          <strong>Categoria:</strong> {product.category || product.type}
        </p>
        <p className="text-lg text-gray-700 mb-3">
          <strong>Genero:</strong> {product.gender}
        </p>
        {inventoryEnabled && (
          <p className="text-lg text-gray-700 mb-3">
            <strong>Stock total:</strong> {totalStock}
          </p>
        )}

        {product.colors?.length > 0 && (
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-gray-700">Colores disponibles</h4>
            <div className="flex flex-wrap gap-2 mt-2">
              {Array.from(new Set(product.colors)).map(color => (
                <span
                  key={color}
                  className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                >
                  {color}
                </span>
              ))}
            </div>
          </div>
        )}

        {inventoryEnabled && (
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-gray-700">Stock por color y talla</h4>
            {Object.keys(variantMatrix).length ? (
              <div className="mt-3 space-y-4">
                {Object.entries(variantMatrix).map(([color, sizes]) => {
                  const totalByColor = Object.values(sizes || {}).reduce(
                    (acc, qty) => acc + Number(qty || 0),
                    0
                  );
                  const displayColor = colorLabelMap[color] || color;
                  return (
                    <div
                      key={color}
                      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-md font-semibold text-gray-700">{displayColor}</p>
                        <span className="text-sm text-gray-500">Total: {totalByColor}</span>
                      </div>
                      {Object.keys(sizes || {}).length ? (
                        <ul className="mt-2 grid gap-2 sm:grid-cols-2 text-sm text-gray-700">
                          {Object.entries(sizes).map(([size, qty]) => (
                            <li
                              key={`${color}-${size}`}
                              className="flex justify-between rounded-md border border-gray-100 px-3 py-2"
                            >
                              <span className="font-medium">{size}</span>
                              <span>{qty}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">
                          Sin tallas registradas para este color.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-500">No hay variantes registradas.</p>
            )}
          </div>
        )}

        <p className="text-lg text-gray-700 mb-6">
          <strong>Descripcion:</strong> {product.description || 'Sin descripcion'}
        </p>

        {canViewProductInterest && (
          <div className="mb-6">
            <ProductInterestPanel productId={product._id} />
          </div>
        )}

        <Link to="/dashboard" className="text-blue-500 hover:text-blue-700 text-lg font-medium">
          Volver al panel
        </Link>
      </div>
    </div>
  );
};

export default ProductDetailsPage;
