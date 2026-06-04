import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCRMContacts } from '../../api/crm';

const EMPTY_FILTERS = {
  q: '',
  status: '',
  tag: '',
  onlyActionable: false
};

const CRMContactsPage = () => {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [contacts, setContacts] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadContacts = async currentFilters => {
    try {
      const data = await getCRMContacts(currentFilters);
      setContacts(data.contacts || []);
      setStatuses(data.statuses || []);
      setError('');
    } catch {
      setError('No se pudo cargar la base de contactos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts(EMPTY_FILTERS);
  }, []);

  const handleChange = event => {
    const { name, value, type, checked } = event.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = event => {
    event.preventDefault();
    setLoading(true);
    loadContacts(filters);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando contactos...</div>;
  }

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-brand-sm">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">CRM</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Contactos</h1>
          <p className="mt-2 text-sm text-slate-500">
            Base comercial unificada de visitantes, leads, compradores y clientes inactivos.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="text-sm text-slate-600">
              Buscar
              <input
                type="search"
                name="q"
                value={filters.q}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2"
                placeholder="Nombre, telefono o email"
              />
            </label>
            <label className="text-sm text-slate-600">
              Estado
              <select
                name="status"
                value={filters.status}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2"
              >
                <option value="">Todos</option>
                {statuses.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              Tag
              <input
                type="text"
                name="tag"
                value={filters.tag}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2"
                placeholder="vip, cart_abandoned..."
              />
            </label>
            <label className="mt-6 flex items-center gap-3 text-sm text-slate-600">
              <input
                type="checkbox"
                name="onlyActionable"
                checked={filters.onlyActionable}
                onChange={handleChange}
              />
              Solo accionables
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Filtrar
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-200">
              <thead className="bg-surface-100 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Ultima actividad</th>
                  <th className="px-4 py-3 text-right">Abrir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 text-sm text-slate-700">
                {contacts.length ? (
                  contacts.map(contact => (
                    <tr key={contact._id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{contact.name || 'Sin nombre'}</p>
                        <p className="text-slate-500">{contact.phone || contact.whatsapp || contact.email || 'Sin dato de contacto'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {contact.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p>{contact.source || 'Directo'}</p>
                        <p className="text-xs text-slate-500">{contact.medium || 'organico'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p>Pedidos: {contact.ordersCount || 0}</p>
                        <p className="text-xs text-slate-500">USD {Number(contact.totalSpent || 0).toFixed(2)}</p>
                      </td>
                      <td className="px-4 py-3">
                        {contact.lastSeenAt ? new Date(contact.lastSeenAt).toLocaleString('es-EC') : '--'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/crm/contactos/${contact._id}`}
                          className="font-semibold text-brand hover:text-brand-dark"
                        >
                          Ver ficha
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                      No hay contactos para los filtros actuales.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CRMContactsPage;
