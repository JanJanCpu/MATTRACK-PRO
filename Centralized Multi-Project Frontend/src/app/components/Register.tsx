import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authAPI } from "../../services/apiService";
import { Building2, UserCircle, Mail, Lock, Shield, CheckCircle2, AlertCircle } from "lucide-react";

export function Register() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "staff", // Default to lower privilege for security
    company_name: "Pentabuild Corp.",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Client-Side Security Pass Filter
  const validateForm = () => {
    if (formData.username.length < 4) {
      setError("Username must be at least 4 characters long.");
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return false;
    }
    if (!/[A-Z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      setError("Password must contain at least one uppercase letter and one number.");
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      // Send validated clean data to your FastAPI /register endpoint
      await authAPI.register({
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        company_name: formData.company_name.trim()
      });

      setSuccess(true);
      // Automatically redirect to login after a 2-second delay
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Registration rejected. Username or email may already be registered.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-sm border border-neutral-200">
        
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Create Account
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Access the MatTrack Pro Management Network
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Account verified and created! Redirecting to login...</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1 flex items-center gap-1">
                <UserCircle className="w-3 h-3"/> Username
              </label>
              <input
                type="text" required disabled={isLoading || success}
                className="w-full px-3 py-2 border border-neutral-300 bg-white rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                placeholder="identity_id"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3"/> Role Assignment
              </label>
              <select
                disabled={isLoading || success}
                className="w-full px-3 py-2 border border-neutral-300 bg-white rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="staff">Project Staff / PM</option>
                <option value="admin">System Administrator</option>
                <option value="owner">Company Owner</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1 flex items-center gap-1">
              <Mail className="w-3 h-3"/> Email Address
            </label>
            <input
              type="email" required disabled={isLoading || success}
              className="w-full px-3 py-2 border border-neutral-300 bg-white rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
              placeholder="user@pentabuild.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3"/> Corporate Division
            </label>
            <input
              type="text" required disabled={isLoading || success}
              className="w-full px-3 py-2 border border-neutral-300 bg-white rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1 flex items-center gap-1">
              <Lock className="w-3 h-3"/> Account Password
            </label>
            <input
              type="password" required disabled={isLoading || success}
              className="w-full px-3 py-2 border border-neutral-300 bg-white rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
              placeholder="Minimum 8 characters (A-Z, 0-9)"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1 flex items-center gap-1">
              <Lock className="w-3 h-3"/> Confirm Password
            </label>
            <input
              type="password" required disabled={isLoading || success}
              className="w-full px-3 py-2 border border-neutral-300 bg-white rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
              placeholder="Re-enter password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || success}
            className={`w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors flex justify-center items-center ${
              isLoading || success ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            {isLoading ? "Validating Credentials..." : "Register Secured Profile"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-600">
          Already authorized?{" "}
          <Link to="/login" className="font-bold text-emerald-600 hover:text-emerald-500 transition-colors">
            Sign inside here
          </Link>
        </p>
      </div>
    </div>
  );
}