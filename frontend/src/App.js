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
import OrigenListPage from './pages/usuario/OrigenListPage';
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
import SuperAdminRoute from './components/SuperAdminRoute';
import ModuleRoute from './components/ModuleRoute';
import PermissionRoute from './components/PermissionRoute';
import StorefrontTracker from './components/StorefrontTracker';
import ScrollToTop from './ScrollToTop';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { PublicConfigProvider } from './context/PublicConfigContext';
import SuperAdminDashboardPage from './pages/superadmin/SuperAdminDashboardPage';
import GeneralSettingsPage from './pages/superadmin/GeneralSettingsPage';
import BrandingSettingsPage from './pages/superadmin/BrandingSettingsPage';
import ModuleConfigPage from './pages/superadmin/ModuleConfigPage';
import PaymentMethodsPage from './pages/superadmin/PaymentMethodsPage';
import TextSettingsPage from './pages/superadmin/TextSettingsPage';
import AuditLogsPage from './pages/superadmin/AuditLogsPage';
import AccessControlPage from './pages/superadmin/AccessControlPage';
import SuperAdminLayout from './components/superadmin/SuperAdminLayout';
import Footer from './components/usuario/HomeSections/Footer';
import CRMDashboardPage from './pages/admin/CRMDashboardPage';
import CRMPipelinePage from './pages/admin/CRMPipelinePage';
import CRMContactsPage from './pages/admin/CRMContactsPage';
import CRMContactDetailPage from './pages/admin/CRMContactDetailPage';
import CRMTasksPage from './pages/admin/CRMTasksPage';
import CRMAbandonedCartsPage from './pages/admin/CRMAbandonedCartsPage';
import CRMConfigPage from './pages/admin/CRMConfigPage';

