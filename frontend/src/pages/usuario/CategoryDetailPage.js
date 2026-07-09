import React from 'react';
import ValueDetailPage from './ValueDetailPage';
import { usePublicConfig } from '../../context/PublicConfigContext';
import { getPrimaryCatalogBrowseMeta } from '../../utils/catalogProfile';

export default function CategoryDetailPage() {
  const { settings } = usePublicConfig();
  const browseMeta = getPrimaryCatalogBrowseMeta(settings?.catalogProfile);

  return (
    <ValueDetailPage
      paramName="categoria"
      filterKey={browseMeta.fieldKey}
      browseTitle={browseMeta.title}
      browsePath="/categorias"
      titleFormatter={value => value}
      descriptionFormatter={(value, total) =>
        `${value} concentra ${total} productos dentro de este ${browseMeta.singular} para navegar con un layout mas limpio.`
      }
    />
  );
}
