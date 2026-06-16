import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom"; // NEW: Imports for routing state
import { AlertTriangle, CheckCircle, Send, Bot, User, Sparkles } from "lucide-react";
import { inventoryAPI, advisoryAPI, sitesAPI } from "../../services/apiService";
import type { Inventory } from "../../types";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
}

export function Advisory() {
  const location = useLocation();
  const navigate = useNavigate();

  const [criticalItems, setCriticalItems] = useState<(Inventory & { siteName: string })[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "ai",
      content: "Hello! I am your MatTrack PRO Procurement Advisor. Click on an urgent item on the left, or ask me directly about our crowdsourced supplier options, pricing, or logistics.",
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
        const siteMap = new Map(sites.map(s => [s.id, s.site_name]));
        
        const urgent = inventory
          .filter(item => item.status === "Critical" || item.status === "Warning")
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
      // 2. Send to Backend API
      const response = await advisoryAPI.askAI(textToSend);
      
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
        content: "System Error: Unable to reach the AI API. Please verify your backend API keys are configured correctly."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // When clicking an item on the left (or passed via Router), auto-generate a prompt
  const handleAskAboutItem = (item: Inventory & { siteName: string }) => {
    const prompt = `I have a ${item.status} shortage of ${item.quantity} ${item.unit} of ${item.item_name} at ${item.siteName}. Based on our unlisted suppliers, who offers the best price and fastest delivery?`;
    handleSendMessage(undefined, prompt);
  };

  // NEW: Catch the passed state from Inventory.tsx
  useEffect(() => {
    if (location.state?.autoPromptItem) {
      const item = location.state.autoPromptItem;
      handleAskAboutItem(item);

      // Clear the state from the router history so it doesn't re-trigger on page refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-8rem)] flex flex-col">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-emerald-500" />
          AI Advisory Engine
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Interactive chatbot powered by live inventory data and crowdsourced supplier tracking.
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
                  <div key={item.id} className="p-4 border border-slate-200 rounded-xl hover:border-emerald-300 transition-colors bg-white">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-slate-900">{item.item_name}</h3>
                        <p className="text-xs text-slate-500">{item.siteName}</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        item.status === "Critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleAskAboutItem(item)}
                      className="w-full mt-3 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-emerald-50 hover:text-emerald-700 border border-transparent hover:border-emerald-200 transition-all flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-3 h-3" /> Ask AI to source this
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: The AI Chatbot Interface */}
        <div className="lg:col-span-2 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden relative">
          
          {/* Chat Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === "ai" ? "bg-emerald-100 text-emerald-600" : "bg-slate-800 text-white"
                }`}>
                  {msg.role === "ai" ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm shadow-sm ${
                  msg.role === "user" 
                    ? "bg-slate-800 text-white rounded-tr-none" 
                    : "bg-white border border-slate-200 text-slate-700 rounded-tl-none leading-relaxed"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5" />
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
                placeholder="Ask about materials, suppliers, or logistics..."
                className="flex-1 px-4 py-3 bg-slate-100 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-xl outline-none transition-all"
                disabled={isTyping}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isTyping}
                className="px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center shrink-0 shadow-sm"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}