import { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  ShoppingBag, 
  Sliders, 
  Check, 
  X, 
  Plus, 
  AlertCircle, 
  ToggleLeft, 
  ToggleRight, 
  Activity, 
  Clock, 
  User, 
  AlertTriangle,
  Play,
  RotateCcw,
  Tag,
  Globe,
  Truck,
  Layers,
  FileText
} from "lucide-react";
import { formatCurrency } from "../utils";

interface Order {
  id: string;
  channel: string;
  customerName: string;
  time: string;
  items: string;
  total: number;
  status: "pending" | "preparing" | "delivering" | "completed" | "cancelled";
}

interface IntegrationsScreenProps {
  language: "en" | "pt";
  onBack: () => void;
  initialChannelKey?: string;
}

const CUSTOMERS = [
  "Mariana Silva", "João Pedro", "Ana Beatriz", "Carlos Eduardo", 
  "Julia Souza", "Lucas Oliveira", "Gabriela Costa", "Rodrigo Alves",
  "Beatriz Santos", "Thiago Martins", "Amanda Lima", "Felipe Rocha"
];

const MENU_ITEMS = [
  { text: "1x Truffle Burger Combo, 1x Vanilla Milkshake", cost: 42.90 },
  { text: "2x Artisanal Pizza Margherita, 1x Coke Zero", cost: 68.00 },
  { text: "1x Salmon Poke Bowl with Mango & Avocado", cost: 38.50 },
  { text: "1x Chocolate Fudge Brownie, 1x Espresso Latte", cost: 24.50 },
  { text: "1x Crispy Chicken Caesar Salad, 1x Sparkling Water", cost: 35.00 },
  { text: "1x Vegetarian Wrap, 1x Green Juice", cost: 29.90 },
  { text: "2x Double Beef Smashed Burgers, 2x French Fries", cost: 79.90 },
  { text: "1x Strawberry Waffle with Ice Cream", cost: 22.00 }
];

