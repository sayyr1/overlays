import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../../api/axiosInstance';
import ProductImage from '../../components/usuario/ProductImage';

const OrigenRow = ({ value, keyName }) => {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`/api/products/filter?${encodeURIComponent(keyName)}=${encodeURIComponent(value)}`);
        if (!cancelled) setProducts(data || []);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-800">{value}</h4>
        <Link
          className="text-sm text-blue-600 hover:text-blue-700"
          to={`/productos?${encodeURIComponent(keyName)}=${encodeURIComponent(value)}`}
        >
          Ver todos
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Cargando productos…</p>
      ) : products.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {products.slice(0, 12).map(prod => (
            <Link key={prod._id} to={`/product/${prod._id}`} className="group">
              <div className="aspect-[1/1] w-full overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                <ProductImage
                  src={prod.images?.[0]?.url}
                  alt={prod.name}
                  className="h-full w-full object-cover group-hover:opacity-90 transition"
                />
              </div>
              <p className="mt-2 text-sm text-gray-700 line-clamp-1">{prod.name}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No hay productos para este origen.</p>
      )}
    </div>
  );
};

export default function OrigenListPage() {
  const [values, setValues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyName, setKeyName] = useState('ORIGEN');

  const origenKey = useMemo(() => 'ORIGEN', []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get('/api/categories');
        const keys = Object.keys(data || {});
        const resolved = keys.find(k => k.toLowerCase() === 'origen') || origenKey;
        const arr = Array.isArray(data?.[resolved]) ? data[resolved].filter(Boolean) : [];
        if (!cancelled) {
          setValues(arr);
          setKeyName(resolved);
        }
      } catch {
        if (!cancelled) setValues([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [origenKey]);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Explora por Origen</h1>
          <Link to="/productos" className="text-sm text-blue-600 hover:text-blue-700">Ver todo</Link>
        </div>
        {loading ? (
          <p className="text-gray-500">Cargando orígenes…</p>
        ) : values.length ? (
          <div className="space-y-6">
            {values.map(val => (
              <OrigenRow key={val} value={val} keyName={keyName} />)
            )}
          </div>
        ) : (
          <p className="text-gray-500">No hay valores para ORIGEN.</p>
        )}
      </div>
    </main>
  );
}
