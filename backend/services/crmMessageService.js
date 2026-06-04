import { getCRMConfig } from './crmConfigService.js';

const replaceTokens = (template, data) =>
  String(template || '')
    .replace(/\[nombre\]/gi, data.name || 'cliente')
    .replace(/\[producto\]/gi, data.productName || 'este producto')
    .replace(/\[link\]/gi, data.link || '');

export const buildSuggestedMessage = async (type, data = {}) => {
  const config = await getCRMConfig();
  const template =
    config.suggestedMessages?.get?.(type) ||
    config.suggestedMessages?.[type] ||
    '';

  return replaceTokens(template, data).trim();
};
