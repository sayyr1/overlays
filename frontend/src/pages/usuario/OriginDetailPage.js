import React from 'react';
import ValueDetailPage from './ValueDetailPage';

export default function OriginDetailPage() {
  return (
    <ValueDetailPage
      paramName="origen"
      filterKey="origen"
      browseTitle="Origen"
      browsePath="/origen"
      titleFormatter={value => value}
      descriptionFormatter={(value, total) =>
        `${value} agrupa ${total} productos disponibles para explorar este origen con mas contexto y filtros internos.`
      }
    />
  );
}
