import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineArrowTrendingUp, HiOutlineExclamationTriangle, HiOutlineUsers } from 'react-icons/hi2';
import { getProductInterest } from '../../api/crm';
import { formatCRMDateTime, getCRMStatusMeta } from './crmUi';

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
      <section className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Cargando interes comercial...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error}
      </section>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">CRM</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">Interes comercial</h3>
          <p className="mt-2 text-sm text-slate-500">Lectura de demanda, riesgo y conversion alrededor de este producto.</p>
        </div>
        <Link to="/crm/pipeline" className="text-sm font-semibold text-brand hover:text-brand-dark">
          Ver pipeline
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-surface-200 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Vistas</p>
          <strong className="mt-1 block text-2xl text-slate-950">{data.productViews}</strong>
        </article>
        <article className="rounded-2xl border border-surface-200 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Agregado al carrito</p>
          <strong className="mt-1 block text-2xl text-slate-950">{data.addedToCart}</strong>
        </article>
        <article className="rounded-2xl border border-surface-200 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Carritos abandonados</p>
          <strong className="mt-1 block text-2xl text-slate-950">{data.abandonedCartsCount}</strong>
        </article>
        <article className="rounded-2xl border border-surface-200 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Clientes interesados</p>
          <strong className="mt-1 block text-2xl text-slate-950">{data.interestedCustomers}</strong>
        </article>
        <article className="rounded-2xl border border-surface-200 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Ventas historicas</p>
          <strong className="mt-1 block text-2xl text-slate-950">{data.salesCount}</strong>
        </article>
        <article className="rounded-2xl border border-surface-200 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Stock actual</p>
          <strong className="mt-1 block text-2xl text-slate-950">{data.stockCurrent}</strong>
        </article>
      </div>

      {data.replenishmentRecommendation ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700">
          <div className="flex items-start gap-3">
            <HiOutlineExclamationTriangle className="mt-0.5 text-lg" />
            <p>{data.replenishmentRecommendation}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <HiOutlineUsers className="text-xl" />
            </span>
            <h4 className="text-sm font-semibold text-slate-800">Contactos con interes reciente</h4>
          </div>
          <div className="mt-3 space-y-2">
            {data.interestedContacts?.length ? (
              data.interestedContacts.map(contact => {
                const statusMeta = getCRMStatusMeta(contact.status);
                return (
                  <div
                    key={contact._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-surface-200 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-slate-950">{contact.name || 'Sin nombre'}</p>
                      <p className="text-slate-500">{contact.phone || contact.whatsapp || contact.email || 'Sin dato de contacto'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.badgeClassName}`}>
                        {statusMeta.label}
                      </span>
                      <Link to={`/crm/contactos/${contact._id}`} className="font-semibold text-brand hover:text-brand-dark">
                        Abrir ficha
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-6 text-sm text-slate-500">
                No hay contactos interesados todavia.
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <HiOutlineArrowTrendingUp className="text-xl" />
            </span>
            <h4 className="text-sm font-semibold text-slate-800">Carritos ligados al producto</h4>
          </div>
          <div className="mt-3 space-y-2">
            {data.relatedAbandonedCarts?.length ? (
              data.relatedAbandonedCarts.map(cart => (
                <div key={cart._id} className="rounded-2xl border border-surface-200 px-4 py-3 text-sm">
                  <p className="font-semibold text-slate-950">
                    {cart.contact?.name || 'Visitante sin nombre'}
                  </p>
                  <p className="mt-1 text-slate-500">
                    {cart.contact?.phone || cart.contact?.whatsapp || 'Sin telefono'}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">Ultima actividad: {formatCRMDateTime(cart.lastActivityAt)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-6 text-sm text-slate-500">
                No hay carritos relacionados pendientes.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductInterestPanel;
