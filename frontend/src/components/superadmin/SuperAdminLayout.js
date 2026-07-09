import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const links = [
  { to: '/super-admin', label: 'Dashboard', end: true },
  { to: '/super-admin/settings', label: 'Configuracion general' },
  { to: '/super-admin/catalog-profile', label: 'Perfil catalogo' },
  { to: '/super-admin/branding', label: 'Branding' },
  { to: '/super-admin/home-builder', label: 'Home Builder' },
  { to: '/super-admin/themes', label: 'Temas' },
  { to: '/super-admin/modules', label: 'Modulos' },
  { to: '/super-admin/access-control', label: 'Control de acceso' },
  { to: '/super-admin/payment-methods', label: 'Metodos de pago' },
  { to: '/super-admin/text-settings', label: 'Textos' },
  { to: '/super-admin/forms', label: 'Form Builder' },
  { to: '/super-admin/audit-logs', label: 'Auditoria' }
];

const linkClassName = ({ isActive }) =>
  `rounded-xl px-4 py-3 text-sm font-medium transition ${
    isActive
      ? 'bg-brand text-white shadow-sm'
      : 'text-slate-600 hover:bg-brand/10 hover:text-brand'
  }`;

const SuperAdminLayout = () => {
  const { user } = useAuth();

  return (
    <div className="theme-app-surface min-h-screen px-4 py-8 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="theme-panel rounded-3xl p-6">
          <p className="text-xs uppercase tracking-[0.35em]" style={{ color: 'var(--muted-color)' }}>Super Admin</p>
          <h1 className="mt-2 text-2xl font-semibold">Configuracion global</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted-color)' }}>
            Plataforma tecnica para parametrizar branding, modulos, pagos, textos y accesos.
          </p>

          <div className="theme-panel-subtle mt-6 rounded-2xl px-4 py-3 text-sm">
            <p className="font-semibold">{user?.name || 'Super Admin'}</p>
            <p>{user?.email || 'Sin correo'}</p>
          </div>

          <div className="mt-4">
            <Link
              to="/admin-dashboard"
              className="theme-button-secondary inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition"
            >
              Ir al panel admin
            </Link>
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
