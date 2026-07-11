import React, { useState } from "react";
import { Star, Truck, ShieldCheck, AlertCircle, Filter, ArrowLeft } from "lucide-react";

export function RestockSidebar({ options, onClose, onExecute, userRole, onHoverOption, onLeaveOption }: any) {
  const [activeFilter, setActiveFilter] = useState<"ALL" | "INTERNAL" | "TRUSTED">("ALL");

  if (!options || options.length === 0) return null;

  const isAdmin = ["admin", "owner"].includes(userRole);

  const filteredOptions = options.filter((opt: any) => {
    if (activeFilter === "INTERNAL") return opt.type === "INTERNAL_TRANSFER";
    if (activeFilter === "TRUSTED") return opt.rating >= 4.0 || opt.type === "INTERNAL_TRANSFER";
    return true;
  });

  return (
    <div className="flex flex-col h-full w-full bg-white animate-in slide-in-from-left-4 duration-300">
      
      {/* HEADER WITH BACK BUTTON */}
      <div className="p-4 border-b border-neutral-200 bg-slate-900 text-white shrink-0">
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xs font-bold mb-3 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Map Filters
        </button>
        <h2 className="text-lg font-bold">Routing Options</h2>
        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
          {isAdmin ? "Compare cost vs. reliability." : "Suggest to the Secretary for approval."}
        </p>
      </div>

      {/* COMPACT SIDEBAR FILTERS */}
      <div className="bg-neutral-50 p-3 border-b border-neutral-200 flex flex-wrap gap-2 shrink-0">
        <button onClick={() => setActiveFilter("ALL")} className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all flex-1 ${activeFilter === "ALL" ? "bg-slate-800 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100"}`}>
          All Options
        </button>
        <button onClick={() => setActiveFilter("INTERNAL")} className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all flex-1 flex items-center justify-center gap-1 ${activeFilter === "INTERNAL" ? "bg-violet-600 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:bg-violet-50"}`}>
          <Truck className="w-3 h-3" /> Internal
        </button>
        <button onClick={() => setActiveFilter("TRUSTED")} className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all w-full flex items-center justify-center gap-1 ${activeFilter === "TRUSTED" ? "bg-emerald-600 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:bg-emerald-50"}`}>
          <ShieldCheck className="w-3 h-3" /> Verified Trusted (4★+)
        </button>
      </div>

      {/* SCROLLABLE LIST OF OPTIONS (Redesigned for vertical sidebar) */}
      <div className="p-3 overflow-y-auto flex-1 space-y-3 bg-neutral-100">
        {filteredOptions.length === 0 ? (
          <div className="text-center py-6 text-neutral-500 text-xs font-medium">No options match this filter.</div>
        ) : (
          filteredOptions.map((opt: any, index: number) => (
            <div 
              key={index} 
              onMouseEnter={() => onHoverOption && onHoverOption(opt)}
              onMouseLeave={() => onLeaveOption && onLeaveOption()}
              className={`p-4 rounded-xl border bg-white shadow-sm flex flex-col gap-2 transition-all hover:shadow-md cursor-pointer ${
                  index === 0 && activeFilter === "ALL" ? "border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/10" : "border-neutral-200 hover:border-blue-400"
              }`}
            >
              <div>
                <h3 className="font-bold text-neutral-800 text-sm leading-tight">{opt.source_name}</h3>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {opt.type === "INTERNAL_TRANSFER" ? (
                    <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-[9px] font-bold rounded flex items-center gap-1">
                      <Truck className="w-2.5 h-2.5" /> {opt.trust_badge || "Surplus"}
                    </span>
                  ) : (
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded flex items-center gap-1 ${opt.rating >= 4.0 ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-600"}`}>
                      {opt.rating >= 4.0 ? <ShieldCheck className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />} {opt.trust_badge || "Supplier"}
                    </span>
                  )}
                  <div className="flex items-center">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-[10px] font-bold text-neutral-700 ml-0.5">{opt.rating ? opt.rating.toFixed(1) : "5.0"}</span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-neutral-500 line-clamp-2">{opt.recommendation_reason}</p>
              
              <div className="flex justify-between items-end pt-3 mt-1 border-t border-neutral-100">
                <div>
                  <p className="text-[9px] text-neutral-400 font-bold uppercase">Total Cost</p>
                  <p className={`text-lg font-black leading-none ${index === 0 && activeFilter === "ALL" ? "text-emerald-600" : "text-slate-800"}`}>
                    ₱{opt.estimated_total_cost.toLocaleString()}
                  </p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onExecute(opt); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg shadow-sm transition-all ${!isAdmin ? "bg-slate-800 hover:bg-slate-900 text-white" : opt.type === "INTERNAL_TRANSFER" ? "bg-violet-600 hover:bg-violet-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                >
                  {!isAdmin ? "Request" : (opt.type === "INTERNAL_TRANSFER" ? "Dispatch" : "Buy")}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}