const AppContent = () => {
  const location = useLocation();
  const hideNavbarRoutes = ['/login', '/register'];

  const operationalAdminRoutes = [
    '/admin-dashboard',
    '/crear-producto',
    '/editar-producto',
    '/gestionar-categorias',
    '/menu-builder',
    '/ventas/resumen',
    '/pedidos',
    '/dashboard',
    '/crm'
  ];

  const isOperationalAdminRoute = operationalAdminRoutes.some(route =>
    location.pathname.startsWith(route)
  );
  const isSuperAdminRoute = location.pathname.startsWith('/super-admin');
  const isBackofficeRoute = isOperationalAdminRoute || isSuperAdminRoute;

  const showNavbar = !hideNavbarRoutes.includes(location.pathname);
  const showStoreFooter = showNavbar && !isBackofficeRoute;

  return (
    <>
      {showNavbar && (isOperationalAdminRoute ? <Navbar /> : !isSuperAdminRoute ? <Navbaruser /> : null)}

      <div
        id="main-content"
        tabIndex="-1"
        className={
          isBackofficeRoute
            ? 'ml-0 md:ml-72 min-h-screen bg-surface-50 pb-24 md:pb-16 pt-20 md:pt-24 transition-all duration-200'
            : 'min-h-screen content-surface'
        }
      >
        <Routes>
          <Route
            path="/ventas/resumen"
            element={
              <AdminRoute>
                <PermissionRoute permission="reports.view">
                  <ModuleRoute required="reports" title="Reportes desactivados">
                    <ResumenVentasPage />
                  </ModuleRoute>
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/gestionar-categorias"
            element={
              <AdminRoute>
                <PermissionRoute permission="categories.manage">
                  <ModuleRoute required="categories" title="Categorias desactivadas">
                    <CategoryManagerPage />
                  </ModuleRoute>
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/menu-builder"
            element={
              <AdminRoute>
                <PermissionRoute permission="menu.manage">
                  <ModuleRoute required="menu" title="Menu desactivado">
                    <MenuBuilderPage />
                  </ModuleRoute>
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              <AdminRoute>
                <PermissionRoute permissions={['reports.view', 'customers.view']} mode="any">
                  <AdminDashboard />
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/pedidos"
            element={
              <AdminRoute>
                <PermissionRoute permission="orders.view">
                  <ModuleRoute required="orders" title="Pedidos desactivados">
                    <PedidosPage />
                  </ModuleRoute>
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/crear-producto"
            element={
              <AdminRoute>
                <PermissionRoute permission="products.create">
                  <ModuleRoute required={['products', 'categories']} title="Catalogo desactivado">
                    <CreateProductPage />
                  </ModuleRoute>
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/editar-producto/:id"
            element={
              <AdminRoute>
                <PermissionRoute permission="products.edit">
                  <ModuleRoute required={['products', 'categories']} title="Catalogo desactivado">
                    <EditProductPage />
                  </ModuleRoute>
                </PermissionRoute>
              </AdminRoute>
            }
          />

          <Route path="/" element={<MainHome />} />
          <Route
            path="/origen"
            element={
              <ModuleRoute required={['products', 'categories']} title="Exploracion desactivada">
                <OrigenListPage />
              </ModuleRoute>
            }
          />
          <Route
            path="/categorias"
            element={
              <ModuleRoute required={['products', 'categories']} title="Categorias desactivadas">
                <CategoriesPage />
              </ModuleRoute>
            }
          />
          <Route
            path="/categoria/:categoria"
            element={
              <ModuleRoute required={['products', 'categories']} title="Categorias desactivadas">
                <CategoriasPage />
              </ModuleRoute>
            }
          />
          <Route
            path="/productos"
            element={
              <ModuleRoute required="products" title="Catalogo desactivado">
                <ProductListPage />
              </ModuleRoute>
            }
          />
          <Route
            path="/product/:id"
            element={
              <ModuleRoute required="products" title="Catalogo desactivado">
                <ProductPublicPage />
              </ModuleRoute>
            }
          />
          <Route
            path="/cart"
            element={
              <ModuleRoute required={['orders', 'payments']} title="Checkout desactivado">
                <CartPage />
              </ModuleRoute>
            }
          />
          <Route
            path="/product-private/:id"
            element={
              <AdminRoute>
                <PermissionRoute permissions={['products.view', 'inventory.view']} mode="any">
                  <ModuleRoute required="products" title="Catalogo desactivado">
                    <ProductDetailsPage />
                  </ModuleRoute>
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/mis-pedidos"
            element={
              <ProtectedRoute>
                <ModuleRoute required="orders" title="Pedidos desactivados">
                  <OrdersPage />
                </ModuleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <AdminRoute>
                <PermissionRoute permissions={['products.view', 'inventory.view']} mode="any">
                  <ModuleRoute required="products" title="Catalogo desactivado">
                    <ProductPage />
                  </ModuleRoute>
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/crm"
            element={
              <AdminRoute>
                <PermissionRoute permission="crm.dashboard">
                  <ModuleRoute required="crm" title="CRM desactivado">
                    <CRMDashboardPage />
                  </ModuleRoute>
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/crm/pipeline"
            element={
              <AdminRoute>
                <PermissionRoute permission="crm.pipelineView">
                  <ModuleRoute required="crm" title="CRM desactivado">
                    <CRMPipelinePage />
                  </ModuleRoute>
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/crm/contactos"
            element={
              <AdminRoute>
                <PermissionRoute permission="crm.contactsView">
                  <ModuleRoute required="crm" title="CRM desactivado">
                    <CRMContactsPage />
                  </ModuleRoute>
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/crm/contactos/:id"
            element={
              <AdminRoute>
                <PermissionRoute permission="crm.contactsView">
                  <ModuleRoute required="crm" title="CRM desactivado">
                    <CRMContactDetailPage />
                  </ModuleRoute>
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/crm/tareas"
            element={
              <AdminRoute>
                <PermissionRoute permission="crm.tasksView">
                  <ModuleRoute required="crm" title="CRM desactivado">
                    <CRMTasksPage />
                  </ModuleRoute>
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/crm/carritos-abandonados"
            element={
              <AdminRoute>
                <PermissionRoute permission="crm.abandonedView">
                  <ModuleRoute required="crm" title="CRM desactivado">
                    <CRMAbandonedCartsPage />
                  </ModuleRoute>
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/crm/config"
            element={
              <AdminRoute>
                <PermissionRoute permission="crm.configManage">
                  <ModuleRoute required="crm" title="CRM desactivado">
                    <CRMConfigPage />
                  </ModuleRoute>
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/super-admin"
            element={
              <SuperAdminRoute>
                <SuperAdminLayout />
              </SuperAdminRoute>
            }
          >
            <Route index element={<SuperAdminDashboardPage />} />
            <Route path="settings" element={<GeneralSettingsPage />} />
            <Route path="branding" element={<BrandingSettingsPage />} />
            <Route path="modules" element={<ModuleConfigPage />} />
            <Route path="access-control" element={<AccessControlPage />} />
            <Route path="payment-methods" element={<PaymentMethodsPage />} />
            <Route path="text-settings" element={<TextSettingsPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
          </Route>

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<h1>404 - Pagina no encontrada</h1>} />
        </Routes>
      </div>
      {showStoreFooter && <Footer />}
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <PublicConfigProvider>
        <CartProvider>
          <Router>
            <ScrollToTop />
            <StorefrontTracker />
            <AppContent />
          </Router>
        </CartProvider>
      </PublicConfigProvider>
    </AuthProvider>
  );
}

export default App;
