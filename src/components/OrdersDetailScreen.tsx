import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  ArrowLeft, 
  ShoppingBag, 
  Calendar, 
  Filter, 
  TrendingUp, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Globe, 
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  HelpCircle,
  Truck,
  MapPin,
  Utensils,
  ChefHat,
  Bike,
  User,
  X,
  MessageCircle,
  AlarmClock
} from "lucide-react";
import { Order, OrderStatus } from "../types";
import { formatCurrency, safeStorage } from "../utils";
import { updateAmoOrderStatusViaApi } from "../amoOrders";

interface OrdersDetailScreenProps {
  language: "en" | "pt";
  onBack: () => void;
  initialChannel?: string;
}

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

export default function OrdersDetailScreen({ language, onBack, initialChannel }: OrdersDetailScreenProps) {
  // Read state from localStorage and keep synced
  const [orders, setOrders] = useState<Order[]>([]);
  const [integrations, setIntegrations] = useState<Record<string, boolean>>({});
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

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<{ customerName: string; order?: Order } | null>(null);

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
      bgLight: `${preset.bg}/5`,
      hover: preset.hover,
      border: `${preset.border}/20`,
      text: preset.text,
      desc,
      sound,
    };
  };

  const INT_CHANNELS = useMemo(() => [
    getChannelDetails("all", language === "pt" ? "Todos" : "All", "purple", "ping", "All channels combined"),
    getChannelDetails("ifood", "iFood", "red", "chime", "iFood Delivery Portal"),
    getChannelDetails("amo", "AMO", "orange", "ping", "AMO Delivery App"),
    getChannelDetails("99food", "99Food", "yellow", "beep", "99Food Platform"),
    getChannelDetails("website", "Website", "indigo", "kaching", "Direct Web Store"),
  ], [channelConfigs, language]);

  // Filter States
  const [selectedChannel, setSelectedChannel] = useState<string>(initialChannel || "all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "yesterday" | "7days" | "custom" | "period">("all");
  const [customDate, setCustomDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  const [selectedStatuses, setSelectedStatuses] = useState<Record<OrderStatus, boolean>>({
    pending: true,
    preparing: true,
    delivering: true,
    completed: true,
    cancelled: true,
  });

  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>({
    delivery: true,
    pickup: true,
    dine_in: true,
  });

  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when filters or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedChannel, dateFilter, customDate, startDate, endDate, selectedStatuses, selectedTypes, searchTerm]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Sync / retrieve state on mount and keep sync on storage event
  useEffect(() => {
    const handleSync = () => {
      try {
        const savedInts = safeStorage.getItem("orders_integrations");
        if (savedInts) {
          setIntegrations(JSON.parse(savedInts));
        }
      } catch {}

      try {
        const savedConfigs = safeStorage.getItem("orders_channel_configs");
        if (savedConfigs) {
          setChannelConfigs(JSON.parse(savedConfigs));
        }
      } catch {}

      try {
        const savedOrders = safeStorage.getItem("orders_list");
        if (savedOrders) {
          setOrders(JSON.parse(savedOrders));
        }
      } catch {}
    };

    handleSync();
    window.addEventListener("storage", handleSync);
    return () => window.removeEventListener("storage", handleSync);
  }, []);

  // Click away listener for the status & type dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Update order status logic (compatible with AMO webhook integrations)
  const handleUpdateStatus = async (order: Order, nextStatus: OrderStatus) => {
    setUpdatingOrderId(order.id);

    // If channel is AMO and integrating with external API
    if (order.channel === "amo" && order.amoData) {
      try {
        const result = await updateAmoOrderStatusViaApi(order, nextStatus);
        if (!result.success || !result.order) {
          showToast(
            language === "pt"
              ? `Falha ao atualizar pedido na API AMO: ${result.message || "Erro desconhecido"}`
              : `Failed to update order on AMO API: ${result.message || "Unknown error"}`
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

    // Direct local state update for mock channels or offline mode
    const updated = orders.map(o => (o.id === order.id ? { ...o, status: nextStatus } : o));
    setOrders(updated);
    try {
      safeStorage.setItem("orders_list", JSON.stringify(updated));
    } catch {}
    window.dispatchEvent(new Event("storage"));

    showToast(
      language === "pt"
        ? `Status do pedido ${order.id} atualizado para "${nextStatus}".`
        : `Order ${order.id} status updated to "${nextStatus}".`
    );
    setUpdatingOrderId(null);
  };

  // Date comparison helpers
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // Filter logic
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // 1. Channel Filter
      if (selectedChannel !== "all" && order.channel !== selectedChannel) return false;

      // 2. Date Filter
      if (order.date) {
        if (dateFilter === "today" && order.date !== todayStr) return false;
        if (dateFilter === "yesterday" && order.date !== yesterdayStr) return false;
        if (dateFilter === "7days" && order.date < sevenDaysAgoStr) return false;
        if (dateFilter === "custom" && order.date !== customDate) return false;
        if (dateFilter === "period") {
          if (startDate && order.date < startDate) return false;
          if (endDate && order.date > endDate) return false;
        }
      } else {
        // If order doesn't have a date and user selected a date filter, only permit today
        if (dateFilter !== "all" && dateFilter !== "today") return false;
      }

      // 3. Status Filter
      if (!selectedStatuses[order.status]) return false;

      // 4. Order Type Filter
      const rawType = (order.type || "delivery").toLowerCase();
      const oType = (rawType === "pickup" || rawType === "takeout") ? "pickup" : (rawType === "dine_in" || rawType === "dine-in" || rawType === "local") ? "dine_in" : "delivery";
      if (!selectedTypes[oType]) return false;

      // 5. Search Filter
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase();
        const matchesId = order.id.toLowerCase().includes(query);
        const matchesName = order.customerName.toLowerCase().includes(query);
        const matchesItems = order.items.toLowerCase().includes(query);
        if (!matchesId && !matchesName && !matchesItems) return false;
      }

      return true;
    });
  }, [orders, selectedChannel, dateFilter, customDate, startDate, endDate, selectedStatuses, selectedTypes, searchTerm, todayStr, yesterdayStr, sevenDaysAgoStr]);

  // Statistics/Reports Calculations for the selected channel & selected date
  const stats = useMemo(() => {
    const activeOrders = filteredOrders.filter(o => o.status !== "cancelled");
    const cancelledOrders = filteredOrders.filter(o => o.status === "cancelled");
    const totalRevenue = activeOrders.reduce((sum, o) => sum + o.total, 0);
    const averageTicket = activeOrders.length > 0 ? totalRevenue / activeOrders.length : 0;

    return {
      totalActiveCount: activeOrders.length,
      totalCancelledCount: cancelledOrders.length,
      totalCount: filteredOrders.length,
      totalRevenue,
      averageTicket
    };
  }, [filteredOrders]);

  const activeChannelConfig = useMemo(() => {
    return INT_CHANNELS.find(c => c.key === selectedChannel) || INT_CHANNELS[0];
  }, [selectedChannel, INT_CHANNELS]);

  const ITEMS_PER_PAGE = 50;
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  // Status Labels and Color themes for badges
  const getStatusBadgeStyles = (status: OrderStatus) => {
    switch (status) {
      case "completed":
        return "bg-emerald-50 text-emerald-700 border border-emerald-100";
      case "pending":
        return "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse";
      case "preparing":
        return "bg-blue-50 text-blue-700 border border-blue-100";
      case "delivering":
        return "bg-purple-50 text-purple-700 border border-purple-100";
      case "cancelled":
        return "bg-rose-50 text-rose-600 border border-rose-100";
      default:
        return "bg-slate-50 text-slate-700 border border-slate-100";
    }
  };

  const getStatusLabel = (status: OrderStatus) => {
    if (language === "pt") {
      switch (status) {
        case "pending": return "Pendente";
        case "preparing": return "Preparo";
        case "delivering": return "Em Trânsito";
        case "completed": return "Entregue";
        case "cancelled": return "Cancelado";
      }
    } else {
      switch (status) {
        case "pending": return "Pending";
        case "preparing": return "Preparing";
        case "delivering": return "Delivering";
        case "completed": return "Delivered";
        case "cancelled": return "Cancelled";
      }
    }
    return status;
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 active:bg-slate-100 rounded-xl transition-all shadow-3xs cursor-pointer flex items-center justify-center"
            title={language === "pt" ? "Voltar ao Início" : "Back to Home"}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>{language === "pt" ? "Controle Detalhado de Pedidos" : "Detailed Orders Control"}</span>
              <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-full font-bold">
                Orders Detail
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {language === "pt" 
                ? "Painel expandido de monitoramento, triagem rápida de pedidos, relatórios e filtros detalhados."
                : "Expanded monitoring panel, fast order sorting, reports, and deep filters."}
            </p>
          </div>
        </div>

        {/* Integration Status summary */}
        <div className="flex items-center gap-2">
          {INT_CHANNELS.filter(ch => ch.key !== "all").map(ch => {
            const isChActive = !!integrations[ch.key];
            return (
              <span 
                key={ch.key} 
                className={`text-[10px] font-black px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                  isChActive 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100/70" 
                    : "bg-slate-50 text-slate-400 border-slate-100"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isChActive ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
                {ch.name}
              </span>
            );
          })}
        </div>
      </div>

      {/* Top Navigation Tabs - Style 'tabs', one for each channel */}
      <div className="bg-white border border-slate-100 rounded-2xl p-2.5 shadow-2xs flex flex-wrap gap-1 w-full select-none">
        {INT_CHANNELS.map(ch => {
          const isChActive = ch.key === "all"
            ? Object.values(integrations).some(Boolean)
            : !!integrations[ch.key];
          const isSelected = selectedChannel === ch.key;
          const chanCount = orders.filter(o => (ch.key === "all" ? true : o.channel === ch.key) && o.status !== "cancelled").length;

          return (
            <button
              key={ch.key}
              onClick={() => setSelectedChannel(ch.key)}
              className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-between gap-3 cursor-pointer ${
                isSelected 
                  ? `${ch.color} text-white shadow-sm ring-1 ring-white/10 scale-[1.01]` 
                  : `text-slate-600 bg-transparent hover:bg-slate-50 border border-transparent`
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-2 h-2 rounded-full ${isChActive ? (isSelected ? "bg-white" : "bg-emerald-500") : "bg-slate-300"}`} />
                <span className="truncate">{ch.name}</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-extrabold shrink-0 ${
                isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {chanCount} {language === "pt" ? "pedidos" : "orders"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Grid: Left Sidebar (Filters & Reports) | Center Content (Orders List) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* LEFT SIDEBAR: FILTERS AND REPORTS (25% width approx) */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Section 1: Filters */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100/80">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-slate-600" />
                <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                  {language === "pt" ? "Filtros de Busca" : "Search Filters"}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setDateFilter("all");
                  setSelectedStatuses({
                    pending: true,
                    preparing: true,
                    delivering: true,
                    completed: true,
                    cancelled: true,
                  });
                  setSearchTerm("");
                }}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                {language === "pt" ? "Limpar" : "Clear"}
              </button>
            </div>

            {/* Date Filter Component */}
            <div className="space-y-2.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{language === "pt" ? "Filtro de Data" : "Date Filter"}</span>
              </label>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setDateFilter("all")}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    dateFilter === "all" 
                      ? "bg-slate-900 border-slate-900 text-white" 
                      : "bg-slate-50 border-slate-150 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  {language === "pt" ? "Todos" : "All"}
                </button>
                <button
                  onClick={() => setDateFilter("today")}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    dateFilter === "today" 
                      ? "bg-slate-900 border-slate-900 text-white" 
                      : "bg-slate-50 border-slate-150 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  {language === "pt" ? "Hoje" : "Today"}
                </button>
                <button
                  onClick={() => setDateFilter("yesterday")}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    dateFilter === "yesterday" 
                      ? "bg-slate-900 border-slate-900 text-white" 
                      : "bg-slate-50 border-slate-150 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  {language === "pt" ? "Ontem" : "Yesterday"}
                </button>
                <button
                  onClick={() => setDateFilter("7days")}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    dateFilter === "7days" 
                      ? "bg-slate-900 border-slate-900 text-white" 
                      : "bg-slate-50 border-slate-150 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  {language === "pt" ? "7 Dias" : "7 Days"}
                </button>
              </div>

              {/* Custom date input if 'custom' is active or just as helper */}
              <div className="pt-1.5">
                <button
                  onClick={() => setDateFilter("custom")}
                  className={`w-full px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center justify-between ${
                    dateFilter === "custom"
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "bg-slate-50 border-slate-150 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span>{language === "pt" ? "Data Personalizada" : "Custom Date"}</span>
                  <span className="text-[10px] font-mono opacity-80">{customDate}</span>
                </button>

                {dateFilter === "custom" && (
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full mt-2 px-3 py-2 text-xs font-medium font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                  />
                )}
              </div>

              {/* Period / Date Range option */}
              <div className="pt-1.5">
                <button
                  type="button"
                  onClick={() => setDateFilter("period")}
                  className={`w-full px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center justify-between ${
                    dateFilter === "period"
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "bg-slate-50 border-slate-150 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span>{language === "pt" ? "Período" : "Period"}</span>
                  <span className="text-[10px] font-mono opacity-80">
                    {startDate && endDate ? `${startDate} - ${endDate}` : "De / Até"}
                  </span>
                </button>

                {dateFilter === "period" && (
                  <div className="mt-2 space-y-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        {language === "pt" ? "De:" : "From:"}
                      </span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        {language === "pt" ? "Até:" : "To:"}
                      </span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Status Dropdown Filter */}
            <div className="space-y-2.5 pt-1.5" ref={statusDropdownRef}>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>{language === "pt" ? "Status do Pedido" : "Order Status"}</span>
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-between transition-all cursor-pointer"
                >
                  <span className="truncate">
                    {(() => {
                      const selectedKeys = Object.keys(selectedStatuses) as OrderStatus[];
                      const selectedCount = selectedKeys.filter(k => selectedStatuses[k]).length;
                      const totalCount = selectedKeys.length;
                      if (selectedCount === 0) return language === "pt" ? "Nenhum status" : "No statuses";
                      if (selectedCount === totalCount) return language === "pt" ? "Todos os status" : "All statuses";
                      
                      return language === "pt" 
                        ? `${selectedCount} selecionados`
                        : `${selectedCount} selected`;
                    })()}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isStatusDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {isStatusDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-md p-3 z-30 space-y-1.5 max-h-[220px] overflow-y-auto">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {language === "pt" ? "Filtrar por" : "Filter by"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const allOn = {
                            pending: true,
                            preparing: true,
                            delivering: true,
                            completed: true,
                            cancelled: true,
                          };
                          setSelectedStatuses(allOn);
                        }}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                      >
                        {language === "pt" ? "Todos" : "All"}
                      </button>
                    </div>

                    {(["pending", "preparing", "delivering", "completed", "cancelled"] as OrderStatus[]).map((st) => {
                      return (
                        <label 
                          key={st}
                          className="flex items-center gap-2.5 p-2 bg-slate-50 hover:bg-slate-100/75 border border-slate-150/50 rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedStatuses[st]}
                            onChange={(e) => {
                              setSelectedStatuses(prev => ({
                                ...prev,
                                [st]: e.target.checked
                              }));
                            }}
                            className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div className="flex items-center justify-between flex-1 min-w-0">
                            <span className="text-xs font-bold text-slate-700">
                              {getStatusLabel(st)}
                            </span>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              st === "completed" ? "bg-emerald-500" :
                              st === "pending" ? "bg-amber-500" :
                              st === "preparing" ? "bg-blue-500" :
                              st === "delivering" ? "bg-purple-500" :
                              "bg-rose-500"
                            }`} />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Order Type Dropdown Filter */}
            <div className="space-y-2.5 pt-1.5" ref={typeDropdownRef}>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                <span>{language === "pt" ? "Tipo de Pedido" : "Order Type"}</span>
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-between transition-all cursor-pointer"
                >
                  <span className="truncate">
                    {(() => {
                      const selectedKeys = Object.keys(selectedTypes);
                      const selectedCount = selectedKeys.filter(k => selectedTypes[k]).length;
                      const totalCount = selectedKeys.length;
                      if (selectedCount === 0) return language === "pt" ? "Nenhum tipo" : "No types";
                      if (selectedCount === totalCount) return language === "pt" ? "Todos os tipos" : "All types";
                      
                      return language === "pt" 
                        ? `${selectedCount} selecionados`
                        : `${selectedCount} selected`;
                    })()}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isTypeDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {isTypeDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-md p-3 z-30 space-y-1.5 max-h-[220px] overflow-y-auto">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {language === "pt" ? "Filtrar por tipo" : "Filter by type"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const allOn = {
                            delivery: true,
                            pickup: true,
                            dine_in: true,
                          };
                          setSelectedTypes(allOn);
                        }}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                      >
                        {language === "pt" ? "Todos" : "All"}
                      </button>
                    </div>

                    {[
                      { key: "delivery", labelPt: "Entrega (Delivery)", labelEn: "Delivery", icon: Truck, color: "text-blue-500 bg-blue-50 border-blue-100" },
                      { key: "pickup", labelPt: "Retirada (Pickup)", labelEn: "Pickup", icon: MapPin, color: "text-purple-500 bg-purple-50 border-purple-100" },
                      { key: "dine_in", labelPt: "Consumo no Local (Dine-in)", labelEn: "Dine-in", icon: Utensils, color: "text-emerald-500 bg-emerald-50 border-emerald-100" }
                    ].map((tp) => {
                      const IconComp = tp.icon;
                      return (
                        <label 
                          key={tp.key}
                          className="flex items-center gap-2.5 p-2 bg-slate-50 hover:bg-slate-100/75 border border-slate-150/50 rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTypes[tp.key]}
                            onChange={(e) => {
                              setSelectedTypes(prev => ({
                                ...prev,
                                [tp.key]: e.target.checked
                              }));
                            }}
                            className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div className="flex items-center justify-between flex-1 min-w-0">
                            <span className="text-xs font-bold text-slate-700">
                              {language === "pt" ? tp.labelPt : tp.labelEn}
                            </span>
                            <div className={`p-1 rounded-md ${tp.color} border`}>
                              <IconComp className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Reports (Relatórios) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-md relative overflow-hidden space-y-4">
            {/* Decorative background circle */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800">
              <FileText className="w-4 h-4 text-indigo-400" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-300">
                {language === "pt" ? "Relatório Rápido" : "Quick Report"}
              </h3>
            </div>

            <div className="space-y-4 font-mono">
              {/* Total Active Orders */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-sans">{language === "pt" ? "Pedidos Ativos:" : "Active Orders:"}</span>
                <span className="font-bold text-slate-100 text-sm">{stats.totalActiveCount}</span>
              </div>

              {/* Total Revenue */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-sans">{language === "pt" ? "Faturamento:" : "Total Revenue:"}</span>
                <span className="font-bold text-emerald-400 text-sm">{formatCurrency(stats.totalRevenue)}</span>
              </div>

              {/* Average Ticket */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-sans">{language === "pt" ? "Ticket Médio:" : "Average Ticket:"}</span>
                <span className="font-bold text-slate-200">{formatCurrency(stats.averageTicket)}</span>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-800" />

              {/* Cancelled Orders count */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-sans">{language === "pt" ? "Cancelados:" : "Cancelled:"}</span>
                <span className="font-bold text-rose-400">{stats.totalCancelledCount}</span>
              </div>

              {/* Quick ratio helper */}
              <div className="text-[10px] text-slate-500 italic font-sans leading-relaxed pt-1">
                {language === "pt" 
                  ? "* Pedidos cancelados foram excluídos do faturamento e ticket médio."
                  : "* Cancelled orders are excluded from total revenue and ticket metrics."}
              </div>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: ALL ORDERS LIST (75% width approx) */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Search bar & Status filter banner */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center gap-3 w-full">
            <div className="relative w-full flex-1">
              <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
              <input
                type="text"
                placeholder={language === "pt" ? "Buscar por nº pedido, cliente, produtos..." : "Search by order number, customer, items..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick stats badges */}
            <div className="flex items-center gap-1.5 shrink-0 self-stretch sm:self-auto justify-end">
              <span className="text-[11px] font-bold text-slate-500">
                {filteredOrders.length} {language === "pt" ? "encontrados" : "found"}
              </span>
            </div>
          </div>

          {/* Orders list viewport */}
          {filteredOrders.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-2xs">
              <div className="bg-slate-50 p-4 rounded-full border border-slate-100 text-slate-400 inline-block mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">
                {language === "pt" ? "Nenhum pedido encontrado" : "No orders found"}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {language === "pt"
                  ? "Experimente alterar as opções de filtros na barra lateral esquerda ou limpar o termo de busca."
                  : "Try changing the filter options in the left sidebar or clearing the search box."}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-100/90 rounded-2xl shadow-2xs overflow-hidden divide-y divide-slate-100/70">
              {paginatedOrders.map((order) => {
                const isAmo = order.channel === "amo";
                const orderChannelConfig = INT_CHANNELS.find(c => c.key === order.channel) || {
                  name: order.channel,
                  color: "bg-slate-500",
                  text: "text-slate-500",
                  key: order.channel
                };

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
                    className="transition-all duration-200 overflow-hidden group order-card bg-white"
                  >
                    {/* Header line of the order item */}
                    <div className={`p-4 sm:px-5 bg-slate-50/40 flex flex-wrap items-center justify-between gap-3 transition-all ${expandedOrders[order.id] ? "border-b border-slate-100/60" : ""}`}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Label do canal em primeiro */}
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${orderChannelConfig.color}/10 ${orderChannelConfig.text}`}>
                          {orderChannelConfig.name}
                        </span>

                        {/* Número do pedido sem o prefixo do canal */}
                        <span 
                          onClick={() => setExpandedOrders(prev => ({ ...prev, [order.id]: !prev[order.id] }))}
                          title={language === "pt" ? "Clique para detalhes" : "Click for details"}
                          className="text-[10px] font-black font-mono px-1.5 py-0.5 rounded border bg-slate-100 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 active:bg-indigo-100 text-slate-700 cursor-pointer select-none transition-colors flex items-center gap-1"
                        >
                          #{order.id.replace(/^[a-zA-Z0-9]+-/, "")}
                          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${expandedOrders[order.id] ? "rotate-180 text-indigo-500" : ""}`} />
                        </span>

                        {/* Nome do cliente que consta no pedido */}
                        <span 
                          onClick={() => setSelectedCustomerProfile({ customerName: order.customerName, order })}
                          className="text-xs font-black text-slate-900 hover:text-indigo-600 cursor-pointer hover:underline transition-all decoration-dotted"
                          title={language === "pt" ? "Ver perfil do cliente" : "View customer profile"}
                        >
                          {order.customerName}
                        </span>
                        
                        <span className="text-slate-300 mx-0.5">·</span>

                        <div className="flex items-center gap-2 text-slate-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span className="text-[11px] font-bold font-mono">
                              {(() => {
                                const dateVal = order.date ? order.date : todayStr;
                                const parts = dateVal.split("-");
                                return parts.length === 3 ? `${parts[2]}-${parts[1]}` : dateVal;
                              })()}
                            </span>
                          </div>
                          <span className="text-slate-300">·</span>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span className="text-[11px] font-bold font-mono">
                              {order.time}
                            </span>
                          </div>
                          {scheduledTime && (
                            <>
                              <span className="text-slate-300">·</span>
                              <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md" title={language === "pt" ? "Pedido Agendado" : "Scheduled Order"}>
                                <AlarmClock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="text-[11px] font-black font-mono">
                                  {formatLocalTime(scheduledTime)}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status de entrega e tipo de pedido à direita na mesma linha */}
                      <div className="flex items-center gap-2">
                        {(() => {
                          let IconComp = Clock;
                          let css = "bg-amber-50 text-amber-500 border-amber-200";
                          let label = getStatusLabel(order.status);
                          
                          if (order.status === "pending") {
                            IconComp = Clock;
                            css = "bg-amber-50 text-amber-500 border-amber-200 animate-pulse";
                          } else if (order.status === "preparing") {
                            IconComp = ChefHat;
                            css = "bg-purple-50 text-purple-600 border-purple-200";
                          } else if (order.status === "delivering") {
                            IconComp = Truck;
                            css = "bg-amber-50 text-amber-500 border-amber-200";
                          } else if (order.status === "completed") {
                            IconComp = CheckCircle2;
                            css = "bg-emerald-50 text-emerald-600 border-emerald-200";
                          } else if (order.status === "cancelled") {
                            IconComp = XCircle;
                            css = "bg-rose-50 text-rose-600 border-rose-200";
                          }

                          return (
                            <span 
                              title={label}
                              className={`p-1 rounded-lg border flex items-center justify-center ${css}`}
                            >
                              <IconComp className="w-4 h-4" />
                            </span>
                          );
                        })()}

                        {(() => {
                          const rawType = (order.type || "delivery").toLowerCase();
                          const oType = (rawType === "pickup" || rawType === "takeout") ? "pickup" : (rawType === "dine_in" || rawType === "dine-in" || rawType === "local") ? "dine_in" : "delivery";
                          const config = oType === "delivery" 
                            ? { label: language === "pt" ? "Entrega (Delivery)" : "Delivery", icon: Bike, css: "bg-blue-50 text-blue-600 border-blue-200" }
                            : oType === "pickup"
                            ? { label: language === "pt" ? "Retirada (Takeout)" : "Takeout", icon: MapPin, css: "bg-purple-50 text-purple-600 border-purple-200" }
                            : { label: language === "pt" ? "No Local (Dine-in)" : "Dine-in", icon: Utensils, css: "bg-emerald-50 text-emerald-600 border-emerald-200" };
                          
                          const IconComp = config.icon;
                          return (
                            <span 
                              title={config.label}
                              className={`p-1 rounded-lg border flex items-center justify-center ${config.css}`}
                            >
                              <IconComp className="w-4 h-4" />
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Content body containing items, price, and customer details */}
                    {expandedOrders[order.id] && (
                      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 animate-fade-in">
                        <div className="space-y-2.5 min-w-0 flex-1">
                          <div>
                            {(() => {
                              const amo = order.amoData as any;
                              const addressObj = amo?.delivery?.deliveryAddress;
                              const formatted = addressObj?.formattedAddress;
                              
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
                              
                              const formatLocalDateTime = (utcString: string) => {
                                try {
                                  const date = new Date(utcString);
                                  if (isNaN(date.getTime())) return utcString;
                                  const formatter = new Intl.DateTimeFormat("en-US", {
                                    timeZone: "America/Sao_Paulo",
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false
                                  });
                                  const parts = formatter.formatToParts(date);
                                  const day = parts.find(p => p.type === "day")?.value || "00";
                                  const month = parts.find(p => p.type === "month")?.value || "00";
                                  const year = parts.find(p => p.type === "year")?.value || "";
                                  const hour = parts.find(p => p.type === "hour")?.value || "00";
                                  const minute = parts.find(p => p.type === "minute")?.value || "00";
                                  return `${day}/${month}/${year} ${hour}:${minute}`;
                                } catch (err) {
                                  return utcString;
                                }
                              };

                              const rawType = (order.type || "delivery").toLowerCase();
                              const isDelivery = rawType === "delivery";

                              if (isDelivery || formatted) {
                                const coords = addressObj?.coordinates;
                                const hasCoords = coords?.latitude && coords?.longitude;
                                const mapsUrl = hasCoords
                                  ? `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`
                                  : formatted ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatted)}` : "";

                                return (
                                  <div className="flex flex-col gap-1.5 mb-1 bg-slate-50 border border-slate-100 p-2.5 rounded-lg w-fit">
                                    <div className="flex items-center gap-1.5 text-[11.5px] text-slate-600 font-semibold">
                                      {formatted ? (
                                        <>
                                          <a
                                            href={mapsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1 hover:bg-emerald-100/50 rounded transition-all group cursor-pointer flex items-center justify-center shrink-0"
                                            title={language === "pt" ? "Ver localização exata no Google Maps" : "View exact location on Google Maps"}
                                          >
                                            <MapPin className="w-3.5 h-3.5 text-emerald-500 group-hover:scale-110 transition-transform shrink-0" />
                                          </a>
                                          <span className="pr-1">{formatted}</span>
                                        </>
                                      ) : (
                                        <>
                                          <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                          <span className="pr-1">{language === "pt" ? "Entrega" : "Delivery"}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              } else if (order.type === "pickup") {
                                return (
                                  <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-slate-500 font-semibold mb-1 bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-lg w-fit">
                                    <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                    <span>{language === "pt" ? "Retirada (Takeout)" : "Takeout"}</span>
                                  </div>
                                );
                              } else if (order.type === "dine_in") {
                                return (
                                  <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500 font-semibold mb-1 bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-lg w-fit">
                                    <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    <span>{language === "pt" ? "Consumo no Local" : "Dine In (Table)"}</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}

                          </div>

                          {/* Order items text description */}
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-700 font-medium">
                            <div className="space-y-2 leading-relaxed">
                              {(() => {
                                const amoItems = (order.amoData as any)?.items;
                                if (Array.isArray(amoItems) && amoItems.length > 0) {
                                  return amoItems.map((item: any, idx: number) => {
                                    const qty = item.quantity || 1;
                                    const name = item.name || "";
                                    const obs = (item.specialInstructions || item.observation || "").trim();
                                    const options = item.options;

                                    return (
                                      <div key={idx} className="py-1 border-b border-slate-200/20 last:border-0 flex flex-col gap-0.5">
                                        <div className="flex items-baseline gap-1.5 flex-wrap">
                                          <span className="font-semibold text-slate-800">{qty}x {name}</span>
                                          {obs && (
                                            <span className="text-slate-400 font-normal italic text-[11px]">({obs})</span>
                                          )}
                                        </div>
                                        {/* Render options/extras if any */}
                                        {Array.isArray(options) && options.length > 0 && (
                                          <div className="ml-3 pl-2 border-l border-slate-200 mt-0.5 space-y-0.5">
                                            {options.map((opt: any, optIdx: number) => (
                                              <div key={optIdx} className="text-[11px] text-slate-500 font-medium">
                                                {opt.quantity || 1}x - {opt.name}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  });
                                }

                                const itemsList = order.items ? order.items.split(/,\s*/) : [];
                                return itemsList.map((item, idx) => {
                                  const trimmedItem = item.trim();
                                  if (!trimmedItem) return null;
                                  const match = trimmedItem.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
                                  
                                  if (match) {
                                    const name = match[1].trim();
                                    const observation = match[2].trim();
                                    return (
                                      <div key={idx} className="py-0.5 border-b border-slate-200/20 last:border-0 flex items-baseline gap-1.5 flex-wrap">
                                        <span className="font-semibold text-slate-800">{name}</span>
                                        <span className="text-slate-400 font-normal italic text-[11px]">({observation})</span>
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <div key={idx} className="py-0.5 border-b border-slate-200/20 last:border-0 text-slate-800 font-semibold">
                                        {trimmedItem}
                                      </div>
                                    );
                                  }
                                });
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Right actions and pricing details */}
                        <div className="sm:text-right flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-end gap-3 shrink-0 self-stretch sm:self-auto border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                          <div className="flex flex-col sm:items-end text-left sm:text-right">
                            <div className="text-[10px] text-slate-400">
                              <span className="font-semibold">{language === "pt" ? "Itens:" : "Items:"}</span>{" "}
                              <span className="font-mono font-bold text-slate-600">
                                {formatCurrency((order.amoData as any)?.total?.itemsPrice?.value ?? order.total)}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              <span className="font-semibold">{language === "pt" ? "Entrega:" : "Delivery:"}</span>{" "}
                              <span className="font-mono font-bold text-slate-600">
                                {formatCurrency((order.amoData as any)?.total?.otherFees?.value ?? 0)}
                              </span>
                            </div>
                            <span className="text-base font-black font-mono text-slate-900 mt-1 block">
                              {formatCurrency(order.total)}
                            </span>
                          </div>

                          {/* Interactive state actions inside the card list */}
                          {order.status === "pending" ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleUpdateStatus(order, "preparing")}
                                disabled={updatingOrderId === order.id}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-300 text-white font-extrabold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                ✓ {language === "pt" ? "Aceitar" : "Accept"}
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(order, "cancelled")}
                                disabled={updatingOrderId === order.id}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-300 text-white font-extrabold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                ✗ {language === "pt" ? "Rejeitar" : "Reject"}
                              </button>
                            </div>
                          ) : order.status === "preparing" ? (
                            <button
                              onClick={() => handleUpdateStatus(order, "delivering")}
                              disabled={updatingOrderId === order.id}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-indigo-300 text-white font-extrabold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              {language === "pt" ? "Despachar" : "Dispatch"}
                            </button>
                          ) : order.status === "delivering" ? (
                            <button
                              onClick={() => handleUpdateStatus(order, "completed")}
                              disabled={updatingOrderId === order.id}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-300 text-white font-extrabold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              ✓ {language === "pt" ? "Entregar" : "Complete"}
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 italic">
                              {language === "pt" ? "Ações Concluídas" : "Actions Closed"}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 sm:px-6 bg-slate-50/50">
                  <div className="text-xs text-slate-500 font-medium">
                    {language === "pt" ? (
                      <>
                        Mostrando <span className="font-semibold text-slate-700">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> a{" "}
                        <span className="font-semibold text-slate-700">{Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)}</span> de{" "}
                        <span className="font-semibold text-slate-700">{filteredOrders.length}</span> pedidos
                      </>
                    ) : (
                      <>
                        Showing <span className="font-semibold text-slate-700">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> to{" "}
                        <span className="font-semibold text-slate-700">{Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)}</span> of{" "}
                        <span className="font-semibold text-slate-700">{filteredOrders.length}</span> orders
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-slate-200 rounded-lg text-slate-500 bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-all cursor-pointer"
                      title={language === "pt" ? "Página Anterior" : "Previous Page"}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    {(() => {
                      const pages: (number | string)[] = [];
                      if (totalPages <= 5) {
                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                      } else {
                        if (currentPage <= 3) {
                          pages.push(1, 2, 3, 4, '...', totalPages);
                        } else if (currentPage >= totalPages - 2) {
                          pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                        } else {
                          pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
                        }
                      }

                      return pages.map((page, idx) => {
                        if (page === '...') {
                          return (
                            <span key={`ellipsis-${idx}`} className="px-2.5 py-1.5 text-xs text-slate-400 font-medium select-none">
                              ...
                            </span>
                          );
                        }
                        return (
                          <button
                            key={`page-${page}`}
                            onClick={() => setCurrentPage(Number(page))}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                              currentPage === page
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:bg-slate-100"
                            }`}
                          >
                            {page}
                          </button>
                        );
                      });
                    })()}

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-slate-200 rounded-lg text-slate-500 bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-all cursor-pointer"
                      title={language === "pt" ? "Próxima Página" : "Next Page"}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Alert Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-800 p-3.5 flex items-center gap-2.5 text-xs font-semibold z-50 animate-fade-in-up">
          <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>{toastMessage}</span>
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
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setSelectedCustomerProfile(null)}>
            <div className="bg-white border border-slate-100 rounded-3xl max-w-sm w-full p-6 shadow-xl relative animate-scale-up" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setSelectedCustomerProfile(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-50 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-gradient-to-tr from-indigo-50 to-indigo-100/50 rounded-2xl flex items-center justify-center border border-indigo-100/50 text-indigo-500 shadow-2xs shrink-0 animate-pulse-once">
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
