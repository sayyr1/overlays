import React, { useEffect, useMemo, useState } from 'react';
import axios from '../../api/axiosInstance';
import '../../App.css';

const PROTECTED_KEYS = new Set(['brand', 'type', 'size', 'collection', 'gender', 'color']);

const normalizeCategories = (payload = {}) => {
  const out = {};
  if (payload && typeof payload === 'object') {
    Object.entries(payload).forEach(([k, v]) => {
      out[k] = Array.isArray(v) ? v : [];
    });
  }
  PROTECTED_KEYS.forEach(k => {
    if (!Object.prototype.hasOwnProperty.call(out, k)) {
      out[k] = [];
    }
  });
  return out;
};

const CategoryManagerPage = () => {
  const [categories, setCategories] = useState({});
  const [catForm, setCatForm] = useState({ key: '', value: '' });
  const [newKey, setNewKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const keys = useMemo(() => Object.keys(categories).sort((a, b) => a.localeCompare(b)), [categories]);

  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get('/api/categories');
        const normalized = normalizeCategories(data);
        setCategories(normalized);
        setCatForm(prev => {
          const currentKey = prev.key && Object.prototype.hasOwnProperty.call(normalized, prev.key)
            ? prev.key
            : Object.keys(normalized)[0] || '';
          return { ...prev, key: currentKey };
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
    const trimmed = (value || '').trim();
    if (!key || !trimmed) return;

    setSubmitting(true);
    try {
      const { data } = await axios.post('/api/categories', { key, value: trimmed });
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
    if (!window.confirm(`Eliminar "${value}" de ${key}?`)) return;
    try {
      const { data } = await axios.delete('/api/categories', { data: { key, value } });
      setCategories(normalizeCategories(data));
    } catch (err) {
      const message = err?.response?.data?.message || 'Error al eliminar la categoria';
      window.alert(message);
    }
  };

  const handleAddKey = async () => {
    const key = (newKey || '').trim();
    if (!key) return;
    try {
      const { data } = await axios.post('/api/categories/key', { key });
      const normalized = normalizeCategories(data);
      setCategories(normalized);
      setCatForm(prev => ({ ...prev, key }));
      setNewKey('');
    } catch (err) {
      const message = err?.response?.data?.message || 'Error al crear la clave';
      window.alert(message);
    }
  };

  const handleDeleteKey = async key => {
    if (PROTECTED_KEYS.has(key)) {
      window.alert('No se puede eliminar una clave por defecto.');
      return;
    }
    if (!window.confirm(`Eliminar la clave "${key}" y todos sus valores?`)) return;
    try {
      const { data } = await axios.delete('/api/categories/key', { data: { key } });
      const normalized = normalizeCategories(data);
      setCategories(normalized);
      setCatForm(prev => {
        const firstKey = Object.keys(normalized)[0] || '';
        return { ...prev, key: firstKey };
      });
    } catch (err) {
      const message = err?.response?.data?.message || 'Error al eliminar la clave';
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
              {keys.map(k => (
                <option key={k} value={k}>
                  {k}
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

          <div className="flex flex-col sm:flex-row sm:space-x-4 mb-8">
            <input
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              placeholder="Nueva clave (ej: ORIGEN)"
              className="p-2 border border-gray-300 rounded-md w-full sm:w-1/3 mb-2 sm:mb-0"
            />
            <button
              onClick={handleAddKey}
              disabled={!newKey.trim()}
              className="p-2 rounded-md w-full sm:w-auto bg-green-600 text-white hover:bg-green-700 transition"
            >
              Agregar clave
            </button>
          </div>

          <div className="space-y-4">
            {keys.map(k => {
              const values = categories[k] || [];
              return (
                <div key={k}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-medium text-gray-700">{k}</h4>
                    <button
                      onClick={() => handleDeleteKey(k)}
                      disabled={PROTECTED_KEYS.has(k)}
                      className={`text-sm px-3 py-1 rounded ${
                        PROTECTED_KEYS.has(k)
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                      title={PROTECTED_KEYS.has(k) ? 'Clave protegida' : 'Eliminar clave'}
                    >
                      Eliminar clave
                    </button>
                  </div>
                  {values.length ? (
                    values.map(val => (
                      <div
                        key={val}
                        className="flex justify-between items-center p-3 border-b border-gray-200 rounded-lg shadow-sm bg-white hover:bg-gray-100 transition"
                      >
                        <span className="text-gray-800">{val}</span>
                        <button
                          onClick={() => handleDeleteCategory(k, val)}
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

