import { useState, useEffect, useRef } from "react";
import { 
  ShoppingBag, 
  Sliders, 
  AlertCircle, 
  RotateCcw,
  Activity,
  RefreshCw
} from "lucide-react";
import { formatCurrency } from "../utils";
import type { Order } from "../types";
import { updateAmoOrderStatusViaApi } from "../amoOrders";

interface OrdersBentoProps {
  language: "en" | "pt";
  onConfigure: (channelKey?: string) => void;
}

export default function OrdersBento({ language, onConfigure }: OrdersBentoProps) {
  // Read state from LocalStorage so it's fully shared and persistent
  const [integrations, setIntegrations] = useState<Record<string, boolean>>({
    ifood: true,
    amo: false,
    "99food": false,
    website: true
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedChannelForPopup, setSelectedChannelForPopup] = useState<{
    key: string;
    name: string;
    color: string;
    hover: string;
    border: string;
    text: string;
    desc: string;
  } | null>(null);

  // Keep track of flashing state for active integrations receiving new orders (especially AMO)
  const [flashingChannels, setFlashingChannels] = useState<Record<string, boolean>>({});
  const prevOrdersRef = useRef<Order[]>([]);

  // Sync / retrieve state on mount and keep sync on storage event
  useEffect(() => {
    const handleSync = () => {
      try {
        const savedInts = localStorage.getItem("orders_integrations");
        if (savedInts) {
          setIntegrations(current => {
            const parsed = JSON.parse(savedInts);
            if (JSON.stringify(current) === JSON.stringify(parsed)) {
              return current;
            }
            return parsed;
          });
        }
      } catch {}

      try {
        const savedOrders = localStorage.getItem("orders_list");
        if (savedOrders) {
          setOrders(current => {
            const parsed = JSON.parse(savedOrders);
            if (JSON.stringify(current) === JSON.stringify(parsed)) {
              return current;
            }
            return parsed;
          });
        }
      } catch {}
    };

    handleSync();
    window.addEventListener("storage", handleSync);
    return () => window.removeEventListener("storage", handleSync);
  }, []);

  // Detect when new orders are added to any channel (especially AMO) and trigger the flashing yellow effect
  useEffect(() => {
    const prevOrders = prevOrdersRef.current;
    if (prevOrders && prevOrders.length > 0) {
      const prevIds = new Set(prevOrders.map(o => o.id));
      const newOrders = orders.filter(o => !prevIds.has(o.id));
      if (newOrders.length > 0) {
        const nextFlash: Record<string, boolean> = {};
        newOrders.forEach(o => {
          nextFlash[o.channel] = true;
        });
        setFlashingChannels(prev => ({ ...prev, ...nextFlash }));
        const timer = setTimeout(() => {
          setFlashingChannels({});
        }, 5000); // Pulse gold for 5 seconds to draw high attention
        return () => clearTimeout(timer);
      }
    }
    prevOrdersRef.current = orders;
  }, [orders]);

  const [isFetchingAmo, setIsFetchingAmo] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const pollAmoOrdersFromApi = async (isManualClick = false) => {
    if (!integrations.amo) {
      if (isManualClick) {
        showToast(
          language === "pt"
            ? "A integração AMO precisa estar ativa para buscar pedidos!"
            : "AMO integration must be active to fetch orders!"
        );
      }
      return;
    }

    let apiBaseUrl = "https://api.uat.amo.delivery";
    let clientId = "";
    let clientSecret = "";

    try {
      const savedConfigs = localStorage.getItem("orders_channel_configs");
      if (savedConfigs) {
        const parsed = JSON.parse(savedConfigs);
        if (parsed.amo) {
          apiBaseUrl = parsed.amo.apiBaseUrl || "https://api.uat.amo.delivery";
          clientId = parsed.amo.clientId || "";
          clientSecret = parsed.amo.clientSecret || "";
        }
      }
    } catch (err) {
      console.warn("Could not read orders_channel_configs:", err);
    }

    if (!clientId || !clientSecret) {
      if (isManualClick) {
        showToast(
          language === "pt"
            ? "Configure as credenciais do AMO (Client ID e Client Secret) na página de Integração."
            : "Please configure AMO credentials (Client ID and Secret) in Integrations."
        );
      } else {
        console.log("AMO standard credentials (Client ID / Client Secret) are not yet configured. Skipping 30s poll.");
      }
      return;
    }

    setIsFetchingAmo(true);
    try {
      const response = await fetch("/api/amo/poll-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          apiBaseUrl,
          clientId,
          clientSecret
        })
      });

      if (!response.ok) {
        console.warn("Poll requests failed with status code " + response.status);
        if (isManualClick) {
          showToast(
            language === "pt"
              ? `A busca falhou com o status ${response.status}`
              : `Fetch failed with status ${response.status}`
          );
        }
        return;
      }

      const data = await response.json();
      if (data.success) {
        const apiOrders: Order[] = Array.isArray(data.orders) ? data.orders : [];
        const prevAmoCount = orders.filter(o => o.channel === "amo").length;

        setOrders(prev => {
          const nonAmo = prev.filter(o => o.channel !== "amo");
          const updated = [...apiOrders, ...nonAmo];
          localStorage.setItem("orders_list", JSON.stringify(updated));

          setTimeout(() => {
            window.dispatchEvent(new Event("storage"));
          }, 10);

          return updated;
        });

        if (isManualClick) {
          showToast(
            language === "pt"
              ? `Sincronizado: ${apiOrders.length} pedido(s) AMO carregado(s) da API.`
              : `Synced: ${apiOrders.length} AMO order(s) loaded from the API.`
          );
        } else if (apiOrders.length > prevAmoCount) {
          const newlyAddedCount = apiOrders.length - prevAmoCount;
          showToast(
            language === "pt"
              ? `[API] ${newlyAddedCount} novo(s) pedido(s) AMO recebido(s)!`
              : `[API] ${newlyAddedCount} new AMO order(s) received!`
          );
        }
      } else {
        if (isManualClick) {
          showToast(
            language === "pt"
              ? `Erro: ${data.message || "Falha desconhecida"}`
              : `Error: ${data.message || "Unknown failure"}`
          );
        }
      }
    } catch (e: any) {
      console.error("Pipeline failure in manual/polling:", e.message);
      if (isManualClick) {
        const isFailedToFetch = String(e.message || "").toLowerCase().includes("failed to fetch");
        const msgPt = isFailedToFetch 
          ? "Falha na conexão de rede (seu dispositivo parece estar offline ou a API local está indisponível)." 
          : `Erro de conexão: ${e.message}`;
        const msgEn = isFailedToFetch 
          ? "Network connection failure (your device seems to be offline or local API server is unreachable)." 
          : `Connection error: ${e.message}`;
        showToast(language === "pt" ? msgPt : msgEn);
      }
    } finally {
      setIsFetchingAmo(false);
    }
  };

  // Automatically poll/receive new requests via AMO API every 30 seconds when AMO is active on the homepage
  useEffect(() => {
    if (!integrations.amo) return;

    pollAmoOrdersFromApi(false);

    const interval = setInterval(() => {
      pollAmoOrdersFromApi(false);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [integrations.amo, language]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleResetSimulatedOrders = () => {
    if (confirm(language === "pt" ? "Deseja redefinir os pedidos simulados?" : "Reset simulated orders?")) {
      setOrders([]);
      localStorage.setItem("orders_list", JSON.stringify([]));
      showToast(language === "pt" ? "Banco de pedidos redefinido!" : "Orders database reset!");
      
      // Dispatch a storage update event for other screens
      window.dispatchEvent(new Event("storage"));
    }
  };

  const handleUpdateStatus = async (order: Order, nextStatus: Order["status"]) => {
    if (order.channel === "amo") {
      setUpdatingOrderId(order.id);
      try {
        const result = await updateAmoOrderStatusViaApi(order, nextStatus);
        if (!result.success || !result.order) {
          showToast(
            language === "pt"
              ? `Falha ao atualizar pedido: ${result.message || "Erro desconhecido"}`
              : `Failed to update order: ${result.message || "Unknown error"}`
          );
          return;
        }

        const updated = orders.map(o => (o.id === order.id ? result.order! : o));
        setOrders(updated);
        localStorage.setItem("orders_list", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));

        showToast(
          language === "pt"
            ? `Pedido ${order.id} atualizado na API AMO (${result.order.status}).`
            : `Order ${order.id} updated on AMO API (${result.order.status}).`
        );
      } catch (err: any) {
        showToast(
          language === "pt"
            ? `Erro de rede ao atualizar pedido: ${err.message}`
            : `Network error updating order: ${err.message}`
        );
      } finally {
        setUpdatingOrderId(null);
      }
      return;
    }

    const updated = orders.map(o => (o.id === order.id ? { ...o, status: nextStatus } : o));
    setOrders(updated);
    localStorage.setItem("orders_list", JSON.stringify(updated));
    window.dispatchEvent(new Event("storage"));

    showToast(
      language === "pt"
        ? `Pedido ${order.id} atualizado para: ${nextStatus === "preparing" ? "Em preparo" : nextStatus === "cancelled" ? "Cancelado" : nextStatus}`
        : `Order ${order.id} status set to: ${nextStatus}`
    );
  };

  const getChannelOrders = (channelKey: string) => {
    const list = orders.filter(o => o.channel === channelKey);
    // Sort "pending" orders to the very top, and then sort by time descending (latest first)
    return [...list].sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return b.time.localeCompare(a.time);
    });
  };

  const INT_CHANNELS = [
    { key: "ifood", name: "iFood", color: "bg-[#EA1D2C]", hover: "hover:bg-[#EA1D2C]/10", border: "border-[#EA1D2C]/25", text: "text-[#EA1D2C]", desc: "iFood Delivery Portal" },
    { key: "amo", name: "AMO", color: "bg-[#FF5C00]", hover: "hover:bg-[#FF5C00]/10", border: "border-[#FF5C00]/25", text: "text-[#FF5C00]", desc: "AMO Delivery App" },
    { key: "99food", name: "99Food", color: "bg-[#FFAA00]", hover: "hover:bg-[#FFAA00]/10", border: "border-[#FFAA00]/25", text: "text-[#FFAA00]", desc: "99Food Platform" },
    { key: "website", name: "Website", color: "bg-[#4F46E5]", hover: "hover:bg-[#4F46E5]/10", border: "border-[#4F46E5]/25", text: "text-[#4F46E5]", desc: "Direct Web Store Storefront" },
  ];

  const activeCount = Object.values(integrations).filter(Boolean).length;

  return (
    <div className="col-span-full bg-white rounded-3xl border border-slate-100 p-6 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden select-none animate-fade-in space-y-5">
      
      {/* Decorative gradient accents */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-emerald-50/30 rounded-full blur-2xl pointer-events-none" />

      {/* Bento Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="bg-gradient-to-tr from-violet-600 to-indigo-500 p-3 rounded-2xl border border-indigo-100 text-white shadow-xs shrink-0 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                {language === "pt" ? "Gestão de Integrações & Pedidos" : "Orders & Deliveries Control"}
              </h2>
              <span className="font-mono text-[9px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-100/40 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {language === "pt" 
                ? `${activeCount} Canais Conectados` 
                : `${activeCount} Active Connection Channels`}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {integrations.amo && (
            <button
              id="amo-force-fetch-btn"
              onClick={() => pollAmoOrdersFromApi(true)}
              disabled={isFetchingAmo}
              className={`px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:bg-amber-300 text-white font-extrabold text-[11px] rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5 ${isFetchingAmo ? "animate-pulse" : ""}`}
              title={language === "pt" ? "Buscar pedidos do serviço AMO agora" : "Force Fetch AMO orders now"}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetchingAmo ? "animate-spin" : ""}`} />
              <span>{language === "pt" ? "Sincronizar AMO" : "Force Fetch Now"}</span>
            </button>
          )}

          {orders.length > 0 && (
            <button
              onClick={handleResetSimulatedOrders}
              className="px-2.5 py-1.5 border border-slate-100 hover:bg-slate-50 hover:border-slate-200 text-slate-400 hover:text-slate-600 active:bg-slate-100 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
              title="Reset order simulator entries"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {language === "pt" ? "Reiniciar" : "Reset Data"}
            </button>
          )}

          {/* Configuration Integration Button - Opens the Integrations Page */}
          <button
            id="configure-integrations-btn"
            onClick={() => onConfigure()}
            className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center gap-2 relative z-15"
          >
            <Sliders className="w-4 h-4" />
            <span>{language === "pt" ? "Integração" : "Integration"}</span>
          </button>
        </div>
      </div>

      {/* Interactive Channel Buttons Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10 w-full">
        {INT_CHANNELS.map(ch => {
          const isActive = !!integrations[ch.key];
          const chanOrders = getChannelOrders(ch.key);
          const totalRevenue = chanOrders.reduce((sum, o) => sum + o.total, 0);

          return (
            <div
              key={ch.key}
              onClick={() => {
                if (isActive) {
                  setSelectedChannelForPopup(ch);
                } else {
                  showToast(
                    language === "pt" 
                      ? `${ch.name} está inativo. Clique em 'Integração' acima para ativar!` 
                      : `${ch.name} is inactive. Click 'Integration' above to active!`
                  );
                }
              }}
              className={`p-4 rounded-2xl border text-left transition-all duration-300 relative select-none cursor-pointer flex flex-col justify-between min-h-[115px] group overflow-hidden ${
                flashingChannels[ch.key]
                  ? "bg-yellow-50 border-yellow-400 ring-4 ring-yellow-400/30 shadow-md scale-[1.03] animate-pulse"
                  : isActive
                  ? `bg-white border-slate-100 shadow-2xs hover:shadow-xs translate-y-0 active:translate-y-0.5 hover:border-slate-300 ${ch.hover}`
                  : "bg-slate-50/50 border-slate-200 border-dashed opacity-50 cursor-not-allowed"
              }`}
            >
              {/* Internal abstract hover accent lines */}
              {isActive && (
                <div className={`absolute top-0 left-0 w-1 h-full ${ch.color}`} />
              )}

              {/* Top part block */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 pr-1">
                  <span className={`text-[10px] font-bold tracking-tight uppercase px-1.5 py-0.5 rounded-md ${
                    isActive ? `${ch.color}/10 ${ch.text}` : "bg-slate-100 text-slate-400"
                  }`}>
                    {ch.name}
                  </span>
                </div>

                <div className={`w-2.5 h-2.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-300 border border-slate-400/20"}`} />
              </div>

              {/* Bottom part status & orders count */}
              <div className="mt-2 pt-2 border-t border-slate-100/50 flex flex-col justify-end">
                {isActive ? (
                  <div className="space-y-1.5 text-right w-full">
                    <h4 className="text-sm font-black text-slate-800 leading-none font-mono">
                      {chanOrders.length} {language === "pt" ? "pedidos" : "orders"}
                    </h4>
                    <div className="border-t border-slate-100/50" />
                    <div className="flex justify-end">
                      <span className="inline-block text-xs font-mono font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                        {formatCurrency(totalRevenue)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 italic">
                    <AlertCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    <span>{language === "pt" ? "Canal Inativo" : "Inactive Channel"}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Inline brief absolute toast message banner inside bento card */}
      {toastMessage && (
        <div className="md:absolute md:bottom-6 md:right-6 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-800 p-3 flex items-center gap-2.5 text-xs font-semibold z-45 animate-fade-in-up">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white ml-1 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Orders Popup Modal */}
      {selectedChannelForPopup && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setSelectedChannelForPopup(null)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-slate-100 overflow-hidden relative z-10 animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${selectedChannelForPopup.color}/10 ${selectedChannelForPopup.text}`}>
                  {selectedChannelForPopup.name}
                </span>
                <h3 className="font-extrabold text-slate-800 text-sm">
                  {language === "pt" ? "Pedidos Recebidos" : "Received Orders"}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedChannelForPopup(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 max-h-[300px] overflow-y-auto">
              {getChannelOrders(selectedChannelForPopup.key).length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs italic">
                  {language === "pt" ? "Nenhum pedido recebido neste canal ainda." : "No orders received on this channel yet."}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 font-mono text-xs">
                  {getChannelOrders(selectedChannelForPopup.key).map((order) => (
                    <div 
                      key={order.id} 
                      className="py-3 flex flex-wrap sm:flex-nowrap items-center justify-between text-[11px] sm:text-xs text-slate-800 gap-2.5"
                    >
                      {/* Strictly ordered: 1. order number, 2. customer name */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-bold text-slate-900 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded shrink-0">
                          {order.id}
                        </span>
                        <div className="min-w-0">
                          <span className="text-slate-600 font-sans font-medium truncate block">
                            {order.customerName}
                          </span>
                          {order.amoData && (
                            <span className="text-[10px] text-slate-400 truncate block">
                              {(order.amoData as any).customer?.email || ""}
                              {(order.amoData as any).customer?.phone?.number
                                ? ` · ${(order.amoData as any).customer.phone.number}`
                                : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right-aligned section with interactive status actions */}
                      <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                        {/* Two buttons to accept or reject the order (placed to the left of the status if status is "pending") */}
                        {order.status === "pending" && (
                          <div className="flex items-center gap-1.5 mr-0.5">
                            <button
                              onClick={() => handleUpdateStatus(order, "preparing")}
                              disabled={updatingOrderId === order.id}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-300 text-white font-extrabold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-0.5"
                              title={language === "pt" ? "Aceitar pedido" : "Accept order"}
                            >
                              ✓ {language === "pt" ? "Aceitar" : "Accept"}
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(order, "cancelled")}
                              disabled={updatingOrderId === order.id}
                              className="px-2 py-1 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-300 text-white font-extrabold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-0.5"
                              title={language === "pt" ? "Rejeitar pedido" : "Reject order"}
                            >
                              ✗ {language === "pt" ? "Rejeitar" : "Reject"}
                            </button>
                          </div>
                        )}

                        {/* 3. Status Column */}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 ${
                          order.status === "completed" ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-100" :
                          order.status === "pending" ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse" :
                          order.status === "preparing" ? "bg-indigo-50 text-indigo-700 border border-indigo-100" :
                          order.status === "delivering" ? "bg-blue-50 text-blue-700 border border-blue-100" :
                          "bg-rose-50 text-rose-700 border border-rose-100"
                        }`}>
                          {order.status}
                        </span>

                        {/* 4. Order Value Column */}
                        <span className="font-bold text-slate-900 min-w-[65px] text-right font-sans">
                          {formatCurrency(order.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedChannelForPopup(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 active:bg-slate-400/30 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                {language === "pt" ? "Fechar" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
