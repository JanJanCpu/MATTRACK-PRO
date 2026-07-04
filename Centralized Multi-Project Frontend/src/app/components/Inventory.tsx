import {
  PackageSearch,
  Plus,
  Trash2,
  Upload,
  Download,
  Sparkles,
  AlertTriangle,
  Activity,
  ListChecks,
  X,
  History,
  Filter,
  Lock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
  Truck, // <--- Add this
  CheckCircle, // <--- Add this
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  inventoryAPI,
  sitesAPI,
  suppliersAPI,
  transferAPI,
  requestsAPI,
} from "../../services/apiService";
import type {
  Inventory as InventoryItem,
  ProjectSite,
  Supplier,
} from "../../types";
import { BulkImportWizard } from "./BulkImportWizard";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Navigation, MapPin, Clock } from "lucide-react"; // Add these to your lucide-react imports
import { createPortal } from "react-dom";

// --- LEAFLET ICON SETUP ---
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const createIcon = (color: string) =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

const sourceIcon = createIcon("violet");
const destIcon = createIcon("blue");

// --- HELPER COMPONENT TO AUTO-ZOOM MAP TO ROUTE ---
function RouteFitter({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [50, 50] });
    }
  }, [coords, map]);
  return null;
}

interface InventoryWithCategory extends InventoryItem {
  category: "Fast-Moving" | "Slow-Moving" | "Non-Moving";
  siteName: string;
}

