import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../../../api/axiosInstance';

const Card = ({ label, keyName }) => (
  <Link
    to={`/productos?${encodeURIComponent(keyName)}=${encodeURIComponent(label)}`}
    className="group relative flex items-center justify-between overflow-hidden rounded-[28px] border border-slate-100 bg-white/90 px-5 py-4 shadow-md shadow-slate-900/5 transition hover:-translate-y-1 hover:shadow-2xl"
  >
    <div className="absolute inset-0 bg-gradient-to-r from-brand/5 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
    <div className="relative">
      <h4 className="text-base font-semibold text-slate-900">{label}</h4>
      <p className="mt-1 text-sm text-[#5f6168]">Ver productos</p>
    </div>
    <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white">
      <span className="text-lg" aria-hidden="true">
        →
      </span>
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
  const skeletonItems = useMemo(() => Array.from({ length: limit || 6 }), [limit]);

  return (
    <section className="container mx-auto px-4 py-12">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-500">Descubre</p>
          <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h3>
        </div>
        <Link
          to="/origen"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-500 transition hover:border-emerald-300 hover:text-emerald-600"
        >
          Ver todos
        </Link>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {skeletonItems.map((_, idx) => (
            <div
              key={`origin-skeleton-${idx}`}
              className="h-24 animate-pulse rounded-[28px] border border-slate-100 bg-white"
            />
          ))}
        </div>
      )}

      {!loading && list.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {list.map(val => (
            <Card key={val} label={val} keyName={keyName} />
          ))}
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="rounded-[28px] border border-slate-100 bg-white/80 px-6 py-10 text-center text-sm text-slate-500 shadow-inner">
          No encontramos origenes disponibles por ahora.
        </div>
      )}
    </section>
  );
}
