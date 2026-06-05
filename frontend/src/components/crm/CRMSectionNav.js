import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePublicConfig } from '../../context/PublicConfigContext';

const BASE_ITEMS = [
  { to: '/crm', label: 'Resumen', permission: 'crm.dashboard' },
  { to: '/crm/pipeline', label: 'Pipeline', permission: 'crm.pipelineView' },
  { to: '/crm/contactos', label: 'Contactos', permission: 'crm.contactsView' },
  { to: '/crm/tareas', label: 'Tareas', permission: 'crm.tasksView' },
  { to: '/crm/carritos-abandonados', label: 'Carritos', permission: 'crm.abandonedView' },
  { to: '/crm/config', label: 'Configuracion', permission: 'crm.configManage' }
];

const CRMSectionNav = ({ extraItem = null }) => {
  const location = useLocation();
  const { hasPermission } = useAuth();
  const { isModuleEnabled } = usePublicConfig();

  if (!isModuleEnabled('crm')) {
    return null;
  }

  const items = [
    ...BASE_ITEMS.filter(item => hasPermission(item.permission)),
    ...(extraItem ? [extraItem] : [])
  ];

  if (!items.length) {
    return null;
  }

  return (
    <nav className="overflow-x-auto rounded-2xl border border-surface-200 bg-white p-2 shadow-sm">
      <div className="flex min-w-max items-center gap-2">
        {items.map(item => {
          const isActive =
            location.pathname === item.to ||
            (item.matchPrefix ? location.pathname.startsWith(item.matchPrefix) : false);

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'bg-slate-950 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default CRMSectionNav;
