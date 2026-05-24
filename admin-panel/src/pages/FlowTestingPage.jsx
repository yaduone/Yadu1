import { createElement, useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ClipboardList,
  FileText,
  FlaskConical,
  Package,
  Play,
  RefreshCw,
  Truck,
  Wallet,
} from 'lucide-react';
import api from '../services/api';

const CHECK_STYLE = {
  pass: { icon: CheckCircle2, badge: 'badge badge-green', label: 'Pass' },
  pending: { icon: Clock3, badge: 'badge badge-yellow', label: 'Pending' },
  warning: { icon: AlertTriangle, badge: 'badge badge-yellow', label: 'Warning' },
  fail: { icon: AlertTriangle, badge: 'badge badge-red', label: 'Fail' },
};

const STEP_ICONS = {
  cart: Package,
  order: ClipboardList,
  manifest: FileText,
  delivery: Truck,
  dues: Wallet,
};

const ROW_STATE = {
  captured: 'badge badge-green',
  awaiting_generation: 'badge badge-yellow',
  extras_mismatch: 'badge badge-red',
  missing_order: 'badge badge-red',
  no_extras: 'badge badge-gray',
};

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function tomorrowDate() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  return formatDate(next);
}

function money(value) {
  return `Rs.${(Number(value) || 0).toFixed(2)}`;
}

function stateLabel(state) {
  return state.replaceAll('_', ' ');
}

