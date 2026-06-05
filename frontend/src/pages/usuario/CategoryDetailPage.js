import React from 'react';
import ValueDetailPage from './ValueDetailPage';

export default function CategoryDetailPage() {
  return (
    <ValueDetailPage
      paramName="categoria"
      filterKey="type"
      browseTitle="Categorias"
      browsePath="/categorias"
      titleFormatter={value => value}
      descriptionFormatter={(value, total) =>
        `${value} concentra ${total} productos dentro de esta categoria para navegar con un layout mas limpio.`
      }
    />
  );
}
