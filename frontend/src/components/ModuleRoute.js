import React from 'react';
import { usePublicConfig } from '../context/PublicConfigContext';

const ModuleRoute = ({
  children,
  required,
  mode = 'all',
  title = 'Modulo no disponible',
  message
}) => {
  const { loading, areModulesEnabled } = usePublicConfig();

  if (loading) {
    return null;
  }

  if (!areModulesEnabled(required, mode)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-brand-sm">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Configuracion</p>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-3 text-sm text-slate-500">
            {message || 'Esta seccion esta desactivada desde la configuracion global del sistema.'}
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default ModuleRoute;
