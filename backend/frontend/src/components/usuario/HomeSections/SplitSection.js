import React from 'react';
import { Link } from 'react-router-dom';
import ShopInter from '../../../assets/images/shop-interior.png';

export default function SplitSection() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2">
      <div className="h-80 bg-cover bg-center" style={{ backgroundImage: `url(${ShopInter})` }} />
      <div className="p-10 bg-teal-900 text-white flex flex-col justify-center">
        <h2 className="text-3xl font-bold mb-4">Compra y vende productos en Otavalo</h2>
        <p className="mb-6">
          El mercado de Otavalo ahora vive en línea. Conecta con la esencia de nuestra comunidad comprando directamente a negocios locales.
        </p>
        <div className="flex space-x-4">
          {/* <Link to="/tiendas" className="bg-yellow-400 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-yellow-500 transition">
              Explorar Tiendas
            </Link> */}
            {/* <Link to="/contacto" className="bg-white text-teal-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition">
              ÚNETE AHORA
            </Link> */}
        </div>
      </div>
    </section>
  );
}
