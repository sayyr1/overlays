import { useEffect, useState } from 'react';
import { getAbandonedCarts, updateAbandonedCart } from '../../api/crm';

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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando carritos...</div>;
  }

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-brand-sm">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">CRM</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Carritos abandonados</h1>
          <p className="mt-2 text-sm text-slate-500">
            Recuperacion asistida de oportunidades con valor ya detectado.
          </p>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="space-y-4">
          {carts.length ? (
            carts.map(cart => (
              <article key={cart._id} className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      {cart.contact?.name || cart.contactName || 'Visitante sin nombre'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {cart.contact?.phone || cart.contactPhone || cart.contact?.email || cart.contactEmail || 'Sin contacto'}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Estado: <span className="font-semibold">{cart.status}</span> | Subtotal: USD {Number(cart.subtotal || 0).toFixed(2)}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Ultima actividad: {cart.lastActivityAt ? new Date(cart.lastActivityAt).toLocaleString('es-EC') : '--'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate(cart._id, 'contacted')}
                      className="rounded-xl border border-surface-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand/30 hover:text-brand"
                    >
                      Contactado
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate(cart._id, 'recovered')}
                      className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                    >
                      Recuperado
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate(cart._id, 'discarded')}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                    >
                      Descartar
                    </button>
                  </div>
                </div>

                {cart.items?.length > 0 && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {cart.items.map((item, index) => (
                      <div key={`${item.product}-${index}`} className="rounded-xl border border-surface-200 px-4 py-3">
                        <p className="font-semibold text-slate-900">{item.title || 'Producto'}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.quantity} x USD {Number(item.unitPrice || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {item.color || 'Sin color'} {item.size ? `| ${item.size}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {cart.suggestedMessage && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 whitespace-pre-wrap">
                    {cart.suggestedMessage}
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-surface-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              No hay carritos abandonados pendientes.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CRMAbandonedCartsPage;
