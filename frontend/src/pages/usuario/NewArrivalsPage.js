import React from 'react';
import SectionProductsPage from './SectionProductsPage';

export default function NewArrivalsPage() {
  return (
    <SectionProductsPage
      title="Nuevos"
      description="Los ingresos mas recientes del catalogo, ordenados para que encuentres primero lo ultimo."
      mode="new"
    />
  );
}
