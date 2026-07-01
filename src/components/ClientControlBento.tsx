import React, { useMemo } from "react";
import { Users, DollarSign, MapPin, Layers } from "lucide-react";
import { Order } from "../types";

interface ClientControlBentoProps {
  orders: Order[];
  language?: "en" | "pt";
  onViewSubTab: (subTab: "directory" | "prices" | "delivery" | "categories") => void;
}

export default function ClientControlBento({ orders, language = "en", onViewSubTab }: ClientControlBentoProps) {
  // Calculate unique clients
  const clientStats = useMemo(() => {
    const clientsMap: Record<string, { count: number; totalSpent: number }> = {};
    orders.forEach((ord) => {
      if (!ord.customerName) return;
      const key = ord.customerName.trim().toLowerCase();
      const current = clientsMap[key] || { count: 0, totalSpent: 0 };
      clientsMap[key] = {
        count: current.count + 1,
        totalSpent: current.totalSpent + (Number(ord.total) || 0)
      };
    });
    return {
      totalClients: Object.keys(clientsMap).length
    };
  }, [orders]);

  return (
    <div id="bento-client-control" className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-4">
      {/* Bento Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              {language === "pt" ? "Controle do Site" : "Site Control"}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {language === "pt" 
                ? "Painel de controle do site de vendas: clientes, preços e entrega"
                : "Manage web storefront: customers directory, item pricing & delivery fees"}
            </p>
          </div>
        </div>

        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          {clientStats.totalClients} {language === "pt" ? "Clientes" : "Clients"}
        </span>
      </div>

      {/* 4 custom buttons instead of 1 general button */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Customer Directory */}
        <button
          onClick={() => onViewSubTab("directory")}
          className="bg-slate-50 hover:bg-indigo-50/70 text-slate-800 hover:text-indigo-700 font-bold text-xs py-3.5 px-4 rounded-xl border border-slate-200/50 hover:border-indigo-250 transition-all cursor-pointer flex items-center justify-between group/btn"
        >
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400 group-hover/btn:text-indigo-500 shrink-0" />
            <span>{language === "pt" ? "Base de Clientes" : "Customer Directory"}</span>
          </span>
          <span className="text-[10px] text-indigo-600 opacity-40 group-hover/btn:opacity-100">
            →
          </span>
        </button>

        {/* Items Price */}
        <button
          onClick={() => onViewSubTab("prices")}
          className="bg-slate-50 hover:bg-indigo-50/70 text-slate-800 hover:text-indigo-700 font-bold text-xs py-3.5 px-4 rounded-xl border border-slate-200/50 hover:border-indigo-250 transition-all cursor-pointer flex items-center justify-between group/btn"
        >
          <span className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-400 group-hover/btn:text-indigo-500 shrink-0" />
            <span>{language === "pt" ? "Preço dos Itens" : "Items Price"}</span>
          </span>
          <span className="text-[10px] text-indigo-600 opacity-40 group-hover/btn:opacity-100">
            →
          </span>
        </button>

        {/* Delivery Fees */}
        <button
          onClick={() => onViewSubTab("delivery")}
          className="bg-slate-50 hover:bg-indigo-50/70 text-slate-800 hover:text-indigo-700 font-bold text-xs py-3.5 px-4 rounded-xl border border-slate-200/50 hover:border-indigo-250 transition-all cursor-pointer flex items-center justify-between group/btn"
        >
          <span className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400 group-hover/btn:text-indigo-500 shrink-0" />
            <span>{language === "pt" ? "Taxas de Entrega" : "Delivery Fees"}</span>
          </span>
          <span className="text-[10px] text-indigo-600 opacity-40 group-hover/btn:opacity-100">
            →
          </span>
        </button>

        {/* Category Order */}
        <button
          onClick={() => onViewSubTab("categories")}
          className="bg-slate-50 hover:bg-indigo-50/70 text-slate-800 hover:text-indigo-700 font-bold text-xs py-3.5 px-4 rounded-xl border border-slate-200/50 hover:border-indigo-250 transition-all cursor-pointer flex items-center justify-between group/btn"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400 group-hover/btn:text-indigo-500 shrink-0" />
            <span>{language === "pt" ? "Ordem das Categorias" : "Category Order"}</span>
          </span>
          <span className="text-[10px] text-indigo-600 opacity-40 group-hover/btn:opacity-100">
            →
          </span>
        </button>
      </div>
    </div>
  );
}
