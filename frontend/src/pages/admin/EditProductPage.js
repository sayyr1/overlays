import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from '../../api/axiosInstance';
import imageCompression from 'browser-image-compression';
import BrandModelInput from '../../components/admin/BrandModelInput';
import ProductImage from '../../components/usuario/ProductImage';
import { usePublicConfig } from '../../context/PublicConfigContext';
import { useAuth } from '../../context/AuthContext';
import {
  DEFAULT_COLOR_LABEL,
  flattenNestedVariants,
  normalizeVariantColor,
  normalizeVariantSize,
  aggregateSizesFromVariants,
  buildNestedVariantsWithFallback
} from '../../utils/inventory';
import {
  getImageKey,
  isImageCover,
  makeImageCover,
  reorderImagesWithinVisibility,
  sortImagesForPayload,
  updateImageVisibility
} from '../../utils/productImages';
import {
  buildConfigFieldMap,
  isAdminConfigEnabled
} from '../../utils/adminFormConfig';

const createEmptyPrice = () => ({
  retail: '',
  gold: '',
  premium: '',
  platinum: ''
});

const DEFAULT_GENDERS = ['Unisex', 'Hombre', 'Mujer', 'Nino', 'Nina'];
const normalizeCategoryPayload = payload => {
  const normalized = {};
  if (payload && typeof payload === 'object') {
    Object.entries(payload).forEach(([key, values]) => {
      normalized[key] = Array.isArray(values) ? values : [];
    });
  }
  return normalized;
};
const normalizeEntry = value => String(value || '').trim();

