import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../../api/axiosInstance';
import ProductImage from '../../components/usuario/ProductImage';
import { usePublicConfig } from '../../context/PublicConfigContext';
import { useAuth } from '../../context/AuthContext';
import {
  buildNestedVariantsWithFallback,
  normalizeVariantColor
} from '../../utils/inventory';

const LOW_STOCK_THRESHOLD = 5;
const INVENTORY_FILTER_STORAGE_KEY = 'niway-admin-inventory-filters-v1';

const DEFAULT_ADVANCED_FILTERS = Object.freeze({
  brand: '',
  collection: '',
  type: '',
  gender: '',
  location: '',
  promo: 'all',
  missing: 'all',
  attributeKey: '',
  attributeValue: ''
});

const STOCK_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'low', label: 'Stock bajo' },
  { value: 'out', label: 'Sin stock' },
  { value: 'healthy', label: 'Estables' }
];

const PROMO_FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'on', label: 'En promocion' },
  { value: 'off', label: 'Sin promocion' }
];

const MISSING_DATA_FILTERS = [
  { value: 'all', label: 'Completo o mixto' },
  { value: 'brand', label: 'Sin marca' },
  { value: 'collection', label: 'Sin coleccion' }
];

const SORT_OPTIONS = [
  { value: 'risk', label: 'Priorizar riesgo' },
  { value: 'stock-asc', label: 'Menor stock' },
  { value: 'stock-desc', label: 'Mayor stock' },
  { value: 'name', label: 'Nombre A-Z' },
  { value: 'price-desc', label: 'Precio mayor' }
];

const QUICK_VIEWS = [
  { value: 'all', label: 'Todo' },
  { value: 'risk', label: 'Riesgo' },
  { value: 'out', label: 'Sin stock' },
  { value: 'promo', label: 'Promos' },
  { value: 'missing-brand', label: 'Sin marca' }
];

const MOBILE_INVENTORY_VIEWS = [
  { value: 'all', label: 'Todos' },
  { value: 'store', label: 'Tienda' },
  { value: 'internal', label: 'Internas' },
  { value: 'low', label: 'Stock bajo' },
  { value: 'promo', label: 'Promos' }
];

const normalizeText = value => String(value || '').trim().toLowerCase();
const LOCATION_ATTRIBUTE_CANDIDATES = ['ubicacion', 'ubicación', 'location', 'lugar', 'place'];

const normalizeComparableKey = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const formatAttributeKey = key =>
  String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());

const readStoredInventoryState = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(INVENTORY_FILTER_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return {
      stockFilter: parsed?.stockFilter || 'all',
      sortBy: parsed?.sortBy || 'risk',
      advancedFilters: {
        ...DEFAULT_ADVANCED_FILTERS,
        ...(parsed?.advancedFilters || {})
      }
    };
  } catch (error) {
    return null;
  }
};

const getProductAttributes = product => {
  const attributes = product?.attributes;
  if (!attributes) {
    return [];
  }

  if (attributes instanceof Map) {
    return Array.from(attributes.entries());
  }

  if (typeof attributes === 'object') {
    return Object.entries(attributes);
  }

  return [];
};

const getProductAttributeValue = (product, key) => {
  if (!key) {
    return '';
  }

  const entry = getProductAttributes(product).find(([entryKey]) => entryKey === key);
  return entry ? String(entry[1] || '') : '';
};

const buildVariantMatrix = product => {
  const nested = buildNestedVariantsWithFallback(
    product?.stockByColorSize,
    product?.stockBySize
  );
  const result = { ...nested };
  (product?.colors || []).forEach(color => {
    const normalized = normalizeVariantColor(color);
    if (!result[normalized]) {
      result[normalized] = {};
    }
  });
  return result;
};

const findFirstVariant = matrix => {
  for (const [color, sizes] of Object.entries(matrix)) {
    const sizeKeys = Object.keys(sizes || {});
    if (sizeKeys.length) {
      return { color, size: sizeKeys[0] };
    }
  }
  const colors = Object.keys(matrix);
  return { color: colors[0] || '', size: '' };
};

const getColorLabelMap = product => {
  const map = {};
  (product?.colors || []).forEach(color => {
    map[normalizeVariantColor(color)] = color;
  });
  return map;
};

const formatCurrency = amount =>
  new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(amount || 0));

const getAdminPreviewImage = product =>
  product?.images?.[0]?.url ||
  product?.internalImages?.[0]?.url ||
  '';

const buildInventorySummary = product => {
  const matrix = buildVariantMatrix(product);
  const colorLabelMap = getColorLabelMap(product);
  const variantEntries = [];
  let totalUnits = 0;
  let colorsWithStock = 0;

  Object.entries(matrix).forEach(([color, sizes]) => {
    const sizeEntries = Object.entries(sizes || {});
    let totalByColor = 0;

    sizeEntries.forEach(([size, qty]) => {
      const numericQty = Number(qty || 0);
      totalUnits += numericQty;
      totalByColor += numericQty;
      variantEntries.push({
        key: `${color}-${size}`,
        color,
        colorLabel: colorLabelMap[color] || color,
        size,
        qty: numericQty
      });
    });

    if (totalByColor > 0) {
      colorsWithStock += 1;
    }
  });

  const activeVariants = variantEntries.filter(variant => variant.qty > 0);
  const lowStockVariants = activeVariants.filter(variant => variant.qty <= LOW_STOCK_THRESHOLD);
  const previewVariants = [...variantEntries]
    .sort((left, right) => left.qty - right.qty || left.colorLabel.localeCompare(right.colorLabel))
    .slice(0, 6);

  return {
    totalUnits,
    variantEntries,
    activeVariants,
    lowStockVariants,
    previewVariants,
    colorCount: Object.keys(matrix).length,
    colorsWithStock
  };
};

const getInventoryHealthMeta = inventory => {
  if (!inventory.totalUnits) {
    return {
      label: 'Sin stock',
      className: 'border border-red-200 bg-red-50 text-red-700'
    };
  }

  if (
    inventory.totalUnits <= LOW_STOCK_THRESHOLD ||
    inventory.lowStockVariants.length > 0
  ) {
    return {
      label: 'Stock bajo',
      className: 'border border-amber-200 bg-amber-50 text-amber-700'
    };
  }

  return {
    label: 'Estable',
    className: 'border border-emerald-200 bg-emerald-50 text-emerald-700'
  };
};

