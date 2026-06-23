import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HiOutlineChevronDown, HiOutlineMagnifyingGlass, HiOutlinePlus } from 'react-icons/hi2';

const stripDiacritics = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeModelText = value => String(value || '').trim();

const foldText = value => stripDiacritics(normalizeModelText(value)).toLowerCase();

const BrandModelInput = ({
  brand,
  value,
  options = [],
  onChange,
  onCreate,
  canCreate = false,
  creating = false,
  disabled = false,
  label = 'Modelo'
}) => {
  const [query, setQuery] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeoutRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(
    () => () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    },
    []
  );

  const normalizedOptions = useMemo(() => {
    const map = new Map();

    options.forEach(option => {
      const normalized = normalizeModelText(option);
      if (!normalized) {
        return;
      }
      const signature = foldText(normalized);
      if (!map.has(signature)) {
        map.set(signature, normalized);
      }
    });

    return Array.from(map.values()).sort((left, right) => left.localeCompare(right));
  }, [options]);

  const filteredOptions = useMemo(() => {
    const trimmedQuery = normalizeModelText(query);
    if (!trimmedQuery) {
      return normalizedOptions.slice(0, 8);
    }

    const foldedQuery = foldText(trimmedQuery);
    return normalizedOptions
      .filter(option => foldText(option).includes(foldedQuery))
      .slice(0, 8);
  }, [normalizedOptions, query]);

  const hasExactMatch = useMemo(() => {
    const trimmedQuery = normalizeModelText(query);
    if (!trimmedQuery) {
      return false;
    }
    const signature = foldText(trimmedQuery);
    return normalizedOptions.some(option => foldText(option) === signature);
  }, [normalizedOptions, query]);

  const canCreateModel = Boolean(
    canCreate &&
      onCreate &&
      brand &&
      normalizeModelText(query) &&
      !hasExactMatch
  );

  const selectOption = option => {
    const normalized = normalizeModelText(option);
    setQuery(normalized);
    onChange(normalized);
    setIsOpen(false);
  };

  const handleCreate = async () => {
    const normalized = normalizeModelText(query);
    if (!normalized || !canCreateModel) {
      return;
    }

    const created = await onCreate(normalized);
    const resolvedValue = normalizeModelText(created || normalized);
    setQuery(resolvedValue);
    onChange(resolvedValue);
    setIsOpen(false);
  };

  const scheduleClose = () => {
    closeTimeoutRef.current = setTimeout(() => setIsOpen(false), 120);
  };

  const cancelClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  return (
    <label className="text-sm font-medium text-gray-700">
      {label}
      <div className="relative mt-1">
        <div className="flex items-center rounded-md border border-gray-300 bg-white focus-within:border-blue-500">
          <HiOutlineMagnifyingGlass className="ml-3 text-base text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={event => {
              const nextValue = event.target.value;
              setQuery(nextValue);
              onChange(nextValue);
              setIsOpen(true);
            }}
            onFocus={() => {
              cancelClose();
              setIsOpen(true);
            }}
            onBlur={scheduleClose}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                setIsOpen(false);
              }
              if (event.key === 'Enter') {
                if (filteredOptions.length) {
                  event.preventDefault();
                  selectOption(filteredOptions[0]);
                } else if (canCreateModel) {
                  event.preventDefault();
                  handleCreate();
                }
              }
            }}
            disabled={disabled || !brand}
            placeholder={brand ? 'Escribe para buscar o crear un modelo' : 'Primero selecciona una marca'}
            className="w-full rounded-md border-0 bg-transparent p-3 focus:outline-none"
          />
          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={() => setIsOpen(prev => !prev)}
            disabled={disabled || !brand}
            className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Mostrar modelos disponibles"
          >
            <HiOutlineChevronDown className={`text-base transition ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {brand && isOpen && !disabled && (
          <div
            className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            onMouseDown={cancelClose}
          >
            {filteredOptions.length > 0 ? (
              <div className="max-h-64 overflow-y-auto py-2">
                {filteredOptions.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => selectOption(option)}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 ${
                      foldText(option) === foldText(value) && hasExactMatch
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700'
                    }`}
                  >
                    <span>{option}</span>
                    {foldText(option) === foldText(value) && hasExactMatch && (
                      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600">
                        Actual
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-slate-500">
                No hay coincidencias para este modelo.
              </div>
            )}

            {canCreateModel && (
              <div className="border-t border-slate-100 p-2">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <HiOutlinePlus className="text-base" />
                  {creating
                    ? 'Creando modelo...'
                    : `Crear "${normalizeModelText(query)}" en ${brand}`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-gray-500">
        {brand
          ? 'Busca coincidencias escribiendo. Si no existe, puedes crear el modelo sin salir del formulario.'
          : 'Selecciona una marca para ver o crear modelos.'}
      </p>
    </label>
  );
};

export default BrandModelInput;
