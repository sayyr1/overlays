import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../../../api/axiosInstance';

const Card = ({ label, keyName }) => (
  <Link
    to={`/productos?${encodeURIComponent(keyName)}=${encodeURIComponent(label)}`}
    className="group rounded-xl border border-gray-200 bg-white p-5 shadow hover:shadow-md transition-shadow duration-200 flex items-center justify-between"
  >
    <div>
      <h4 className="text-base font-semibold text-gray-800 group-hover:text-blue-600">
        {label}
      </h4>
      <p className="text-xs text-gray-500 mt-1">Ver productos</p>
    </div>
    <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
      <span className="text-blue-600 text-sm">→</span>
    </div>
  </Link>
);

export default function OrigenSection({ title = 'Explora por Origen', limit = 6 }) {
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

  const list = useMemo(() => (limit ? values.slice(0, limit) : values), [values, limit]);

  if (loading || !list.length) return null;

  return (
    <section className="container mx-auto px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
        <Link to="/origen" className="text-sm text-blue-600 hover:text-blue-700">
          Ver todos
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {list.map(val => (
          <Card key={val} label={val} keyName={keyName} />
        ))}
      </div>
    </section>
  );
}