export function Inventory() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUserRole, setCurrentUserRole] = useState("staff");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<
    "inventory" | "audit" | "incoming" | "procurement" // Added "procurement" here
  >("inventory");
  const [incomingTransfers, setIncomingTransfers] = useState<any[]>([]);

  const [statusFilter, setStatusFilter] = useState("All");
  const [siteFilter, setSiteFilter] = useState<number | null>(null);
  const [pivotSiteName, setPivotSiteName] = useState("");

  const [inventoryData, setInventoryData] = useState<InventoryWithCategory[]>(
    [],
  );
  const [sitesList, setSitesList] = useState<ProjectSite[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);

  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkWizard, setShowBulkWizard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [pendingPOs, setPendingPOs] = useState<any[]>([]);

  // Transaction Modal State
  const [modalType, setModalType] = useState<"IN" | "OUT" | "TRANSFER" | null>(
    null,
  );
  const [activeTransactionItem, setActiveTransactionItem] =
    useState<InventoryWithCategory | null>(null);
  const [transactionForm, setTransactionForm] = useState({
    quantity: 0,
    destination_site_id: "",
    supplier_id: "",
    batch_rating: 0,
  });

  // --- ⚡ PASTE STEP 2 HERE ⚡ ---
  const [transferRouteCoords, setTransferRouteCoords] = useState<
    [number, number][]
  >([]);
  const [routeDetails, setRouteDetails] = useState({ distance: "0", eta: "0" });

  useEffect(() => {
    if (
      modalType === "TRANSFER" &&
      transactionForm.destination_site_id &&
      activeTransactionItem
    ) {
      const sourceSite = sitesList.find(
        (s) => s.id === activeTransactionItem.site_id,
      );
      const destSite = sitesList.find(
        (s) => s.id === Number(transactionForm.destination_site_id),
      );

      if (sourceSite && destSite) {
        const fetchRoute = async () => {
          try {
            const url = `https://router.project-osrm.org/route/v1/driving/${sourceSite.longitude},${sourceSite.latitude};${destSite.longitude},${destSite.latitude}?overview=full&geometries=geojson`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.routes && data.routes.length > 0) {
              const coords = data.routes[0].geometry.coordinates.map(
                (c: number[]) => [c[1], c[0]],
              );
              setTransferRouteCoords(coords);

              // Extract distance (meters to km) and duration (seconds to minutes)
              const distKm = (data.routes[0].distance / 1000).toFixed(1);
              const durationMins = Math.max(
                10,
                Math.round(data.routes[0].duration / 60),
              ).toString(); // Minimum 10 mins padding

              setRouteDetails({ distance: distKm, eta: durationMins });
            }
          } catch (error) {
            console.error("OSRM Routing failed", error);
            // Fallback to straight line
            setTransferRouteCoords([
              [sourceSite.latitude, sourceSite.longitude],
              [destSite.latitude, destSite.longitude],
            ]);
          }
        };
        fetchRoute();
      }
    } else {
      setTransferRouteCoords([]);
      setRouteDetails({ distance: "0", eta: "0" });
    }
  }, [
    modalType,
    transactionForm.destination_site_id,
    activeTransactionItem,
    sitesList,
  ]);
  // ------------------------------

  // --- Smart Restock Modal State ---
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockItem, setRestockItem] = useState<InventoryWithCategory | null>(
    null,
  );
  const [restockOptions, setRestockOptions] = useState<any[]>([]);
  const [isRestockLoading, setIsRestockLoading] = useState(false);

  const [itemType, setItemType] = useState<"consumable" | "asset">(
    "consumable",
  );
  const [newItem, setNewItem] = useState({
    item_name: "",
    brand: "Generic/No Brand",
    quantity: 0,
    unit: "Bags",
    status: "Healthy",
    fsn_status: "FAST",
    site_id: "",
  });

  // --- NEW: THE ROUTING LISTENER ---
  // This catches clicks from the Dashboard and auto-filters the table!

  const handleSmartRestock = async (item: InventoryWithCategory) => {
    setRestockItem(item);
    setShowRestockModal(true);
    setIsRestockLoading(true);

    try {
      // We assume a standard batch size of 50 units to run the cost analysis
      const defaultRestockQty = 50;
      const response = await fetch(
        `http://localhost:8000/advisory/auto-restock/${item.site_id}/${encodeURIComponent(item.item_name)}/${defaultRestockQty}`,
      );

      if (response.ok) {
        const data = await response.json();
        setRestockOptions(data);
      }
    } catch (error) {
      console.error("Failed to fetch AI restock options", error);
    } finally {
      setIsRestockLoading(false);
    }
  };

  const handleExecuteRestock = async (option: any) => {
    if (!restockItem) return;

    const token = localStorage.getItem("token");
    const quantityNeeded = 50; // The standard batch size we calculated for

    try {
      if (option.type === "EXTERNAL_PURCHASE") {
        // Hit our brand new Purchase Order endpoint
        await fetch("http://localhost:8000/inventory/purchase-orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            supplier_id: option.source_id,
            site_id: restockItem.site_id,
            material_name: restockItem.item_name,
            quantity: quantityNeeded,
            total_price: option.estimated_total_cost,
          }),
        });
        alert(`Purchase Order automatically sent to ${option.source_name}!`);
      } else if (option.type === "INTERNAL_TRANSFER") {
        // Recycle the existing transfer API you already built!
        await transferAPI.initiate({
          source_site_id: option.source_id,
          destination_site_id: restockItem.site_id,
          item_name: restockItem.item_name,
          brand: restockItem.brand,
          quantity: quantityNeeded,
          unit: restockItem.unit,
        });
        alert(
          `Logistics network alerted. Transfer from ${option.source_name} is now IN TRANSIT.`,
        );
      }

      // Close modal and refresh the background data
      setShowRestockModal(false);
      fetchData();
      window.dispatchEvent(new Event("inventoryUpdated"));
    } catch (error) {
      alert("System Error: Failed to execute automated restock.");
      console.error(error);
    }
  };

  useEffect(() => {
    if (location.state?.autoFilter) {
      setStatusFilter(location.state.autoFilter);
    }
    if (location.state?.autoPivotSiteId) {
      setSiteFilter(location.state.autoPivotSiteId);
      setPivotSiteName(location.state.siteName || "");
      setNewItem((prev) => ({
        ...prev,
        site_id: location.state.autoPivotSiteId,
      }));
    }

    // Clear the router state so it doesn't get stuck if the user refreshes
    if (location.state) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setCurrentUserRole(payload.role ? payload.role.toLowerCase() : "staff");
        setCurrentUserId(payload.id);
      } catch (e) {
        console.error("Token parse error");
      }
    }
  }, []);

  useEffect(() => {
    if (itemType === "consumable") {
      setNewItem((prev) => ({ ...prev, unit: "Bags", status: "Healthy" }));
    } else {
      setNewItem((prev) => ({ ...prev, unit: "Unit", status: "Available" }));
    }
  }, [itemType]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Add the requestsAPI call to the Promise.all
      const [inventoryList, sites, logs, suppliers, pos] = await Promise.all([
        inventoryAPI.list(),
        sitesAPI.list(),
        inventoryAPI.getLogs(),
        suppliersAPI.list(),
        requestsAPI.list(), // ⚡ FETCH THE POs
      ]);

      setSitesList(sites);
      setAuditLogs(logs);
      setSuppliersList(suppliers);
      setPendingPOs(pos); // ⚡ UPDATE STATE

      const siteMap = new Map(sites.map((s) => [s.id, s.site_name]));

      const categorized = inventoryList.map((item) => ({
        ...item,
        category:
          item.status === "Critical" || item.status === "Low Stock"
            ? "Fast-Moving"
            : item.status === "Healthy" || item.status === "Available"
              ? "Slow-Moving"
              : "Non-Moving",
        siteName: siteMap.get(item.site_id) || `Site ${item.site_id}`,
      })) as InventoryWithCategory[];

      setInventoryData(categorized);
      setSelectedIds([]);
      setIsDeleteMode(false);
    } catch (err) {
      setError("Failed to load inventory data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- ⚡ PASTE STEP 3 HERE ⚡ ---
  const loadIncomingTransfers = async () => {
    try {
      const managedSites = sitesList.filter(
        (s) => currentUserRole !== "staff" || s.manager_id === currentUserId,
      );

      let allPending: any[] = [];
      for (const site of managedSites) {
        const transfers = await transferAPI.getIncoming(site.id);
        allPending = [...allPending, ...transfers];
      }
      setIncomingTransfers(allPending);
    } catch (err) {
      console.error("Failed to load incoming transfers", err);
    }
  };

  useEffect(() => {
    if (activeTab === "incoming") {
      loadIncomingTransfers();
    }
  }, [activeTab, sitesList]);

  const handleAcceptTransfer = async (transferId: number) => {
    if (
      !window.confirm(
        "SECURITY VERIFICATION: Confirm receipt of these materials? They will be permanently added to your site's ledger.",
      )
    )
      return;

    try {
      await transferAPI.receive(transferId);
      alert("✅ Materials successfully received and added to inventory!");
      loadIncomingTransfers();
      fetchData();
      window.dispatchEvent(new Event("inventoryUpdated"));
    } catch (err) {
      alert("Failed to receive transfer.");
    }
  };
  // ------------------------------

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
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
        site_id: siteFilter ? String(siteFilter) : "",
      });
      fetchData();

      window.dispatchEvent(new Event("inventoryUpdated"));
    } catch (err) {
      alert("Failed to add item to the ledger.");
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTransactionItem || !modalType) return;
    if (transactionForm.quantity <= 0)
      return alert("Quantity must be greater than 0");

    if (
      modalType === "IN" &&
      transactionForm.supplier_id &&
      transactionForm.batch_rating === 0
    ) {
      return alert("Please provide a star rating for this delivery batch.");
    }

    if (modalType === "TRANSFER") {
      if (!transactionForm.destination_site_id)
        return alert("Select a destination site.");
      if (activeTransactionItem.quantity < transactionForm.quantity) {
        return alert("Not enough stock to transfer.");
      }

      try {
        await transferAPI.initiate({
          source_site_id: activeTransactionItem.site_id,
          destination_site_id: Number(transactionForm.destination_site_id),
          item_name: activeTransactionItem.item_name,
          brand: activeTransactionItem.brand,
          quantity: transactionForm.quantity,
          unit: activeTransactionItem.unit,
        });
        setModalType(null);
        fetchData();
        window.dispatchEvent(new Event("inventoryUpdated"));
        alert("Transfer dispatched successfully! It is now IN TRANSIT.");
      } catch (err) {
        alert("Failed to initiate transfer.");
      }
      return;
    }

    let finalQuantity = transactionForm.quantity;
    let finalStatus = "Healthy";
    const isAsset =
      activeTransactionItem.unit === "Unit" ||
      activeTransactionItem.unit === "Set";

    if (modalType === "OUT") {
      if (activeTransactionItem.quantity < transactionForm.quantity)
        return alert(
          `Not enough stock! You only have ${activeTransactionItem.quantity} ${activeTransactionItem.unit}.`,
        );

      finalQuantity = -Math.abs(transactionForm.quantity);
      const stockAfterDeduction =
        activeTransactionItem.quantity - transactionForm.quantity;

      if (isAsset) {
        finalStatus = stockAfterDeduction === 0 ? "In Use" : "Available";
      } else {
        if (stockAfterDeduction === 0) finalStatus = "Critical";
        else if (stockAfterDeduction <= 10) finalStatus = "Low Stock";
        else finalStatus = "Healthy";
      }
    } else {
      finalStatus = isAsset ? "Available" : "Healthy";
    }

    try {
      await inventoryAPI.logTransaction({
        item_name: activeTransactionItem.item_name,
        brand: activeTransactionItem.brand,
        quantity: finalQuantity,
        unit: activeTransactionItem.unit,
        status: finalStatus,
        fsn_status: "FAST",
        site_id: activeTransactionItem.site_id,
        supplier_id: transactionForm.supplier_id
          ? Number(transactionForm.supplier_id)
          : undefined,
        batch_rating:
          transactionForm.batch_rating > 0
            ? transactionForm.batch_rating
            : undefined,
      });

      setModalType(null);
      fetchData();
      window.dispatchEvent(new Event("inventoryUpdated"));
    } catch (err) {
      alert("Transaction failed. Check connection.");
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !window.confirm(
        "Are you sure you want to remove this item from the ledger? This cannot be undone.",
      )
    )
      return;
    try {
      await inventoryAPI.delete(id);
      fetchData();
      window.dispatchEvent(new Event("inventoryUpdated"));
    } catch (err) {
      alert("Failed to delete item. You may not have clearance for this site.");
    }
  };

  const handleBulkDelete = async () => {
    if (
      !window.confirm(
        `SECURITY WARNING:\n\nYou are about to permanently delete ${selectedIds.length} items from the ledger.\n\nThis action cannot be undone. Are you absolutely sure?`,
      )
    )
      return;
    try {
      await Promise.all(selectedIds.map((id) => inventoryAPI.delete(id)));
      fetchData();
      window.dispatchEvent(new Event("inventoryUpdated"));
    } catch (err) {
      alert(
        "An error occurred while deleting some items. You may not have clearance for all selected sites.",
      );
      fetchData();
    }
  };

  const exportToCSV = () => {
    if (inventoryData.length === 0) return alert("No data to export.");
    const headers = [
      "Item Name",
      "Brand",
      "Location",
      "Quantity",
      "Unit",
      "Category",
      "Status",
    ];
    const rows = sortedData.map(
      (item) =>
        `"${item.item_name}","${item.brand}","${item.siteName}",${item.quantity},"${item.unit}","${item.category}","${item.status}"`,
    );
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `MatTrack_Inventory_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  // --- THE MASTER INVENTORY SMART SORT ALGORITHM ---
  let processedData = inventoryData;
  if (siteFilter) {
    processedData = processedData.filter((i) => i.site_id === siteFilter);
  }
  if (statusFilter !== "All") {
    processedData = processedData.filter((i) => i.status === statusFilter);
  }

  // Weight logic guarantees Critical and Low Stock automatically bubble to the top of the ledger.
  const getStatusWeight = (status: string) => {
    switch (status) {
      case "Critical":
      case "Maintenance":
        return 1;
      case "Low Stock":
        return 2;
      case "Healthy":
      case "Available":
        return 3;
      case "In Use":
        return 4;
      case "Surplus":
        return 5;
      default:
        return 99;
    }
  };

  const sortedData = [...processedData].sort(
    (a, b) => getStatusWeight(a.status) - getStatusWeight(b.status),
  );

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const editableIds = sortedData
        .filter((item: InventoryWithCategory) => {
          // ⚡ Add type here
          const site = sitesList.find(
            (s: ProjectSite) => s.id === item.site_id,
          ); // ⚡ Add type here
          return (
            currentUserRole !== "staff" ||
            (site && site.manager_id === currentUserId)
          );
        })
        .map((item: InventoryWithCategory) => item.id); // ⚡ Add type here
      setSelectedIds(editableIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectItem = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((itemId) => itemId !== id)
        : [...prev, id],
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Critical":
      case "Maintenance":
        return "bg-red-100 text-red-700 border-red-200";
      case "Low Stock":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "Healthy":
      case "Available":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "Surplus":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "In Use":
        return "bg-indigo-100 text-indigo-700 border-indigo-200";
      default:
        return "bg-neutral-100 text-neutral-700 border-neutral-200";
    }
  };

  const editableSites = sitesList.filter(
    (s) => currentUserRole !== "staff" || s.manager_id === currentUserId,
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Global Inventory Ledger
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Global visibility enabled. You can only modify data for sites you
            manage.
          </p>

          <div className="flex bg-neutral-100 p-1 rounded-lg w-fit mt-4">
            <button
              onClick={() => setActiveTab("inventory")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === "inventory" ? "bg-white text-emerald-700 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
            >
              <PackageSearch className="w-4 h-4" /> Network Inventory
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === "audit" ? "bg-white text-emerald-700 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
            >
              <History className="w-4 h-4" /> System Audit Logs
            </button>

            {/* --- ⚡ PASTE STEP 4 HERE ⚡ --- */}
            <button
              onClick={() => setActiveTab("incoming")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === "incoming" ? "bg-white text-blue-700 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
            >
              <Truck className="w-4 h-4" /> Incoming Transfers
              {incomingTransfers.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                  {incomingTransfers.length}
                </span>
              )}
            </button>
            {/* ------------------------------ */}
            <button
              onClick={() => setActiveTab("procurement")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                activeTab === "procurement"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <PackageSearch className="w-4 h-4" /> Procurement Queue
            </button>
          </div>
        </div>

        {activeTab === "inventory" && (
          <div className="flex flex-wrap gap-2">
            {isDeleteMode ? (
              <>
                <button
                  onClick={() => {
                    setIsDeleteMode(false);
                    setSelectedIds([]);
                  }}
                  className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                >
                  <X className="w-4 h-4" /> Cancel Selection
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedIds.length === 0}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Trash2 className="w-4 h-4" /> Delete Selected (
                  {selectedIds.length})
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setIsDeleteMode(true);
                    setShowAddForm(false);
                    setShowBulkWizard(false);
                  }}
                  className="px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                >
                  <ListChecks className="w-4 h-4" /> Select Items
                </button>
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" /> Export
                </button>
                <button
                  onClick={() => {
                    setShowBulkWizard(!showBulkWizard);
                    if (!showBulkWizard) setShowAddForm(false);
                  }}
                  className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4" />{" "}
                  {showBulkWizard ? "Cancel Bulk Import" : "Bulk Import"}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(!showAddForm);
                    if (!showAddForm) setShowBulkWizard(false);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />{" "}
                  {showAddForm ? "Cancel" : "Add Stock"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {activeTab === "inventory" && (
        <>
          {/* THE PARAMETRIC PIVOT BANNER */}
          {siteFilter && (
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2 text-indigo-800 font-medium text-sm">
                <Filter className="w-4 h-4" /> Filtered to Project Site:{" "}
                <strong className="font-black">
                  {pivotSiteName || `SITE-${siteFilter}`}
                </strong>
              </div>
              <button
                onClick={() => {
                  setSiteFilter(null);
                  navigate(".", { replace: true, state: {} }); // Clear state
                }}
                className="px-3 py-1 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-100 rounded text-xs font-bold transition-colors"
              >
                Clear Filter (View Global)
              </button>
            </div>
          )}

          {showBulkWizard && (
            <BulkImportWizard
              sitesList={editableSites}
              suppliersList={suppliersList}
              onComplete={() => {
                setShowBulkWizard(false);
                fetchData();
                window.dispatchEvent(new Event("inventoryUpdated"));
              }}
              onCancel={() => setShowBulkWizard(false)}
            />
          )}

          {showAddForm && (
            <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm animate-in slide-in-from-top-4">
              <div className="flex gap-4 mb-4 pb-4 border-b border-neutral-100">
                <button
                  onClick={() => setItemType("consumable")}
                  className={`px-4 py-2 rounded-lg font-bold text-sm border-2 ${itemType === "consumable" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-transparent text-neutral-500 hover:bg-neutral-50"}`}
                >
                  Materials & Consumables
                </button>
                <button
                  onClick={() => setItemType("asset")}
                  className={`px-4 py-2 rounded-lg font-bold text-sm border-2 ${itemType === "asset" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-transparent text-neutral-500 hover:bg-neutral-50"}`}
                >
                  Tools & Assets
                </button>
              </div>

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
                    onChange={(e) =>
                      setNewItem({ ...newItem, site_id: e.target.value })
                    }
                    required
                  >
                    <option value="">Select Managed Site...</option>
                    {editableSites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.site_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">
                    {itemType === "consumable" ? "Material Name" : "Tool Name"}
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder={
                      itemType === "consumable"
                        ? "e.g. Portland Cement"
                        : "e.g. Angle Grinder"
                    }
                    value={newItem.item_name}
                    onChange={(e) =>
                      setNewItem({ ...newItem, item_name: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">
                    Brand/Spec
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder={
                      itemType === "consumable"
                        ? "e.g. Republic"
                        : "e.g. Bosch 800W"
                    }
                    value={newItem.brand}
                    onChange={(e) =>
                      setNewItem({ ...newItem, brand: e.target.value })
                    }
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
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          quantity: Number(e.target.value),
                        })
                      }
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
                      onChange={(e) =>
                        setNewItem({ ...newItem, unit: e.target.value })
                      }
                    >
                      {itemType === "consumable" ? (
                        <>
                          <option value="Bags">Bags</option>
                          <option value="Pcs">Pcs</option>
                          <option value="Kilos">Kilos</option>
                          <option value="Linear Ft">Linear Ft</option>
                          <option value="Cu.m">Cu.m</option>
                        </>
                      ) : (
                        <>
                          <option value="Unit">Unit</option>
                          <option value="Set">Set</option>
                        </>
                      )}
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
                    onChange={(e) =>
                      setNewItem({ ...newItem, status: e.target.value })
                    }
                  >
                    {itemType === "consumable" ? (
                      <>
                        <option value="Healthy">Healthy</option>
                        <option value="Low Stock">Low Stock</option>
                        <option value="Critical">Critical</option>
                        <option value="Surplus">Surplus</option>
                      </>
                    ) : (
                      <>
                        <option value="Available">Available</option>
                        <option value="In Use">In Use</option>
                        <option value="Maintenance">Maintenance</option>
                      </>
                    )}
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

          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            <div className="flex items-center gap-2 px-3 py-1 bg-neutral-200/50 rounded-full text-xs font-bold text-neutral-500 mr-2">
              <Filter className="w-3 h-3" /> Filters
            </div>
            {[
              "All",
              "Critical",
              "Low Stock",
              "Healthy",
              "Surplus",
              "Available",
              "In Use",
            ].map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${statusFilter === f ? "bg-slate-800 text-white shadow-md" : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
                  <tr>
                    {isDeleteMode && (
                      <th className="px-5 py-3 font-medium w-12 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-red-600 cursor-pointer"
                          onChange={handleSelectAll}
                          checked={
                            sortedData.length > 0 &&
                            selectedIds.length ===
                              sortedData.filter(
                                (i) =>
                                  currentUserRole !== "staff" ||
                                  sitesList.find((s) => s.id === i.site_id)
                                    ?.manager_id === currentUserId,
                              ).length
                          }
                        />
                      </th>
                    )}
                    <th className="px-5 py-3 font-medium">Item & Brand</th>
                    <th className="px-5 py-3 font-medium">Location</th>
                    <th className="px-5 py-3 font-medium text-right">
                      Current Stock
                    </th>
                    <th className="px-5 py-3 font-medium text-center">FSN</th>
                    <th className="px-5 py-3 font-medium text-center">
                      Status
                    </th>
                    <th className="px-5 py-3 font-medium text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {sortedData.length > 0 ? (
                    sortedData.map((item) => {
                      const itemSite = sitesList.find(
                        (s) => s.id === item.site_id,
                      );
                      const canEdit =
                        currentUserRole !== "staff" ||
                        (itemSite && itemSite.manager_id === currentUserId);

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-neutral-50/50 transition-colors ${selectedIds.includes(item.id) ? "bg-red-50/30" : ""} ${!canEdit && isDeleteMode ? "opacity-50 bg-neutral-50" : ""}`}
                        >
                          {isDeleteMode && (
                            <td className="px-5 py-4 text-center">
                              {canEdit ? (
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-gray-300 text-red-600 cursor-pointer"
                                  checked={selectedIds.includes(item.id)}
                                  onChange={() => handleSelectItem(item.id)}
                                />
                              ) : (
                                <Lock className="w-4 h-4 text-neutral-300 mx-auto" />
                              )}
                            </td>
                          )}
                          <td className="px-5 py-4 text-neutral-900">
                            <div className="font-bold text-sm">
                              {item.item_name}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {item.brand}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-neutral-600">
                            {item.siteName}
                          </td>
                          <td className="px-5 py-4 text-right font-medium">
                            <div className="flex items-center justify-end gap-2">
                              {(item.status === "Critical" ||
                                item.status === "Low Stock") && (
                                <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                              )}
                              <span className="text-base">
                                {item.quantity}{" "}
                                <span className="text-neutral-400 font-normal text-xs">
                                  {item.unit}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className="text-[10px] font-black text-neutral-400 bg-neutral-100 px-2 py-1 rounded">
                              {item.fsn_status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span
                              className={`inline-flex px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${getStatusColor(item.status)}`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() =>
                                  navigate("/advisory", {
                                    state: { autoPromptItem: item },
                                  })
                                }
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                                title="Ask AI to source this item"
                                disabled={isDeleteMode}
                              >
                                <Sparkles className="w-4 h-4" />
                              </button>

                              {/* --- ⚡ DROP THE NEW BUTTON EXACTLY HERE --- */}
                              {(item.status === "Critical" ||
                                item.status === "Low Stock") && (
                                <button
                                  onClick={() => handleSmartRestock(item)}
                                  className="p-2 ml-1 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold border border-amber-200"
                                  title="Smart Restock (AI Ops)"
                                  disabled={isDeleteMode}
                                >
                                  ⚡ Restock
                                </button>
                              )}
                              {/* ------------------------------------------- */}

                              {canEdit ? (
                                <>
                                  <button
                                    onClick={() => {
                                      setActiveTransactionItem(item);
                                      setModalType("IN");
                                    }}
                                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    title="Log Delivery (In)"
                                  >
                                    <ArrowDownToLine className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveTransactionItem(item);
                                      setModalType("OUT");
                                    }}
                                    className="p-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Log Usage (Out)"
                                  >
                                    <ArrowUpFromLine className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveTransactionItem(item);
                                      setModalType("TRANSFER");
                                    }}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Transfer to Site"
                                  >
                                    <Send className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  disabled
                                  className="p-2 text-neutral-300 rounded-lg cursor-not-allowed"
                                  title="Read Only (Managed by another site)"
                                >
                                  <Lock className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={isDeleteMode ? 8 : 7}
                        className="px-5 py-12 text-center text-neutral-500 bg-neutral-50/50"
                      >
                        No inventory matches your current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* --- ⚡ PASTE STEP 5 HERE ⚡ --- */}
      {activeTab === "incoming" && (
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="px-6 py-5 border-b border-neutral-200 bg-blue-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-blue-900">
                Pending Deliveries to Your Managed Sites
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
                <tr>
                  <th className="px-5 py-3 font-medium">Tracking ID</th>
                  <th className="px-5 py-3 font-medium">Material</th>
                  <th className="px-5 py-3 font-medium">Destination</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {incomingTransfers.length > 0 ? (
                  incomingTransfers.map((transfer) => {
                    const destSite = sitesList.find(
                      (s) => s.id === transfer.destination_site_id,
                    );
                    return (
                      <tr
                        key={transfer.id}
                        className="hover:bg-neutral-50/50 transition-colors"
                      >
                        <td className="px-5 py-4 text-neutral-500 font-mono text-xs">
                          TRK-{transfer.id.toString().padStart(4, "0")}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-neutral-900">
                            {transfer.item_name}
                          </div>
                          <div className="text-xs text-neutral-500">
                            Qty: {transfer.quantity} {transfer.unit}
                          </div>
                        </td>
                        <td className="px-5 py-4 font-medium text-blue-700">
                          {destSite
                            ? destSite.site_name
                            : `Site ${transfer.destination_site_id}`}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                            <Truck className="w-3 h-3" /> In Transit
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleAcceptTransfer(transfer.id)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                          >
                            <CheckCircle className="w-4 h-4" /> Accept Delivery
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center">
                      <Truck className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-neutral-900">
                        No Pending Deliveries
                      </h3>
                      <p className="text-sm text-neutral-500 mt-1">
                        Your logistics queue is currently empty.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* ------------------------------ */}

      {/* Audit Tab Logic Remains Identical */}
      {activeTab === "audit" && (
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="px-6 py-5 border-b border-neutral-200 bg-slate-900 flex items-center gap-3">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="font-semibold text-white">System Audit Trail</h2>
          </div>
          <div className="p-0">
            {auditLogs.length > 0 ? (
              <div className="divide-y divide-neutral-100">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 p-5 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200 shrink-0 text-emerald-700 font-bold">
                      SA
                    </div>
                    <div>
                      <p className="text-neutral-900 font-medium text-sm leading-relaxed">
                        {log.action}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1 font-mono">
                        {log.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <History className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-neutral-900">
                  No Activity Recorded
                </h3>
                <p className="text-sm text-neutral-500 mt-1">
                  Actions performed on the database will appear here
                  chronologically.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <tbody>
        {pendingPOs.filter((po: any) => po.status !== "Received").length > 0 ? ( // ⚡ FILTER HERE
          pendingPOs
            .filter((po: any) => po.status !== "Received") // ⚡ FILTER HERE AGAIN FOR MAP
            .map((po: any) => (
              <tr
                key={po.id}
                className="border-b last:border-0 hover:bg-neutral-50"
              >
                <td className="px-6 py-4 font-bold text-neutral-900">
                  {po.item_name}
                </td>
                <td className="px-6 py-4 text-center">{po.quantity_needed}</td>
                <td className="px-6 py-4 text-center">
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[10px] font-bold uppercase">
                    {po.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={async () => {
                      try {
                        await requestsAPI.receive(po.id);
                        alert("✅ Request received! Inventory updated.");
                        fetchData(); // Refresh UI
                      } catch (err) {
                        alert("Failed to receive item.");
                      }
                    }}
                    className="text-emerald-600 hover:text-emerald-800 font-bold flex items-center justify-center gap-1 mx-auto"
                  >
                    <CheckCircle className="w-4 h-4" /> Receive
                  </button>
                </td>
              </tr>
            ))
        ) : (
          <tr>
            <td colSpan={4} className="px-6 py-8 text-center text-neutral-400">
              No pending orders in the procurement queue.
            </td>
          </tr>
        )}
      </tbody>

      {/* Transaction Modal (Now Portaled!) */}
      {modalType &&
        activeTransactionItem &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in">
            <div
              className={`bg-white rounded-xl shadow-2xl w-full overflow-hidden flex flex-col md:flex-row transition-all duration-500 ease-in-out max-h-[90vh]
            ${modalType === "TRANSFER" ? "max-w-5xl" : "max-w-md"}`}
            >
              {/* LEFT COLUMN: THE FORM */}
              <div
                className={`flex flex-col overflow-y-auto ${modalType === "TRANSFER" ? "md:w-1/3 border-r border-neutral-200" : "w-full"}`}
              >
                <div
                  className={`p-4 border-b flex justify-between items-center sticky top-0 z-10
                ${
                  modalType === "IN"
                    ? "bg-emerald-50 border-emerald-100 text-emerald-900"
                    : modalType === "OUT"
                      ? "bg-slate-900 border-slate-800 text-white"
                      : "bg-blue-50 border-blue-100 text-blue-900"
                }`}
                >
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    {modalType === "IN" && (
                      <>
                        <ArrowDownToLine className="w-5 h-5" /> Log Delivery
                      </>
                    )}
                    {modalType === "OUT" && (
                      <>
                        <ArrowUpFromLine className="w-5 h-5" /> Log Usage
                      </>
                    )}
                    {modalType === "TRANSFER" && (
                      <>
                        <Send className="w-5 h-5" /> Dispatch Transfer
                      </>
                    )}
                  </h2>
                  <button
                    onClick={() => setModalType(null)}
                    className="p-1 hover:bg-black/10 rounded-md transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form
                  onSubmit={handleTransactionSubmit}
                  className="p-6 space-y-5 bg-white flex-1"
                >
                  <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                    <p className="text-xs text-neutral-500 font-bold uppercase mb-1">
                      Target Item
                    </p>
                    <p className="font-bold text-neutral-900">
                      {activeTransactionItem.item_name}{" "}
                      <span className="text-neutral-500 font-normal">
                        ({activeTransactionItem.brand})
                      </span>
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Current Stock: {activeTransactionItem.quantity}{" "}
                      {activeTransactionItem.unit}
                    </p>
                  </div>

                  {modalType === "TRANSFER" && (
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase mb-2 text-blue-600">
                        Destination Project Site
                      </label>
                      <select
                        required
                        value={transactionForm.destination_site_id}
                        onChange={(e) =>
                          setTransactionForm({
                            ...transactionForm,
                            destination_site_id: e.target.value,
                          })
                        }
                        className="w-full p-3 border border-blue-200 bg-blue-50 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Select Receiving Site...</option>
                        {sitesList
                          .filter((s) => s.id !== activeTransactionItem.site_id)
                          .map((site) => (
                            <option key={site.id} value={site.id}>
                              {site.site_name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">
                      Quantity{" "}
                      {modalType === "IN"
                        ? "Received"
                        : modalType === "TRANSFER"
                          ? "To Transfer"
                          : "Used"}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        required
                        min="1"
                        max={
                          modalType !== "IN"
                            ? activeTransactionItem.quantity
                            : undefined
                        }
                        value={transactionForm.quantity || ""}
                        onChange={(e) =>
                          setTransactionForm({
                            ...transactionForm,
                            quantity: Number(e.target.value),
                          })
                        }
                        className="w-full p-3 border border-neutral-300 rounded-lg text-lg font-bold text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                      <span className="font-bold text-neutral-500 bg-neutral-100 px-4 py-3 rounded-lg border border-neutral-200 shrink-0">
                        {activeTransactionItem.unit}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className={`w-full py-3 rounded-lg text-sm font-bold transition-colors text-white 
                    ${
                      modalType === "IN"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : modalType === "OUT"
                          ? "bg-slate-900 hover:bg-slate-800"
                          : "bg-blue-600 hover:bg-blue-700"
                    }`}
                    >
                      {modalType === "TRANSFER"
                        ? "Confirm Dispatch"
                        : `Confirm ${modalType === "IN" ? "Delivery" : "Usage"}`}
                    </button>
                  </div>
                </form>
              </div>

              {/* RIGHT COLUMN: INTERACTIVE LEAFLET OSRM MAP (ONLY SHOWS ON TRANSFER) */}
              {modalType === "TRANSFER" && (
                <div className="hidden md:flex flex-col md:w-2/3 bg-slate-100 relative min-h-[500px]">
                  {transactionForm.destination_site_id ? (
                    (() => {
                      const sourceSite = sitesList.find(
                        (s) => s.id === activeTransactionItem.site_id,
                      );
                      const destSite = sitesList.find(
                        (s) =>
                          s.id === Number(transactionForm.destination_site_id),
                      );

                      if (!sourceSite || !destSite) return null;

                      return (
                        <>
                          <MapContainer
                            center={[sourceSite.latitude, sourceSite.longitude]}
                            zoom={12}
                            className="w-full h-full z-0"
                            zoomControl={false}
                          >
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                            <Marker
                              position={[
                                sourceSite.latitude,
                                sourceSite.longitude,
                              ]}
                              icon={sourceIcon}
                            >
                              <Popup>
                                <strong>Origin:</strong>
                                <br />
                                {sourceSite.site_name}
                              </Popup>
                            </Marker>

                            <Marker
                              position={[destSite.latitude, destSite.longitude]}
                              icon={destIcon}
                            >
                              <Popup>
                                <strong>Destination:</strong>
                                <br />
                                {destSite.site_name}
                              </Popup>
                            </Marker>

                            {transferRouteCoords.length > 0 && (
                              <>
                                <Polyline
                                  positions={transferRouteCoords}
                                  pathOptions={{
                                    color: "#4F46E5",
                                    dashArray: "10, 10",
                                    weight: 4,
                                    opacity: 0.8,
                                  }}
                                />
                                <RouteFitter coords={transferRouteCoords} />
                              </>
                            )}
                          </MapContainer>

                          {/* Telemetry HUD Overlay */}
                          <div className="absolute top-4 left-4 z-[999] bg-white/95 backdrop-blur shadow-xl border border-neutral-200 rounded-xl p-5 max-w-sm pointer-events-none">
                            <h3 className="text-blue-600 font-bold text-xs tracking-wider uppercase flex items-center gap-2 mb-3">
                              <Navigation className="w-4 h-4" /> Live Route
                              Telemetry
                            </h3>
                            <div className="flex items-start gap-3 mb-4">
                              <div className="mt-1 flex flex-col items-center">
                                <div className="w-3 h-3 rounded-full bg-violet-500"></div>
                                <div className="w-0.5 h-6 bg-neutral-300 my-1"></div>
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                              </div>
                              <div>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase">
                                  Origin
                                </p>
                                <p className="text-sm font-bold text-neutral-900 mb-1">
                                  {sourceSite.site_name}
                                </p>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase mt-2">
                                  Destination
                                </p>
                                <p className="text-sm font-bold text-neutral-900">
                                  {destSite.site_name}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-neutral-100">
                              <div>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase flex items-center gap-1">
                                  <MapPin className="w-3 h-3" /> Distance
                                </p>
                                <p className="text-xl font-black text-neutral-800">
                                  {routeDetails.distance}{" "}
                                  <span className="text-xs font-medium text-neutral-500">
                                    km
                                  </span>
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Travel Time
                                </p>
                                <p className="text-xl font-black text-blue-600">
                                  ~{routeDetails.eta}{" "}
                                  <span className="text-xs font-medium text-blue-400">
                                    mins
                                  </span>
                                </p>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-neutral-400">
                      <MapPin className="w-16 h-16 mb-4 opacity-20" />
                      <p className="text-sm font-medium">
                        Select a destination to visualize the logistics route.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body, //
        )}
      {/* --- ⚡ SMART RESTOCK MODAL (PORTALED) --- */}
      {showRestockModal &&
        restockItem &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-4 border-b bg-amber-50 border-amber-200 flex justify-between items-center text-amber-900">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  ⚡ AI Operations: Restock Advisory
                </h2>
                <button
                  onClick={() => setShowRestockModal(false)}
                  className="p-1 hover:bg-amber-200/50 rounded-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 bg-neutral-50">
                <div className="mb-6 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                  <p className="text-xs text-neutral-500 font-bold uppercase tracking-wider">
                    Target Material
                  </p>
                  <p className="text-xl font-black text-neutral-900">
                    {restockItem.item_name}
                  </p>
                  <p className="text-sm text-neutral-600 mt-1">
                    Calculating optimal logistics for 50 {restockItem.unit} to{" "}
                    {restockItem.siteName}
                  </p>
                </div>

                {isRestockLoading ? (
                  <div className="py-12 text-center text-amber-600 font-bold animate-pulse">
                    Running cost-analysis heuristic...
                  </div>
                ) : restockOptions.length === 0 ? (
                  <div className="py-12 text-center text-neutral-500 font-medium">
                    No viable surplus or external suppliers found for this item.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {restockOptions.map((opt, index) => (
                      <div
                        key={index}
                        className={`p-5 rounded-xl border shadow-sm ${index === 0 ? "border-emerald-400 bg-emerald-50" : "border-neutral-200 bg-white"}`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {index === 0 && (
                                <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                  Top Recommendation
                                </span>
                              )}
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${opt.type === "EXTERNAL_PURCHASE" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}
                              >
                                {opt.type.replace("_", " ")}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-neutral-900">
                              {opt.source_name}
                            </h3>
                            <p className="text-sm text-neutral-600 mt-1">
                              {opt.recommendation_reason}
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                              Total Est. Cost
                            </p>
                            <p
                              className={`text-2xl font-black ${index === 0 ? "text-emerald-700" : "text-neutral-900"}`}
                            >
                              ₱{opt.estimated_total_cost.toFixed(2)}
                            </p>
                            <p className="text-xs text-neutral-500 mt-1 font-mono">
                              {opt.distance_km} km away
                            </p>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-black/5 flex justify-end">
                          <button
                            onClick={() => handleExecuteRestock(opt)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors shadow-sm ${opt.type === "EXTERNAL_PURCHASE" ? "bg-blue-600 hover:bg-blue-700" : "bg-purple-600 hover:bg-purple-700"}`}
                          >
                            {opt.type === "EXTERNAL_PURCHASE"
                              ? "Initiate Purchase Order"
                              : "Request Site Transfer"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
      {/* --- END SMART RESTOCK MODAL --- */}
    </div>
  );
}
