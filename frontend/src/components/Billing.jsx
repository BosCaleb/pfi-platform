// ── Billing — Invoices, Payments, Dashboard (Phase 4.1) ────────────────
import { useEffect, useState } from "react";
import { request } from "../utils/api.js";

const today = () => new Date().toISOString().split("T")[0];

const INV_STATUSES = ["Draft", "Sent", "Paid", "Partially Paid", "Overdue", "Cancelled"];
const PAY_METHODS  = ["Cash", "EFT", "Card", "Manual", "Other"];

function KpiCard({ label, value, color = "cyan" }) {
  return (
    <div className={`ci-kpi-card border-${color}`}>
      <div className="ci-kpi-value" style={{ color: `var(--${color})` }}>{value ?? "—"}</div>
      <div className="ci-kpi-label">{label}</div>
    </div>
  );
}

function InvoiceForm({ members, packages, onSave, onCancel, initial }) {
  const [form, setForm] = useState({
    member_id: "", membership_package_id: "", invoice_date: today(),
    due_date: "", amount_due: "", payment_method: "EFT",
    payment_reference: "", admin_notes: "", invoice_status: "Sent",
    ...initial,
  });
  const [msg, setMsg] = useState("");

  function field(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setMsg("Saving…");
    try {
      await onSave(form);
      setMsg("");
    } catch (err) { setMsg(err.message); }
  }

  return (
    <form className="ci-form" onSubmit={submit}>
      <div className="p2-two-col">
        <label>Member *
          <select required value={form.member_id} onChange={e => field("member_id", Number(e.target.value))}>
            <option value="">— Select Member —</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
          </select>
        </label>
        <label>Package
          <select value={form.membership_package_id || ""} onChange={e => {
            const pkgId = e.target.value ? Number(e.target.value) : "";
            const pkg = packages.find(p => p.id === pkgId);
            field("membership_package_id", pkgId);
            if (pkg) field("amount_due", pkg.price);
          }}>
            <option value="">— None —</option>
            {packages.map(p => <option key={p.id} value={p.id}>{p.package_name} (R {p.price})</option>)}
          </select>
        </label>
        <label>Invoice Date<input type="date" value={form.invoice_date} onChange={e => field("invoice_date", e.target.value)} /></label>
        <label>Due Date<input type="date" value={form.due_date} onChange={e => field("due_date", e.target.value)} /></label>
        <label>Amount Due (R) *<input required type="number" min="0" step="0.01" value={form.amount_due} onChange={e => field("amount_due", e.target.value)} /></label>
        <label>Payment Method
          <select value={form.payment_method} onChange={e => field("payment_method", e.target.value)}>
            {PAY_METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label>Status
          <select value={form.invoice_status} onChange={e => field("invoice_status", e.target.value)}>
            {INV_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Reference<input value={form.payment_reference || ""} onChange={e => field("payment_reference", e.target.value)} /></label>
      </div>
      <label>Admin Notes<textarea value={form.admin_notes || ""} onChange={e => field("admin_notes", e.target.value)} rows={2} /></label>
      {msg && <p className={msg.startsWith("✓") ? "form-note info" : "form-note danger"}>{msg}</p>}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button className="primary" type="submit">Save Invoice</button>
        <button className="ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function PaymentForm({ invoiceId, onSave, onCancel }) {
  const [form, setForm] = useState({ amount: "", payment_date: today(), payment_method: "EFT", payment_reference: "", notes: "" });
  const [msg, setMsg] = useState("");

  function field(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setMsg("Recording…");
    try {
      await onSave({ ...form, invoice_id: invoiceId });
      setMsg("");
    } catch (err) { setMsg(err.message); }
  }

  return (
    <form className="ci-form" onSubmit={submit} style={{ marginTop: "0.75rem" }}>
      <div className="p2-two-col">
        <label>Amount (R) *<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e => field("amount", e.target.value)} /></label>
        <label>Date<input type="date" value={form.payment_date} onChange={e => field("payment_date", e.target.value)} /></label>
        <label>Method
          <select value={form.payment_method} onChange={e => field("payment_method", e.target.value)}>
            {PAY_METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label>Reference<input value={form.payment_reference} onChange={e => field("payment_reference", e.target.value)} /></label>
      </div>
      <label>Notes<textarea value={form.notes} onChange={e => field("notes", e.target.value)} rows={2} /></label>
      {msg && <p className="form-note danger">{msg}</p>}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button className="primary" type="submit">Record Payment</button>
        <button className="ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function InvoiceDetail({ invoice, token, onRefresh }) {
  const [showPay, setShowPay] = useState(false);
  const [msg, setMsg]        = useState("");

  async function recordPayment(form) {
    await request("/api/billing/payments", token, { method: "POST", body: JSON.stringify(form) });
    setShowPay(false);
    setMsg("✓ Payment recorded.");
    onRefresh();
  }

  const statusColor = { Paid: "lime", Overdue: "danger", "Partially Paid": "warn", Draft: "muted", Sent: "cyan", Cancelled: "muted" };

  return (
    <div className="rec-detail">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: 0 }}>{invoice.invoice_number}</h3>
          <div className="text-muted">{invoice.member_name}</div>
          {invoice.package_name && <div className="text-muted">{invoice.package_name}</div>}
        </div>
        <span className={`confidence-badge badge-${statusColor[invoice.invoice_status] || "cyan"}`}>{invoice.invoice_status}</span>
      </div>
      <div className="rec-data-grid" style={{ marginTop: "0.75rem" }}>
        <div><span className="text-muted">Amount Due</span><strong>R {Number(invoice.amount_due).toLocaleString()}</strong></div>
        <div><span className="text-muted">Paid</span><strong>R {Number(invoice.amount_paid || 0).toLocaleString()}</strong></div>
        <div><span className="text-muted">Balance</span><strong style={{ color: (invoice.balance_due || 0) > 0 ? "var(--danger)" : "var(--lime)" }}>R {Number(invoice.balance_due || 0).toLocaleString()}</strong></div>
        <div><span className="text-muted">Invoice Date</span>{invoice.invoice_date || "—"}</div>
        <div><span className="text-muted">Due Date</span>{invoice.due_date || "—"}</div>
        <div><span className="text-muted">Method</span>{invoice.payment_method || "—"}</div>
      </div>

      {invoice.payments?.length > 0 && (
        <div style={{ marginTop: "0.75rem" }}>
          <strong>Payment History</strong>
          {invoice.payments.map(p => (
            <div key={p.id} className="rec-note-row" style={{ marginTop: "0.4rem" }}>
              <span>R {Number(p.amount).toLocaleString()}</span>
              <span className="text-muted">{p.payment_date} · {p.payment_method}</span>
              {p.payment_reference && <span className="text-muted">Ref: {p.payment_reference}</span>}
            </div>
          ))}
        </div>
      )}

      {msg && <p className="form-note info">{msg}</p>}

      {invoice.invoice_status !== "Paid" && invoice.invoice_status !== "Cancelled" && (
        <>
          <button className="primary" style={{ marginTop: "0.75rem" }} onClick={() => setShowPay(p => !p)}>
            {showPay ? "Cancel" : "Record Payment"}
          </button>
          {showPay && <PaymentForm invoiceId={invoice.id} onSave={recordPayment} onCancel={() => setShowPay(false)} />}
        </>
      )}
    </div>
  );
}

export function Billing({ token, members }) {
  const [tab, setTab]           = useState("dashboard");
  const [dash, setDash]         = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [packages, setPackages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [msg, setMsg]           = useState("");

  async function loadDash()     { try { setDash(await request("/api/billing/dashboard", token)); } catch(e) { setMsg(e.message); } }
  async function loadInvoices() { try { setInvoices(await request(`/api/billing/invoices${statusFilter ? `?status=${statusFilter}` : ""}`, token)); } catch(e) { setMsg(e.message); } }
  async function loadPackages() { try { setPackages(await request("/api/membership-packages/?status=Active", token)); } catch(e) {} }

  useEffect(() => { loadDash(); loadPackages(); }, []);
  useEffect(() => { if (tab === "invoices") loadInvoices(); }, [tab, statusFilter]);

  async function saveInvoice(form) {
    await request("/api/billing/invoices", token, { method: "POST", body: JSON.stringify(form) });
    setCreating(false);
    await loadInvoices();
    setMsg("✓ Invoice created.");
  }

  async function deleteInvoice(inv) {
    if (!confirm(`Delete invoice ${inv.invoice_number}?`)) return;
    try {
      await request(`/api/billing/invoices/${inv.id}`, token, { method: "DELETE" });
      setSelected(null);
      await loadInvoices();
    } catch(e) { setMsg(e.message); }
  }

  const statusColor = { Paid: "lime", Overdue: "danger", "Partially Paid": "warn", Draft: "muted", Sent: "cyan", Cancelled: "muted" };

  return (
    <div className="p2-section">
      <div className="p2-section-header">
        <h2>💳 Billing</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {["dashboard", "invoices"].map(t => (
            <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "dashboard" ? "📊 Dashboard" : "🧾 Invoices"}
            </button>
          ))}
        </div>
      </div>
      {msg && <p className={msg.startsWith("✓") ? "form-note info" : "form-note danger"}>{msg}</p>}

      {tab === "dashboard" && dash && (
        <>
          <div className="ci-kpi-row">
            <KpiCard label="Revenue This Month" value={`R ${Number(dash.revenue_this_month).toLocaleString()}`} color="lime" />
            <KpiCard label="Outstanding" value={`R ${Number(dash.outstanding_amount).toLocaleString()}`} color="warn" />
            <KpiCard label="Overdue Invoices" value={dash.overdue_count} color="danger" />
            <KpiCard label="Paid This Month" value={dash.paid_this_month} color="cyan" />
            <KpiCard label="Draft Invoices" value={dash.draft_count} color="purple" />
          </div>
          {dash.recent_payments?.length > 0 && (
            <>
              <h3 className="ops-section-title">Recent Payments</h3>
              <div className="ci-grid">
                {dash.recent_payments.map(p => (
                  <div key={p.id} className="ci-task-row">
                    <span>R {Number(p.amount).toLocaleString()}</span>
                    <span className="text-muted">{p.payment_date} · {p.payment_method}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === "invoices" && (
        <>
          <div className="p2-filter-bar">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {INV_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="primary" onClick={() => { setCreating(c => !c); setSelected(null); }}>
              {creating ? "Cancel" : "+ New Invoice"}
            </button>
            <button className="ghost" onClick={loadInvoices}>Refresh</button>
          </div>

          {creating && (
            <InvoiceForm
              members={members}
              packages={packages}
              onSave={saveInvoice}
              onCancel={() => setCreating(false)}
              initial={{}}
            />
          )}

          <div className="p2-two-col" style={{ gap: "1rem", marginTop: "1rem" }}>
            {/* Invoice list */}
            <div className="ci-grid">
              {invoices.length === 0 && <p className="ci-empty">No invoices found.</p>}
              {invoices.map(inv => (
                <div
                  key={inv.id}
                  className={`ci-task-row ${selected?.id === inv.id ? "active" : ""}`}
                  onClick={() => setSelected(inv)}
                  style={{ cursor: "pointer" }}
                >
                  <div style={{ flex: 1 }}>
                    <strong>{inv.invoice_number}</strong> — {inv.member_name}
                    <span className={`confidence-badge badge-${statusColor[inv.invoice_status] || "cyan"}`} style={{ marginLeft: "0.5rem" }}>{inv.invoice_status}</span>
                    <div className="text-muted" style={{ marginTop: "0.2rem" }}>
                      R {Number(inv.amount_due).toLocaleString()}
                      {(inv.balance_due || 0) > 0 && <span style={{ color: "var(--danger)", marginLeft: "0.5rem" }}>Balance: R {Number(inv.balance_due).toLocaleString()}</span>}
                    </div>
                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>Due: {inv.due_date || "—"}</div>
                  </div>
                  <button className="danger-btn" onClick={e => { e.stopPropagation(); deleteInvoice(inv); }}>Delete</button>
                </div>
              ))}
            </div>

            {/* Invoice detail */}
            {selected && (
              <InvoiceDetail invoice={selected} token={token} onRefresh={async () => {
                await loadInvoices();
                const refreshed = await request(`/api/billing/invoices/${selected.id}`, token);
                setSelected(refreshed);
              }} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
