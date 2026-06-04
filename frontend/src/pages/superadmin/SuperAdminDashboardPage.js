import React, { useEffect, useState } from 'react';
import { getSuperAdminModules, getSuperAdminPaymentMethods } from '../../api/superAdmin';
import { usePublicConfig } from '../../context/PublicConfigContext';

const SuperAdminDashboardPage = () => {
  const { settings, branding } = usePublicConfig();
  const [modules, setModules] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  useEffect(() => {
    const load = async () => {
      const [modulesRes, paymentMethodsRes] = await Promise.all([
        getSuperAdminModules(),
        getSuperAdminPaymentMethods()
      ]);
      setModules(Array.isArray(modulesRes.data) ? modulesRes.data : []);
      setPaymentMethods(Array.isArray(paymentMethodsRes.data) ? paymentMethodsRes.data : []);
    };
    load();
  }, []);

  const activeModules = modules.filter(item => item.enabled).length;
  const activePaymentMethods = paymentMethods.filter(item => item.enabled).length;
  const configReady = Boolean(settings?.businessName && branding?.navbarName);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-brand-sm">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Super Admin</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Dashboard de configuración</h2>
        <p className="mt-3 max-w-3xl text-sm text-slate-500">
          Estado general de la plataforma, módulos activos y parametrización pública del sistema.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl bg-white p-5 shadow-brand-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Empresa</p>
          <strong className="mt-2 block text-xl text-slate-900">{settings?.businessName || 'Sin definir'}</strong>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-brand-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Navbar</p>
          <strong className="mt-2 block text-xl text-slate-900">{branding?.navbarName || 'Sin definir'}</strong>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-brand-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Módulos activos</p>
          <strong className="mt-2 block text-xl text-slate-900">{activeModules}</strong>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-brand-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Pagos activos</p>
          <strong className="mt-2 block text-xl text-slate-900">{activePaymentMethods}</strong>
        </article>
      </div>

      <div className="rounded-3xl bg-white p-8 shadow-brand-sm">
        <h3 className="text-xl font-semibold text-slate-900">Estado general</h3>
        <p className="mt-3 text-sm text-slate-600">
          {configReady
            ? 'La configuración base de empresa y branding está presente.'
            : 'Aún faltan datos básicos de empresa o branding.'}
        </p>
      </div>
    </section>
  );
};

export default SuperAdminDashboardPage;
