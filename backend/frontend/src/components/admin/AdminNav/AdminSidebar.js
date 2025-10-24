import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HiOutlineChartPie,
  HiOutlineSquares2X2,
  HiOutlinePlusCircle,
  HiOutlineTag,
  HiOutlineClipboardDocumentList,
  HiOutlineCurrencyDollar,
  HiOutlineInboxStack,
  HiOutlineQuestionMarkCircle
} from 'react-icons/hi2';

const NAV_LINKS = [
  {
    to: '/admin-dashboard',
    label: 'Vision general',
    description: 'Metricas y desempeno',
    icon: HiOutlineChartPie
  },
  {
    to: '/dashboard',
    label: 'Inventario',
    description: 'Catalogo y stock',
    icon: HiOutlineSquares2X2
  },
  {
    to: '/crear-producto',
    label: 'Nuevo producto',
    description: 'Publicar items',
    icon: HiOutlinePlusCircle
  },
  {
    to: '/gestionar-categorias',
    label: 'Categorias',
    description: 'Taxonomia y filtros',
    icon: HiOutlineTag
  },
  {
    to: '/menu-builder',
    label: 'Menu principal',
    description: 'Experiencia de tienda',
    icon: HiOutlineClipboardDocumentList
  },
  {
    to: '/pedidos',
    label: 'Pedidos',
    description: 'Flujo de cumplimiento',
    icon: HiOutlineInboxStack
  },
  {
    to: '/ventas/resumen',
    label: 'Resumen ventas',
    description: 'Reporte financiero',
    icon: HiOutlineCurrencyDollar
  }
];

const AdminSidebar = ({ handleLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const activePath = useMemo(() => location.pathname, [location.pathname]);

  if (!isDesktop) return null;

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-72 flex-col border-r border-surface-200 bg-white/90 backdrop-blur-xl shadow-brand-sm z-[1100]">
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <HiOutlineSquares2X2 className="text-2xl" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Administrativo</p>
            <p className="text-lg font-semibold text-slate-900">NIWAY STORE</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 pt-2 pb-6">
        <ul className="space-y-1.5">
          {NAV_LINKS.map(item => {
            const Icon = item.icon;
            const isActive =
              activePath === item.to || (item.to !== '/crear-producto' && activePath.startsWith(item.to));

            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`group relative flex flex-col gap-1 rounded-xl px-4 py-3 transition-all duration-150 ${
                    isActive
                      ? 'bg-brand/10 text-brand-dark shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-surface-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border text-base ${
                        isActive
                          ? 'border-brand/30 bg-white text-brand'
                          : 'border-surface-200 bg-white text-slate-500 group-hover:border-brand/40 group-hover:text-brand'
                      }`}
                    >
                      <Icon aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="text-xs text-slate-400">{item.description}</p>
                    </div>
                  </div>
                  {isActive && <span className="absolute inset-y-2 left-1 w-1 rounded-full bg-brand" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-6 pb-6 space-y-4">
        <button
          type="button"
          onClick={() => navigate('/crear-producto')}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand text-white px-4 py-3 text-sm font-semibold shadow-brand-sm transition hover:bg-brand-dark"
        >
          <HiOutlinePlusCircle className="text-lg" />
          Nuevo producto
        </button>

        <div className="rounded-xl border border-surface-200 bg-surface-100 px-4 py-3 text-sm text-slate-600">
          <div className="flex items-center gap-2 font-medium text-slate-700">
            <HiOutlineQuestionMarkCircle className="text-lg text-brand" />
            Necesitas ayuda?
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Agenda una llamada con el equipo o visita el centro de soporte.
          </p>
          <a
            href="mailto:soporte@mercado-aureo.com"
            className="mt-3 inline-flex items-center text-xs font-semibold text-brand hover:text-brand-dark"
          >
            Abrir soporte ->
          </a>
        </div>

        <button
          type="button"
          onClick={() => {
            handleLogout();
          }}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
        >
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
