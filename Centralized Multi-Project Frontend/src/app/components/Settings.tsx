import { User, Shield, Key, Bell, Building } from "lucide-react";
import { useState, useEffect } from "react";

export function Settings() {
  const [userName, setUserName] = useState("Loading...");
  const [userRole, setUserRole] = useState("Loading...");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role || "Admin");
        setUserName(payload.sub || "Admin User");
      } catch (e) {
        console.error("Token parse error");
      }
    }
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">System Settings & Profile</h1>
        <p className="text-sm text-neutral-500 mt-1">Manage your account, roles, and company preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm text-center">
            <div className="w-24 h-24 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-4xl font-black mb-4 border-4 border-white shadow-lg">
              {userName.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-lg font-bold text-neutral-900">{userName}</h2>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-full mt-2 uppercase tracking-wide">
              <Shield className="w-3 h-3" /> {userRole}
            </div>
            <p className="text-xs text-neutral-500 mt-4 px-4">
              As an {userRole}, you have full access to inventory ledgers and procurement advisory tools.
            </p>
          </div>
        </div>

        {/* Settings Forms */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Account Details */}
          <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-neutral-900">Manage Account</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Username</label>
                  <input disabled value={userName} className="w-full p-2.5 bg-neutral-100 border border-transparent rounded-lg text-sm text-neutral-600 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Email Address</label>
                  <input type="email" defaultValue={`${userName.toLowerCase()}@pentabuild.com`} className="w-full p-2.5 bg-white border border-neutral-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg text-sm outline-none" />
                </div>
              </div>
              <button className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg text-sm hover:bg-emerald-700 transition-colors">
                Update Account Information
              </button>
            </div>
          </div>

          {/* Company Details (For Owner SOP) */}
          <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2">
              <Building className="w-5 h-5 text-slate-600" />
              <h3 className="font-bold text-neutral-900">Company Details</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Registered Company Name</label>
                <input defaultValue="PENTABUILD Corp." className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-sm outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Corporate Address</label>
                <input defaultValue="Makati City, Metro Manila" className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-sm outline-none focus:border-emerald-500" />
              </div>
              <button className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg text-sm hover:bg-slate-800 transition-colors">
                Save Company Profile
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}