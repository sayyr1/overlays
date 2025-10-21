
// src/components/HomeSections/Header.js
import React from 'react';

export default function Header() {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
          <span className="ml-2 text-xl font-bold uppercase">4-18 BRAND</span>
        </div>
        <div className="hidden md:flex flex-1 mx-6">
          <input
            type="text"
            placeholder="Buscar productos..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
          />
        </div>
        <div className="flex items-center space-x-4">
          <button className="hidden md:block text-gray-700 hover:text-gray-900">Mis Pedidos</button>
          <button className="text-gray-700 hover:text-gray-900">Iniciar sesión</button>
          <button className="text-gray-700 hover:text-gray-900">Carrito (0)</button>
        </div>
      </div>
      <div className="md:hidden px-4 pb-3">
        <input
          type="text"
          placeholder="Buscar..."
          className="w-full border border-gray-300 rounded-lg px-4 py-2"
        />
      </div>
    </header>
  );
}
