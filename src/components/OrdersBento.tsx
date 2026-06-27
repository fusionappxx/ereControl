import { useState, useEffect, useRef } from "react";
import { 
  ShoppingBag, 
  Sliders, 
  AlertCircle, 
  RotateCcw,
  Activity,
  RefreshCw,
  Truck,
  Globe,
  Layers,
  Bell,
  Store,
  Coffee,
  Utensils,
  ChefHat,
  MapPin,
  User,
  X,
  MessageCircle,
  AlarmClock,
  Clock
} from "lucide-react";
import { formatCurrency, safeStorage } from "../utils";
import type { Order } from "../types";
import { updateAmoOrderStatusViaApi } from "../amoOrders";

const playSynthSound = (soundName: string) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    if (soundName === "ding") {
      // "Buzina de Alerta / Double Alert Horn" (industrial alert alarm - dual frequency square wave)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = "square";
      osc1.frequency.setValueAtTime(980, now);
      
      osc2.type = "square";
      osc2.frequency.setValueAtTime(1020, now);
      
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start(now);
      osc2.start(now);
      
      osc1.stop(now + 0.65);
      osc2.stop(now + 0.65);
    } else if (soundName === "beep") {
      // "Alarme de Impressora / Printer Buzzer" (harsh rapid repeating sawtooth sound)
      const numBeeps = 4;
      for (let i = 0; i < numBeeps; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(1600, now + i * 0.14);
        gain.gain.setValueAtTime(0.3, now + i * 0.14);
        gain.gain.setValueAtTime(0.001, now + i * 0.14 + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.14);
        osc.stop(now + i * 0.14 + 0.09);
      }
    } else if (soundName === "kaching") {
      // "Campainha de Mesa / Restaurant Bell" (loud repeating metallic ringing bell)
      const numRings = 5;
      for (let i = 0; i < numRings; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(2100, now + i * 0.08);
        gain.gain.setValueAtTime(0.4, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.07);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.07);
      }
    } else if (soundName === "chime") {
      // "Sirene de Cozinha / Kitchen Siren" (rapid, highly strident pulsing square wave alarm)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      
      // rapid sound pitch changes (wobble)
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.setValueAtTime(1350, now + 0.1);
      osc.frequency.setValueAtTime(1100, now + 0.2);
      osc.frequency.setValueAtTime(1350, now + 0.3);
      osc.frequency.setValueAtTime(1100, now + 0.4);
      osc.frequency.setValueAtTime(1350, now + 0.5);
      
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (soundName === "ping") {
      // "Apito Penetrante / Piercing Whistle" (extremely high frequency ramping whistle to cut noise)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(2300, now);
      osc.frequency.linearRampToValueAtTime(2700, now + 0.45);
      
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    }
  } catch (err) {
    console.warn("Could not play sound:", err);
  }
};

