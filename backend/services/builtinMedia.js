import MediaAsset from '../models/MediaAsset.js';

export const builtinMedia = [
  { _id: 'builtin-studio-frame', name: 'Studio · Frame editorial', category: 'backgrounds', kind: 'image', format: 'svg', width: 1920, height: 1080, secureUrl: '/media/studio-frame.svg', builtin: true },
  { _id: 'builtin-studio-lower', name: 'Studio · Lower third', category: 'images', kind: 'image', format: 'svg', width: 1100, height: 180, secureUrl: '/media/studio-lower-third.svg', builtin: true },
];
export const findMedia = async id => builtinMedia.find(asset => asset._id === id) || (/^[a-f\d]{24}$/i.test(String(id || '')) ? MediaAsset.findById(id).lean() : null);
