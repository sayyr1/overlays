import React from 'react';
import ValueDetailPage from './ValueDetailPage';

export default function BrandDetailPage() {
  return (
    <ValueDetailPage
      paramName="brand"
      filterKey="brand"
      browseTitle="Marcas"
      browsePath="/marcas"
      titleFormatter={value => value}
      descriptionFormatter={(value, total) =>
        `${value} concentra ${total} productos dentro del catalogo para explorar desde una vista mas editorial y directa.`
      }
    />
  );
}
