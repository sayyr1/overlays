import express from 'express';
import mongoose from 'mongoose';
import NavigationMenu from '../models/NavigationMenu.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

const newId = () => new mongoose.Types.ObjectId().toString();

const ensureMenu = async () => {
  let menu = await NavigationMenu.findOne({ key: 'main' });
  if (menu) {
    return menu;
  }

  menu = await NavigationMenu.create({
    key: 'main',
    title: 'Menu principal',
    rows: [
      {
        id: newId(),
        title: 'Destacados',
        type: 'highlight',
        order: 0,
        items: []
      },
      {
        id: newId(),
        title: 'Categorias',
        type: 'category',
        order: 1,
        items: []
      }
    ]
  });

  return menu;
};

const sanitizeMenuPayload = payload => {
  const safeRows = Array.isArray(payload?.rows) ? payload.rows : [];

  const rows = safeRows.map((row, rowIndex) => {
    const rowId = row?.id || newId();
    const type = ['highlight', 'category'].includes(row?.type) ? row.type : 'highlight';
    const title = row?.title?.toString?.() ?? '';
    const safeItems = Array.isArray(row?.items) ? row.items : [];

    const items = safeItems.map((item, itemIndex) => {
      const itemId = item?.id || newId();
      const label = item?.label?.toString?.() ?? 'Sin titulo';
      const kind = ['link', 'collection', 'category', 'filter'].includes(item?.kind) ? item.kind : 'link';
      const href = item?.href?.toString?.() ?? '';
      const badge = item?.badge?.toString?.() ?? '';
      const settings = item?.settings && typeof item.settings === 'object' ? item.settings : {};

      let megaMenu = null;
      if (item?.megaMenu && typeof item.megaMenu === 'object') {
        const columns = Array.isArray(item.megaMenu.columns)
          ? item.megaMenu.columns.map((column, columnIndex) => {
            const columnId = column?.id || newId();
            const columnTitle = column?.title?.toString?.() ?? '';
            const safeColumnItems = Array.isArray(column?.items) ? column.items : [];

            const columnItems = safeColumnItems.map((columnItem, columnItemIndex) => ({
              id: columnItem?.id || newId(),
              label: columnItem?.label?.toString?.() ?? 'Sin titulo',
              href: columnItem?.href?.toString?.() ?? '#',
              badge: columnItem?.badge?.toString?.() ?? '',
              order: Number.isFinite(columnItem?.order) ? columnItem.order : columnItemIndex
            }));

            return {
              id: columnId,
              title: columnTitle,
              order: Number.isFinite(column?.order) ? column.order : columnIndex,
              items: columnItems
            };
          })
          : [];

        const featured = item.megaMenu.featured && typeof item.megaMenu.featured === 'object'
          ? {
            title: item.megaMenu.featured.title?.toString?.() ?? '',
            description: item.megaMenu.featured.description?.toString?.() ?? '',
            href: item.megaMenu.featured.href?.toString?.() ?? '',
            imageUrl: item.megaMenu.featured.imageUrl?.toString?.() ?? ''
          }
          : null;

        megaMenu = { columns, featured };
      }

      return {
        id: itemId,
        label,
        kind,
        href,
        badge,
        settings,
        megaMenu,
        order: Number.isFinite(item?.order) ? item.order : itemIndex
      };
    });

    return {
      id: rowId,
      title,
      type,
      order: Number.isFinite(row?.order) ? row.order : rowIndex,
      items
    };
  });

  return {
    title: payload?.title?.toString?.() ?? 'Menu principal',
    settings: payload?.settings && typeof payload.settings === 'object' ? payload.settings : {},
    rows
  };
};

router.get('/', async (req, res) => {
  try {
    const menu = await ensureMenu();
    res.json(menu.toObject({ versionKey: false }));
  } catch (error) {
    console.error('Error obteniendo menu de navegacion:', error);
    res.status(500).json({ message: 'No se pudo cargar el menu' });
  }
});

router.put('/', protect, adminOnly, async (req, res) => {
  try {
    const menu = await ensureMenu();
    const sanitized = sanitizeMenuPayload(req.body);

    menu.title = sanitized.title;
    menu.settings = sanitized.settings;
    menu.rows = sanitized.rows;

    await menu.save();

    res.json(menu.toObject({ versionKey: false }));
  } catch (error) {
    console.error('Error actualizando menu de navegacion:', error);
    res.status(500).json({ message: 'No se pudo actualizar el menu' });
  }
});

export default router;

