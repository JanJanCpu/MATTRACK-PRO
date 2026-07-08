import { useState, useEffect } from "react";
import { PackageOpen, Clock, Truck, CheckCircle, XCircle } from "lucide-react";

export function SellerOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const baseUrl = `http://${window.location.hostname}:8000`;

  const fetchOrders = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${baseUrl}/seller/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error("Failed to load orders", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateOrderStatus = async (orderId: number, newStatus: string) => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(
        `${baseUrl}/seller/orders/${orderId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        },
      );

      if (response.ok) {
        fetchOrders();
      }
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Accepted":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Shipped":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Received":
      case "Delivered":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <PackageOpen className="w-8 h-8 text-blue-600" />
          Incoming Purchase Orders
        </h1>
        <p className="text-slate-500 mt-2">
          Manage requested materials and update shipping statuses.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <PackageOpen className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">No Orders Yet</h3>
            <p className="text-slate-500">
              When PENTABUILD procures materials from your catalog, they will
              appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map((order) => (
              <div
                key={order.id}
                className="p-6 hover:bg-slate-50 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Order Details */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        ORDER #{order.id}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {order.material_name}
                    </h3>
                    <p className="text-sm text-slate-600">
                      Quantity:{" "}
                      <span className="font-bold">{order.quantity}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Ordered on:{" "}
                      {new Date(order.order_date).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Financials & Actions */}
                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Total Value
                      </p>
                      <p className="font-black text-xl text-slate-900">
                        ₱{order.total_price.toFixed(2)}
                      </p>
                    </div>

                    {/* Dynamic Action Buttons based on Status */}
                    <div className="flex items-center gap-2 mt-2">
                      {order.status === "Pending" && (
                        <>
                          <button
                            onClick={() =>
                              updateOrderStatus(order.id, "Accepted")
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition"
                          >
                            <CheckCircle className="w-4 h-4" /> Accept Order
                          </button>
                          <button
                            onClick={() =>
                              updateOrderStatus(order.id, "Cancelled")
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-sm font-bold rounded-lg hover:bg-red-100 transition border border-red-200"
                          >
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                        </>
                      )}

                      {order.status === "Accepted" && (
                        <button
                          onClick={() => updateOrderStatus(order.id, "Shipped")}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition"
                        >
                          <Truck className="w-4 h-4" /> Mark as Shipped
                        </button>
                      )}

                      {/* --- SECURITY FIX: Seller can no longer force a delivery confirmation --- */}
                      {order.status === "Shipped" && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">
                          <Truck className="w-4 h-4" /> In Transit (Awaiting Site Confirmation)
                        </div>
                      )}

                      {(order.status === "Received" || order.status === "Delivered") && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg border border-slate-200">
                          <CheckCircle className="w-4 h-4" /> Order Complete
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}