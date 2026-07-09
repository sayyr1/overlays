import React from 'react';
import SectionValueGridPage from './SectionValueGridPage';
import { usePublicConfig } from '../../context/PublicConfigContext';
import { getPrimaryCatalogBrowseMeta } from '../../utils/catalogProfile';

export default function CategoriesBrowsePage() {
  const { settings } = usePublicConfig();
  const browseMeta = getPrimaryCatalogBrowseMeta(settings?.catalogProfile);

  return (
    <SectionValueGridPage
      title={browseMeta.title}
      description={browseMeta.description}
      categoryKey={browseMeta.fieldKey}
      queryKey={browseMeta.fieldKey}
      detailBasePath="/categoria"
      emptyMessage={`Aun no hay ${browseMeta.title.toLowerCase()} configurad${browseMeta.title === 'Categorias' ? 'as' : 'os'}.`}
    />
  );
}
