import React from 'react';
import SectionValueGridPage from './SectionValueGridPage';

export default function CategoriesBrowsePage() {
  return (
    <SectionValueGridPage
      title="Categorias"
      description="Explora todas las categorias disponibles y entra rapido a cada grupo del catalogo."
      categoryKey="type"
      queryKey="type"
      detailBasePath="/categoria"
      emptyMessage="Aun no hay categorias configuradas."
    />
  );
}
