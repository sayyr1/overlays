import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const inputClassName =
  'mt-1 w-full rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20';

const RegisterPage = () => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();

  const redirectParam = searchParams.get('redirect');
  const safeRedirect =
    redirectParam && redirectParam.startsWith('/') ? redirectParam : '/';
  const loginLink =
    safeRedirect !== '/'
      ? `/login?redirect=${encodeURIComponent(safeRedirect)}`
      : '/login';

  const handleRegister = async event => {
    event.preventDefault();
    setError('');

    try {
      const user = await register({
        name,
        username,
        email,
        password
      });
      const destination = safeRedirect !== '/'
        ? safeRedirect
        : user.role === 'superadmin'
          ? '/super-admin'
          : user.isAdmin
            ? '/admin-dashboard'
            : '/';
      navigate(destination, { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Error al registrar';
      setError(message);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1fr_1fr]">
        <section className="hidden rounded-[2.5rem] border border-surface-200 bg-white p-10 shadow-brand-sm lg:flex lg:min-h-[620px] lg:flex-col lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
              Equipo interno
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-[0.92] text-slate-900">
              Crea accesos con una base clara y ordenada.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-slate-500">
              Registra nuevos usuarios internos con una experiencia mas alineada al producto y no a un formulario generico.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-surface-200 bg-surface-50 p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Paso 1</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">Define nombre y usuario</p>
            </div>
            <div className="rounded-3xl border border-surface-200 bg-surface-50 p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Paso 2</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">Asigna correo opcional y clave</p>
            </div>
            <div className="rounded-3xl border border-surface-200 bg-surface-50 p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Paso 3</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">Ingresa directo al backoffice</p>
            </div>
          </div>
        </section>

        <section className="w-full rounded-[2rem] border border-surface-200 bg-white p-6 shadow-brand-sm sm:p-8 lg:p-10">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
              Nuevo acceso
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900">
              Crear cuenta
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
              Registra un acceso interno con la informacion minima necesaria para empezar a operar.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Nombre</span>
              <input
                type="text"
                placeholder="Nombre del usuario"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
                className={inputClassName}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Nombre de usuario</span>
              <input
                type="text"
                placeholder="Usuario interno"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
                className={inputClassName}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Correo opcional</span>
              <input
                type="email"
                placeholder="correo@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                className={inputClassName}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Contrasena</span>
              <input
                type="password"
                placeholder="Minimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={6}
                required
                autoComplete="new-password"
                className={inputClassName}
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-2xl bg-brand px-5 py-3.5 text-sm font-semibold text-white shadow-brand-sm transition hover:bg-brand-dark"
            >
              Registrar acceso
            </button>
          </form>

          <div className="mt-8 border-t border-surface-200 pt-5">
            <p className="text-sm text-slate-500">Ya tienes cuenta?</p>
            <Link
              to={loginLink}
              className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:text-brand"
            >
              Ir al login
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default RegisterPage;
