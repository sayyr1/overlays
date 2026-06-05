import React from 'react';
import SectionValueGridPage from './SectionValueGridPage';

export default function OrigenListPage() {
  return (
    <SectionValueGridPage
      title="Origen"
      description="Explora todos los origenes disponibles y entra a cada grupo con su propia vista."
      categoryKey="origen"
      queryKey="origen"
      detailBasePath="/origen"
      emptyMessage="Aun no hay origenes configurados."
    />
  );
}
