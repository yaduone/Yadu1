import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, Package, MapPin, ClipboardList,
  FileText, BarChart3, Radio, IndianRupee, Wallet, Bell, LogOut,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard',   group: 'main' },
  { to: '/users',       icon: Users,           label: 'Users',       group: 'main' },
  { to: '/products',    icon: Package,         label: 'Products',    group: 'main' },
  { to: '/orders',      icon: ClipboardList,   label: 'Orders',      group: 'main' },
  { to: '/areas',       icon: MapPin,          label: 'Areas',       group: 'ops'  },
  { to: '/manifests',   icon: FileText,        label: 'Manifests',   group: 'ops'  },
  { to: '/reports',     icon: BarChart3,       label: 'Reports',     group: 'ops'  },
  { to: '/livestreams', icon: Radio,           label: 'Livestreams', group: 'ops'  },
  { to: '/prices',      icon: IndianRupee,     label: 'Prices',      group: 'fin'  },
  { to: '/dues',        icon: Wallet,          label: 'Dues',        group: 'fin'  },
  { to: '/activity',    icon: Bell,            label: 'Activity',    group: 'fin'  },
];

const groups = [
  { key: 'main', label: 'Management' },
  { key: 'ops',  label: 'Operations' },
  { key: 'fin',  label: 'Finance' },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const initials = admin?.name
    ? admin.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-60 bg-white border-r border-slate-100 flex flex-col shrink-0 shadow-sm">
        {/* Brand */}
        <div className="px-4 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-200">
              <span className="text-white text-sm font-bold">🥛</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 leading-tight">Dairy Admin</p>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">Management Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto space-y-4">
          {groups.map(({ key, label }) => {
            const items = navItems.filter((n) => n.group === key);
            return (
              <div key={key}>
                <p className="px-5 mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {label}
                </p>
                {items.map(({ to, icon: Icon, label: itemLabel }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={17} className={isActive ? 'opacity-100' : 'opacity-70'} />
                        <span className="flex-1">{itemLabel}</span>
                        {isActive && <ChevronRight size={13} className="opacity-60" />}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl mb-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{admin?.name || 'Admin'}</p>
              <p className="text-[10px] text-slate-400 truncate">{admin?.area || 'Area Admin'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
