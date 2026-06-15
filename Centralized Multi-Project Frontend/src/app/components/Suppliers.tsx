import React, { useState, useEffect } from "react";
import { Store, MapPin, Star, Plus, Phone } from "lucide-react";
import { suppliersAPI } from "../../services/apiService";
import type { Supplier } from "../../types";

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    lat: "",
    lon: "",
    rating: "5",
    material: "",
    price: "",
  });

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const data = await suppliersAPI.list();
      setSuppliers(data);
    } catch (err) {
      console.error("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await suppliersAPI.create({
        name: formData.name,
        contact: formData.contact,
        lat: parseFloat(formData.lat),
        lon: parseFloat(formData.lon),
        rating: parseInt(formData.rating),
        material: formData.material || undefined,
        price: formData.price || undefined,
      });

      setFormData({ name: "", contact: "", lat: "", lon: "", rating: "5", material: "", price: "" });
      setShowForm(false);
      loadSuppliers();
    } catch (err) {
      alert("Failed to save supplier data.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Crowdsourced Suppliers</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage unlisted local hardware stores and material catalogs.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm"
        >
          {showForm ? "Cancel" : <><Plus className="w-4 h-4" /> Add Supplier</>}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-top-4">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Store Name</label>
              <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none" placeholder="e.g. Kuya Boy Hardware" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Contact Details</label>
              <input required value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none" placeholder="e.g. 0917-123-4567" />
            </div>
            
            {/* Location & Rating */}
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Lat</label>
              <input required type="number" step="any" value={formData.lat} onChange={(e) => setFormData({ ...formData, lat: e.target.value })} className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none" placeholder="14.5" />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Lon</label>
              <input required type="number" step="any" value={formData.lon} onChange={(e) => setFormData({ ...formData, lon: e.target.value })} className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none" placeholder="121.0" />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Quality Rating (1-5)</label>
              <input required type="number" min="1" max="5" value={formData.rating} onChange={(e) => setFormData({ ...formData, rating: e.target.value })} className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none" />
            </div>

            {/* Optional initial material logging */}
            <div className="md:col-span-3 border-t border-slate-100 pt-4 mt-2">
              <p className="text-xs text-slate-500 mb-2 font-medium">Optional: Initial Material Log</p>
              <div className="grid grid-cols-2 gap-4">
                <input value={formData.material} onChange={(e) => setFormData({ ...formData, material: e.target.value })} className="w-full p-2 border rounded-lg text-sm" placeholder="Material (e.g. Portland Cement)" />
                <input value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="w-full p-2 border rounded-lg text-sm" placeholder="Price (e.g. ₱250.00)" />
              </div>
            </div>

            <button type="submit" className="md:col-span-4 bg-slate-900 text-white py-2.5 rounded-lg font-bold hover:bg-slate-800 mt-2">
              Save Supplier to Database
            </button>
          </form>
        </div>
      )}

      {/* Suppliers Table */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
            <tr>
              <th className="px-5 py-4 font-medium">Store & Contact</th>
              <th className="px-5 py-4 font-medium">Location</th>
              <th className="px-5 py-4 font-medium text-center">Quality Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {suppliers.length > 0 ? (
              suppliers.map((sup) => (
                <tr key={sup.id} className="hover:bg-neutral-50/50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><Store className="w-4 h-4" /></div>
                      <div>
                        <div className="font-bold text-neutral-900">{sup.name}</div>
                        <div className="text-xs text-neutral-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {sup.contact}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-neutral-600 font-mono text-xs">
                    <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" /> {sup.latitude}, {sup.longitude}</div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full font-bold text-xs">
                      {sup.quality_rating}.0 <Star className="w-3 h-3" fill="currentColor" />
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={3} className="p-12 text-center text-neutral-400">No crowdsourced suppliers found. Add one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}