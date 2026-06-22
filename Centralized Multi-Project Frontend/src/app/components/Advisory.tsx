import React, { useState, useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle, Send, Bot, User, Sparkles, Database, ShieldCheck, Trash2, Activity } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom"; 

// --- INLINED API SERVICE ---
// By inlining the API calls here, we avoid relative import compilation errors 
// and ensure the app dynamically targets your PC or Mobile Phone's IP address.
const BASE_URL = `http://${window.location.hostname}:8000`;

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token") || localStorage.getItem("access_token");
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  if (!response.ok) throw new Error(`API Error: ${response.status}`);
  return await response.json();
}

type Inventory = {
  id: number;
  item_name: string;
  brand?: string;
  quantity: number;
  unit: string;
  status: string;
  site_id: number;
};

const inventoryAPI = {
  list: () => fetchAPI<Inventory[]>('/inventory/')
};

const sitesAPI = {
  list: () => fetchAPI<any[]>('/sites/')
};

const advisoryAPI = {
  askAI: (message: string) => fetchAPI<{reply: string}>('/advisory/chat', {
    method: 'POST',
    body: JSON.stringify({ message })
  })
};
// ---------------------------

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
}

export function Advisory() {
  const location = useLocation();
  const navigate = useNavigate();

  const [criticalItems, setCriticalItems] = useState<(Inventory & { siteName: string })[]>([]);
  const [userSites, setUserSites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // --- USER-ISOLATED CHAT MEMORY ---
  const token = localStorage.getItem("token") || localStorage.getItem("access_token");
  let currentUserId = "default";
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      currentUserId = payload.id || payload.sub || "default";
    } catch (e) {}
  }
  const storageKey = `mattrack_ai_chat_${currentUserId}`;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const savedChat = localStorage.getItem(storageKey);
    if (savedChat) {
      try {
        return JSON.parse(savedChat);
      } catch (e) {
        console.error("Failed to parse chat history");
      }
    }
    return [
      {
        id: "welcome",
        role: "ai",
        content: "System Online. I am your MatTrack PRO Procurement Advisor. I am currently connected to your live PostgreSQL database. Click on an urgent item on the left, or ask me directly about our verified supplier options, pricing, or logistics.",
      }
    ];
  });

  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-save chat
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    const fetchCriticalStock = async () => {
      setLoading(true);
      try {
        const [inventory, sites] = await Promise.all([
          inventoryAPI.list(),
          sitesAPI.list()
        ]);
        
        // Extract the user's assigned sites for AI Context
        const siteNames = sites.map(s => s.site_name);
        setUserSites(siteNames);

        const siteMap = new Map(sites.map(s => [s.id, s.site_name]));
        
        const urgent = inventory
          .filter(item => item.status === "Critical" || item.status === "Low Stock")
          .map(item => ({
            ...item,
            siteName: siteMap.get(item.site_id) || `Site ${item.site_id}`
          }));
        setCriticalItems(urgent);
      } catch (error) {
        console.error("Failed to fetch critical stock");
      } finally {
        setLoading(false);
      }
    };
    fetchCriticalStock();
  }, []);

  const handleSendMessage = async (e?: React.FormEvent, overrideMessage?: string) => {
    e?.preventDefault();
    const textToSend = overrideMessage || inputMessage;
    if (!textToSend.trim()) return;

    // 1. Add User Message to UI
    const newUserMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: textToSend };
    setMessages(prev => [...prev, newUserMsg]);
    setInputMessage("");
    setIsTyping(true);

    try {
      // --- THE CONTEXT & AMNESIA FIX ---
      const historyTranscript = messages
        .slice(-6)
        .map(m => `${m.role === 'ai' ? 'AI Advisor' : 'Manager'}: ${m.content}`)
        .join('\n\n');
        
      // We inject a hidden system command telling the AI what sites this user controls!
      const siteContext = userSites.length > 0 
        ? `[SYSTEM ALERT: The user sending this message manages the following project site(s): ${userSites.join(', ')}. If they ask to procure a material but don't mention a specific site, ASSUME it is for their assigned site and DO NOT ask them to specify one.]\n\n`
        : '';

      const contextPayload = `${siteContext}--- RECENT CONVERSATION HISTORY ---\n${historyTranscript}\n\n--- CURRENT MESSAGE ---\nManager: ${textToSend}`;

      // 2. Send the contextual payload to the Backend API
      const response = await advisoryAPI.askAI(contextPayload);
      
      // 3. Add AI Response to UI
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: response.reply || "I encountered an error analyzing that request. Please try again."
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: "System Error: Unable to reach the AI API. Please verify your backend connection."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAskAboutItem = (item: Inventory & { siteName: string }) => {
    const prompt = `I have a ${item.status} shortage of ${item.item_name} at ${item.siteName} (Current stock: ${item.quantity} ${item.unit}). Based on our verified suppliers, who offers the best options for delivery?`;
    handleSendMessage(undefined, prompt);
  };

  useEffect(() => {
    if (location.state?.autoPromptItem) {
      const item = location.state.autoPromptItem;
      handleAskAboutItem(item);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to clear the AI context and session history?")) {
      const resetMessage: ChatMessage[] = [{
        id: "reset",
        role: "ai",
        content: "Session cleared. Neural context has been reset. How can I assist you with procurement today?"
      }];
      setMessages(resetMessage);
      localStorage.setItem(storageKey, JSON.stringify(resetMessage));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-8rem)] flex flex-col bg-slate-50 p-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-emerald-500" />
          AI Advisory Engine
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Interactive enterprise chatbot powered by live inventory data and crowdsourced supplier tracking.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* LEFT COLUMN: Critical Shortages */}
        <div className="lg:col-span-1 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-slate-800">Action Required</h2>
          </div>
          
          <div className="p-4 overflow-y-auto flex-1">
            {loading ? (
              <div className="text-sm text-slate-500 text-center py-8">Scanning ledger...</div>
            ) : criticalItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center h-full space-y-2 opacity-70">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
                <p className="text-sm font-medium text-emerald-800">All sites are healthy.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {criticalItems.map(item => (
                  <div key={item.id} className="p-4 border border-slate-200 rounded-xl hover:border-emerald-300 transition-colors bg-white shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-slate-900">{item.item_name}</h3>
                        <p className="text-xs text-slate-500">{item.siteName}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded border ${
                        item.status === "Critical" ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <button
                      onClick={() => handleAskAboutItem(item)}
                      className="w-full mt-3 py-2 bg-slate-50 text-slate-700 text-xs font-bold rounded-lg hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Source with AI
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: The Upgraded AI Chatbot Interface */}
        <div className="lg:col-span-2 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden relative">
          
          {/* Enterprise Status Bar */}
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
               <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                 <Database className="w-3.5 h-3.5" /> Live Data Sync: Active
               </span>
               <span className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                 <ShieldCheck className="w-3.5 h-3.5" /> Guardrails: Enabled
               </span>
            </div>
            <button 
              onClick={handleClearChat}
              className="flex items-center gap-1.5 text-slate-400 hover:text-red-500 transition-colors text-xs font-bold px-2 py-1 rounded hover:bg-red-50"
              title="Wipe AI memory and clear chat history"
            >
               <Trash2 className="w-3.5 h-3.5" /> Clear Session
            </button>
          </div>

          {/* Chat Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === "ai" ? "bg-emerald-100 text-emerald-600 border border-emerald-200" : "bg-slate-800 text-white"
                }`}>
                  {msg.role === "ai" ? <Activity className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                
                {/* Analytical Bubble Styling */}
                <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm shadow-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-slate-800 text-white rounded-tr-none"
                    : "bg-white border border-slate-200 text-slate-700 rounded-tl-none leading-relaxed font-medium"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-5 py-4 flex gap-1 items-center shadow-sm w-16">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Box */}
          <div className="p-4 bg-white border-t border-slate-200">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Query database or ask for procurement advice..."
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-xl outline-none transition-all text-sm font-medium"
                disabled={isTyping}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isTyping}
                className="px-5 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center shrink-0 shadow-sm font-bold"
              >
                <Send className="w-4 h-4 mr-2" /> Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return <Advisory />;
}