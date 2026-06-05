import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
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
      const loggedUser = await login({ email, password });
      const destination = loggedUser?.role === 'superadmin'
        ? '/super-admin'
        : loggedUser?.isAdmin
          ? '/admin-dashboard'
          : safeRedirect;
      navigate(destination, { replace: true });
      window.setTimeout(() => {
        document.getElementById('main-content')?.focus();
      }, 50);
    } catch (err) {
      const message = err.response?.data?.message || 'Error al iniciar sesión';
      setError(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
        <h2 className="text-3xl font-semibold text-center text-gray-800 mb-6">Iniciar Sesión</h2>
        {error && (
          <p className="mb-4 text-center text-sm text-red-500">
            {error}
          </p>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Correo electrónico"
              required
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña"
              required
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <button
              type="submit"
              className="w-full p-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-300"
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
            Registrate
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