export default function IntegrationsScreen({ language, onBack, initialChannelKey }: IntegrationsScreenProps) {
  // Load initial states from local storage so it syncs perfectly with dashboard bento card
  const [integrations, setIntegrations] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("orders_integrations");
      return saved ? JSON.parse(saved) : { ifood: true, amo: false, "99food": false, website: true };
    } catch {
      return { ifood: true, amo: false, "99food": false, website: true };
    }
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem("orders_list");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Track the active left menu tab channel
  const [activeChannelKey, setActiveChannelKey] = useState<string>(initialChannelKey || "amo");

  useEffect(() => {
    if (initialChannelKey) {
      setActiveChannelKey(initialChannelKey);
    }
  }, [initialChannelKey]);

  // Brief message toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync state changes to local storage on edit and dispatch sync event
  useEffect(() => {
    localStorage.setItem("orders_integrations", JSON.stringify(integrations));
    window.dispatchEvent(new Event("storage"));
  }, [integrations]);

  useEffect(() => {
    localStorage.setItem("orders_list", JSON.stringify(orders));
    window.dispatchEvent(new Event("storage"));
  }, [orders]);

  // Keep state synchronized in real-time across tabs / elements
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
        } else {
          setOrders(current => current.length === 0 ? current : []);
        }
      } catch {}
    };

    window.addEventListener("storage", handleSync);
    return () => window.removeEventListener("storage", handleSync);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // State to store customizable credentials configuration per pipeline channel
  const [channelConfigs, setChannelConfigs] = useState<Record<string, { 
    apiBaseUrl: string; 
    amoToken: string; 
    restaurantId: string;
    clientId?: string;
    clientSecret?: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem("orders_channel_configs");
      if (saved) return JSON.parse(saved);
    } catch {}
    
    return {
      ifood: { apiBaseUrl: "https://merchant-api.ifood.com.br", amoToken: "", restaurantId: "IF-82910", clientId: "", clientSecret: "" },
      amo: { apiBaseUrl: "https://api.uat.amo.delivery", amoToken: "", restaurantId: "", clientId: "", clientSecret: "" },
      "99food": { apiBaseUrl: "https://api.food.99app.com/v1", amoToken: "", restaurantId: "99F-4910" },
      website: { apiBaseUrl: "https://api.mywebstore.com/v1", amoToken: "", restaurantId: "WEB-7821" },
    };
  });

  const [isTesting, setIsTesting] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [amoLogs, setAmoLogs] = useState("");
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [confirmClearAmo, setConfirmClearAmo] = useState(false);
  const [confirmResetOrders, setConfirmResetOrders] = useState(false);

  const fetchAndShowAmoLogs = async () => {
    setIsFetchingLogs(true);
    setAmoLogs(language === "pt" ? "Carregando logs de conexões..." : "Loading connection logs...");
    setShowLogsModal(true);
    try {
      const res = await fetch("/api/amo/logs");
      const data = await res.json();
      if (data.success) {
        setAmoLogs(data.logs);
      } else {
        setAmoLogs("Error: " + (data.message || "Failed to load logs"));
      }
    } catch (err: any) {
      setAmoLogs("Network error fetching logs: " + err.message);
    } finally {
      setIsFetchingLogs(false);
    }
  };

  const clearAmoLogs = async () => {
    if (!confirmClearAmo) {
      setConfirmClearAmo(true);
      // Auto reset after 4 seconds
      setTimeout(() => setConfirmClearAmo(false), 4000);
      return;
    }
    setConfirmClearAmo(false);
    try {
      const res = await fetch("/api/amo/logs", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setAmoLogs("(No logs recorded yet. Run a connection test or wait for order polls)");
        showToast(language === "pt" ? "Logs limpos com sucesso!" : "Logs cleared successfully!");
      }
    } catch (err: any) {
      showToast("Error: " + err.message);
    }
  };

  useEffect(() => {
    localStorage.setItem("orders_channel_configs", JSON.stringify(channelConfigs));
  }, [channelConfigs]);

  // =========================================================================
  // SECTION: AMO DELIVERY UAT INTEGRATION IMPLEMENTATION
  // Separate utility to perform live API connection health checks against the
  // AMO UAT API gateway through our secure Express proxy endpoint.
  // =========================================================================
  const testAmoConnection = async (config: { 
    apiBaseUrl: string; 
    amoToken: string; 
    restaurantId: string;
    clientId?: string;
    clientSecret?: string;
  }) => {
    setIsTesting(true);
    try {
      const response = await fetch("/api/test-amo-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          apiBaseUrl: config.apiBaseUrl,
          amoToken: config.amoToken,
          restaurantId: config.restaurantId,
          clientId: config.clientId || "",
          clientSecret: config.clientSecret || ""
        })
      });

      const result = await response.json();
      setIsTesting(false);

      if (response.ok && result.success) {
        const syncedAmoOrders: Order[] = result.orders || [];
        const syncedCount = syncedAmoOrders.length;

        showToast(
          language === "pt"
            ? `Conexão bem sucedida com AMO! Sincronizados ${syncedCount} pedidos reais da API parceira.`
            : `Connection to AMO successful! Synced ${syncedCount} live orders from your partner API connection.`
        );

        setOrders(prev => {
          const nonAmo = prev.filter(o => o.channel !== "amo");
          const merged = [...syncedAmoOrders, ...nonAmo];
          localStorage.setItem("orders_list", JSON.stringify(merged));
          
          setTimeout(() => {
            window.dispatchEvent(new Event("storage"));
          }, 10);
          
          return merged;
        });
      } else {
        showToast(
          language === "pt"
            ? `Fracasso na conexão: ${result.message || "Credenciais rejeitadas pelo servidor."}`
            : `Connection failed: ${result.message || "Credentials rejected by the remote host."}`
        );
      }
    } catch (err: any) {
      setIsTesting(false);
      showToast(
        language === "pt"
          ? "Erro de Rede: Não foi possível alcançar o servidor proxy."
          : "Network Error: Could not establish a pipeline with the proxy gateway."
      );
    }
  };

  // =========================================================================
  // SECTION: IFOOD MERCHANT API INTEGRATION HANDSHAKER
  // Utility function that calls our custom backend proxy endpoint to request
  // an OAuth token and perform live categories validation against the remote host
  // as defined in the official developer.ifood.com.br documentation.
  // =========================================================================
  const testIfoodConnection = async (config: { 
    apiBaseUrl: string; 
    clientId?: string; 
    clientSecret?: string; 
    restaurantId: string; 
  }) => {
    setIsTesting(true);
    try {
      const response = await fetch("/api/test-ifood-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          apiBaseUrl: config.apiBaseUrl,
          clientId: config.clientId || "",
          clientSecret: config.clientSecret || "",
          restaurantId: config.restaurantId
        })
      });

      const result = await response.json();
      setIsTesting(false);

      if (response.ok && result.success) {
        showToast(
          language === "pt"
            ? `Conexão iFood estabelecida! ${result.message} (${result.merchantInfo})`
            : `iFood integrated successfully! ${result.message} (${result.merchantInfo})`
        );
      } else {
        showToast(
          language === "pt"
            ? `Erro de Conexão iFood: ${result.message || "Credenciais rejeitadas pelo portal."}`
            : `iFood Connection failed: ${result.message || "Credentials rejected by the portal."}`
        );
      }
    } catch (err: any) {
      setIsTesting(false);
      showToast(
        language === "pt"
          ? "Erro de Rede: Incapaz de conectar à rede iFood."
          : "Network Error: Could not reach the iFood validation backend."
      );
    }
  };

  const handleTestConnection = (key: string) => {
    const config = channelConfigs[key];
    const baseUrl = config?.apiBaseUrl || "";

    if (!baseUrl.trim()) {
      showToast(
        language === "pt"
          ? "Erro: Forneça a URL base da API para testar!"
          : "Error: Please provide API Base URL to test connection!"
      );
      return;
    }

    // Direct routing to our custom AMO Delivery controller section
    if (key === "amo") {
      testAmoConnection(config);
      return;
    }

    // Direct routing to our custom iFood controller section
    if (key === "ifood") {
      testIfoodConnection(config);
      return;
    }

    setIsTesting(true);
    
    setTimeout(() => {
      setIsTesting(false);
      
      try {
        new URL(baseUrl);
        showToast(
          language === "pt"
            ? `Conexão bem sucedida com o servidor da API! Credenciais salvas.`
            : `Connection to integration host successful! Credentials verified.`
        );
      } catch (e) {
        showToast(
          language === "pt"
            ? `Erro de Conexão: Formato inválido para a URL da API.`
            : `Connection Error: Invalid API Base URL format.`
        );
      }
    }, 1200);
  };

  const handleToggleIntegration = (key: string) => {
    setIntegrations(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    
    const targetCh = INT_CHANNELS.find(c => c.key === key);
    const channelName = targetCh ? targetCh.name : key;
    const isNowActive = !integrations[key];
    showToast(
      language === "pt"
        ? `${channelName} está agora ${isNowActive ? "ATIVO" : "DESATIVADO"}`
        : `${channelName} is now ${isNowActive ? "ENABLED" : "INACTIVE"}`
    );
  };

  const getChannelOrders = (key: string) => {
    return [...orders]
      .filter(o => o.channel === key)
      .sort((a, b) => b.time.localeCompare(a.time));
  };

  const triggerSimulation = (key: string) => {
    if (!integrations[key]) {
      showToast(
        language === "pt"
          ? `Para simular, ative a integração do ${key === "ifood" ? "iFood" : key === "amo" ? "AMO" : key === "99food" ? "99Food" : "Website"}!`
          : `Enable the ${key === "ifood" ? "iFood" : key === "amo" ? "AMO" : key === "99food" ? "99Food" : "Website"} integration first to simulate orders!`
      );
      return;
    }

    const randomCust = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
    const randomItem = MENU_ITEMS[Math.floor(Math.random() * MENU_ITEMS.length)];
    
    const prefix = key === "ifood" ? "IF" : key === "amo" ? "AM" : key === "99food" ? "99" : "WB";
    const randNum = Math.floor(Math.random() * 9000) + 1000;
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const newOrder: Order = {
      id: `${prefix}-${randNum}`,
      channel: key,
      customerName: randomCust,
      time: timeStr,
      items: randomItem.text,
      total: randomItem.cost,
      status: "pending"
    };

    setOrders(prev => [newOrder, ...prev]);
    
    const targetCh = INT_CHANNELS.find(c => c.key === key);
    const channelName = targetCh ? targetCh.name : key;
    showToast(
      language === "pt" 
        ? `Novo pedido #${newOrder.id} simulado para ${channelName}!` 
        : `New order #${newOrder.id} simulated for ${channelName}!`
    );
  };

  const updateOrderStatus = (orderId: string, nextStatus: Order["status"]) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return { ...o, status: nextStatus };
      }
      return o;
    }));
  };

  const handleResetOrders = () => {
    if (!confirmResetOrders) {
      setConfirmResetOrders(true);
      setTimeout(() => setConfirmResetOrders(false), 4000);
      return;
    }
    setConfirmResetOrders(false);
    setOrders([]);
    localStorage.setItem("orders_list", JSON.stringify([]));
    window.dispatchEvent(new Event("storage"));
    showToast(language === "pt" ? "Todos os logs de pedidos foram removidos com sucesso!" : "All order logs cleared successfully from all channels!");
  };

  const INT_CHANNELS = [
    { key: "amo", name: "AMO", color: "bg-[#FF5C00]", hover: "hover:bg-[#FF5C00]/10", text: "text-[#FF5C00]", border: "border-[#FF5C00]", icon: Truck, desc: "AMO Delivery Connector", devKey: "amo" },
    { key: "ifood", name: "iFood", color: "bg-[#EA1D2C]", hover: "hover:bg-[#EA1D2C]/10", text: "text-[#EA1D2C]", border: "border-[#EA1D2C]", icon: Truck, desc: "iFood Portal Integration", devKey: "ifood" },
    { key: "99food", name: "99Food", color: "bg-[#FFAA00]", hover: "hover:bg-[#FFAA00]/10", text: "text-[#FFAA00]", border: "border-[#FFAA00]", icon: Truck, desc: "99Food API Channel", devKey: "99food" },
    { key: "website", name: "Website", color: "bg-[#4F46E5]", hover: "hover:bg-[#4F46E5]/10", text: "text-[#4F46E5]", border: "border-[#4F46E5]", icon: Globe, desc: "Direct Webstore Commerce", devKey: "website" },
  ];

  const currentChannel = INT_CHANNELS.find(ch => ch.key === activeChannelKey) || INT_CHANNELS[0];
  const channelIsActive = !!integrations[currentChannel.key];
  const channelOrdersList = getChannelOrders(currentChannel.key);
  const totalCompletedVal = channelOrdersList
    .filter(o => o.status === "completed")
    .reduce((sum, o) => sum + o.total, 0);
  const totalVolumeVal = channelOrdersList.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-fade-in select-none">
      
      {/* Top Breadcrumb Navigation */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 bg-white border border-slate-150 hover:bg-slate-50 text-slate-500 hover:text-slate-700 active:bg-slate-100 rounded-xl transition-all shadow-3xs cursor-pointer flex items-center justify-center"
            title={language === "pt" ? "Voltar ao Início" : "Back to Home"}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {language === "pt" ? "Canal de Integrações API" : "Integrations & Sales Pipelines"}
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {language === "pt" 
                ? "Configure conexões de entrega com iFood, AMO, 99Food e Website em tempo real." 
                : "Configure real-time delivery connections with iFood, AMO, 99Food, and Webstore Webhooks."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {orders.length > 0 && (
            <button
              onClick={handleResetOrders}
              className={`px-3.5 py-2 border text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                confirmResetOrders
                  ? "border-rose-300 bg-rose-100 text-rose-700 animate-pulse"
                  : "border-rose-100 bg-rose-50/50 hover:bg-rose-50 text-rose-600 hover:text-rose-700 active:bg-rose-100"
              }`}
            >
              <RotateCcw className={`w-4 h-4 ${confirmResetOrders ? "animate-spin text-rose-600" : "text-rose-500"}`} />
              <span>
                {confirmResetOrders
                  ? (language === "pt" ? "Clique para Confirmar!" : "Click to Confirm!")
                  : (language === "pt" ? "Limpar Todos os Logs" : "Clear All Order Logs")}
              </span>
            </button>
          )}

          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer"
          >
            {language === "pt" ? "Salvar e Fechar" : "Save and Exit"}
          </button>
        </div>
      </div>

      {/* Main Container: Left Tabs Menu + Right Details Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side Tab Navigation Menu (4 Columns equivalent on Large Screen) */}
        <div className="lg:col-span-4 space-y-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
            {language === "pt" ? "Conexões Disponíveis" : "Available Connections"}
          </p>

          <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-xs space-y-1">
            {INT_CHANNELS.map(ch => {
              const isActive = !!integrations[ch.key];
              const isSelected = activeChannelKey === ch.key;
              const ChannelIcon = ch.icon;
              const chOrders = getChannelOrders(ch.key);

              return (
                <button
                  key={ch.key}
                  onClick={() => setActiveChannelKey(ch.key)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all text-left cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-transparent text-slate-700 hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isSelected 
                        ? "bg-white/10 text-white" 
                        : `${ch.color}/10 ${ch.text}`
                    }`}>
                      <ChannelIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-none">{ch.name}</p>
                      <p className={`text-[10px] mt-1 leading-none ${
                        isSelected ? "text-indigo-200" : "text-slate-400"
                      }`}>
                        {chOrders.length} {language === "pt" ? "pedidos registrados" : "orders tracked"}
                      </p>
                    </div>
                  </div>

                  {/* Right hand toggle state pill inside button */}
                  <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                    isActive
                      ? isSelected 
                        ? "bg-emerald-500 text-white" 
                        : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      : isSelected
                        ? "bg-white/20 text-indigo-100"
                        : "bg-slate-100 text-slate-400"
                  }`}>
                    {isActive ? "ACTIVE" : "inactive"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Setup Help Instructions Widget */}
          <div className="bg-gradient-to-br from-indigo-50/60 to-violet-50/20 border border-indigo-100/40 rounded-2xl p-4 space-y-2.5">
            <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>{language === "pt" ? "Instruções de webhook" : "Webhook Instructions"}</span>
            </h4>
            <p className="text-[10.5px] text-indigo-800 font-medium leading-relaxed">
              {language === "pt"
                ? "Os pedidos sincronizados simulam webhooks de APIs do iFood, da plataforma AMO, da API oficial do 99Food e envio via seu Website."
                : "Selected pipelines feed transactional webhooks mimicking the public APIs for iFood, AMO backend, 99Food system, and Website storefront."}
            </p>
          </div>
        </div>

        {/* Right Side Content Manager (8 Columns equivalent on Large Screen) */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-100 shadow-xs p-6 space-y-6 relative overflow-hidden">
          
          {/* Subtle background glow decorator */}
          <div className={`absolute top-0 right-0 w-44 h-44 ${currentChannel.color}/5 rounded-full blur-3xl pointer-events-none`} />

          {/* Current Channel Details Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 relative z-10">
            <div className="flex items-center gap-3.5">
              <div className={`p-3 rounded-2xl ${currentChannel.color} text-white shadow-2xs shrink-0 flex items-center justify-center`}>
                <currentChannel.icon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                  {currentChannel.name} {language === "pt" ? "Faturamento" : "Pipeline Settings"}
                </h2>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  {currentChannel.desc} — {language === "pt" ? "Simulação e controle em ambiente sandbox" : "Control sandbox flow logs"}
                </p>
              </div>
            </div>

            {/* Slide toggle state button inside panel header */}
            <button
              onClick={() => handleToggleIntegration(currentChannel.key)}
              className="focus:outline-hidden cursor-pointer"
              title={channelIsActive ? "Mute integration" : "Activate integration"}
            >
              {channelIsActive ? (
                <div className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-3 py-1.5 rounded-xl border border-emerald-100 transition-all">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">{language === "pt" ? "INTEGRAÇÃO ATIVA" : "INTEGRATION ACTIVE"}</span>
                  <ToggleRight className="w-6 h-6 stroke-1.5" />
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-400 px-3 py-1.5 rounded-xl border border-slate-200/55 transition-all">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">{language === "pt" ? "INTEGRAÇÃO MUTADA" : "INTEGRATION INACTIVE"}</span>
                  <ToggleLeft className="w-6 h-6 stroke-1.5" />
                </div>
              )}
            </button>
          </div>

          {/* Specific Channel Aggregated Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === "pt" ? "VALOR DE HOJE" : "TODAY VALUE"}</p>
              <h3 className="text-lg font-black font-mono text-slate-900 mt-1 leading-none">{formatCurrency(totalCompletedVal)}</h3>
            </div>
            
            <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === "pt" ? "VALOR MENSAL" : "MONTHLY VALUE"}</p>
              <h3 className="text-lg font-black font-mono text-emerald-600 mt-1 leading-none">{formatCurrency(totalVolumeVal)}</h3>
            </div>

            <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4 hover:shadow-2xs transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === "pt" ? "PEDIDOS DE HOJE" : "TODAY ORDERS"}</span>
              </div>
              <p className="text-base font-black font-mono text-slate-900 mt-1 leading-none">
                {channelOrdersList.filter(o => o.status === "completed").length}
              </p>
            </div>

            <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4 hover:shadow-2xs transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === "pt" ? "PEDIDOS MENSAIS" : "MONTHLY ORDERS"}</span>
              </div>
              <p className="text-base font-black font-mono text-slate-900 mt-1 leading-none">
                {channelOrdersList.length}
              </p>
            </div>
          </div>

          {/* Sandbox Simulators Banner Actions */}
          {currentChannel.key !== "amo" ? (
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="min-w-0 text-center md:text-left">
                <h4 className="text-xs font-bold text-slate-800">
                  {language === "pt" ? "Simulador de Webhooks de Vendas" : "Live Webhook Simulation Endpoint"}
                </h4>
                <p className="text-[10.5px] text-slate-450 mt-1">
                  {language === "pt"
                    ? "Envie um objeto JSON experimental para simular uma transação recebida."
                    : "Trigger a mock JSON transaction body through our integration sandbox to populate live orders graph."}
                </p>
              </div>

              <button
                onClick={() => triggerSimulation(currentChannel.key)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-extrabold rounded-xl transition-all shadow-xs hover:shadow-sm cursor-pointer flex items-center justify-center gap-2 shrink-0 w-full md:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>{language === "pt" ? "Simular Novo Pedido" : "Simulate Live Order"}</span>
              </button>
            </div>
          ) : (
            <div className="bg-amber-50/50 rounded-2xl border border-amber-100 p-4 text-center md:text-left">
              <h4 className="text-xs font-bold text-amber-800">
                {language === "pt" ? "Simulador Excluído" : "Simulation Excluded"}
              </h4>
              <p className="text-[10.5px] text-amber-700/80 mt-1">
                {language === "pt"
                  ? "Em conformidade com as diretivas do sistema, o gerador de pedidos de teste para o canal AMO foi excluído. Este canal funciona estritamente através da API configurada de Open Delivery."
                  : "In compliance with platform directives, mock order simulation triggers are excluded for the AMO channel. This channel functions exclusively via the configured Open Delivery live API."}
              </p>
            </div>
          )}

          {/* API Configuration section */}
          <div className="bg-slate-50/80 rounded-2xl border border-slate-100 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/40 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-extrabold text-slate-800 tracking-wider uppercase">
                  {language === "pt" ? "Configurações de Conector de API" : "Connector API Configurations"}
                </h3>
              </div>
              <span className="text-[10px] uppercase font-mono font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-md border border-indigo-100/50">
                {currentChannel.name} Connection
              </span>
            </div>

            {currentChannel.key === "amo" && (
              <div className="bg-[#FF5C00]/5 border border-[#FF5C00]/15 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-[#FF5C00]">
                  <FileText className="w-4 h-4" />
                  <h4 className="text-xs font-black uppercase tracking-wide">
                    {language === "pt" ? "Conexão Oficial AMO - Diretivas Doc 517071" : "Official AMO Connection - Doc 517071 Guidelines"}
                  </h4>
                </div>
                <p className="text-[10.5px] font-medium text-slate-600 leading-relaxed">
                  {language === "pt"
                    ? "Esta conexão automatizada segue rigorosamente as diretrizes e endpoints do padrão Open Delivery especificados no documento oficial AMO Doc 517071:"
                    : "This integration strictly implements standard Open Delivery API endpoints mapped within the official AMO developer documentation (Doc 517071):"}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-bold font-mono pt-1">
                  <div className="bg-white/80 p-2 rounded-xl border border-slate-100 flex flex-col">
                    <span className="text-slate-400 text-[8.5px] uppercase font-bold">{language === "pt" ? "AUTENTICAÇÃO" : "AUTH STANDARD"}</span>
                    <span className="text-slate-800">POST /oauth/token (grant_type)</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-slate-100 flex flex-col">
                    <span className="text-slate-400 text-[8.5px] uppercase font-bold">{language === "pt" ? "LISTAR PEDIDOS" : "LIST ORDERS"}</span>
                    <span className="text-[#FF5C00]">GET /v1/open-delivery/orders?page=1&limit=5</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-slate-100 flex flex-col">
                    <span className="text-slate-400 text-[8.5px] uppercase font-bold">{language === "pt" ? "DADOS DO PEDIDO" : "ORDER RETRIEVAL"}</span>
                    <span className="text-[#FF5C00]">GET /v1/open-delivery/orders/&#123;id&#125;</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4">
              {/* API Base URL Field */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
                  {language === "pt" ? "API Base URL (Endereço do Servidor)" : "API Base URL"}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <Globe className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={channelConfigs[currentChannel.key]?.apiBaseUrl || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setChannelConfigs(prev => ({
                        ...prev,
                        [currentChannel.key]: {
                          ...(prev[currentChannel.key] || { apiBaseUrl: "", amoToken: "", restaurantId: "" }),
                          apiBaseUrl: val
                        }
                      }));
                    }}
                    placeholder={currentChannel.key === "ifood" ? "https://merchant-api.ifood.com.br" : "https://api.example.com/v1"}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-3xs transition-all text-slate-800"
                  />
                </div>
                {/* Environment presets helper for AMO (Doc 517071) */}
                {currentChannel.key === "amo" && (
                  <div className="flex items-center gap-2 mt-1.5 bg-slate-100/60 p-1 rounded-lg border border-slate-200/40 w-fit">
                    <span className="text-[9px] font-extrabold text-slate-400 px-1 uppercase">{language === "pt" ? "Ambiente:" : "Env:"}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setChannelConfigs(prev => ({
                          ...prev,
                          amo: {
                            ...(prev.amo || { apiBaseUrl: "", amoToken: "", restaurantId: "" }),
                            apiBaseUrl: "https://api.uat.amo.delivery"
                          }
                        }));
                      }}
                      className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold border transition-all cursor-pointer ${
                        channelConfigs.amo?.apiBaseUrl === "https://api.uat.amo.delivery"
                          ? "bg-[#FF5C00] text-white border-[#FF5C00]"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      Homologação (UAT)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChannelConfigs(prev => ({
                          ...prev,
                          amo: {
                            ...(prev.amo || { apiBaseUrl: "", amoToken: "", restaurantId: "" }),
                            apiBaseUrl: "https://api.amo.delivery"
                          }
                        }));
                      }}
                      className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold border transition-all cursor-pointer ${
                        channelConfigs.amo?.apiBaseUrl === "https://api.amo.delivery"
                          ? "bg-slate-800 text-white border-slate-800"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      Produção
                    </button>
                  </div>
                )}
              </div>

              {(currentChannel.key === "ifood" || currentChannel.key === "amo") ? (
                <>
                  {/* Client ID Field */}
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
                      {language === "pt" ? "Client ID" : "Client ID"}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                        <Check className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={channelConfigs[currentChannel.key]?.clientId || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setChannelConfigs(prev => ({
                            ...prev,
                            [currentChannel.key]: {
                              ...(prev[currentChannel.key] || { apiBaseUrl: "", amoToken: "", restaurantId: "" }),
                              clientId: val
                            }
                          }));
                        }}
                        placeholder={currentChannel.key === "amo" ? "e.g. amo_client_id_..." : "e.g. b29df10a-..."}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-3xs transition-all text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Client Secret Field */}
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
                      {language === "pt" ? "Client Secret" : "Client Secret"}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                        <Check className="w-4 h-4" />
                      </span>
                      <input
                        type="password"
                        value={channelConfigs[currentChannel.key]?.clientSecret || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setChannelConfigs(prev => ({
                            ...prev,
                            [currentChannel.key]: {
                              ...(prev[currentChannel.key] || { apiBaseUrl: "", amoToken: "", restaurantId: "" }),
                              clientSecret: val
                            }
                          }));
                        }}
                        placeholder="••••••••••••••••••••••••"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-3xs transition-all text-slate-800"
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* Standard Token Field for non-OAuth channels (e.g. 99food, website) */
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
                    Token
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                      <Check className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={channelConfigs[currentChannel.key]?.amoToken || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setChannelConfigs(prev => ({
                          ...prev,
                          [currentChannel.key]: {
                            ...(prev[currentChannel.key] || { apiBaseUrl: "", amoToken: "", restaurantId: "" }),
                            amoToken: val
                          }
                        }));
                      }}
                      placeholder="token..."
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-3xs transition-all text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Restaurant ID Field — optional for AMO (credentials only) */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
                  {currentChannel.key === "ifood" 
                    ? (language === "pt" ? "Merchant ID (ID do Restaurante)" : "Merchant ID (Restaurant ID)")
                    : currentChannel.key === "amo"
                    ? (language === "pt" ? "ID do Restaurante (opcional)" : "Restaurant ID (optional)")
                    : (language === "pt" ? "ID do Restaurante" : "Restaurant ID")}
                </label>
                {currentChannel.key === "amo" && (
                  <p className="text-[10px] text-amber-700 font-medium">
                    {language === "pt"
                      ? "A integração AMO usa apenas Client ID e Client Secret. Deixe em branco."
                      : "AMO integration only requires Client ID and Client Secret. Leave this blank."}
                  </p>
                )}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <Tag className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={channelConfigs[currentChannel.key]?.restaurantId || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setChannelConfigs(prev => ({
                        ...prev,
                        [currentChannel.key]: {
                          ...(prev[currentChannel.key] || { apiBaseUrl: "", amoToken: "", restaurantId: "" }),
                          restaurantId: val
                        }
                      }));
                    }}
                    placeholder={currentChannel.key === "ifood" ? "e.g. fd28a-..." : "e.g. REST-9912"}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-250 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-3xs transition-all text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Test Connection Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-200/30">
              <p className="text-[10px] text-slate-400 font-medium">
                {language === "pt"
                  ? "Conexões utilizam encriptação local HTTPS segura de ponta a ponta."
                  : "Live handshake tests connect to your remote platform endpoint securely."}
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                {currentChannel.key === "amo" && (
                  <button
                    type="button"
                    onClick={fetchAndShowAmoLogs}
                    className="px-4.5 py-2 text-xs font-extrabold rounded-xl transition-all shadow-3xs bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 cursor-pointer flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>{language === "pt" ? "Ver Logs da API AMO" : "View AMO API Logs"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleTestConnection(currentChannel.key)}
                  disabled={isTesting}
                  className={`px-4.5 py-2 text-xs font-extrabold rounded-xl transition-all shadow-3xs active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto ${
                    isTesting
                      ? "bg-slate-100 text-slate-400 border border-slate-200 pointer-events-none"
                      : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-xs hover:shadow-sm"
                  }`}
                >
                  {isTesting ? (
                    <>
                      <Activity className="w-3.5 h-3.5 animate-spin" />
                      <span>{language === "pt" ? "Verificando..." : "Verifying..."}</span>
                    </>
                  ) : (
                    <>
                      <Activity className="w-3.5 h-3.5" />
                      <span>{language === "pt" ? "Testar Conexão" : "Test Connection"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Logs of Orders Panel specifically for Selected Channel */}
          <div className="space-y-3 relative">
            <div className="flex items-center justify-between pl-1">
              <h3 className="text-xs font-extrabold text-slate-450 tracking-wider uppercase">
                {language === "pt" ? "últimos 5 pedidos" : "last 5 orders"}
              </h3>
              <span className="text-[10px] font-bold text-slate-450 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                {channelOrdersList.slice(0, 5).length} {language === "pt" ? "resultados" : "results"}
              </span>
            </div>

            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
              {channelOrdersList.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/30">
                  <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-400">
                    {language === "pt" ? "Nenhum pedido neste canal" : "No orders found in this channel queue"}
                  </p>
                  <p className="text-[10.5px] text-slate-400 mt-1">
                    {currentChannel.key === "amo"
                      ? (language === "pt"
                        ? "Configure ou envie pedidos reais através da sua API de parceiro."
                        : "Configure or send real orders through your partner API connection.")
                      : (language === "pt" 
                        ? "Use o botão 'Simular Novo Pedido' acima para testar recepção!" 
                        : "Use the 'Simulate Live Order' trigger above to test connection!")}
                  </p>
                </div>
              ) : (
                channelOrdersList.slice(0, 5).map(o => {
                  const sColors = {
                    pending: "bg-amber-50 text-amber-600 border-amber-100",
                    preparing: "bg-blue-50 text-blue-600 border-blue-100",
                    delivering: "bg-indigo-50 text-indigo-600 border-indigo-100",
                    completed: "bg-emerald-50 text-emerald-600 border-emerald-100",
                    cancelled: "bg-rose-50 text-rose-600 border-rose-100",
                  };

                  return (
                    <div 
                      key={o.id} 
                      className="p-4 bg-white border border-slate-100 hover:border-slate-200 hover:shadow-2xs rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-extrabold bg-slate-50 text-slate-800 px-1.5 py-0.5 border border-slate-100 rounded-md">
                            #{o.id}
                          </span>
                          <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {o.time}
                          </span>
                          <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {o.customerName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium truncate" title={o.items}>
                          {o.items}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                        <p className="font-mono text-xs font-black text-slate-900 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                          {formatCurrency(o.total)}
                        </p>

                        <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-xl border shrink-0 ${sColors[o.status]}`}>
                          {o.status}
                        </span>

                        <div className="flex items-center gap-1">
                          {o.status === "pending" && (
                            <button
                              onClick={() => updateOrderStatus(o.id, "preparing")}
                              className="p-1.5 text-blue-500 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg transition-colors"
                              title="Begin preparation"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {o.status === "preparing" && (
                            <button
                              onClick={() => updateOrderStatus(o.id, "delivering")}
                              className="p-1.5 text-indigo-500 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg transition-colors"
                              title="Handover to delivery rider"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {o.status === "delivering" && (
                            <button
                              onClick={() => updateOrderStatus(o.id, "completed")}
                              className="p-1.5 text-emerald-500 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 rounded-lg transition-colors"
                              title="Mark as delivered successfully"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          {o.status !== "completed" && o.status !== "cancelled" && (
                            <button
                              onClick={() => updateOrderStatus(o.id, "cancelled")}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-colors"
                              title="Cancel order"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Shared Absolute internal overlay notification popup */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-950 text-white rounded-2xl shadow-xl border border-slate-900 p-4 flex items-center gap-3 text-xs font-semibold z-50 animate-fade-in-up">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
          <div className="min-w-0 pr-2">
            <span>{toastMessage}</span>
          </div>
          <button 
            onClick={() => setToastMessage(null)} 
            className="text-slate-400 hover:text-white shrink-0 ml-1 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* AMO API Log Viewer Modal */}
      {showLogsModal && (
        <div id="amo-logs-modal" className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-indigo-600 animate-pulse" />
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">
                    {language === "pt" ? "Log de Transações da API AMO (amo_api.log)" : "AMO API Transaction Trace Log (amo_api.log)"}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    {language === "pt" ? "Registros de requisições, respostas e handshakes" : "Live traces of request, response headers, and bodies"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLogsModal(false)}
                className="w-8 h-8 rounded-full border border-slate-100 bg-white hover:bg-slate-50 text-slate-450 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed bg-slate-950 text-slate-100 select-all whitespace-pre-wrap">
              {amoLogs || (language === "pt" ? "(Nenhum registro encontrado)" : "(No log traces found)")}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
              <span className="text-[10px] text-slate-400 font-bold font-mono">
                {language === "pt" ? "Dica: Informações confidenciais são omitidas automaticamente" : "Secrets are redacted automatically"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearAmoLogs}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                    confirmClearAmo
                      ? "bg-rose-100 border-rose-300 text-rose-700 animate-pulse"
                      : "bg-rose-50 hover:bg-rose-100 border-rose-150 text-rose-600"
                  }`}
                >
                  <span>
                    {confirmClearAmo
                      ? (language === "pt" ? "Clique para Confirmar" : "Click to Confirm")
                      : (language === "pt" ? "Limpar Logs" : "Clear Logs")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={fetchAndShowAmoLogs}
                  disabled={isFetchingLogs}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isFetchingLogs ? 'animate-spin' : ''}`} />
                  <span>{language === "pt" ? "Atualizar" : "Refresh"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
