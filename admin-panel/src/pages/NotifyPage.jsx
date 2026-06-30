import { useEffect, useState } from 'react';
import api from '../services/api';
import { AlertTriangle, Bell, CheckCircle2, Loader2, Send, Users } from 'lucide-react';

export default function NotifyPage() {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [audience, setAudience] = useState('all'); // 'all' | 'custom'
  const [selectedIds, setSelectedIds] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get('/users/admin/list')
      .then((res) => setUsers(res.data.data.users || []))
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoadingUsers(false));
  }, []);

  function toggleUser(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  }

  async function handleSend(event) {
    event.preventDefault();
    setError('');
    setResult(null);
    if (!title.trim() || !body.trim()) {
      setError('Title and message are required.');
      return;
    }
    if (audience === 'custom' && selectedIds.length === 0) {
      setError('Select at least one user.');
      return;
    }

    setSending(true);
    try {
      const res = await api.post('/notifications/admin/broadcast', {
        title: title.trim(),
        body: body.trim(),
        userIds: audience === 'custom' ? selectedIds : undefined,
      });
      setResult(res.data.data);
      setTitle('');
      setBody('');
      setSelectedIds([]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send notification.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="page-title">Notify Customers</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Send a custom push notification to all customers or a chosen few.
        </p>
      </div>

      <form onSubmit={handleSend} className="card p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
            <Bell size={15} className="text-blue-600" />
          </div>
          <h3 className="font-semibold text-slate-800">New Ping</h3>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
            Audience
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAudience('all')}
              className={audience === 'all' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            >
              <Users size={14} />
              All customers
            </button>
            <button
              type="button"
              onClick={() => setAudience('custom')}
              className={audience === 'custom' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            >
              Choose customers
            </button>
          </div>
        </div>

        {audience === 'custom' && (
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
              Customers ({selectedIds.length} selected)
            </label>
            <div className="border border-slate-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
              {loadingUsers ? (
                <div className="p-4 text-sm text-slate-400 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Loading customers...
                </div>
              ) : users.length === 0 ? (
                <div className="p-4 text-sm text-slate-400">No customers found.</div>
              ) : (
                users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="rounded border-slate-300"
                    />
                    <span className="text-slate-700">{user.name || 'Unnamed'}</span>
                    <span className="text-slate-400 text-xs ml-auto">{user.phone}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
            Title
          </label>
          <input
            className="input"
            value={title}
            maxLength={100}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Holiday delivery update"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
            Message
          </label>
          <textarea
            className="input min-h-28 resize-y"
            value={body}
            maxLength={500}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write the instructions or details to share..."
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
            <AlertTriangle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
            <CheckCircle2 size={14} className="shrink-0" />
            Sent to {result.recipients} customer{result.recipients === 1 ? '' : 's'} ({result.pushed} push delivered).
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={sending} className="btn-primary disabled:opacity-60">
            {sending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Sending
              </>
            ) : (
              <>
                <Send size={15} />
                Send Notification
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
