import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../../api/axiosInstance';
import { buildProductFilterUrl } from '../../utils/productFilters';
import { usePublicConfig } from '../../context/PublicConfigContext';
import {
  HiOutlineArrowsUpDown,
  HiOutlineArrowPath,
  HiOutlineArrowSmallDown,
  HiOutlineArrowSmallUp,
  HiOutlineCheckCircle,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineExclamationTriangle,
  HiOutlineEye,
  HiOutlineMegaphone,
  HiOutlineSquares2X2,
  HiOutlineTag
} from 'react-icons/hi2';

const ITEM_KINDS = [
  { value: 'link', label: 'Enlace directo' },
  { value: 'collection', label: 'Coleccion' },
  { value: 'category', label: 'Categoria' },
  { value: 'filter', label: 'Filtro dinamico' }
];

const createId = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `tmp-${Date.now()}-${Math.random()}`);
const isNonEmptyString = value => typeof value === 'string' && value.trim() !== '';
const sortByOrder = items => [...(items || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const withSequentialOrder = items => items.map((item, index) => ({ ...item, order: index }));

const moveInArray = (items, fromIndex, direction) => {
  const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return withSequentialOrder(next);
};

const reorderByIds = (items, draggedId, targetId) => {
  const ordered = sortByOrder(items);
  const fromIndex = ordered.findIndex(item => item.id === draggedId);
  const toIndex = ordered.findIndex(item => item.id === targetId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return ordered;
  }

  const next = [...ordered];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return withSequentialOrder(next);
};

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

const resolvePreviewHref = item => {
  if (item.href) return item.href;

  const filters = (() => {
    switch (item.kind) {
      case 'collection': {
        const collection = item.settings?.collection || item.label;
        if (collection) return { collection };
        break;
      }
      case 'filter': {
        const key = item.settings?.filterKey;
        const value = item.settings?.filterValue;
        if (key && value !== undefined && value !== null && value !== '') {
          return { [key]: value };
        }
        break;
      }
      case 'category': {
        const key = item.settings?.filterKey || 'type';
        const value = item.settings?.filterValue ?? item.settings?.category ?? item.label;
        if (value) return { [key]: value };
        break;
      }
      default:
        break;
    }
    return null;
  })();

  return filters ? buildProductFilterUrl(filters) : '/productos';
};

const collectMenuStats = menu => {
  const rows = menu.rows || [];
  const allItems = rows.flatMap(row => row.items || []);
  const megaItems = allItems.filter(item => item.megaMenu);
  const megaColumns = megaItems.reduce((acc, item) => acc + (item.megaMenu?.columns?.length || 0), 0);
  return {
    rows: rows.length,
    items: allItems.length,
    megaItems: megaItems.length,
    megaColumns
  };
};

const collectMenuIssues = menu => {
  const issues = [];

  if (!isNonEmptyString(menu.title)) {
    issues.push({ level: 'warning', message: 'El menu no tiene titulo interno.' });
  }

  (menu.rows || []).forEach((row, rowIndex) => {
    const rowName = row.title || `Fila ${rowIndex + 1}`;

    if (!Array.isArray(row.items) || row.items.length === 0) {
      issues.push({
        level: 'warning',
        message: `${rowName} no tiene enlaces configurados.`
      });
    }

    if (row.type === 'category' && !isNonEmptyString(row.title)) {
      issues.push({
        level: 'warning',
        message: `Una fila de categorias no tiene titulo; en movil se vera poco clara.`
      });
    }

    (row.items || []).forEach((item, itemIndex) => {
      const itemName = item.label || `Enlace ${itemIndex + 1}`;

      if (!isNonEmptyString(item.label)) {
        issues.push({
          level: 'error',
          message: `${rowName}: hay un enlace sin etiqueta visible.`
        });
      }

      if (item.kind === 'link' && !isNonEmptyString(item.href)) {
        issues.push({
          level: 'warning',
          message: `${rowName} > ${itemName}: enlace directo sin URL.`
        });
      }

      if (item.kind === 'collection' && !isNonEmptyString(item.settings?.collection)) {
        issues.push({
          level: 'warning',
          message: `${rowName} > ${itemName}: falta seleccionar coleccion.`
        });
      }

      if (
        ['filter', 'category'].includes(item.kind) &&
        (!isNonEmptyString(item.settings?.filterKey) || item.settings?.filterValue === '' || item.settings?.filterValue == null)
      ) {
        issues.push({
          level: 'warning',
          message: `${rowName} > ${itemName}: filtro incompleto.`
        });
      }

      if (item.megaMenu) {
        const columns = item.megaMenu.columns || [];
        if (!columns.length) {
          issues.push({
            level: 'warning',
            message: `${rowName} > ${itemName}: mega menu activo sin columnas.`
          });
        }

        columns.forEach((column, columnIndex) => {
          if (!Array.isArray(column.items) || column.items.length === 0) {
            issues.push({
              level: 'warning',
              message: `${rowName} > ${itemName}: columna ${columnIndex + 1} sin enlaces.`
            });
          }

          (column.items || []).forEach((columnItem, subIndex) => {
            if (!isNonEmptyString(columnItem.label)) {
              issues.push({
                level: 'error',
                message: `${rowName} > ${itemName}: subenlace ${subIndex + 1} sin nombre.`
              });
            }
            if (!isNonEmptyString(columnItem.href)) {
              issues.push({
                level: 'warning',
                message: `${rowName} > ${itemName}: subenlace "${columnItem.label || `#${subIndex + 1}`}" sin URL.`
              });
            }
          });
        });
      }
    });
  });

  return issues;
};

const MenuBuilderPage = () => {
  const { isModuleEnabled } = usePublicConfig();
  const [menu, setMenu] = useState({ title: 'Menu principal', rows: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [expandedItems, setExpandedItems] = useState({});
  const [megaExpanded, setMegaExpanded] = useState({});
  const [categories, setCategories] = useState({ brand: [], type: [], size: [], collection: [], gender: [] });
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [dragState, setDragState] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const categoriesEnabled = isModuleEnabled('categories');

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: menuData }, { data: categoryData }] = await Promise.all([
        axios.get('/api/navigation', { withCredentials: true }),
        axios.get('/api/categories', { withCredentials: true }).catch(() => ({ data: {} }))
      ]);

      const normalized = normalizeMenu(menuData);
      setMenu(normalized);
      setSavedSnapshot(JSON.stringify(normalized));
      setCategories({
        brand: categoryData.brand || [],
        type: categoryData.type || [],
        size: categoryData.size || [],
        collection: categoryData.collection || [],
        gender: categoryData.gender || []
      });
      setExpandedRows(
        normalized.rows.reduce((acc, row) => ({ ...acc, [row.id]: true }), {})
      );
      setExpandedItems(
        normalized.rows.flatMap(row => row.items || []).reduce((acc, item) => ({ ...acc, [item.id]: false }), {})
      );
      setMessage('');
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
    setMessage('');
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
      if (value === '' || value == null) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return { ...item, settings: next };
    });
  };

  const rowsByType = useMemo(
    () => ({
      highlight: sortByOrder(menu.rows.filter(row => row.type === 'highlight')),
      category: sortByOrder(menu.rows.filter(row => row.type === 'category'))
    }),
    [menu.rows]
  );

  const stats = useMemo(() => collectMenuStats(menu), [menu]);
  const issues = useMemo(() => collectMenuIssues(menu), [menu]);
  const errorCount = issues.filter(issue => issue.level === 'error').length;
  const warningCount = issues.filter(issue => issue.level === 'warning').length;
  const isDirty = useMemo(() => JSON.stringify(menu) !== savedSnapshot, [menu, savedSnapshot]);

  const addRow = type => {
    const nextRow = createEmptyRow(type);
    updateRows(rows => withSequentialOrder([...rows, { ...nextRow, order: rows.length }]));
    setExpandedRows(prev => ({ ...prev, [nextRow.id]: true }));
  };

  const removeRow = rowId => {
    updateRows(rows => withSequentialOrder(rows.filter(row => row.id !== rowId)));
  };

  const moveRow = (rowId, direction) => {
    updateRows(rows => {
      const ordered = sortByOrder(rows);
      const index = ordered.findIndex(row => row.id === rowId);
      return moveInArray(ordered, index, direction);
    });
  };

  const reorderRows = (rowType, draggedRowId, targetRowId) => {
    updateRows(rows => {
      const highlightRows = sortByOrder(rows.filter(row => row.type === 'highlight'));
      const categoryRows = sortByOrder(rows.filter(row => row.type === 'category'));

      if (rowType === 'highlight') {
        return withSequentialOrder([
          ...reorderByIds(highlightRows, draggedRowId, targetRowId),
          ...categoryRows
        ]);
      }

      return withSequentialOrder([
        ...highlightRows,
        ...reorderByIds(categoryRows, draggedRowId, targetRowId)
      ]);
    });
  };

  const addItem = rowId => {
    const nextItem = createEmptyItem();
    updateRow(rowId, row => ({
      ...row,
      items: withSequentialOrder([...sortByOrder(row.items), { ...nextItem, order: row.items.length }])
    }));
    setExpandedItems(prev => ({ ...prev, [nextItem.id]: true }));
  };

  const removeItem = (rowId, itemId) => {
    updateRow(rowId, row => ({
      ...row,
      items: withSequentialOrder(row.items.filter(item => item.id !== itemId))
    }));
  };

  const moveItem = (rowId, itemId, direction) => {
    updateRow(rowId, row => {
      const ordered = sortByOrder(row.items);
      const index = ordered.findIndex(item => item.id === itemId);
      return {
        ...row,
        items: moveInArray(ordered, index, direction)
      };
    });
  };

  const reorderItems = (rowId, draggedItemId, targetItemId) => {
    updateRow(rowId, row => ({
      ...row,
      items: reorderByIds(row.items || [], draggedItemId, targetItemId)
    }));
  };

  const toggleRowExpand = rowId => {
    setExpandedRows(prev => ({ ...prev, [rowId]: !prev[rowId] }));
  };

  const toggleItemExpand = itemId => {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const toggleMegaMenu = itemId => {
    setMegaExpanded(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const ensureMegaMenu = (rowId, itemId) => {
    updateItem(rowId, itemId, item => (
      item.megaMenu
        ? item
        : { ...item, megaMenu: { columns: [createEmptyColumn()], featured: null } }
    ));
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
          columns: withSequentialOrder([...sortByOrder(mega.columns), createEmptyColumn()]),
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
          columns: withSequentialOrder(item.megaMenu.columns.filter(column => column.id !== columnId))
        }
      };
    });
  };

  const moveColumn = (rowId, itemId, columnId, direction) => {
    updateItem(rowId, itemId, item => {
      if (!item.megaMenu) return item;
      const ordered = sortByOrder(item.megaMenu.columns);
      const index = ordered.findIndex(column => column.id === columnId);
      return {
        ...item,
        megaMenu: {
          ...item.megaMenu,
          columns: moveInArray(ordered, index, direction)
        }
      };
    });
  };

  const reorderColumns = (rowId, itemId, draggedColumnId, targetColumnId) => {
    updateItem(rowId, itemId, item => {
      if (!item.megaMenu) return item;
      return {
        ...item,
        megaMenu: {
          ...item.megaMenu,
          columns: reorderByIds(item.megaMenu.columns || [], draggedColumnId, targetColumnId)
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
              ? { ...column, items: withSequentialOrder([...sortByOrder(column.items), createEmptyColumnItem()]) }
              : column
          )
        }
      };
    });
  };

  const moveColumnItem = (rowId, itemId, columnId, columnItemId, direction) => {
    updateItem(rowId, itemId, item => {
      if (!item.megaMenu) return item;
      return {
        ...item,
        megaMenu: {
          ...item.megaMenu,
          columns: item.megaMenu.columns.map(column => {
            if (column.id !== columnId) return column;
            const ordered = sortByOrder(column.items);
            const index = ordered.findIndex(columnItem => columnItem.id === columnItemId);
            return {
              ...column,
              items: moveInArray(ordered, index, direction)
            };
          })
        }
      };
    });
  };

  const reorderColumnItems = (rowId, itemId, columnId, draggedColumnItemId, targetColumnItemId) => {
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
                items: reorderByIds(column.items || [], draggedColumnItemId, targetColumnItemId)
              }
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
                items: withSequentialOrder(column.items.filter(columnItem => columnItem.id !== columnItemId))
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
          featured: {
            ...(mega.featured || { title: '', description: '', href: '', imageUrl: '' }),
            ...changes
          }
        }
      };
    });
  };

  const canDropOnTarget = useCallback((dragged, target) => {
    if (!dragged || !target || dragged.type !== target.type) {
      return false;
    }

    switch (target.type) {
      case 'row':
        return dragged.rowType === target.rowType && dragged.rowId !== target.rowId;
      case 'item':
        return dragged.rowId === target.rowId && dragged.itemId !== target.itemId;
      case 'column':
        return (
          dragged.rowId === target.rowId &&
          dragged.itemId === target.itemId &&
          dragged.columnId !== target.columnId
        );
      case 'columnItem':
        return (
          dragged.rowId === target.rowId &&
          dragged.itemId === target.itemId &&
          dragged.columnId === target.columnId &&
          dragged.columnItemId !== target.columnItemId
        );
      default:
        return false;
    }
  }, []);

  const handleDragStart = useCallback((event, payload) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
    setDragState(payload);
    setDropTarget(null);
    setMessage('');
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState(null);
    setDropTarget(null);
  }, []);

  const handleDragOverTarget = (event, target) => {
    if (!canDropOnTarget(dragState, target)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget(target);
  };

  const handleDropOnTarget = (event, target) => {
    if (!canDropOnTarget(dragState, target)) {
      return;
    }

    event.preventDefault();

    if (target.type === 'row') {
      reorderRows(target.rowType, dragState.rowId, target.rowId);
    }

    if (target.type === 'item') {
      reorderItems(target.rowId, dragState.itemId, target.itemId);
    }

    if (target.type === 'column') {
      reorderColumns(target.rowId, target.itemId, dragState.columnId, target.columnId);
    }

    if (target.type === 'columnItem') {
      reorderColumnItems(
        target.rowId,
        target.itemId,
        target.columnId,
        dragState.columnItemId,
        target.columnItemId
      );
    }

    setDragState(null);
    setDropTarget(null);
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
    setMessage('');
    try {
      await axios.put('/api/navigation', menu, { withCredentials: true });
      const snapshot = JSON.stringify(menu);
      setSavedSnapshot(snapshot);
      setMessage('Menu guardado correctamente.');
      await fetchMenu();
    } catch (err) {
      console.error('Error guardando menu', err);
      setError(err?.response?.data?.message || 'No se pudo guardar el menu');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 text-slate-500">
        Cargando configuracion del menu...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm lg:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                  <HiOutlineSquares2X2 className="text-2xl" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Navegacion</p>
                  <h1 className="text-2xl font-semibold text-slate-900">Constructor de menu principal</h1>
                </div>
              </div>
              <p className="max-w-3xl text-sm text-slate-500">
                Configura los accesos del header, categorias desplegables y mega menus. Esta version mejora el flujo con preview, validaciones visibles y reordenamiento rapido.
              </p>
              {!categoriesEnabled && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Categorias desactivadas. Solo conviene usar enlaces directos; filtros, colecciones y categorias dinamicas tendran opciones limitadas.
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
              <StatCard label="Filas" value={stats.rows} helper="Bloques del header" />
              <StatCard label="Enlaces" value={stats.items} helper="Items configurados" />
              <StatCard label="Mega menus" value={stats.megaItems} helper="Items con desplegable" />
              <StatCard label="Columnas" value={stats.megaColumns} helper="Dentro de mega menus" />
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <label className="block flex-1 text-sm font-medium text-slate-700">
                  Titulo interno
                  <input
                    type="text"
                    value={menu.title}
                    onChange={event => setMenu(prev => ({ ...prev, title: event.target.value }))}
                    className="mt-1.5 w-full rounded-2xl border border-surface-200 px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={fetchMenu}
                    className="inline-flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                  >
                    <HiOutlineArrowPath className="text-base" />
                    Recargar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || errorCount > 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <HiOutlineCheckCircle className="text-base" />
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <StatusChip
                  tone={isDirty ? 'warning' : 'success'}
                  label={isDirty ? 'Cambios sin guardar' : 'Borrador sincronizado'}
                />
                <StatusChip tone={warningCount ? 'warning' : 'neutral'} label={`${warningCount} advertencias`} />
                <StatusChip tone={errorCount ? 'danger' : 'success'} label={`${errorCount} errores`} />
              </div>

              {(error || message) && (
                <div
                  className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                    error
                      ? 'border border-red-200 bg-red-50 text-red-700'
                      : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {error || message}
                </div>
              )}
            </section>

            <MenuRowsSection
              title="Fila superior"
              description="Accesos rapidos o destacados visibles en desktop y como chips en movil."
              rows={rowsByType.highlight}
              rowLabel="destacados"
              rowType="highlight"
              addRow={() => addRow('highlight')}
              removeRow={removeRow}
              moveRow={moveRow}
              dragState={dragState}
              dropTarget={dropTarget}
              handleDragStart={handleDragStart}
              handleDragEnd={handleDragEnd}
              handleDragOverTarget={handleDragOverTarget}
              handleDropOnTarget={handleDropOnTarget}
              updateRow={updateRow}
              expandedRows={expandedRows}
              toggleRowExpand={toggleRowExpand}
              addItem={addItem}
              removeItem={removeItem}
              moveItem={moveItem}
              updateItem={updateItem}
              updateItemSettings={updateItemSettings}
              expandedItems={expandedItems}
              toggleItemExpand={toggleItemExpand}
              megaExpanded={megaExpanded}
              toggleMegaMenu={toggleMegaMenu}
              ensureMegaMenu={ensureMegaMenu}
              disableMegaMenu={disableMegaMenu}
              addColumn={addColumn}
              removeColumn={removeColumn}
              moveColumn={moveColumn}
              updateColumn={updateColumn}
              addColumnItem={addColumnItem}
              moveColumnItem={moveColumnItem}
              reorderColumns={reorderColumns}
              reorderColumnItems={reorderColumnItems}
              updateColumnItem={updateColumnItem}
              removeColumnItem={removeColumnItem}
              updateFeatured={updateFeatured}
              clearFeatured={clearFeatured}
              categories={categories}
              categoriesEnabled={categoriesEnabled}
            />

            <MenuRowsSection
              title="Fila inferior"
              description="Categorias principales del header. Aqui conviene usar items con mega menu."
              rows={rowsByType.category}
              rowLabel="categorias"
              rowType="category"
              addRow={() => addRow('category')}
              removeRow={removeRow}
              moveRow={moveRow}
              dragState={dragState}
              dropTarget={dropTarget}
              handleDragStart={handleDragStart}
              handleDragEnd={handleDragEnd}
              handleDragOverTarget={handleDragOverTarget}
              handleDropOnTarget={handleDropOnTarget}
              updateRow={updateRow}
              expandedRows={expandedRows}
              toggleRowExpand={toggleRowExpand}
              addItem={addItem}
              removeItem={removeItem}
              moveItem={moveItem}
              updateItem={updateItem}
              updateItemSettings={updateItemSettings}
              expandedItems={expandedItems}
              toggleItemExpand={toggleItemExpand}
              megaExpanded={megaExpanded}
              toggleMegaMenu={toggleMegaMenu}
              ensureMegaMenu={ensureMegaMenu}
              disableMegaMenu={disableMegaMenu}
              addColumn={addColumn}
              removeColumn={removeColumn}
              moveColumn={moveColumn}
              updateColumn={updateColumn}
              addColumnItem={addColumnItem}
              moveColumnItem={moveColumnItem}
              reorderColumns={reorderColumns}
              reorderColumnItems={reorderColumnItems}
              updateColumnItem={updateColumnItem}
              removeColumnItem={removeColumnItem}
              updateFeatured={updateFeatured}
              clearFeatured={clearFeatured}
              categories={categories}
              categoriesEnabled={categoriesEnabled}
            />
          </div>

          <div className="space-y-6">
            <MenuValidationPanel issues={issues} />
            <MenuPreviewPanel rowsByType={rowsByType} />
          </div>
        </section>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    <p className="text-xs text-slate-500">{helper}</p>
  </div>
);

const StatusChip = ({ tone, label }) => {
  const tones = {
    neutral: 'border border-surface-200 bg-surface-50 text-slate-700',
    success: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border border-red-200 bg-red-50 text-red-700'
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone] || tones.neutral}`}>
      {label}
    </span>
  );
};

const MenuValidationPanel = ({ issues }) => (
  <section className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
    <div className="flex items-center gap-3">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <HiOutlineExclamationTriangle className="text-xl" />
      </span>
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Control de calidad</p>
        <h2 className="text-lg font-semibold text-slate-900">Validaciones del menu</h2>
      </div>
    </div>

    <div className="mt-5 space-y-3">
      {issues.length ? (
        issues.slice(0, 10).map((issue, index) => (
          <div
            key={`${issue.message}-${index}`}
            className={`rounded-2xl px-4 py-3 text-sm ${
              issue.level === 'error'
                ? 'border border-red-200 bg-red-50 text-red-700'
                : 'border border-amber-200 bg-amber-50 text-amber-700'
            }`}
          >
            {issue.message}
          </div>
        ))
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          El constructor no detecta problemas de configuracion.
        </div>
      )}
      {issues.length > 10 && (
        <p className="text-xs text-slate-500">
          Se muestran las primeras 10 observaciones de {issues.length}.
        </p>
      )}
    </div>
  </section>
);

const MenuPreviewPanel = ({ rowsByType }) => {
  const topItems = rowsByType.highlight.flatMap(row => sortByOrder(row.items || []));
  const categoryRows = rowsByType.category
    .map(row => ({ ...row, items: sortByOrder(row.items || []) }))
    .filter(row => row.items.length > 0);

  return (
    <section className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
          <HiOutlineEye className="text-xl" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Preview</p>
          <h2 className="text-lg font-semibold text-slate-900">Lectura rapida del menu</h2>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Fila superior</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {topItems.length ? topItems.map(item => (
              <span key={item.id} className="rounded-full border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-slate-700">
                {item.label || 'Sin nombre'}
                {item.badge ? <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white">{item.badge}</span> : null}
              </span>
            )) : (
              <span className="text-sm text-slate-500">Sin destacados configurados.</span>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Fila inferior</p>
          <div className="mt-3 space-y-3">
            {categoryRows.length ? categoryRows.map(row => (
              <div key={row.id} className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{row.title || 'Categorias'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.items.map(item => (
                    <span key={item.id} className="rounded-full border border-surface-200 bg-white px-3 py-1.5 text-xs text-slate-700">
                      {item.label || 'Sin nombre'}
                      {item.megaMenu ? <span className="ml-2 text-brand">Mega</span> : null}
                    </span>
                  ))}
                </div>
              </div>
            )) : (
              <span className="text-sm text-slate-500">Sin categorias configuradas.</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

const DragHandle = ({ label, payload, onDragStart, onDragEnd }) => (
  <span
    role="button"
    tabIndex={0}
    draggable
    onDragStart={event => onDragStart(event, payload)}
    onDragEnd={onDragEnd}
    className="inline-flex cursor-grab items-center gap-1 rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand/30 hover:text-brand active:cursor-grabbing"
    title={`Arrastrar ${label}`}
  >
    <HiOutlineArrowsUpDown className="text-base" />
    Arrastrar
  </span>
);

const MenuRowsSection = ({
  title,
  description,
  rows,
  rowLabel,
  rowType,
  addRow,
  removeRow,
  moveRow,
  dragState,
  dropTarget,
  handleDragStart,
  handleDragEnd,
  handleDragOverTarget,
  handleDropOnTarget,
  updateRow,
  expandedRows,
  toggleRowExpand,
  addItem,
  removeItem,
  moveItem,
  updateItem,
  updateItemSettings,
  expandedItems,
  toggleItemExpand,
  megaExpanded,
  toggleMegaMenu,
  ensureMegaMenu,
  disableMegaMenu,
  addColumn,
  removeColumn,
  moveColumn,
  updateColumn,
  addColumnItem,
  moveColumnItem,
  updateColumnItem,
  removeColumnItem,
  updateFeatured,
  clearFeatured,
  categories,
  categoriesEnabled
}) => (
  <section className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${rowType === 'highlight' ? 'bg-brand/10 text-brand' : 'bg-slate-100 text-slate-700'}`}>
            {rowType === 'highlight' ? <HiOutlineMegaphone className="text-xl" /> : <HiOutlineTag className="text-xl" />}
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">{description}</p>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="rounded-xl border border-surface-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
      >
        Anadir fila
      </button>
    </div>

    <div className="mt-5 space-y-4">
      {rows.length ? rows.map((row, rowIndex) => {
        const isExpanded = expandedRows[row.id] !== false;
        const orderedItems = sortByOrder(row.items || []);
        const isRowDropTarget =
          dropTarget?.type === 'row' &&
          dropTarget?.rowId === row.id &&
          dragState?.type === 'row' &&
          dragState?.rowType === rowType;

        return (
          <article
            key={row.id}
            onDragOver={event => handleDragOverTarget(event, { type: 'row', rowType, rowId: row.id })}
            onDrop={event => handleDropOnTarget(event, { type: 'row', rowType, rowId: row.id })}
            className={`rounded-3xl border bg-surface-50 p-4 transition ${
              isRowDropTarget ? 'border-brand ring-2 ring-brand/20' : 'border-surface-200'
            }`}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggleRowExpand(row.id)}
                  className="mt-1 rounded-lg border border-surface-200 bg-white p-2 text-slate-500 transition hover:border-brand/30 hover:text-brand"
                  aria-label={isExpanded ? 'Contraer fila' : 'Expandir fila'}
                >
                  {isExpanded ? <HiOutlineChevronUp className="text-base" /> : <HiOutlineChevronDown className="text-base" />}
                </button>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <DragHandle
                      label="fila"
                      payload={{ type: 'row', rowType, rowId: row.id }}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                    <p className="text-sm font-semibold text-slate-900">
                      {row.title || `Fila de ${rowLabel}`}
                    </p>
                    <StatusChip tone="neutral" label={`${orderedItems.length} enlaces`} />
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                    <input
                      type="text"
                      value={row.title}
                      onChange={event => updateRow(row.id, current => ({ ...current, title: event.target.value }))}
                      placeholder={`Titulo opcional para ${rowLabel}`}
                      className="rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                    <label className="text-xs font-medium text-slate-600">
                      Orden
                      <input
                        type="number"
                        value={row.order ?? 0}
                        onChange={event => updateRow(row.id, current => ({ ...current, order: Number(event.target.value) || 0 }))}
                        className="mt-1 block w-24 rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                      />
                    </label>
                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        onClick={() => moveRow(row.id, 'up')}
                        disabled={rowIndex === 0}
                        className="rounded-xl border border-surface-200 bg-white p-2 text-slate-600 transition hover:border-brand/30 hover:text-brand disabled:opacity-40"
                      >
                        <HiOutlineArrowSmallUp className="text-lg" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRow(row.id, 'down')}
                        disabled={rowIndex === rows.length - 1}
                        className="rounded-xl border border-surface-200 bg-white p-2 text-slate-600 transition hover:border-brand/30 hover:text-brand disabled:opacity-40"
                      >
                        <HiOutlineArrowSmallDown className="text-lg" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                      >
                        Eliminar fila
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4 space-y-3">
                {orderedItems.map((item, itemIndex) => (
                  <MenuItemEditor
                    key={item.id}
                    rowId={row.id}
                    item={item}
                    itemIndex={itemIndex}
                    totalItems={orderedItems.length}
                    removeItem={removeItem}
                    moveItem={moveItem}
                    dragState={dragState}
                    dropTarget={dropTarget}
                    handleDragStart={handleDragStart}
                    handleDragEnd={handleDragEnd}
                    handleDragOverTarget={handleDragOverTarget}
                    handleDropOnTarget={handleDropOnTarget}
                    updateItem={updateItem}
                    updateItemSettings={updateItemSettings}
                    expandedItems={expandedItems}
                    toggleItemExpand={toggleItemExpand}
                    megaExpanded={megaExpanded}
                    toggleMegaMenu={toggleMegaMenu}
                    ensureMegaMenu={ensureMegaMenu}
                    disableMegaMenu={disableMegaMenu}
                    addColumn={addColumn}
                    removeColumn={removeColumn}
                    moveColumn={moveColumn}
                    updateColumn={updateColumn}
                    addColumnItem={addColumnItem}
                    moveColumnItem={moveColumnItem}
                    updateColumnItem={updateColumnItem}
                    removeColumnItem={removeColumnItem}
                    updateFeatured={updateFeatured}
                    clearFeatured={clearFeatured}
                    categories={categories}
                    categoriesEnabled={categoriesEnabled}
                  />
                ))}

                <button
                  type="button"
                  onClick={() => addItem(row.id)}
                  className="rounded-xl border border-dashed border-surface-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                >
                  Anadir enlace
                </button>
              </div>
            )}
          </article>
        );
      }) : (
        <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-center text-sm text-slate-500">
          No hay filas configuradas.
        </div>
      )}
    </div>
  </section>
);

