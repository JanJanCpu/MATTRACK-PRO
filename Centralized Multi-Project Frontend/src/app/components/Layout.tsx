import { useLocation, Link, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Boxes, BrainCircuit, Truck, Map as MapIcon, Settings, Bell, Search, Menu, Store, LogOut, Users, ShoppingCart, Package, MapPin, ClipboardList, ArrowRight, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { inventoryAPI, sitesAPI, notificationsAPI } from "../../services/apiService";
import { executeGlobalSearch, SearchableItem, SearchResult } from "../../utils/searchUtils";
import { AiChatbotDrawer, ChatMessage } from "./AiChatbotDrawer";

const navItems = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard, allowedRoles: ["admin", "owner", "staff", "pm"] },
  { name: "Inventory & FSN", path: "/inventory", icon: Boxes, allowedRoles: ["admin", "owner", "staff", "pm"] },
  { name: "Material Requests", path: "/requests", icon: ClipboardList, allowedRoles: ["admin", "owner", "pm", "staff"] },
  { name: "AI Advisory", path: "#advisory", icon: BrainCircuit, allowedRoles: ["admin", "owner", "staff", "pm"] },
  { name: "Logistics", path: "/logistics", icon: Truck, allowedRoles: ["admin", "owner", "staff", "pm"] },
  { name: "Projects", path: "/projects", icon: MapIcon, allowedRoles: ["admin", "owner"] },
  { name: "Suppliers", path: "/suppliers", icon: Store, allowedRoles: ["admin", "owner", "staff", "pm"] },
  { name: "Team Access", path: "/team", icon: Users, allowedRoles: ["admin", "owner"] },
  { name: "My Catalog", path: "/seller-portal", icon: Package, allowedRoles: ["seller"] },
  { name: "Incoming Orders", path: "/seller-orders", icon: ShoppingCart, allowedRoles: ["seller"] },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [userRole, setUserRole] = useState("staff");
  const [userName, setUserName] = useState("User");
  const [currentUserId, setCurrentUserId] = useState<number>(1);
  const [pmSiteName, setPmSiteName] = useState<string | null>(null);
  const [pmFullSiteList, setPmFullSiteList] = useState<string>("");

  const [notifications, setNotifications] = useState<any[]>([]);
  const [globalInventory, setGlobalInventory] = useState<any[]>([]);
  const [globalSites, setGlobalSites] = useState<any[]>([]);
  const [sellerItemCount, setSellerItemCount] = useState(0);

  // --- AI ADVISORY HOISTED STATE (DEFECT 2 FIX) ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = sessionStorage.getItem("mattrack_chat_history");
    return saved ? JSON.parse(saved) : [{ id: "welcome", role: "ai", content: "System Online. I am your MatTrack PRO Procurement Advisor. I accept English, Tagalog, or Taglish terminology (e.g., 'buhangin', 'kabilya')." }];
  });
  const [chatInput, setChatInput] = useState(() => sessionStorage.getItem("mattrack_chat_draft") || "");
  const [isChatTyping, setIsChatTyping] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { sessionStorage.setItem("mattrack_chat_history", JSON.stringify(chatMessages)); }, [chatMessages]);
  useEffect(() => { sessionStorage.setItem("mattrack_chat_draft", chatInput); }, [chatInput]);

  useEffect(() => {
    let uId = 1;
    let uRole = "staff";
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        uRole = payload.role ? payload.role.toLowerCase() : "staff";
        uId = payload.id;
        setUserRole(uRole);
        setUserName(payload.sub || "User");
        setCurrentUserId(payload.id);
      } catch (e) {}
    }

    let intervalId: NodeJS.Timeout;

    const fetchBackgroundData = async () => {
      try {
        const notifs = await notificationsAPI.listUnread();
        setNotifications([...notifs]); // Strict spread for UI immutability

        if (uRole === "seller") {
          const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/seller/materials`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
          if (response.ok) {
            const data = await response.json();
            setSellerItemCount(data.length);
          }
        } else {
          const [invData, sitesData] = await Promise.all([ inventoryAPI.list(), sitesAPI.list() ]);
          setGlobalInventory(invData);
          setGlobalSites(sitesData);

          if (["staff", "pm"].includes(uRole) && uId) {
            const assignedSites = sitesData.filter((site: any) => site.manager_id === uId);
            if (assignedSites.length === 1) setPmSiteName(assignedSites[0].site_name);
            else if (assignedSites.length > 1) {
              setPmSiteName(`${assignedSites.length} Sites (${assignedSites.map((s: any) => s.site_name).join(', ')})`);
              setPmFullSiteList(assignedSites.map((s: any) => s.site_name).join(' • '));
            } else setPmSiteName("Unassigned / Main HQ");
          }
        }
      } catch (err: any) {
        // DEFECT 4 FIX: Terminate polling immediately if token is unauthorized
        if (err.message === "401_UNAUTHORIZED") {
          clearInterval(intervalId);
          localStorage.removeItem("token");
          navigate("/login");
        }
      }
    };

    fetchBackgroundData();
    window.addEventListener("inventoryUpdated", fetchBackgroundData);
    intervalId = setInterval(fetchBackgroundData, 10000);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("inventoryUpdated", fetchBackgroundData);
    };
  }, [navigate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("mattrack_chat_history");
    sessionStorage.removeItem("mattrack_chat_draft");
    navigate("/login");
  };

  const handleNotificationClick = async (e: React.MouseEvent, id: number, link?: string, isRead?: boolean) => {
    e.stopPropagation();
    try {
      if (!isRead) {
        await notificationsAPI.markAsRead(id);
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      }
      if (link) {
        setShowNotifications(false);
        if (location.pathname !== link) navigate(link);
      }
    } catch (err) {}
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {}
  };

  const filteredNavItems = navItems.filter((item) => item.allowedRoles.includes(userRole));

  // --- MULTI-INDEX GLOBAL SEARCH ENGINE ---
  const catalogForSearch: SearchableItem[] = globalInventory.map(item => ({
    id: item.id,
    name: item.item_name,
    brand: item.brand,
    site_name: globalSites.find((s) => s.id === item.site_id)?.site_name || "Unknown Site",
    site_id: item.site_id,
    category: item.fsn_status,
    tags: [item.status],
    route: "/inventory"
  }));
  const searchResults: SearchResult[] = isSearchOpen ? executeGlobalSearch(catalogForSearch, searchQuery) : [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden font-sans text-neutral-900">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-emerald-400"><BrainCircuit className="w-6 h-6" />MatTrack <span className="text-white">Pro</span></div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}>&times;</button>
        </div>

        <div className="px-6 py-6 shrink-0">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pentabuild Corp.</div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-sm font-medium text-slate-300 capitalize">System {userRole}</span></div>
        </div>

        <nav className="px-3 space-y-1 flex-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path || (item.name === "AI Advisory" && isChatOpen);
            const Icon = item.icon;

            if (item.name === "AI Advisory") {
              return (
                <button key={item.name} onClick={() => { setIsChatOpen(true); setSidebarOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-emerald-500/10 text-emerald-400" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
                  <div className="flex items-center gap-3"><Icon className={`w-5 h-5 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />{item.name}</div>
                </button>
              );
            }

            return (
              <Link key={item.name} to={item.path} onClick={() => setSidebarOpen(false)} className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-emerald-500/10 text-emerald-400" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
                <div className="flex items-center gap-3"><Icon className={`w-5 h-5 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />{item.name}</div>
                {item.name === "My Catalog" && userRole === "seller" && <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{sellerItemCount}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 shrink-0 space-y-2">
          {["admin", "owner"].includes(userRole) && (<Link to="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"><Settings className="w-5 h-5 text-slate-400" />Settings</Link>)}
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"><LogOut className="w-5 h-5" />Sign Out</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="flex items-center justify-between h-16 px-4 md:px-8 bg-white border-b border-neutral-200 shrink-0 relative z-40">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-neutral-600 hover:bg-neutral-100 rounded-md" onClick={() => setSidebarOpen(true)}><Menu className="w-5 h-5" /></button>

            {userRole !== "seller" && (
              <div ref={searchContainerRef} className="hidden md:flex items-center relative group">
                <Search className="w-4 h-4 absolute left-3 text-neutral-400" />
                <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(e.target.value.length >= 2); }} onFocus={() => searchQuery.length >= 2 && setIsSearchOpen(true)} placeholder="Search kabilya, odnot, plywood, or brands... (Ctrl+K)" className="pl-9 pr-8 py-2 w-[400px] text-sm bg-neutral-100 border border-transparent rounded-full focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none" />
                {searchQuery && (<button onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"><X className="w-3.5 h-3.5" /></button>)}

                {isSearchOpen && (
                  <div className="absolute top-full left-0 mt-2 w-[500px] bg-white border border-neutral-200 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[450px]">
                    <div className="px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 bg-neutral-50 flex justify-between">
                      <span>Found {searchResults.length} matched assets</span>
                    </div>

                    <div className="overflow-y-auto flex-1">
                      {searchResults.length > 0 ? (
                        searchResults.map((item) => (
                          <div key={`${item.route}-${item.id}`} onClick={() => { setIsSearchOpen(false); setSearchQuery(""); navigate(`${item.route}?highlightId=${item.id}`); }} className="px-4 py-3 hover:bg-emerald-50 cursor-pointer border-b border-neutral-50 flex items-center justify-between group transition-colors">
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-neutral-900 group-hover:text-emerald-700">{item.name}</span>
                              <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
                                <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.site_name}</span>
                                {item.brand && <span>• {item.brand}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-neutral-100 text-neutral-600 rounded border border-neutral-200 uppercase">{item.matchType}: {item.matchedTerm}</span>
                              <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center text-sm text-neutral-500">No stock found matching your query.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-xs font-bold text-slate-700 max-w-[250px] xl:max-w-md cursor-default" title={pmFullSiteList}>
              {["staff", "pm"].includes(userRole) && pmSiteName ? (<><MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" /><span className="shrink-0">Operating Context:</span><span className="text-emerald-700 truncate">{pmSiteName}</span></>) : userRole === "seller" ? (<><Store className="w-3.5 h-3.5 text-blue-600 shrink-0" /><span className="shrink-0">Operating Context:</span><span className="text-blue-700 truncate">External Supplier Portal</span></>) : (<><LayoutDashboard className="w-3.5 h-3.5 text-blue-600 shrink-0" /><span className="shrink-0">Operating Context:</span><span className="text-blue-700 truncate">Global Admin View</span></>)}
            </div>

            <div className="relative border-l border-neutral-200 pl-4 ml-2">
              <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 text-neutral-500 hover:bg-neutral-100 rounded-full transition-colors">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white rounded-full">{unreadCount > 9 ? "9+" : unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden z-50">
                  <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200 font-bold text-sm text-neutral-900 flex justify-between items-center">
                    <span>Your Notifications</span>
                    {unreadCount > 0 && <button onClick={handleMarkAllAsRead} className="text-[10px] text-emerald-600 hover:text-emerald-800 hover:underline">Mark all as read</button>}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <div key={notif.id} onClick={(e) => handleNotificationClick(e, notif.id, notif.link, notif.is_read)} className={`p-4 border-b border-neutral-100 transition-colors cursor-pointer flex items-start gap-3 ${!notif.is_read ? "bg-emerald-50/30 hover:bg-emerald-50" : "hover:bg-neutral-50 opacity-60"}`}>
                          {!notif.is_read && <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>}
                          <div><div className={`text-sm font-bold ${!notif.is_read ? "text-emerald-700" : "text-neutral-600"} mb-1`}>{notif.title}</div><div className="text-xs text-neutral-600 leading-relaxed">{notif.message}</div><div className="text-[10px] text-neutral-400 mt-2 font-mono">Timestamp: {notif.created_at}</div></div>
                        </div>
                      ))
                    ) : (<div className="p-8 text-center flex flex-col items-center"><Bell className="w-8 h-8 text-neutral-300 mb-2" /><span className="text-xs text-neutral-500">You're all caught up!</span></div>)}
                  </div>
                </div>
              )}
            </div>

            <Link to="/settings" className={`flex items-center gap-2 hover:opacity-80 transition-opacity ${!["admin", "owner"].includes(userRole) ? "pointer-events-none" : ""}`}>
              <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200 text-emerald-700 font-bold text-sm">{userName.charAt(0).toUpperCase()}</div>
              <div className="hidden md:block text-left"><div className="text-sm font-bold text-neutral-900 leading-none">{userName}</div></div>
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 z-0" onClick={() => { setShowNotifications(false); setIsSearchOpen(false); }}>
          <Outlet />
        </div>
      </main>

      <AiChatbotDrawer 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        messages={chatMessages} 
        setMessages={setChatMessages} 
        inputMessage={chatInput} 
        setInputMessage={setChatInput} 
        isTyping={isChatTyping} 
        setIsTyping={setIsChatTyping} 
        userRole={userRole} 
        userSiteId={currentUserId} 
      />
    </div>
  );
}