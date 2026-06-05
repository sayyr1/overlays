import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiChevronDown, FiX } from 'react-icons/fi';
import axios from '../../api/axiosInstance';
import ProductMobileCard from '../../components/usuario/ProductMobileCard/ProductMobileCard';

const SORT_OPTIONS = [
  { value: 'featured', label: 'Destacados' },
  { value: 'price-asc', label: 'Precio menor' },
  { value: 'price-desc', label: 'Precio mayor' },
  { value: 'name-asc', label: 'Nombre A-Z' }
];

const ProductSkeletonCard = () => (
  <div className="animate-pulse">
    <div className="h-[152px] rounded-[18px] bg-[#f1f1f1] sm:h-[164px] lg:h-[172px]" />
    <div className="mt-3 h-4 w-4/5 rounded-full bg-white/10" />
    <div className="mt-2 h-3 w-2/5 rounded-full bg-white/10" />
    <div className="mt-2 h-5 w-1/3 rounded-full bg-white/10" />
    <div className="mt-3 h-6 w-24 rounded-md bg-white/10" />
  </div>
);

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

const getProductFieldValue = (product, filterKey) => {
  if (['brand', 'type', 'collection', 'gender'].includes(filterKey)) {
    return normalizeValue(product?.[filterKey]);
  }

  return resolveAttributeValue(product, filterKey);
};

const getUniqueOptions = (products, key) =>
  Array.from(
    new Set(
      products
        .map(product => getProductFieldValue(product, key))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'es'));

