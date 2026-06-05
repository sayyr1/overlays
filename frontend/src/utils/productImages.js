export const getImageKey = image =>
  image?.clientId || image?.public_id || image?.url || '';

export const normalizeImageVisibility = (image, enabled = false) =>
  enabled && image?.visibility === 'internal' ? 'internal' : 'public';

export const isPublicImage = (image, enabled = false) =>
  normalizeImageVisibility(image, enabled) === 'public';

const moveItem = (items, fromIndex, toIndex) => {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

export const updateImageVisibility = (images, imageKey, nextVisibility, enabled = false) =>
  images.map(image =>
    getImageKey(image) === imageKey
      ? {
          ...image,
          visibility: enabled && nextVisibility === 'internal' ? 'internal' : 'public'
        }
      : image
  );

export const sortImagesForPayload = (images, enabled = false) => {
  const normalized = (Array.isArray(images) ? images : []).map(image => ({
    ...image,
    visibility: normalizeImageVisibility(image, enabled)
  }));

  if (!enabled) {
    return normalized.map(image => ({ ...image, visibility: 'public' }));
  }

  const publicImages = normalized.filter(image => image.visibility !== 'internal');
  const internalImages = normalized.filter(image => image.visibility === 'internal');
  return [...publicImages, ...internalImages];
};

export const reorderImagesWithinVisibility = (
  images,
  { draggedKey, targetKey, visibility = 'public', enabled = false }
) => {
  if (!draggedKey || !targetKey || draggedKey === targetKey) {
    return images;
  }

  const visibilityKey = enabled && visibility === 'internal' ? 'internal' : 'public';
  const scoped = images.filter(image => normalizeImageVisibility(image, enabled) === visibilityKey);
  const sourceIndex = scoped.findIndex(image => getImageKey(image) === draggedKey);
  const targetIndex = scoped.findIndex(image => getImageKey(image) === targetKey);

  if (sourceIndex === -1 || targetIndex === -1) {
    return images;
  }

  const reorderedScoped = moveItem(scoped, sourceIndex, targetIndex);
  let scopedCursor = 0;

  return images.map(image => {
    if (normalizeImageVisibility(image, enabled) !== visibilityKey) {
      return image;
    }
    const nextImage = reorderedScoped[scopedCursor];
    scopedCursor += 1;
    return nextImage;
  });
};

export const makeImageCover = (images, imageKey, enabled = false) => {
  const publicImages = images.filter(image => isPublicImage(image, enabled));
  const sourceIndex = publicImages.findIndex(image => getImageKey(image) === imageKey);

  if (sourceIndex <= 0) {
    return images;
  }

  const reorderedPublicImages = moveItem(publicImages, sourceIndex, 0);
  let publicCursor = 0;

  return images.map(image => {
    if (!isPublicImage(image, enabled)) {
      return image;
    }
    const nextImage = reorderedPublicImages[publicCursor];
    publicCursor += 1;
    return nextImage;
  });
};

export const isImageCover = (images, imageKey, enabled = false) => {
  const firstPublicImage = images.find(image => isPublicImage(image, enabled));
  return getImageKey(firstPublicImage) === imageKey;
};
