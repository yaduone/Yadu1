import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, Package, MapPin, ClipboardList,
  FileText, BarChart3, Radio, IndianRupee, Wallet, Bell, LogOut,
  ChevronRight, Menu, X,
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

// Current page label for mobile topbar
function usePageLabel() {
  const { pathname } = useLocation();
  const match = navItems.find((n) =>
    n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)
  );
  return match?.label ?? 'Admin';
}

function SidebarContent({ onClose, admin, onLogout, initials }) {
  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-200 shrink-0">
            <span className="text-white text-sm font-bold">🥛</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">Dairy Admin</p>
            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">Management Panel</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
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
                  onClick={onClose}
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
          onClick={onLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 rounded-xl transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef(null);
  const pageLabel = usePageLabel();

  // Close drawer on outside click
  useEffect(() => {
    if (!drawerOpen) return;
    function handleClick(e) {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setDrawerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [drawerOpen]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const initials = admin?.name
    ? admin.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── Desktop sidebar (lg+) ──────────────────────────── */}
      <aside className="hidden lg:flex w-60 bg-white border-r border-slate-100 flex-col shrink-0 shadow-sm">
        <SidebarContent
          onClose={null}
          admin={admin}
          onLogout={handleLogout}
          initials={initials}
        />
      </aside>

      {/* ── Mobile drawer backdrop ─────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer panel ────────────────────────────── */}
      <div
        ref={drawerRef}
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl
          transform transition-transform duration-300 ease-in-out
          lg:hidden
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <SidebarContent
          onClose={() => setDrawerOpen(false)}
          admin={admin}
          onLogout={handleLogout}
          initials={initials}
        />
      </div>

      {/* ── Right side: topbar + content ──────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100 shadow-sm shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">🥛</span>
            </div>
            <span className="font-bold text-slate-800 text-sm truncate">{pageLabel}</span>
          </div>
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
