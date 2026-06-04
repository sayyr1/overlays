export const normalizeLeadCode = value =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');

const randomChunk = () => Math.random().toString(36).slice(2, 6).toUpperCase();

export const generateLeadCode = (prefix = 'NW') => {
  const timeChunk = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${timeChunk}${randomChunk()}`;
};
