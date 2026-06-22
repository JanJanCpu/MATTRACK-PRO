import { User, Shield, Key, Download, Building, AlertTriangle, MonitorSmartphone, XCircle, Activity } from "lucide-react";
import { useState, useEffect } from "react";
import { securityAPI } from "../../services/apiService";

export function Settings() {
  const [userName, setUserName] = useState("Loading...");
  const [userRole, setUserRole] = useState("Loading...");
  
  // Security State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  
  // Sessions & Logs
  const [sessions, setSessions] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [isRevoking, setIsRevoking] = useState(false);

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

    const fetchSecurityData = async () => {
      try {
        const [sessData, logsData] = await Promise.all([
          securityAPI.getSessions(),
          securityAPI.getSecurityLogs()
        ]);
        setSessions(sessData);
        setSecurityLogs(logsData);
      } catch (err) {
        console.error("Failed to load security data");
      }
    };

    fetchSecurityData();
  }, []);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus({ type: 'loading', message: 'Verifying credentials...' });
    
    try {
      await securityAPI.updatePassword({
        current_password: currentPassword,
        new_password: newPassword
      });
      setPasswordStatus({ type: 'success', message: 'Password updated successfully! A security alert has been logged.' });
      setCurrentPassword("");
      setNewPassword("");
      
      // Refresh logs to show the new event
      const logs = await securityAPI.getSecurityLogs();
      setSecurityLogs(logs);
      
    } catch (err: any) {
      setPasswordStatus({ type: 'error', message: err.message || 'Verification failed. Please check your current password.' });
    }
  };

  const handleRevokeSessions = async () => {
    if (!window.confirm("ISO 27001 ALERT: Are you sure you want to forcefully disconnect all other devices? This action is immediate and cannot be undone.")) return;
    
    setIsRevoking(true);
    try {
      await securityAPI.revokeOtherSessions();
      alert("All other sessions have been successfully revoked.");
      const [sessData, logsData] = await Promise.all([
        securityAPI.getSessions(),
        securityAPI.getSecurityLogs()
      ]);
      setSessions(sessData);
      setSecurityLogs(logsData);
    } catch (err) {
      alert("Failed to revoke sessions.");
    } finally {
      setIsRevoking(false);
    }
  };

  const handleExportData = () => {
    const payload = JSON.stringify({
      user: userName,
      role: userRole,
      export_date: new Date().toISOString(),
      active_sessions: sessions,
      security_events: securityLogs
    }, null, 2);
    
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `MatTrack_Security_Export_${userName}.json`;
    link.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto pb-12">
      <div className="border-b border-neutral-200 pb-4">
        <h1 className="text-2xl font-bold text-neutral-900">Information Security & Profile</h1>
        <p className="text-sm text-neutral-500 mt-1"></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
            <div className="w-24 h-24 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto text-4xl font-black mb-4 shadow-inner">
              {userName.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-lg font-bold text-neutral-900">{userName}</h2>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-full mt-2 uppercase tracking-wide">
              <Shield className="w-3 h-3" /> {userRole}
            </div>
            <p className="text-xs text-neutral-500 mt-4 px-2 leading-relaxed">
              Your account is currently protected by standard role-based access controls (RBAC) and immutable audit logging.
            </p>
          </div>
          
          <div className="bg-slate-900 rounded-xl p-6 shadow-sm text-white">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" /> Data Portability
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Download a complete JSON payload of your security footprint, active sessions, and personal data to ensure compliance portability.
            </p>
            <button onClick={handleExportData} className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-sm transition-colors border border-white/20">
              Export My Data
            </button>
          </div>
        </div>

        {/* Security Controls */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Strict Credential Update */}
          <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2 bg-neutral-50">
              <Key className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-neutral-900">Credential Update</h3>
            </div>
            <div className="p-6">
              <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-md">
                {passwordStatus.type !== 'idle' && (
                  <div className={`p-3 text-xs font-bold rounded-lg flex items-center gap-2 ${
                    passwordStatus.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                    passwordStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {passwordStatus.type === 'error' && <AlertTriangle className="w-4 h-4" />}
                    {passwordStatus.message}
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Current Password (Required)</label>
                  <input 
                    type="password" 
                    required 
                    value={currentPassword} 
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="w-full p-2.5 bg-white border border-neutral-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg text-sm outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">New Password</label>
                  <input 
                    type="password" 
                    required 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full p-2.5 bg-white border border-neutral-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg text-sm outline-none" 
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={passwordStatus.type === 'loading'}
                  className="px-6 py-2 bg-amber-600 text-white font-bold rounded-lg text-sm hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {passwordStatus.type === 'loading' ? 'Verifying...' : 'Change Password'}
                </button>
              </form>
            </div>
          </div>

          {/* Active Sessions Management */}
          <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center gap-2">
                <MonitorSmartphone className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-neutral-900">Active Sessions</h3>
              </div>
              <button 
                onClick={handleRevokeSessions}
                disabled={isRevoking || sessions.length <= 1}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-md text-xs font-bold transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" /> Revoke All Other Sessions
              </button>
            </div>
            <div className="p-0">
              <div className="divide-y divide-neutral-100">
                {sessions.map(sess => (
                  <div key={sess.id} className="p-5 flex items-start gap-4 hover:bg-neutral-50 transition-colors">
                    <div className="mt-1">
                      {sess.device_info.includes('Mobile') ? <MonitorSmartphone className="w-6 h-6 text-neutral-400" /> : <MonitorSmartphone className="w-6 h-6 text-slate-400" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-neutral-900 text-sm">{sess.device_info}</p>
                        {sess.is_current_session && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-wider rounded-full">This Device</span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1 space-y-0.5 font-mono">
                        <p>IP Address: <span className="text-neutral-700">{sess.ip_address}</span></p>
                        <p>Session Started: {sess.created_at}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Targeted Security Logs */}
          <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2 bg-neutral-50">
              <Activity className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-neutral-900">Personal Security Log</h3>
            </div>
            <div className="p-0">
              <div className="divide-y divide-neutral-100">
                {securityLogs.length > 0 ? (
                  securityLogs.map(log => (
                    <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-neutral-50 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                      <div>
                        <p className="text-sm font-medium text-neutral-800">{log.action}</p>
                        <p className="text-[10px] text-neutral-400 mt-1 font-mono">{log.timestamp}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-sm text-neutral-500">No recent security events detected.</div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}