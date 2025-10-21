// src/pages/CategoriesPage.jsx
import React from 'react';
import CategoriesSection from '../../components/usuario/HomeSections/CategoriesSection';

export default function CategoriesPage() {
  return (
    <main className="pt-20 pb-10 min-h-screen bg-gray-50">
      {/* Aquí solo invocamos el componente que ya se encarga de fetch */}
      <CategoriesSection />
    </main>
  );
}
