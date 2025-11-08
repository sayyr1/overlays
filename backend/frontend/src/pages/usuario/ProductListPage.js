import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from '../../api/axiosInstance';
import ProductImage from '../../components/usuario/ProductImage';
import { useAuth } from '../../context/AuthContext';
import { getPriceForUser, formatCurrency } from '../../utils/pricing';
import {
  buildProductFilterSearch,
  sanitizeFiltersForQuery
} from '../../utils/productFilters';

const ProductListPage = () => {
  const location = useLocation();
  const { membershipLevel } = useAuth();

  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const fetchProducts = useCallback(async activeFilters => {
    setIsLoading(true);
    try {
      // Merge known sanitized filters with any extra query params (e.g., ORIGEN)
      const known = new URLSearchParams(buildProductFilterSearch(activeFilters));
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

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-semibold text-center text-gray-800">Tienda en linea</h1>
        {Object.keys(extraFilters).length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {Object.entries(extraFilters).map(([k, v]) => (
              <span key={`${k}-${v}`} className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                {k}: {v}
              </span>
            ))}
          </div>
        )}

        {isLoading ? (
          <p className="text-center text-gray-500">Cargando productos...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map(product => (
              <div key={product._id} className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                <ProductImage
                  src={product.images?.[0]?.url}
                  alt={product.name}
                  className="w-full h-64 object-cover"
                />
                <div className="p-4 space-y-2">
                  <h3 className="text-xl font-semibold text-gray-800">{product.name}</h3>
                  <p className="text-lg text-gray-700">
                    <strong>{formatCurrency(getPriceForUser(product, membershipLevel))}</strong>
                  </p>
                  {product.onSale && <span className="text-red-500 text-sm font-medium">En oferta</span>}
                  {product.collection && (
                    <p className="text-xs uppercase tracking-wide text-gray-500">Coleccion: {product.collection}</p>
                  )}
                  <div className="pt-2">
                    <Link
                      to={`/product/${product._id}`}
                      className="block text-center py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-300"
                    >
                      Ver mas
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {!products.length && !isLoading && (
              <p className="col-span-full text-center text-gray-500">
                No encontramos productos con esos filtros.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductListPage;