const MenuItemEditor = ({
  rowId,
  item,
  itemIndex,
  totalItems,
  removeItem,
  moveItem,
  dragState,
  dropTarget,
  handleDragStart,
  handleDragEnd,
  handleDragOverTarget,
  handleDropOnTarget,
  updateItem,
  updateItemSettings,
  expandedItems,
  toggleItemExpand,
  megaExpanded,
  toggleMegaMenu,
  ensureMegaMenu,
  disableMegaMenu,
  addColumn,
  removeColumn,
  moveColumn,
  updateColumn,
  addColumnItem,
  moveColumnItem,
  updateColumnItem,
  removeColumnItem,
  updateFeatured,
  clearFeatured,
  categories,
  categoriesEnabled
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

  const isExpanded = expandedItems[item.id] === true;
  const currentFilterKey = item.settings?.filterKey || '';
  const currentFilterValue = item.settings?.filterValue ?? '';
  const selectedFilterOption = filterKeyOptions.find(option => option.value === currentFilterKey);
  const filterValuesForKey = selectedFilterOption?.values || [];
  const previewHref = resolvePreviewHref(item);

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

  const renderQuickLinks = (values, onSelect, getLabel = value => value) => (
    <div className="flex flex-wrap gap-2 pt-1">
      {values.map(value => (
        <button
          key={`chip-${String(value)}`}
          type="button"
          onClick={() => onSelect(value)}
          className="rounded-full border border-surface-200 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:border-brand/30 hover:text-brand"
        >
          {getLabel(value)}
        </button>
      ))}
    </div>
  );

  const showCollectionControls = item.kind === 'collection';
  const showFilterControls = item.kind === 'filter' || item.kind === 'category';
  const availableKinds = useMemo(
    () => ITEM_KINDS.filter(kind => (categoriesEnabled ? true : kind.value === 'link')),
    [categoriesEnabled]
  );
  const itemStatus = item.megaMenu ? 'Mega menu activo' : 'Enlace simple';
  const isItemDropTarget =
    dropTarget?.type === 'item' &&
    dropTarget?.rowId === rowId &&
    dropTarget?.itemId === item.id &&
    dragState?.type === 'item';

  return (
    <article
      onDragOver={event => handleDragOverTarget(event, { type: 'item', rowId, itemId: item.id })}
      onDrop={event => handleDropOnTarget(event, { type: 'item', rowId, itemId: item.id })}
      className={`rounded-2xl border bg-white p-4 transition ${
        isItemDropTarget ? 'border-brand ring-2 ring-brand/20' : 'border-surface-200'
      }`}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-1 items-start gap-3">
          <button
            type="button"
            onClick={() => toggleItemExpand(item.id)}
            className="mt-1 rounded-lg border border-surface-200 bg-white p-2 text-slate-500 transition hover:border-brand/30 hover:text-brand"
            aria-label={isExpanded ? 'Contraer item' : 'Expandir item'}
          >
            {isExpanded ? <HiOutlineChevronUp className="text-base" /> : <HiOutlineChevronDown className="text-base" />}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <DragHandle
                label="enlace"
                payload={{ type: 'item', rowId, itemId: item.id }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
              <p className="truncate text-sm font-semibold text-slate-900">
                {item.label || 'Enlace sin nombre'}
              </p>
              <StatusChip tone="neutral" label={itemStatus} />
              {item.badge ? <StatusChip tone="warning" label={`Badge: ${item.badge}`} /> : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Tipo: {availableKinds.find(kind => kind.value === item.kind)?.label || item.kind}</span>
              <span>Orden: {item.order ?? 0}</span>
              <span className="font-mono">{previewHref}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
          >
            Abrir preview
          </a>
          <button
            type="button"
            onClick={() => moveItem(rowId, item.id, 'up')}
            disabled={itemIndex === 0}
            className="rounded-xl border border-surface-200 bg-white p-2 text-slate-600 transition hover:border-brand/30 hover:text-brand disabled:opacity-40"
          >
            <HiOutlineArrowSmallUp className="text-lg" />
          </button>
          <button
            type="button"
            onClick={() => moveItem(rowId, item.id, 'down')}
            disabled={itemIndex === totalItems - 1}
            className="rounded-xl border border-surface-200 bg-white p-2 text-slate-600 transition hover:border-brand/30 hover:text-brand disabled:opacity-40"
          >
            <HiOutlineArrowSmallDown className="text-lg" />
          </button>
          <button
            type="button"
            onClick={() => removeItem(rowId, item.id)}
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
          >
            Eliminar
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4 border-t border-surface-200 pt-4">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_auto_auto_auto]">
            <input
              type="text"
              value={item.label}
              onChange={event => updateItem(rowId, item.id, current => ({ ...current, label: event.target.value }))}
              placeholder="Etiqueta visible"
              className="rounded-2xl border border-surface-200 px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <label className="text-xs font-medium text-slate-600">
              Orden
              <input
                type="number"
                value={item.order ?? 0}
                onChange={event => updateItem(rowId, item.id, current => ({ ...current, order: Number(event.target.value) || 0 }))}
                className="mt-1 block w-24 rounded-2xl border border-surface-200 px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Tipo
              <select
                value={item.kind}
                onChange={handleKindChange}
                className="mt-1 block rounded-2xl border border-surface-200 px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                {availableKinds.map(kind => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Badge
              <input
                type="text"
                value={item.badge || ''}
                onChange={event => updateItem(rowId, item.id, current => ({ ...current, badge: event.target.value }))}
                placeholder="Nuevo / -20%"
                className="mt-1 block rounded-2xl border border-surface-200 px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>
          </div>

          <label className="block text-xs font-medium text-slate-600">
            URL o destino manual
            <input
              type="text"
              value={item.href}
              onChange={event => updateItem(rowId, item.id, current => ({ ...current, href: event.target.value }))}
              placeholder="/productos"
              className="mt-1 w-full rounded-2xl border border-surface-200 px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <span className="mt-1 block text-xs text-slate-400">
              Si completas esta URL, tiene prioridad sobre el destino dinamico.
            </span>
          </label>

          {(showCollectionControls || showFilterControls) && (
            <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4 space-y-3">
              {showCollectionControls && (
                <>
                  <label className="block text-xs font-medium text-slate-600">
                    Selecciona coleccion
                    <select
                      value={item.settings?.collection || ''}
                      onChange={event => setCollectionValue(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
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
                  <label className="block text-xs font-medium text-slate-600">
                    Tipo de filtro
                    <select
                      value={currentFilterKey}
                      onChange={handleFilterKeyChange}
                      className="mt-1 w-full rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
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
                      <label className="block text-xs font-medium text-slate-600">
                        Valor
                        <select
                          value={String(currentFilterValue)}
                          onChange={handleFilterValueChange}
                          className="mt-1 w-full rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
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
                      <label className="block text-xs font-medium text-slate-600">
                        Valor
                        <input
                          type="text"
                          value={currentFilterValue}
                          onChange={event => selectFilterValue(event.target.value)}
                          placeholder="Ingresa valor"
                          className="mt-1 w-full rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                        />
                      </label>
                    )
                  )}

                  {currentFilterKey && filterValuesForKey.length > 1 && renderQuickLinks(
                    filterValuesForKey,
                    selectFilterValue,
                    value => filterValueLabel(currentFilterKey, value)
                  )}
                </>
              )}

              <p className="text-xs text-slate-500">
                Destino sugerido:
                {' '}
                <span className="font-mono text-slate-700">{previewHref}</span>
              </p>
            </div>
          )}

          {item.megaMenu ? (
            <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Mega menu</h4>
                  <p className="text-xs text-slate-500">
                    Ideal para subcategorias, filtros y promociones.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addColumn(rowId, item.id)}
                    className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                  >
                    Anadir columna
                  </button>
                  <button
                    type="button"
                    onClick={() => disableMegaMenu(rowId, item.id)}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    Desactivar
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMegaMenu(item.id)}
                    className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                  >
                    {megaExpanded[item.id] ? 'Ocultar detalle' : 'Editar mega menu'}
                  </button>
                </div>
              </div>

              {megaExpanded[item.id] && (
                <div className="mt-4 space-y-4">
                  {sortByOrder(item.megaMenu.columns || []).map((column, columnIndex, orderedColumns) => (
                    <div
                      key={column.id}
                      onDragOver={event => handleDragOverTarget(event, {
                        type: 'column',
                        rowId,
                        itemId: item.id,
                        columnId: column.id
                      })}
                      onDrop={event => handleDropOnTarget(event, {
                        type: 'column',
                        rowId,
                        itemId: item.id,
                        columnId: column.id
                      })}
                      className={`rounded-2xl border bg-white p-4 transition ${
                        dropTarget?.type === 'column' &&
                        dropTarget?.rowId === rowId &&
                        dropTarget?.itemId === item.id &&
                        dropTarget?.columnId === column.id &&
                        dragState?.type === 'column'
                          ? 'border-brand ring-2 ring-brand/20'
                          : 'border-surface-200'
                      }`}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="grid flex-1 gap-3 md:grid-cols-[1fr_auto]">
                          <div className="flex items-center gap-2">
                            <DragHandle
                              label="columna"
                              payload={{ type: 'column', rowId, itemId: item.id, columnId: column.id }}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                            />
                            <input
                              type="text"
                              value={column.title}
                              onChange={event => updateColumn(rowId, item.id, column.id, { title: event.target.value })}
                              placeholder="Titulo de columna"
                              className="flex-1 rounded-2xl border border-surface-200 px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                            />
                          </div>
                          <label className="text-xs font-medium text-slate-600">
                            Orden
                            <input
                              type="number"
                              value={column.order ?? 0}
                              onChange={event => updateColumn(rowId, item.id, column.id, { order: Number(event.target.value) || 0 })}
                              className="mt-1 block w-24 rounded-2xl border border-surface-200 px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                            />
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => moveColumn(rowId, item.id, column.id, 'up')}
                            disabled={columnIndex === 0}
                            className="rounded-xl border border-surface-200 bg-white p-2 text-slate-600 transition hover:border-brand/30 hover:text-brand disabled:opacity-40"
                          >
                            <HiOutlineArrowSmallUp className="text-lg" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveColumn(rowId, item.id, column.id, 'down')}
                            disabled={columnIndex === orderedColumns.length - 1}
                            className="rounded-xl border border-surface-200 bg-white p-2 text-slate-600 transition hover:border-brand/30 hover:text-brand disabled:opacity-40"
                          >
                            <HiOutlineArrowSmallDown className="text-lg" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeColumn(rowId, item.id, column.id)}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {sortByOrder(column.items || []).map((columnItem, columnItemIndex, orderedColumnItems) => (
                          <div
                            key={columnItem.id}
                            onDragOver={event => handleDragOverTarget(event, {
                              type: 'columnItem',
                              rowId,
                              itemId: item.id,
                              columnId: column.id,
                              columnItemId: columnItem.id
                            })}
                            onDrop={event => handleDropOnTarget(event, {
                              type: 'columnItem',
                              rowId,
                              itemId: item.id,
                              columnId: column.id,
                              columnItemId: columnItem.id
                            })}
                            className={`rounded-2xl border bg-surface-50 p-3 transition ${
                              dropTarget?.type === 'columnItem' &&
                              dropTarget?.rowId === rowId &&
                              dropTarget?.itemId === item.id &&
                              dropTarget?.columnId === column.id &&
                              dropTarget?.columnItemId === columnItem.id &&
                              dragState?.type === 'columnItem'
                                ? 'border-brand ring-2 ring-brand/20'
                                : 'border-surface-200'
                            }`}
                          >
                            <div className="grid gap-3 xl:grid-cols-[1fr_1fr_auto_auto]">
                              <div className="flex items-center gap-2">
                                <DragHandle
                                  label="subenlace"
                                  payload={{
                                    type: 'columnItem',
                                    rowId,
                                    itemId: item.id,
                                    columnId: column.id,
                                    columnItemId: columnItem.id
                                  }}
                                  onDragStart={handleDragStart}
                                  onDragEnd={handleDragEnd}
                                />
                                <input
                                  type="text"
                                  value={columnItem.label}
                                  onChange={event => updateColumnItem(rowId, item.id, column.id, columnItem.id, { label: event.target.value })}
                                  placeholder="Nombre"
                                  className="flex-1 rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                                />
                              </div>
                              <input
                                type="text"
                                value={columnItem.href}
                                onChange={event => updateColumnItem(rowId, item.id, column.id, columnItem.id, { href: event.target.value })}
                                placeholder="/productos?type=hoodies"
                                className="rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                              />
                              <label className="text-xs font-medium text-slate-600">
                                Orden
                                <input
                                  type="number"
                                  value={columnItem.order ?? 0}
                                  onChange={event => updateColumnItem(rowId, item.id, column.id, columnItem.id, { order: Number(event.target.value) || 0 })}
                                  className="mt-1 block w-24 rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                                />
                              </label>
                              <input
                                type="text"
                                value={columnItem.badge || ''}
                                onChange={event => updateColumnItem(rowId, item.id, column.id, columnItem.id, { badge: event.target.value })}
                                placeholder="Badge"
                                className="rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                              />
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => moveColumnItem(rowId, item.id, column.id, columnItem.id, 'up')}
                                disabled={columnItemIndex === 0}
                                className="rounded-xl border border-surface-200 bg-white p-2 text-slate-600 transition hover:border-brand/30 hover:text-brand disabled:opacity-40"
                              >
                                <HiOutlineArrowSmallUp className="text-lg" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveColumnItem(rowId, item.id, column.id, columnItem.id, 'down')}
                                disabled={columnItemIndex === orderedColumnItems.length - 1}
                                className="rounded-xl border border-surface-200 bg-white p-2 text-slate-600 transition hover:border-brand/30 hover:text-brand disabled:opacity-40"
                              >
                                <HiOutlineArrowSmallDown className="text-lg" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeColumnItem(rowId, item.id, column.id, columnItem.id)}
                                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                              >
                                Quitar
                              </button>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => addColumnItem(rowId, item.id, column.id)}
                          className="rounded-xl border border-dashed border-surface-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                        >
                          Anadir enlace a columna
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="rounded-2xl border border-dashed border-surface-300 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h5 className="text-sm font-semibold text-slate-900">Tarjeta destacada</h5>
                        <p className="text-xs text-slate-500">Bloque promocional dentro del mega menu.</p>
                      </div>
                      {item.megaMenu.featured ? (
                        <button
                          type="button"
                          onClick={() => clearFeatured(rowId, item.id)}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                        >
                          Quitar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateFeatured(rowId, item.id, {})}
                          className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
                        >
                          Anadir destacado
                        </button>
                      )}
                    </div>

                    {item.megaMenu.featured && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <label className="text-xs font-medium text-slate-600">
                          Titulo
                          <input
                            type="text"
                            value={item.megaMenu.featured.title}
                            onChange={event => updateFeatured(rowId, item.id, { title: event.target.value })}
                            className="mt-1 w-full rounded-2xl border border-surface-200 px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          Enlace
                          <input
                            type="text"
                            value={item.megaMenu.featured.href}
                            onChange={event => updateFeatured(rowId, item.id, { href: event.target.value })}
                            className="mt-1 w-full rounded-2xl border border-surface-200 px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-600 md:col-span-2">
                          Descripcion
                          <textarea
                            value={item.megaMenu.featured.description}
                            onChange={event => updateFeatured(rowId, item.id, { description: event.target.value })}
                            rows={2}
                            className="mt-1 w-full rounded-2xl border border-surface-200 px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-600 md:col-span-2">
                          Imagen (URL)
                          <input
                            type="text"
                            value={item.megaMenu.featured.imageUrl}
                            onChange={event => updateFeatured(rowId, item.id, { imageUrl: event.target.value })}
                            className="mt-1 w-full rounded-2xl border border-surface-200 px-3 py-2.5 text-sm text-slate-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                            placeholder="https://..."
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                ensureMegaMenu(rowId, item.id);
                toggleMegaMenu(item.id);
              }}
              className="rounded-xl border border-surface-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
            >
              Activar mega menu
            </button>
          )}
        </div>
      )}
    </article>
  );
};

export default MenuBuilderPage;
