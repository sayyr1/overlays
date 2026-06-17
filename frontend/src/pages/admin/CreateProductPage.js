import React, { useEffect, useMemo, useState } from 'react';
import axios from '../../api/axiosInstance';
import imageCompression from 'browser-image-compression';
import { usePublicConfig } from '../../context/PublicConfigContext';
import { useAuth } from '../../context/AuthContext';
import {
  DEFAULT_COLOR_LABEL,
  flattenNestedVariants,
  normalizeVariantColor,
  normalizeVariantSize,
  aggregateSizesFromVariants
} from '../../utils/inventory';
import {
  getImageKey,
  isImageCover,
  makeImageCover,
  reorderImagesWithinVisibility,
  sortImagesForPayload,
  updateImageVisibility
} from '../../utils/productImages';

const createEmptyPrice = () => ({
  retail: '',
  gold: '',
  premium: '',
  platinum: ''
});

const createInitialFormState = () => ({
  name: '',
  price: createEmptyPrice(),
  description: '',
  brand: '',
  type: '',
  collection: '',
  gender: 'Unisex',
  attributes: {},
  onSale: false
});

const DEFAULT_GENDERS = ['Unisex', 'Hombre', 'Mujer', 'Nino', 'Nina'];
const LOCATION_ATTRIBUTE_KEY = 'ubicacion';
const BRAND_CODE_PREFIX_LENGTH = 3;
const IMAGE_VISIBILITY_OPTIONS = [
  {
    value: 'public',
    label: 'Tienda',
    description: 'Se muestra al cliente y puede ser portada.'
  },
  {
    value: 'internal',
    label: 'Interna',
    description: 'Solo para el equipo. No aparece en la tienda.'
  }
];

const stripDiacritics = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const buildBrandCodePrefix = brand => {
  const compact = stripDiacritics(brand).replace(/[^a-zA-Z0-9]/g, '');
  if (!compact) return '';
  const prefix = compact.length <= 4
    ? compact
    : compact.slice(0, BRAND_CODE_PREFIX_LENGTH);
  return prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase();
};

const extractBrandCodeSequence = (code, prefix) => {
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode || !prefix) return 0;
  if (!normalizedCode.toLowerCase().startsWith(prefix.toLowerCase())) return 0;
  const suffix = normalizedCode.slice(prefix.length);
  const numeric = Number.parseInt(suffix, 10);
  return Number.isFinite(numeric) ? numeric : 0;
};

const buildCompositeName = (...parts) =>
  parts
    .map(part => String(part || '').trim())
    .filter(Boolean)
    .join(' ');

const normalizeCategoryPayload = payload => {
  const normalized = {};
  if (payload && typeof payload === 'object') {
    Object.entries(payload).forEach(([key, values]) => {
      normalized[key] = Array.isArray(values) ? values : [];
    });
  }
  return normalized;
};