const getVariantPillClassName = qty => {
  if (qty === 0) {
    return 'border border-red-200 bg-red-50 text-red-700';
  }
  if (qty <= LOW_STOCK_THRESHOLD) {
    return 'border border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border border-surface-200 bg-surface-50 text-slate-700';
};

const ProductPage = () => {
  const storedState = readStoredInventoryState();
  const { isModuleEnabled, loading: modulesLoading } = usePublicConfig();
  const { hasPermission } = useAuth();
  const [products, setProducts] = useState([]);
  const [modalData, setModalData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState(storedState?.stockFilter || 'all');
  const [draftStockFilter, setDraftStockFilter] = useState(storedState?.stockFilter || 'all');
  const [sortBy, setSortBy] = useState(storedState?.sortBy || 'risk');
  const [advancedFilters, setAdvancedFilters] = useState(
    storedState?.advancedFilters || DEFAULT_ADVANCED_FILTERS
  );
  const [draftFilters, setDraftFilters] = useState(
    storedState?.advancedFilters || DEFAULT_ADVANCED_FILTERS
  );
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isMobileSummaryExpanded, setIsMobileSummaryExpanded] = useState(false);
  const [expandedMobileActionId, setExpandedMobileActionId] = useState(null);
  const [mobileInventoryView, setMobileInventoryView] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const inventoryEnabled = isModuleEnabled('inventory');
  const canEditProducts = hasPermission('products.edit');
  const canDeleteProducts = hasPermission('products.delete');
  const canCreateProducts =
    isModuleEnabled('products') &&
    isModuleEnabled('categories') &&
    hasPermission('products.create');
  const canAdjustInventory = hasPermission('inventory.adjust');
  const canViewInventory = hasPermission('inventory.view') || canAdjustInventory;
  const inventoryVisible = inventoryEnabled && canViewInventory;

  const fetchProducts = async () => {
    setIsRefreshing(true);
    try {
      const res = await axios.get('/api/products');
      setProducts(res.data);
    } catch (err) {
      console.error('Error al cargar productos', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('Seguro que deseas eliminar este producto y sus imagenes?')) return;
    try {
      await axios.delete(`/api/products/${id}`, { withCredentials: true });
      alert('Producto e imagenes eliminados correctamente');
      fetchProducts();
    } catch (err) {
      console.error('Error al eliminar producto:', err);
      alert('No se pudo eliminar el producto');
    }
  };

  const openModal = (product, mode) => {
    const matrix = buildVariantMatrix(product);
    const defaults = findFirstVariant(matrix);
    setModalData({
      product,
      mode,
      color: defaults.color,
      size: defaults.size,
      quantity: '1',
      salePriceMode: 'retail',
      manualSalePrice: ''
    });
  };

  const handleModalSubmit = async () => {
    const {
      product,
      mode,
      color,
      size,
      quantity,
      salePriceMode,
      manualSalePrice
    } = modalData || {};
    const numericQuantity = Number(quantity);

    if (!product || !color || !size || Number.isNaN(numericQuantity) || numericQuantity <= 0) {
      alert('Datos invalidos');
      return;
    }

    const matrix = buildVariantMatrix(product);
    const available = Number(matrix[color]?.[size] || 0);
    if (!available) {
      alert('No hay stock disponible para la combinacion seleccionada.');
      return;
    }
    if (numericQuantity > available) {
      alert(`Solo hay ${available} unidades disponibles.`);
      return;
    }

    const url = `/api/products/${mode}/${product._id}`;
    const payload = { color, size, quantity: numericQuantity };

    if (mode === 'sell') {
      const numericManualSalePrice = Number(manualSalePrice);
      if (
        salePriceMode === 'manual' &&
        (Number.isNaN(numericManualSalePrice) || numericManualSalePrice < 0)
      ) {
        alert('Ingresa un precio manual valido.');
        return;
      }

      payload.salePriceMode = salePriceMode === 'manual' ? 'manual' : 'retail';
      if (payload.salePriceMode === 'manual') {
        payload.manualSalePrice = Number(numericManualSalePrice.toFixed(2));
      }
    }

    try {
      await axios.post(url, payload, { withCredentials: true });
      alert(mode === 'order' ? 'Pedido registrado' : 'Venta registrada');
      fetchProducts();
      setModalData(null);
    } catch (err) {
      console.error('Error al registrar:', err);
      alert('Error al registrar la accion');
    }
  };

  const resetAdvancedFilters = () => {
    setAdvancedFilters(DEFAULT_ADVANCED_FILTERS);
    setDraftFilters(DEFAULT_ADVANCED_FILTERS);
  };

  const clearAllFilters = () => {
    setStockFilter('all');
    resetAdvancedFilters();
  };

  const openFilterSheet = () => {
    setDraftFilters(advancedFilters);
    setDraftStockFilter(stockFilter);
    setIsFilterSheetOpen(true);
  };

  const applyQuickView = view => {
    if (view === 'all') {
      clearAllFilters();
      setSortBy('risk');
      return;
    }

    if (view === 'risk') {
      setStockFilter('low');
      setSortBy('risk');
      return;
    }

    if (view === 'out') {
      setStockFilter('out');
      setSortBy('risk');
      return;
    }

    if (view === 'promo') {
      setAdvancedFilters(prev => ({
        ...prev,
        promo: 'on'
      }));
      return;
    }

    if (view === 'missing-brand') {
      setAdvancedFilters(prev => ({
        ...prev,
        missing: 'brand'
      }));
    }
  };

  const removeActiveFilter = key => {
    if (key === 'stock') {
      setStockFilter('all');
      return;
    }

    setAdvancedFilters(prev => {
      if (key === 'attribute') {
        return {
          ...prev,
          attributeKey: '',
          attributeValue: ''
        };
      }

      return {
        ...prev,
        [key]: key === 'promo' || key === 'missing' ? 'all' : ''
      };
    });
  };

  useEffect(() => {
    if (modulesLoading) return;
    fetchProducts();
  }, [modulesLoading]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get('query') ?? '');
  }, [location.search]);

  useEffect(() => {
    setDraftFilters(advancedFilters);
  }, [advancedFilters]);

  useEffect(() => {
    setDraftStockFilter(stockFilter);
  }, [stockFilter]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      INVENTORY_FILTER_STORAGE_KEY,
      JSON.stringify({
        stockFilter,
        sortBy,
        advancedFilters
      })
    );
  }, [advancedFilters, sortBy, stockFilter]);

  const catalogItems = useMemo(
    () =>
      products.map(product => ({
        product,
        inventory: buildInventorySummary(product)
      })),
    [products]
  );

  const filterOptions = useMemo(() => {
    const brands = new Set();
    const collections = new Set();
    const types = new Set();
    const genders = new Set();
    const attributesMap = new Map();

    catalogItems.forEach(({ product }) => {
      if (product.brand) brands.add(String(product.brand).trim());
      if (product.collection) collections.add(String(product.collection).trim());
      if (product.type) types.add(String(product.type).trim());
      if (product.gender) genders.add(String(product.gender).trim());

      getProductAttributes(product).forEach(([key, rawValue]) => {
        const value = String(rawValue || '').trim();
        if (!key || !value) {
          return;
        }

        if (!attributesMap.has(key)) {
          attributesMap.set(key, new Set());
        }

        attributesMap.get(key).add(value);
      });
    });

    const locationKey =
      Array.from(attributesMap.keys()).find(key =>
        LOCATION_ATTRIBUTE_CANDIDATES.includes(normalizeComparableKey(key))
      ) || '';

    return {
      brands: Array.from(brands).sort((left, right) => left.localeCompare(right)),
      collections: Array.from(collections).sort((left, right) => left.localeCompare(right)),
      types: Array.from(types).sort((left, right) => left.localeCompare(right)),
      genders: Array.from(genders).sort((left, right) => left.localeCompare(right)),
      locationKey,
      locationValues: locationKey
        ? Array.from(attributesMap.get(locationKey) || []).sort((left, right) => left.localeCompare(right))
        : [],
      attributeKeys: Array.from(attributesMap.keys())
        .filter(key => key !== locationKey)
        .sort((left, right) => left.localeCompare(right)),
      attributeValuesByKey: Array.from(attributesMap.entries()).reduce((acc, [key, values]) => {
        acc[key] = Array.from(values).sort((left, right) => left.localeCompare(right));
        return acc;
      }, {})
    };
  }, [catalogItems]);

  const filteredProducts = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    const matchesSearch = item => {
      if (!normalized) return true;
      const { product } = item;
      const searchable = [
        product.name,
        product.code,
        product.sku,
        product.brand,
        product.collection,
        product.type,
        product.gender,
        ...getProductAttributes(product).map(([, value]) => value)
      ];
      return searchable.some(value =>
        String(value || '').toLowerCase().includes(normalized)
      );
    };

    const matchesStockFilter = item => {
      if (!inventoryVisible) return true;
      const { inventory } = item;
      if (stockFilter === 'out') return inventory.totalUnits === 0;
      if (stockFilter === 'low') {
        return inventory.totalUnits > 0 && (
          inventory.totalUnits <= LOW_STOCK_THRESHOLD ||
          inventory.lowStockVariants.length > 0
        );
      }
      if (stockFilter === 'healthy') {
        return inventory.totalUnits > LOW_STOCK_THRESHOLD && inventory.lowStockVariants.length === 0;
      }
      return true;
    };

    const matchesAdvancedFilters = item => {
      const { product } = item;

      const exactMatches = [
        ['brand', advancedFilters.brand, product.brand],
        ['collection', advancedFilters.collection, product.collection],
        ['type', advancedFilters.type, product.type],
        ['gender', advancedFilters.gender, product.gender]
      ];

      const hasExactMismatch = exactMatches.some(([, expected, actual]) =>
        expected && normalizeText(actual) !== normalizeText(expected)
      );
      if (hasExactMismatch) {
        return false;
      }

      if (advancedFilters.location) {
        const locationValue = getProductAttributeValue(product, filterOptions.locationKey);
        if (normalizeText(locationValue) !== normalizeText(advancedFilters.location)) {
          return false;
        }
      }

      if (advancedFilters.promo === 'on' && !product.onSale) {
        return false;
      }
      if (advancedFilters.promo === 'off' && product.onSale) {
        return false;
      }

      if (advancedFilters.missing === 'brand' && normalizeText(product.brand)) {
        return false;
      }
      if (advancedFilters.missing === 'collection' && normalizeText(product.collection)) {
        return false;
      }

      if (advancedFilters.attributeKey) {
        const attributeValue = getProductAttributeValue(product, advancedFilters.attributeKey);
        if (!attributeValue.trim()) {
          return false;
        }
        if (
          advancedFilters.attributeValue &&
          normalizeText(attributeValue) !== normalizeText(advancedFilters.attributeValue)
        ) {
          return false;
        }
      }

      return true;
    };

    const matchesMobileInventoryView = item => {
      if (mobileInventoryView === 'all') {
        return true;
      }

      if (mobileInventoryView === 'store') {
        return Boolean(item.product.storeReady);
      }

      if (mobileInventoryView === 'internal') {
        return !item.product.storeReady;
      }

      if (mobileInventoryView === 'low') {
        return item.inventory.totalUnits > 0 && (
          item.inventory.totalUnits <= LOW_STOCK_THRESHOLD ||
          item.inventory.lowStockVariants.length > 0
        );
      }

      if (mobileInventoryView === 'promo') {
        return Boolean(item.product.onSale);
      }

      return true;
    };

    return catalogItems
      .filter(
        item =>
          matchesSearch(item) &&
          matchesStockFilter(item) &&
          matchesAdvancedFilters(item) &&
          matchesMobileInventoryView(item)
      )
      .sort((left, right) => {
        if (sortBy === 'name') {
          return (left.product.name || '').localeCompare(right.product.name || '');
        }
        if (sortBy === 'stock-asc') {
          return left.inventory.totalUnits - right.inventory.totalUnits;
        }
        if (sortBy === 'stock-desc') {
          return right.inventory.totalUnits - left.inventory.totalUnits;
        }
        if (sortBy === 'price-desc') {
          return Number(right.product.price?.retail || 0) - Number(left.product.price?.retail || 0);
        }

        const leftRiskScore =
          (left.inventory.totalUnits === 0 ? 1000 : 0) +
          left.inventory.lowStockVariants.length * 100 -
          left.inventory.totalUnits;
        const rightRiskScore =
          (right.inventory.totalUnits === 0 ? 1000 : 0) +
          right.inventory.lowStockVariants.length * 100 -
          right.inventory.totalUnits;

        return rightRiskScore - leftRiskScore;
      });
  }, [advancedFilters, catalogItems, filterOptions.locationKey, inventoryVisible, mobileInventoryView, searchTerm, sortBy, stockFilter]);

  const catalogStats = useMemo(() => {
    const totalCount = catalogItems.length;
    const visibleCount = filteredProducts.length;
    const totalUnits = catalogItems.reduce((acc, item) => acc + item.inventory.totalUnits, 0);
    const lowStockCount = catalogItems.filter(
      item =>
        item.inventory.totalUnits > 0 &&
        (
          item.inventory.totalUnits <= LOW_STOCK_THRESHOLD ||
          item.inventory.lowStockVariants.length > 0
        )
    ).length;
    const outOfStockCount = catalogItems.filter(item => item.inventory.totalUnits === 0).length;
    const promoCount = catalogItems.filter(item => item.product.onSale).length;
    const missingBrandCount = catalogItems.filter(item => !normalizeText(item.product.brand)).length;
    const missingCollectionCount = catalogItems.filter(item => !normalizeText(item.product.collection)).length;

    return {
      totalCount,
      visibleCount,
      totalUnits,
      lowStockCount,
      outOfStockCount,
      promoCount,
      missingBrandCount,
      missingCollectionCount
    };
  }, [catalogItems, filteredProducts]);

  const activeFilterChips = useMemo(() => {
    const chips = [];

    if (inventoryVisible && stockFilter !== 'all') {
      chips.push({
        key: 'stock',
        label: 'Stock',
        value: STOCK_FILTERS.find(filter => filter.value === stockFilter)?.label || stockFilter
      });
    }

    if (advancedFilters.brand) {
      chips.push({ key: 'brand', label: 'Marca', value: advancedFilters.brand });
    }
    if (advancedFilters.collection) {
      chips.push({ key: 'collection', label: 'Coleccion', value: advancedFilters.collection });
    }
    if (advancedFilters.type) {
      chips.push({ key: 'type', label: 'Tipo', value: advancedFilters.type });
    }
    if (advancedFilters.gender) {
      chips.push({ key: 'gender', label: 'Genero', value: advancedFilters.gender });
    }
    if (advancedFilters.location) {
      chips.push({ key: 'location', label: 'Lugar', value: advancedFilters.location });
    }
    if (advancedFilters.promo !== 'all') {
      chips.push({
        key: 'promo',
        label: 'Promo',
        value: PROMO_FILTERS.find(filter => filter.value === advancedFilters.promo)?.label || advancedFilters.promo
      });
    }
    if (advancedFilters.missing !== 'all') {
      chips.push({
        key: 'missing',
        label: 'Dato faltante',
        value: MISSING_DATA_FILTERS.find(filter => filter.value === advancedFilters.missing)?.label || advancedFilters.missing
      });
    }
    if (advancedFilters.attributeKey) {
      chips.push({
        key: 'attribute',
        label: formatAttributeKey(advancedFilters.attributeKey),
        value: advancedFilters.attributeValue || 'Con dato'
      });
    }

    return chips;
  }, [advancedFilters, inventoryVisible, stockFilter]);

  const hasActiveFilters = activeFilterChips.length > 0;

  const headingTitle = searchTerm
    ? `Resultados para "${searchTerm}"`
    : inventoryVisible
      ? 'Inventario activo'
      : 'Catalogo activo';

  const modalVariantMatrix = useMemo(() => {
    if (!modalData?.product) return null;
    return buildVariantMatrix(modalData.product);
  }, [modalData?.product]);

  const modalColorLabelMap = useMemo(() => {
    if (!modalData?.product) return {};
    return getColorLabelMap(modalData.product);
  }, [modalData?.product]);

  const modalAvailable = useMemo(() => {
    if (!modalData || !modalVariantMatrix) return 0;
    return Number(modalVariantMatrix[modalData.color]?.[modalData.size] || 0);
  }, [modalData, modalVariantMatrix]);

  const selectedAttributeValues =
    filterOptions.attributeValuesByKey[draftFilters.attributeKey] || [];

  const mobilePrimaryStats = [
    {
      label: 'Stock bajo',
      value: inventoryVisible ? catalogStats.lowStockCount : '--'
    },
    {
      label: 'Sin stock',
      value: inventoryVisible ? catalogStats.outOfStockCount : '--'
    }
  ];

  const mobileSecondaryStats = [
    {
      label: 'Unidades',
      value: inventoryVisible ? catalogStats.totalUnits : '--'
    },
    {
      label: 'Promos',
      value: catalogStats.promoCount
    },
    {
      label: 'Sin marca',
      value: catalogStats.missingBrandCount
    },
    {
      label: 'Sin coleccion',
      value: catalogStats.missingCollectionCount
    }
  ];

  const isQuickViewActive = view => {
    if (view === 'all') {
      return !hasActiveFilters;
    }
    if (view === 'risk') {
      return stockFilter === 'low' && sortBy === 'risk';
    }
    if (view === 'out') {
      return stockFilter === 'out';
    }
    if (view === 'promo') {
      return advancedFilters.promo === 'on';
    }
    if (view === 'missing-brand') {
      return advancedFilters.missing === 'brand';
    }
    return false;
  };

  const getMobileInventoryViewCount = view => {
    if (view === 'all') {
      return catalogItems.length;
    }
    if (view === 'store') {
      return catalogItems.filter(item => item.product.storeReady).length;
    }
    if (view === 'internal') {
      return catalogItems.filter(item => !item.product.storeReady).length;
    }
    if (view === 'low') {
      return catalogItems.filter(
        item =>
          item.inventory.totalUnits > 0 &&
          (
            item.inventory.totalUnits <= LOW_STOCK_THRESHOLD ||
            item.inventory.lowStockVariants.length > 0
          )
      ).length;
    }
    if (view === 'promo') {
      return catalogItems.filter(item => item.product.onSale).length;
    }
    return 0;
  };

  const renderSelect = (label, value, onChange, options, placeholder, disabled = false) => (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="mt-1 w-full rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-surface-50 disabled:text-slate-400"
      >
        <option value="">{placeholder}</option>
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm lg:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold text-slate-900">{headingTitle}</h2>
                <span className="metric-chip">
                  {catalogStats.visibleCount} de {catalogStats.totalCount}
                </span>
                {isRefreshing && (
                  <span className="metric-chip border border-brand/20 bg-brand/5 text-brand">
                    Actualizando
                  </span>
                )}
              </div>
              <p className="max-w-3xl text-sm text-slate-500">
                {inventoryVisible
                  ? 'Filtra por marca, coleccion o riesgo operativo sin salir del inventario.'
                  : 'Vista de catalogo para revisar fichas, precios y estructura del producto.'}
              </p>
              {!inventoryVisible && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Inventario no disponible para tu perfil. Solo se muestran datos de catalogo.
                </div>
              )}
            </div>

            <div className="space-y-3 md:hidden">
              <div className="grid grid-cols-2 gap-3">
                {mobilePrimaryStats.map(item => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3"
                  >
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>

              {isMobileSummaryExpanded && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {mobileSecondaryStats.map(item => (
                    <div
                      key={item.label}
                      className="min-w-[122px] rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3"
                    >
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsMobileSummaryExpanded(prev => !prev)}
                className="inline-flex items-center justify-center rounded-full border border-surface-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand/30 hover:text-brand"
              >
                {isMobileSummaryExpanded ? 'Ver menos' : 'Ver resumen completo'}
              </button>
            </div>

            <div className="hidden gap-3 sm:grid-cols-2 md:grid xl:w-[520px] xl:grid-cols-3">
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Stock bajo</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {inventoryVisible ? catalogStats.lowStockCount : '--'}
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Sin stock</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {inventoryVisible ? catalogStats.outOfStockCount : '--'}
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Unidades</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {inventoryVisible ? catalogStats.totalUnits : '--'}
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Promos</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{catalogStats.promoCount}</p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Sin marca</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{catalogStats.missingBrandCount}</p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Sin coleccion</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{catalogStats.missingCollectionCount}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-surface-200 bg-white p-4 shadow-sm lg:p-5">
          <div className="space-y-4">
            <div className="hidden gap-2 overflow-x-auto pb-1 md:flex">
              {QUICK_VIEWS.map(view => (
                <button
                  key={view.value}
                  type="button"
                  onClick={() => applyQuickView(view.value)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition ${
                    isQuickViewActive(view.value)
                      ? 'bg-slate-950 text-white'
                      : 'border border-surface-200 bg-white text-slate-600 hover:border-brand/30 hover:text-brand'
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3 md:hidden">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {MOBILE_INVENTORY_VIEWS.map(view => (
                    <button
                      key={view.value}
                      type="button"
                      onClick={() => setMobileInventoryView(view.value)}
                      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition ${
                        mobileInventoryView === view.value
                          ? 'bg-slate-950 text-white'
                          : 'border border-surface-200 bg-white text-slate-600'
                      }`}
                    >
                      <span>{view.label}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        mobileInventoryView === view.value ? 'bg-white/15 text-white' : 'bg-surface-100 text-slate-500'
                      }`}>
                        {getMobileInventoryViewCount(view.value)}
                      </span>
                    </button>
                  ))}
                </div>

                <div className={`${canCreateProducts ? 'grid grid-cols-[minmax(0,1fr)_auto] gap-3' : ''}`}>
                  <button
                    type="button"
                    onClick={openFilterSheet}
                    className="w-full rounded-2xl border border-surface-200 bg-white px-4 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                  >
                    <span>Filtros</span>
                    <span className="ml-2 text-xs text-slate-400">
                      {hasActiveFilters ? `${activeFilterChips.length} activos` : 'Sin filtros'}
                    </span>
                  </button>
                  {canCreateProducts && (
                    <button
                      type="button"
                      onClick={() => navigate('/crear-producto')}
                      className="whitespace-nowrap rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
                    >
                      Nuevo
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <select
                    value={sortBy}
                    onChange={event => setSortBy(event.target.value)}
                    className="rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  >
                    {SORT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={fetchProducts}
                    className="rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-brand/30 hover:text-brand"
                  >
                    Actualizar
                  </button>
                </div>

                {(hasActiveFilters || searchTerm) && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-surface-100 px-3 py-1.5 font-semibold text-slate-500">
                      {filteredProducts.length} visibles
                    </span>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="rounded-full border border-surface-200 bg-white px-3 py-1.5 font-semibold text-slate-600 transition hover:border-brand/30 hover:text-brand"
                      >
                        Limpiar filtros
                      </button>
                    )}
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="rounded-full bg-brand/10 px-3 py-1.5 font-semibold text-brand transition hover:bg-brand/20"
                      >
                        Limpiar busqueda
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="hidden md:grid md:flex-1 md:grid-cols-2 md:gap-3 xl:grid-cols-4">
                {renderSelect(
                  'Marca',
                  advancedFilters.brand,
                  event => setAdvancedFilters(prev => ({ ...prev, brand: event.target.value })),
                  filterOptions.brands,
                  'Todas las marcas'
                )}
                {renderSelect(
                  'Coleccion',
                  advancedFilters.collection,
                  event => setAdvancedFilters(prev => ({ ...prev, collection: event.target.value })),
                  filterOptions.collections,
                  'Todas las colecciones'
                )}
                {renderSelect(
                  'Tipo',
                  advancedFilters.type,
                  event => setAdvancedFilters(prev => ({ ...prev, type: event.target.value })),
                  filterOptions.types,
                  'Todos los tipos'
                )}
                {renderSelect(
                  'Genero',
                  advancedFilters.gender,
                  event => setAdvancedFilters(prev => ({ ...prev, gender: event.target.value })),
                  filterOptions.genders,
                  'Todos los generos'
                )}
                {renderSelect(
                  'Lugar',
                  advancedFilters.location,
                  event => setAdvancedFilters(prev => ({ ...prev, location: event.target.value })),
                  filterOptions.locationValues,
                  'Todos los lugares',
                  !filterOptions.locationKey
                )}

                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Promocion
                  </span>
                  <select
                    value={advancedFilters.promo}
                    onChange={event => setAdvancedFilters(prev => ({ ...prev, promo: event.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  >
                    {PROMO_FILTERS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {inventoryVisible && (
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Estado stock
                    </span>
                    <select
                      value={stockFilter}
                      onChange={event => setStockFilter(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                    >
                      {STOCK_FILTERS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Dato faltante
                  </span>
                  <select
                    value={advancedFilters.missing}
                    onChange={event => setAdvancedFilters(prev => ({ ...prev, missing: event.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  >
                    {MISSING_DATA_FILTERS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Atributo extra
                  </span>
                  <select
                    value={advancedFilters.attributeKey}
                    onChange={event => {
                      const nextKey = event.target.value;
                      setAdvancedFilters(prev => ({
                        ...prev,
                        attributeKey: nextKey,
                        attributeValue: ''
                      }));
                    }}
                    className="mt-1 w-full rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  >
                    <option value="">Sin atributo extra</option>
                    {filterOptions.attributeKeys.map(key => (
                      <option key={key} value={key}>
                        {formatAttributeKey(key)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Valor atributo
                  </span>
                  <select
                    value={advancedFilters.attributeValue}
                    onChange={event => setAdvancedFilters(prev => ({ ...prev, attributeValue: event.target.value }))}
                    disabled={!advancedFilters.attributeKey}
                    className="mt-1 w-full rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-surface-50 disabled:text-slate-400"
                  >
                    <option value="">
                      {advancedFilters.attributeKey ? 'Cualquier valor' : 'Selecciona un atributo'}
                    </option>
                    {(filterOptions.attributeValuesByKey[advancedFilters.attributeKey] || []).map(value => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="hidden md:flex md:flex-col md:gap-3 lg:flex-row lg:flex-wrap lg:items-center xl:justify-end">
                <select
                  value={sortBy}
                  onChange={event => setSortBy(event.target.value)}
                  className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  {SORT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={fetchProducts}
                  className="rounded-xl border border-surface-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                >
                  Actualizar
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="rounded-xl border border-surface-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                  >
                    Limpiar filtros
                  </button>
                )}
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="rounded-xl bg-brand/10 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/20"
                  >
                    Limpiar busqueda
                  </button>
                )}
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2">
                {activeFilterChips.map(chip => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => removeActiveFilter(chip.key)}
                    className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/10"
                  >
                    <span>{chip.label}: {chip.value}</span>
                    <span className="text-brand/70">x</span>
                  </button>
                ))}
              </div>
            )}

          </div>
        </section>

        {filteredProducts.length ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredProducts.map(({ product, inventory }) => {
                const inventoryMeta = getInventoryHealthMeta(inventory);
                const showExpandedActions = expandedMobileActionId === product._id;
                const mobilePreviewVariants = inventory.previewVariants.slice(0, 2);
                const remainingVariantCount = Math.max(inventory.previewVariants.length - mobilePreviewVariants.length, 0);

                return (
                  <article key={product._id} className="rounded-[1.75rem] border border-surface-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="h-16 w-16 flex-none overflow-hidden rounded-2xl bg-surface-100">
                        <ProductImage
                          src={getAdminPreviewImage(product)}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-[15px] font-semibold text-slate-900">{product.name}</h3>
                          {inventoryVisible && (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${inventoryMeta.className}`}>
                              {inventoryMeta.label}
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              product.storeReady
                                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border border-amber-200 bg-amber-50 text-amber-700'
                            }`}
                          >
                            {product.storeReady ? 'Tienda' : 'Solo interna'}
                          </span>
                          {product.onSale && (
                            <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-700">
                              Promo
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Cod. {product.code}{product.brand ? ` - ${product.brand}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {product.collection || 'Sin coleccion'} / {product.gender || 'Sin genero'}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="text-base font-semibold text-slate-900">
                            {formatCurrency(product.price?.retail)}
                          </p>
                          {inventoryVisible && (
                            <div className="flex flex-wrap justify-end gap-2 text-[11px]">
                              <span className="metric-chip">Stock {inventory.totalUnits}</span>
                              <span className="metric-chip">{inventory.activeVariants.length} variantes</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {inventoryVisible && inventory.previewVariants.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {mobilePreviewVariants.map(variant => (
                          <span
                            key={variant.key}
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${getVariantPillClassName(variant.qty)}`}
                          >
                            <span>{variant.colorLabel}/{variant.size}</span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              {variant.qty}
                            </span>
                          </span>
                        ))}
                        {remainingVariantCount > 0 && (
                          <span className="inline-flex items-center rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                            +{remainingVariantCount} mas
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                      {inventoryVisible && canAdjustInventory ? (
                        <button
                          type="button"
                          onClick={() => openModal(product, 'sell')}
                          className="rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white"
                        >
                          Venta
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate(`/product-private/${product._id}`)}
                          className="rounded-2xl border border-surface-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                        >
                          Ver
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedMobileActionId(prev => (prev === product._id ? null : product._id))}
                        className="rounded-2xl border border-surface-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                      >
                        {showExpandedActions ? 'Menos' : 'Mas'}
                      </button>
                    </div>

                    {showExpandedActions && (
                      <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-surface-200 bg-surface-50 p-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/product-private/${product._id}`)}
                          className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          Ver
                        </button>
                        {canEditProducts && (
                          <button
                            type="button"
                            onClick={() => navigate(`/editar-producto/${product._id}`)}
                            className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                          >
                            Editar
                          </button>
                        )}
                        {inventoryVisible && canAdjustInventory && (
                          <button
                            type="button"
                            onClick={() => openModal(product, 'order')}
                            className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                          >
                            Pedido
                          </button>
                        )}
                        {canDeleteProducts && (
                          <button
                            type="button"
                            onClick={() => handleDelete(product._id)}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <section className="hidden overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-surface-200">
                  <thead className="bg-surface-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Producto</th>
                      <th className="px-4 py-3 font-semibold">Retail</th>
                      <th className="px-4 py-3 font-semibold">Niveles</th>
                      {inventoryVisible && (
                        <>
                          <th className="px-4 py-3 font-semibold">Estado</th>
                          <th className="px-4 py-3 font-semibold">Stock</th>
                          <th className="px-4 py-3 font-semibold">Variantes</th>
                        </>
                      )}
                      <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-200 text-sm text-slate-700">
                    {filteredProducts.map(({ product, inventory }) => {
                      const inventoryMeta = getInventoryHealthMeta(inventory);

                      return (
                        <tr key={product._id} className="align-top">
                          <td className="px-4 py-4">
                            <div className="flex items-start gap-3">
                              <div className="h-16 w-16 flex-none overflow-hidden rounded-2xl bg-surface-100">
                                <ProductImage
                                  src={getAdminPreviewImage(product)}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-slate-900">{product.name}</p>
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                      product.storeReady
                                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : 'border border-amber-200 bg-amber-50 text-amber-700'
                                    }`}
                                  >
                                    {product.storeReady ? 'Tienda' : 'Solo interna'}
                                  </span>
                                  {product.onSale && (
                                    <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-700">
                                      Promo
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                                  {product.gender || 'Sin genero'} / {product.type || 'Sin tipo'}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                  <span>Cod. {product.code}</span>
                                  {product.brand && <span>{product.brand}</span>}
                                  {product.collection && <span>{product.collection}</span>}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 font-semibold text-slate-900">
                            {formatCurrency(product.price?.retail)}
                          </td>

                          <td className="px-4 py-4">
                            <div className="space-y-1 text-xs text-slate-500">
                              <p>Gold: <span className="font-semibold text-slate-700">{formatCurrency(product.price?.gold ?? product.price?.retail)}</span></p>
                              <p>Premium: <span className="font-semibold text-slate-700">{formatCurrency(product.price?.premium ?? product.price?.retail)}</span></p>
                              <p>Platinum: <span className="font-semibold text-slate-700">{formatCurrency(product.price?.platinum ?? product.price?.retail)}</span></p>
                            </div>
                          </td>

                          {inventoryVisible && (
                            <>
                              <td className="px-4 py-4">
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${inventoryMeta.className}`}>
                                  {inventoryMeta.label}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <div className="space-y-1 text-xs text-slate-500">
                                  <p className="text-sm font-semibold text-slate-900">{inventory.totalUnits} uds</p>
                                  <p>{inventory.activeVariants.length} variantes activas</p>
                                  <p>{inventory.colorsWithStock}/{inventory.colorCount} colores</p>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex max-w-[360px] flex-wrap gap-2">
                                  {inventory.previewVariants.length ? (
                                    inventory.previewVariants.map(variant => (
                                      <span
                                        key={variant.key}
                                        className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-medium ${getVariantPillClassName(variant.qty)}`}
                                      >
                                        <span className="max-w-[120px] truncate">
                                          {variant.colorLabel}/{variant.size}
                                        </span>
                                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                          {variant.qty}
                                        </span>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-slate-400">Sin variantes</span>
                                  )}
                                </div>
                              </td>
                            </>
                          )}

                          <td className="px-4 py-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => navigate(`/product-private/${product._id}`)}
                                className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                              >
                                Ver detalle
                              </button>
                              {canEditProducts && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/editar-producto/${product._id}`)}
                                  className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                                >
                                  Editar
                                </button>
                              )}
                              {inventoryVisible && canAdjustInventory && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openModal(product, 'order')}
                                    className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                                  >
                                    Pedido
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openModal(product, 'sell')}
                                    className="rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark"
                                  >
                                    Venta
                                  </button>
                                </>
                              )}
                              {canDeleteProducts && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(product._id)}
                                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                                >
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-surface-200 bg-white px-6 py-14 text-center text-slate-500">
            <p className="mb-2 text-lg font-semibold text-slate-700">Sin resultados</p>
            <p className="text-sm">
              No encontramos productos con los filtros actuales.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                Volver al inventario
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-full border border-surface-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                >
                  Quitar filtros
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {isFilterSheetOpen && (
        <div className="fixed inset-0 z-[1150] md:hidden">
          <button
            type="button"
            aria-label="Cerrar filtros"
            onClick={() => setIsFilterSheetOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-[28px] bg-white shadow-card-lg">
            <div className="flex max-h-[85vh] flex-col">
              <div className="px-4 pt-4">
                <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-200" />
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Filtros</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">Navegacion movil</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Marca, stock y atributos del catalogo en una sola vista.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFilterSheetOpen(false)}
                    className="rounded-xl border border-surface-200 px-3 py-2 text-sm font-semibold text-slate-600"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="grid gap-4">
              {renderSelect(
                'Marca',
                draftFilters.brand,
                event => setDraftFilters(prev => ({ ...prev, brand: event.target.value })),
                filterOptions.brands,
                'Todas las marcas'
              )}
              {renderSelect(
                'Coleccion',
                draftFilters.collection,
                event => setDraftFilters(prev => ({ ...prev, collection: event.target.value })),
                filterOptions.collections,
                'Todas las colecciones'
              )}
              {renderSelect(
                'Tipo',
                draftFilters.type,
                event => setDraftFilters(prev => ({ ...prev, type: event.target.value })),
                filterOptions.types,
                'Todos los tipos'
              )}
              {renderSelect(
                'Genero',
                draftFilters.gender,
                event => setDraftFilters(prev => ({ ...prev, gender: event.target.value })),
                filterOptions.genders,
                'Todos los generos'
              )}
              {renderSelect(
                'Lugar',
                draftFilters.location,
                event => setDraftFilters(prev => ({ ...prev, location: event.target.value })),
                filterOptions.locationValues,
                'Todos los lugares',
                !filterOptions.locationKey
              )}

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Promocion
                </span>
                <select
                  value={draftFilters.promo}
                  onChange={event => setDraftFilters(prev => ({ ...prev, promo: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  {PROMO_FILTERS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {inventoryVisible && (
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Estado stock
                  </span>
                  <select
                    value={draftStockFilter}
                    onChange={event => setDraftStockFilter(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  >
                    {STOCK_FILTERS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Dato faltante
                </span>
                <select
                  value={draftFilters.missing}
                  onChange={event => setDraftFilters(prev => ({ ...prev, missing: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  {MISSING_DATA_FILTERS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Atributo extra
                </span>
                <select
                  value={draftFilters.attributeKey}
                  onChange={event => {
                    const nextKey = event.target.value;
                    setDraftFilters(prev => ({
                      ...prev,
                      attributeKey: nextKey,
                      attributeValue: ''
                    }));
                  }}
                  className="mt-1 w-full rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Sin atributo extra</option>
                  {filterOptions.attributeKeys.map(key => (
                    <option key={key} value={key}>
                      {formatAttributeKey(key)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Valor atributo
                </span>
                <select
                  value={draftFilters.attributeValue}
                  onChange={event => setDraftFilters(prev => ({ ...prev, attributeValue: event.target.value }))}
                  disabled={!draftFilters.attributeKey}
                  className="mt-1 w-full rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-surface-50 disabled:text-slate-400"
                >
                  <option value="">
                    {draftFilters.attributeKey ? 'Cualquier valor' : 'Selecciona un atributo'}
                  </option>
                  {selectedAttributeValues.map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
                </div>
              </div>

              <div className="border-t border-surface-200 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      clearAllFilters();
                      setIsFilterSheetOpen(false);
                    }}
                    className="rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    Limpiar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStockFilter(draftStockFilter);
                      setAdvancedFilters(draftFilters);
                      setIsFilterSheetOpen(false);
                    }}
                    className="rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white"
                  >
                    Aplicar filtros
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalData && modalVariantMatrix && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-card-lg">
            <div className="mb-5">
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                {modalData.mode === 'order' ? 'Registrar pedido' : 'Registrar venta'}
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                {modalData.product?.name}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Selecciona la variante exacta antes de confirmar el movimiento.
              </p>
            </div>

            <label className="block text-sm font-medium text-slate-600">Color</label>
            <select
              value={modalData.color}
              onChange={event => {
                const nextColor = event.target.value;
                const sizeKeys = Object.keys(modalVariantMatrix[nextColor] || {});
                setModalData(prev => ({
                  ...prev,
                  color: nextColor,
                  size: sizeKeys[0] || '',
                  quantity: '1'
                }));
              }}
              className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              {Object.keys(modalVariantMatrix).map(color => (
                <option key={color} value={color}>
                  {modalColorLabelMap[color] || color}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-sm font-medium text-slate-600">Talla</label>
            <select
              value={modalData.size}
              onChange={event => setModalData({ ...modalData, size: event.target.value })}
              className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              <option value="">Selecciona una talla</option>
              {Object.keys(modalVariantMatrix[modalData.color] || {}).map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-sm font-medium text-slate-600">Cantidad</label>
            <input
              type="number"
              min="1"
              max={modalAvailable || undefined}
              inputMode="numeric"
              value={modalData.quantity}
              onChange={event => {
                const nextValue = event.target.value;
                if (nextValue === '') {
                  setModalData({ ...modalData, quantity: '' });
                  return;
                }

                setModalData({ ...modalData, quantity: nextValue });
              }}
              onBlur={() => {
                const next = parseInt(modalData.quantity, 10);
                if (Number.isNaN(next) || next <= 0) {
                  setModalData(prev => ({ ...prev, quantity: '1' }));
                  return;
                }

                const clamped = modalAvailable ? Math.min(next, modalAvailable) : next;
                setModalData(prev => ({ ...prev, quantity: String(clamped) }));
              }}
              placeholder="Ingresa cantidad"
              className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
            />

            {modalData.mode === 'sell' && (
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-medium text-slate-600">Precio de venta</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setModalData(prev => ({
                        ...prev,
                        salePriceMode: 'retail'
                      }))
                    }
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      modalData.salePriceMode === 'retail'
                        ? 'border-brand bg-brand/5 text-brand'
                        : 'border-surface-200 bg-white text-slate-600'
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.22em]">Precio detallado</p>
                    <p className="mt-2 text-base font-semibold">
                      {formatCurrency(modalData.product?.price?.retail)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Usar el precio base del producto.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setModalData(prev => ({
                        ...prev,
                        salePriceMode: 'manual'
                      }))
                    }
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      modalData.salePriceMode === 'manual'
                        ? 'border-brand bg-brand/5 text-brand'
                        : 'border-surface-200 bg-white text-slate-600'
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.22em]">Precio manual</p>
                    <p className="mt-2 text-base font-semibold">Ingresar valor</p>
                    <p className="mt-1 text-xs text-slate-500">Para descuentos o ventas especiales.</p>
                  </button>
                </div>

                {modalData.salePriceMode === 'manual' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600">Valor cobrado</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={modalData.manualSalePrice}
                      onChange={event =>
                        setModalData(prev => ({
                          ...prev,
                          manualSalePrice: event.target.value
                        }))
                      }
                      placeholder="Ej. 49.99"
                      className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 rounded-2xl border border-surface-200 bg-surface-50 px-3 py-3 text-sm">
              {modalAvailable ? (
                <p className="text-slate-600">
                  Disponible para esta variante: <strong className="text-slate-900">{modalAvailable}</strong>
                </p>
              ) : (
                <p className="text-red-600">No hay stock para la combinacion seleccionada.</p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalData(null)}
                className="rounded-xl border border-surface-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleModalSubmit}
                disabled={!canAdjustInventory}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand-sm hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPage;
