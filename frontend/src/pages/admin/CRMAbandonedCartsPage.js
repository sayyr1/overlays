import { useEffect, useMemo, useState } from 'react';
import { HiOutlineArrowTrendingUp, HiOutlineChatBubbleLeftRight, HiOutlineShoppingCart } from 'react-icons/hi2';
import { getAbandonedCarts, updateAbandonedCart } from '../../api/crm';
import CRMSectionNav from '../../components/crm/CRMSectionNav';
import { formatCRMDateTime, formatCRMCurrency, getCartStatusMeta } from '../../components/crm/crmUi';

const CRMAbandonedCartsPage = () => {
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCarts = async () => {
    try {
      const data = await getAbandonedCarts();
      setCarts(Array.isArray(data) ? data : []);
      setError('');
    } catch {
      setError('No se pudieron cargar los carritos abandonados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCarts();
  }, []);

  const handleStatusUpdate = async (cartId, status) => {
    await updateAbandonedCart(cartId, status);
    loadCarts();
  };

  const summary = useMemo(
    () => ({
      total: carts.length,
      contacted: carts.filter(cart => cart.status === 'contacted').length,
      totalValue: carts.reduce((acc, cart) => acc + Number(cart.subtotal || 0), 0)
    }),
    [carts]
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando carritos...</div>;
  }

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <CRMSectionNav />

        <header className="overflow-hidden rounded-[2rem] bg-white p-6 shadow-brand-sm">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">CRM</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">Carritos abandonados</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Recuperacion asistida de oportunidades con intencion de compra y valor ya detectado.
              </p>
            </div>
            <div className="grid gap-3 rounded-3xl border border-surface-200 bg-slate-50 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Pendientes</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.total}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Contactados</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.contacted}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Valor</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCRMCurrency(summary.totalValue)}</p>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="space-y-4">
          {carts.length ? (
            carts.map(cart => {
              const statusMeta = getCartStatusMeta(cart.status);
              return (
                <article key={cart._id} className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-slate-950">
                          {cart.contact?.name || cart.contactName || 'Visitante sin nombre'}
                        </p>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badgeClassName}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">
                        {cart.contact?.phone || cart.contactPhone || cart.contact?.email || cart.contactEmail || 'Sin contacto'}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Subtotal</p>
                          <p className="mt-1 font-semibold text-slate-950">{formatCRMCurrency(cart.subtotal)}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Items</p>
                          <p className="mt-1 font-semibold text-slate-950">{cart.itemsCount || cart.items?.length || 0}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Ultima actividad</p>
                          <p className="mt-1 text-sm font-semibold text-slate-950">{formatCRMDateTime(cart.lastActivityAt)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(cart._id, 'contacted')}
                        className="rounded-2xl border border-surface-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand/30 hover:text-brand"
                      >
                        Contactado
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(cart._id, 'recovered')}
                        className="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                      >
                        Recuperado
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(cart._id, 'discarded')}
                        className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>

                  {cart.items?.length > 0 ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {cart.items.map((item, index) => (
                        <div key={`${item.product}-${index}`} className="rounded-2xl border border-surface-200 px-4 py-4">
                          <div className="flex items-start gap-3">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                              <HiOutlineShoppingCart className="text-xl" />
                            </span>
                            <div>
                              <p className="font-semibold text-slate-950">{item.title || 'Producto'}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {item.quantity} x {formatCRMCurrency(item.unitPrice)}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {item.color || 'Sin color'} {item.size ? `| ${item.size}` : ''}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {cart.suggestedMessage ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700">
                      <div className="flex items-start gap-3">
                        <HiOutlineChatBubbleLeftRight className="mt-0.5 text-lg" />
                        <p className="whitespace-pre-wrap leading-6">{cart.suggestedMessage}</p>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="rounded-3xl border border-surface-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700">
                  <HiOutlineArrowTrendingUp className="text-3xl" />
                </span>
                <p>No hay carritos abandonados pendientes.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CRMAbandonedCartsPage;
