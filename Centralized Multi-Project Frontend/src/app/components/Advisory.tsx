import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Send,
  Bot,
  User,
  Sparkles,
  Database,
  ShieldCheck,
  Trash2,
  Activity,
  HelpCircle
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { transferAPI } from "../../services/apiService";

const BASE_URL = `http://${window.location.hostname}:8000`;

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const token =
    localStorage.getItem("token") || localStorage.getItem("access_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
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
  list: () => fetchAPI<Inventory[]>("/inventory/"),
};

const sitesAPI = {
  list: () => fetchAPI<any[]>("/sites/"),
};

const advisoryAPI = {
  askAI: (message: string) =>
    fetchAPI<{ reply: string }>("/advisory/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
}

// --- PANELIST FIX #2: Clickable FAQ Chips ---
const FAQ_PROMPTS = [
  "Where is our surplus Portland Cement located across all sites?",
  "Draft a pull requisition for 100 pcs of 12mm Rebar.",
  "Ano ang estimated market price ng buhangin (sand) ngayon?",
  "Analyze current network shortages and recommend actions."
];

export function Advisory() {
  const location = useLocation();
  const navigate = useNavigate();

  const [criticalItems, setCriticalItems] = useState<
    (Inventory & { siteName: string })[]
  >([]);
  const [userSites, setUserSites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const token =
    localStorage.getItem("token") || localStorage.getItem("access_token");
  let currentUserId = "default";
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
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
        content:
          "System Online. I am your MatTrack PRO Logistics & Procurement Advisor. I accept English, Tagalog, or Taglish terminology (e.g., 'buhangin', 'kabilya'). Click an FAQ below or type a query to check surplus ledgers, external supplier ratings, or real-time hardware market baselines.",
      },
    ];
  });

  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    const fetchCriticalStock = async () => {
      setLoading(true);
      try {
        const [inventory, sites] = await Promise.all([
          inventoryAPI.list(),
          sitesAPI.list(),
        ]);

        const siteNames = sites.map((s) => s.site_name);
        setUserSites(siteNames);

        const siteMap = new Map(sites.map((s) => [s.id, s.site_name]));

        const urgent = inventory
          .filter(
            (item) => item.status === "Critical" || item.status === "Low Stock",
          )
          .map((item) => ({
            ...item,
            siteName: siteMap.get(item.site_id) || `Site ${item.site_id}`,
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

  const handleSendMessage = async (
    e?: React.FormEvent,
    overrideMessage?: string,
  ) => {
    e?.preventDefault();
    const textToSend = overrideMessage || inputMessage;
    if (!textToSend.trim()) return;

    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
    };
    setMessages((prev) => [...prev, newUserMsg]);
    setInputMessage("");
    setIsTyping(true);

    try {
      const historyTranscript = messages
        .slice(-6)
        .map(
          (m) => `${m.role === "ai" ? "AI Advisor" : "Manager"}: ${m.content}`,
        )
        .join("\n\n");

      const siteContext =
        userSites.length > 0
          ? `[SYSTEM ALERT: The user sending this message manages the following project site(s): ${userSites.join(", ")}. If they ask to procure a material but don't mention a specific site, ASSUME it is for their assigned site.]\n\n`
          : "";

      const contextPayload = `${siteContext}--- RECENT CONVERSATION HISTORY ---\n${historyTranscript}\n\n--- CURRENT MESSAGE ---\nManager: ${textToSend}`;

      const response = await advisoryAPI.askAI(contextPayload);

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content:
            response.reply ||
            "I encountered an error analyzing that request. Please try again.",
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content:
            "System Error: Unable to reach the AI API. Please verify your backend connection.",
        },
      ]);
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

  const executeTransfer = async (
    sourceId: string,
    item: string,
    brand: string,
    qty: string,
    unit: string,
  ) => {
    const isConfirmed = window.confirm(
      `SECURITY VERIFICATION:\n\nAre you sure you want to dispatch ${qty} ${unit} of ${item} from Site ${sourceId} to your location?`,
    );

    if (!isConfirmed) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "ai",
          content: `❌ Transfer request aborted by user.`,
        },
      ]);
      return;
    }

    try {
      setIsTyping(true);
      await transferAPI.initiate({
        source_site_id: Number(sourceId),
        destination_site_id: 1,
        item_name: item.trim(),
        brand: brand.trim(),
        quantity: Number(qty),
        unit: unit.trim(),
      });

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "ai",
          content: `✅ Transfer initiated! Logistics network alerted to move ${qty} ${unit} of ${item} (${brand}) from Site ${sourceId}. It is now awaiting receipt at the destination.`,
        },
      ]);
    } catch (error) {
      alert("Failed to execute AI transfer command. Check backend logs.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = () => {
    if (
      window.confirm(
        "Are you sure you want to clear the AI context and session history?",
      )
    ) {
      const resetMessage: ChatMessage[] = [
        {
          id: "reset",
          role: "ai",
          content:
            "Session cleared. Neural context reset. I accept Taglish queries and real-time market sourcing. How can I assist?",
        },
      ];
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
          Bilingual enterprise chatbot powered by live inventory data, supplier tracking, and market grounding.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-1 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-slate-800">Action Required</h2>
          </div>

          <div className="p-4 overflow-y-auto flex-1">
            {loading ? (
              <div className="text-sm text-slate-500 text-center py-8">
                Scanning ledger...
              </div>
            ) : criticalItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center h-full space-y-2 opacity-70">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
                <p className="text-sm font-medium text-emerald-800">
                  All sites are optimal & in stock.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {criticalItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 border border-slate-200 rounded-xl hover:border-emerald-300 transition-colors bg-white shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {item.item_name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {item.siteName}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded border ${
                          item.status === "Critical"
                            ? "bg-red-50 border-red-200 text-red-700"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                        }`}
                      >
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

        <div className="lg:col-span-2 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden relative">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                <Database className="w-3.5 h-3.5" /> Live Data Sync: Active
              </span>
              <span className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                <ShieldCheck className="w-3.5 h-3.5" /> Taglish NLP: Enabled
              </span>
            </div>
            <button
              onClick={handleClearChat}
              className="flex items-center gap-1.5 text-slate-400 hover:text-red-500 transition-colors text-xs font-bold px-2 py-1 rounded hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Session
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === "ai"
                      ? "bg-emerald-100 text-emerald-600 border border-emerald-200"
                      : "bg-slate-800 text-white"
                  }`}
                >
                  {msg.role === "ai" ? (
                    <Activity className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm shadow-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-slate-800 text-white rounded-tr-none"
                      : "bg-white border border-slate-200 text-slate-700 rounded-tl-none leading-relaxed font-medium"
                  }`}
                >
                  {(() => {
                    const transferRegex =
                      /\[TRANSFER:\s*(\d+)\s*:\s*([^:]+)\s*:\s*([^:]+)\s*:\s*(\d+(?:\.\d+)?)\s*:\s*([^\]]+)\s*\]/;
                    const match = msg.content.match(transferRegex);

                    if (match) {
                      const [fullCommand, siteId, itemName, brand, qty, unit] =
                        match;
                      const cleanText = msg.content.replace(fullCommand, "");

                      return (
                        <div className="flex flex-col">
                          <span className="mb-3 block">{cleanText.trim()}</span>
                          {msg.role === "ai" && (
                            <button
                              onClick={() =>
                                executeTransfer(
                                  siteId,
                                  itemName,
                                  brand,
                                  qty,
                                  unit,
                                )
                              }
                              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
                            >
                              <Send className="w-4 h-4" /> Dispatch {qty} {unit}{" "}
                              of {itemName} from Site {siteId}
                            </button>
                          )}
                        </div>
                      );
                    }
                    return <span>{msg.content}</span>;
                  })()}
                </div>
              </div>
            ))}

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

          {/* PANELIST FIX #2: Clickable Quick Prompt FAQ Chips */}
          <div className="px-4 py-2 bg-slate-100/80 border-t border-slate-200 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-bold text-slate-500 shrink-0 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-600" /> Suggested Prompts:
            </span>
            {FAQ_PROMPTS.map((promptText, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(undefined, promptText)}
                disabled={isTyping}
                className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-700 hover:border-emerald-500 hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
              >
                {promptText}
              </button>
            ))}
          </div>

          <div className="p-4 bg-white border-t border-slate-200">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask in English or Taglish (e.g., 'Sino supplier ng kabilya?')..."
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