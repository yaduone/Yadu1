import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  Bell,
  UserPlus,
  FileText,
  Ticket,
  UserCheck,
  RefreshCw,
  Filter,
  AlertCircle,
} from 'lucide-react';

// ─── Config ───────────────────────────────────────────────────────────────────

const LOG_TYPES = [
  { key: 'all',               label: 'All Activity' },
  { key: 'new_user',          label: 'New Sign-ups' },
  { key: 'profile_completed', label: 'Profile Completed' },
  { key: 'manifest_generated',label: 'Manifests' },
  { key: 'due_ticket_raised', label: 'Due Tickets' },
];

const TYPE_CONFIG = {
  new_user: {
    icon: UserPlus,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    badge: 'bg-blue-100 text-blue-700',
    label: 'New Sign-up',
  },
  profile_completed: {
    icon: UserCheck,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-100',
    badge: 'bg-green-100 text-green-700',
    label: 'Profile Completed',
  },
  manifest_generated: {
    icon: FileText,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
    badge: 'bg-purple-100 text-purple-700',
    label: 'Manifest',
  },
  due_ticket_raised: {
    icon: Ticket,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-100',
    badge: 'bg-red-100 text-red-700',
    label: 'Due Ticket',
  },
};

const DEFAULT_CONFIG = {
  icon: Bell,
  color: 'text-gray-500',
  bg: 'bg-gray-50',
  border: 'border-gray-100',
  badge: 'bg-gray-100 text-gray-600',
  label: 'Activity',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatFullTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ActivityPage() {
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState('');
  const [filter, setFilter]       = useState('all');
  const [expanded, setExpanded]   = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const params = filter !== 'all' ? `?type=${filter}&limit=100` : '?limit=100';
      const res = await api.get(`/admins/logs${params}`);
      setLogs(res.data.data.logs || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load activity logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Summary counts
  const counts = logs.reduce((acc, l) => {
    acc[l.type] = (acc[l.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Activity Feed</h2>
          <p className="text-sm text-gray-500 mt-0.5">Real-time log of key events in your area</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'new_user',           label: 'New Sign-ups',   color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { key: 'profile_completed',  label: 'Profiles Done',  color: 'text-green-600',  bg: 'bg-green-50'  },
          { key: 'manifest_generated', label: 'Manifests',      color: 'text-purple-600', bg: 'bg-purple-50' },
          { key: 'due_ticket_raised',  label: 'Due Tickets',    color: 'text-red-600',    bg: 'bg-red-50'    },
        ].map(({ key, label, color, bg }) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? 'all' : key)}
            className={`${bg} rounded-xl p-4 text-left border-2 transition-all ${
              filter === key ? 'border-gray-400 shadow-sm' : 'border-transparent'
            }`}
          >
            <p className={`text-2xl font-bold ${color}`}>{counts[key] || 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-gray-400" />
        {LOG_TYPES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Log list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Bell size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No activity yet</p>
          <p className="text-gray-400 text-sm mt-1">Events will appear here as they happen</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <LogCard
              key={log.id}
              log={log}
              expanded={expanded === log.id}
              onToggle={() => setExpanded(expanded === log.id ? null : log.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Log Card ─────────────────────────────────────────────────────────────────

function LogCard({ log, expanded, onToggle }) {
  const cfg = TYPE_CONFIG[log.type] || DEFAULT_CONFIG;
  const Icon = cfg.icon;
  const hasMeta = log.meta && Object.keys(log.meta).length > 0;

  return (
    <div
      className={`bg-white rounded-xl border ${cfg.border} transition-all`}
    >
      <button
        onClick={hasMeta ? onToggle : undefined}
        className={`w-full text-left p-4 ${hasMeta ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'} rounded-xl transition-colors`}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
            <Icon size={18} className={cfg.color} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                {cfg.label}
              </span>
              <span className="text-xs text-gray-400">{formatTime(log.created_at)}</span>
            </div>
            <p className="text-sm font-semibold text-gray-800 mt-1">{log.title}</p>
            <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{log.message}</p>
          </div>

          {/* Expand indicator */}
          {hasMeta && (
            <span className="text-gray-300 text-xs mt-1 shrink-0">
              {expanded ? '▲' : '▼'}
            </span>
          )}
        </div>
      </button>

      {/* Expanded meta */}
      {expanded && hasMeta && (
        <div className="px-4 pb-4">
          <div className="ml-13 pl-13">
            <div className="ml-[52px] bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Details</p>
              <div className="space-y-1">
                {Object.entries(log.meta).map(([k, v]) => (
                  v != null && (
                    <div key={k} className="flex gap-2 text-xs">
                      <span className="text-gray-400 font-medium min-w-[100px] shrink-0">
                        {k.replace(/_/g, ' ')}
                      </span>
                      <span className="text-gray-700 break-all">{String(v)}</span>
                    </div>
                  )
                ))}
                <div className="flex gap-2 text-xs pt-1 border-t border-gray-200 mt-1">
                  <span className="text-gray-400 font-medium min-w-[100px] shrink-0">timestamp</span>
                  <span className="text-gray-700">{formatFullTime(log.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
