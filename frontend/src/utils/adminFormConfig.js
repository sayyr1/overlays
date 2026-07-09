export const sortConfigFields = fields =>
  [...(Array.isArray(fields) ? fields : [])].sort(
    (left, right) => (left.order ?? 0) - (right.order ?? 0)
  );

export const buildConfigFieldMap = fields =>
  sortConfigFields(fields).reduce((acc, field) => {
    if (field?.name) {
      acc[field.name] = field;
    }
    return acc;
  }, {});

export const getOrderedAdminBlocks = (fields, blockMap) => {
  const orderedFields = sortConfigFields(fields);
  const included = new Set();
  const result = [];

  orderedFields.forEach(field => {
    if (!field?.name || field.enabled === false || !blockMap[field.name]) {
      return;
    }
    result.push(field.name);
    included.add(field.name);
  });

  Object.keys(blockMap).forEach(key => {
    if (!included.has(key)) {
      result.push(key);
    }
  });

  return result;
};

export const isAdminConfigEnabled = (fieldMap, key) =>
  fieldMap[key] ? fieldMap[key].enabled !== false : true;
