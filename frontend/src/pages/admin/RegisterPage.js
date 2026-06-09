import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <h2 className="mb-3 text-center text-3xl font-semibold text-gray-800">
          Crear cuenta
        </h2>
        <p className="mb-6 text-center text-sm text-gray-500">
          Registra tu acceso con nombre de usuario.
        </p>
        {error && (
          <p className="mb-4 text-center text-sm text-red-500">
            {error}
          </p>
        )}
        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            placeholder="Nombre"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            autoComplete="name"
            className="w-full rounded-md border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Nombre de usuario"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoComplete="username"
            className="w-full rounded-md border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="email"
            placeholder="Correo opcional"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-md border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Contrasena"
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={6}
            required
            autoComplete="new-password"
            className="w-full rounded-md border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 py-3 text-white transition duration-300 hover:bg-blue-700"
          >
            Registrarse
          </button>
        </form>
        <div className="mt-6 border-t border-gray-100 pt-4 text-center">
          <p className="text-sm text-gray-500">Ya tienes cuenta?</p>
          <Link
            to={loginLink}
            className="mt-2 inline-flex w-full items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:text-gray-900"
          >
            Ir al login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
