import React, { useRef, useEffect } from "react";
import { X, Send, Bot, User, Activity, ShoppingCart, Sparkles } from "lucide-react";
import { transferAPI, requestsAPI, advisoryAPI } from "../../services/apiService";

export interface ChatMessage { id: string; role: "user" | "ai"; content: string; }

interface AiChatbotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  inputMessage: string;
  setInputMessage: (msg: string) => void;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  userRole: string;
  userSiteId: number;
}

export function AiChatbotDrawer({
  isOpen, onClose, messages, setMessages, inputMessage, setInputMessage, isTyping, setIsTyping, userRole, userSiteId
}: AiChatbotDrawerProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [messages, isTyping, isOpen]);

  const handleSendMessage = async (e?: React.FormEvent, overrideMessage?: string) => {
    e?.preventDefault();
    const textToSend = overrideMessage || inputMessage;
    if (!textToSend.trim()) return;

    const newUserMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: textToSend };
    setMessages((prev) => [...prev, newUserMsg]);
    setInputMessage("");
    setIsTyping(true);

    try {
      const historyTranscript = messages.slice(-6).map((m) => `${m.role === "ai" ? "Advisor" : "Manager"}: ${m.content}`).join("\n\n");
      const siteContext = `[SYSTEM ALERT: The user sending this message manages site ID: ${userSiteId}.]\n\n`;
      const contextPayload = `${siteContext}--- RECENT CONVERSATION HISTORY ---\n${historyTranscript}\n\n--- CURRENT MESSAGE ---\nManager: ${textToSend}`;
      
      const response = await advisoryAPI.chat(contextPayload, []);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "ai", content: response.reply || "Error analyzing request." }]);
    } catch (error) {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "ai", content: "System Error: Unable to reach the API." }]);
    } finally { 
      setIsTyping(false); 
    }
  };

  const handleLogisticsAction = async (sourceId: string, itemName: string, brand: string, qty: string, unit: string) => {
    const isAdmin = ["admin", "owner"].includes(userRole);
    if (isAdmin) {
      if (!window.confirm(`SECURITY VERIFICATION:\n\nDispatch ${qty} ${unit} of ${itemName} from Site ${sourceId} to your location?`)) return;
      try {
        setIsTyping(true);
        await transferAPI.initiate({ source_site_id: Number(sourceId), destination_site_id: userSiteId, item_name: itemName.trim(), brand: brand.trim(), quantity: Number(qty), unit: unit.trim() });
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: "ai", content: `✅ Transfer initiated! Logistics network alerted to move ${qty} ${unit} of ${itemName}.` }]);
      } catch (error: any) { alert(error.message || "Transfer failed."); } finally { setIsTyping(false); }
    } else {
      if (!window.confirm(`REQUEST VERIFICATION:\n\nSubmit official request to Admin for ${qty} ${unit} of ${itemName}?`)) return;
      try {
        setIsTyping(true);
        await requestsAPI.create({ item_name: itemName.trim(), brand: brand.trim(), quantity_needed: Number(qty), unit: unit.trim(), site_id: userSiteId, status: "Pending Approval" });
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: "ai", content: `✅ Material Request successfully submitted to Admin queue.` }]);
      } catch (error: any) { alert(error.message || "Failed to submit request."); } finally { setIsTyping(false); }
    }
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9998]" onClick={onClose} />}
      
      <div className={`fixed inset-y-0 right-0 w-full md:w-[450px] bg-slate-50 shadow-2xl z-[9999] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        
        <div className="flex items-center justify-between p-4 bg-slate-900 text-white shadow-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-400/30">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">AI Advisory</h2>
              <p className="text-[10px] text-slate-400">Enterprise Procurement Intelligence</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === "ai" ? "bg-emerald-100 text-emerald-600 border border-emerald-200" : "bg-slate-800 text-white"}`}>
                {msg.role === "ai" ? <Activity className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-slate-800 text-white rounded-tr-none" : "bg-white border border-slate-200 text-slate-700 rounded-tl-none leading-relaxed font-medium"}`}>
                {(() => {
                  const transferRegex = /\[TRANSFER:\s*(\d+)\s*:\s*([^:]+)\s*:\s*([^:]+)\s*:\s*(\d+(?:\.\d+)?)\s*:\s*([^\]]+)\s*\]/;
                  const match = msg.content.match(transferRegex);
                  if (match) {
                    const [fullCommand, siteId, itemName, brand, qty, unit] = match;
                    const cleanText = msg.content.replace(fullCommand, "");
                    return (
                      <div className="flex flex-col">
                        <span className="mb-2 block">{cleanText.trim()}</span>
                        {msg.role === "ai" && (
                          <button onClick={() => handleLogisticsAction(siteId, itemName, brand, qty, unit)} className={`w-full mt-2 text-white font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 ${["admin", "owner"].includes(userRole) ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"}`}>
                            {["admin", "owner"].includes(userRole) ? (<><Send className="w-4 h-4" /> Dispatch {qty} {unit}</>) : (<><ShoppingCart className="w-4 h-4" /> Request {qty} {unit}</>)}
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
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0"><Bot className="w-3.5 h-3.5" /></div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1 items-center shadow-sm w-14">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div><div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div><div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-slate-200 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} placeholder="Ask in Taglish (e.g. May buhangin ba sa odnot?)" className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-xl outline-none transition-all text-sm font-medium" disabled={isTyping} />
            <button type="submit" disabled={!inputMessage.trim() || isTyping} className="w-12 h-12 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center shrink-0 shadow-sm">
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>

      </div>
    </>
  );
}