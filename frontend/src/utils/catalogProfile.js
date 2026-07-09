const normalizeCatalogValue = value => String(value || '').trim();

export const getPrimaryCatalogBrowseMeta = profileKey => {
  if (profileKey === 'footwear') {
    return {
      title: 'Modelos',
      singular: 'modelo',
      navLabel: 'Modelos',
      description: 'Explora los modelos disponibles y entra rapido a cada linea del catalogo.',
      fieldKey: 'model',
      fallbackFieldKeys: ['model', 'type'],
      filterLabel: 'Modelo'
    };
  }

  return {
    title: 'Categorias',
    singular: 'categoria',
    navLabel: 'Categorias',
    description: 'Explora todas las categorias disponibles y entra rapido a cada grupo del catalogo.',
    fieldKey: 'type',
    fallbackFieldKeys: ['type'],
    filterLabel: 'Categoria'
  };
};

export const getPrimaryCatalogValue = (product, profileKey) => {
  const source = product && typeof product === 'object' ? product : {};
  const { fieldKey, fallbackFieldKeys = [] } = getPrimaryCatalogBrowseMeta(profileKey);

  for (const key of [fieldKey, ...fallbackFieldKeys].filter(Boolean)) {
    const value = normalizeCatalogValue(source?.[key]);
    if (value) {
      return value;
    }
  }

  return '';
};
