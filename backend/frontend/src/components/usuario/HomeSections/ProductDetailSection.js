import React from 'react';

export default function ProductDetailSection({ thumbs, activeIndex, setActiveIndex }) {
  return (
    <section className="container mx-auto px-4 py-16 lg:py-24 flex flex-col lg:flex-row gap-8">
      <div className="flex-shrink-0 flex flex-col space-y-2 overflow-y-auto">
        {thumbs.map((src, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIndex(idx)}
            className={`border rounded p-1 ${activeIndex === idx ? 'border-blue-500' : 'border-gray-200'}`}
          >
            <img src={src} alt={`thumb-${idx}`} className="h-16 w-16 object-cover" />
          </button>
        ))}
      </div>
      <div className="flex-1">
        <img src={thumbs[activeIndex]} alt="Producto Principal" className="w-full rounded-lg object-cover" />
      </div>
      <div className="lg:w-1/2">
        <h2 className="text-2xl font-semibold mb-2">Poncho Akatsuki</h2>
        <p className="text-xl text-gray-800 mb-4">
          <span className="font-bold">$39.00</span>
          <span className="line-through text-gray-500 ml-2">$59.00</span>
          <span className="bg-red-600 text-white text-xs px-2 py-1 rounded ml-2">AHORRA 33%</span>
        </p>
        <div className="flex items-center space-x-2 mb-4">
          <span className="font-medium">Colores Disponibles:</span>
          {['bg-blue-200', 'bg-yellow-200', 'bg-green-200'].map((bg, i) => (
            <span key={i} className={`h-6 w-6 rounded-full border border-gray-300 ${bg}`}></span>
          ))}
        </div>
        <div className="flex items-center space-x-2 mb-6">
          <span className="font-medium">Talla:</span>
          {['S','M','L','XL','XXL'].map(size => (
            <button key={size} className="border border-gray-300 px-3 py-1 rounded text-sm">{size}</button>
          ))}
        </div>
        <button className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition mb-6">
          Consulta Ahora
        </button>
        <p className="text-gray-700 text-sm">
          Presentamos el Poncho Akatsuki, una prenda exclusiva que evoca la audacia y el carisma de nuestra comunidad.
        </p>
      </div>
    </section>
  );
}