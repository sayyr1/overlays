import React from 'react';
import SectionValueGridPage from './SectionValueGridPage';

export default function BrandsPage() {
  return (
    <SectionValueGridPage
      title="Marcas"
      description="Explora todas las marcas disponibles y ve sus productos desde una sola vista."
      categoryKey="brand"
      queryKey="brand"
      detailBasePath="/marcas"
      emptyMessage="Aun no hay marcas configuradas."
    />
  );
}
