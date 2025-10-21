import React from 'react';
import { Link } from 'react-router-dom';
import Modelo from '../../../assets/images/model.png';

const HERO_METRICS = [
  { label: 'Clientes felices', value: '12K+' },
  { label: 'Nuevos drops/mes', value: '48' },
  { label: 'Tiempo de envio', value: '24h' }
];

export default function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-brand-gradient" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-surface-50/90 to-transparent" />
      <div className="absolute inset-x-0 top-0 -z-10 h-48 bg-hero-radial opacity-70" />

      <div className="container mx-auto flex flex-col gap-12 px-6 py-16 text-white lg:flex-row lg:items-center lg:justify-between lg:py-20">
        <div className="max-w-2xl space-y-8">
          <span className="pill-badge bg-white/20 text-white/90">
            Coleccion capsula - 2025
          </span>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl">
              Disenos artesanales para experiencias premium en e-commerce.
            </h1>
            <p className="text-base text-white/80 sm:text-lg">
              Lanza tu proxima coleccion con fichas de producto enriquecidas, navegacion inteligente y journeys de compra inspirados en los mejores players del mercado.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              to="/productos"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-brand-sm transition hover:-translate-y-0.5 hover:shadow-brand-md"
            >
              Comprar ahora
            </Link>
            <Link
              to="/categorias"
              className="inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white/90 transition hover:border-white hover:bg-white/10"
            >
              Explorar categorias
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-4 sm:grid-cols-3">
            {HERO_METRICS.map(metric => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-semibold">{metric.value}</p>
                <p className="text-xs uppercase tracking-wide text-white/70">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="glass-card relative h-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
            <img
              src={Modelo}
              alt="Lookbook capsula"
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/30 bg-white/15 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-white/80">Coleccion capsula</p>
              <p className="mt-2 text-lg font-semibold">Aurora Nightfall</p>
              <p className="text-sm text-white/70">Basicos esenciales con textiles italianos y tintes eco.</p>
            </div>
          </div>

          <div className="absolute -bottom-10 left-1/2 w-[85%] -translate-x-1/2 rounded-2xl border border-white/20 bg-white/90 p-5 text-slate-900 shadow-card-lg">
            <p className="text-sm font-semibold text-slate-800">98% de satisfaccion post entrega</p>
            <p className="text-xs text-slate-500">Soporte concierge 7/7, devoluciones simplificadas y seguimiento en tiempo real.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

