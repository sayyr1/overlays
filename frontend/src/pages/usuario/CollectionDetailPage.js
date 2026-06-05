import React from 'react';
import ValueDetailPage from './ValueDetailPage';

export default function CollectionDetailPage() {
  return (
    <ValueDetailPage
      paramName="collection"
      filterKey="collection"
      browseTitle="Colecciones"
      browsePath="/colecciones"
      titleFormatter={value => value}
      descriptionFormatter={(value, total) =>
        `${value} reune ${total} productos relacionados para que navegues la coleccion completa en una sola pagina.`
      }
    />
  );
}