const CreateProductPage = () => {
  const { isModuleEnabled, settings } = usePublicConfig();
  const { hasPermission } = useAuth();
  const [form, setForm] = useState(() => createInitialFormState());
  const [code, setCode] = useState('');
  const [categories, setCategories] = useState({});
  const [brandModels, setBrandModels] = useState({});
  const [variantState, setVariantState] = useState({});
  const [pendingImages, setPendingImages] = useState([]);
  const [uploadVisibility, setUploadVisibility] = useState('public');
  const [draggedImageKey, setDraggedImageKey] = useState('');
  const [colorToAdd, setColorToAdd] = useState('');
  const [activeColor, setActiveColor] = useState('');
  const [openSection, setOpenSection] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inventoryEnabled = isModuleEnabled('inventory');
  const membershipsEnabled = isModuleEnabled('memberships');
  const canUploadImages = hasPermission('products.upload');
  const canSeeInventory = hasPermission('inventory.view') || hasPermission('inventory.adjust');
  const imageVisibilityEnabled = Boolean(settings?.enableInternalProductImages);
  const priceLevels = membershipsEnabled
    ? ['retail', 'gold', 'premium', 'platinum']
    : ['retail'];
  const locationCategoryKey = useMemo(
    () =>
      Object.keys(categories || {}).find(key =>
        ['ubicacion', 'location'].includes(key.toLowerCase())
      ) || LOCATION_ATTRIBUTE_KEY,
    [categories]
  );
  const locationOptions = useMemo(
    () => (Array.isArray(categories[locationCategoryKey]) ? categories[locationCategoryKey] : []),
    [categories, locationCategoryKey]
  );
  const locationValue = form.attributes?.[locationCategoryKey] || '';
  const availableModels = useMemo(() => {
    if (!form.brand) {
      return [];
    }
    return Array.isArray(brandModels[form.brand]) ? brandModels[form.brand] : [];
  }, [brandModels, form.brand]);
  const generatedName = useMemo(
    () =>
      form.brand && form.type && form.gender
        ? buildCompositeName(form.brand, form.type, form.gender)
        : '',
    [form.brand, form.gender, form.type]
  );

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

  useEffect(() => {
    let cancelled = false;
    const loadCategories = async () => {
      try {
        const [{ data }, { data: brandModelMap }] = await Promise.all([
          axios.get('/api/categories'),
          axios.get('/api/categories/brand-models')
        ]);
        if (!cancelled) {
          setCategories(normalizeCategoryPayload(data));
          setBrandModels(brandModelMap || {});
        }
      } catch (error) {
        console.error('Error loading categories', error);
      }
    };
    loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

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
    setForm(prev => (prev.name === generatedName ? prev : { ...prev, name: generatedName }));
  }, [generatedName]);

  useEffect(() => {
    if (!form.brand) {
      setForm(prev => (prev.type ? { ...prev, type: '' } : prev));
      return;
    }

    if (!availableModels.length) {
      return;
    }

    setForm(prev => (
      prev.type && availableModels.includes(prev.type)
        ? prev
        : { ...prev, type: '' }
    ));
  }, [availableModels, form.brand]);

  useEffect(() => {
    let cancelled = false;
    const prefix = buildBrandCodePrefix(form.brand);

    if (!prefix) {
      setCode('');
      return undefined;
    }

    const loadNextCode = async () => {
      try {
        const { data } = await axios.get('/api/products/filter', {
          params: { brand: form.brand }
        });
        if (cancelled) return;
        const products = Array.isArray(data) ? data : [];
        const nextSequence =
          products.reduce(
            (maxValue, product) => Math.max(maxValue, extractBrandCodeSequence(product.code, prefix)),
            0
          ) + 1;
        setCode(`${prefix}${String(nextSequence).padStart(2, '0')}`);
      } catch {
        if (!cancelled) {
          setCode(`${prefix}01`);
        }
      }
    };

    loadNextCode();

    return () => {
      cancelled = true;
    };
  }, [form.brand]);

  useEffect(
    () => () => {
      pendingImages.forEach(item => URL.revokeObjectURL(item.previewUrl));
    },
    [pendingImages]
  );

  const selectedColors = useMemo(() => Object.keys(variantState), [variantState]);

  const PROTECTED_CATEGORY_KEYS = useMemo(
    () => new Set(['brand', 'type', 'size', 'collection', 'gender', 'color']),
    []
  );

  const dynamicAttributeKeys = useMemo(() => {
    const keys = Object.keys(categories || {});
    return keys.filter(k => !PROTECTED_CATEGORY_KEYS.has(k) && k !== locationCategoryKey);
  }, [categories, locationCategoryKey, PROTECTED_CATEGORY_KEYS]);

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
      if (!normalized) {
        return;
      }
      if (!map.has(normalized)) {
        map.set(normalized, size);
      }
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [categories.size]);

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

  const handleAttributeChange = (key, value) => {
    setForm(prev => ({
      ...prev,
      attributes: {
        ...(prev.attributes || {}),
        [key]: value
      }
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

  const handleAddColor = () => {
    if (!colorToAdd) {
      return;
    }
    const normalized = normalizeVariantColor(colorToAdd);
    setVariantState(prev => {
      if (prev[normalized]) {
        return prev;
      }
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
      if (!prev[normalized]) {
        return prev;
      }
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

  const handleImageSelection = event => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) {
      return;
    }

    setPendingImages(prev => [
      ...prev,
      ...files.map(file => ({
        clientId: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        visibility: imageVisibilityEnabled ? uploadVisibility : 'public'
      }))
    ]);
    event.target.value = '';
  };

  const removePreviewImage = imageKey => {
    setPendingImages(prev => {
      const target = prev.find(item => getImageKey(item) === imageKey);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter(item => getImageKey(item) !== imageKey);
    });
  };

  const handleImageVisibilityChange = (imageKey, nextVisibility) => {
    setPendingImages(prev => updateImageVisibility(prev, imageKey, nextVisibility, imageVisibilityEnabled));
  };

  const handleSetImageCover = imageKey => {
    setPendingImages(prev => makeImageCover(prev, imageKey, imageVisibilityEnabled));
  };

  const handleImageDrop = (targetKey, visibility) => {
    if (!draggedImageKey) return;
    setPendingImages(prev =>
      reorderImagesWithinVisibility(prev, {
        draggedKey: draggedImageKey,
        targetKey,
        visibility,
        enabled: imageVisibilityEnabled
      })
    );
    setDraggedImageKey('');
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

  const uploadImages = async imageItems => {
    if (!imageItems || !imageItems.length) {
      return [];
    }
    const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true };
    const formData = new FormData();
    const normalizedItems = [];
    for (const item of imageItems) {
      try {
        const compressed = await imageCompression(item.file, options);
        formData.append('images', compressed);
        normalizedItems.push(item);
      } catch (error) {
        console.error('Error compressing image', error);
      }
    }
    if (!normalizedItems.length) {
      return [];
    }
    try {
      const response = await axios.post('/api/products/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const uploaded = Array.isArray(response.data?.images) ? response.data.images : [];
      return uploaded.map((image, index) => ({
        ...image,
        visibility: normalizedItems[index]?.visibility || 'public'
      }));
    } catch (error) {
      console.error('Error uploading images', error);
      return [];
    }
  };

  const handleSubmit = async event => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (!generatedName) {
      window.alert('Completa marca, modelo y genero para generar el nombre.');
      return;
    }

    if (!code) {
      window.alert('Selecciona una marca valida para generar el codigo del producto.');
      return;
    }

    if (Object.values(normalizedPrice).some(value => Number.isNaN(value) || value < 0)) {
      window.alert('Verifica que los precios sean numeros validos (>= 0).');
      return;
    }

    const groupedVariants = {};
    Object.entries(variantState).forEach(([color, data]) => {
      const normalizedColor = normalizeVariantColor(color);
      const rawSizes = data?.sizes || {};
      const nextSizes = {};
      Object.entries(rawSizes).forEach(([size, qty]) => {
        if (qty === undefined || qty === null) {
          return;
        }
        const numericValue = Number(qty);
        if (Number.isFinite(numericValue)) {
          nextSizes[normalizeVariantSize(size)] = numericValue;
        }
      });
      if (Object.keys(nextSizes).length) {
        groupedVariants[normalizedColor] = nextSizes;
      }
    });

    if (inventoryEnabled && canSeeInventory && !Object.keys(groupedVariants).length) {
      window.alert('Agrega al menos un color con tallas seleccionadas.');
      return;
    }

    const flatVariants = inventoryEnabled && canSeeInventory ? flattenNestedVariants(groupedVariants) : {};
    const sanitizedVariants = inventoryEnabled && canSeeInventory
      ? Object.fromEntries(
          Object.entries(flatVariants).filter(([, qty]) => Number(qty) > 0)
        )
      : {};

    if (inventoryEnabled && canSeeInventory && !Object.keys(sanitizedVariants).length) {
      window.alert('Define cantidades mayores a 0 para al menos una combinacion color/talla.');
      return;
    }

    setSubmitting(true);

    try {
      const sortedPendingImages = sortImagesForPayload(pendingImages, imageVisibilityEnabled);

      if (
        imageVisibilityEnabled &&
        sortedPendingImages.length > 0 &&
        !sortedPendingImages.some(image => image.visibility !== 'internal')
      ) {
        window.alert('Agrega al menos una foto publica para la tienda o elimina las fotos internas.');
        setSubmitting(false);
        return;
      }

      const images = canUploadImages && sortedPendingImages.length
        ? await uploadImages(sortedPendingImages)
        : [];
      const stockBySize = inventoryEnabled && canSeeInventory ? aggregateSizesFromVariants(sanitizedVariants) : {};
      const productColors = inventoryEnabled && canSeeInventory ? Object.keys(groupedVariants) : [];

      // Build attributes payload from dynamic keys
      const attributes = {};
      if (locationValue) {
        attributes[locationCategoryKey] = locationValue;
      }
      dynamicAttributeKeys.forEach(k => {
        const v = form.attributes?.[k];
        if (v) attributes[k] = v;
      });

      const productData = {
        name: form.name,
        code,
        price: normalizedPrice,
        description: form.description,
        brand: form.brand,
        type: form.type,
        collection: form.collection,
        gender: form.gender,
        attributes,
        onSale: form.onSale,
        stockByColorSize: sanitizedVariants,
        stockBySize,
        colors: productColors,
        images
      };

      await axios.post('/api/products', productData, { withCredentials: true });
      window.alert('Producto creado con exito');
      setForm(createInitialFormState());
      setVariantState({});
      setPendingImages(prev => {
        prev.forEach(item => URL.revokeObjectURL(item.previewUrl));
        return [];
      });
      setDraggedImageKey('');
      setCode('');
    } catch (error) {
      console.error('Error creating product', error);
      window.alert(error.response?.data?.message || 'No se pudo crear el producto');
    } finally {
      setSubmitting(false);
    }
  };

  const publicPendingImages = pendingImages.filter(image => image.visibility !== 'internal');
  const internalPendingImages = pendingImages.filter(image => image.visibility === 'internal');
  const selectedSizeCount = useMemo(
    () =>
      Object.values(variantState).reduce(
        (acc, entry) => acc + Object.keys(entry?.sizes || {}).length,
        0
      ),
    [variantState]
  );

  const renderPendingImageSection = (images, title, visibility) => (
    <div className="space-y-3">
      {imageVisibilityEnabled && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            {title}
          </p>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            {images.length}
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-4">
        {images.map((item, index) => {
          const imageKey = getImageKey(item);
          const cover = isImageCover(pendingImages, imageKey, imageVisibilityEnabled);

          return (
            <div
              key={imageKey}
              draggable
              onDragStart={() => setDraggedImageKey(imageKey)}
              onDragOver={event => event.preventDefault()}
              onDrop={() => handleImageDrop(imageKey, visibility)}
              className="relative w-28 rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
            >
              <img
                src={item.previewUrl}
                alt={`preview-${index}`}
                className="h-24 w-full rounded-md object-cover"
              />
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="cursor-move text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Arrastrar
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      item.visibility === 'internal'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-sky-50 text-sky-700'
                    }`}>
                      {item.visibility === 'internal' ? 'Interna' : 'Tienda'}
                    </span>
                    {cover && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Portada
                      </span>
                    )}
                  </div>
                </div>
                {imageVisibilityEnabled && (
                  <select
                    value={item.visibility}
                    onChange={event => handleImageVisibilityChange(imageKey, event.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700"
                  >
                    <option value="public">Tienda publica</option>
                    <option value="internal">Uso interno</option>
                  </select>
                )}
                {visibility === 'public' && !cover && (
                  <button
                    type="button"
                    onClick={() => handleSetImageCover(imageKey)}
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    Usar como portada
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => removePreviewImage(imageKey)}
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

  const renderAccordionSection = ({ id, title, description, summary, children }) => {
    const isOpen = openSection === id;

    return (
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
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
      <div className="mx-auto max-w-4xl rounded-xl bg-white p-5 shadow md:p-8">
        <h2 className="mb-6 text-2xl font-semibold text-gray-800">Crear producto</h2>
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-800">{generatedName || 'Producto en preparacion'}</p>
              <p className="mt-1 text-xs text-slate-500">
                {code || 'Codigo pendiente'} · {selectedColors.length} colores · {totalUnits} unidades
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
              {pendingImages.length} imagenes
            </span>
          </div>
        </div>
        <form id="create-product-form" onSubmit={handleSubmit} className="space-y-4">
          <section className="rounded-lg border border-gray-200 p-4">
          

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="text-sm font-medium text-gray-700">
                Ubicacion
                {locationOptions.length ? (
                  <select
                    value={locationValue}
                    onChange={event => handleAttributeChange(locationCategoryKey, event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Selecciona una ubicacion</option>
                    {locationOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={locationValue}
                    onChange={event => handleAttributeChange(locationCategoryKey, event.target.value)}
                    placeholder="Ej: Bodega 1, Showroom centro, Quito norte"
                    className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                  />
                )}
              </label>

              <label className="text-sm font-medium text-gray-700">
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

              <label className="text-sm font-medium text-gray-700">
                Modelo
                <select
                  name="type"
                  value={form.type}
                  onChange={handleFieldChange}
                  disabled={!form.brand || !availableModels.length}
                  className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">
                    {!form.brand
                      ? 'Primero selecciona una marca'
                      : availableModels.length
                        ? 'Selecciona un modelo'
                        : 'No hay modelos para esta marca'}
                  </option>
                  {availableModels.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-gray-700">
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

              <label className="text-sm font-medium text-gray-700 xl:col-span-2">
                Nombre
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  readOnly
                  className="mt-1 w-full rounded-md border border-gray-200 bg-gray-100 p-3 text-gray-600"
                />
              </label>

              <label className="text-sm font-medium text-gray-700">
                Codigo
                <input
                  type="text"
                  value={code}
                  disabled
                  className="mt-1 w-full rounded-md border border-gray-200 bg-gray-100 p-3 text-gray-500"
                />
              </label>
            </div>
          </section>

          <fieldset className="rounded-lg border border-gray-200 p-4">
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

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
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
          </div>

          {dynamicAttributeKeys.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              {dynamicAttributeKeys.map(key => (
                <label key={key} className="text-sm font-medium text-gray-700">
                  {key}
                  <select
                    value={form.attributes?.[key] || ''}
                    onChange={e => handleAttributeChange(key, e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Selecciona una opcion</option>
                    {(categories[key] || []).map(val => (
                      <option key={val} value={val}>
                        {val}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}

          {renderAccordionSection({
            id: 'inventory',
            title: 'Inventario',
            description: 'Color, tallas activas y cantidades. Esta seccion es la mas extensa y queda colapsada por defecto.',
            summary: `${selectedColors.length} colores · ${selectedSizeCount} tallas · ${totalUnits} uds`,
            children: (
          <section className="rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700">Inventario por color y talla</h3>
            <p className="mt-1 text-xs text-gray-500">
              Selecciona un color disponible y luego define las tallas con sus cantidades.
            </p>
            {!inventoryEnabled && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Inventario desactivado. Este producto se guardara sin stock operativo ni variantes.
              </div>
            )}
            {inventoryEnabled && !canSeeInventory && (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Tu perfil puede crear fichas de producto, pero no configurar inventario.
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

          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              name="onSale"
              checked={form.onSale}
              onChange={handleFieldChange}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Esta en oferta?
          </label>

          <label className="text-sm font-medium text-gray-700">
            Descripcion
            <textarea
              name="description"
              value={form.description}
              onChange={handleFieldChange}
              rows={4}
              placeholder="Describe el producto, materiales, recomendaciones, etc."
              className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
            />
          </label>

          {renderAccordionSection({
            id: 'images',
            title: 'Imagenes',
            description: 'Carga fotos de tienda o internas. Tambien define la portada.',
            summary: `${pendingImages.length} nuevas`,
            children: (
          <div>
            <label className="text-sm font-medium text-gray-700">
              Subir imagenes
              {imageVisibilityEnabled && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Destino de las nuevas imagenes
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {IMAGE_VISIBILITY_OPTIONS.map(option => {
                      const isActive = uploadVisibility === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setUploadVisibility(option.value)}
                          className={`rounded-xl border px-3 py-3 text-left transition ${
                            isActive
                              ? 'border-brand bg-brand/10 text-brand'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <p className="text-sm font-semibold">{option.label}</p>
                          <p className={`mt-1 text-xs ${isActive ? 'text-brand/80' : 'text-slate-500'}`}>
                            {option.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={!canUploadImages}
                onChange={handleImageSelection}
                className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
              />
            </label>
            {!canUploadImages && (
              <p className="mt-2 text-xs text-slate-500">
                Tu perfil no tiene permiso para subir imagenes.
              </p>
            )}
            {pendingImages.length > 0 && (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  La primera foto de tienda sera la portada visible al cliente. Las internas quedan fuera de la tienda.
                </div>
                {imageVisibilityEnabled ? (
                  <>
                    {renderPendingImageSection(publicPendingImages, 'Fotos de tienda', 'public')}
                    {renderPendingImageSection(internalPendingImages, 'Fotos internas', 'internal')}
                  </>
                ) : (
                  renderPendingImageSection(pendingImages, '', 'public')
                )}
              </div>
            )}
          </div>
            )
          })}

          <button
            type="submit"
            disabled={submitting}
            className={`hidden w-full rounded-md py-3 text-white font-semibold transition md:block ${
              submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {submitting ? 'Creando...' : 'Crear producto'}
          </button>
        </form>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">
              {generatedName || 'Completa la identidad del producto'}
            </p>
            <p className="text-xs text-slate-500">
              {selectedColors.length} colores · {totalUnits} unidades · {pendingImages.length} imagenes
            </p>
          </div>
          <button
            type="submit"
            form="create-product-form"
            disabled={submitting}
            className={`rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${
              submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {submitting ? 'Creando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateProductPage;
