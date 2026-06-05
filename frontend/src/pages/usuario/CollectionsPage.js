import React from 'react';
import SectionValueGridPage from './SectionValueGridPage';

export default function CollectionsPage() {
  return (
    <SectionValueGridPage
      title="Colecciones"
      description="Descubre todas las colecciones activas y entra a cada una con una vista mas limpia."
      categoryKey="collection"
      queryKey="collection"
      detailBasePath="/colecciones"
      emptyMessage="Aun no hay colecciones configuradas."
    />
  );
}
