import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <h2 className="mb-3 text-center text-3xl font-semibold text-gray-800">
          Iniciar sesion
        </h2>
        <p className="mb-6 text-center text-sm text-gray-500">
          Usa tu nombre de usuario para entrar al sistema.
        </p>
        {error && (
          <p className="mb-4 text-center text-sm text-red-500">
            {error}
          </p>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Nombre de usuario"
              required
              autoComplete="username"
              className="w-full rounded-md border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Contrasena"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 p-3 text-white transition duration-300 hover:bg-blue-700"
            >
              Entrar
            </button>
          </div>
        </form>
        <div className="mt-6 border-t border-gray-100 pt-4 text-center">
          <p className="text-sm text-gray-500">Aun no tienes cuenta?</p>
          <Link
            to={registerLink}
            className="mt-2 inline-flex w-full items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:text-gray-900"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