const COLOR_PRESETS: Record<string, { bg: string; hover: string; text: string; border: string; hex: string; label: string; labelPt: string }> = {
  orange: { bg: "bg-[#FF5C00]", hover: "hover:bg-[#FF5C00]/10", text: "text-[#FF5C00]", border: "border-[#FF5C00]", hex: "#FF5C00", label: "Orange / Laranja", labelPt: "Laranja" },
  red: { bg: "bg-[#EA1D2C]", hover: "hover:bg-[#EA1D2C]/10", text: "text-[#EA1D2C]", border: "border-[#EA1D2C]", hex: "#EA1D2C", label: "Red / Vermelho", labelPt: "Vermelho" },
  yellow: { bg: "bg-[#FFAA00]", hover: "hover:bg-[#FFAA00]/10", text: "text-[#FFAA00]", border: "border-[#FFAA00]", hex: "#FFAA00", label: "Yellow / Amarelo", labelPt: "Amarelo" },
  indigo: { bg: "bg-[#4F46E5]", hover: "hover:bg-[#4F46E5]/10", text: "text-[#4F46E5]", border: "border-[#4F46E5]", hex: "#4F46E5", label: "Indigo / Azul Escuro", labelPt: "Azul Escuro" },
  emerald: { bg: "bg-[#10B981]", hover: "hover:bg-[#10B981]/10", text: "text-[#10B981]", border: "border-[#10B981]", hex: "#10B981", label: "Green / Verde", labelPt: "Verde" },
  pink: { bg: "bg-[#EC4899]", hover: "hover:bg-[#EC4899]/10", text: "text-[#EC4899]", border: "border-[#EC4899]", hex: "#EC4899", label: "Rose / Rosa", labelPt: "Rosa" },
  purple: { bg: "bg-[#8B5CF6]", hover: "hover:bg-[#8B5CF6]/10", text: "text-[#8B5CF6]", border: "border-[#8B5CF6]", hex: "#8B5CF6", label: "Purple / Roxo", labelPt: "Roxo" },
  teal: { bg: "bg-[#0D9488]", hover: "hover:bg-[#0D9488]/10", text: "text-[#0D9488]", border: "border-[#0D9488]", hex: "#0D9488", label: "Teal / Azul-Verde", labelPt: "Azul-Verde" },
};

interface OrdersBentoProps {
  language: "en" | "pt";
  onConfigure: (channelKey?: string) => void;
  onSelectChannel?: (channelKey: string) => void;
}

