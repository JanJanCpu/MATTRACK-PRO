import { useLocation, Link, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  BrainCircuit,
  Truck,
  Map as MapIcon,
  Settings,
  Bell,
  Search,
  User,
  Menu,
  Store,
  LogOut,
} from "lucide-react";
import { useState, useEffect } from "react";
import { inventoryAPI } from "../../services/apiService";

// 1. THE VIP LIST: "staff" is removed from Owner views (AI Advisory & Logistics)
const navItems = [
  {
    name: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
    allowedRoles: ["admin", "owner"], // Removed "staff"
  },
  {
    name: "Inventory & FSN",
    path: "/inventory",
    icon: Boxes,
    allowedRoles: ["admin", "owner", "staff"],
  },
  {
    name: "AI Advisory",
    path: "/advisory",
    icon: BrainCircuit,
    allowedRoles: ["admin", "owner", "staff"], // Added "staff"
  },
  {
    name: "Logistics",
    path: "/logistics",
    icon: Truck,
    allowedRoles: ["admin", "owner", "staff"], // Added "staff"
  },
  {
    name: "Projects",
    path: "/projects",
    icon: MapIcon,
    allowedRoles: ["admin", "owner", "staff"], // Added "staff"
  },
  {
    name: "Suppliers",
    path: "/suppliers",
    icon: Store,
    allowedRoles: ["admin", "owner", "staff"], // Added "staff"
  },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [userRole, setUserRole] = useState("staff");
  const [userName, setUserName] = useState("User");
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserRole(payload.role ? payload.role.toLowerCase() : "staff");
        setUserName(payload.sub || "User");
      } catch (e) {
        console.error("Token parse error");
      }
    }

    const fetchLogs = async () => {
      try {
        const logs = await inventoryAPI.getLogs();
        setRecentLogs(logs);
      } catch (err) {
        console.error("Failed to load audit logs. The true error is:", err);
      }
    };

    fetchLogs();

    const interval = setInterval(() => {
      fetchLogs();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const filteredNavItems = navItems.filter((item) =>
    item.allowedRoles.includes(userRole),
  );

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden font-sans text-neutral-900">
      {/* Sidebar */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 flex flex-col
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-emerald-400">
            <BrainCircuit className="w-6 h-6" />
            MatTrack <span className="text-white">Pro</span>
          </div>
          <button
            className="md:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-6 shrink-0">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Pentabuild Corp.
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-sm font-medium text-slate-300 capitalize">
              System {userRole}
            </span>
          </div>
        </div>

        {/* RENDER FILTERED MENU */}
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
                <Icon
                  className={`w-5 h-5 ${isActive ? "text-emerald-400" : "text-slate-400"}`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 shrink-0 space-y-2">
          {["admin", "owner"].includes(userRole) && (
            <Link
              to="/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Settings className="w-5 h-5 text-slate-400" />
              Settings
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
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
            <button
              className="md:hidden p-2 text-neutral-600 hover:bg-neutral-100 rounded-md"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden md:flex items-center relative group">
              <Search className="w-4 h-4 absolute left-3 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects, materials, suppliers..."
                className="pl-9 pr-4 py-2 w-80 text-sm bg-neutral-100 border border-transparent rounded-full focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Notifications Dropdown */}
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
                <div className="absolute right-0 mt-2 w-80 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden">
                  <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200 font-bold text-sm text-neutral-900 flex justify-between items-center">
                    System Audit Alerts
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      {recentLogs.length} New
                    </span>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {recentLogs.length > 0 ? (
                      recentLogs.map((log, idx) => (
                        <div
                          key={idx}
                          className="p-4 border-b border-neutral-100 hover:bg-neutral-50 transition-colors cursor-pointer"
                        >
                          <div className="text-sm font-bold text-emerald-600 mb-1">
                            Inventory Updated
                          </div>
                          <div className="text-xs text-neutral-600 leading-relaxed">
                            {log.action}
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-2 font-mono">
                            Timestamp: {log.timestamp}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-neutral-500">
                        No recent activity found.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Element Header Wrapper */}
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200 text-emerald-700 font-bold text-sm">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-bold text-neutral-900 leading-none">
                  {userName}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div
          className="flex-1 overflow-auto p-4 md:p-8 z-0"
          onClick={() => {
            setShowNotifications(false);
            setSearchQuery("");
          }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
