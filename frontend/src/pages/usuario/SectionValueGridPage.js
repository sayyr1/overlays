import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../../api/axiosInstance';

const normalizeValue = value => (value ?? '').toString().trim();

const resolveAttributeValue = (product, keyName) => {
  const attributes = product?.attributes || {};
  const exactValue = attributes?.[keyName];
  if (exactValue !== undefined) {
    return normalizeValue(exactValue);
  }

  const matchedKey = Object.keys(attributes).find(
    key => key.toLowerCase() === String(keyName).toLowerCase()
  );

  return normalizeValue(matchedKey ? attributes?.[matchedKey] : '');
};

const resolveProductValue = (product, queryKey, resolvedKey) => {
  if (['brand', 'type', 'collection', 'gender'].includes(queryKey)) {
    return normalizeValue(product?.[queryKey]);
  }

  return resolveAttributeValue(product, resolvedKey);
};

const BrowseValueCard = ({ item }) => (
  <Link
    to={item.to}
    className="group block overflow-hidden rounded-[22px] bg-[#efefe8] transition duration-300 hover:-translate-y-1"
  >
    <div className="relative aspect-[1.36/1] overflow-hidden bg-[#e7e5dc]">
      {item.image ? (
        <img
          src={item.image}
          alt={item.label}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#d8d5ca] text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">
          {item.label}
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-60" />
    </div>
    <div className="border-t border-black/5 bg-[#f7f6f0] px-4 py-4">
      <p className="line-clamp-1 text-base font-semibold text-slate-900 sm:text-lg">
        {item.label}
      </p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {item.meta}
      </p>
    </div>
  </Link>
);

const BrowseValueSkeleton = () => (
  <div className="animate-pulse overflow-hidden rounded-[22px] bg-[#1b1b1b]">
    <div className="aspect-[1.36/1] bg-[#242424]" />
    <div className="border-t border-white/10 px-4 py-4">
      <div className="h-4 w-2/3 rounded-full bg-white/10" />
      <div className="mt-2 h-3 w-1/3 rounded-full bg-white/10" />
    </div>
  </div>
);

export default function SectionValueGridPage({
  title,
  description,
  categoryKey,
  queryKey,
  detailBasePath,
  emptyMessage
}) {
  const [categoriesData, setCategoriesData] = useState({});
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [{ data: nextCategories }, { data: nextProducts }] = await Promise.all([
          axios.get('/api/categories'),
          axios.get('/api/products')
        ]);

        if (!cancelled) {
          setCategoriesData(nextCategories || {});
          setProducts(Array.isArray(nextProducts) ? nextProducts : []);
        }
      } catch (error) {
        console.error(`Error cargando pagina de ${title}`, error);
        if (!cancelled) {
          setCategoriesData({});
          setProducts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [title]);

  const resolvedKey = useMemo(() => {
    const keys = Object.keys(categoriesData || {});
    return keys.find(key => key.toLowerCase() === String(categoryKey).toLowerCase()) || categoryKey;
  }, [categoriesData, categoryKey]);

  const rawValues = useMemo(() => {
    const values = categoriesData?.[resolvedKey];
    if (Array.isArray(values) && values.length > 0) {
      return values.map(normalizeValue).filter(Boolean);
    }

    return Array.from(
      new Set(
        products
          .map(product => resolveProductValue(product, queryKey, resolvedKey))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'es'));
  }, [categoriesData, products, queryKey, resolvedKey]);

  const items = useMemo(
    () =>
      rawValues.map(value => {
        const relatedProducts = products.filter(product => {
          const productValue = resolveProductValue(product, queryKey, resolvedKey);
          return productValue.toLowerCase() === value.toLowerCase();
        });

        return {
          label: value,
          to: detailBasePath
            ? `${detailBasePath}/${encodeURIComponent(value)}`
            : `/productos?${encodeURIComponent(queryKey === 'origen' ? resolvedKey : queryKey)}=${encodeURIComponent(value)}`,
          image: relatedProducts[0]?.images?.[0]?.url || '',
          meta: relatedProducts.length > 0 ? `${relatedProducts.length} productos` : 'Explorar'
        };
      }),
    [detailBasePath, products, queryKey, rawValues, resolvedKey]
  );

  return (
    <main className="min-h-screen bg-[#141414]">
      <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#1a1a1a] p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.35em] text-white/35">Home section</p>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm text-white/55 sm:text-base">
            {description}
          </p>
        </section>

        {loading ? (
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <BrowseValueSkeleton key={`browse-skeleton-${index}`} />
            ))}
          </section>
        ) : items.length > 0 ? (
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {items.map(item => (
              <BrowseValueCard key={`${item.label}-${item.to}`} item={item} />
            ))}
          </section>
        ) : (
          <div className="rounded-[22px] border border-dashed border-white/10 bg-[#1a1a1a] px-6 py-12 text-center text-white/50">
            {emptyMessage}
          </div>
        )}
      </div>
    </main>
  );
}
