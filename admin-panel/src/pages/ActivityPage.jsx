import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  Bell, UserPlus, FileText, Ticket, UserCheck,
  RefreshCw, Filter, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';

const LOG_TYPES = [
  { key: 'all',                label: 'All Activity'       },
  { key: 'new_user',           label: 'New Sign-ups'       },
  { key: 'profile_completed',  label: 'Profile Completed'  },
  { key: 'manifest_generated', label: 'Manifests'          },
  { key: 'due_ticket_raised',  label: 'Due Tickets'        },
];

const TYPE_CONFIG = {
  new_user: {
    icon: UserPlus,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    badge: 'badge badge-blue',
    label: 'New Sign-up',
  },
  profile_completed: {
    icon: UserCheck,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    badge: 'badge badge-green',
    label: 'Profile Completed',
  },
  manifest_generated: {
    icon: FileText,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    badge: 'badge badge-purple',
    label: 'Manifest',
  },
  due_ticket_raised: {
    icon: Ticket,
    color: 'text-red-600',
    bg: 'bg-red-50',
    badge: 'badge badge-red',
    label: 'Due Ticket',
  },
};

const DEFAULT_CONFIG = {
  icon: Bell,
  color: 'text-slate-500',
  bg: 'bg-slate-50',
  badge: 'badge badge-gray',
  label: 'Activity',
};

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffMs = Date.now() - d;
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

export default function ActivityPage() {
  const [logs, setLogs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');
  const [filter, setFilter]         = useState('all');
  const [expanded, setExpanded]     = useState(null);

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

  const counts = logs.reduce((acc, l) => {
    acc[l.type] = (acc[l.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Activity Feed</h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time log of key events in your area</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="btn-ghost btn-sm flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { key: 'new_user',           label: 'New Sign-ups',  color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200'    },
          { key: 'profile_completed',  label: 'Profiles Done', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          { key: 'manifest_generated', label: 'Manifests',     color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200'  },
          { key: 'due_ticket_raised',  label: 'Due Tickets',   color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200'     },
        ].map(({ key, label, color, bg, border }) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? 'all' : key)}
            className={`${bg} rounded-2xl p-4 text-left border-2 transition-all ${
              filter === key ? `${border} shadow-sm` : 'border-transparent'
            }`}
          >
            <p className={`text-2xl font-bold ${color}`}>{counts[key] || 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={13} className="text-slate-400" />
        {LOG_TYPES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-secondary'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Log list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="card p-16 text-center">
          <Bell size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No activity yet</p>
          <p className="text-slate-400 text-sm mt-1">Events will appear here as they happen</p>
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

function LogCard({ log, expanded, onToggle }) {
  const cfg = TYPE_CONFIG[log.type] || DEFAULT_CONFIG;
  const Icon = cfg.icon;
  const hasMeta = log.meta && Object.keys(log.meta).length > 0;

  return (
    <div className={`card transition-all ${expanded ? 'ring-1 ring-blue-200' : ''}`}>
      <button
        onClick={hasMeta ? onToggle : undefined}
        className={`w-full text-left p-4 ${hasMeta ? 'cursor-pointer hover:bg-slate-50/60' : 'cursor-default'} rounded-2xl transition-colors`}
      >
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
            <Icon size={18} className={cfg.color} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cfg.badge}>{cfg.label}</span>
              <span className="text-xs text-slate-400">{formatTime(log.created_at)}</span>
            </div>
            <p className="text-sm font-semibold text-slate-800 mt-1">{log.title}</p>
            <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{log.message}</p>
          </div>
          {hasMeta && (
            <span className="text-slate-400 shrink-0 mt-1">
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </span>
          )}
        </div>
      </button>

      {expanded && hasMeta && (
        <div className="px-4 pb-4 animate-fade-in">
          <div className="ml-[52px] bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Details</p>
            <div className="space-y-1.5">
              {Object.entries(log.meta).map(([k, v]) =>
                v != null ? (
                  <div key={k} className="flex gap-3 text-xs">
                    <span className="text-slate-400 font-semibold min-w-[100px] shrink-0 capitalize">
                      {k.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-700 break-all">{String(v)}</span>
                  </div>
                ) : null
              )}
              <div className="flex gap-3 text-xs pt-1.5 border-t border-slate-200 mt-1">
                <span className="text-slate-400 font-semibold min-w-[100px] shrink-0">Timestamp</span>
                <span className="text-slate-700">{formatFullTime(log.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
