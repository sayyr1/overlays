import React from 'react';
import { NavLink } from 'react-router-dom';
import { AiOutlineHome } from 'react-icons/ai';
import { FiSearch, FiTag, FiPackage } from 'react-icons/fi';
import { HiOutlineShoppingBag } from 'react-icons/hi';
import { useCart } from '../../../context/CartContext';

const navigationLinks = [
  { to: '/', label: 'Inicio', Icon: AiOutlineHome },
  { to: '/productos', label: 'Buscar', Icon: FiSearch },
  { to: '/categorias', label: 'Categorias', Icon: FiTag },
  { to: '/mis-pedidos', label: 'Pedidos', Icon: FiPackage },
  { to: '/cart', label: 'Carrito', Icon: HiOutlineShoppingBag, withBadge: true }
];

const NavbarBottom = () => {
  const { count } = useCart();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/95 text-white border-t border-white/10 backdrop-blur">
      <ul className="flex justify-around items-center py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {navigationLinks.map(link => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 text-xs uppercase tracking-wide transition-colors duration-150 ${
                  isActive ? 'text-teal-300' : 'text-white/80 hover:text-white'
                }`
              }
            >
              <span className="relative flex items-center justify-center">
                <link.Icon className="text-2xl" />
                {link.withBadge && count > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[1.2rem] rounded-full bg-teal-500 px-1 text-center text-[10px] font-bold leading-4 text-black">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </span>
              <span>{link.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default NavbarBottom;

