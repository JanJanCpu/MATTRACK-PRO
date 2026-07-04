import React, { useState, useEffect } from "react";
import { usersAPI } from "../../services/apiService";
import { UserPlus, Shield, Mail, Lock, Building2, UserCircle, AlertCircle, CheckCircle2 } from "lucide-react";

export function UserManagement() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "staff",
    company_name: "Pentabuild Corp.",
  });

  // Fetch existing staff on load
  const fetchStaff = async () => {
    try {
      const data = await usersAPI.getStaff();
      setStaffList(data);
    } catch (error) {
      console.error("Failed to fetch staff:", error);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: "", text: "" });

    try {
      await usersAPI.create({
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        company_name: formData.company_name.trim(),
      });

      setMessage({ type: "success", text: "User successfully created and added to the network." });
      setFormData({ ...formData, username: "", email: "", password: "" }); // Reset sensitive fields
      fetchStaff(); // Refresh the list
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to create user. Username/Email may exist." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Team Management</h1>
        <p className="text-sm text-neutral-500">Provision network access and assign roles to Pentabuild personnel.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CREATE USER FORM */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 h-fit">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-neutral-100">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-neutral-800">Provision New Account</h2>
          </div>

          {message.text && (
            <div className={`mb-4 p-3 rounded-xl text-sm flex items-start gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {message.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1 flex items-center gap-1">
                <UserCircle className="w-3 h-3"/> Username
              </label>
              <input
                type="text" required
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                placeholder="identity_id"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1 flex items-center gap-1">
                <Mail className="w-3 h-3"/> Email Address
              </label>
              <input
                type="email" required
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                placeholder="user@pentabuild.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3"/> Access Role
              </label>
              <select
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="staff">Project Staff / PM</option>
                <option value="admin">System Administrator</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1 flex items-center gap-1">
                <Lock className="w-3 h-3"/> Initial Password
              </label>
              <input
                type="text" required
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                placeholder="e.g. TempPass123!"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors flex justify-center items-center disabled:opacity-50"
            >
              {isLoading ? "Provisioning..." : "Create Account"}
            </button>
          </form>
        </div>

        {/* STAFF DIRECTORY */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden h-fit">
          <div className="p-6 border-b border-neutral-100 bg-neutral-50/50">
            <h2 className="text-lg font-bold text-neutral-800 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              Active Project Staff Ledger
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 font-bold">Identity / User</th>
                  <th className="px-6 py-4 font-bold">Contact Email</th>
                  <th className="px-6 py-4 font-bold">Assigned Role</th>
                </tr>
              </thead>
              <tbody>
                {staffList.length > 0 ? (
                  staffList.map((staff, idx) => (
                    <tr key={idx} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-neutral-900">{staff.username}</td>
                      <td className="px-6 py-4 text-neutral-600">{staff.email}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full uppercase">
                          {staff.role}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-neutral-500">
                      No active staff personnel found in the network.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}