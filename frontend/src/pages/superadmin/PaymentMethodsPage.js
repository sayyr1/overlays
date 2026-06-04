import React, { useEffect, useState } from 'react';
import {
  createSuperAdminPaymentMethod,
  deleteSuperAdminPaymentMethod,
  getSuperAdminPaymentMethods,
  updateSuperAdminPaymentMethod
} from '../../api/superAdmin';
import { usePublicConfig } from '../../context/PublicConfigContext';

const createEmptyForm = () => ({
  name: '',
  type: 'other',
  enabled: true,
  instructions: '',
  bankName: '',
  accountNumber: '',
  accountOwner: '',
  accountId: '',
  accountType: '',
  displayOrder: 0
});

const sortPaymentMethods = items =>
  [...items].sort(
    (a, b) =>
      (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
      (a.name || '').localeCompare(b.name || '')
  );

const PaymentMethodsPage = () => {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [form, setForm] = useState(createEmptyForm());
  const [editingId, setEditingId] = useState('');
  const [saving, setSaving] = useState(false);
  const { upsertPublicPaymentMethod, removePublicPaymentMethod } = usePublicConfig();

  const loadMethods = async () => {
    const { data } = await getSuperAdminPaymentMethods();
    setPaymentMethods(sortPaymentMethods(Array.isArray(data) ? data : []));
  };

  useEffect(() => {
    loadMethods();
  }, []);

  const handleChange = event => {
    const { name, value, type, checked } = event.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const startEdit = method => {
    setEditingId(method._id);
    setForm({
      name: method.name || '',
      type: method.type || 'other',
      enabled: Boolean(method.enabled),
      instructions: method.instructions || '',
      bankName: method.bankName || '',
      accountNumber: method.accountNumber || '',
      accountOwner: method.accountOwner || '',
      accountId: method.accountId || '',
      accountType: method.accountType || '',
      displayOrder: method.displayOrder || 0
    });
  };

  const resetForm = () => {
    setEditingId('');
    setForm(createEmptyForm());
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = editingId
        ? await updateSuperAdminPaymentMethod(editingId, form)
        : await createSuperAdminPaymentMethod(form);

      const savedMethod = response.data;
      setPaymentMethods(prev =>
        sortPaymentMethods([
          ...prev.filter(item => item._id !== savedMethod._id),
          savedMethod
        ])
      );
      upsertPublicPaymentMethod(savedMethod);
      resetForm();
      window.alert('Metodo de pago guardado.');
    } catch (error) {
      window.alert(error?.response?.data?.message || 'No se pudo guardar el metodo de pago.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('Eliminar este metodo de pago?')) return;
    try {
      await deleteSuperAdminPaymentMethod(id);
      setPaymentMethods(prev => prev.filter(item => item._id !== id));
      removePublicPaymentMethod(id);
    } catch (error) {
      window.alert(error?.response?.data?.message || 'No se pudo eliminar el metodo.');
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-brand-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Metodos de pago</h2>
        <p className="mt-2 text-sm text-slate-500">Alta, edicion y activacion de medios visibles al cliente.</p>
        <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          El numero de WhatsApp de la tienda ahora se administra solo desde <strong>Super Admin &gt; Configuracion general</strong>.
          Los metodos de pago ya no pueden sobrescribir ese numero.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            ['name', 'Nombre'],
            ['type', 'Tipo'],
            ['bankName', 'Banco'],
            ['accountNumber', 'Numero de cuenta'],
            ['accountOwner', 'Titular'],
            ['accountId', 'Identificacion / RUC / Cedula'],
            ['accountType', 'Tipo de cuenta'],
            ['displayOrder', 'Orden de visualizacion']
          ].map(([name, label]) => (
            <label key={name} className="text-sm font-medium text-slate-700">
              {label}
              <input
                name={name}
                value={form[name]}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
          ))}

          <label className="md:col-span-2 text-sm font-medium text-slate-700">
            Instrucciones visibles
            <textarea
              name="instructions"
              value={form.instructions}
              onChange={handleChange}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="enabled"
              checked={form.enabled}
              onChange={handleChange}
            />
            Metodo activo
          </label>

          <div className="md:col-span-2 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Guardando...' : editingId ? 'Actualizar metodo' : 'Crear metodo'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
              >
                Cancelar edicion
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-3xl bg-white p-8 shadow-brand-sm">
        <h3 className="text-xl font-semibold text-slate-900">Metodos registrados</h3>
        <div className="mt-6 space-y-4">
          {paymentMethods.map(method => (
            <article key={method._id} className="rounded-2xl border border-slate-200 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-slate-900">{method.name}</h4>
                  <p className="text-sm text-slate-500">{method.type}</p>
                  <p className="mt-2 text-sm text-slate-600">{method.instructions || 'Sin instrucciones'}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => startEdit(method)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(method._id)}
                    className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PaymentMethodsPage;
