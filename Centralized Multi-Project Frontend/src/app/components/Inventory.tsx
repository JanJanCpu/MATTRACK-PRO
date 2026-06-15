import {
  PackageSearch,
  Plus,
  Trash2,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { inventoryAPI, sitesAPI } from "../../services/apiService";
import type { Inventory as InventoryItem, ProjectSite } from "../../types";

interface InventoryWithCategory extends InventoryItem {
  category: "Fast-Moving" | "Slow-Moving" | "Non-Moving";
  siteName: string;
}

export function Inventory() {
  const [filter, setFilter] = useState("All");
  const [inventoryData, setInventoryData] = useState<InventoryWithCategory[]>([]);
  const [sitesList, setSitesList] = useState<ProjectSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. UPDATED STATE: Added brand and fsn_status for the Audit Ledger
  const [newItem, setNewItem] = useState({
    item_name: "",
    brand: "Generic/No Brand", 
    quantity: 0,
    unit: "Bags",
    status: "Healthy",
    fsn_status: "FAST", 
    site_id: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [inventoryList, sites] = await Promise.all([
        inventoryAPI.list(),
        sitesAPI.list(),
      ]);

      setSitesList(sites);
      const siteMap = new Map(sites.map((s) => [s.id, s.site_name]));

      const categorized = inventoryList.map((item) => ({
        ...item,
        category:
          item.status === "Critical" || item.status === "Warning"
            ? "Fast-Moving"
            : item.status === "Healthy"
              ? "Slow-Moving"
              : "Non-Moving",
        siteName: siteMap.get(item.site_id) || `Site ${item.site_id}`,
      })) as InventoryWithCategory[];

      setInventoryData(categorized);
    } catch (err) {
      setError("Failed to load inventory data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 2. LOG THE TRANSACTION: Hitting the secure backend endpoint
      await inventoryAPI.logTransaction({
        item_name: newItem.item_name,
        brand: newItem.brand,
        quantity: Number(newItem.quantity),
        unit: newItem.unit,
        status: newItem.status,
        fsn_status: newItem.fsn_status,
        site_id: Number(newItem.site_id),
      });

      setShowAddForm(false);
      setNewItem({
        item_name: "",
        brand: "Generic/No Brand",
        quantity: 0,
        unit: "Bags",
        status: "Healthy",
        fsn_status: "FAST",
        site_id: "",
      });
      fetchData();
    } catch (err) {
      alert("Failed to add item to the ledger.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to remove this item from the ledger?")) return;
    try {
      await inventoryAPI.delete(id);
      fetchData(); 
    } catch (err) {
      alert("Failed to delete item.");
    }
  };

  const filteredData =
    filter === "All"
      ? inventoryData
      : inventoryData.filter((i) => i.category === filter || i.status === filter);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Inventory & Ledger
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage stock and track audit logs across {sitesList.length} project sites.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> {showAddForm ? "Cancel" : "Add Stock"}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm animate-in slide-in-from-top-4">
          {/* Expanded grid to 6 columns to fit the new Brand input */}
          <form
            onSubmit={handleAddInventory}
            className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end"
          >
            <div>
              <label className="block text-xs font-bold text-neutral-500 mb-1">
                Project Site
              </label>
              <select
                className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                value={newItem.site_id}
                onChange={(e) => setNewItem({ ...newItem, site_id: e.target.value })}
                required
              >
                <option value="">Select Site...</option>
                {sitesList.map((s) => (
                  <option key={s.id} value={s.id}>{s.site_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-500 mb-1">
                Material
              </label>
              <input
                type="text"
                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g. Portland Cement"
                value={newItem.item_name}
                onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                required
              />
            </div>

            {/* 3. NEW INPUT: Brand tracking for better audit logs */}
            <div>
              <label className="block text-xs font-bold text-neutral-500 mb-1">
                Brand/Spec
              </label>
              <input
                type="text"
                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g. Holcim"
                value={newItem.brand}
                onChange={(e) => setNewItem({ ...newItem, brand: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1">
                  Qty
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1">
                  Unit
                </label>
                <select
                  className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                >
                  <option value="Bags">Bags</option>
                  <option value="Kilos">Kilos</option>
                  <option value="Linear Ft">Linear Ft</option>
                  <option value="Pcs">Pcs</option>
                  <option value="Cu.m">Cu.m</option>
                  <option value="Rolls">Rolls</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-500 mb-1">
                Status
              </label>
              <select
                className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                value={newItem.status}
                onChange={(e) => setNewItem({ ...newItem, status: e.target.value })}
              >
                <option value="Healthy">Healthy (Available)</option>
                <option value="Warning">Warning (Low-Stock)</option>
                <option value="Critical">Critical (Out-of-Stock)</option>
                <option value="Surplus">Surplus (Available)</option>
                <option value="In Transit">In Transit</option>
              </select>
            </div>

            <button
              type="submit"
              className="bg-slate-900 text-white py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors w-full"
            >
              Log Stock
            </button>
          </form>
        </div>
      )}

      {/* Network Inventory Table */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <PackageSearch className="w-5 h-5 text-neutral-500" />
            <h2 className="font-semibold text-neutral-900">Network Inventory</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
              <tr>
                <th className="px-5 py-3 font-medium">Item & Brand</th>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3 font-medium text-right">Current Stock</th>
                <th className="px-5 py-3 font-medium text-center">FSN</th>
                <th className="px-5 py-3 font-medium text-center">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-5 py-4 text-neutral-900">
                      <div className="font-medium">{item.item_name}</div>
                      <div className="text-xs text-neutral-500">{item.brand}</div>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">{item.siteName}</td>
                    <td className="px-5 py-4 text-right font-medium">
                      {item.quantity} <span className="text-neutral-400 font-normal text-xs">{item.unit}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                        item.category === "Fast-Moving" ? "bg-blue-100 text-blue-700"
                        : item.category === "Slow-Moving" ? "bg-amber-100 text-amber-700"
                        : "bg-purple-100 text-purple-700"
                      }`}>
                        {item.category.charAt(0)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                        item.status === "Critical" ? "bg-red-100 text-red-700"
                        : item.status === "Warning" ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-neutral-500">
                    No inventory items found in the ledger.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}