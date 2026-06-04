import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCRMPipeline } from '../../api/crm';

const COLUMN_ORDER = ['new_lead', 'contacted', 'link_sent', 'interested', 'cart_abandoned', 'customer', 'vip', 'inactive'];

const COLUMN_LABELS = {
  new_lead: 'Leads nuevos',
  contacted: 'Contactados',
  link_sent: 'Link enviado',
  interested: 'Interesados',
  cart_abandoned: 'Abandonados',
  customer: 'Clientes',
  vip: 'VIP',
  inactive: 'Inactivos'
};

const CRMPipelinePage = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getCRMPipeline()
      .then(data => {
        setContacts(Array.isArray(data) ? data : []);
        setError('');
      })
      .catch(() => {
        setError('No se pudo cargar el pipeline CRM.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const grouped = useMemo(() => {
    return COLUMN_ORDER.reduce((acc, key) => {
      acc[key] = contacts.filter(contact => contact.status === key);
      return acc;
    }, {});
  }, [contacts]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando pipeline...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-brand-sm">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">CRM</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Pipeline comercial</h1>
          <p className="mt-2 text-sm text-slate-500">
            Vista operativa de contactos segun su estado y actividad reciente.
          </p>
        </header>

        <section className="grid gap-4 xl:grid-cols-4">
          {COLUMN_ORDER.map(columnKey => (
            <article key={columnKey} className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">{COLUMN_LABELS[columnKey]}</h2>
                <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                  {grouped[columnKey]?.length || 0}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {(grouped[columnKey] || []).length ? (
                  grouped[columnKey].map(contact => (
                    <Link
                      key={contact._id}
                      to={`/crm/contactos/${contact._id}`}
                      className="block rounded-xl border border-surface-200 px-4 py-3 transition hover:border-brand/30 hover:bg-surface-50"
                    >
                      <p className="font-semibold text-slate-900">{contact.name || 'Sin nombre'}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {contact.phone || contact.whatsapp || contact.email || 'Sin contacto'}
                      </p>
                      {contact.nextTask?.title && (
                        <p className="mt-2 text-xs text-brand">Siguiente tarea: {contact.nextTask.title}</p>
                      )}
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">Sin contactos en esta etapa.</p>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
};

export default CRMPipelinePage;