export default function FlowTestingPage() {
  const [date, setDate] = useState(tomorrowDate);
  const [audit, setAudit] = useState(null);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState('');
  const [products, setProducts] = useState([]);
  const [simulation, setSimulation] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState('');
  const [form, setForm] = useState({
    product_id: '',
    quantity: 1,
    include_milk: true,
    milk_type: 'cow',
    quantity_litres: 1,
    starting_due: 0,
    payment_amount: 0,
  });

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError('');
    try {
      const res = await api.get(`/testing/delivery-flow?date=${date}`);
      setAudit(res.data.data);
    } catch (err) {
      setAuditError(err.response?.data?.error || 'Failed to load flow audit');
      setAudit(null);
    } finally {
      setAuditLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  useEffect(() => {
    api.get('/products')
      .then((res) => {
        const active = (res.data.data.products || []).filter((product) => product.is_active !== false);
        setProducts(active);
        if (active.length > 0) {
          setForm((current) => current.product_id ? current : { ...current, product_id: active[0].id });
        }
      })
      .catch(() => setProducts([]));
  }, []);

  async function runSimulation(event) {
    event.preventDefault();
    setSimLoading(true);
    setSimError('');
    try {
      const res = await api.post('/testing/delivery-flow/simulate', form);
      setSimulation(res.data.data);
    } catch (err) {
      setSimError(err.response?.data?.error || 'Dry run failed');
      setSimulation(null);
    } finally {
      setSimLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">Flow Tests</h2>
          <p className="text-xs text-slate-400 mt-0.5">Delivery pipeline validation</p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Live Audit</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {audit?.schedule
                ? `Cutoff ${audit.schedule.cutoff_time} / generation ${audit.schedule.generation_time} ${audit.schedule.timezone}`
                : 'Orders and manifest checks'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="input w-auto"
            />
            <button type="button" onClick={loadAudit} disabled={auditLoading} className="btn-ghost btn-sm">
              <RefreshCw size={14} className={auditLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {auditError && <div className="badge badge-red">{auditError}</div>}

        {auditLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, index) => <div key={index} className="card h-20 bg-slate-50 animate-pulse" />)}
          </div>
        ) : audit && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {audit.checks.map((check) => {
                const style = CHECK_STYLE[check.status] || CHECK_STYLE.pending;
                return (
                  <div key={check.key} className="card p-3 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-600 truncate">{check.label}</p>
                      <span className={style.badge}>
                        {createElement(style.icon, { size: 11 })}
                        {style.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{check.detail}</p>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ['Cart Extras', `${audit.totals.cart_extra_units} units`, Package],
                ['Order Extras', `${audit.totals.order_extra_units} units`, ClipboardList],
                ['Product Orders', audit.totals.product_order_count, Truck],
                ['Order Value', money(audit.totals.order_amount), Wallet],
              ].map(([label, value, icon]) => (
                <div key={label} className="card p-4 flex items-center gap-3">
                  {createElement(icon, { size: 16, className: 'text-blue-600 shrink-0' })}
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400 font-semibold uppercase">{label}</p>
                    <p className="text-base font-bold text-slate-800 truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="card overflow-hidden">
              {audit.rows.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-400">No product-cart or product-order records for {date}.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Cart Extras</th>
                      <th>Order Extras</th>
                      <th>Order Status</th>
                      <th>Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.rows.map((row) => (
                      <tr key={row.user_id}>
                        <td className="font-medium text-slate-800">{row.user_name}</td>
                        <td>{row.cart_units} / {money(row.cart_amount)}</td>
                        <td>{row.order_extra_units} / {money(row.order_extra_amount)}</td>
                        <td>
                          <span className={row.order_status ? 'badge badge-gray' : 'text-xs text-slate-400'}>
                            {row.order_status || 'Not generated'}
                          </span>
                        </td>
                        <td>
                          <span className={ROW_STATE[row.state] || 'badge badge-gray'}>
                            {stateLabel(row.state)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Dry Run</h3>
          <p className="text-xs text-slate-400 mt-0.5">No database writes</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[22rem_minmax(0,1fr)] gap-4">
          <form onSubmit={runSimulation} className="card p-4 space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">Product</span>
              <select
                className="select mt-1.5"
                value={form.product_id}
                onChange={(event) => setForm((current) => ({ ...current, product_id: event.target.value }))}
                required
              >
                {products.length === 0 && <option value="">No active products</option>}
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">Product Quantity</span>
              <input
                type="number"
                min="1"
                max="100"
                className="input mt-1.5"
                value={form.quantity}
                onChange={(event) => setForm((current) => ({ ...current, quantity: Number(event.target.value) }))}
              />
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.include_milk}
                onChange={(event) => setForm((current) => ({ ...current, include_milk: event.target.checked }))}
                className="rounded border-slate-300 text-blue-600"
              />
              Include subscription milk
            </label>

            {form.include_milk && (
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="select"
                  value={form.milk_type}
                  onChange={(event) => setForm((current) => ({ ...current, milk_type: event.target.value }))}
                >
                  <option value="cow">Cow</option>
                  <option value="buffalo">Buffalo</option>
                  <option value="toned">Child Pack</option>
                </select>
                <select
                  className="select"
                  value={form.quantity_litres}
                  onChange={(event) => setForm((current) => ({ ...current, quantity_litres: Number(event.target.value) }))}
                >
                  {[0.5, 1, 1.5, 2, 2.5, 3].map((value) => (
                    <option key={value} value={value}>{value} L</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 uppercase">Opening Due</span>
                <input
                  type="number"
                  step="0.01"
                  className="input mt-1.5"
                  value={form.starting_due}
                  onChange={(event) => setForm((current) => ({ ...current, starting_due: Number(event.target.value) }))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 uppercase">Payment</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input mt-1.5"
                  value={form.payment_amount}
                  onChange={(event) => setForm((current) => ({ ...current, payment_amount: Number(event.target.value) }))}
                />
              </label>
            </div>

            {simError && <p className="text-xs font-medium text-red-600">{simError}</p>}
            <button type="submit" disabled={simLoading || !form.product_id} className="btn-primary w-full justify-center">
              {simLoading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
              {simLoading ? 'Running' : 'Run Flow'}
            </button>
          </form>

          <div className="space-y-2">
            {!simulation ? (
              <div className="card p-10 text-center text-sm text-slate-400">
                Select a product and run the delivery flow.
              </div>
            ) : simulation.steps.map((step) => {
              const icon = STEP_ICONS[step.key] || FlaskConical;
              return (
                <div key={step.key} className="card p-4 flex items-start gap-3">
                  <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                    {createElement(icon, { size: 17 })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{step.label}</p>
                    <StepDetail step={step} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function StepDetail({ step }) {
  if (step.key === 'cart') {
    const item = step.extra_items[0];
    return <p className="text-xs text-slate-500 mt-1">{item.product_name} x {item.quantity} / {money(item.total)}</p>;
  }
  if (step.key === 'order') {
    return (
      <p className="text-xs text-slate-500 mt-1">
        {step.milk ? `${step.milk.milk_type} ${step.milk.quantity_litres}L + ` : ''}
        {step.extra_items[0].product_name} / {money(step.total_amount)}
      </p>
    );
  }
  if (step.key === 'manifest') {
    return <p className="text-xs text-slate-500 mt-1">{step.total_extra_items} extra units / {money(step.total_amount)}</p>;
  }
  if (step.key === 'delivery') {
    return <p className="text-xs text-slate-500 mt-1">Status: {step.status} / billed {money(step.billed_amount)}</p>;
  }
  return (
    <p className="text-xs text-slate-500 mt-1">
      {money(step.starting_due)} + {money(step.billed_amount)} - {money(step.payment_amount)} = {money(step.due_after_payment)}
    </p>
  );
}
