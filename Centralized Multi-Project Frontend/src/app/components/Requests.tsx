import React, { useState, useEffect } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Building2,
  Sparkles,
  Loader,
  PackageOpen
} from "lucide-react";
import { requestsAPI, sitesAPI } from "../../services/apiService";
import type { MaterialRequest, ProjectSite } from "../../types";
import { useNavigate } from "react-router-dom";

export function Requests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [userRole, setUserRole] = useState("pm");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    item_name: "",
    brand: "Generic/No Brand",
    quantity_needed: "",
    unit: "Pcs",
    site_id: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqData, sitesData] = await Promise.all([
        requestsAPI.list(),
        sitesAPI.list()
      ]);
      setRequests(reqData);
      setSites(sitesData);
    } catch (error) {
      console.error("Failed to load requests", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserRole(payload.role ? payload.role.toLowerCase() : "pm");
        setCurrentUserId(payload.id);
      } catch (e) {}
    }
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.site_id || !formData.item_name || !formData.quantity_needed) return;

    setIsSubmitting(true);
    try {
      await requestsAPI.create({
        item_name: formData.item_name,
        brand: formData.brand,
        quantity_needed: Number(formData.quantity_needed),
        unit: formData.unit,
        site_id: Number(formData.site_id),
        status: "Pending"
      });
      
      alert("Material Request submitted to the Main Office.");
      setShowForm(false);
      setFormData({ item_name: "", brand: "Generic/No Brand", quantity_needed: "", unit: "Pcs", site_id: formData.site_id });
      fetchData();
    } catch (error) {
      alert("Failed to submit request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdate = async (reqId: number, newStatus: string) => {
    try {
      await requestsAPI.updateStatus(reqId, newStatus);
      fetchData();
    } catch (error) {
      alert("Failed to update status. Are you an Admin?");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider"><Clock className="w-3 h-3" /> Pending</span>;
      case "Processing":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase tracking-wider animate-pulse"><Truck className="w-3 h-3" /> Processing</span>;
      case "Fulfilled":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider"><CheckCircle className="w-3 h-3" /> Fulfilled</span>;
      case "Rejected":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold uppercase tracking-wider"><XCircle className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  // Only show sites the user is allowed to manage (for the request dropdown)
  const editableSites = sites.filter((s) => ["admin", "owner"].includes(userRole) || s.manager_id === currentUserId);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" /> Material Requests
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {["admin", "owner"].includes(userRole) 
              ? "Central consolidated queue for all project site material needs."
              : "Submit material requirements to the main office for fulfillment."}
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-sm"
        >
          {showForm ? "Cancel Request" : <><Plus className="w-4 h-4" /> New Request</>}
        </button>
      </div>

      {/* REQUEST FORM MODAL/DROPDOWN */}
      {showForm && (
        <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm animate-in slide-in-from-top-4">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Target Project Site</label>
              <select
                required
                value={formData.site_id}
                onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-neutral-50"
              >
                <option value="">Select your site...</option>
                {editableSites.map(site => (
                  <option key={site.id} value={site.id}>{site.site_name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Material Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Portland Cement"
                value={formData.item_name}
                onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-neutral-50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Brand/Specs</label>
              <input
                type="text"
                placeholder="e.g. Republic"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-neutral-50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Quantity</label>
              <input
                type="number"
                required
                min="1"
                placeholder="0"
                value={formData.quantity_needed}
                onChange={(e) => setFormData({ ...formData, quantity_needed: e.target.value })}
                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-neutral-50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Unit</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-neutral-50"
              >
                <option value="Bags">Bags</option>
                <option value="Pcs">Pcs</option>
                <option value="Cu.m">Cu.m</option>
                <option value="Kilos">Kilos</option>
                <option value="Unit">Unit</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader className="w-4 h-4 animate-spin" /> : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REQUESTS TABLE */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-neutral-50 border-b text-neutral-500">
            <tr>
              <th className="px-6 py-4 font-bold">Request ID</th>
              <th className="px-6 py-4 font-bold">Material Details</th>
              <th className="px-6 py-4 font-bold">Project Site</th>
              <th className="px-6 py-4 font-bold text-center">Status</th>
              <th className="px-6 py-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-neutral-400"><Loader className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading queue...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-neutral-400 font-medium"><PackageOpen className="w-10 h-10 mx-auto mb-2 opacity-20"/>No material requests found.</td></tr>
            ) : (
              requests.map((req) => {
                const site = sites.find(s => s.id === req.site_id);
                return (
                  <tr key={req.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-neutral-500">
                      REQ-{String(req.id).padStart(4, '0')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-neutral-900">{req.item_name}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {req.brand} • <span className="font-bold text-indigo-600">{req.quantity_needed} {req.unit}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-medium text-neutral-700">
                        <Building2 className="w-4 h-4 text-neutral-400" />
                        {site?.site_name || "Unknown Site"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(req.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {/* ADMIN CONTROLS */}
                      {["admin", "owner"].includes(userRole) ? (
                        <div className="flex items-center justify-end gap-2">
                          
                          {req.status === "Pending" && (
                            <button 
                              onClick={() => navigate("/advisory", { state: { autoPromptItem: req } })}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors text-xs font-bold inline-flex items-center gap-1.5 border border-indigo-200"
                              title="Ask AI Advisory for sourcing options"
                            >
                              <Sparkles className="w-3.5 h-3.5" /> Smart Source
                            </button>
                          )}

                          <select 
                            value={req.status}
                            onChange={(e) => handleStatusUpdate(req.id, e.target.value)}
                            className="bg-white border border-neutral-300 text-neutral-700 text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Processing">Processing</option>
                            <option value="Fulfilled">Fulfilled</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        </div>
                      ) : (
                        // PM VIEW
                        <span className="text-xs text-neutral-400 font-medium">Read Only</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}