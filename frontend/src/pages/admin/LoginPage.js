import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const inputClassName =
  'mt-1 w-full rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const redirectParam = searchParams.get('redirect');
  const safeRedirect =
    redirectParam && redirectParam.startsWith('/') ? redirectParam : '/';
  const registerLink =
    safeRedirect !== '/'
      ? `/register?redirect=${encodeURIComponent(safeRedirect)}`
      : '/register';

  const handleLogin = async event => {
    event.preventDefault();
    setError('');

    try {
      const loggedUser = await login({ username, password });
      const destination = safeRedirect !== '/'
        ? safeRedirect
        : loggedUser?.role === 'superadmin'
          ? '/super-admin'
          : loggedUser?.isAdmin
            ? '/admin-dashboard'
            : '/';
      navigate(destination, { replace: true });
      window.setTimeout(() => {
        document.getElementById('main-content')?.focus();
      }, 50);
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Error al iniciar sesion';
      setError(message);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="hidden rounded-[2.5rem] bg-brand-gradient p-10 text-white shadow-brand-md lg:flex lg:min-h-[620px] lg:flex-col lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
              Backoffice
            </p>
            <h1 className="mt-5 max-w-md text-5xl font-semibold leading-[0.92] text-white">
              Opera catalogo, pedidos y equipo desde un solo acceso.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-white/80">
              Entra al panel administrativo para revisar inventario, confirmar pedidos y mantener la tienda bajo control.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/65">Catalogo</p>
              <p className="mt-2 text-2xl font-semibold text-white">1 panel</p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/65">Pedidos</p>
              <p className="mt-2 text-2xl font-semibold text-white">En vivo</p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/65">Acceso</p>
              <p className="mt-2 text-2xl font-semibold text-white">Seguro</p>
            </div>
          </div>
        </section>

        <section className="w-full rounded-[2rem] border border-surface-200 bg-white p-6 shadow-brand-sm sm:p-8 lg:p-10">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
              Acceso interno
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900">
              Iniciar sesion
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
              Usa tu nombre de usuario para entrar al sistema administrativo y continuar donde dejaste la operacion.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Nombre de usuario</span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="ej. administrador"
                required
                autoComplete="username"
                className={inputClassName}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Contrasena</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Ingresa tu clave"
                required
                autoComplete="current-password"
                className={inputClassName}
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-2xl bg-brand px-5 py-3.5 text-sm font-semibold text-white shadow-brand-sm transition hover:bg-brand-dark"
            >
              Entrar al backoffice
            </button>
          </form>

          <div className="mt-8 border-t border-surface-200 pt-5">
            <p className="text-sm text-slate-500">Aun no tienes acceso?</p>
            <Link
              to={registerLink}
              className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
            >
              Crear cuenta interna
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
