import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Building2, MapPin, Search, Plus, Loader, HardHat, 
  Settings2, Archive, AlertTriangle, X, Pencil, Map as MapIcon, RefreshCw,
  ChevronDown, Activity, Trash2, ShieldAlert, CheckCircle2, Database, Info
} from "lucide-react";
import { createPortal } from "react-dom";

// --- Map Imports ---
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { geocodeAddress, sitesAPI } from "../../services/apiService"; 

const defaultIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapPinPicker({ position, setPosition }: { position: [number, number]; setPosition: (pos: [number, number]) => void; }) {
  useMapEvents({ click(e) { setPosition([e.latlng.lat, e.latlng.lng]); } });
  return <Marker position={position} icon={defaultIcon} />;
}

function MapUpdater({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.flyTo(position, 15, { animate: true, duration: 1.5 }); }, [position, map]);
  return null;
}

const PROJECT_STAGES = [
  "Pre Construction",
  "Mid Construction",
  "Finishing",
  "Post Construction"
];

export function Projects() {
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userRole, setUserRole] = useState("staff");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  
  const [viewMode, setViewMode] = useState<"active" | "archived">("active");
  
  // --- EDIT MODAL STATE (With Map Support) ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSite, setEditingSite] = useState<any>(null);
  const [isSearchingEdit, setIsSearchingEdit] = useState(false);
  
  // --- SMART DELETION GUARDRAIL STATE ---
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [targetSite, setTargetSite] = useState<any>(null);
  const [siteDependencies, setSiteDependencies] = useState<any>(null);
  const [checkingDependencies, setCheckingDependencies] = useState(false);
  const [deleteReason, setDeleteReason] = useState("Typographical Error / Misspelled Name");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);

  // --- SITE-SPECIFIC AUDIT LOG STATE ---
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [siteAuditLogs, setSiteAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSiteContext, setAuditSiteContext] = useState<any>(null);

  // --- ADD SITE FORM STATE ---
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSite, setNewSite] = useState({ name: "", address: "", manager_id: "", lat: 14.5995, lon: 120.9842 });
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const fetchSites = async () => {
    setLoading(true);
    try {
      const baseUrl = `http://${window.location.hostname}:8000`;
      const token = localStorage.getItem("token");
      
      const endpoint = viewMode === "active" ? "/sites/" : "/sites/archived";
      
      const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        setSites(await response.json());
      }
    } catch (error) {
      console.error("Failed to fetch sites:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const baseUrl = `http://${window.location.hostname}:8000`;
      const token = localStorage.getItem("token");
      const response = await fetch(`${baseUrl}/users/managers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setStaffList(await response.json());
      }
    } catch (err) {
      console.error("Failed to fetch staff list");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserRole(payload.role ? payload.role.toLowerCase() : "staff");
        setCurrentUserId(payload.id);
      } catch (e) {
        console.error("Token error");
      }
    }
    fetchSites();
    fetchStaff();
  }, [viewMode]); 

  const handleAddressSearch = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newSite.address.trim()) return;

    setIsSearching(true);
    const coords = await geocodeAddress(newSite.address);
    if (coords) {
      setNewSite(prev => ({ ...prev, lat: coords.lat, lon: coords.lon }));
    } else {
      alert("Address not found. Please add a city or drop the pin manually on the map.");
    }
    setIsSearching(false);
  };

  const handleAddressSearchEdit = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!editingSite.address?.trim()) return;

    setIsSearchingEdit(true);
    const coords = await geocodeAddress(editingSite.address);
    if (coords) {
      setEditingSite((prev: any) => ({ ...prev, latitude: coords.lat, longitude: coords.lon }));
    } else {
      alert("Address not found. Please add a city or drop the pin manually on the map.");
    }
    setIsSearchingEdit(false);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await sitesAPI.create({
        name: newSite.name,
        address: newSite.address,
        lat: newSite.lat,
        lon: newSite.lon,
        manager_id: newSite.manager_id ? parseInt(newSite.manager_id) : undefined
      });
      
      alert("New Project Site added successfully.");
      setShowAddForm(false);
      setNewSite({ name: "", address: "", manager_id: "", lat: 14.5995, lon: 120.9842 }); 
      fetchSites(); 
    } catch (err) {
      alert("An error occurred while adding the site.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- UPGRADED EDIT SUBMIT (Includes Latitude & Longitude) ---
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const baseUrl = `http://${window.location.hostname}:8000`;
      const token = localStorage.getItem("token");
      
      const response = await fetch(`${baseUrl}/sites/${editingSite.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editingSite.site_name,
          address: editingSite.address,
          manager_id: editingSite.manager_id ? parseInt(editingSite.manager_id) : undefined,
          latitude: editingSite.latitude,
          longitude: editingSite.longitude
        })
      });

      if (!response.ok) throw new Error("Failed to update site");
      
      alert("Site details & map coordinates updated successfully.");
      setShowEditModal(false);
      fetchSites();
    } catch (err) {
      alert("An error occurred while updating the site.");
    }
  };

  const handleStatusUpdate = async (siteId: number, newStatus: string) => {
    try {
      await sitesAPI.updateStatus(siteId, newStatus);
      fetchSites();
    } catch (err: any) {
      alert(err.message || "Failed to update project status.");
    }
  };

  // --- SMART DELETION / ARCHIVE GUARDRAIL HANDLER ---
  const handleOpenDeleteGuardrail = async (site: any) => {
    setTargetSite(site);
    setDeleteConfirmText("");
    setDeleteReason("Typographical Error / Misspelled Name");
    setSiteDependencies(null);
    setShowDeleteModal(true);
    setCheckingDependencies(true);

    try {
      const baseUrl = `http://${window.location.hostname}:8000`;
      const token = localStorage.getItem("token");
      const res = await fetch(`${baseUrl}/sites/${site.id}/dependencies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSiteDependencies(data);
      }
    } catch (e) {
      console.error("Failed to check site dependencies");
    } finally {
      setCheckingDependencies(false);
    }
  };

  const handleExecuteDeleteOrArchive = async () => {
    if (!targetSite || !siteDependencies) return;
    setIsProcessingDelete(true);

    try {
      const baseUrl = `http://${window.location.hostname}:8000`;
      const token = localStorage.getItem("token");
      
      const isHardDelete = siteDependencies.can_hard_delete;
      const queryParams = `?force_hard_delete=${isHardDelete}&reason=${encodeURIComponent(deleteReason)}`;

      const response = await fetch(`${baseUrl}/sites/${targetSite.id}${queryParams}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to process site action");
      }
      
      const resData = await response.json();
      alert(resData.message || "Action completed successfully.");
      setShowDeleteModal(false);
      fetchSites(); 
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessingDelete(false);
    }
  };

  const handleRestoreSite = async (siteId: number) => {
    try {
      const baseUrl = `http://${window.location.hostname}:8000`;
      const token = localStorage.getItem("token");
      
      const response = await fetch(`${baseUrl}/sites/${siteId}/restore`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Failed to restore site");
      
      alert("Project Site successfully restored to the Active Ledger.");
      fetchSites();
    } catch (err) {
      alert("Failed to restore the project site.");
    }
  };

  const handleViewAuditLogs = async (site: any) => {
    setAuditSiteContext(site);
    setShowAuditModal(true);
    setAuditLoading(true);
    try {
      const logs = await sitesAPI.getAuditLogs(site.id);
      setSiteAuditLogs(logs);
    } catch (e) {
      alert("Failed to load audit logs for this site.");
    } finally {
      setAuditLoading(false);
    }
  };

  const filteredSites = sites.filter(s => 
    s.site_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-slate-700" /> Project Site Ledger
          </h1>
          <p className="text-slate-500 mt-1">
            Manage and monitor all active PENTABUILD construction sites.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {["admin", "owner"].includes(userRole) && (
            <div className="flex bg-slate-200/70 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode("active")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${viewMode === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Active
              </button>
              <button 
                onClick={() => setViewMode("archived")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${viewMode === 'archived' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Archived
              </button>
            </div>
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search sites..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none w-48 md:w-64"
            />
          </div>

          {["admin", "owner"].includes(userRole) && (
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm"
            >
              {showAddForm ? "Cancel" : <><Plus className="w-4 h-4" /> Add New Site</>}
            </button>
          )}
        </div>
      </div>

      {/* --- ADD NEW SITE FORM --- */}
      {showAddForm && ["admin", "owner"].includes(userRole) && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-top-4">
          <form onSubmit={handleAddSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name</label>
              <input 
                type="text" required 
                placeholder="e.g. Paco Warehouse Extension"
                value={newSite.name} 
                onChange={e => setNewSite({...newSite, name: e.target.value})}
                className="w-full p-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign Site Manager</label>
              <select 
                value={newSite.manager_id} 
                onChange={e => setNewSite({...newSite, manager_id: e.target.value})}
                className="w-full p-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-emerald-600 outline-none font-medium text-slate-700"
              >
                <option value="">-- Unassigned / TBD --</option>
                {staffList.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.username} {staff.company_name ? `(${staff.company_name})` : ""}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location Address</label>
              <div className="flex gap-2">
                <input 
                  type="text" required 
                  placeholder="e.g. 123 Paco St, Manila"
                  value={newSite.address} 
                  onChange={e => setNewSite({...newSite, address: e.target.value})}
                  className="w-full p-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                />
                <button
                  onClick={handleAddressSearch}
                  disabled={isSearching}
                  className="px-4 bg-slate-900 text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-70 transition-colors shrink-0"
                >
                  {isSearching ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Locate
                </button>
              </div>
            </div>

            <div className="md:col-span-4 mb-2 mt-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-500 uppercase">
                  Location Preview (Drag or Click Map to Adjust)
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {newSite.lat.toFixed(4)}, {newSite.lon.toFixed(4)}
                </span>
              </div>
              <div className="h-[200px] w-full rounded-lg overflow-hidden border border-slate-200 relative z-0">
                <MapContainer center={[newSite.lat, newSite.lon]} zoom={13} className="w-full h-full">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapPinPicker position={[newSite.lat, newSite.lon]} setPosition={(pos) => setNewSite({...newSite, lat: pos[0], lon: pos[1]})} />
                  <MapUpdater position={[newSite.lat, newSite.lon]} />
                </MapContainer>
              </div>
            </div>

            <div className="md:col-span-4 flex justify-end gap-3 mt-2">
              <button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-slate-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed w-full shadow-sm">
                {isSubmitting ? "Processing..." : "Confirm Location & Create Site"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ledger Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b text-slate-500">
            <tr>
              <th className="px-6 py-4 font-bold">Project Details</th>
              <th className="px-6 py-4 font-bold">Location & Coordinates</th>
              <th className="px-6 py-4 font-bold">Project Phase</th>
              <th className="px-6 py-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={4} className="py-12 text-center text-slate-400"><Loader className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading ledger...</td></tr>
            ) : filteredSites.length === 0 ? (
              <tr><td colSpan={4} className="py-12 text-center text-slate-400 font-medium">{viewMode === "active" ? "No active project sites found." : "No archived project sites found."}</td></tr>
            ) : (
              filteredSites.map((site) => {
                const isManager = site.manager_id === currentUserId;
                const canEditStatus = viewMode === "active" && (isManager || ["admin", "owner"].includes(userRole));
                
                return (
                  <tr key={site.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${viewMode === "active" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"}`}>
                          <HardHat className="w-5 h-5" />
                        </div>
                        <div>
                          <div className={`font-bold text-base ${viewMode === "active" ? "text-slate-900" : "text-slate-500 line-through"}`}>{site.site_name}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">ID: SITE-{site.id} • PM: {staffList.find(s => s.id === site.manager_id)?.username || "Unassigned"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`font-medium flex items-start gap-1.5 mb-1 max-w-xs whitespace-normal leading-snug ${viewMode === "active" ? "text-slate-700" : "text-slate-400"}`}>
                        <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${viewMode === "active" ? "text-emerald-600" : "text-slate-400"}`} /> 
                        <span>{site.address || "Unspecified Location"}</span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mt-1.5">
                        <MapIcon className="w-3.5 h-3.5 shrink-0" /> {site.latitude?.toFixed(4)}, {site.longitude?.toFixed(4)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {canEditStatus ? (
                        <div className="relative inline-block w-44">
                          <select 
                            value={site.stage_status} 
                            onChange={(e) => handleStatusUpdate(site.id, e.target.value)}
                            className="appearance-none w-full bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none pr-8 cursor-pointer shadow-sm"
                          >
                            {PROJECT_STAGES.map(stage => (
                              <option key={stage} value={stage}>{stage}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      ) : (
                        <span className={`px-2.5 py-1 text-xs font-bold rounded border ${viewMode === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-300"}`}>
                          {site.stage_status || "Pre Construction"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {viewMode === "active" ? (
                          <>
                            <Link 
                              to={`/projects/${site.id}`}
                              className="px-4 py-1.5 bg-white border hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                            >
                              Manage Inventory <Settings2 className="w-3.5 h-3.5" />
                            </Link>
                            
                            {["admin", "owner"].includes(userRole) && (
                              <>
                                <button onClick={() => handleViewAuditLogs(site)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="View Site Audit Logs">
                                  <Activity className="w-4 h-4" />
                                </button>
                                <button onClick={() => { setEditingSite(site); setShowEditModal(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Details & Pin">
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleOpenDeleteGuardrail(site)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete or Archive Project">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <button onClick={() => handleRestoreSite(site.id)} className="px-4 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
                            <RefreshCw className="w-3.5 h-3.5" /> Restore Site
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* --- SITE AUDIT LOG MODAL --- */}
      {showAuditModal && auditSiteContext && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b bg-emerald-50 border-emerald-100 flex justify-between items-center text-emerald-900">
              <h2 className="text-lg font-bold flex items-center gap-2"><Activity className="w-5 h-5" /> Site Audit Logs: {auditSiteContext.site_name}</h2>
              <button onClick={() => setShowAuditModal(false)} className="p-1 hover:bg-emerald-200/50 rounded-md transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-0 overflow-y-auto flex-1 bg-neutral-50">
              {auditLoading ? (
                <div className="py-12 text-center text-slate-400"><Loader className="w-6 h-6 animate-spin mx-auto mb-2" /> Retrieving site history...</div>
              ) : siteAuditLogs.length > 0 ? (
                <div className="divide-y divide-neutral-200 bg-white">
                  {siteAuditLogs.map((log) => {
                    const isAlert = log.is_security_event || log.action.toUpperCase().includes("CANCELLED");
                    return (
                      <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-neutral-50 transition-colors">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${isAlert ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                          {isAlert ? <AlertTriangle className="w-4 h-4"/> : "SA"}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${isAlert ? 'text-red-900 font-bold' : 'text-slate-800'}`}>{log.action}</p>
                          <p className="text-xs text-slate-400 mt-1 font-mono">{log.timestamp}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-neutral-400 font-medium">No actions have been logged for this specific site yet.</div>
              )}
            </div>
          </div>
        </div>, document.body
      )}

      {/* --- UPGRADED EDIT MODAL (WITH INTERACTIVE MAP PIN) --- */}
      {showEditModal && editingSite && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-600" /> Edit Site Details & Map Pin
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name</label>
                <input type="text" required value={editingSite.site_name} onChange={e => setEditingSite({...editingSite, site_name: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50 font-medium" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assigned Manager</label>
                <select value={editingSite.manager_id || ""} onChange={e => setEditingSite({...editingSite, manager_id: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50 text-sm font-medium">
                  <option value="">-- Unassigned / TBD --</option>
                  {staffList.map(staff => (
                    <option key={staff.id} value={staff.id}>{staff.username}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location Address</label>
                <div className="flex gap-2">
                  <input type="text" required value={editingSite.address} onChange={e => setEditingSite({...editingSite, address: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50 font-medium text-sm" />
                  <button
                    onClick={handleAddressSearchEdit}
                    disabled={isSearchingEdit}
                    className="px-3 bg-slate-900 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 hover:bg-slate-800 disabled:opacity-70 transition-colors shrink-0 text-xs"
                  >
                    {isSearchingEdit ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    Locate
                  </button>
                </div>
              </div>

              {/* Interactive Map Inside Edit Modal */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase">
                    Adjust Coordinates (Drag or Click Map)
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {editingSite.latitude?.toFixed(4)}, {editingSite.longitude?.toFixed(4)}
                  </span>
                </div>
                <div className="h-[200px] w-full rounded-lg overflow-hidden border border-slate-200 relative z-0 shadow-inner">
                  <MapContainer center={[editingSite.latitude || 14.5995, editingSite.longitude || 120.9842]} zoom={14} className="w-full h-full">
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapPinPicker position={[editingSite.latitude || 14.5995, editingSite.longitude || 120.9842]} setPosition={(pos) => setEditingSite({...editingSite, latitude: pos[0], longitude: pos[1]})} />
                    <MapUpdater position={[editingSite.latitude || 14.5995, editingSite.longitude || 120.9842]} />
                  </MapContainer>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 font-bold text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-lg text-sm">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm text-sm">Save Changes</button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}

      {/* --- SMART DELETION GUARDRAIL MODAL --- */}
      {showDeleteModal && targetSite && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                <ShieldAlert className="w-5 h-5 text-red-600" /> Project Site Deletion Guardrail
              </h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="w-10 h-10 rounded-full bg-slate-200/80 flex items-center justify-center shrink-0 font-bold text-slate-700">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{targetSite.site_name}</h4>
                  <p className="text-xs text-slate-400 font-mono">SITE ID: SITE-{targetSite.id} • {targetSite.address}</p>
                </div>
              </div>

              {checkingDependencies ? (
                <div className="py-8 text-center text-slate-500">
                  <Loader className="w-7 h-7 animate-spin text-slate-700 mx-auto mb-3" />
                  <p className="text-sm font-medium">Scanning database relationships & audit trails...</p>
                </div>
              ) : siteDependencies ? (
                <>
                  {/* TIER 1: UNTOUCHED VIRGIN SITE (CAN HARD DELETE) */}
                  {siteDependencies.can_hard_delete ? (
                    <div className="space-y-4 animate-in fade-in">
                      <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-start gap-2.5 text-emerald-900">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="text-xs leading-relaxed">
                          <strong className="font-bold block mb-0.5">Untouched Virgin Site (0 Active Ledgers)</strong>
                          This site has no associated inventory items, material requests, or transfer records. You may permanently delete it from the SQL database without breaking foreign key constraints.
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Reason for Deletion</label>
                        <select
                          value={deleteReason}
                          onChange={(e) => setDeleteReason(e.target.value)}
                          className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-slate-900"
                        >
                          <option value="Typographical Error / Misspelled Name">Typographical Error / Misspelled Name</option>
                          <option value="Duplicate Project Entry">Duplicate Project Entry</option>
                          <option value="Created by Mistake / Test Data">Created by Mistake / Test Data</option>
                          <option value="Project Aborted Prior to Commencement">Project Aborted Prior to Commencement</option>
                        </select>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-600 mb-2">
                          To confirm permanent SQL deletion, please type <code className="font-mono bg-white border border-slate-300 px-1.5 py-0.5 rounded font-bold text-red-600">SITE-{targetSite.id}</code> below:
                        </p>
                        <input
                          type="text"
                          placeholder={`SITE-${targetSite.id}`}
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-red-600 outline-none"
                        />
                      </div>

                      <div className="pt-2 flex gap-3">
                        <button type="button" onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm">Cancel</button>
                        <button
                          type="button"
                          onClick={handleExecuteDeleteOrArchive}
                          disabled={deleteConfirmText !== `SITE-${targetSite.id}` || isProcessingDelete}
                          className="flex-1 py-2.5 font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-sm text-sm flex items-center justify-center gap-1.5 transition-all"
                        >
                          {isProcessingDelete ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          Permanent SQL Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* TIER 2: ACTIVE CONSTRUCTION SITE (MUST SOFT-DELETE / ARCHIVE) */
                    <div className="space-y-4 animate-in fade-in">
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2.5 text-amber-900">
                        <Database className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-xs leading-relaxed">
                          <strong className="font-bold block mb-0.5">Active Construction Site (Database Safeguard Engaged)</strong>
                          This site is tied to active business records: <span className="font-bold">{siteDependencies.inventory_count} inventory items</span>, <span className="font-bold">{siteDependencies.requests_count} requests</span>, and <span className="font-bold">{siteDependencies.transfers_count} transfer logs</span>. To prevent relational database corruption and comply with enterprise audit rules, physical deletion is locked.
                        </div>
                      </div>

                      <div className="bg-neutral-50 p-3.5 rounded-lg border border-neutral-200 text-xs text-neutral-600 flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <span>
                          Proceeding will execute a <strong>Soft-Delete (Archive)</strong>. The project will immediately disappear from the field managers' active ledger while preserving timestamped transaction histories.
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason for Archiving</label>
                        <select
                          value={deleteReason}
                          onChange={(e) => setDeleteReason(e.target.value)}
                          className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-slate-900"
                        >
                          <option value="Project Completed / Handed Over">Project Completed / Handed Over</option>
                          <option value="Project Temporarily Suspended">Project Temporarily Suspended</option>
                          <option value="Consolidated with Another Site">Consolidated with Another Site</option>
                        </select>
                      </div>

                      <div className="pt-2 flex gap-3">
                        <button type="button" onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm">Cancel</button>
                        <button
                          type="button"
                          onClick={handleExecuteDeleteOrArchive}
                          disabled={isProcessingDelete}
                          className="flex-1 py-2.5 font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-70 rounded-lg shadow-sm text-sm flex items-center justify-center gap-1.5 transition-all"
                        >
                          {isProcessingDelete ? <Loader className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                          Archive Site (Soft-Delete)
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-6 text-center text-red-500 font-medium">Failed to inspect database dependencies. Please try again.</div>
              )}

            </div>
          </div>
        </div>, document.body
      )}

    </div>
  );
}