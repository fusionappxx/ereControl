import React, { useState, useMemo, useEffect } from "react";
import { 
  ArrowLeft, 
  Users, 
  Search, 
  TrendingUp, 
  ShoppingBag, 
  Phone, 
  MapPin, 
  DollarSign, 
  Plus, 
  Trash2, 
  Save, 
  Truck,
  Sparkles,
  ChevronDown,
  Asterisk,
  X,
  Layers,
  GripVertical,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { db } from "../firebase";
import { collection, doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
import { Order } from "../types";
import { formatCurrency } from "../utils";

const getNeighborhood = (addressStr: string): string => {
  if (!addressStr) return "";
  const cleaned = addressStr.trim();
  if (cleaned === "Não informado" || cleaned === "Not provided") {
    return cleaned;
  }
  
  // Try matching "Bairro: <neighborhood>" or "bairro: <neighborhood>"
  const match = cleaned.match(/(?:Bairro|bairro)\s*:\s*([^,;]+)/i);
  if (match && match[1]) {
    return match[1].trim();
  }

  // Fallback 1: split by comma, and find if any part contains "bairro"
  const parts = cleaned.split(",");
  for (const part of parts) {
    if (part.toLowerCase().includes("bairro")) {
      return part.replace(/(?:Bairro|bairro)\s*:\s*/i, "").trim();
    }
  }

  // Fallback 2: if it is a general address with multiple parts, the last part or second to last is often neighborhood/city
  if (parts.length > 2) {
    return parts[2].trim();
  } else if (parts.length > 1) {
    return parts[1].trim();
  }

  return cleaned;
};

interface ClientControlScreenProps {
  orders: Order[];
  language: "en" | "pt";
  onBack: () => void;
  initialSubTab?: "directory" | "prices" | "delivery" | "categories";
}

export default function ClientControlScreen({ orders, language, onBack, initialSubTab }: ClientControlScreenProps) {
  const [activeTab, setActiveTab] = useState<"directory" | "prices" | "delivery" | "categories">("directory");

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "count" | "spent">("spent");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Password edit state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedClientForPassword, setSelectedClientForPassword] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const handleOpenPasswordModal = async (client: any) => {
    setSelectedClientForPassword(client);
    setNewPassword("");
    setCurrentPassword("");
    setPasswordError("");
    setPasswordSuccess("");
    setIsPasswordModalOpen(true);
    setIsLoadingPassword(true);

    try {
      const cleanPhone = client.phone.replace(/\D/g, "");
      if (cleanPhone) {
        const userDocRef = doc(db, "storefront_users", cleanPhone);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setCurrentPassword(data.password || "");
          setNewPassword(data.password || "");
        } else {
          setCurrentPassword("");
        }
      }
    } catch (err) {
      console.error("Error fetching user password:", err);
      setPasswordError(language === "pt" ? "Erro ao carregar dados do usuário." : "Error loading user data.");
    } finally {
      setIsLoadingPassword(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientForPassword) return;
    if (!newPassword.trim()) {
      setPasswordError(language === "pt" ? "A senha não pode ser vazia." : "Password cannot be empty.");
      return;
    }
    if (newPassword.trim().length < 4) {
      setPasswordError(language === "pt" ? "A senha deve ter pelo menos 4 caracteres." : "Password must be at least 4 characters.");
      return;
    }

    setIsSavingPassword(true);
    setPasswordError("");
    setPasswordSuccess("");

    try {
      const cleanPhone = selectedClientForPassword.phone.replace(/\D/g, "");
      if (!cleanPhone) {
        throw new Error("Invalid phone number");
      }

      const userDocRef = doc(db, "storefront_users", cleanPhone);
      const userSnap = await getDoc(userDocRef);
      
      if (userSnap.exists()) {
        await setDoc(userDocRef, { password: newPassword.trim() }, { merge: true });
      } else {
        const newUser = {
          name: selectedClientForPassword.name,
          phone: selectedClientForPassword.phone,
          password: newPassword.trim(),
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, newUser);
      }

      setPasswordSuccess(language === "pt" ? "Senha atualizada com sucesso!" : "Password updated successfully!");
      setTimeout(() => {
        setIsPasswordModalOpen(false);
      }, 1500);
    } catch (err) {
      console.error("Error saving password:", err);
      setPasswordError(language === "pt" ? "Erro ao salvar nova senha." : "Error saving new password.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  // 1. Recipes state for defining storefront prices
  const [recipes, setRecipes] = useState<any[]>([]);
  useEffect(() => {
    const colRef = collection(db, "recipes");
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setRecipes(list);
    });
    return () => unsubscribe();
  }, []);

  // Storefront prices state
  const [customPrices, setCustomPrices] = useState<Record<string, string>>({});
  const [isSavingPrices, setIsSavingPrices] = useState(false);
  useEffect(() => {
    const docRef = doc(db, "settings", "storefront_prices");
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const prices = data.prices || {};
        const stringPrices: Record<string, string> = {};
        Object.entries(prices).forEach(([key, val]) => {
          stringPrices[key] = String(val);
        });
        setCustomPrices(stringPrices);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Delivery fees state
  const [deliveryFees, setDeliveryFees] = useState<Array<{ neighborhood: string; fee: number }>>([]);
  const [newNeighborhood, setNewNeighborhood] = useState("");
  const [newFee, setNewFee] = useState("");
  const [isSavingFees, setIsSavingFees] = useState(false);
  const [storeCity, setStoreCity] = useState("");
  const [cityNeighborhoods, setCityNeighborhoods] = useState<string[]>([]);
  const [showNeighborhoodSuggestions, setShowNeighborhoodSuggestions] = useState(false);

  useEffect(() => {
    const unsubStore = onSnapshot(doc(db, "settings", "store_config"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.stores && Array.isArray(data.stores) && data.activeStoreId) {
          const activeStore = data.stores.find((s: any) => s.id === data.activeStoreId);
          if (activeStore) {
            setStoreCity(activeStore.city || "");
            return;
          }
        }
        setStoreCity(data.city || "");
      }
    });
    return () => unsubStore();
  }, []);

  const parsedCityName = useMemo(() => {
    if (!storeCity) return "";
    const parts = storeCity.split(" - ");
    return parts[0].trim();
  }, [storeCity]);

  useEffect(() => {
    if (!parsedCityName) {
      setCityNeighborhoods([]);
      return;
    }

    const fetchNeighborhoods = async () => {
      try {
        const resSub = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${encodeURIComponent(parsedCityName)}/subdistritos`);
        const dataSub = await resSub.json();
        if (Array.isArray(dataSub) && dataSub.length > 0) {
          const names = Array.from(new Set(dataSub.map((item: any) => item.nome))).sort() as string[];
          setCityNeighborhoods(names);
          return;
        }

        const resDist = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${encodeURIComponent(parsedCityName)}/distritos`);
        const dataDist = await resDist.json();
        if (Array.isArray(dataDist) && dataDist.length > 0) {
          const names = Array.from(new Set(dataDist.map((item: any) => item.nome))).sort() as string[];
          setCityNeighborhoods(names);
        } else {
          setCityNeighborhoods([]);
        }
      } catch (err) {
        console.error("Error fetching city neighborhoods from IBGE:", err);
        setCityNeighborhoods([]);
      }
    };

    fetchNeighborhoods();
  }, [parsedCityName]);

  const combinedNeighborhoodSuggestions = useMemo(() => {
    const suggestions = new Set<string>();
    
    // 1. Add IBGE fetched neighborhoods
    cityNeighborhoods.forEach(n => suggestions.add(n));

    // 2. Add any neighborhoods parsed from existing client orders passed as props
    orders.forEach(o => {
      if (o.address) {
        const nb = getNeighborhood(o.address);
        if (nb && nb !== "Não informado" && nb !== "Not provided") {
          suggestions.add(nb);
        }
      }
    });

    return Array.from(suggestions).sort((a, b) => a.localeCompare(b));
  }, [cityNeighborhoods, orders]);

  const filteredNeighborhoods = useMemo(() => {
    const registered = new Set(deliveryFees.map(f => f.neighborhood.toLowerCase()));
    const available = combinedNeighborhoodSuggestions.filter(n => !registered.has(n.toLowerCase()));
    const q = newNeighborhood.trim().toLowerCase();
    if (!q) {
      return available.slice(0, 15);
    }
    return available.filter(n => n.toLowerCase().includes(q)).slice(0, 15);
  }, [combinedNeighborhoodSuggestions, newNeighborhood, deliveryFees]);

  useEffect(() => {
    const docRef = doc(db, "settings", "delivery_fees");
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const feesMap = data.fees || {};
        const feesList = Object.entries(feesMap).map(([nb, val]) => ({
          neighborhood: nb,
          fee: Number(val) || 0
        }));
        setDeliveryFees(feesList);
      }
    });
    return () => unsubscribe();
  }, []);

  // Categories order state
  const [categoriesOrder, setCategoriesOrder] = useState<string[]>([]);
  const [isSavingCategories, setIsSavingCategories] = useState(false);

  useEffect(() => {
    const docRef = doc(db, "settings", "categories_order");
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setCategoriesOrder(data.order || []);
      }
    });
    return () => unsubscribe();
  }, []);

  const existingCategories = useMemo(() => {
    const cats = new Set<string>();
    recipes.forEach((r) => {
      if (r.category && r.category.trim()) {
        cats.add(r.category.trim());
      }
    });
    return Array.from(cats);
  }, [recipes]);

  const orderedCategories = useMemo(() => {
    const ordered = categoriesOrder.filter(cat => existingCategories.includes(cat));
    existingCategories.forEach(cat => {
      if (!ordered.includes(cat)) {
        ordered.push(cat);
      }
    });
    return ordered;
  }, [categoriesOrder, existingCategories]);

  // Handle local drag & drop reorder
  const handleMoveCategory = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= orderedCategories.length) return;
    const reordered = [...orderedCategories];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setCategoriesOrder(reordered);
  };

  const handleSaveCategoriesOrder = async (customOrder?: string[]) => {
    setIsSavingCategories(true);
    try {
      const orderToSave = customOrder || orderedCategories;
      await setDoc(doc(db, "settings", "categories_order"), {
        order: orderToSave
      });
      alert(language === "pt" ? "Ordem das categorias salva com sucesso!" : "Category order saved successfully!");
    } catch (err) {
      console.error("Error saving categories order:", err);
      alert(language === "pt" ? "Erro ao salvar a ordem das categorias." : "Error saving category order.");
    } finally {
      setIsSavingCategories(false);
    }
  };

  // Aggregate clients from orders list
  const aggregatedClients = useMemo(() => {
    const clientsMap: Record<string, {
      name: string;
      phone: string;
      address: string;
      purchaseCount: number;
      totalSpent: number;
      latestPurchaseDate?: string;
    }> = {};

    orders.forEach((ord) => {
      if (!ord.customerName) return;
      const key = ord.customerName.trim().toLowerCase();
      
      const current = clientsMap[key] || {
        name: ord.customerName,
        phone: ord.phone || (language === "pt" ? "Não informado" : "Not provided"),
        address: ord.address || (language === "pt" ? "Não informado" : "Not provided"),
        purchaseCount: 0,
        totalSpent: 0,
      };

      // Keep latest non-empty phone/address
      let updatedPhone = current.phone;
      if (ord.phone && ord.phone !== "Não informado" && ord.phone !== "Not provided") {
        updatedPhone = ord.phone;
      }
      let updatedAddress = current.address;
      if (ord.address && ord.address !== "Não informado" && ord.address !== "Not provided") {
        updatedAddress = ord.address;
      }

      clientsMap[key] = {
        name: current.name,
        phone: updatedPhone,
        address: updatedAddress,
        purchaseCount: current.purchaseCount + 1,
        totalSpent: current.totalSpent + (Number(ord.total) || 0),
        latestPurchaseDate: ord.date || current.latestPurchaseDate
      };
    });

    return Object.values(clientsMap);
  }, [orders, language]);

  // Filter clients based on search query
  const filteredClients = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return aggregatedClients;
    return aggregatedClients.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.phone.toLowerCase().includes(query) || 
      c.address.toLowerCase().includes(query)
    );
  }, [aggregatedClients, searchTerm]);

  // Sort clients
  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "count") {
        comparison = a.purchaseCount - b.purchaseCount;
      } else if (sortBy === "spent") {
        comparison = a.totalSpent - b.totalSpent;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [filteredClients, sortBy, sortOrder]);

  const toggleSort = (field: "name" | "count" | "spent") => {
    if (sortBy === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  // Summary Metrics
  const totalClientsCount = aggregatedClients.length;
  const averageSpentPerClient = useMemo(() => {
    if (totalClientsCount === 0) return 0;
    const sum = aggregatedClients.reduce((acc, c) => acc + c.totalSpent, 0);
    return sum / totalClientsCount;
  }, [aggregatedClients, totalClientsCount]);

  const mostValuableClient = useMemo(() => {
    if (aggregatedClients.length === 0) return null;
    return [...aggregatedClients].sort((a, b) => b.totalSpent - a.totalSpent)[0];
  }, [aggregatedClients]);

  // Item Prices Handlers
  const handleSavePrices = async () => {
    setIsSavingPrices(true);
    const parsedPrices: Record<string, number> = {};
    Object.entries(customPrices).forEach(([key, val]) => {
      const num = parseFloat(val as string);
      if (!isNaN(num) && num >= 0) {
        parsedPrices[key] = num;
      }
    });

    try {
      await setDoc(doc(db, "settings", "storefront_prices"), {
        prices: parsedPrices
      });
      alert(language === "pt" ? "Preços de venda salvos!" : "Retail prices saved successfully!");
    } catch (err) {
      console.error("Error saving storefront prices:", err);
      alert(language === "pt" ? "Erro ao salvar preços." : "Error saving prices.");
    } finally {
      setIsSavingPrices(false);
    }
  };

  // Delivery Fees Handlers
  const handleAddDeliveryFee = () => {
    const nbClean = newNeighborhood.trim();
    const feeNum = parseFloat(newFee);
    if (!nbClean) {
      alert(language === "pt" ? "Insira um bairro válido." : "Enter a valid neighborhood name.");
      return;
    }
    if (isNaN(feeNum) || feeNum < 0) {
      alert(language === "pt" ? "Insira uma taxa válida." : "Enter a valid delivery fee.");
      return;
    }

    const exists = deliveryFees.some(f => f.neighborhood.toLowerCase() === nbClean.toLowerCase());
    if (exists) {
      alert(language === "pt" ? "Bairro já está cadastrado!" : "Neighborhood already registered!");
      return;
    }

    const updated = [...deliveryFees, { neighborhood: nbClean, fee: feeNum }];
    setDeliveryFees(updated);
    setNewNeighborhood("");
    setNewFee("");
  };

  const handleDeleteDeliveryFee = (nb: string) => {
    const updated = deliveryFees.filter(f => f.neighborhood !== nb);
    setDeliveryFees(updated);
  };

  const handleUpdateFeeValue = (nb: string, valStr: string) => {
    const updated = deliveryFees.map(f => {
      if (f.neighborhood === nb) {
        return { ...f, fee: valStr === "" ? 0 : parseFloat(valStr) || 0 };
      }
      return f;
    });
    setDeliveryFees(updated);
  };

  const handleSaveDeliveryFees = async () => {
    setIsSavingFees(true);
    const feesMap: Record<string, number> = {};
    deliveryFees.forEach((item) => {
      feesMap[item.neighborhood] = item.fee;
    });

    try {
      await setDoc(doc(db, "settings", "delivery_fees"), {
        fees: feesMap
      });
      alert(language === "pt" ? "Taxas de entrega salvas com sucesso!" : "Delivery fees saved successfully!");
    } catch (err) {
      console.error("Error saving delivery fees:", err);
      alert(language === "pt" ? "Erro ao salvar taxas de entrega." : "Error saving delivery fees.");
    } finally {
      setIsSavingFees(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition-all cursor-pointer border border-slate-200"
            title={language === "pt" ? "Voltar ao painel" : "Back to dashboard"}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Truck className="w-5.5 h-5.5 text-indigo-600" />
              {language === "pt" ? "Controle do Site" : "Site Control Center"}
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {language === "pt"
                ? "Painel unificado para gerenciar listagem de clientes, tabelas de preços de venda e taxas de entrega por bairro."
                : "Centralized panel to manage customer lists, storefront retail pricing tables, and localized neighborhood delivery fees."}
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-100 gap-1 select-none">
        <button
          onClick={() => setActiveTab("directory")}
          className={`px-5 py-3 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === "directory"
              ? "border-indigo-600 text-indigo-700 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{language === "pt" ? "Base de Clientes" : "Customer Directory"}</span>
        </button>

        <button
          onClick={() => setActiveTab("prices")}
          className={`px-5 py-3 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === "prices"
              ? "border-indigo-600 text-indigo-700 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>{language === "pt" ? "Preço dos Itens" : "Items Price"}</span>
        </button>

        <button
          onClick={() => setActiveTab("delivery")}
          className={`px-5 py-3 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === "delivery"
              ? "border-indigo-600 text-indigo-700 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>{language === "pt" ? "Taxas de Entrega" : "Delivery Fees"}</span>
        </button>

        <button
          onClick={() => setActiveTab("categories")}
          className={`px-5 py-3 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === "categories"
              ? "border-indigo-600 text-indigo-700 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{language === "pt" ? "Ordem das Categorias" : "Category Order"}</span>
        </button>
      </div>

      {/* 1. CUSTOMER DIRECTORY TAB */}
      {activeTab === "directory" && (
        <div className="space-y-6">
          {/* Search bar inside directory tab */}
          <div className="flex justify-end select-none">
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={language === "pt" ? "Buscar cliente, telefone, rua..." : "Search clients, cell, address..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9.5 pr-4 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 outline-hidden rounded-xl transition-all font-medium"
              />
            </div>
          </div>

          {/* Quick summary stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Total Consumers */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-3.5 shadow-2xs">
              <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                  {language === "pt" ? "Clientes Atendidos" : "Total Consumers"}
                </p>
                <h3 className="text-xl font-extrabold text-slate-900 mt-1.5 font-mono leading-none">
                  {totalClientsCount}
                </h3>
              </div>
            </div>

            {/* Card 2: Avg Purchase Frequency */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-3.5 shadow-2xs">
              <div className="bg-amber-50 p-3 rounded-xl text-amber-600 shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                  {language === "pt" ? "Média Gasta p/ Cliente" : "Average Value Ticket"}
                </p>
                <h3 className="text-xl font-extrabold text-amber-600 mt-1.5 font-mono leading-none">
                  {formatCurrency(averageSpentPerClient)}
                </h3>
              </div>
            </div>

            {/* Card 3: VIP Champion */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-3.5 shadow-2xs">
              <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                  {language === "pt" ? "Cliente Mais Valioso" : "VIP Consumer Leader"}
                </p>
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 mt-1 leading-none truncate" title={mostValuableClient?.name || ""}>
                  {mostValuableClient ? mostValuableClient.name : (language === "pt" ? "Nenhum" : "None")}
                </h3>
                {mostValuableClient && (
                  <p className="text-[10px] text-emerald-600 font-mono font-semibold mt-1">
                    {formatCurrency(mostValuableClient.totalSpent)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Directory Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 select-none">
                    <th 
                      onClick={() => toggleSort("name")}
                      className="px-6 py-4.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>{language === "pt" ? "Cliente" : "Customer"}</span>
                        {sortBy === "name" && (
                          <span className="text-[10px] text-indigo-500">{sortOrder === "asc" ? "▲" : "▼"}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-4.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {language === "pt" ? "Ações" : "Actions"}
                    </th>
                    <th className="px-6 py-4.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {language === "pt" ? "Endereço" : "Address"}
                    </th>
                    <th 
                      onClick={() => toggleSort("count")}
                      className="px-6 py-4.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-700 transition-colors text-center"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{language === "pt" ? "Compras" : "Orders"}</span>
                        {sortBy === "count" && (
                          <span className="text-[10px] text-indigo-500">{sortOrder === "asc" ? "▲" : "▼"}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => toggleSort("spent")}
                      className="px-6 py-4.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-700 transition-colors text-right"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>{language === "pt" ? "Valor Gasto" : "Total Spent"}</span>
                        {sortBy === "spent" && (
                          <span className="text-[10px] text-indigo-500">{sortOrder === "asc" ? "▲" : "▼"}</span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedClients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-xs text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                          <Users className="w-8 h-8 text-slate-300" />
                          <p className="font-bold">{language === "pt" ? "Nenhum cliente cadastrado ainda" : "No customers registered yet"}</p>
                          <p className="text-[11px] opacity-80 leading-relaxed">
                            {language === "pt" 
                              ? "Pedidos realizados no portal do website registrarão novos clientes automaticamente aqui."
                              : "Orders placed via the website customer storefront will dynamically assemble client statistics here."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedClients.map((client, index) => (
                      <tr 
                        key={index} 
                        className="hover:bg-slate-50/50 transition-colors text-xs"
                      >
                        {/* Customer Name */}
                        <td className="px-6 py-4.5 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] font-extrabold text-slate-500 uppercase">
                              {client.name.substring(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate">{client.name}</p>
                              {client.latestPurchaseDate && (
                                <p className="text-[10px] text-slate-400 font-medium font-mono mt-0.5">
                                  {language === "pt" ? "Última compra:" : "Last purchase:"} {client.latestPurchaseDate}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Phone Number Actions */}
                        <td className="px-6 py-4.5 text-slate-600 font-mono font-medium">
                          <div className="flex items-center gap-2.5">
                            {/* Asterisk Icon for Editing Password */}
                            <button
                              type="button"
                              onClick={() => handleOpenPasswordModal(client)}
                              className="p-1 hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                              title={language === "pt" ? "Editar senha de acesso" : "Edit access password"}
                            >
                              <Asterisk className="w-4 h-4" />
                            </button>

                            {/* Clickable Phone/WhatsApp Link */}
                            {client.phone && client.phone !== "Não informado" && client.phone !== "Not provided" ? (
                              <a
                                href={`https://api.whatsapp.com/send/?phone=55${client.phone.replace(/\D/g, "").startsWith("55") ? client.phone.replace(/\D/g, "").substring(2) : client.phone.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 hover:bg-emerald-50 hover:text-emerald-600 text-emerald-500 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                                title={language === "pt" ? "Enviar mensagem no WhatsApp" : "Send WhatsApp message"}
                              >
                                <Phone className="w-3.5 h-3.5 shrink-0" />
                              </a>
                            ) : (
                              <span className="p-1 text-slate-300 flex items-center justify-center">
                                <Phone className="w-3.5 h-3.5 shrink-0" />
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Address */}
                        <td className="px-6 py-4.5 text-slate-500 max-w-xs truncate" title={client.address}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            {client.address && client.address !== "Não informado" && client.address !== "Not provided" ? (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 hover:bg-slate-100 rounded-lg text-indigo-500 hover:text-indigo-600 transition-colors shrink-0 flex items-center justify-center cursor-pointer"
                                title={language === "pt" ? "Abrir endereço completo no Google Maps" : "Open full address in Google Maps"}
                              >
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                              </a>
                            ) : (
                              <MapPin className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                            )}
                            <span className="truncate">
                              {getNeighborhood(client.address)}
                            </span>
                          </div>
                        </td>

                        {/* Orders count */}
                        <td className="px-6 py-4.5 text-center">
                          <span className="inline-flex items-center gap-1 font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200/50">
                            <ShoppingBag className="w-3 h-3 text-slate-400" />
                            <span>{client.purchaseCount}</span>
                          </span>
                        </td>

                        {/* Total Spend */}
                        <td className="px-6 py-4.5 text-right font-mono font-extrabold text-slate-900 text-sm">
                          {formatCurrency(client.totalSpent)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. ITEMS PRICE TAB */}
      {activeTab === "prices" && (
        <div className="space-y-5 text-left max-w-3xl mx-auto bg-white border border-slate-100 p-6 rounded-3xl shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4.5 h-4.5 text-indigo-600" />
              {language === "pt" ? "Preço de Venda do Catálogo" : "Storefront Items Price Management"}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {language === "pt"
                ? "Defina preços customizados para cada produto exposto na vitrine do seu site. Se vazio ou zero, o sistema usará o preço sugerido original."
                : "Set specific storefront overriding prices. If left blank, the portal automatically falls back to the suggested recipe sheet pricing."}
            </p>
          </div>

          {recipes.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              {language === "pt" ? "Nenhum item/receita cadastrada no sistema." : "No recipes registered yet to specify custom prices."}
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-2">
                {recipes.map((recipe) => (
                  <div key={recipe.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-slate-800 truncate">{recipe.recipeName}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {language === "pt" ? `Porções: ${recipe.portions || 1} | Multiplicador: ${recipe.markup || 2}` : `Yield: ${recipe.portions || 1} | Markup: x${recipe.markup || 2}`}
                      </p>
                    </div>

                    <div className="w-36 shrink-0 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-slate-400">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Automatic"
                        value={customPrices[recipe.id] || ""}
                        onChange={(e) => setCustomPrices({ ...customPrices, [recipe.id]: e.target.value })}
                        className="w-full text-right font-mono font-bold text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 px-3 py-2 pl-8.5 rounded-lg outline-hidden transition-all text-slate-800"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSavePrices}
                  disabled={isSavingPrices}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {isSavingPrices ? (language === "pt" ? "Salvando..." : "Saving...") : (language === "pt" ? "Salvar Preços de Venda" : "Save Custom Prices")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. DELIVERY FEES TAB */}
      {activeTab === "delivery" && (
        <div className="space-y-6 text-left max-w-3xl mx-auto">
          {/* New neighborhood form panel */}
          <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4.5 h-4.5 text-indigo-600" />
                {language === "pt" ? "Cadastrar Bairros e Taxas de Entrega" : "Delivery Fees Neighborhood Setup"}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {language === "pt"
                  ? "Adicione os bairros da sua cidade e suas respectivas taxas de entrega por motoboy."
                  : "Register available neighborhoods and their respective shipping/motoboy delivery rates."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Neighborhood name with Autocomplete */}
              <div className="sm:col-span-2 relative">
                <input
                  type="text"
                  placeholder={language === "pt" ? "Nome do Bairro (ex: Centro, Bela Vista)" : "Neighborhood Name (e.g. Downtown)"}
                  value={newNeighborhood}
                  onChange={(e) => {
                    setNewNeighborhood(e.target.value);
                    setShowNeighborhoodSuggestions(true);
                  }}
                  onFocus={() => setShowNeighborhoodSuggestions(true)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 px-3.5 py-2.5 rounded-xl outline-hidden transition-all text-slate-800 font-medium"
                />

                {showNeighborhoodSuggestions && filteredNeighborhoods.length > 0 && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 cursor-default" 
                      onClick={() => setShowNeighborhoodSuggestions(false)} 
                    />
                    <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100">
                      {filteredNeighborhoods.map((nb, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setNewNeighborhood(nb);
                            setShowNeighborhoodSuggestions(false);
                          }}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 text-xs text-slate-700 font-bold transition-colors flex items-center gap-1.5"
                        >
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {nb}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Fee value */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Taxa"
                    value={newFee}
                    onChange={(e) => setNewFee(e.target.value)}
                    className="w-full text-right font-mono text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 px-3.5 py-2.5 pl-8.5 rounded-xl outline-hidden transition-all text-slate-800 font-bold"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddDeliveryFee}
                  className="bg-slate-950 hover:bg-slate-800 text-white p-2.5 rounded-xl cursor-pointer shrink-0 transition-colors flex items-center justify-center border border-transparent shadow-xs"
                  title={language === "pt" ? "Adicionar Bairro" : "Add Neighborhood"}
                >
                  <Plus className="w-4.5 h-4.5 font-extrabold" />
                </button>
              </div>
            </div>
          </div>

          {/* Registered neighborhood list panel */}
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden p-6 space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">
              {language === "pt" ? "Bairros Cadastrados para Entrega" : "Registered Neighborhood Registry"}
            </h4>

            {deliveryFees.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                {language === "pt" ? "Nenhum bairro cadastrado ainda." : "No delivery neighborhoods registered yet."}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-2">
                  {deliveryFees.map((feeItem) => (
                    <div key={feeItem.neighborhood} className="py-2.5 flex items-center justify-between gap-4">
                      <span className="font-bold text-xs text-slate-800 truncate flex items-center gap-1.5 min-w-0 flex-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{feeItem.neighborhood}</span>
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-28 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-slate-400">R$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={feeItem.fee}
                            onChange={(e) => handleUpdateFeeValue(feeItem.neighborhood, e.target.value)}
                            className="w-full text-right font-mono font-bold text-[11px] bg-slate-50 border border-slate-150 focus:bg-white focus:border-indigo-500 px-2 py-1 rounded-lg outline-hidden transition-all text-slate-800"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteDeliveryFee(feeItem.neighborhood)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all cursor-pointer border border-transparent hover:border-rose-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveDeliveryFees}
                    disabled={isSavingFees}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingFees ? (language === "pt" ? "Salvando..." : "Saving...") : (language === "pt" ? "Salvar Taxas de Entrega" : "Save Delivery Fees")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. CATEGORY ORDER TAB */}
      {activeTab === "categories" && (
        <div className="space-y-6 text-left max-w-xl mx-auto animate-fade-in">
          <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-indigo-600" />
                {language === "pt" ? "Ordenar Categorias de Receitas" : "Order Recipe Categories"}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {language === "pt"
                  ? "Arraste e solte as categorias ou use as setas para definir a ordem de exibição no catálogo do site."
                  : "Drag and drop categories or use the arrows to set their display order in the storefront catalog."}
              </p>
            </div>

            {orderedCategories.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                {language === "pt" ? "Nenhuma categoria cadastrada nas receitas." : "No categories found in current recipes."}
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="divide-y divide-slate-100 border border-slate-150 rounded-2xl overflow-hidden bg-slate-50/50">
                  {orderedCategories.map((cat, idx) => (
                    <div
                      key={cat}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", idx.toString());
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                        if (!isNaN(fromIdx)) {
                          handleMoveCategory(fromIdx, idx);
                        }
                      }}
                      className="p-3.5 bg-white hover:bg-slate-50/80 active:bg-slate-50 transition-colors flex items-center justify-between gap-4 cursor-grab active:cursor-grabbing group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-400 shrink-0" />
                        <span className="font-bold text-xs text-slate-800 truncate">
                          {cat}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveCategory(idx, idx - 1)}
                          disabled={idx === 0}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-colors cursor-pointer"
                          title={language === "pt" ? "Mover para cima" : "Move up"}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveCategory(idx, idx + 1)}
                          disabled={idx === orderedCategories.length - 1}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-colors cursor-pointer"
                          title={language === "pt" ? "Mover para baixo" : "Move down"}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSaveCategoriesOrder()}
                    disabled={isSavingCategories}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingCategories ? (language === "pt" ? "Salvando..." : "Saving...") : (language === "pt" ? "Salvar Ordenação" : "Save Category Order")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Password Edit Modal */}
      {isPasswordModalOpen && selectedClientForPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-100 shadow-xl overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Asterisk className="w-4 h-4 text-indigo-500" />
                {language === "pt" ? "Editar Senha do Cliente" : "Edit Customer Password"}
              </h3>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleSavePassword} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {language === "pt" ? "Cliente" : "Customer"}
                </label>
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700">
                  {selectedClientForPassword.name}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {language === "pt" ? "Telefone" : "Phone"}
                </label>
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-mono font-medium text-slate-600">
                  {selectedClientForPassword.phone}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {language === "pt" ? "Nova Senha" : "New Password"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={language === "pt" ? "Mínimo 4 caracteres" : "At least 4 characters"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoadingPassword || isSavingPassword}
                  className="w-full text-xs px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 outline-hidden rounded-xl transition-all font-medium font-mono text-slate-800"
                />
              </div>

              {passwordError && (
                <p className="text-[11px] text-rose-600 font-medium">
                  {passwordError}
                </p>
              )}

              {passwordSuccess && (
                <p className="text-[11px] text-emerald-600 font-semibold">
                  {passwordSuccess}
                </p>
              )}

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={isSavingPassword}
                  className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-slate-200"
                >
                  {language === "pt" ? "Cancelar" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isLoadingPassword || isSavingPassword}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingPassword ? (language === "pt" ? "Salvando..." : "Saving...") : (language === "pt" ? "Salvar Alteração" : "Save Changes")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
