import { Outlet, Link, useLocation } from "react-router";
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
  Menu
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Inventory & FSN", path: "/inventory", icon: Boxes },
  { name: "AI Advisory", path: "/advisory", icon: BrainCircuit },
  { name: "Logistics", path: "/logistics", icon: Truck },
  { name: "Projects", path: "/projects", icon: MapIcon },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden font-sans text-neutral-900">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-emerald-400">
            <BrainCircuit className="w-6 h-6" />
            Mattrack <span className="text-white">Pro</span>
          </div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            &times;
          </button>
        </div>
        
        <div className="px-4 py-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          PENTABUILD Corp.
        </div>

        <nav className="px-3 mt-2 space-y-1">
          {navItems.map((item) => {
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

        <div className="absolute bottom-0 w-full p-4 border-t border-slate-800">
          <Link to="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
            <Settings className="w-5 h-5 text-slate-400" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between h-16 px-4 md:px-8 bg-white border-b border-neutral-200">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-neutral-600 hover:bg-neutral-100 rounded-md" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden md:flex items-center relative">
              <Search className="w-4 h-4 absolute left-3 text-neutral-400" />
              <input 
                type="text" 
                placeholder="Search projects, materials, suppliers..." 
                className="pl-9 pr-4 py-2 w-80 text-sm bg-neutral-100 border-transparent rounded-full focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 text-neutral-500 hover:bg-neutral-100 rounded-full transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
            </button>
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200 text-emerald-700 font-semibold cursor-pointer">
              <User className="w-4 h-4" />
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