const EditProductPage = () => {
  const { isModuleEnabled, settings } = usePublicConfig();
  const { hasPermission } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const inventoryEnabled = isModuleEnabled('inventory');
  const membershipsEnabled = isModuleEnabled('memberships');
  const canUploadImages = hasPermission('products.upload');
  const canSeeInventory = hasPermission('inventory.view') || hasPermission('inventory.adjust');
  const canEditImages = hasPermission('products.edit');
  const canManageCategories = hasPermission('categories.manage');
  const canEditProducts = hasPermission('products.edit');
  const canCreateModelInline = canManageCategories || canEditProducts;
  const imageVisibilityEnabled = Boolean(settings?.enableInternalProductImages);
  const modelFieldLabel = settings?.catalogProfile === 'apparel' ? 'Referencia / modelo' : 'Modelo';
  const priceLevels = membershipsEnabled
    ? ['retail', 'gold', 'premium', 'platinum']
    : ['retail'];

  const [form, setForm] = useState({
    name: '',
    price: createEmptyPrice(),
    description: '',
    brand: '',
    model: '',
    collection: '',
    gender: 'Unisex',
    attributes: {},
    onSale: false
  });
  const [categories, setCategories] = useState({});
  const [brandModels, setBrandModels] = useState({});
  const [variantState, setVariantState] = useState({});
  const [activeColor, setActiveColor] = useState('');
  const [colorToAdd, setColorToAdd] = useState('');
  const [existingImages, setExistingImages] = useState([]);
  const [pendingImages, setPendingImages] = useState([]);
  const [uploadVisibility, setUploadVisibility] = useState('internal');
  const [coverImageKey, setCoverImageKey] = useState('');
  const [draggedExistingImageKey, setDraggedExistingImageKey] = useState('');
  const [draggedPendingImageKey, setDraggedPendingImageKey] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [creatingModel, setCreatingModel] = useState(false);
  const [adminFormConfig, setAdminFormConfig] = useState(null);
  const [originalInventory, setOriginalInventory] = useState({
    stockByColorSize: {},
    stockBySize: {},
    colors: []
  });
  const availableModels = useMemo(() => {
    if (!form.brand) {
      return [];
    }
    return Array.isArray(brandModels[form.brand]) ? brandModels[form.brand] : [];
  }, [brandModels, form.brand]);

  const categoryGenderOptions = useMemo(
    () =>
      Array.isArray(categories.gender)
        ? Array.from(new Set(categories.gender.filter(Boolean)))
        : [],
    [categories.gender]
  );

  const genderOptions = useMemo(() => {
    const base = categoryGenderOptions.length ? categoryGenderOptions : DEFAULT_GENDERS;
    if (form.gender && !base.includes(form.gender)) {
      return [...base, form.gender];
    }
    return base;
  }, [categoryGenderOptions, form.gender]);

  const PROTECTED_CATEGORY_KEYS = useMemo(
    () => new Set(['brand', 'type', 'size', 'collection', 'gender', 'color']),
    []
  );

  const dynamicAttributeKeys = useMemo(() => {
    const keys = Object.keys(categories || {});
    return keys.filter(k => !PROTECTED_CATEGORY_KEYS.has(k));
  }, [categories, PROTECTED_CATEGORY_KEYS]);

  useEffect(() => {
    if (!id) return;
    const loadData = async () => {
      try {
        const [{ data: catPayload }, { data: brandModelMap }, { data: product }] = await Promise.all([
          axios.get('/api/categories'),
          axios.get('/api/categories/brand-models'),
          axios.get(`/api/products/${id}`)
        ]);

        setCategories(normalizeCategoryPayload(catPayload));
        setBrandModels(brandModelMap || {});

        setCode(product.code);
        // Normaliza claves de atributos del producto para que coincidan con las claves de categorías (insensible a mayúsculas/minúsculas)
        const categoriesKeyMap = Object.keys(catPayload || {}).reduce((acc, key) => {
          acc[key.toLowerCase()] = key;
          return acc;
        }, {});

        const normalizedAttributes = Object.entries(product.attributes || {}).reduce(
          (acc, [rawKey, val]) => {
            const matchKey = categoriesKeyMap[rawKey?.toLowerCase?.()] || rawKey;
            acc[matchKey] = val;
            return acc;
          },
          {}
        );

        setForm({
          name: product.name ?? '',
          price: {
            retail: product.price?.retail?.toString() ?? '',
            gold: product.price?.gold?.toString() ?? '',
            premium: product.price?.premium?.toString() ?? '',
            platinum: product.price?.platinum?.toString() ?? ''
          },
          description: product.description ?? '',
          brand: product.brand ?? '',
          model: product.model ?? product.type ?? '',
          collection: product.collection ?? '',
          gender: product.gender ?? 'Unisex',
          attributes: normalizedAttributes,
          onSale: Boolean(product.onSale)
        });

        const nested = buildNestedVariantsWithFallback(
          product.stockByColorSize,
          product.stockBySize
        );
        const state = {};
        const colorKeys = new Set(
          [
            ...Object.keys(nested),
            ...(Array.isArray(product.colors) ? product.colors : [])
          ].map(normalizeVariantColor)
        );

        colorKeys.forEach(color => {
          const sizes = nested[color] || {};
          state[color] = {
            sizes: Object.fromEntries(
              Object.entries(sizes).map(([size, qty]) => [
                normalizeVariantSize(size),
                qty?.toString?.() ?? ''
              ])
            )
          };
        });

        setVariantState(state);
        setActiveColor(Array.from(colorKeys)[0] || '');
        setExistingImages([
          ...((product.images || []).map(image => ({
            ...image,
            visibility: image.visibility || 'public'
          }))),
          ...((product.internalImages || []).map(image => ({
            ...image,
            visibility: image.visibility || 'internal'
          })))
        ]);
        setOriginalInventory({
          stockByColorSize: product.stockByColorSize || {},
          stockBySize: product.stockBySize || {},
          colors: Array.isArray(product.colors) ? product.colors : []
        });
      } catch (error) {
        console.error('Error al cargar producto', error);
        window.alert('No fue posible cargar la informacion del producto.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  useEffect(() => {
    const base = categoryGenderOptions.length ? categoryGenderOptions : DEFAULT_GENDERS;
    setForm(prev => {
      if (!prev.gender || !base.includes(prev.gender)) {
        return { ...prev, gender: base[0] };
      }
      return prev;
    });
  }, [categoryGenderOptions]);

  useEffect(() => {
    if (!form.brand) {
      setForm(prev => (prev.model ? { ...prev, model: '' } : prev));
      return;
    }

    if (!availableModels.length) {
      return;
    }

    setForm(prev => (
      prev.model && availableModels.includes(prev.model)
        ? prev
        : { ...prev, model: '' }
    ));
  }, [availableModels, form.brand]);

  useEffect(
    () => () => {
      pendingImages.forEach(item => URL.revokeObjectURL(item.previewUrl));
    },
    [pendingImages]
  );

  useEffect(() => {
    let cancelled = false;

    const loadAdminConfig = async () => {
      try {
        const { data } = await axios.get('/api/admin-config/forms/admin_product_edit', {
          withCredentials: true
        });

        if (!cancelled) {
          setAdminFormConfig(data || null);
        }
      } catch {
        if (!cancelled) {
          setAdminFormConfig(null);
        }
      }
    };

    loadAdminConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedColors = useMemo(() => Object.keys(variantState), [variantState]);

  const colorOptions = useMemo(() => {
    const map = new Map();
    (categories.color || []).forEach(color => {
      const normalized = normalizeVariantColor(color);
      if (!map.has(normalized)) {
        map.set(normalized, color);
      }
    });
    selectedColors.forEach(color => {
      if (!map.has(color)) {
        map.set(color, color);
      }
    });
    if (!map.size) {
      map.set(DEFAULT_COLOR_LABEL, DEFAULT_COLOR_LABEL);
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [categories.color, selectedColors]);

  const colorLabelMap = useMemo(() => {
    const entries = {};
    colorOptions.forEach(({ value, label }) => {
      entries[value] = label;
    });
    return entries;
  }, [colorOptions]);

  const colorsAvailableToAdd = useMemo(
    () => colorOptions.filter(option => !variantState[option.value]),
    [colorOptions, variantState]
  );

  useEffect(() => {
    if (!colorsAvailableToAdd.length) {
      setColorToAdd('');
      return;
    }
    if (!colorToAdd || !colorsAvailableToAdd.some(option => option.value === colorToAdd)) {
      setColorToAdd(colorsAvailableToAdd[0].value);
    }
  }, [colorsAvailableToAdd, colorToAdd]);

  useEffect(() => {
    const colors = Object.keys(variantState);
    if (!colors.length) {
      setActiveColor('');
      return;
    }
    if (!colors.includes(activeColor)) {
      setActiveColor(colors[0]);
    }
  }, [variantState, activeColor]);

  const sizeOptions = useMemo(() => {
    const map = new Map();
    (categories.size || []).forEach(size => {
      const normalized = normalizeVariantSize(size);
      if (!normalized) return;
      if (!map.has(normalized)) {
        map.set(normalized, size);
      }
    });
    Object.values(variantState).forEach(entry => {
      Object.keys(entry?.sizes || {}).forEach(size => {
        const normalized = normalizeVariantSize(size);
        if (!map.has(normalized)) {
          map.set(normalized, normalized);
        }
      });
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [categories.size, variantState]);

  const totalsByColor = useMemo(() => {
    const totals = {};
    Object.entries(variantState).forEach(([color, data]) => {
      const total = Object.values(data.sizes || {}).reduce(
        (acc, qty) => acc + Number(qty || 0),
        0
      );
      totals[color] = total;
    });
    return totals;
  }, [variantState]);

  const totalUnits = useMemo(
    () => Object.values(totalsByColor).reduce((acc, value) => acc + Number(value || 0), 0),
    [totalsByColor]
  );

  const handleFieldChange = event => {
    const { name, value, type, checked } = event.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePriceChange = event => {
    const { name, value } = event.target;
    setForm(prev => ({
      ...prev,
      price: {
        ...prev.price,
        [name]: value
      }
    }));
  };

  const handleCreateModel = async modelName => {
    const brand = normalizeEntry(form.brand);
    const model = normalizeEntry(modelName);

    if (!brand || !model) {
      return '';
    }

    setCreatingModel(true);
    try {
      const { data } = await axios.post('/api/categories/brand-models', { brand, model });
      setBrandModels(data || {});
      setForm(prev => ({ ...prev, model }));
      return model;
    } catch (error) {
      window.alert(error.response?.data?.message || 'No se pudo crear el modelo.');
      return '';
    } finally {
      setCreatingModel(false);
    }
  };

  const handleAddColor = () => {
    if (!colorToAdd) return;
    const normalized = normalizeVariantColor(colorToAdd);
    setVariantState(prev => {
      if (prev[normalized]) return prev;
      return {
        ...prev,
        [normalized]: { sizes: {} }
      };
    });
    setActiveColor(normalized);
  };

  const handleRemoveColor = color => {
    const normalized = normalizeVariantColor(color);
    setVariantState(prev => {
      if (!prev[normalized]) return prev;
      const next = { ...prev };
      delete next[normalized];
      return next;
    });
  };

  const setSizeSelection = (color, size, enabled) => {
    const normalizedColor = normalizeVariantColor(color);
    const normalizedSize = normalizeVariantSize(size);
    setVariantState(prev => {
      const next = { ...prev };
      const entry = next[normalizedColor] || { sizes: {} };
      const sizes = { ...entry.sizes };
      if (enabled) {
        if (!sizes[normalizedSize]) {
          sizes[normalizedSize] = '0';
        }
      } else {
        delete sizes[normalizedSize];
      }
      next[normalizedColor] = { sizes };
      return next;
    });
  };

  const handleVariantQuantityChange = (color, size, rawValue) => {
    const normalizedColor = normalizeVariantColor(color);
    const normalizedSize = normalizeVariantSize(size);
    const digitsOnly = rawValue.replace(/[^\d]/g, '');
    setVariantState(prev => {
      const next = { ...prev };
      const entry = next[normalizedColor] || { sizes: {} };
      next[normalizedColor] = {
        sizes: {
          ...entry.sizes,
          [normalizedSize]: digitsOnly
        }
      };
      return next;
    });
  };

  const handleNewImages = event => {
    const selected = event.target.files ? Array.from(event.target.files) : [];
    if (!selected.length) {
      return;
    }
    setPendingImages(prev => [
      ...prev,
      ...selected.map(file => ({
        clientId: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        visibility: imageVisibilityEnabled ? uploadVisibility : 'public'
      }))
    ]);
    event.target.value = '';
  };

  const handleAttributeChange = (key, value) => {
    setForm(prev => ({
      ...prev,
      attributes: {
        ...(prev.attributes || {}),
        [key]: value
      }
    }));
  };

  const removePreviewImage = imageKey => {
    setPendingImages(prev => {
      const target = prev.find(item => getImageKey(item) === imageKey);
      if (target && getImageKey(target) === coverImageKey) {
        setCoverImageKey('');
      }
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter(item => getImageKey(item) !== imageKey);
    });
  };

  const removeExistingImage = async publicId => {
    try {
      await axios.delete(`/api/products/${id}/image/${publicId}`, { withCredentials: true });
      if (coverImageKey === publicId) {
        setCoverImageKey('');
      }
      setExistingImages(prev => prev.filter(img => img.public_id !== publicId));
    } catch (error) {
      console.error('Error al eliminar imagen', error);
      window.alert('No se pudo eliminar la imagen.');
    }
  };

  const normalizedPrice = useMemo(() => {
    const retail = Number(form.price.retail || 0);
    return {
      retail,
      gold: Number(form.price.gold || retail),
      premium: Number(form.price.premium || retail),
      platinum: Number(form.price.platinum || retail)
    };
  }, [form.price]);

  const uploadNewImages = async imageItems => {
    if (!imageItems.length) return [];
    const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true };
    const formData = new FormData();
    const normalizedItems = [];
    for (const item of imageItems) {
      try {
        const compressed = await imageCompression(item.file, options);
        formData.append('images', compressed);
        normalizedItems.push(item);
      } catch (error) {
        console.error('Error al comprimir imagen', error);
      }
    }
    if (!normalizedItems.length) return [];
    try {
      const response = await axios.post('/api/products/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const uploaded = Array.isArray(response.data?.images) ? response.data.images : [];
      return uploaded.map((image, index) => ({
        ...image,
        clientId: normalizedItems[index]?.clientId || image.public_id,
        visibility: normalizedItems[index]?.visibility || 'public'
      }));
    } catch (error) {
      console.error('Error al subir imagenes', error);
      return [];
    }
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (submitting) return;

    if (Object.values(normalizedPrice).some(value => Number.isNaN(value) || value < 0)) {
      window.alert('Verifica que los precios sean numeros validos (>= 0).');
      return;
    }

    const sanitizedByColor = {};
    Object.entries(variantState).forEach(([color, data]) => {
      const normalizedColor = normalizeVariantColor(color);
      const sizes = data?.sizes || {};
      const sanitizedSizes = {};
      Object.entries(sizes).forEach(([size, qty]) => {
        const normalizedSize = normalizeVariantSize(size);
        const numeric = Number(qty);
        if (!Number.isFinite(numeric) || numeric <= 0) return;
        sanitizedSizes[normalizedSize] = numeric;
      });
      if (Object.keys(sanitizedSizes).length) {
        sanitizedByColor[normalizedColor] = sanitizedSizes;
      }
    });

    if (inventoryEnabled && canSeeInventory && !Object.keys(sanitizedByColor).length) {
      window.alert('Define al menos una combinacion color/talla con stock.');
      return;
    }

    setSubmitting(true);

    try {
      const flatVariants = inventoryEnabled && canSeeInventory
        ? flattenNestedVariants(sanitizedByColor)
        : originalInventory.stockByColorSize;
      const stockBySize = inventoryEnabled && canSeeInventory
        ? aggregateSizesFromVariants(flatVariants)
        : originalInventory.stockBySize;
      const productColors = inventoryEnabled && canSeeInventory
        ? Object.keys(sanitizedByColor)
        : originalInventory.colors;
      const orderedPendingImages = sortImagesForPayload(pendingImages, imageVisibilityEnabled);
      const uploadedImages = canUploadImages ? await uploadNewImages(orderedPendingImages) : [];
      let images = sortImagesForPayload([...existingImages, ...uploadedImages], imageVisibilityEnabled);


      if (coverImageKey) {
        images = makeImageCover(images, coverImageKey, imageVisibilityEnabled);
      }

      const attributes = {};
      dynamicAttributeKeys.forEach(k => {
        const v = form.attributes?.[k];
        if (v) attributes[k] = v;
      });

      const payload = {
        name: form.name,
        code,
        price: normalizedPrice,
        description: form.description,
        brand: form.brand,
        model: form.model,
        type: '',
        collection: form.collection,
        gender: form.gender,
        attributes,
        onSale: form.onSale,
        stockByColorSize: flatVariants,
        stockBySize,
        colors: productColors,
        images
      };

      await axios.put(`/api/products/${id}`, payload, { withCredentials: true });
      window.alert('Producto actualizado correctamente');
      setPendingImages(prev => {
        prev.forEach(item => URL.revokeObjectURL(item.previewUrl));
        return [];
      });
      setDraggedExistingImageKey('');
      setDraggedPendingImageKey('');
      setCoverImageKey('');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error al actualizar producto', error);
      window.alert(error.response?.data?.message || 'No se pudo actualizar el producto');
    } finally {
      setSubmitting(false);
    }
  };

  const adminFieldMap = useMemo(
    () => buildConfigFieldMap(adminFormConfig?.fields),
    [adminFormConfig?.fields]
  );

  const blockStyle = key => ({
    order: adminFieldMap[key]?.order ?? 0
  });

  const editIdentityKeys = ['name', 'code', 'brand', 'model', 'collection', 'gender'];
  const showEditIdentity = editIdentityKeys.some(key => isAdminConfigEnabled(adminFieldMap, key));
  const fieldStyle = key => ({
    order: adminFieldMap[key]?.order ?? 0
  });

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-6 text-center text-gray-500">Cargando...</div>;
  }

  const publicExistingImages = existingImages.filter(image => image.visibility !== 'internal');
  const internalExistingImages = existingImages.filter(image => image.visibility === 'internal');
  const publicPendingImages = pendingImages.filter(image => image.visibility !== 'internal');
  const internalPendingImages = pendingImages.filter(image => image.visibility === 'internal');
  const selectedSizeCount = Object.values(variantState).reduce(
    (acc, entry) => acc + Object.keys(entry?.sizes || {}).length,
    0
  );

  const handleExistingVisibilityChange = (imageKey, nextVisibility) => {
    setExistingImages(prev => updateImageVisibility(prev, imageKey, nextVisibility, imageVisibilityEnabled));
    if (nextVisibility === 'internal' && coverImageKey === imageKey) {
      setCoverImageKey('');
    }
  };

  const handlePendingVisibilityChange = (imageKey, nextVisibility) => {
    setPendingImages(prev => updateImageVisibility(prev, imageKey, nextVisibility, imageVisibilityEnabled));
    if (nextVisibility === 'internal' && coverImageKey === imageKey) {
      setCoverImageKey('');
    }
  };

  const handleSetCoverImage = imageKey => {
    if (existingImages.some(image => getImageKey(image) === imageKey)) {
      setExistingImages(prev => makeImageCover(prev, imageKey, imageVisibilityEnabled));
    }
    if (pendingImages.some(image => getImageKey(image) === imageKey)) {
      setPendingImages(prev => makeImageCover(prev, imageKey, imageVisibilityEnabled));
    }
    setCoverImageKey(imageKey);
  };

  const handleExistingDrop = (targetKey, visibility) => {
    if (!draggedExistingImageKey) return;
    setExistingImages(prev =>
      reorderImagesWithinVisibility(prev, {
        draggedKey: draggedExistingImageKey,
        targetKey,
        visibility,
        enabled: imageVisibilityEnabled
      })
    );
    setDraggedExistingImageKey('');
  };

  const handlePendingDrop = (targetKey, visibility) => {
    if (!draggedPendingImageKey) return;
    setPendingImages(prev =>
      reorderImagesWithinVisibility(prev, {
        draggedKey: draggedPendingImageKey,
        targetKey,
        visibility,
        enabled: imageVisibilityEnabled
      })
    );
    setDraggedPendingImageKey('');
  };

  const renderEditableImageSection = ({
    title,
    images,
    visibility,
    kind
  }) => (
    <div className="space-y-3">
      {imageVisibilityEnabled && (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          {title}
        </p>
      )}
      <div className="flex flex-wrap gap-4">
        {images.map((image, index) => {
          const imageKey = getImageKey(image);
          const cover = coverImageKey
            ? coverImageKey === imageKey
            : isImageCover(existingImages, imageKey, imageVisibilityEnabled);

          return (
            <div
              key={imageKey}
              draggable
              onDragStart={() =>
                kind === 'existing'
                  ? setDraggedExistingImageKey(imageKey)
                  : setDraggedPendingImageKey(imageKey)
              }
              onDragOver={event => event.preventDefault()}
              onDrop={() =>
                kind === 'existing'
                  ? handleExistingDrop(imageKey, visibility)
                  : handlePendingDrop(imageKey, visibility)
              }
              className="relative w-28 rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
            >
              <ProductImage
                src={image.previewUrl || image.url}
                alt={image.public_id || `preview-${index}`}
                className="h-24 w-full rounded-md object-cover"
              />
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="cursor-move text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Arrastrar
                  </span>
                  {cover && visibility === 'public' && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      {coverImageKey === imageKey ? 'Portada al guardar' : 'Portada'}
                    </span>
                  )}
                </div>
                {imageVisibilityEnabled && (
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { value: 'public', label: 'Tienda' },
                      { value: 'internal', label: 'Interna' }
                    ].map(option => {
                      const isActive = image.visibility === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            kind === 'existing'
                              ? handleExistingVisibilityChange(imageKey, option.value)
                              : handlePendingVisibilityChange(imageKey, option.value)
                          }
                          className={`rounded-md border px-2 py-1.5 text-[11px] font-semibold transition ${
                            isActive
                              ? 'border-brand/40 bg-brand/10 text-brand'
                              : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                {visibility === 'public' && !cover && (
                  <button
                    type="button"
                    onClick={() => handleSetCoverImage(imageKey)}
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    Usar como portada
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  kind === 'existing'
                    ? removeExistingImage(image.public_id)
                    : removePreviewImage(imageKey)
                }
                disabled={kind === 'existing' && !canEditImages}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
                aria-label="Eliminar imagen"
              >
                x
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderAccordionSection = ({ id, title, description, summary, children, style }) => {
    const isOpen = openSection === id;

    return (
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm" style={style}>
        <button
          type="button"
          onClick={() => setOpenSection(prev => (prev === id ? '' : id))}
          className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left"
        >
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
            {description ? (
              <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {summary ? (
              <span className="hidden max-w-[180px] truncate rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 sm:inline-flex">
                {summary}
              </span>
            ) : null}
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-sm font-semibold text-slate-500">
              {isOpen ? '-' : '+'}
            </span>
          </div>
        </button>

        {isOpen ? <div className="border-t border-gray-100 px-4 py-4">{children}</div> : null}
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-28 md:p-6 md:pb-6">
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-5 shadow md:p-8">
        <h2 className="mb-6 text-2xl font-semibold text-gray-800">Editar producto</h2>
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-800">{form.name || 'Producto sin nombre'}</p>
              <p className="mt-1 text-xs text-slate-500">
                {code || 'Sin codigo'} · {selectedColors.length} colores · {totalUnits} unidades
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
              {existingImages.length + pendingImages.length} imagenes
            </span>
          </div>
        </div>
        <form id="edit-product-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {showEditIdentity && (
          <div className="grid gap-4 md:grid-cols-2" style={blockStyle('identity')}>
            {isAdminConfigEnabled(adminFieldMap, 'name') && (
            <label className="text-sm font-medium text-gray-700" style={fieldStyle('name')}>
              Nombre
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleFieldChange}
                required
                className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
              />
            </label>
            )}
            {isAdminConfigEnabled(adminFieldMap, 'code') && (
            <label className="text-sm font-medium text-gray-700" style={fieldStyle('code')}>
              Codigo
              <input
                type="text"
                value={code}
                disabled
                className="mt-1 w-full rounded-md border border-gray-200 bg-gray-100 p-3 text-gray-500"
              />
            </label>
            )}
          </div>
          )}

          {isAdminConfigEnabled(adminFieldMap, 'pricing') && (
          <fieldset className="rounded-lg border border-gray-200 p-4" style={blockStyle('pricing')}>
            <legend className="px-2 text-sm font-semibold text-gray-700">Precios</legend>
            <div className="grid gap-4 md:grid-cols-2">
              {priceLevels.map(level => (
                <label key={level} className="text-sm font-medium text-gray-700">
                  {level === 'retail'
                    ? 'Precio Retail'
                    : `Precio ${level.charAt(0).toUpperCase()}${level.slice(1)}`}
                  <input
                    type="number"
                    name={level}
                    min="0"
                    step="0.01"
                    value={form.price[level]}
                    onChange={handlePriceChange}
                    required={level === 'retail'}
                    className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                  />
                </label>
              ))}
            </div>
            {membershipsEnabled ? (
              <p className="mt-2 text-xs text-gray-500">
                Si dejas vacio Gold/Premium/Platinum se usara el precio retail.
              </p>
            ) : (
              <p className="mt-2 text-xs text-gray-500">
                Membresias desactivadas. Solo se usa el precio retail en este producto.
              </p>
            )}
          </fieldset>
          )}

          {showEditIdentity && (
          <div className="grid gap-4 md:grid-cols-3" style={blockStyle('identity')}>
            {isAdminConfigEnabled(adminFieldMap, 'brand') && (
            <label className="text-sm font-medium text-gray-700" style={fieldStyle('brand')}>
              Marca
              <select
                name="brand"
                value={form.brand}
                onChange={handleFieldChange}
                className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Selecciona una marca</option>
                {(categories.brand || []).map(brand => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </label>
            )}
            {isAdminConfigEnabled(adminFieldMap, 'model') && (
            <BrandModelInput
              brand={form.brand}
              value={form.model}
              options={availableModels}
              onChange={nextValue =>
                setForm(prev => ({
                  ...prev,
                  model: nextValue
                }))
              }
              onCreate={handleCreateModel}
              canCreate={canCreateModelInline}
              creating={creatingModel}
              label={modelFieldLabel}
              style={fieldStyle('model')}
            />
            )}
            {isAdminConfigEnabled(adminFieldMap, 'collection') && (
            <label className="text-sm font-medium text-gray-700" style={fieldStyle('collection')}>
              Coleccion
              <select
                name="collection"
                value={form.collection}
                onChange={handleFieldChange}
                className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Selecciona una coleccion</option>
                {(categories.collection || []).map(collection => (
                  <option key={collection} value={collection}>
                    {collection}
                  </option>
                ))}
              </select>
            </label>
            )}
          </div>
          )}

          {isAdminConfigEnabled(adminFieldMap, 'gender') && (
          <label className="text-sm font-medium text-gray-700" style={fieldStyle('gender')}>
            Genero
            <select
              name="gender"
              value={form.gender}
              onChange={handleFieldChange}
              className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
            >
              {genderOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          )}

          {isAdminConfigEnabled(adminFieldMap, 'dynamic_attributes') && dynamicAttributeKeys.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3" style={blockStyle('dynamic_attributes')}>
              {dynamicAttributeKeys.map(key => {
                const selectedVal = form.attributes?.[key] || '';
                const values = Array.from(
                  new Set([
                    ...((categories[key] || []).filter(Boolean)),
                    ...(selectedVal ? [selectedVal] : [])
                  ])
                );
                return (
                  <label key={key} className="text-sm font-medium text-gray-700">
                    {key}
                    <select
                      value={selectedVal}
                      onChange={e => handleAttributeChange(key, e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Selecciona una opcion</option>
                      {values.map(val => (
                        <option key={val} value={val}>
                          {val}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          )}

          {isAdminConfigEnabled(adminFieldMap, 'inventory') && renderAccordionSection({
            id: 'inventory',
            title: 'Inventario',
            description: 'Color, tallas activas y cantidades. Esta seccion queda plegada por defecto para acortar la vista.',
            summary: `${selectedColors.length} colores · ${selectedSizeCount} tallas · ${totalUnits} uds`,
            children: (
          <section className="rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700">Inventario por color y talla</h3>
            <p className="mt-1 text-xs text-gray-500">
              Ajusta las combinaciones disponibles. Agrega colores primero y luego define las tallas con su stock.
            </p>
            {!inventoryEnabled && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Inventario desactivado. Puedes editar la ficha y las imagenes sin alterar el stock guardado.
              </div>
            )}
            {inventoryEnabled && !canSeeInventory && (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Tu perfil puede editar la ficha, pero no ver ni modificar inventario.
              </div>
            )}

            {inventoryEnabled && canSeeInventory && (
            <>
            <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
              <select
                value={colorToAdd}
                onChange={event => setColorToAdd(event.target.value)}
                disabled={!colorsAvailableToAdd.length}
                className="rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none md:w-64"
              >
                {colorsAvailableToAdd.length === 0 ? (
                  <option value="">Sin colores disponibles</option>
                ) : (
                  colorsAvailableToAdd.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={handleAddColor}
                disabled={!colorToAdd}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white transition ${
                  colorToAdd
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                Agregar color
              </button>
            </div>
            {!colorsAvailableToAdd.length && !selectedColors.length && (
              <p className="mt-2 text-xs text-orange-600">
                Agrega colores en Administrador de Categorias para poder asignarlos.
              </p>
            )}

            {selectedColors.length > 0 ? (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {selectedColors.map(color => (
                    <div
                      key={color}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                        activeColor === color
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-gray-100 text-gray-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveColor(color)}
                        className="font-medium"
                      >
                        {colorLabelMap[color] || color}
                        {typeof totalsByColor[color] === 'number'
                          ? ` (${totalsByColor[color]})`
                          : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveColor(color)}
                        className="text-xs text-red-500 hover:text-red-600"
                        aria-label={`Quitar color ${colorLabelMap[color] || color}`}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>

                {activeColor && (
                  <div className="rounded-lg border border-gray-100 p-4">
                    <h4 className="text-sm font-semibold text-gray-700">
                      {`Tallas para ${colorLabelMap[activeColor] || activeColor}`}
                    </h4>
                    {sizeOptions.length ? (
                      <>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {sizeOptions.map(option => {
                            const isSelected =
                              Boolean(
                                variantState[activeColor]?.sizes &&
                                  Object.prototype.hasOwnProperty.call(
                                    variantState[activeColor].sizes,
                                    option.value
                                  )
                              );
                            const currentValue =
                              variantState[activeColor]?.sizes?.[option.value] ?? '';

                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                  setSizeSelection(activeColor, option.value, !isSelected)
                                }
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 bg-white text-gray-700'
                                }`}
                              >
                                <span>{option.label}</span>
                                {isSelected && currentValue !== '' && (
                                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                    {currentValue}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {sizeOptions.some(option =>
                          Boolean(
                            variantState[activeColor]?.sizes &&
                              Object.prototype.hasOwnProperty.call(
                                variantState[activeColor].sizes,
                                option.value
                              )
                          )
                        ) && (
                          <div className="mt-4 space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                              Tallas activas
                            </p>
                            <div className="space-y-2">
                              {sizeOptions
                                .filter(option =>
                                  Boolean(
                                    variantState[activeColor]?.sizes &&
                                      Object.prototype.hasOwnProperty.call(
                                        variantState[activeColor].sizes,
                                        option.value
                                      )
                                  )
                                )
                                .map(option => {
                                  const currentValue =
                                    variantState[activeColor]?.sizes?.[option.value] ?? '';

                                  return (
                                    <div
                                      key={`active-${option.value}`}
                                      className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-3"
                                    >
                                      <span className="text-sm font-semibold text-gray-700">
                                        {option.label}
                                      </span>
                                      <input
                                        type="number"
                                        min="0"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={currentValue}
                                        onChange={event =>
                                          handleVariantQuantityChange(
                                            activeColor,
                                            option.value,
                                            event.target.value
                                          )
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white p-2 text-sm focus:border-blue-500 focus:outline-none"
                                        placeholder="Cantidad"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSizeSelection(activeColor, option.value, false)
                                        }
                                        className="rounded-xl border border-transparent px-2 py-2 text-xs font-semibold text-red-500 transition hover:border-red-100 hover:bg-red-50"
                                      >
                                        Quitar
                                      </button>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-gray-500">
                        No hay tallas configuradas. Agrega tallas en Administrador de Categorias.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                Agrega un color para comenzar a definir inventario por talla.
              </p>
            )}

            <div className="mt-4 rounded-md bg-gray-50 p-3 text-xs text-gray-600">
              <p>
                Total de unidades:{' '}
                <span className="font-semibold text-gray-800">{totalUnits}</span>
              </p>
              {selectedColors.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {selectedColors.map(color => (
                    <li key={color}>
                      <span className="font-medium text-gray-700">
                        {colorLabelMap[color] || color}:
                      </span>{' '}
                      {totalsByColor[color] || 0} unidades
                    </li>
                  ))}
                </ul>
              )}
            </div>
            </>
            )}
          </section>
            )
          })}

          {isAdminConfigEnabled(adminFieldMap, 'on_sale') && (
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700" style={blockStyle('on_sale')}>
            <input
              type="checkbox"
              name="onSale"
              checked={form.onSale}
              onChange={handleFieldChange}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Esta en oferta?
          </label>
          )}

          {isAdminConfigEnabled(adminFieldMap, 'description') && (
          <label className="text-sm font-medium text-gray-700" style={blockStyle('description')}>
            Descripcion
            <textarea
              name="description"
              value={form.description}
              onChange={handleFieldChange}
              rows={4}
              className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
            />
          </label>
          )}

          {isAdminConfigEnabled(adminFieldMap, 'images') && renderAccordionSection({
            id: 'images',
            title: 'Imagenes',
            description: 'Gestiona fotos actuales, nuevas cargas, portada y visibilidad interna.',
            summary: `${existingImages.length + pendingImages.length} totales`,
            style: blockStyle('images'),
            children: (
          <>
          {imageVisibilityEnabled && (
            <div className="mb-4 rounded-xl border border-brand/15 bg-brand/5 px-4 py-3 text-sm text-slate-600">
              Solo las fotos marcadas como <span className="font-semibold text-slate-900">Publicas</span> salen a tienda.
              Si este producto se queda sin fotos publicas, dejara de mostrarse al cliente.
            </div>
          )}
          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-700">Imagenes actuales</h4>
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                La primera foto publica sera la portada de la tienda. Arrastra para ordenar.
              </div>
              {imageVisibilityEnabled ? (
                <>
                  {publicExistingImages.length
                    ? renderEditableImageSection({
                        title: 'Publicas',
                        images: publicExistingImages,
                        visibility: 'public',
                        kind: 'existing'
                      })
                    : <p className="text-sm text-gray-500">No hay fotos publicas cargadas.</p>}
                  {internalExistingImages.length
                    ? renderEditableImageSection({
                        title: 'Internas',
                        images: internalExistingImages,
                        visibility: 'internal',
                        kind: 'existing'
                      })
                    : <p className="text-sm text-gray-500">No hay fotos internas cargadas.</p>}
                </>
              ) : (
                <>
                  {existingImages.length
                    ? renderEditableImageSection({
                        title: '',
                        images: existingImages,
                        visibility: 'public',
                        kind: 'existing'
                      })
                    : <p className="text-sm text-gray-500">No hay imagenes cargadas.</p>}
                </>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700">Agregar imagenes</h4>
            {imageVisibilityEnabled && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span>Destino:</span>
                <select
                  value={uploadVisibility}
                  onChange={event => setUploadVisibility(event.target.value)}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
                >
                  <option value="public">Publicas</option>
                  <option value="internal">Internas</option>
                </select>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={!canUploadImages}
              onChange={handleNewImages}
              className="mt-2 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
            />
            {!canUploadImages && (
              <p className="mt-2 text-xs text-slate-500">
                Tu perfil no tiene permiso para subir imagenes nuevas.
              </p>
            )}
            {pendingImages.length > 0 && (
              <div className="mt-4 space-y-4">
                {imageVisibilityEnabled ? (
                  <>
                    {publicPendingImages.length
                      ? renderEditableImageSection({
                          title: 'Publicas nuevas',
                          images: publicPendingImages,
                          visibility: 'public',
                          kind: 'pending'
                        })
                      : null}
                    {internalPendingImages.length
                      ? renderEditableImageSection({
                          title: 'Internas nuevas',
                          images: internalPendingImages,
                          visibility: 'internal',
                          kind: 'pending'
                        })
                      : null}
                  </>
                ) : (
                  renderEditableImageSection({
                    title: '',
                    images: pendingImages,
                    visibility: 'public',
                    kind: 'pending'
                  })
                )}
              </div>
            )}
          </div>
          </>
            )
          })}

          <button
            type="submit"
            disabled={submitting}
            className={`hidden w-full rounded-md py-3 text-white font-semibold transition md:block ${
              submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {submitting ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">
              {form.name || 'Producto sin nombre'}
            </p>
            <p className="text-xs text-slate-500">
              {selectedColors.length} colores · {totalUnits} unidades · {existingImages.length + pendingImages.length} imagenes
            </p>
          </div>
          <button
            type="submit"
            form="edit-product-form"
            disabled={submitting}
            className={`rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${
              submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {submitting ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProductPage;
