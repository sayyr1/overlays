import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HiOutlineChartPie,
  HiOutlineSquares2X2,
  HiOutlinePlusCircle,
  HiOutlineInboxStack,
  HiOutlineArrowRightOnRectangle
} from 'react-icons/hi2';

const NAV_ITEMS = [
  { to: '/admin-dashboard', label: 'Inicio', icon: HiOutlineChartPie },
  { to: '/dashboard', label: 'Inventario', icon: HiOutlineSquares2X2 },
  { to: '/crear-producto', label: 'Nuevo', icon: HiOutlinePlusCircle },
  { to: '/pedidos', label: 'Pedidos', icon: HiOutlineInboxStack }
];

const AdminBottomNav = ({ handleLogout }) => {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[1050] border-t border-surface-200 bg-white/95 backdrop-blur shadow-brand-sm">
      <div className="flex justify-around px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 text-[11px] font-medium uppercase tracking-wide transition ${
                isActive ? 'text-brand' : 'text-slate-500 hover:text-brand'
              }`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl border text-base ${
                isActive
                  ? 'border-brand/40 bg-brand/10 text-brand'
                  : 'border-transparent bg-white shadow-sm text-slate-500'
              }`}>
                <Icon aria-hidden="true" />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-red-500 transition hover:text-red-600"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-base">
            <HiOutlineArrowRightOnRectangle aria-hidden="true" />
          </span>
          <span>Salir</span>
        </button>
      </div>
    </nav>
  );
};

export default AdminBottomNav;