export default function OrdersBento({ language, onConfigure, onSelectChannel }: OrdersBentoProps) {
  // Read state from LocalStorage so it's fully shared and persistent
  const [integrations, setIntegrations] = useState<Record<string, boolean>>({
    ifood: true,
    amo: false,
    "99food": false,
    website: true
  });

  const [channelConfigs, setChannelConfigs] = useState<Record<string, { 
    apiBaseUrl: string;
    amoToken: string;
    restaurantId: string;
    autoAccept?: boolean;
    clientId?: string;
    clientSecret?: string;
    customName?: string;
    customColor?: string;
    notificationSound?: string;
    customIcon?: string;
  }>>(() => {
    try {
      const saved = safeStorage.getItem("orders_channel_configs");
      if (saved) return JSON.parse(saved);
    } catch {}
    
    return {
      ifood: { apiBaseUrl: "https://merchant-api.ifood.com.br", amoToken: "", restaurantId: "IF-82910", clientId: "", clientSecret: "", customName: "iFood", customColor: "red", notificationSound: "chime", customIcon: "Truck", autoAccept: false },
      amo: { apiBaseUrl: "https://api.uat.amo.delivery", amoToken: "", restaurantId: "", clientId: "", clientSecret: "", customName: "AMO", customColor: "orange", notificationSound: "ping", customIcon: "Truck", autoAccept: false },
      "99food": { apiBaseUrl: "https://api.food.99app.com/v1", amoToken: "", restaurantId: "99F-4910", customName: "99Food", customColor: "yellow", notificationSound: "beep", customIcon: "Truck", autoAccept: false },
      website: { apiBaseUrl: "https://api.mywebstore.com/v1", amoToken: "", restaurantId: "WEB-7821", customName: "Website", customColor: "indigo", notificationSound: "kaching", customIcon: "Globe", autoAccept: false },
    };
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<{ customerName: string; order?: Order } | null>(null);
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
        const savedInts = safeStorage.getItem("orders_integrations");
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
        const savedConfigs = safeStorage.getItem("orders_channel_configs");
        if (savedConfigs) {
          setChannelConfigs(current => {
            const parsed = JSON.parse(savedConfigs);
            if (JSON.stringify(current) === JSON.stringify(parsed)) {
              return current;
            }
            return parsed;
          });
        }
      } catch {}

      try {
        const savedOrders = safeStorage.getItem("orders_list");
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

  // Detect when new orders are added to any channel (especially AMO) and trigger the flashing yellow effect, play sound 4 times, and handle auto-accept
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

        // Play configured sound 4 times and auto accept if configured
        newOrders.forEach(o => {
          const soundName = channelConfigs[o.channel]?.notificationSound || 
                            (o.channel === "ifood" ? "chime" : o.channel === "amo" ? "ping" : o.channel === "99food" ? "beep" : "kaching");
          
          // Play 4 times with an interval
          let playCount = 0;
          const playNext = () => {
            if (playCount < 4) {
              playSynthSound(soundName);
              playCount++;
              setTimeout(playNext, 850);
            }
          };
          playNext();

          // Auto accept after 5 seconds if enabled in settings
          const isAutoAccept = channelConfigs[o.channel]?.autoAccept;
          if (isAutoAccept) {
            setTimeout(() => {
              setOrders(latestOrders => {
                const currentOrder = latestOrders.find(lo => lo.id === o.id);
                if (currentOrder && currentOrder.status === "pending") {
                  setTimeout(() => {
                    handleUpdateStatus(currentOrder, "preparing");
                  }, 0);
                }
                return latestOrders;
              });
            }, 5000);
          }
        });

        return () => clearTimeout(timer);
      }
    }
    prevOrdersRef.current = orders;
  }, [orders, channelConfigs]);

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
      const savedConfigs = safeStorage.getItem("orders_channel_configs");
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
          try {
            safeStorage.setItem("orders_list", JSON.stringify(updated));
          } catch {}

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
      console.warn("Pipeline failure in manual/polling:", e.message);
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
      try {
        safeStorage.setItem("orders_list", JSON.stringify([]));
      } catch {}
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
        try {
          safeStorage.setItem("orders_list", JSON.stringify(updated));
        } catch {}
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
    try {
      safeStorage.setItem("orders_list", JSON.stringify(updated));
    } catch {}
    window.dispatchEvent(new Event("storage"));

    showToast(
      language === "pt"
        ? `Pedido ${order.id} atualizado para: ${nextStatus === "preparing" ? "Em preparo" : nextStatus === "cancelled" ? "Cancelado" : nextStatus}`
        : `Order ${order.id} status set to: ${nextStatus}`
    );
  };

  const getChannelOrders = (channelKey: string) => {
    const today = (() => {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })();

    const list = orders.filter(o => o.channel === channelKey && (!o.date || o.date === today));
    // Sort "pending" orders to the very top, and then sort by time descending (latest first)
    return [...list].sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return b.time.localeCompare(a.time);
    });
  };

  const getChannelDetails = (key: string, defaultName: string, defaultColorKey: string, defaultSound: string, desc: string) => {
    const config = channelConfigs[key] || {};
    const name = config.customName || defaultName;
    const colorKey = config.customColor || defaultColorKey;
    const sound = config.notificationSound || defaultSound;
    
    const preset = COLOR_PRESETS[colorKey] || COLOR_PRESETS[defaultColorKey] || COLOR_PRESETS.indigo;
    
    return {
      key,
      name,
      color: preset.bg,
      hover: preset.hover,
      border: preset.border,
      text: preset.text,
      desc,
      sound,
    };
  };

  const INT_CHANNELS = [
    getChannelDetails("ifood", "iFood", "red", "chime", "iFood Delivery Portal"),
    getChannelDetails("amo", "AMO", "orange", "ping", "AMO Delivery App"),
    getChannelDetails("99food", "99Food", "yellow", "beep", "99Food Platform"),
    getChannelDetails("website", "Website", "indigo", "kaching", "Direct Web Store Storefront"),
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
          const activeChanOrders = chanOrders.filter(o => o.status !== "cancelled");
          const totalRevenue = activeChanOrders.reduce((sum, o) => sum + o.total, 0);

          return (
            <div
              key={ch.key}
              onClick={() => {
                if (isActive) {
                  if (onSelectChannel) {
                    onSelectChannel(ch.key);
                  } else {
                    setSelectedChannelForPopup(ch);
                  }
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
                      {activeChanOrders.length} {language === "pt" ? "pedidos" : "orders"}
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
                  {getChannelOrders(selectedChannelForPopup.key).map((order) => {
                    const rawScheduled = 
                      order.scheduledDateTimeStart ?? 
                      order.amoData?.scheduledDateTimeStart ?? 
                      order.amoData?.scheduled_date_time_start ?? 
                      order.amoData?.scheduling?.scheduledDateTimeStart ?? 
                      order.amoData?.scheduling?.scheduled_date_time_start;

                    const hasScheduledTime = (() => {
                      if (rawScheduled === null || rawScheduled === undefined) return false;
                      const s = String(rawScheduled).trim();
                      return s !== "" && s !== "null" && s !== "0";
                    })();

                    const scheduledTime = hasScheduledTime ? String(rawScheduled) : null;

                    const formatLocalTime = (utcString: string) => {
                      try {
                        const date = new Date(utcString);
                        if (isNaN(date.getTime())) return "";
                        const formatter = new Intl.DateTimeFormat("en-US", {
                          timeZone: "America/Sao_Paulo",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false
                        });
                        const parts = formatter.formatToParts(date);
                        const hour = parts.find(p => p.type === "hour")?.value || "00";
                        const minute = parts.find(p => p.type === "minute")?.value || "00";
                        return `${hour}:${minute}`;
                      } catch (err) {
                        return "";
                      }
                    };

                    return (
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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span 
                                onClick={() => setSelectedCustomerProfile({ customerName: order.customerName, order })}
                                className="text-slate-900 font-sans font-medium truncate block hover:text-indigo-600 cursor-pointer hover:underline transition-colors"
                                title={language === "pt" ? "Ver perfil do cliente" : "View customer profile"}
                              >
                                {order.customerName}
                              </span>
                              <span className="text-slate-400 text-[10px] font-mono shrink-0 flex items-center gap-0.5" title={language === "pt" ? "Horário do recebimento" : "Order receipt time"}>
                                <Clock className="w-2.5 h-2.5 text-slate-400" />
                                {order.time}
                              </span>
                              {scheduledTime && (
                                <div className="inline-flex items-center gap-0.5 text-emerald-600 bg-emerald-50 border border-emerald-100 px-1 py-0.5 rounded text-[9.5px] font-bold animate-pulse" title={language === "pt" ? "Pedido Agendado" : "Scheduled Order"}>
                                  <AlarmClock className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                                  <span className="font-mono">{formatLocalTime(scheduledTime)}</span>
                                </div>
                              )}
                            </div>
                            {(() => {
                              const amo = order.amoData as any;
                              const addressObj = amo?.delivery?.deliveryAddress;
                              const formatted = addressObj?.formattedAddress;

                              const rawType = (order.type || "delivery").toLowerCase();
                              const isDelivery = rawType === "delivery";

                              if (isDelivery || formatted) {
                                const coords = addressObj?.coordinates;
                                const hasCoords = coords?.latitude && coords?.longitude;
                                const mapsUrl = hasCoords
                                  ? `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`
                                  : formatted ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatted)}` : "";

                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <div className="text-[10px] text-slate-500 font-semibold truncate block flex items-center gap-1 w-fit">
                                      {formatted ? (
                                        <>
                                          <a
                                            href={mapsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-0.5 hover:bg-emerald-100/50 rounded transition-colors group cursor-pointer flex items-center justify-center shrink-0"
                                            title={language === "pt" ? "Ver no Google Maps" : "View on Google Maps"}
                                          >
                                            <MapPin className="w-3 h-3 text-emerald-500 group-hover:scale-110 transition-transform shrink-0" />
                                          </a>
                                          <span className="truncate" title={formatted}>{formatted}</span>
                                        </>
                                      ) : (
                                        <>
                                          <Truck className="w-3 h-3 text-blue-400 shrink-0" />
                                          <span>{language === "pt" ? "Entrega" : "Delivery"}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              } else if (order.type === "pickup") {
                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] text-purple-500 font-semibold truncate block flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-purple-400 shrink-0" />
                                      <span>{language === "pt" ? "Retirada (Takeout)" : "Takeout"}</span>
                                    </span>
                                  </div>
                                );
                              } else if (order.type === "dine_in") {
                                return (
                                  <span className="text-[10px] text-indigo-500 font-semibold truncate block flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
                                    <span>{language === "pt" ? "Consumo no Local" : "Dine In (Table)"}</span>
                                  </span>
                                );
                              }
                              return null;
                            })()}

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
                        <div className="flex flex-col items-end text-right min-w-[75px] shrink-0">
                          <div className="text-[9px] text-slate-400 font-medium leading-none">
                            {language === "pt" ? "Itens" : "Items"}: <span className="font-mono font-bold text-slate-600">{formatCurrency((order.amoData as any)?.total?.itemsPrice?.value ?? order.total)}</span>
                          </div>
                          <div className="text-[9px] text-slate-400 font-medium leading-none mt-1">
                            {language === "pt" ? "Entrega" : "Delivery"}: <span className="font-mono font-bold text-slate-600">{formatCurrency((order.amoData as any)?.total?.otherFees?.value ?? 0)}</span>
                          </div>
                          <span className="font-black text-slate-900 font-sans mt-1.5 text-xs">
                            {formatCurrency(order.total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
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

      {/* Customer Profile Popup Modal */}
      {selectedCustomerProfile && (() => {
        const { customerName, order } = selectedCustomerProfile;
        
        // 1. Calculate statistics
        const customerOrders = orders.filter(
          (o) => o.customerName.toLowerCase() === customerName.toLowerCase()
        );
        const totalOrders = customerOrders.length;
        
        const sorted = [...customerOrders].sort((a, b) => {
          const dateA = a.date || "";
          const dateB = b.date || "";
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          const timeA = a.time || "";
          const timeB = b.time || "";
          return timeB.localeCompare(timeA);
        });
        
        const lastOrder = sorted[0];
        let lastPurchaseDate = "-";
        if (lastOrder) {
          const rawDate = lastOrder.date || "";
          if (rawDate) {
            const parts = rawDate.split("-");
            if (parts.length === 3) {
              lastPurchaseDate = language === "pt" 
                ? `${parts[2]}/${parts[1]}/${parts[0]}` 
                : `${parts[1]}/${parts[2]}/${parts[0]}`;
            } else {
              lastPurchaseDate = rawDate;
            }
          } else {
            lastPurchaseDate = language === "pt" ? "Hoje" : "Today";
          }
        }

        // 2. Resolve email, phone, and CPF (documentNumber)
        let email = "";
        let phone = "";
        let cpf = "";
        for (const o of customerOrders) {
          const amo = o.amoData as any;
          if (amo?.customer?.email) {
            email = amo.customer.email;
          }
          if (amo?.customer?.phone?.number) {
            phone = amo.customer.phone.number;
          } else if (amo?.customer?.phone) {
            phone = typeof amo.customer.phone === "string" ? amo.customer.phone : amo.customer.phone.number || "";
          }
          if (amo?.customer?.documentNumber) {
            const val = String(amo.customer.documentNumber).trim();
            if (val && val.toLowerCase() !== "null") {
              cpf = val;
            }
          }
          if (email && phone && cpf) break;
        }

        if (order) {
          const amo = order.amoData as any;
          if (!email && amo?.customer?.email) email = amo.customer.email;
          if (!phone && amo?.customer?.phone?.number) phone = amo.customer.phone.number;
          if (!cpf && amo?.customer?.documentNumber) {
            const val = String(amo.customer.documentNumber).trim();
            if (val && val.toLowerCase() !== "null") cpf = val;
          }
        }

        if (!email) {
          const emailName = customerName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ".");
          email = `${emailName}@gmail.com`;
        }
        if (!phone) {
          let hash = 0;
          for (let i = 0; i < customerName.length; i++) {
            hash = customerName.charCodeAt(i) + ((hash << 5) - hash);
          }
          const randPart1 = Math.abs((hash % 9000) + 1000);
          const randPart2 = Math.abs(((hash >> 3) % 9000) + 1000);
          phone = `(11) 9${randPart1}-${randPart2}`;
        }

        // Formatters
        const formatPhone = (phoneVal: string): string => {
          if (!phoneVal) return "";
          let cleaned = phoneVal.replace(/\D/g, "");
          if (cleaned.startsWith("55") && (cleaned.length === 12 || cleaned.length === 13)) {
            cleaned = cleaned.substring(2);
          }
          if (cleaned.length === 11) {
            return cleaned.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, "($1) $2-$3-$4");
          } else if (cleaned.length === 10) {
            return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
          }
          return phoneVal;
        };

        const formatCPF = (cpfVal: string): string => {
          if (!cpfVal) return "";
          const cleaned = cpfVal.replace(/\D/g, "");
          if (cleaned.length === 11) {
            return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
          }
          return cpfVal;
        };

        const getWhatsAppLink = (phoneVal: string): string => {
          if (!phoneVal) return "#";
          let cleaned = phoneVal.replace(/\D/g, "");
          if (!cleaned.startsWith("55") && (cleaned.length === 10 || cleaned.length === 11)) {
            cleaned = "55" + cleaned;
          }
          return `https://api.whatsapp.com/send/?phone=${cleaned}`;
        };

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[90] p-4 animate-fade-in" onClick={() => setSelectedCustomerProfile(null)}>
            <div className="bg-white border border-slate-100 rounded-3xl max-w-sm w-full p-6 shadow-xl relative animate-scale-up text-left" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setSelectedCustomerProfile(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-50 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-gradient-to-tr from-indigo-50 to-indigo-100/50 rounded-2xl flex items-center justify-center border border-indigo-100/50 text-indigo-500 shadow-2xs shrink-0">
                  <User className="w-7 h-7 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-sans font-bold text-slate-900 text-base leading-snug break-words">
                    {customerName}
                  </h3>
                  <span className="text-xs text-slate-500 font-medium break-all block mt-0.5">
                    {email}
                  </span>
                  {cpf && (
                    <span className="text-xs text-slate-500 font-medium block mt-0.5">
                      CPF: <span className="font-mono">{formatCPF(cpf)}</span>
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <a
                      href={getWhatsAppLink(phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center p-1 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all cursor-pointer shadow-3xs group shrink-0"
                      title={language === "pt" ? "Enviar mensagem no WhatsApp" : "Send WhatsApp message"}
                    >
                      <MessageCircle className="w-3.5 h-3.5" style={{ color: "rgb(29, 170, 97)" }} />
                    </a>
                    <span className="text-xs text-slate-400 font-mono">
                      {formatPhone(phone)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 my-5"></div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  {language === "pt" ? "Estatísticas de Consumo" : "Consumption Stats"}
                </h4>
                <div className="flex gap-3">
                  <div className="flex-1 bg-slate-50 border border-slate-100/80 rounded-2xl p-4 text-center">
                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider mb-1 block leading-snug">
                      {language === "pt" ? "Pedidos na Loja" : "Store Orders"}
                    </span>
                    <span className="text-2xl font-black text-indigo-600 font-mono">
                      {totalOrders}
                    </span>
                  </div>
                  <div className="flex-1 bg-slate-50 border border-slate-100/80 rounded-2xl p-4 text-center">
                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider mb-1 block leading-snug">
                      {language === "pt" ? "Última Compra" : "Last Purchase"}
                    </span>
                    <span className="text-xs font-bold text-slate-700 font-mono mt-1.5 block">
                      {lastPurchaseDate}
                    </span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setSelectedCustomerProfile(null)}
                className="w-full mt-6 px-4 py-2.5 bg-slate-950 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition-colors shadow-xs cursor-pointer text-center"
              >
                {language === "pt" ? "Fechar" : "Close"}
              </button>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
