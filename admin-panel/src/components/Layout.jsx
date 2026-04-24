import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Package,
  MapPin,
  ClipboardList,
  FileText,
  BarChart3,
  Radio,
  IndianRupee,
  Wallet,
  Bell,
  LogOut,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/areas', icon: MapPin, label: 'Areas' },
  { to: '/orders', icon: ClipboardList, label: 'Orders' },
  { to: '/manifests', icon: FileText, label: 'Manifests' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/livestreams', icon: Radio, label: 'Livestreams' },
  { to: '/prices', icon: IndianRupee, label: 'Prices' },
  { to: '/dues', icon: Wallet, label: 'Dues' },
  { to: '/activity', icon: Bell, label: 'Activity' },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-blue-700">Dairy Admin</h1>
          <p className="text-xs text-gray-500 mt-1">{admin?.name}</p>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
