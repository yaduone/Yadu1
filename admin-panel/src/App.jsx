import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/UsersPage';
import ProductsPage from './pages/ProductsPage';
import AreasPage from './pages/AreasPage';
import OrdersPage from './pages/OrdersPage';
import InstantOrdersPage from './pages/InstantOrdersPage';
import ManifestsPage from './pages/ManifestsPage';
import ManifestSettingsPage from './pages/ManifestSettingsPage';
import ReportsPage from './pages/ReportsPage';
import LivestreamsPage from './pages/LivestreamsPage';
import PricesPage from './pages/PricesPage';
import DuesPage from './pages/DuesPage';
import ActivityPage from './pages/ActivityPage';
import CategoriesPage from './pages/CategoriesPage';
import FlowTestingPage from './pages/FlowTestingPage';
import InventoryPage from './pages/InventoryPage';
import NotesPage from './pages/NotesPage';
import NotifyPage from './pages/NotifyPage';
import ChargesPage from './pages/ChargesPage';
import EmailAlertsPage from './pages/EmailAlertsPage';
import CarouselsPage from './pages/CarouselsPage';
import OnboardingPage from './pages/OnboardingPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="areas" element={<AreasPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="instant-orders" element={<InstantOrdersPage />} />
            <Route path="manifests" element={<ManifestsPage />} />
            <Route path="manifest-settings" element={<ManifestSettingsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="livestreams" element={<LivestreamsPage />} />
            <Route path="prices" element={<PricesPage />} />
            <Route path="charges" element={<ChargesPage />} />
            <Route path="email-alerts" element={<EmailAlertsPage />} />
            <Route path="dues" element={<DuesPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="flow-tests" element={<FlowTestingPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="notify" element={<NotifyPage />} />
            <Route path="carousels" element={<CarouselsPage />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
