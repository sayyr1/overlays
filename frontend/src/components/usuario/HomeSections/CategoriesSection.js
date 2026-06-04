import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../../../api/axiosInstance';
import { TagIcon, ShoppingBagIcon, SparklesIcon, BeakerIcon } from '@heroicons/react/24/outline';

const ICON_COMPONENTS = {
  Camisetas: TagIcon,
  Zapatos: ShoppingBagIcon,
  Accesorios: SparklesIcon,
  Fragancias: BeakerIcon
};

export default function CategoriesSection({ limit }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios
      .get('/api/categories')
      .then(({ data: { type = [] } }) => {
        setCategories(type.map(name => ({ name })));
      })
      .catch(err => {
        console.error('Error cargando categorias', err);
        setError('No se pudieron cargar las categorias.');
      })
      .finally(() => setLoading(false));
  }, []);

  const display = limit ? categories.slice(0, limit) : categories;

  return (
    <section className="py-16">
      <div className="container mx-auto px-4 lg:px-10">
        <div className="flex flex-col gap-4 text-center md:flex-row md:items-end md:justify-between md:text-left">
          <div className="space-y-3">
            <span className="pill-badge bg-brand/10 text-brand">Explora por estilo</span>
            <h2 className="text-3xl font-semibold text-slate-900 md:text-4xl">Categorias destacadas</h2>
            <p className="text-sm text-slate-500 md:max-w-xl">
              Estructura tu escaparate con colecciones personalizadas. Utiliza las categorias para construir campanas,
              filtros inteligentes y automatizaciones.
            </p>
          </div>
          <Link
            to="/categorias"
            className="inline-flex items-center gap-2 rounded-full border border-surface-200 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-brand/40 hover:text-brand"
          >
            Ver todas
          </Link>
        </div>

        <div className="mt-10">
          {loading && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: limit || 8 }, (_, index) => (
                <div key={`category-skeleton-${index}`} className="h-32 animate-pulse rounded-2xl bg-surface-100" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 px-6 py-6 text-center text-sm text-red-600">
              {error}
            </div>
          )}

          {!loading && !error && display.length === 0 && (
            <div className="mt-10 rounded-2xl border border-surface-200 bg-white px-6 py-6 text-center text-sm text-slate-500">
              Aun no hay categorias configuradas. Crea una desde el panel administrativo.
            </div>
          )}

          {!loading && !error && display.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {display.map(cat => {
                const Icon = ICON_COMPONENTS[cat.name] || TagIcon;
                return (
                  <Link
                    key={cat.name}
                    to={`/categoria/${encodeURIComponent(cat.name)}`}
                    className="group relative overflow-hidden rounded-2xl border border-surface-200 bg-white p-5 shadow-brand-sm transition hover:-translate-y-1 hover:shadow-card-lg"
                  >
                    <div className="absolute inset-0 bg-brand/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    <div className="relative flex h-full flex-col justify-between gap-4">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{cat.name}</p>
                        <span className="text-xs uppercase tracking-wide text-slate-400">Ver coleccion -></span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
