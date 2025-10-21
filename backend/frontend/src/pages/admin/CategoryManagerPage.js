import React, { useEffect, useState } from 'react';
import axios from '../../api/axiosInstance';
import '../../App.css';

const CATEGORY_OPTIONS = [
  { value: 'brand', label: 'Marcas' },
  { value: 'type', label: 'Tipos' },
  { value: 'size', label: 'Tallas' },
  { value: 'collection', label: 'Colecciones' },
  { value: 'gender', label: 'Generos' },
  { value: 'color', label: 'Colores' }
];

const buildEmptyCategories = () =>
  CATEGORY_OPTIONS.reduce((acc, option) => {
    acc[option.value] = [];
    return acc;
  }, {});

const normalizeCategories = payload => {
  const base = buildEmptyCategories();
  if (!payload || typeof payload !== 'object') {
    return base;
  }
  CATEGORY_OPTIONS.forEach(option => {
    const values = payload[option.value];
    base[option.value] = Array.isArray(values) ? values : [];
  });
  return base;
};

const getCategoryLabel = key =>
  CATEGORY_OPTIONS.find(option => option.value === key)?.label || key;

const CategoryManagerPage = () => {
  const [categories, setCategories] = useState(buildEmptyCategories());
  const [catForm, setCatForm] = useState({ key: CATEGORY_OPTIONS[0].value, value: '' });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get('/api/categories');
        setCategories(normalizeCategories(data));
        setCatForm(prev => {
          const isValid = CATEGORY_OPTIONS.some(option => option.value === prev.key);
          return { ...prev, key: isValid ? prev.key : CATEGORY_OPTIONS[0].value };
        });
        setError('');
      } catch {
        setError('Error al cargar categorias');
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, []);

  const handleAddCategory = async () => {
    const { key, value } = catForm;
    const trimmed = value.trim();
    if (!key || !trimmed) {
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axios.post(
        '/api/categories',
        { key, value: trimmed },
        { headers: { 'Content-Type': 'application/json' } }
      );
      setCategories(normalizeCategories(data));
      setCatForm(prev => ({ ...prev, value: '' }));
    } catch (err) {
      const message = err?.response?.data?.message || 'Error al crear la categoria';
      window.alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (key, value) => {
    const label = getCategoryLabel(key).toLowerCase();
    if (!window.confirm(`Eliminar "${value}" de ${label}?`)) {
      return;
    }

    try {
      const { data } = await axios.delete('/api/categories', { data: { key, value } });
      setCategories(normalizeCategories(data));
    } catch (err) {
      const message = err?.response?.data?.message || 'Error al eliminar la categoria';
      window.alert(message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Administrador de Categorias</h2>
      {loading ? (
        <p>Cargando categorias...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:space-x-4 mb-6">
            <select
              value={catForm.key}
              onChange={e => setCatForm({ ...catForm, key: e.target.value })}
              className="p-2 border border-gray-300 rounded-md w-full sm:w-1/3 mb-2 sm:mb-0"
            >
              {CATEGORY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              value={catForm.value}
              onChange={e => setCatForm({ ...catForm, value: e.target.value })}
              placeholder="Nuevo valor"
              className="p-2 border border-gray-300 rounded-md w-full sm:w-1/3 mb-2 sm:mb-0"
            />
            <button
              onClick={handleAddCategory}
              disabled={submitting || !catForm.value.trim()}
              className={`p-2 rounded-md w-full sm:w-auto transition ${
                submitting
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {submitting ? 'Agregando...' : 'Agregar'}
            </button>
          </div>

          <div className="space-y-4">
            {CATEGORY_OPTIONS.map(option => {
              const values = categories[option.value] || [];
              return (
                <div key={option.value}>
                  <h4 className="text-lg font-medium text-gray-700 mb-2">{option.label}</h4>
                  {values.length ? (
                    values.map(val => (
                      <div
                        key={val}
                        className="flex justify-between items-center p-3 border-b border-gray-200 rounded-lg shadow-sm bg-white hover:bg-gray-100 transition"
                      >
                        <span className="text-gray-800">{val}</span>
                        <button
                          onClick={() => handleDeleteCategory(option.value, val)}
                          className="text-red-500 hover:text-red-700 transition"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No hay valores cargados.</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default CategoryManagerPage;
