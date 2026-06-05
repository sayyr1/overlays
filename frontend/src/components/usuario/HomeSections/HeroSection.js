import React from 'react';
import { Link } from 'react-router-dom';
import Modelo from '../../../assets/images/model.png';
import { usePublicConfig } from '../../../context/PublicConfigContext';

export default function HeroSection() {
  const { storeName } = usePublicConfig();

  const brandName = storeName;

  return (
    <section className="border-b border-white/5 bg-[#141414] py-4">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#0f0f0f]">
          <div className="absolute inset-0">
            <img
              src={Modelo}
              alt={`${brandName} coleccion destacada`}
              className="h-full w-full object-cover object-center"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,7,0.92)_0%,rgba(7,7,7,0.7)_38%,rgba(7,7,7,0.18)_78%,rgba(7,7,7,0.1)_100%)]" />
          </div>

          <div className="relative flex min-h-[176px] items-center px-6 py-7 sm:min-h-[190px] sm:px-8 lg:min-h-[210px] lg:px-10">
            <div className="max-w-[540px]">
              <span className="inline-flex rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.26em] text-white/70 backdrop-blur">
                Coleccion destacada
              </span>
              <h1 className="mt-4 max-w-[440px] text-3xl font-semibold leading-[0.96] text-white sm:text-4xl lg:text-[3.25rem]">
                Portadas que venden colecciones, no dashboards.
              </h1>
              <p className="mt-3 max-w-[420px] text-sm text-white/70 sm:text-[15px]">
                Explora lanzamientos, favoritos y selecciones curadas en una vitrina visual mas limpia.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/productos"
                  className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Comprar ahora
                </Link>
                <Link
                  to="/productos?onSale=true"
                  className="rounded-md border border-white/15 bg-black/20 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:border-brand hover:text-brand"
                >
                  Ver colecciones
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