export default function ValueDetailPage({
  paramName,
  filterKey,
  browseTitle,
  browsePath,
  titleFormatter,
  descriptionFormatter
}) {
  const params = useParams();
  const rawValue = params?.[paramName] || '';
  const value = decodeURIComponent(rawValue);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('featured');
  const [selectedType, setSelectedType] = useState('');
  const [selectedGender, setSelectedGender] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const queryKey = encodeURIComponent(filterKey);
        const queryValue = encodeURIComponent(value);
        const { data } = await axios.get(`/api/products/filter?${queryKey}=${queryValue}`);

        if (!cancelled) {
          setProducts(Array.isArray(data) ? data : []);
          setSelectedType('');
          setSelectedGender('');
          setSelectedCollection('');
        }
      } catch (error) {
        console.error(`Error cargando detalle de ${browseTitle}`, error);
        if (!cancelled) {
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
  }, [browseTitle, filterKey, value]);

  const filteredProducts = useMemo(() => {
    const next = products.filter(product => {
      if (selectedType && normalizeValue(product.type) !== selectedType) return false;
      if (selectedGender && normalizeValue(product.gender) !== selectedGender) return false;
      if (selectedCollection && normalizeValue(product.collection) !== selectedCollection) return false;
      return true;
    });

    switch (sortKey) {
      case 'price-asc':
        next.sort((a, b) => Number(a?.price?.retail || 0) - Number(b?.price?.retail || 0));
        break;
      case 'price-desc':
        next.sort((a, b) => Number(b?.price?.retail || 0) - Number(a?.price?.retail || 0));
        break;
      case 'name-asc':
        next.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'es'));
        break;
      case 'featured':
      default:
        break;
    }

    return next;
  }, [products, selectedCollection, selectedGender, selectedType, sortKey]);

  const types = useMemo(() => getUniqueOptions(products, 'type'), [products]);
  const genders = useMemo(() => getUniqueOptions(products, 'gender'), [products]);
  const collections = useMemo(() => getUniqueOptions(products, 'collection'), [products]);
  const activeFilterCount = useMemo(
    () => [selectedType, selectedGender, selectedCollection].filter(Boolean).length,
    [selectedCollection, selectedGender, selectedType]
  );

  const title = titleFormatter ? titleFormatter(value) : value;
  const description = descriptionFormatter
    ? descriptionFormatter(value, products.length)
    : `${value} concentra ${products.length} productos para explorar en una sola vista.`;

  return (
    <main className="min-h-screen bg-[#141414]">
      <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#24241f] p-6 sm:p-8">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-4xl text-sm leading-6 text-white/78 sm:text-base">
            {description}
          </p>
          <Link
            to={browsePath}
            className="mt-5 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Volver a {browseTitle.toLowerCase()}
          </Link>
        </section>

        <section className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <aside className="hidden lg:sticky lg:top-28 lg:block lg:w-[280px] lg:shrink-0">
            <div className="rounded-[22px] border border-white/10 bg-[#141414]">
              <div className="border-b border-white/10 px-4 py-4">
                <p className="text-sm font-semibold text-white">Filtrar dentro de {value}</p>
              </div>

              <div className="space-y-5 px-4 py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">Categoria</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedType('')}
                      className={`rounded-full px-3 py-1.5 text-sm transition ${
                        selectedType === '' ? 'bg-white text-slate-950' : 'bg-white/8 text-white/80 hover:bg-white/12'
                      }`}
                    >
                      Todas
                    </button>
                    {types.map(item => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setSelectedType(item)}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          selectedType === item ? 'bg-white text-slate-950' : 'bg-white/8 text-white/80 hover:bg-white/12'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                {genders.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">Genero</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedGender('')}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          selectedGender === '' ? 'bg-white text-slate-950' : 'bg-white/8 text-white/80 hover:bg-white/12'
                        }`}
                      >
                        Todos
                      </button>
                      {genders.map(item => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setSelectedGender(item)}
                          className={`rounded-full px-3 py-1.5 text-sm transition ${
                            selectedGender === item ? 'bg-white text-slate-950' : 'bg-white/8 text-white/80 hover:bg-white/12'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {collections.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">Coleccion</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCollection('')}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          selectedCollection === '' ? 'bg-white text-slate-950' : 'bg-white/8 text-white/80 hover:bg-white/12'
                        }`}
                      >
                        Todas
                      </button>
                      {collections.map(item => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setSelectedCollection(item)}
                          className={`rounded-full px-3 py-1.5 text-sm transition ${
                            selectedCollection === item ? 'bg-white text-slate-950' : 'bg-white/8 text-white/80 hover:bg-white/12'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
                <Link to="/" className="transition hover:text-white">Home</Link>
                <span>/</span>
                <Link to={browsePath} className="transition hover:text-white">{browseTitle}</Link>
                <span>/</span>
                <span className="text-white">{value}</span>
              </div>

              <div className="hidden relative w-full sm:w-[220px] lg:block">
                <select
                  value={sortKey}
                  onChange={event => setSortKey(event.target.value)}
                  className="w-full appearance-none rounded-full border border-white/10 bg-[#2b2b2b] px-4 py-3 pr-10 text-sm font-semibold text-white focus:outline-none"
                >
                  {SORT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      Ordenar: {option.label}
                    </option>
                  ))}
                </select>
                <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/70" />
              </div>
            </div>

            <div className="flex items-center gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setShowMobileFilters(true)}
                className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-[#2b2b2b] px-4 py-3 text-sm font-semibold text-white"
              >
                Filtrar
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/85">
                    {activeFilterCount}
                  </span>
                ) : null}
                <FiChevronDown className="text-white/70" />
              </button>

              <div className="relative min-w-0 flex-1">
                <select
                  value={sortKey}
                  onChange={event => setSortKey(event.target.value)}
                  className="w-full appearance-none rounded-full border border-white/10 bg-[#2b2b2b] px-4 py-3 pr-10 text-sm font-semibold text-white focus:outline-none"
                >
                  {SORT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      Ordenar: {option.label}
                    </option>
                  ))}
                </select>
                <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/70" />
              </div>
            </div>

            {!loading && (
              <p className="text-sm font-semibold text-white">
                {filteredProducts.length} productos disponibles
              </p>
            )}

            {loading ? (
              <section className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 12 }).map((_, index) => (
                  <ProductSkeletonCard key={`value-detail-skeleton-${index}`} />
                ))}
              </section>
            ) : filteredProducts.length > 0 ? (
              <section className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
                {filteredProducts.map(product => (
                  <ProductMobileCard key={product._id} product={product} variant="market" />
                ))}
              </section>
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-[#1a1a1a] px-6 py-12 text-center text-white/50">
                No encontramos productos para esta seleccion.
              </div>
            )}
          </div>
        </section>
      </div>

      {showMobileFilters && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowMobileFilters(false)}
            aria-label="Cerrar filtros"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-[28px] border-t border-white/10 bg-[#141414] shadow-2xl">
            <div className="mx-auto mt-2 h-1.5 w-14 rounded-full bg-white/15" />
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <span className="w-8" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-white">Filtrar</h2>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
              >
                <FiX />
              </button>
            </div>

            <div className="max-h-[calc(88vh-8.75rem)] overflow-y-auto px-4 py-4">
              <div className="rounded-[22px] border border-white/10 bg-[#141414]">
                <div className="border-b border-white/10 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">Filtrar dentro de {value}</p>
                    {activeFilterCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedType('');
                          setSelectedGender('');
                          setSelectedCollection('');
                        }}
                        className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55 transition hover:text-white"
                      >
                        Limpiar
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-5 px-4 py-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">Categoria</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedType('')}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          selectedType === '' ? 'bg-white text-slate-950' : 'bg-white/8 text-white/80 hover:bg-white/12'
                        }`}
                      >
                        Todas
                      </button>
                      {types.map(item => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setSelectedType(item)}
                          className={`rounded-full px-3 py-1.5 text-sm transition ${
                            selectedType === item ? 'bg-white text-slate-950' : 'bg-white/8 text-white/80 hover:bg-white/12'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  {genders.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">Genero</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedGender('')}
                          className={`rounded-full px-3 py-1.5 text-sm transition ${
                            selectedGender === '' ? 'bg-white text-slate-950' : 'bg-white/8 text-white/80 hover:bg-white/12'
                          }`}
                        >
                          Todos
                        </button>
                        {genders.map(item => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setSelectedGender(item)}
                            className={`rounded-full px-3 py-1.5 text-sm transition ${
                              selectedGender === item ? 'bg-white text-slate-950' : 'bg-white/8 text-white/80 hover:bg-white/12'
                            }`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {collections.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">Coleccion</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedCollection('')}
                          className={`rounded-full px-3 py-1.5 text-sm transition ${
                            selectedCollection === '' ? 'bg-white text-slate-950' : 'bg-white/8 text-white/80 hover:bg-white/12'
                          }`}
                        >
                          Todas
                        </button>
                        {collections.map(item => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setSelectedCollection(item)}
                            className={`rounded-full px-3 py-1.5 text-sm transition ${
                              selectedCollection === item ? 'bg-white text-slate-950' : 'bg-white/8 text-white/80 hover:bg-white/12'
                            }`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-[#141414] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="w-full rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white"
              >
                Ver {filteredProducts.length} resultados
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
