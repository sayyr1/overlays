// src/components/HomeSections/Footer.js
import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-8 mt-auto">
      <div className="container mx-auto px-4 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <img src="/logo-footer.png" alt="Logo Footer" className="h-8 mb-4" />
          <p className="text-sm">
            Copyright {new Date().getFullYear()} 4-18 BRAND. Todos los derechos reservados.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-2">Enlaces</h4>
          <ul className="space-y-1 text-sm">
            <li>
              <a href="#">Inicio</a>
            </li>
            <li>
              <a href="#">Tienda</a>
            </li>
            <li>
              <a href="#">Contacto</a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-2">Siguenos</h4>
          <div className="flex space-x-4">{/* Iconos sociales aqui */}</div>
        </div>
      </div>
    </footer>
  );
}
