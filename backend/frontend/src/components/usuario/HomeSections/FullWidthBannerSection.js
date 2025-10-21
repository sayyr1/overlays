// src/components/HomeSections/FullWidthBannerSection.js
import React from 'react';
import { Link } from 'react-router-dom';
import Landscape from '../../../assets/images/landscape.jpg';

export default function FullWidthBannerSection() {
  return (
    <section className="relative h-80 md:h-96 bg-cover bg-center" style={{ backgroundImage: `url(${Landscape})` }}>
      <div className="absolute inset-0 bg-black bg-opacity-40 flex flex-col items-center justify-center px-4">
        <h2 className="text-2xl sm:text-3xl md:text-4xl text-white font-bold mb-4">Todas las tiendas en un solo lugar</h2>
{/* <Link to="/tiendas" className="bg-yellow-400 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-yellow-500 transition">
              Explorar Tiendas
            </Link> */}
            {/* <Link to="/contacto" className="bg-white text-teal-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition">
              ÚNETE AHORA
            </Link> */}      </div>
    </section>
  );
}
