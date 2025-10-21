import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from '../../api/axiosInstance';
import imageCompression from 'browser-image-compression';
import ProductImage from '../../components/usuario/ProductImage';
import {
  DEFAULT_COLOR_LABEL,
  flattenNestedVariants,
  normalizeVariantColor,
  normalizeVariantSize,
  aggregateSizesFromVariants,
  buildNestedVariantsWithFallback
} from '../../utils/inventory';

const createEmptyPrice = () => ({
  retail: '',
  gold: '',
  premium: '',
  platinum: ''
});

const DEFAULT_GENDERS = ['Unisex', 'Hombre', 'Mujer', 'Nino', 'Nina'];

const EditProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    price: createEmptyPrice(),
    description: '',
    brand: '',
    type: '',
    collection: '',
    gender: 'Unisex',
    onSale: false
  });
  const [categories, setCategories] = useState({
    brand: [],
    type: [],
    size: [],
    collection: [],
    gender: [],
    color: []
  });
  const [variantState, setVariantState] = useState({});
  const [activeColor, setActiveColor] = useState('');
  const [colorToAdd, setColorToAdd] = useState('');
  const [existingImages, setExistingImages] = useState([]);
  const [files, setFiles] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
    if (!id) return;
    const loadData = async () => {
      try {
        const [{ data: catPayload }, { data: product }] = await Promise.all([
          axios.get('/api/categories'),
          axios.get(`/api/products/${id}`)
        ]);

        setCategories({
          brand: catPayload?.brand || [],
          type: catPayload?.type || [],
          size: catPayload?.size || [],
          collection: catPayload?.collection || [],
          gender: catPayload?.gender || [],
          color: catPayload?.color || []
        });

        setCode(product.code);
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
          type: product.type ?? '',
          collection: product.collection ?? '',
          gender: product.gender ?? 'Unisex',
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
        setExistingImages(product.images || []);
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

  useEffect(
    () => () => {
      previewImages.forEach(url => URL.revokeObjectURL(url));
    },
    [previewImages]
  );

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
    setFiles(selected);
    setPreviewImages(prev => {
      prev.forEach(url => URL.revokeObjectURL(url));
      return selected.map(file => URL.createObjectURL(file));
    });
  };

  const removePreviewImage = index => {
    setPreviewImages(prev => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target);
      }
      return prev.filter((_, current) => current !== index);
    });
    setFiles(prev => prev.filter((_, current) => current !== index));
  };

  const removeExistingImage = async publicId => {
    try {
      await axios.delete(`/api/products/${id}/image/${publicId}`, { withCredentials: true });
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

  const uploadNewImages = async () => {
    if (!files.length) return [];
    const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true };
    const formData = new FormData();
    for (const file of files) {
      try {
        const compressed = await imageCompression(file, options);
        formData.append('images', compressed);
      } catch (error) {
        console.error('Error al comprimir imagen', error);
      }
    }
    try {
      const response = await axios.post('/api/products/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data.images;
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

    if (!Object.keys(sanitizedByColor).length) {
      window.alert('Define al menos una combinacion color/talla con stock.');
      return;
    }

    setSubmitting(true);

    try {
      const flatVariants = flattenNestedVariants(sanitizedByColor);
      const stockBySize = aggregateSizesFromVariants(flatVariants);
      const productColors = Object.keys(sanitizedByColor);
      const uploadedImages = await uploadNewImages();
      const images = [...existingImages, ...uploadedImages];

      const payload = {
        name: form.name,
        code,
        price: normalizedPrice,
        description: form.description,
        brand: form.brand,
        type: form.type,
        collection: form.collection,
        gender: form.gender,
        onSale: form.onSale,
        stockByColorSize: flatVariants,
        stockBySize,
        colors: productColors,
        images
      };

      await axios.put(`/api/products/${id}`, payload, { withCredentials: true });
      window.alert('Producto actualizado correctamente');
      setFiles([]);
      setPreviewImages(prev => {
        prev.forEach(url => URL.revokeObjectURL(url));
        return [];
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Error al actualizar producto', error);
      window.alert(error.response?.data?.message || 'No se pudo actualizar el producto');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-6 text-center text-gray-500">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-8 shadow">
        <h2 className="mb-6 text-2xl font-semibold text-gray-800">Editar producto</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
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

          <fieldset className="rounded-lg border border-gray-200 p-4">
            <legend className="px-2 text-sm font-semibold text-gray-700">Precios</legend>
            <div className="grid gap-4 md:grid-cols-2">
              {['retail', 'gold', 'premium', 'platinum'].map(level => (
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
            <p className="mt-2 text-xs text-gray-500">
              Si dejas vacio Gold/Premium/Platinum se usara el precio retail.
            </p>
          </fieldset>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-gray-700">
              Marca
              <select
                name="brand"
                value={form.brand}
                onChange={handleFieldChange}
                className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Selecciona una marca</option>
                {categories.brand.map(brand => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Tipo
              <select
                name="type"
                value={form.type}
                onChange={handleFieldChange}
                className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Selecciona un tipo</option>
                {categories.type.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Coleccion
              <select
                name="collection"
                value={form.collection}
                onChange={handleFieldChange}
                className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Selecciona una coleccion</option>
                {categories.collection.map(collection => (
                  <option key={collection} value={collection}>
                    {collection}
                  </option>
                ))}
              </select>
            </label>
          </div>

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

          <section className="rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700">Inventario por color y talla</h3>
            <p className="mt-1 text-xs text-gray-500">
              Ajusta las combinaciones disponibles. Agrega colores primero y luego define las tallas con su stock.
            </p>

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
                      <div className="mt-3 space-y-3">
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
                            <div
                              key={option.value}
                              className="flex flex-col gap-3 rounded-md border border-gray-200 p-3 md:flex-row md:items-center md:justify-between"
                            >
                              <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    setSizeSelection(activeColor, option.value, !isSelected)
                                  }
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                {option.label}
                              </label>
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
                                disabled={!isSelected}
                                className="w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none md:w-32"
                                placeholder="Cantidad"
                              />
                            </div>
                          );
                        })}
                      </div>
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
          </section>

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
              className="mt-1 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
            />
          </label>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-700">Imagenes actuales</h4>
            <div className="flex flex-wrap gap-4">
              {existingImages.map(image => (
                <div key={image.public_id} className="relative h-24 w-24">
                  <ProductImage
                    src={image.url}
                    alt={image.public_id}
                    className="h-full w-full rounded-md object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(image.public_id)}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
                    aria-label="Eliminar imagen"
                  >
                    x
                  </button>
                </div>
              ))}
              {!existingImages.length && (
                <p className="text-sm text-gray-500">No hay imagenes cargadas.</p>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700">Agregar imagenes</h4>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleNewImages}
              className="mt-2 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
            />
            {previewImages.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-4">
                {previewImages.map((src, index) => (
                  <div key={src} className="relative h-24 w-24">
                    <ProductImage
                      src={src}
                      alt={`preview-${index}`}
                      className="h-full w-full rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePreviewImage(index)}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
                      aria-label="Eliminar imagen"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full rounded-md py-3 text-white font-semibold transition ${
              submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {submitting ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditProductPage;
