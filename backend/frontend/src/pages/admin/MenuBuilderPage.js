import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../../api/axiosInstance';
import { buildProductFilterUrl } from '../../utils/productFilters';

const ITEM_KINDS = [
  { value: 'link', label: 'Enlace directo' },
  { value: 'collection', label: 'Coleccion' },
  { value: 'category', label: 'Categoria' },
  { value: 'filter', label: 'Filtro dinamico' }
];

const createId = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `tmp-${Date.now()}-${Math.random()}`);

const createEmptyColumnItem = () => ({
  id: createId(),
  label: '',
  href: '',
  badge: '',
  order: 0
});

const createEmptyColumn = () => ({
  id: createId(),
  title: '',
  order: 0,
  items: [createEmptyColumnItem()]
});

const createEmptyItem = () => ({
  id: createId(),
  label: 'Nuevo enlace',
  kind: 'link',
  href: '',
  badge: '',
  settings: {},
  megaMenu: null,
  order: 0
});

const createEmptyRow = type => ({
  id: createId(),
  title: type === 'highlight' ? 'Destacados' : 'Categorias',
  type,
  order: 0,
  items: [createEmptyItem()]
});

const normalizeMenu = payload => {
  const safeRows = Array.isArray(payload?.rows) ? payload.rows : [];

  return {
    title: payload?.title ?? 'Menu principal',
    rows: safeRows.map((row, rowIndex) => {
      const safeItems = Array.isArray(row?.items) ? row.items : [];
      return {
        id: row?.id || createId(),
        title: row?.title ?? '',
        type: ['highlight', 'category'].includes(row?.type) ? row.type : 'highlight',
        order: Number.isFinite(row?.order) ? row.order : rowIndex,
        items: safeItems.map((item, itemIndex) => {
          const mega = item?.megaMenu;
          let megaMenu = null;
          if (mega && typeof mega === 'object') {
            const columns = Array.isArray(mega.columns)
              ? mega.columns.map((column, columnIndex) => ({
                  id: column?.id || createId(),
                  title: column?.title ?? '',
                  order: Number.isFinite(column?.order) ? column.order : columnIndex,
                  items: Array.isArray(column?.items)
                    ? column.items.map((columnItem, columnItemIndex) => ({
                        id: columnItem?.id || createId(),
                        label: columnItem?.label ?? 'Sin titulo',
                        href: columnItem?.href ?? '#',
                        badge: columnItem?.badge ?? '',
                        order: Number.isFinite(columnItem?.order) ? columnItem.order : columnItemIndex
                      }))
                    : []
                }))
              : [];
            const featured = mega.featured && typeof mega.featured === 'object'
              ? {
                title: mega.featured.title ?? '',
                description: mega.featured.description ?? '',
                href: mega.featured.href ?? '',
                imageUrl: mega.featured.imageUrl ?? ''
              }
              : null;
            megaMenu = { columns, featured };
          }

          return {
            id: item?.id || createId(),
            label: item?.label ?? 'Nuevo enlace',
            kind: ['link', 'collection', 'category', 'filter'].includes(item?.kind) ? item.kind : 'link',
            href: item?.href ?? '',
            badge: item?.badge ?? '',
            settings: item?.settings && typeof item.settings === 'object' ? item.settings : {},
            megaMenu,
            order: Number.isFinite(item?.order) ? item.order : itemIndex
          };
        })
      };
    })
  };
};

