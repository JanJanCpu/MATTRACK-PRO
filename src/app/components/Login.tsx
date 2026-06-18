import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authAPI } from "../../services/apiService";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // 1. SECURITY FIX: Trim username to prevent trailing whitespace errors
      const response = await authAPI.login(username.trim(), password);
      
      // 2. CRITICAL FIX: You MUST save the token to localStorage, otherwise 
      // the React router will immediately kick you back out.
      if (response && response.access_token) {
        localStorage.setItem("token", response.access_token);
        navigate("/"); 
      } else {
        throw new Error("Invalid cryptographic server payload received.");
      }
    } catch (err: any) {
      // 3. DEFENSIVE SECURITY: Do not specify if the username or the password was the wrong part.
      setError("Invalid combination credentials. Access denied.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-slate-200">
        
        {/* Branding Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center justify-center gap-2">
            <span className="text-emerald-500">❖</span> MatTrack <span className="text-slate-800">PRO</span>
          </h1>
          <p className="text-sm text-slate-500 mt-2 tracking-wide uppercase">
            Pentabuild Corp. Authentication
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm text-center">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Username
            </label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              placeholder="e.g. admin_juan"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-md transition-all flex justify-center items-center gap-2 ${
              isLoading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              "Sign In to System"
            )}
          </button>
        </form>

        {/* 4. UX FIX: Add Registration Link */}
        <p className="mt-6 text-center text-sm text-slate-600">
          Don't have a secure profile?{" "}
          <Link to="/register" className="font-bold text-emerald-600 hover:text-emerald-500 transition-colors">
            Register here
          </Link>
        </p>

      </div>
    </div>
  );
}