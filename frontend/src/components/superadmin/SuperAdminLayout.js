import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const links = [
  { to: '/super-admin', label: 'Dashboard', end: true },
  { to: '/super-admin/settings', label: 'Configuracion general' },
  { to: '/super-admin/branding', label: 'Branding' },
  { to: '/super-admin/modules', label: 'Modulos' },
  { to: '/super-admin/access-control', label: 'Control de acceso' },
  { to: '/super-admin/payment-methods', label: 'Metodos de pago' },
  { to: '/super-admin/text-settings', label: 'Textos' },
  { to: '/super-admin/audit-logs', label: 'Auditoria' }
];

const linkClassName = ({ isActive }) =>
  `rounded-xl px-4 py-3 text-sm font-medium transition ${
    isActive
      ? 'bg-slate-900 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

const SuperAdminLayout = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-3xl bg-white p-6 shadow-brand-sm">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Super Admin</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Configuracion global</h1>
          <p className="mt-2 text-sm text-slate-500">
            Plataforma tecnica para parametrizar branding, modulos, pagos, textos y accesos.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">{user?.name || 'Super Admin'}</p>
            <p>{user?.email || 'Sin correo'}</p>
          </div>

          <nav className="mt-6 flex flex-col gap-2">
            {links.map(link => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClassName}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SuperAdminLayout;
