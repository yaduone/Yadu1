import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/UsersPage';
import ProductsPage from './pages/ProductsPage';
import AreasPage from './pages/AreasPage';
import OrdersPage from './pages/OrdersPage';
import ManifestsPage from './pages/ManifestsPage';
import ReportsPage from './pages/ReportsPage';
import LivestreamsPage from './pages/LivestreamsPage';
import PricesPage from './pages/PricesPage';
import DuesPage from './pages/DuesPage';

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
            <Route path="areas" element={<AreasPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="manifests" element={<ManifestsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="livestreams" element={<LivestreamsPage />} />
            <Route path="prices" element={<PricesPage />} />
            <Route path="dues" element={<DuesPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
