// src/App.js

import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation
} from 'react-router-dom';

import LoginPage from './pages/admin/LoginPage';
import RegisterPage from './pages/admin/RegisterPage';
import ProductPage from './pages/usuario/ProductPage';
import CreateProductPage from './pages/admin/CreateProductPage';
import EditProductPage from './pages/admin/EditProductPage';
import ProductDetailsPage from './pages/admin/ProductDetailsPage';
import ProductListPage from './pages/usuario/ProductListPage';
import ProductPublicPage from './pages/usuario/ProductPublicPage';
import CartPage from './pages/usuario/CartPage';
import OrdersPage from './pages/usuario/OrdersPage';
import CategoryManagerPage from './pages/admin/CategoryManagerPage';
import PedidosPage from './pages/admin/PedidosPage';
import ResumenVentasPage from './pages/admin/ResumenVentasPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import MenuBuilderPage from './pages/admin/MenuBuilderPage';
import Navbar from './pages/usuario/Navbar';
import Navbaruser from './components/usuario/Navbar/NavbarUser';
import MainHome from './components/usuario/MainHome/MainHome1';
import CategoriasPage from './components/usuario/CategoriasPage/CategoriasPage';
import CategoriesPage from './pages/admin/CategoriesPage';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import ScrollToTop from './ScrollToTop';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

const AppContent = () => {
  const location = useLocation();
  const hideNavbarRoutes = ['/login', '/register'];

  const adminRoutes = [
    '/admin-dashboard',
    '/crear-producto',
    '/editar-producto',
    '/gestionar-categorias',
    '/menu-builder',
    '/ventas/resumen',
    '/pedidos',
    '/dashboard'
  ];

  const isAdminRoute = adminRoutes.some(route =>
    location.pathname.startsWith(route)
  );

  const showNavbar = !hideNavbarRoutes.includes(location.pathname);

  return (
    <>
      {showNavbar && (isAdminRoute ? <Navbar /> : <Navbaruser />)}

      <div
        id="main-content"
        tabIndex="-1"
        className={
          isAdminRoute
            ? 'ml-0 md:ml-72 min-h-screen bg-surface-50 pb-24 md:pb-16 pt-20 md:pt-24 transition-all duration-200'
            : ''
        }
      >
        <Routes>
          {/* Rutas ADMIN */}
          <Route
            path="/ventas/resumen"
            element={
              <AdminRoute>
                <ResumenVentasPage />
              </AdminRoute>
            }
          />
          <Route
            path="/gestionar-categorias"
            element={
              <AdminRoute>
                <CategoryManagerPage />
              </AdminRoute>
            }
          />
          <Route
            path="/menu-builder"
            element={
              <AdminRoute>
                <MenuBuilderPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/pedidos"
            element={
              <AdminRoute>
                <PedidosPage />
              </AdminRoute>
            }
          />
          <Route
            path="/crear-producto"
            element={
              <AdminRoute>
                <CreateProductPage />
              </AdminRoute>
            }
          />
          <Route
            path="/editar-producto/:id"
            element={
              <AdminRoute>
                <EditProductPage />
              </AdminRoute>
            }
          />

          {/* Rutas USUARIO */}
          <Route path="/" element={<MainHome />} />
          <Route path="/categorias" element={<CategoriesPage />} />
          <Route path="/categoria/:categoria" element={<CategoriasPage />} />
          <Route path="/productos" element={<ProductListPage />} />
          <Route path="/product/:id" element={<ProductPublicPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route
            path="/product-private/:id"
            element={
              <ProtectedRoute>
                <ProductDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mis-pedidos"
            element={
              <ProtectedRoute>
                <OrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <ProductPage />
              </ProtectedRoute>
            }
          />

          {/* Rutas de Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Fallback */}
          <Route path="*" element={<h1>404 - Pagina no encontrada</h1>} />
        </Routes>
      </div>
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <ScrollToTop />
          <AppContent />
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;


