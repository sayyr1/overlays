import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProductInterest } from '../../api/crm';

const ProductInterestPanel = ({ productId }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getProductInterest(productId)
      .then(response => {
        if (!cancelled) {
          setData(response);
          setError('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('No se pudo cargar el interes CRM del producto.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Cargando interes comercial...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error}
      </section>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">CRM</p>
          <h3 className="text-lg font-semibold text-slate-900">Interes comercial</h3>
        </div>
        <Link
          to="/crm/pipeline"
          className="text-sm font-semibold text-brand hover:text-brand-dark"
        >
          Ver pipeline
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-xl border border-surface-200 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Vistas</p>
          <strong className="mt-1 block text-2xl text-slate-900">{data.productViews}</strong>
        </article>
        <article className="rounded-xl border border-surface-200 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Agregado al carrito</p>
          <strong className="mt-1 block text-2xl text-slate-900">{data.addedToCart}</strong>
        </article>
        <article className="rounded-xl border border-surface-200 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Carritos abandonados</p>
          <strong className="mt-1 block text-2xl text-slate-900">{data.abandonedCartsCount}</strong>
        </article>
        <article className="rounded-xl border border-surface-200 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Clientes interesados</p>
          <strong className="mt-1 block text-2xl text-slate-900">{data.interestedCustomers}</strong>
        </article>
        <article className="rounded-xl border border-surface-200 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Ventas historicas</p>
          <strong className="mt-1 block text-2xl text-slate-900">{data.salesCount}</strong>
        </article>
        <article className="rounded-xl border border-surface-200 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Stock actual</p>
          <strong className="mt-1 block text-2xl text-slate-900">{data.stockCurrent}</strong>
        </article>
      </div>

      {data.replenishmentRecommendation && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {data.replenishmentRecommendation}
        </div>
      )}

      {data.interestedContacts?.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-slate-800">Contactos con interes reciente</h4>
          <div className="mt-3 space-y-2">
            {data.interestedContacts.map(contact => (
              <div
                key={contact._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-surface-200 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">{contact.name || 'Sin nombre'}</p>
                  <p className="text-slate-500">{contact.phone || contact.whatsapp || contact.email || 'Sin dato de contacto'}</p>
                </div>
                <Link
                  to={`/crm/contactos/${contact._id}`}
                  className="text-brand hover:text-brand-dark font-semibold"
                >
                  Abrir ficha
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default ProductInterestPanel;
