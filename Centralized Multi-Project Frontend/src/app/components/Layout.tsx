import { useLocation, Link, Outlet, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, Boxes, BrainCircuit, Truck, Map as MapIcon, 
  Settings, Bell, Search, User, Menu, Store, LogOut, ShoppingCart, Package
} from "lucide-react";
import { useState, useEffect } from "react";
import { inventoryAPI, sitesAPI } from "../../services/apiService"; // <-- ADDED sitesAPI

// 1. THE VIP LIST: We added 'allowedRoles' to dictate who sees what.
const navItems = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard, allowedRoles: ["admin", "owner", "staff"] },
  { name: "Inventory & FSN", path: "/inventory", icon: Boxes, allowedRoles: ["admin", "owner", "staff"] },
  { name: "AI Advisory", path: "/advisory", icon: BrainCircuit, allowedRoles: ["admin", "owner", "staff"] },
  { name: "Logistics", path: "/logistics", icon: Truck, allowedRoles: ["admin", "owner", "staff"] },
  // Restricted Routes below:
  { name: "Projects", path: "/projects", icon: MapIcon, allowedRoles: ["admin", "owner"] },
  { name: "Suppliers", path: "/suppliers", icon: Store, allowedRoles: ["admin", "owner"] },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // State for our RBAC logic
  const [userRole, setUserRole] = useState("staff"); 
  const [userName, setUserName] = useState("User");

  // State for Live Logs & Omnisearch Data
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [globalInventory, setGlobalInventory] = useState<any[]>([]);
  const [globalSites, setGlobalSites] = useState<any[]>([]);
  
  const location = useLocation();
  const navigate = useNavigate();

  // 2. THE CHECKPOST & DATA SYNC
  useEffect(() => {
    // Auth Check
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role ? payload.role.toLowerCase() : "staff");
        setUserName(payload.sub || "User");
      } catch (e) {
        console.error("Token parse error");
      }
    }

    // Fetch Logs & Search Data
    const fetchBackgroundData = async () => {
      try {
        const [logs, invData, sitesData] = await Promise.all([
          inventoryAPI.getLogs(),
          inventoryAPI.list(),
          sitesAPI.list()
        ]);
        setRecentLogs(logs);
        setGlobalInventory(invData);
        setGlobalSites(sitesData);
      } catch (err) {
        console.error("Failed to load background data:", err);
      }
    };

    fetchBackgroundData(); // Fetch immediately

    // Poll for fresh logs and inventory every 10 seconds
    const interval = setInterval(() => {
      fetchBackgroundData();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  // 3. THE SHAPE-SHIFTER
  const filteredNavItems = navItems.filter(item => 
    item.allowedRoles.includes(userRole)
  );

  // 4. OMNISEARCH LOGIC
  const searchResults = searchQuery.trim() === "" ? [] : globalInventory.filter(item => 
    item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.brand.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden font-sans text-neutral-900">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 flex flex-col
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-emerald-400">
            <BrainCircuit className="w-6 h-6" />
            MatTrack <span className="text-white">Pro</span>
          </div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            &times;
          </button>
        </div>
        
        <div className="px-6 py-6 shrink-0">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Pentabuild Corp.
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-sm font-medium text-slate-300 capitalize">System {userRole}</span>
          </div>
        </div>

        <nav className="px-3 space-y-1 flex-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? "bg-emerald-500/10 text-emerald-400" 
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 shrink-0 space-y-2">
          {["admin", "owner"].includes(userRole) && (
            <Link to="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
              <Settings className="w-5 h-5 text-slate-400" />
              Settings
            </Link>
          )}
          
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="flex items-center justify-between h-16 px-4 md:px-8 bg-white border-b border-neutral-200 shrink-0 relative z-40">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-neutral-600 hover:bg-neutral-100 rounded-md" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            
            {/* --- OMNISEARCH BAR --- */}
            <div className="hidden md:flex items-center relative group">
              <Search className="w-4 h-4 absolute left-3 text-neutral-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search materials, tools, or brands..." 
                className="pl-9 pr-4 py-2 w-[400px] text-sm bg-neutral-100 border border-transparent rounded-full focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
              />
              
              {/* OMNISEARCH DROPDOWN RESULTS */}
              {searchQuery && (
                <div className="absolute top-full left-0 mt-2 w-[500px] bg-white border border-neutral-200 rounded-xl shadow-2xl py-2 max-h-[450px] overflow-y-auto z-50">
                  <div className="px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
                    Network Inventory Results
                  </div>
                  
                  {searchResults.length > 0 ? (
                    searchResults.map(item => {
                      // Find the site name based on the item's site_id
                      const site = globalSites.find(s => s.id === item.site_id);
                      
                      return (
                        <div key={item.id} className="px-4 py-3 hover:bg-neutral-50 border-b border-neutral-50 flex items-center justify-between group cursor-default">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                              <Package className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-neutral-900 text-sm">{item.item_name}</div>
                              <div className="text-xs text-neutral-500">
                                {item.brand} • <span className="text-emerald-600 font-medium">{site?.site_name || "Unknown Site"}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="font-black text-neutral-900 text-sm">
                                {item.quantity} <span className="text-xs font-normal text-neutral-500">{item.unit}</span>
                              </div>
                              <div className={`text-[10px] font-bold uppercase ${item.status === 'Critical' ? 'text-red-500' : 'text-emerald-500'}`}>
                                {item.status}
                              </div>
                            </div>
                            
                            {/* THE "OPTION TO BUY ANOTHER" BUTTON */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchQuery(""); // Close search
                                navigate('/suppliers'); // Send them to buy more
                              }}
                              className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                              title="Procure More"
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-neutral-500">
                      No stock found for "{searchQuery}".
                      <button 
                        onClick={() => { setSearchQuery(""); navigate('/suppliers'); }}
                        className="block mx-auto mt-2 text-emerald-600 font-medium hover:underline flex items-center justify-center gap-1"
                      >
                        <Search className="w-3 h-3" /> Find in Global Suppliers Network
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* LIVE NOTIFICATIONS DROPDOWN */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-neutral-500 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <Bell className="w-5 h-5" />
                {recentLogs.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden z-50">
                  <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200 font-bold text-sm text-neutral-900 flex justify-between items-center">
                    System Audit Alerts
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{recentLogs.length} New</span>
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto">
                    {recentLogs.length > 0 ? (
                      recentLogs.map((log, idx) => (
                        <div key={idx} className="p-4 border-b border-neutral-100 hover:bg-neutral-50 transition-colors cursor-pointer">
                          <div className="text-sm font-bold text-emerald-600 mb-1">Inventory Updated</div>
                          <div className="text-xs text-neutral-600 leading-relaxed">{log.action}</div>
                          <div className="text-[10px] text-neutral-400 mt-2 font-mono">Timestamp: {log.timestamp}</div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-neutral-500">No recent activity found.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link to="/settings" className={`flex items-center gap-2 hover:opacity-80 transition-opacity ${!["admin", "owner"].includes(userRole) ? "pointer-events-none" : ""}`}>
              <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200 text-emerald-700 font-bold text-sm">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-bold text-neutral-900 leading-none">{userName}</div>
              </div>
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 z-0" onClick={() => { setShowNotifications(false); setSearchQuery(""); }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}