const MenuBuilderPage = () => {
  const [menu, setMenu] = useState({ title: 'Menu principal', rows: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [megaExpanded, setMegaExpanded] = useState({});
  const [categories, setCategories] = useState({ brand: [], type: [], size: [], collection: [], gender: [] });

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: menuData }, { data: categoryData }] = await Promise.all([
        axios.get('/api/navigation', { withCredentials: true }),
        axios.get('/api/categories', { withCredentials: true }).catch(() => ({ data: {} }))
      ]);

      setMenu(normalizeMenu(menuData));
      setCategories({
        brand: categoryData.brand || [],
        type: categoryData.type || [],
        size: categoryData.size || [],
        collection: categoryData.collection || [],
        gender: categoryData.gender || []
      });
      setError('');
    } catch (err) {
      console.error('Error cargando menu', err);
      setError('No se pudo cargar el menu. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const updateRows = updater => {
    setMenu(prev => ({ ...prev, rows: updater(prev.rows) }));
  };

  const updateRow = (rowId, updater) => {
    updateRows(rows => rows.map(row => (row.id === rowId ? updater(row) : row)));
  };

  const updateItem = (rowId, itemId, updater) => {
    updateRow(rowId, row => ({
      ...row,
      items: row.items.map(item => (item.id === itemId ? updater(item) : item))
    }));
  };

  const updateItemSettings = (rowId, itemId, key, value) => {
    updateItem(rowId, itemId, item => {
      const next = { ...item.settings };
      if (value === "" || value == null) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return { ...item, settings: next };
    });
  };

  const rowsByType = useMemo(
    () => ({
      highlight: menu.rows.filter(row => row.type === 'highlight'),
      category: menu.rows.filter(row => row.type === 'category')
    }),
    [menu.rows]
  );

  const addRow = type => {
    updateRows(rows => [...rows, createEmptyRow(type)]);
  };

  const removeRow = rowId => {
    updateRows(rows => rows.filter(row => row.id !== rowId));
  };

  const addItem = rowId => {
    updateRow(rowId, row => ({
      ...row,
      items: [...row.items, createEmptyItem()]
    }));
  };

  const removeItem = (rowId, itemId) => {
    updateRow(rowId, row => ({
      ...row,
      items: row.items.filter(item => item.id !== itemId)
    }));
  };

  const toggleMegaMenu = itemId => {
    setMegaExpanded(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const ensureMegaMenu = (rowId, itemId) => {
    updateItem(rowId, itemId, item => item.megaMenu
      ? item
      : { ...item, megaMenu: { columns: [createEmptyColumn()], featured: null } });
  };

  const disableMegaMenu = (rowId, itemId) => {
    updateItem(rowId, itemId, item => ({ ...item, megaMenu: null }));
  };

  const addColumn = (rowId, itemId) => {
    updateItem(rowId, itemId, item => {
      const mega = item.megaMenu || { columns: [], featured: null };
      return {
        ...item,
        megaMenu: {
          columns: [...mega.columns, createEmptyColumn()],
          featured: mega.featured ?? null
        }
      };
    });
  };

  const removeColumn = (rowId, itemId, columnId) => {
    updateItem(rowId, itemId, item => {
      if (!item.megaMenu) return item;
      return {
        ...item,
        megaMenu: {
          ...item.megaMenu,
          columns: item.megaMenu.columns.filter(column => column.id !== columnId)
        }
      };
    });
  };

  const updateColumn = (rowId, itemId, columnId, changes) => {
    updateItem(rowId, itemId, item => {
      if (!item.megaMenu) return item;
      return {
        ...item,
        megaMenu: {
          ...item.megaMenu,
          columns: item.megaMenu.columns.map(column =>
            column.id === columnId ? { ...column, ...changes } : column
          )
        }
      };
    });
  };

  const addColumnItem = (rowId, itemId, columnId) => {
    updateItem(rowId, itemId, item => {
      if (!item.megaMenu) return item;
      return {
        ...item,
        megaMenu: {
          ...item.megaMenu,
          columns: item.megaMenu.columns.map(column =>
            column.id === columnId
              ? { ...column, items: [...column.items, createEmptyColumnItem()] }
              : column
          )
        }
      };
    });
  };

  const updateColumnItem = (rowId, itemId, columnId, columnItemId, changes) => {
    updateItem(rowId, itemId, item => {
      if (!item.megaMenu) return item;
      return {
        ...item,
        megaMenu: {
          ...item.megaMenu,
          columns: item.megaMenu.columns.map(column =>
            column.id === columnId
              ? {
                ...column,
                items: column.items.map(columnItem =>
                  columnItem.id === columnItemId ? { ...columnItem, ...changes } : columnItem
                )
              }
              : column
          )
        }
      };
    });
  };

  const removeColumnItem = (rowId, itemId, columnId, columnItemId) => {
    updateItem(rowId, itemId, item => {
      if (!item.megaMenu) return item;
      return {
        ...item,
        megaMenu: {
          ...item.megaMenu,
          columns: item.megaMenu.columns.map(column =>
            column.id === columnId
              ? {
                ...column,
                items: column.items.filter(columnItem => columnItem.id !== columnItemId)
              }
              : column
          )
        }
      };
    });
  };

  const updateFeatured = (rowId, itemId, changes) => {
    updateItem(rowId, itemId, item => {
      const mega = item.megaMenu || { columns: [], featured: null };
      return {
        ...item,
        megaMenu: {
          columns: mega.columns,
          featured: { ...(mega.featured || { title: '', description: '', href: '', imageUrl: '' }), ...changes }
        }
      };
    });
  };

  const clearFeatured = (rowId, itemId) => {
    updateItem(rowId, itemId, item => {
      if (!item.megaMenu) return item;
      return {
        ...item,
        megaMenu: { ...item.megaMenu, featured: null }
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await axios.put('/api/navigation', menu, { withCredentials: true });
      await fetchMenu();
    } catch (err) {
      console.error('Error guardando menu', err);
      setError(err?.response?.data?.message || 'No se pudo guardar el menu');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-600">Cargando configuracion del menu...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Constructor de menu principal</h1>
          <p className="text-sm text-gray-500">
            Organiza las dos filas del header, asigna filtros dinamicos y mega menues por categoria.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="bg-white rounded-lg shadow p-5 space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Titulo interno
          <input
            type="text"
            value={menu.title}
            onChange={event => setMenu(prev => ({ ...prev, title: event.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <MenuRowsSection
            title="Fila superior (destacados)"
            addRow={() => addRow('highlight')}
            rows={rowsByType.highlight}
            rowLabel="destacados"
            removeRow={removeRow}
            handleRowChange={updateRow}
            addItem={addItem}
            removeItem={removeItem}
            updateItem={updateItem}
            updateItemSettings={updateItemSettings}
            megaExpanded={megaExpanded}
            toggleMegaMenu={toggleMegaMenu}
            ensureMegaMenu={ensureMegaMenu}
            disableMegaMenu={disableMegaMenu}
            addColumn={addColumn}
            removeColumn={removeColumn}
            updateColumn={updateColumn}
            addColumnItem={addColumnItem}
            updateColumnItem={updateColumnItem}
            removeColumnItem={removeColumnItem}
            updateFeatured={updateFeatured}
            clearFeatured={clearFeatured}
            categories={categories}
          />

          <MenuRowsSection
            title="Fila inferior (categorias)"
            addRow={() => addRow('category')}
            rows={rowsByType.category}
            rowLabel="categorias"
            removeRow={removeRow}
            handleRowChange={updateRow}
            addItem={addItem}
            removeItem={removeItem}
            updateItem={updateItem}
            updateItemSettings={updateItemSettings}
            megaExpanded={megaExpanded}
            toggleMegaMenu={toggleMegaMenu}
            ensureMegaMenu={ensureMegaMenu}
            disableMegaMenu={disableMegaMenu}
            addColumn={addColumn}
            removeColumn={removeColumn}
            updateColumn={updateColumn}
            addColumnItem={addColumnItem}
            updateColumnItem={updateColumnItem}
            removeColumnItem={removeColumnItem}
            updateFeatured={updateFeatured}
            clearFeatured={clearFeatured}
            categories={categories}
          />
        </div>
      </section>
    </div>
  );
};

const MenuRowsSection = ({
  title,
  addRow,
  rows,
  rowLabel,
  removeRow,
  handleRowChange,
  addItem,
  removeItem,
  updateItem,
  updateItemSettings,
  megaExpanded,
  toggleMegaMenu,
  ensureMegaMenu,
  disableMegaMenu,
  addColumn,
  removeColumn,
  updateColumn,
  addColumnItem,
  updateColumnItem,
  removeColumnItem,
  updateFeatured,
  clearFeatured,
  categories
}) => (
  <div className="border rounded-lg p-4">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <button type="button" onClick={addRow} className="text-sm text-blue-600 hover:underline">
        Anadir fila
      </button>
    </div>
    {rows.length ? (
      rows.map(row => (
        <div key={row.id} className="mb-4 border border-gray-200 rounded-md bg-gray-50 p-3 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              type="text"
              value={row.title}
              onChange={event => handleRowChange(row.id, row => ({ ...row, title: event.target.value }))}
              placeholder={`Titulo opcional para ${rowLabel}`}
              className="flex-1 rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
            />
            <label className="text-xs font-medium text-gray-600 flex items-center gap-2">
              Orden
              <input
                type="number"
                value={row.order ?? 0}
                onChange={event =>
                  handleRowChange(row.id, row => ({ ...row, order: Number(event.target.value) || 0 }))
                }
                className="w-20 rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
              />
            </label>
            <button type="button" onClick={() => removeRow(row.id)} className="text-sm text-red-600 hover:underline">
              Eliminar fila
            </button>
          </div>

          <div className="space-y-3">
            {row.items.map(item => (
              <MenuItemEditor
                key={item.id}
                rowId={row.id}
                item={item}
                removeItem={removeItem}
                updateItem={updateItem}
                updateItemSettings={updateItemSettings}
                megaExpanded={megaExpanded}
                toggleMegaMenu={toggleMegaMenu}
                ensureMegaMenu={ensureMegaMenu}
                disableMegaMenu={disableMegaMenu}
                addColumn={addColumn}
                removeColumn={removeColumn}
                updateColumn={updateColumn}
                addColumnItem={addColumnItem}
                updateColumnItem={updateColumnItem}
                removeColumnItem={removeColumnItem}
                updateFeatured={updateFeatured}
                clearFeatured={clearFeatured}
                categories={categories}
              />
            ))}

            <button
              type="button"
              onClick={() => addItem(row.id)}
              className="text-sm text-blue-600 hover:underline"
            >
              Anadir enlace
            </button>
          </div>
        </div>
      ))
    ) : (
      <p className="text-sm text-gray-500">No hay filas configuradas.</p>
    )}
  </div>
);

const MenuItemEditor = ({
  rowId,
  item,
  removeItem,
  updateItem,
  updateItemSettings,
  megaExpanded,
  toggleMegaMenu,
  ensureMegaMenu,
  disableMegaMenu,
  addColumn,
  removeColumn,
  updateColumn,
  addColumnItem,
  updateColumnItem,
  removeColumnItem,
  updateFeatured,
  clearFeatured,
  categories
}) => {
  const filterKeyOptions = useMemo(
    () => [
      { value: 'collection', label: 'Coleccion', values: categories.collection || [] },
      { value: 'gender', label: 'Genero', values: categories.gender || [] },
      { value: 'type', label: 'Tipo', values: categories.type || [] },
      { value: 'brand', label: 'Marca', values: categories.brand || [] },
      { value: 'size', label: 'Talla', values: categories.size || [] },
      { value: 'onSale', label: 'Solo ofertas', values: [true] }
    ],
    [categories]
  );

  const currentFilterKey = item.settings?.filterKey || '';
  const currentFilterValue = item.settings?.filterValue ?? '';
  const selectedFilterOption = filterKeyOptions.find(option => option.value === currentFilterKey);
  const filterValuesForKey = selectedFilterOption?.values || [];

  const normalizeValueForKey = (key, rawValue) => {
    if (key === 'onSale') {
      if (typeof rawValue === 'boolean') return rawValue;
      return rawValue === 'true' || rawValue === true;
    }
    return rawValue;
  };

  const filterValueLabel = (key, value) => {
    if (key === 'onSale') return 'En oferta';
    return value;
  };

  const handleKindChange = event => {
    const nextKind = event.target.value;
    updateItem(rowId, item.id, current => ({ ...current, kind: nextKind }));
    if (nextKind !== 'filter' && nextKind !== 'category') {
      updateItemSettings(rowId, item.id, 'filterKey', '');
      updateItemSettings(rowId, item.id, 'filterValue', '');
    }
    if (nextKind !== 'collection') {
      updateItemSettings(rowId, item.id, 'collection', '');
    }
    if (nextKind === 'category' && !currentFilterKey) {
      updateItemSettings(rowId, item.id, 'filterKey', 'type');
      updateItemSettings(rowId, item.id, 'filterValue', item.label);
    }
  };

  const selectFilterValue = value => {
    const normalized = normalizeValueForKey(currentFilterKey, value);
    updateItemSettings(rowId, item.id, 'filterValue', normalized);
    if (currentFilterKey === 'collection') {
      updateItemSettings(rowId, item.id, 'collection', normalized);
    }
    updateItem(rowId, item.id, current => ({ ...current, href: '' }));
  };

  const handleFilterKeyChange = event => {
    const nextKey = event.target.value;
    const option = filterKeyOptions.find(opt => opt.value === nextKey);
    const defaultValue = option?.values?.[0] ?? (nextKey === 'onSale' ? true : '');
    updateItemSettings(rowId, item.id, 'filterKey', nextKey);
    updateItemSettings(rowId, item.id, 'filterValue', normalizeValueForKey(nextKey, defaultValue));
    if (nextKey === 'collection') {
      updateItemSettings(rowId, item.id, 'collection', defaultValue || '');
    }
    updateItem(rowId, item.id, current => ({ ...current, href: '' }));
  };

  const handleFilterValueChange = event => {
    selectFilterValue(event.target.value);
  };

  const setCollectionValue = value => {
    if (!value) {
      updateItemSettings(rowId, item.id, 'collection', '');
      updateItemSettings(rowId, item.id, 'filterKey', '');
      updateItemSettings(rowId, item.id, 'filterValue', '');
    } else {
      updateItemSettings(rowId, item.id, 'collection', value);
      updateItemSettings(rowId, item.id, 'filterKey', 'collection');
      updateItemSettings(rowId, item.id, 'filterValue', value);
    }
    updateItem(rowId, item.id, current => ({ ...current, href: '' }));
  };
  const handleCollectionSelect = event => {
    setCollectionValue(event.target.value);
  };

  const renderQuickLinks = (values, onSelect, getLabel = value => value) => (
    <div className="flex flex-wrap gap-2 pt-1">
      {values.map(value => (
        <button
          key={`chip-${String(value)}`}
          type="button"
          onClick={() => onSelect(value)}
          className="rounded-full border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200 transition"
        >
          {getLabel(value)}
        </button>
      ))}
    </div>
  );

  const previewHref = useMemo(() => {
    if (item.href) return item.href;

    if (item.kind === 'collection') {
      const collection = item.settings?.collection || item.label;
      if (collection) {
        return buildProductFilterUrl({ collection });
      }
    }

    if (item.kind === 'filter' && currentFilterKey) {
      const normalized = normalizeValueForKey(currentFilterKey, currentFilterValue);
      if (normalized !== '' && normalized !== false) {
        return buildProductFilterUrl({ [currentFilterKey]: normalized });
      }
    }

    if (item.kind === 'category') {
      const key = item.settings?.filterKey || 'type';
      const rawValue = item.settings?.filterValue ?? item.settings?.collection ?? item.label;
      if (rawValue) {
        const normalized = normalizeValueForKey(key, rawValue);
        return buildProductFilterUrl({ [key]: normalized });
      }
    }

    return '/productos';
  }, [
    item.href,
    item.kind,
    item.label,
    item.settings,
    currentFilterKey,
    currentFilterValue
  ]);

  const showCollectionControls = item.kind === 'collection';
  const showFilterControls = item.kind === 'filter' || item.kind === 'category';

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <input
          type="text"
          value={item.label}
          onChange={event => updateItem(rowId, item.id, current => ({ ...current, label: event.target.value }))}
          placeholder="Etiqueta visible"
          className="flex-1 rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
        />
        <label className="text-xs font-medium text-gray-600 flex items-center gap-2">
          Orden
          <input
            type="number"
            value={item.order ?? 0}
            onChange={event => updateItem(rowId, item.id, current => ({ ...current, order: Number(event.target.value) || 0 }))}
            className="w-20 rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
          />
        </label>
        <select
          value={item.kind}
          onChange={handleKindChange}
          className="rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
        >
          {ITEM_KINDS.map(kind => (
            <option key={kind.value} value={kind.value}>
              {kind.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => removeItem(rowId, item.id)}
          className="text-sm text-red-600 hover:underline"
        >
          Eliminar
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-gray-600">
          URL o destino
          <input
            type="text"
            value={item.href}
            onChange={event => updateItem(rowId, item.id, current => ({ ...current, href: event.target.value }))}
            placeholder="/productos"
            className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Badge opcional
          <input
            type="text"
            value={item.badge || ''}
            onChange={event => updateItem(rowId, item.id, current => ({ ...current, badge: event.target.value }))}
            placeholder="Nuevo / -20%"
            className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
          />
        </label>
      </div>

      {(showCollectionControls || showFilterControls) && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-3">
          {showCollectionControls && (
            <>
              <label className="text-xs font-medium text-gray-600">
                Selecciona coleccion
                <select
                  value={item.settings?.collection || ''}
                  onChange={handleCollectionSelect}
                  className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Selecciona coleccion</option>
                  {(categories.collection || []).map(collection => (
                    <option key={collection} value={collection}>
                      {collection}
                    </option>
                  ))}
                </select>
              </label>
              {(categories.collection || []).length > 0 && renderQuickLinks(categories.collection, setCollectionValue)}
            </>
          )}

          {showFilterControls && (
            <>
              <label className="text-xs font-medium text-gray-600">
                Tipo de filtro
                <select
                  value={currentFilterKey}
                  onChange={handleFilterKeyChange}
                  className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Selecciona filtro</option>
                  {filterKeyOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {currentFilterKey && (
                filterValuesForKey.length ? (
                  <label className="text-xs font-medium text-gray-600">
                    Valor
                    <select
                      value={String(currentFilterValue)}
                      onChange={handleFilterValueChange}
                      className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Selecciona valor</option>
                      {filterValuesForKey.map(value => (
                        <option key={String(value)} value={String(value)}>
                          {filterValueLabel(currentFilterKey, value)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="text-xs font-medium text-gray-600">
                    Valor
                    <input
                      type="text"
                      value={currentFilterValue}
                      onChange={event => selectFilterValue(event.target.value)}
                      placeholder="Ingresa valor"
                      className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                    />
                  </label>
                )
              )}
              {currentFilterKey && filterValuesForKey.length > 1 &&
                renderQuickLinks(filterValuesForKey, selectFilterValue, value => filterValueLabel(currentFilterKey, value))}
            </>
          )}

          <p className="text-xs text-gray-500">
            Enlace sugerido: <span className="font-mono">{previewHref}</span>
          </p>
        </div>
      )}

      {item.megaMenu ? (
        <>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">Mega menu</h4>
            <div className="space-x-3">
              <button type="button" onClick={() => addColumn(rowId, item.id)} className="text-sm text-blue-600 hover:underline">
                Anadir columna
              </button>
              <button type="button" onClick={() => disableMegaMenu(rowId, item.id)} className="text-sm text-red-600 hover:underline">
                Desactivar
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-2">Ideal para mostrar subcategorias (Hoodies, Camisetas, Accesorios) y campanias.</p>
          <button
            type="button"
            onClick={() => toggleMegaMenu(item.id)}
            className="text-sm text-blue-600 hover:underline"
          >
            {megaExpanded[item.id] ? 'Ocultar columnas' : 'Editar columnas'}
          </button>

          {megaExpanded[item.id] && (
            <div className="mt-3 space-y-3">
              {(item.megaMenu.columns || []).map(column => (
                <div key={column.id} className="rounded-md border border-gray-200 p-3 bg-gray-50 space-y-3">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                    <input
                      type="text"
                      value={column.title}
                      onChange={event => updateColumn(rowId, item.id, column.id, { ...column, title: event.target.value })}
                      placeholder="Titulo de columna (opcional)"
                      className="flex-1 rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                    />
                    <label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                      Orden
                      <input
                        type="number"
                        value={column.order ?? 0}
                        onChange={event => updateColumn(rowId, item.id, column.id, { ...column, order: Number(event.target.value) || 0 })}
                        className="w-20 rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeColumn(rowId, item.id, column.id)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(column.items || []).map(columnItem => (
                      <div key={columnItem.id} className="grid gap-2 lg:grid-cols-3 lg:items-center">
                        <input
                          type="text"
                          value={columnItem.label}
                          onChange={event => updateColumnItem(rowId, item.id, column.id, columnItem.id, { label: event.target.value })}
                          placeholder="Nombre"
                          className="rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={columnItem.href}
                          onChange={event => updateColumnItem(rowId, item.id, column.id, columnItem.id, { href: event.target.value })}
                          placeholder="/productos?type=hoodies"
                          className="rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                        />
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-2">
                          <label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                            Orden
                            <input
                              type="number"
                              value={columnItem.order ?? 0}
                              onChange={event => updateColumnItem(rowId, item.id, column.id, columnItem.id, { order: Number(event.target.value) || 0 })}
                              className="w-20 rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                            />
                          </label>
                          <input
                            type="text"
                            value={columnItem.badge || ''}
                            onChange={event => updateColumnItem(rowId, item.id, column.id, columnItem.id, { badge: event.target.value })}
                            placeholder="Badge"
                            className="flex-1 rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeColumnItem(rowId, item.id, column.id, columnItem.id)}
                            className="text-sm text-red-600 hover:underline"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addColumnItem(rowId, item.id, column.id)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Anadir enlace
                    </button>
                  </div>
                </div>
              ))}

              <div className="rounded-md border border-dashed border-gray-300 p-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-semibold text-gray-700">Destacado</h5>
                  {item.megaMenu.featured ? (
                    <button type="button" onClick={() => clearFeatured(rowId, item.id)} className="text-sm text-red-600 hover:underline">
                      Quitar destacado
                    </button>
                  ) : (
                    <button type="button" onClick={() => updateFeatured(rowId, item.id, {})} className="text-sm text-blue-600 hover:underline">
                      Anadir destacado
                    </button>
                  )}
                </div>
                {item.megaMenu.featured && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-xs font-medium text-gray-600">
                      Titulo
                      <input
                        type="text"
                        value={item.megaMenu.featured.title}
                        onChange={event => updateFeatured(rowId, item.id, { title: event.target.value })}
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                    <label className="text-xs font-medium text-gray-600">
                      Enlace
                      <input
                        type="text"
                        value={item.megaMenu.featured.href}
                        onChange={event => updateFeatured(rowId, item.id, { href: event.target.value })}
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                    <label className="text-xs font-medium text-gray-600 md:col-span-2">
                      Descripcion
                      <textarea
                        value={item.megaMenu.featured.description}
                        onChange={event => updateFeatured(rowId, item.id, { description: event.target.value })}
                        rows={2}
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                    <label className="text-xs font-medium text-gray-600 md:col-span-2">
                      Imagen (URL)
                      <input
                        type="text"
                        value={item.megaMenu.featured.imageUrl}
                        onChange={event => updateFeatured(rowId, item.id, { imageUrl: event.target.value })}
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                        placeholder="https://..."
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            ensureMegaMenu(rowId, item.id);
            toggleMegaMenu(item.id);
          }}
          className="text-sm text-blue-600 hover:underline"
        >
          Activar mega menu
        </button>
      )}
    </div>
  );
};

export default MenuBuilderPage;
