import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminShell from "@/features/admin/AdminShell";
import { fetchOrders, type OrderRow } from "@/features/admin/api";
import { ROUTES } from "@/lib/routes";

const PAYMENT = { cod: "Cash on delivery", card: "Card / Visa" } as const;
const date = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** /admin/orders — every order from the database, newest first. */
export default function AdminOrdersPage() {
  return (
    <AdminShell>
      <OrdersList />
    </AdminShell>
  );
}

function OrdersList() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders().then(setOrders, (err: Error) => setError(err.message));
  }, []);

  const open = (id: string) => navigate(`${ROUTES.adminOrders}/${id}`);

  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-[25px] font-medium uppercase tracking-[0.13em]">Orders</h1>
        {orders && <p className="jk-label text-jk-muted">{orders.length} total</p>}
      </div>

      {error && <p className="mt-8 text-[14px] text-jk-accent">{error}</p>}
      {!orders && !error && <p className="jk-label mt-8 text-jk-muted">Loading…</p>}
      {orders?.length === 0 && <p className="jk-body mt-8">No orders yet. Orders placed on the website appear here.</p>}

      {orders && orders.length > 0 && (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-jk-ink">
                {["Order", "Date", "Customer", "Phone", "Jacket", "Customisation", "Payment", "Status", "PDF"].map((h) => (
                  <th key={h} scope="col" className="jk-label py-3 pr-4 font-semibold text-jk-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => open(o.id)}
                  className="jk-dashed-bottom cursor-pointer align-top transition-colors duration-150 hover:bg-jk-raised"
                >
                  <td className="py-4 pr-4">
                    <Link
                      to={`${ROUTES.adminOrders}/${o.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="whitespace-nowrap font-medium underline-offset-4 hover:text-jk-accent hover:underline"
                    >
                      {o.id}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 text-jk-muted">{date(o.createdAt)}</td>
                  <td className="py-4 pr-4">{o.customerName}</td>
                  <td className="whitespace-nowrap py-4 pr-4">{o.phone}</td>
                  <td className="whitespace-nowrap py-4 pr-4">
                    {o.size} · ×{o.quantity}
                  </td>
                  <td className="max-w-[320px] py-4 pr-4 text-[13px] leading-[1.5] text-jk-body">
                    {o.design.map((d, i) => (
                      <span key={i} className="block">
                        {d}
                      </span>
                    ))}
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4">{PAYMENT[o.paymentMethod] ?? o.paymentMethod}</td>
                  <td className="py-4 pr-4 capitalize">{o.status}</td>
                  <td className="whitespace-nowrap py-4 pr-4 text-jk-muted">{o.productionPdf ? "Ready" : "Not yet"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
