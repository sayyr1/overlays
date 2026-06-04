import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from '../api/axiosInstance';
import { useAuth } from './AuthContext';
import { usePublicConfig } from './PublicConfigContext';
import { trackCartState } from '../services/crmTracking';

const LOCAL_STORAGE_KEY = 'guest_cart_items';
const CartContext = createContext(null);

const clampQuantity = value => {
  const numeric = Number(value) || 0;
  return Math.min(Math.max(numeric, 1), 99);
};

const readGuestCart = () => {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeGuestCart = items => {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // noop
  }
};

const clearGuestCartStorage = () => {
  try {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // noop
  }
};

const normalizeGuestState = items => {
  const normalized = items.map(item => ({
    productId: item.productId,
    size: item.size || '',
    quantity: clampQuantity(item.quantity),
    unitPrice: Number(item.unitPrice || 0),
    title: item.title || '',
    imageUrl: item.imageUrl || '',
    color: item.color || ''
  }));

  const totals = normalized.reduce(
    (acc, item) => {
      acc.count += item.quantity;
      acc.items += 1;
      acc.subtotal += item.quantity * item.unitPrice;
      return acc;
    },
    { count: 0, items: 0, subtotal: 0 }
  );

  return {
    items: normalized,
    totals: {
      ...totals,
      subtotal: Number(totals.subtotal.toFixed(2))
    }
  };
};

export const CartProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { isModuleEnabled } = usePublicConfig();
  const [cart, setCart] = useState(() => normalizeGuestState(readGuestCart()));
  const [loading, setLoading] = useState(false);

  const setFromServer = useCallback(payload => {
    const items = (payload.items ?? []).map(item => ({
      ...item,
      productId: item.productId || item.product,
      color: item.color || ''
    }));
    setCart({
      items,
      totals: payload.totals ?? { count: 0, items: 0, subtotal: 0 }
    });
  }, []);

  const fetchServerCart = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/cart', { withCredentials: true });
      setFromServer(data);
    } catch {
      setFromServer({ items: [], totals: { count: 0, items: 0, subtotal: 0 } });
    } finally {
      setLoading(false);
    }
  }, [setFromServer]);

  const syncGuestToState = useCallback(() => {
    setCart(normalizeGuestState(readGuestCart()));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      syncGuestToState();
      return;
    }

    const guestItems = readGuestCart();

    const sync = async () => {
      setLoading(true);
      try {
        if (guestItems.length) {
          const { data } = await axios.post(
            '/api/cart/merge',
            { guestItems },
            { withCredentials: true }
          );
          clearGuestCartStorage();
          setFromServer(data);
        } else {
          await fetchServerCart();
        }
      } catch {
        await fetchServerCart();
      } finally {
        setLoading(false);
      }
    };

    sync();
  }, [isAuthenticated, fetchServerCart, setFromServer, syncGuestToState]);

  useEffect(() => {
    if (loading || !isModuleEnabled('crm')) {
      return;
    }

    trackCartState({
      items: cart.items,
      status: cart.items.length ? 'active' : 'discarded',
      eventType: cart.items.length ? 'product_added_to_cart' : 'cart_created'
    });
  }, [cart.items, isModuleEnabled, loading]);

  const addItem = useCallback(
    async ({ productId, size = '', quantity = 1, unitPrice = 0, title = '', imageUrl = '', color = '' }) => {
      const payload = {
        productId,
        size,
        quantity: clampQuantity(quantity),
        unitPrice,
        title,
        imageUrl,
        color
      };

      if (isAuthenticated) {
        const { data } = await axios.post('/api/cart/add', payload, { withCredentials: true });
        setFromServer(data);
        return data;
      }

      const guestItems = readGuestCart();
      const existing = guestItems.find(
        item =>
          item.productId === productId &&
          (item.size || '') === (size || '') &&
          (item.color || '') === (color || '')
      );

      if (existing) {
        existing.quantity = clampQuantity(existing.quantity + payload.quantity);
        existing.unitPrice = unitPrice;
        existing.title = title || existing.title;
        existing.imageUrl = imageUrl || existing.imageUrl;
        existing.color = color || existing.color;
      } else {
        guestItems.push({
          productId,
          size: size || '',
          quantity: payload.quantity,
          unitPrice,
          title,
          imageUrl,
          color
        });
      }

      writeGuestCart(guestItems);
      const nextState = normalizeGuestState(guestItems);
      setCart(nextState);
      return nextState;
    },
    [isAuthenticated, setFromServer]
  );

  const updateItem = useCallback(
    async ({ productId, size = '', quantity, color = '' }) => {
      const clamped = clampQuantity(quantity);

      if (isAuthenticated) {
        const { data } = await axios.patch(
          `/api/cart/item/${productId}`,
          { size, quantity: clamped, color },
          { withCredentials: true }
        );
        setFromServer(data);
        return data;
      }

      const guestItems = readGuestCart();
      const item = guestItems.find(
        guest =>
          guest.productId === productId &&
          (guest.size || '') === (size || '') &&
          (guest.color || '') === (color || '')
      );

      if (!item) return normalizeGuestState(guestItems);

      item.quantity = clamped;
      writeGuestCart(guestItems);
      const nextState = normalizeGuestState(guestItems);
      setCart(nextState);
      return nextState;
    },
    [isAuthenticated, setFromServer]
  );

  const removeItem = useCallback(
    async ({ productId, size = '', color = '' }) => {
      if (isAuthenticated) {
        const { data } = await axios.delete(`/api/cart/item/${productId}`, {
          data: { size, color },
          withCredentials: true
        });
        setFromServer(data);
        return data;
      }

      const guestItems = readGuestCart().filter(
        item =>
          !(
            item.productId === productId &&
            (item.size || '') === (size || '') &&
            (item.color || '') === (color || '')
          )
      );
      writeGuestCart(guestItems);
      const nextState = normalizeGuestState(guestItems);
      setCart(nextState);
      return nextState;
    },
    [isAuthenticated, setFromServer]
  );

  const clearCart = useCallback(async () => {
    if (isAuthenticated) {
      const { data } = await axios.delete('/api/cart', { withCredentials: true });
      setFromServer(data);
      return data;
    }

    clearGuestCartStorage();
    const nextState = normalizeGuestState([]);
    setCart(nextState);
    return nextState;
  }, [isAuthenticated, setFromServer]);

  const value = useMemo(
    () => ({
      cart,
      loading,
      addItem,
      updateItem,
      removeItem,
      clearCart,
      items: cart.items,
      totals: cart.totals,
      count: cart.totals?.count ?? 0
    }),
    [cart, loading, addItem, updateItem, removeItem, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
};
