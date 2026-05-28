import { useState, useEffect } from "react";

const INV_STATUS_COLOR = {
  "Paid":          "#22c55e",
  "Sent":          "#f59e0b",
  "Overdue":       "#ef4444",
  "Partially Paid":"#f97316",
  "Draft":         "#94a3b8",
  "Cancelled":     "#475569",
};

export default function PortalBilling({ token }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("invoices");

  useEffect(() => {
    fetch("/api/member/billing", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="mp-page"><div className="mp-loading">Loading…</div></div>;

  const { membership, invoices = [], payments = [] } = data || {};
  const outstanding = invoices.filter(i => ["Sent","Overdue","Partially Paid"].includes(i.status));
  const totalOwed   = outstanding.reduce((a, i) => a + (i.balance_due || 0), 0);

  return (
    <div className="mp-page">
      <h2 className="mp-page-title">💳 Billing</h2>

      {/* Membership card */}
      {membership?.type && (
        <div className="mp-card mp-membership-card">
          <div className="mp-mem-card-label">Current Membership</div>
          <div className="mp-mem-card-type">{membership.type}</div>
          <div className="mp-mem-card-row">
            <span className="mp-mem-badge" data-status={membership.status}>{membership.status}</span>
            {membership.end_date && (
              <span className="mp-mem-expire">
                Valid until {new Date(membership.end_date).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            )}
          </div>
          {membership.amount && <div className="mp-mem-amount">R {membership.amount}/month</div>}
        </div>
      )}

      {/* Outstanding banner */}
      {totalOwed > 0 && (
        <div className="mp-alert mp-alert--warn">
          💳 R {totalOwed.toFixed(2)} outstanding across {outstanding.length} invoice{outstanding.length !== 1 ? "s" : ""}
        </div>
      )}

      <div className="mp-tab-pills">
        {[["invoices","Invoices"], ["payments","Payments"]].map(([id, label]) => (
          <button key={id} className={`mp-pill ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "invoices" && (
        <div className="mp-card">
          {invoices.length > 0 ? (
            <div className="mp-invoice-list">
              {invoices.map(inv => (
                <div key={inv.id} className="mp-invoice-row">
                  <div className="mp-invoice-left">
                    <div className="mp-invoice-num">
                      {inv.invoice_number || `#${inv.id}`}
                    </div>
                    <div className="mp-invoice-dates">
                      {inv.issue_date && new Date(inv.issue_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                      {inv.due_date && ` · Due ${new Date(inv.due_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`}
                    </div>
                  </div>
                  <div className="mp-invoice-right">
                    <div className="mp-invoice-amount">R {(inv.amount || 0).toFixed(2)}</div>
                    {inv.balance_due > 0 && inv.status !== "Paid" && (
                      <div className="mp-invoice-balance">Balance: R {inv.balance_due.toFixed(2)}</div>
                    )}
                    <span className="mp-inv-status" style={{ color: INV_STATUS_COLOR[inv.status] || "#94a3b8" }}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="mp-empty">No invoices yet.</p>}
        </div>
      )}

      {tab === "payments" && (
        <div className="mp-card">
          {payments.length > 0 ? (
            <div className="mp-invoice-list">
              {payments.map(pay => (
                <div key={pay.id} className="mp-invoice-row">
                  <div className="mp-invoice-left">
                    <div className="mp-invoice-num">
                      {pay.reference || `Payment #${pay.id}`}
                    </div>
                    <div className="mp-invoice-dates">
                      {pay.date && new Date(pay.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                      {pay.method && ` · ${pay.method}`}
                    </div>
                    {pay.notes && <div className="mp-invoice-notes">{pay.notes}</div>}
                  </div>
                  <div className="mp-invoice-right">
                    <div className="mp-invoice-amount" style={{ color: "#22c55e" }}>
                      R {(pay.amount || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="mp-empty">No payments recorded yet.</p>}
        </div>
      )}
    </div>
  );
}
