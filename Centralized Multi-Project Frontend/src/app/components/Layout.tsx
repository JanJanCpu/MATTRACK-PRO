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
  Users,
  ShoppingCart,
  Package,
  MapPin,
  ClipboardList, // Added for Requests
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  inventoryAPI,
  sitesAPI,
  notificationsAPI,
} from "../../services/apiService";

const navItems = [
  {
    name: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
    allowedRoles: ["admin", "owner", "staff", "pm"],
  },
  {
    name: "Inventory & FSN",
    path: "/inventory",
    icon: Boxes,
    allowedRoles: ["admin", "owner", "staff", "pm"],
  },
  {
    name: "Material Requests",
    path: "/requests",
    icon: ClipboardList,
    allowedRoles: ["admin", "owner", "pm", "staff"],
  },
  {
    name: "AI Advisory",
    path: "/advisory",
    icon: BrainCircuit,
    allowedRoles: ["admin", "owner", "staff", "pm"],
  },
  {
    name: "Logistics",
    path: "/logistics",
    icon: Truck,
    allowedRoles: ["admin", "owner", "staff", "pm"],
  },
  {
    name: "Projects",
    path: "/projects",
    icon: MapIcon,
    allowedRoles: ["admin", "owner"],
  },
  {
    name: "Suppliers",
    path: "/suppliers",
    icon: Store,
    allowedRoles: ["admin", "owner", "staff", "pm"],
  },
  {
    name: "Team Access",
    path: "/team",
    icon: Users,
    allowedRoles: ["admin", "owner"],
  },
  {
    name: "My Catalog",
    path: "/seller-portal",
    icon: Package,
    allowedRoles: ["seller"],
  },
  {
    name: "Incoming Orders",
    path: "/seller-orders",
    icon: ShoppingCart,
    allowedRoles: ["seller"],
  },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [userRole, setUserRole] = useState("staff");
  const [userName, setUserName] = useState("User");

  const [pmSiteName, setPmSiteName] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<any[]>([]);

  const [globalInventory, setGlobalInventory] = useState<any[]>([]);
  const [globalSites, setGlobalSites] = useState<any[]>([]);

  // --- Track the seller's inventory count ---
  const [sellerItemCount, setSellerItemCount] = useState(0);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let currentUserId: number | null = null;
    let currentUserRole = "staff";

    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        currentUserRole = payload.role ? payload.role.toLowerCase() : "staff";
        setUserRole(currentUserRole);
        setUserName(payload.sub || "User");
        currentUserId = payload.id;
      } catch (e) {
        console.error("Token parse error");
      }
    }

    const fetchBackgroundData = async () => {
      try {
        const notifs = await notificationsAPI.listUnread();
        setNotifications(notifs);

        if (currentUserRole === "seller") {
          // Dynamic hostname fix to prevent network trap crashes
          const baseUrl = `http://${window.location.hostname}:8000`;
          const response = await fetch(
            `${baseUrl}/seller/materials`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            }
          );
          if (response.ok) {
            const data = await response.json();
            setSellerItemCount(data.length);
          }
        } else {
          const [invData, sitesData] = await Promise.all([
            inventoryAPI.list(),
            sitesAPI.list(),
          ]);
          setGlobalInventory(invData);
          setGlobalSites(sitesData);

          // Accepts both 'staff' and 'pm' nomenclature from token
          if (["staff", "pm"].includes(currentUserRole) && currentUserId) {
            const assignedSite = sitesData.find(
              (site) => site.manager_id === currentUserId
            );
            setPmSiteName(
              assignedSite ? assignedSite.site_name : "Unassigned User"
            );
          }
        }
      } catch (err) {
        console.error("Failed to load background data:", err);
      }
    };

    fetchBackgroundData();

    window.addEventListener("inventoryUpdated", fetchBackgroundData);

    const interval = setInterval(() => fetchBackgroundData(), 10000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("inventoryUpdated", fetchBackgroundData);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleNotificationClick = async (
    e: React.MouseEvent,
    id: number,
    link?: string,
    isRead?: boolean
  ) => {
    e.stopPropagation();
    try {
      if (!isRead) {
        await notificationsAPI.markAsRead(id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
      }

      if (link) {
        setShowNotifications(false);
        if (location.pathname !== link) {
          navigate(link);
        }
      }
    } catch (err) {
      console.error("Failed to mark notification as read");
    }
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark all as read");
    }
  };

  const filteredNavItems = navItems.filter((item) =>
    item.allowedRoles.includes(userRole)
  );

  const searchResults =
    searchQuery.trim() === ""
      ? []
      : globalInventory.filter(
          (item) =>
            item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.brand.toLowerCase().includes(searchQuery.toLowerCase())
        );

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden font-sans text-neutral-900">
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

        <nav className="px-3 space-y-1 flex-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 ${isActive ? "text-emerald-400" : "text-slate-400"}`}
                  />
                  {item.name}
                </div>

                {/* --- The Badge specifically for the seller catalog --- */}
                {item.name === "My Catalog" && userRole === "seller" && (
                  <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {sellerItemCount}
                  </span>
                )}
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

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="flex items-center justify-between h-16 px-4 md:px-8 bg-white border-b border-neutral-200 shrink-0 relative z-40">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 text-neutral-600 hover:bg-neutral-100 rounded-md"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* --- SECURITY FIX: Hide Internal Data Search from Sellers --- */}
            {userRole !== "seller" && (
              <div className="hidden md:flex items-center relative group">
                <Search className="w-4 h-4 absolute left-3 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search materials, tools, or brands..."
                  className="pl-9 pr-4 py-2 w-[400px] text-sm bg-neutral-100 border border-transparent rounded-full focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                />

                {searchQuery && (
                  <div className="absolute top-full left-0 mt-2 w-[500px] bg-white border border-neutral-200 rounded-xl shadow-2xl py-2 max-h-[450px] overflow-y-auto z-50">
                    <div className="px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
                      Network Inventory Results
                    </div>

                    {searchResults.length > 0 ? (
                      searchResults.map((item) => {
                        const site = globalSites.find(
                          (s) => s.id === item.site_id
                        );

                        return (
                          <div
                            key={item.id}
                            className="px-4 py-3 hover:bg-neutral-50 border-b border-neutral-50 flex items-center justify-between group cursor-default"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                                <Package className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-bold text-neutral-900 text-sm">
                                  {item.item_name}
                                </div>
                                <div className="text-xs text-neutral-500">
                                  {item.brand} •{" "}
                                  <span className="text-emerald-600 font-medium">
                                    {site?.site_name || "Unknown Site"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="font-black text-neutral-900 text-sm">
                                  {item.quantity}{" "}
                                  <span className="text-xs font-normal text-neutral-500">
                                    {item.unit}
                                  </span>
                                </div>
                                <div
                                  className={`text-[10px] font-bold uppercase ${item.status === "Critical" ? "text-red-500" : "text-emerald-500"}`}
                                >
                                  {item.status}
                                </div>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSearchQuery("");
                                  navigate("/suppliers");
                                }}
                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                                title="Procure More"
                              >
                                <ShoppingCart className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-4 py-8 text-center text-sm text-neutral-500">
                        No stock found for "{searchQuery}".
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            navigate("/suppliers");
                          }}
                          className="block mx-auto mt-2 text-emerald-600 font-medium hover:underline flex items-center justify-center gap-1"
                        >
                          <Search className="w-3 h-3" /> Find in Global Suppliers Network
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-xs font-bold text-slate-700">
              {["staff", "pm"].includes(userRole) && pmSiteName ? (
                <>
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  Operating Context:{" "}
                  <span className="text-emerald-700">{pmSiteName}</span>
                </>
              ) : userRole === "seller" ? (
                <>
                  <Store className="w-3.5 h-3.5 text-blue-600" />
                  Operating Context:{" "}
                  <span className="text-blue-700">
                    External Supplier Portal
                  </span>
                </>
              ) : (
                <>
                  <LayoutDashboard className="w-3.5 h-3.5 text-blue-600" />
                  Operating Context:{" "}
                  <span className="text-blue-700">Global Admin View</span>
                </>
              )}
            </div>

            <div className="relative border-l border-neutral-200 pl-4 ml-2">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-neutral-500 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white rounded-full">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden z-50">
                  <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200 font-bold text-sm text-neutral-900 flex justify-between items-center">
                    <span>Your Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-[10px] text-emerald-600 hover:text-emerald-800 hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={(e) =>
                            handleNotificationClick(
                              e,
                              notif.id,
                              notif.link,
                              notif.is_read
                            )
                          }
                          className={`p-4 border-b border-neutral-100 transition-colors cursor-pointer flex items-start gap-3
                            ${!notif.is_read ? "bg-emerald-50/30 hover:bg-emerald-50" : "hover:bg-neutral-50 opacity-60"}
                          `}
                        >
                          {!notif.is_read && (
                            <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                          )}
                          <div>
                            <div
                              className={`text-sm font-bold ${!notif.is_read ? "text-emerald-700" : "text-neutral-600"} mb-1`}
                            >
                              {notif.title}
                            </div>
                            <div className="text-xs text-neutral-600 leading-relaxed">
                              {notif.message}
                            </div>
                            <div className="text-[10px] text-neutral-400 mt-2 font-mono">
                              Timestamp: {notif.created_at}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center flex flex-col items-center">
                        <Bell className="w-8 h-8 text-neutral-300 mb-2" />
                        <span className="text-xs text-neutral-500">
                          You're all caught up!
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link
              to="/settings"
              className={`flex items-center gap-2 hover:opacity-80 transition-opacity ${!["admin", "owner"].includes(userRole) ? "pointer-events-none" : ""}`}
            >
              <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200 text-emerald-700 font-bold text-sm">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-bold text-neutral-900 leading-none">
                  {userName}
                </div>
              </div>
            </Link>
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