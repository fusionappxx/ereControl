import React, { useState, useEffect, useMemo } from "react";
import { 
  ArrowLeft, 
  Store, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  BarChart2, 
  Settings, 
  Trash2, 
  Plus, 
  ChevronRight,
  Sparkles,
  Percent,
  CheckCircle2,
  AlertCircle,
  Save,
  FileSpreadsheet,
  Bike
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from "recharts";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  addDoc 
} from "firebase/firestore";
import { formatCurrency, generateId } from "../utils";

interface RecipeIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
}

interface Recipe {
  id: string;
  recipeName: string;
  ingredients: RecipeIngredient[];
  portions: number;
  markup: number;
}

interface SalesLog {
  id: string;
  saleDate: string;
  recipeId: string;
  recipeName: string;
  portionsSold: number;
  channelName: string;
  taxApplied: number;
  salePrice: number;
  totalPrice: number;
  rawCost: number;
  netProfit: number;
  createdAt: string;
}

interface StoreConfig {
  storeName: string;
  taxId: string;
  defaultTaxPercent: number;
  monthlyTargetRevenue: number;
}

interface StoreBrand {
  id: string;
  storeName: string;
  taxId: string;
  defaultTaxPercent: number;
  monthlyTargetRevenue: number;
  activeChannels: string[];
}

interface RevenueScreenProps {
  language?: "en" | "pt";
  onBack: () => void;
  initialSubTab?: "store-config" | "daily" | "summary";
}

export default function RevenueScreen({ 
  language = "en", 
  onBack, 
  initialSubTab = "summary" 
}: RevenueScreenProps) {
  const [activeTab, setActiveTab] = useState<"store-config" | "daily" | "summary">(initialSubTab);

  // Firestore Sync States
  const [storeConfig, setStoreConfig] = useState<StoreConfig>({
    storeName: "My Bakery",
    taxId: "12.345.678/0001-99",
    defaultTaxPercent: 12.0,
    monthlyTargetRevenue: 10000
  });

  const [stores, setStores] = useState<StoreBrand[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string>("");

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [salesLogs, setSalesLogs] = useState<SalesLog[]>([]);

  // Daily channel sales matrix states
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });
  const [matrixSalesData, setMatrixSalesData] = useState<Record<number, Record<string, number>>>({});
  const [isSavingMatrix, setIsSavingMatrix] = useState<boolean>(false);
  const [matrixUnsaved, setMatrixUnsaved] = useState<boolean>(false);

  // Daily channel sales matrix states for other stores
  const [allStoresMatrixData, setAllStoresMatrixData] = useState<Record<string, Record<number, Record<string, number>>>>({});
  const [savingStoreIds, setSavingStoreIds] = useState<Record<string, boolean>>({});
  const [unsavedStoreIds, setUnsavedStoreIds] = useState<Record<string, boolean>>({});
  
  // Dependencies for costing calculations
  const [fixedExpenses, setFixedExpenses] = useState<{ id: string; value: number }[]>([]);
  const [productionCosts, setProductionCosts] = useState({
    water: 0,
    electricity: 0,
    gas: 0,
    electricity2: 0
  });
  const [monthlyVolume, setMonthlyVolume] = useState<number>(1500);

  // UI Feedback States
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Log Form State
  const [logDate, setLogDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [portionsSold, setPortionsSold] = useState<number>(1);
  const [selectedChannel, setSelectedChannel] = useState<string>("iFood");
  const [customTax, setCustomTax] = useState<string>("");
  const [customPrice, setCustomPrice] = useState<string>("");

  const channelTaxPresets: Record<string, number> = {
    Counter: 0.0,
    AMO: 18.0,
    iFood: 25.0,
    "99Food": 22.0,
    Website: 5.0,
    Motoboy: 0.0,
    Custom: 0.0
  };

  // Sync activeTab when initialSubTab property updates
  useEffect(() => {
    setActiveTab(initialSubTab);
  }, [initialSubTab]);

  // Load Store Config
  useEffect(() => {
    const docRef = doc(db, "settings", "store_config");
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.stores && Array.isArray(data.stores) && data.stores.length > 0) {
          setStores(data.stores);
          const activeId = data.activeStoreId || data.stores[0].id;
          setActiveStoreId(activeId);
          const activeStore = data.stores.find((s: any) => s.id === activeId) || data.stores[0];
          setStoreConfig({
            storeName: activeStore.storeName || "My Bakery",
            taxId: activeStore.taxId || "",
            defaultTaxPercent: Number(activeStore.defaultTaxPercent) ?? 12.0,
            monthlyTargetRevenue: Number(activeStore.monthlyTargetRevenue) ?? 10000
          });
        } else {
          // Backward compatibility: create a single store out of the root data
          const singleStore: StoreBrand = {
            id: "default_store",
            storeName: data.storeName || "My Bakery",
            taxId: data.taxId || "",
            defaultTaxPercent: Number(data.defaultTaxPercent) ?? 12.0,
            monthlyTargetRevenue: Number(data.monthlyTargetRevenue) ?? 10000,
            activeChannels: ["iFood", "Website"]
          };
          setStores([singleStore]);
          setActiveStoreId("default_store");
          setStoreConfig({
            storeName: singleStore.storeName,
            taxId: singleStore.taxId,
            defaultTaxPercent: singleStore.defaultTaxPercent,
            monthlyTargetRevenue: singleStore.monthlyTargetRevenue
          });
        }
      } else {
        const defaultStore: StoreBrand = {
          id: "store_1",
          storeName: "My Bakery",
          taxId: "12.345.678/0001-99",
          defaultTaxPercent: 12.0,
          monthlyTargetRevenue: 10000,
          activeChannels: ["iFood", "Website"]
        };
        setStores([defaultStore]);
        setActiveStoreId("store_1");
        setStoreConfig({
          storeName: defaultStore.storeName,
          taxId: defaultStore.taxId,
          defaultTaxPercent: defaultStore.defaultTaxPercent,
          monthlyTargetRevenue: defaultStore.monthlyTargetRevenue
        });
      }
    }, (err) => {
      console.error("Error loading store config:", err);
    });
    return () => unsubscribe();
  }, []);

  const activeStore = useMemo(() => {
    return stores.find((s) => s.id === activeStoreId) || stores[0] || null;
  }, [stores, activeStoreId]);

  // Load Channel Matrix Sales for target month and store
  useEffect(() => {
    if (!activeStoreId) return;
    const docId = `${activeStoreId}_${selectedMonth}`;
    
    const docRef = doc(db, "channel_matrix", docId);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.salesData) {
          setMatrixSalesData(data.salesData);
          setMatrixUnsaved(false);
        } else {
          setMatrixSalesData({});
          setMatrixUnsaved(false);
        }
      } else {
        setMatrixSalesData({});
        setMatrixUnsaved(false);
      }
    }, (err) => {
      console.error("Error loading channel matrix:", err);
    });

    return () => unsubscribe();
  }, [activeStoreId, selectedMonth]);

  // Load Channel Matrix Sales for ALL stores
  useEffect(() => {
    const colRef = collection(db, "channel_matrix");
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const dataMap: Record<string, Record<number, Record<string, number>>> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.storeId && data.month === selectedMonth) {
          dataMap[data.storeId] = data.salesData || {};
        }
      });
      // Merge with unsaved changes to avoid discarding user inputs before saving
      setAllStoresMatrixData((prev) => {
        const merged = { ...dataMap };
        Object.keys(prev).forEach((storeId) => {
          if (unsavedStoreIds[storeId]) {
            merged[storeId] = prev[storeId];
          }
        });
        return merged;
      });
    }, (err) => {
      console.error("Error loading all channel matrices:", err);
    });

    return () => unsubscribe();
  }, [unsavedStoreIds, selectedMonth]);

  // Sync selected channel with active store channels list
  useEffect(() => {
    if (activeStore?.activeChannels && activeStore.activeChannels.length > 0) {
      if (!activeStore.activeChannels.includes(selectedChannel) && selectedChannel !== "Custom") {
        setSelectedChannel(activeStore.activeChannels[0]);
      }
    }
  }, [activeStore, selectedChannel]);

  // Load Recipes
  useEffect(() => {
    const colRef = collection(db, "recipes");
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const list: Recipe[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          recipeName: data.recipeName || "Unnamed Recipe",
          ingredients: data.ingredients || [],
          portions: Number(data.portions) || 1,
          markup: Number(data.markup) || 2.0
        });
      });
      setRecipes(list);
      if (list.length > 0 && !selectedRecipeId) {
        setSelectedRecipeId(list[0].id);
      }
    }, (err) => {
      console.error("Error loading recipes:", err);
    });
    return () => unsubscribe();
  }, []);

  // Load Sales Logs
  useEffect(() => {
    const colRef = collection(db, "sales_logs");
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const list: SalesLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          saleDate: data.saleDate || "",
          recipeId: data.recipeId || "",
          recipeName: data.recipeName || "",
          portionsSold: Number(data.portionsSold) || 0,
          channelName: data.channelName || "",
          taxApplied: Number(data.taxApplied) || 0,
          salePrice: Number(data.salePrice) || 0,
          totalPrice: Number(data.totalPrice) || 0,
          rawCost: Number(data.rawCost) || 0,
          netProfit: Number(data.netProfit) || 0,
          createdAt: data.createdAt || ""
        });
      });
      // Sort by date descending, then created timestamp descending
      list.sort((a, b) => {
        const dateDiff = b.saleDate.localeCompare(a.saleDate);
        if (dateDiff !== 0) return dateDiff;
        return b.createdAt.localeCompare(a.createdAt);
      });
      setSalesLogs(list);
    }, (err) => {
      console.error("Error loading sales logs:", err);
    });
    return () => unsubscribe();
  }, []);

  // Load other metrics to resolve Real Unit Cost exactly as RecipeCostingSheetsScreen does
  useEffect(() => {
    const colRef = collection(db, "fixed_expenses");
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const list: { id: string; value: number }[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, value: Number(doc.data().value) || 0 });
      });
      setFixedExpenses(list);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const docRef = doc(db, "settings", "production_costs");
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setProductionCosts({
          water: Number(data.water) || 0,
          electricity: Number(data.electricity) || 0,
          gas: Number(data.gas) || 0,
          electricity2: Number(data.electricity2) || 0
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const docRef = doc(db, "settings", "volume_and_app_tax");
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setMonthlyVolume(Number(data.monthlyVolume) || 1500);
      }
    });
    return () => unsubscribe();
  }, []);

  // Constants computed from dependencies
  const globalFixedSum = useMemo(() => {
    return fixedExpenses.reduce((sum, item) => sum + item.value, 0);
  }, [fixedExpenses]);

  const globalProductionSum = useMemo(() => {
    return productionCosts.water + productionCosts.electricity + productionCosts.gas + productionCosts.electricity2;
  }, [productionCosts]);

  // Compute calculated portion cost lookup function
  const calculatedRecipeSpecs = useMemo(() => {
    const map: Record<string, { rawCost: number; portionCost: number; suggestedPrice: number }> = {};
    recipes.forEach((r) => {
      const rawIngredientsCostSum = r.ingredients.reduce((sum, ing) => sum + (ing.quantity * ing.price), 0);
      const yieldCount = r.portions > 0 ? r.portions : 1;
      const portionRawCost = rawIngredientsCostSum / yieldCount;
      const portionFixedOverhead = globalFixedSum / monthlyVolume;
      const portionProductionUtility = globalProductionSum / monthlyVolume;
      const totalRealUnitCost = portionRawCost + portionFixedOverhead + portionProductionUtility;
      const suggestedSellingPrice = totalRealUnitCost * r.markup;

      map[r.id] = {
        rawCost: portionRawCost,
        portionCost: totalRealUnitCost,
        suggestedPrice: suggestedSellingPrice
      };
    });
    return map;
  }, [recipes, globalFixedSum, globalProductionSum, monthlyVolume]);

  const activeRecipe = useMemo(() => {
    return recipes.find((r) => r.id === selectedRecipeId) || null;
  }, [recipes, selectedRecipeId]);

  const activeRecipeCostInfo = useMemo(() => {
    if (!selectedRecipeId) return { rawCost: 0, portionCost: 0, suggestedPrice: 0 };
    return calculatedRecipeSpecs[selectedRecipeId] || { rawCost: 0, portionCost: 0, suggestedPrice: 0 };
  }, [calculatedRecipeSpecs, selectedRecipeId]);

  // Resolve current tax rate
  const activeTaxRate = useMemo(() => {
    if (selectedChannel === "Custom") {
      return Number(customTax) || 0;
    }
    return channelTaxPresets[selectedChannel] ?? 0;
  }, [selectedChannel, customTax]);

  // Resolve suggested price for selected channel adjusted for app commission
  const activeChannelSuggestedPrice = useMemo(() => {
    const baseTarget = activeRecipeCostInfo.portionCost;
    const rate = activeTaxRate / 100;
    return rate < 1 ? baseTarget / (1 - rate) : baseTarget;
  }, [activeRecipeCostInfo, activeTaxRate]);

  // Compute actual price per portion being recorded
  const actualInputPrice = useMemo(() => {
    if (customPrice !== "") {
      return Number(customPrice) || 0;
    }
    // Falls back to channel adjusted suggested price * targeting recipe markup
    return activeChannelSuggestedPrice * (activeRecipe?.markup ?? 2.0);
  }, [customPrice, activeChannelSuggestedPrice, activeRecipe]);

  // Computed live preview values for the new logger form
  const computedFormPreview = useMemo(() => {
    const qty = portionsSold > 0 ? portionsSold : 1;
    const totalPrice = qty * actualInputPrice;
    const totalTax = totalPrice * (activeTaxRate / 100);
    const totalIngredientsCost = qty * activeRecipeCostInfo.portionCost;
    const netProfit = totalPrice - totalTax - totalIngredientsCost;
    const profitMargin = totalPrice > 0 ? (netProfit / totalPrice) * 100 : 0;

    return {
      totalPrice,
      totalTax,
      totalIngredientsCost,
      netProfit,
      profitMargin
    };
  }, [portionsSold, actualInputPrice, activeTaxRate, activeRecipeCostInfo]);

  // Trigger Toast helper animation
  const trgToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 4000);
  };

  // Save Store Settings
  const handleSaveStoreConfig = async (selectedId: string, updatedStore: StoreBrand) => {
    setIsSaving(true);
    const docRef = doc(db, "settings", "store_config");
    const updatedStoresList = stores.map((s) => s.id === selectedId ? updatedStore : s);
    try {
      await setDoc(docRef, {
        activeStoreId: activeStoreId || selectedId,
        stores: updatedStoresList,
        storeName: updatedStore.storeName,
        taxId: updatedStore.taxId,
        defaultTaxPercent: Number(updatedStore.defaultTaxPercent) || 0,
        monthlyTargetRevenue: Number(updatedStore.monthlyTargetRevenue) || 0
      });
      trgToast(language === "pt" ? "Configurações da loja salvas com sucesso!" : "Store configuration saved successfully!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "settings/store_config");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleChannel = (channel: string) => {
    if (!activeStoreId) return;
    const currentStore = stores.find((s) => s.id === activeStoreId);
    if (!currentStore) return;
    const currentChannels = currentStore.activeChannels || [];
    let newChannels: string[];
    if (currentChannels.includes(channel)) {
      newChannels = currentChannels.filter((c) => c !== channel);
    } else {
      newChannels = [...currentChannels, channel];
    }
    const updatedStores = stores.map((s) => {
      if (s.id === activeStoreId) {
        return { ...s, activeChannels: newChannels };
      }
      return s;
    });
    setStores(updatedStores);
  };

  // Submit Daily Sale Log
  const handleAddSaleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipeId || !activeRecipe) {
      trgToast(language === "pt" ? "Erro: Selecione uma receita válida." : "Error: Please select a valid recipe.");
      return;
    }

    setIsSaving(true);
    const saleId = generateId();
    const qty = portionsSold > 0 ? portionsSold : 1;
    const itemCost = activeRecipeCostInfo.portionCost;

    const dataPayload: SalesLog = {
      id: saleId,
      saleDate: logDate,
      recipeId: selectedRecipeId,
      recipeName: activeRecipe.recipeName,
      portionsSold: qty,
      channelName: selectedChannel,
      taxApplied: activeTaxRate,
      salePrice: actualInputPrice,
      totalPrice: computedFormPreview.totalPrice,
      rawCost: qty * itemCost,
      netProfit: computedFormPreview.netProfit,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "sales_logs", saleId), dataPayload);
      trgToast(language === "pt" ? `Venda de ${activeRecipe.recipeName} registrada!` : `Sale of ${activeRecipe.recipeName} logged successfully!`);
      // Reset form variables
      setPortionsSold(1);
      setCustomPrice("");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `sales_logs/${saleId}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Save Sales Matrix Data
  const handleSaveMatrix = async () => {
    if (!activeStoreId) return;
    setIsSavingMatrix(true);
    const currentMonthPref = selectedMonth;
    const docId = `${activeStoreId}_${currentMonthPref}`;
    const docRef = doc(db, "channel_matrix", docId);

    try {
      await setDoc(docRef, {
        id: docId,
        storeId: activeStoreId,
        month: currentMonthPref,
        salesData: matrixSalesData
      });
      setMatrixUnsaved(false);
      trgToast(language === "pt" ? "Matriz de faturamento salva!" : "Sales channel matrix saved successfully!");
    } catch (err) {
      console.error("Error saving channel matrix:", err);
      trgToast(language === "pt" ? "Erro ao salvar tabela do canal." : "Error saving the sales channel table.");
    } finally {
      setIsSavingMatrix(false);
    }
  };

  // Save Sales Matrix Data for an individual store branch
  const handleSaveStoreMatrix = async (storeId: string, storeData: Record<number, Record<string, number>>) => {
    setSavingStoreIds((prev) => ({ ...prev, [storeId]: true }));
    const currentMonthPref = selectedMonth;
    const docId = `${storeId}_${currentMonthPref}`;
    const docRef = doc(db, "channel_matrix", docId);

    try {
      await setDoc(docRef, {
        id: docId,
        storeId,
        month: currentMonthPref,
        salesData: storeData || {}
      });
      setUnsavedStoreIds((prev) => ({ ...prev, [storeId]: false }));
      trgToast(language === "pt" ? "Matriz salva com sucesso!" : "Channel matrix saved successfully!");
    } catch (err) {
      console.error("Error saving store matrix:", err);
      trgToast(language === "pt" ? "Erro ao salvar tabela da loja." : "Error saving the store sales channel table.");
    } finally {
      setSavingStoreIds((prev) => ({ ...prev, [storeId]: false }));
    }
  };

  // Delete sales log record
  const handleDeleteLog = async (id: string, productName: string) => {
    if (!window.confirm(language === "pt" ? `Excluir o registro de venda de ${productName}?` : `Delete sales log entry for ${productName}?`)) return;
    try {
      await deleteDoc(doc(db, "sales_logs", id));
      trgToast(language === "pt" ? "Registro de venda excluído!" : "Sales log deleted successfully!");
    } catch (err) {
      console.error("Error deleting sales log:", err);
    }
  };

  // Monthly stats computations
  const summaryStats = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr, 10) || new Date().getFullYear();
    const monthVal = parseInt(monthStr, 10) || (new Date().getMonth() + 1);
    const monthIndex = monthVal - 1;
    const currentMonthPref = selectedMonth;
    const daysInMonth = new Date(year, monthVal, 0).getDate();

    let totalRevenue = 0;
    let totalProfit = 0;
    let totalTax = 0;
    let totalSalesCount = 0;
    let totalDeliveryCost = 0;

    // Sum revenue from all days of the month, from all stores, excluding "motoboy" channel, and sum "motoboy" for totalDeliveryCost
    stores.forEach((store) => {
      const storeData = allStoresMatrixData[store.id] || {};
      for (let day = 1; day <= daysInMonth; day++) {
        const dayData = storeData[day] || {};
        Object.entries(dayData).forEach(([channelKey, val]) => {
          if (typeof val === "number") {
            if (channelKey.toLowerCase() !== "motoboy") {
              totalRevenue += val;
            } else {
              totalDeliveryCost += val;
            }
          }
        });
      }
    });

    salesLogs.forEach((log) => {
      if (log.saleDate.startsWith(currentMonthPref)) {
        totalProfit += log.netProfit;
        totalTax += log.totalPrice * (log.taxApplied / 100);
        totalSalesCount += log.portionsSold;
      }
    });

    const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const progressPercent = storeConfig.monthlyTargetRevenue > 0 
      ? Math.min(100, (totalRevenue / storeConfig.monthlyTargetRevenue) * 100) 
      : 0;

    const monthDate = new Date(year, monthIndex, 15);
    const currentMonthLabel = monthDate.toLocaleString(language === "pt" ? "pt-BR" : "en-US", { month: "long", year: "numeric" });

    return {
      totalRevenue,
      totalProfit,
      totalTax,
      totalSalesCount,
      averageMargin,
      progressPercent,
      totalDeliveryCost,
      currentMonthLabel
    };
  }, [salesLogs, storeConfig, language, allStoresMatrixData, stores, selectedMonth]);

  // Chart data aggregated by day (summing all channels from all stores + matching log profits)
  const chartData = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr, 10) || new Date().getFullYear();
    const monthVal = parseInt(monthStr, 10) || (new Date().getMonth() + 1);
    const currentMonthPref = selectedMonth;
    const daysCount = new Date(year, monthVal, 0).getDate();

    // Sum profit from registered sales logs per day
    const dailyProfit: Record<number, number> = {};
    salesLogs.forEach((log) => {
      if (log.saleDate.startsWith(currentMonthPref)) {
        const dayNum = parseInt(log.saleDate.substring(8, 10), 10) || 0;
        if (dayNum > 0) {
          dailyProfit[dayNum] = (dailyProfit[dayNum] || 0) + log.netProfit;
        }
      }
    });

    const list = Array.from({ length: daysCount }, (_, i) => {
      const day = i + 1;
      const name = String(day).padStart(2, "0");
      
      // Sum revenue over all channels from all stores (excluding Motoboy)
      let totalRevenue = 0;
      stores.forEach((store) => {
        const storeData = allStoresMatrixData[store.id] || {};
        const dayData = storeData[day] || {};
        Object.entries(dayData).forEach(([channelKey, val]) => {
          if (typeof val === "number") {
            if (channelKey.toLowerCase() !== "motoboy") {
              totalRevenue += val;
            }
          }
        });
      });

      const profit = dailyProfit[day] ?? 0;

      return {
        name,
        [language === "pt" ? "Faturamento" : "Revenue"]: Number(totalRevenue.toFixed(2)),
        [language === "pt" ? "Lucro" : "Profit"]: Number(profit.toFixed(2))
      };
    });

    return list;
  }, [allStoresMatrixData, salesLogs, language, stores, selectedMonth]);

  // Filter logs for archives list
  const filteredSalesLogs = useMemo(() => {
    if (!searchQuery.trim()) return salesLogs;
    const s = searchQuery.toLowerCase();
    return salesLogs.filter((log) => 
      log.recipeName.toLowerCase().includes(s) || 
      log.channelName.toLowerCase().includes(s) || 
      log.saleDate.includes(s)
    );
  }, [salesLogs, searchQuery]);

  return (
    <div id="revenue-root-panel" className="space-y-6 animate-fade-in text-slate-800">
      
      {/* HEADER SECTION */}
      <div id="revenue-header" className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <button
            id="back-to-dashboard-btn"
            onClick={onBack}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 active:bg-slate-100 rounded-xl transition-all shadow-3xs cursor-pointer flex items-center justify-center"
            title={language === "pt" ? "Voltar ao Início" : "Back to Home"}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{language === "pt" ? "Painel de Faturamento" : "Revenue Operations Center"}</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {language === "pt" 
                ? "Gestão integrada de vendas corporativas, canais parceiros e auditorias de lucros reais" 
                : "Continuous corporate sales logging, partner integration audit, and margins control pipeline"}
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-center">
          <button
            onClick={() => setActiveTab("summary")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "summary"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            {language === "pt" ? "Resumo Mensal" : "Monthly Summary"}
          </button>
          <button
            onClick={() => setActiveTab("daily")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "daily"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {language === "pt" ? "Lançar Venda" : "Daily Revenue"}
          </button>
          <button
            onClick={() => setActiveTab("store-config")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "store-config"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            {language === "pt" ? "Config da Loja" : "Store Config"}
          </button>
        </div>
      </div>

      {/* TOAST NOTIFICATION */}
      {showToast && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-800 px-4 py-3.5 max-w-sm flex items-center gap-3 animate-slide-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold leading-normal">{toastMessage}</span>
        </div>
      )}

      {/* VIEW 1: MONTHLY SUMMARY INSIGHTS / KPI DASHBOARD */}
      {activeTab === "summary" && (
        <div className="space-y-6">
          
          {/* TOP KPI GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Card 1: Gross Sales */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-3.5 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-emerald-600 shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                  {language === "pt" ? "Faturamento Bruto" : "Gross Revenue"}
                </p>
                <h3 className="text-lg font-black text-slate-900 mt-1.5 font-mono leading-none">
                  {formatCurrency(summaryStats.totalRevenue)}
                </h3>
                <span className="text-[9.5px] text-slate-400 block mt-1.5 truncate">
                  {language === "pt" ? "Mês ativo: " : "In "} {summaryStats.currentMonthLabel}
                </span>
              </div>
            </div>

            {/* Card 2: Delivery Cost */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-3.5 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 text-rose-600 shrink-0">
                <Bike className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                  {language === "pt" ? "Custo de Entrega" : "Delivery Cost"}
                </p>
                <h3 className="text-lg font-black text-rose-600 mt-1.5 font-mono leading-none">
                  {formatCurrency(summaryStats.totalDeliveryCost)}
                </h3>
                <span className="text-[9.5px] text-slate-400 block mt-1.5 truncate">
                  {language === "pt" ? "Soma de todos os canais motoboy" : "Soma of all motoboy channels"}
                </span>
              </div>
            </div>

            {/* Card 3: Avg Margin */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-3.5 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="bg-violet-50 p-3 rounded-xl border border-violet-100 text-violet-600 shrink-0">
                <Percent className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                  {language === "pt" ? "CMV" : "CMV"}
                </p>
                <h3 className="text-lg font-black text-slate-900 mt-1.5 font-mono leading-none">
                  {summaryStats.averageMargin.toFixed(1)}%
                </h3>
                <span className="text-[9.5px] text-slate-400 block mt-1.5 truncate">
                  {language === "pt" ? "Do mês anterior" : "From last month"}
                </span>
              </div>
            </div>
          </div>

          {/* RECHARTS DAILY EVOLUTION */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  {language === "pt" ? "Evolução do Faturamento Diário" : "Daily Operational Revenue & Profit Track"}
                </h4>
                <p className="text-[10px] text-slate-400">
                  {language === "pt" 
                    ? "Comparativo diário entre o caixa bruto faturado e o lucro líquido real computado" 
                    : "Continuous day-by-day lookup contrasting gross receipt capture against real net profit values"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-white border border-slate-200 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-300 outline-hidden px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 cursor-pointer shadow-3xs transition-all"
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const yDef = new Date().getFullYear();
                    const mNum = i + 1;
                    const mPref = `${yDef}-${String(mNum).padStart(2, "0")}`;
                    const label = new Date(yDef, i, 15).toLocaleString(
                      language === "pt" ? "pt-BR" : "en-US", 
                      { month: "long" }
                    );
                    const formattedLabel = label.charAt(0).toUpperCase() + label.slice(1);
                    return (
                      <option key={mPref} value={mPref}>
                        {formattedLabel} {yDef}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="h-[280px] w-full min-w-0 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: -15, right: 10, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      borderRadius: '12px', 
                      border: 'none', 
                      color: '#f8fafc',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey={language === "pt" ? "Faturamento" : "Revenue"} 
                    stroke="#10b981" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorRev)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey={language === "pt" ? "Lucro" : "Profit"} 
                    stroke="#0ea5e9" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorProfit)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: LOG DAILY REVENUE / CREATE SALES ENTRY */}
      {activeTab === "daily" && (
        <div className="space-y-6">
          
          {/* SPREADSHEETS FOR EACH CONFIGURED STORE */}
          {stores.length > 0 && (
            <div className="space-y-6 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-1 gap-6">
                {stores.map((store) => {
                  const FIXED_ORDER = ["AMO", "iFood", "99Food", "Website", "Motoboy"];
                  const activeRaw = store.activeChannels && store.activeChannels.length > 0
                    ? store.activeChannels
                    : FIXED_ORDER;
                  const storeChannels = FIXED_ORDER.filter(ch =>
                    activeRaw.map(c => c.toLowerCase()).includes(ch.toLowerCase())
                  );
                  
                  const isStoreSaving = savingStoreIds[store.id] || false;
                  const isStoreUnsaved = unsavedStoreIds[store.id] || false;
                  const storeData = allStoresMatrixData[store.id] || {};
                  
                  const [yearStr, monthStr] = selectedMonth.split("-");
                  const yearVal = parseInt(yearStr, 10) || new Date().getFullYear();
                  const monthVal = parseInt(monthStr, 10) || (new Date().getMonth() + 1);
                  const daysInMonth = new Date(yearVal, monthVal, 0).getDate();
                  
                  return (
                    <div key={store.id} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-2xs space-y-4 text-left">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-50">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                              <Store className="w-4 h-4 text-slate-550 shrink-0" />
                              {store.storeName}
                            </h3>
                            {store.id === activeStoreId && (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/55 text-[8px] tracking-wide font-mono font-bold px-1.5 py-0.5 rounded-md">
                                {language === "pt" ? "Foco Ativo" : "Active Focus"}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {language === "pt" 
                              ? `Planilha operacional da filial ${store.storeName}. Canais ativos: ${storeChannels.join(", ")}.`
                              : `Branch ledger spreadsheets for ${store.storeName}. Platforms: ${storeChannels.join(", ")}.`}
                          </p>
                        </div>

                        {/* SAVE ACTION BUTTON AND MONTH SELECTOR */}
                        <div className="flex items-center flex-wrap gap-2.5 self-start sm:self-center">
                          {isStoreUnsaved && (
                            <span className="text-[10px] text-amber-600 font-bold bg-amber-50 border border-amber-200/55 px-2 py-1 rounded-lg animate-pulse whitespace-nowrap">
                              {language === "pt" ? "Alterações pendentes" : "Unsaved changes"}
                            </span>
                          )}

                          <div className="flex items-center gap-1">
                            <select
                              value={selectedMonth}
                              onChange={(e) => setSelectedMonth(e.target.value)}
                              className="bg-white border border-slate-200 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-300 outline-hidden px-2 rounded-lg text-xs font-bold text-slate-700 cursor-pointer shadow-3xs py-1 transition-all"
                            >
                              {Array.from({ length: 12 }, (_, i) => {
                                const yDef = new Date().getFullYear();
                                const mNum = i + 1;
                                const mPref = `${yDef}-${String(mNum).padStart(2, "0")}`;
                                const label = new Date(yDef, i, 15).toLocaleString(
                                  language === "pt" ? "pt-BR" : "en-US", 
                                  { month: "long" }
                                );
                                const formattedLabel = label.charAt(0).toUpperCase() + label.slice(1);
                                return (
                                  <option key={mPref} value={mPref}>
                                    {formattedLabel} {yDef}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <button
                            type="button"
                            disabled={isStoreSaving}
                            onClick={() => handleSaveStoreMatrix(store.id, storeData)}
                            className="flex items-center gap-1.5 justify-center bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-1.5 px-3.5 rounded-xl shadow-xs cursor-pointer transition-all disabled:opacity-50 whitespace-nowrap"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {isStoreSaving 
                              ? (language === "pt" ? "Salvando..." : "Saving...") 
                              : (language === "pt" ? "Salvar" : "Save")}
                          </button>
                        </div>
                      </div>

                      {/* INDIVIDUAL SPREADSHEET TABLE */}
                      <div className="overflow-auto border border-slate-100 rounded-xl max-h-[300px] shadow-3xs" style={{ position: "relative" }}>
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-12 border-b border-slate-100 text-[10px]">
                            <tr>
                              <th className="py-2 px-3 bg-slate-50 text-left sticky left-0 z-20 border-r border-slate-100 min-w-[60px] shadow-[2px_0_4px_rgba(0,0,0,0.02)] font-bold text-slate-500">
                                {language === "pt" ? "Dia" : "Day"}
                              </th>
                              {storeChannels.map((channel) => (
                                <th key={channel} className="py-2 px-4 font-bold text-right min-w-[110px] bg-slate-50 border-r border-slate-100/50 last:border-r-0 text-slate-500">
                                  {channel === "Counter" ? (language === "pt" ? "Balcão" : "Counter") : channel}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {Array.from({ length: daysInMonth }, (_, idx) => idx + 1).map((day) => {
                              return (
                                <tr key={day} className="hover:bg-slate-50/50 transition-colors group">
                                  <td className="py-1 px-3 bg-slate-50/60 border-r border-slate-100/60 sticky left-0 z-10 font-bold text-slate-500 group-hover:bg-slate-100/50 shadow-[2px_0_4px_rgba(0,0,0,0.015)]">
                                    {String(day).padStart(2, "0")}
                                  </td>
                                  {storeChannels.map((channel) => {
                                    const channelValues = storeData[day] || {};
                                    const currentVal = channelValues[channel] ?? 0;
                                    
                                    return (
                                      <td key={channel} className="p-0 border-r border-slate-50 font-mono last:border-r-0">
                                        <input
                                          type="number"
                                          min={0}
                                          step="any"
                                          value={currentVal === 0 ? "" : currentVal}
                                          placeholder="0.00"
                                          onChange={(e) => {
                                            const rawVal = e.target.value === "" ? 0 : parseFloat(e.target.value) || 0;
                                            
                                            // Update matrix data state safely for this store
                                            setAllStoresMatrixData((prev) => {
                                              const currentStoreMatrix = prev[store.id] || {};
                                              const currentDayMatrix = currentStoreMatrix[day] || {};
                                              return {
                                                ...prev,
                                                [store.id]: {
                                                  ...currentStoreMatrix,
                                                  [day]: {
                                                    ...currentDayMatrix,
                                                    [channel]: rawVal
                                                  }
                                                }
                                              };
                                            });
                                            
                                            // Set store unsaved state
                                            setUnsavedStoreIds((prev) => ({
                                              ...prev,
                                              [store.id]: true
                                            }));
                                          }}
                                          className="w-full text-right bg-transparent px-4 py-1.5 focus:bg-emerald-50/20 text-slate-700 outline-hidden font-mono text-xs border-b-2 border-transparent focus:border-emerald-450 transition-all placeholder-slate-200"
                                        />
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>

                          {/* COLUMN FOOTER SUM FROM SPREADSHEET */}
                          <tfoot className="bg-slate-50 border-t border-slate-100 text-slate-800 font-bold sticky bottom-0 z-12">
                            <tr>
                              <td className="py-2.5 px-3 bg-slate-50 border-r border-slate-100 text-left sticky left-0 z-20 font-black text-slate-600 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                                Total
                              </td>
                              {storeChannels.map((channel) => {
                                let sumCol = 0;
                                for (let d = 1; d <= daysInMonth; d++) {
                                  sumCol += storeData[d]?.[channel] ?? 0;
                                }
                                const isMotoboy = channel.toLowerCase() === "motoboy";
                                return (
                                  <td 
                                    key={channel} 
                                    className={`py-2.5 px-4 text-right font-mono text-xs font-black border-r border-slate-100/50 last:border-r-0 whitespace-nowrap bg-slate-50 ${
                                      isMotoboy ? "text-rose-600 font-bold" : "text-emerald-700"
                                    }`}
                                  >
                                    {formatCurrency(sumCol)}
                                  </td>
                                );
                              })}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* VIEW 3: STORE METADATA CONFIGS */}
      {activeTab === "store-config" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Stores List Panel */}
          <div className="md:col-span-5 bg-white rounded-2xl border border-slate-100 p-5 shadow-2xs space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {language === "pt" ? "Lojas Cadastradas" : "Registered Stores"}
                </h4>
                <p className="text-[10px] text-slate-400">
                  {language === "pt" ? "Selecione e gerencie seus pontos" : "Select and manage branch profiles"}
                </p>
              </div>
              
              {/* Button to Add New Store */}
              <button
                type="button"
                onClick={async () => {
                  const newStoreId = "store_" + generateId();
                  const newStore: StoreBrand = {
                    id: newStoreId,
                    storeName: language === "pt" ? "Nova Loja" : "New Store Branch",
                    taxId: "",
                    defaultTaxPercent: 12.0,
                    monthlyTargetRevenue: 10000,
                    activeChannels: ["iFood", "Website"]
                  };
                  const updatedStores = [...stores, newStore];
                  setStores(updatedStores);
                  setActiveStoreId(newStoreId);
                  
                  // Auto save to database
                  setIsSaving(true);
                  try {
                    await setDoc(doc(db, "settings", "store_config"), {
                      activeStoreId: newStoreId,
                      stores: updatedStores,
                      storeName: newStore.storeName,
                      taxId: newStore.taxId,
                      defaultTaxPercent: newStore.defaultTaxPercent,
                      monthlyTargetRevenue: newStore.monthlyTargetRevenue
                    });
                    trgToast(language === "pt" ? "Nova loja criada com sucesso!" : "New store branch successfully created!");
                  } catch (err) {
                    console.error("Error creating new store:", err);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                title={language === "pt" ? "Adicionar Nova Loja" : "Add New Store"}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {stores.map((s) => {
                const isActive = s.id === activeStoreId;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setActiveStoreId(s.id);
                      setStoreConfig({
                        storeName: s.storeName,
                        taxId: s.taxId || "",
                        defaultTaxPercent: s.defaultTaxPercent,
                        monthlyTargetRevenue: s.monthlyTargetRevenue
                      });
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                      isActive 
                        ? "border-emerald-500 bg-emerald-50/20 shadow-xs" 
                        : "border-slate-100 hover:border-slate-200 bg-slate-50/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-xs text-slate-800 truncate">
                          {s.storeName}
                        </h5>
                        {isActive && (
                          <span className="bg-emerald-100 text-emerald-800 text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase scale-90 shrink-0">
                            {language === "pt" ? "Ativa" : "Active"}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-455 mt-1 truncate max-w-[180px]">
                        {language === "pt" ? "Canais: " : "Channels: "}
                        {s.activeChannels && s.activeChannels.length > 0 
                          ? s.activeChannels.join(", ") 
                          : (language === "pt" ? "Nenhum" : "None")}
                      </p>
                    </div>

                    {/* Delete branch if count > 1 */}
                    {stores.length > 1 && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!window.confirm(language === "pt" ? `Deseja realmente excluir a loja "${s.storeName}"?` : `Are you sure you want to delete store "${s.storeName}"?`)) return;
                          
                          const leftoverStores = stores.filter((st) => st.id !== s.id);
                          const nextActiveId = s.id === activeStoreId ? leftoverStores[0].id : activeStoreId;
                          
                          setStores(leftoverStores);
                          setActiveStoreId(nextActiveId);
                          
                          const nextActiveStore = leftoverStores.find((st) => st.id === nextActiveId) || leftoverStores[0];
                          setStoreConfig({
                            storeName: nextActiveStore.storeName,
                            taxId: nextActiveStore.taxId || "",
                            defaultTaxPercent: nextActiveStore.defaultTaxPercent,
                            monthlyTargetRevenue: nextActiveStore.monthlyTargetRevenue
                          });

                          setIsSaving(true);
                          try {
                            await setDoc(doc(db, "settings", "store_config"), {
                              activeStoreId: nextActiveId,
                              stores: leftoverStores,
                              storeName: nextActiveStore.storeName,
                              taxId: nextActiveStore.taxId,
                              defaultTaxPercent: nextActiveStore.defaultTaxPercent,
                              monthlyTargetRevenue: nextActiveStore.monthlyTargetRevenue
                            });
                            trgToast(language === "pt" ? "Loja excluída!" : "Store deleted successfully!");
                          } catch (err) {
                            console.error("Error deleting store:", err);
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ml-2 shrink-0"
                        title={language === "pt" ? "Excluir Loja" : "Delete Store"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Store Edit Configuration Form */}
          <div className="md:col-span-7 bg-white rounded-2xl border border-slate-100 p-6 shadow-2xs space-y-5 text-left">
            {activeStore ? (
              <>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                    {language === "pt" ? "Preferências da " : "Preferences for "} {activeStore.storeName}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {language === "pt"
                      ? "Selecione quais canais estão ativados e ajuste metas mercantis do ponto de venda"
                      : "Modify active platforms, naming setups and target metrics of this corporate profile"}
                  </p>
                </div>

                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    // Save activeStore configuration
                    await handleSaveStoreConfig(activeStore.id, activeStore);
                  }} 
                  className="space-y-4 font-medium text-slate-700"
                >
                  {/* Store Name input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500">
                      {language === "pt" ? "Nome Fantasia da Loja" : "Store Brand Name"}
                    </label>
                    <input 
                      type="text"
                      required
                      value={activeStore.storeName}
                      onChange={(e) => {
                        const updated = stores.map((s) => s.id === activeStore.id ? { ...s, storeName: e.target.value } : s);
                        setStores(updated);
                        setStoreConfig(prev => ({ ...prev, storeName: e.target.value }));
                      }}
                      className="w-full text-xs bg-slate-50 border border-slate-200 outline-hidden px-3.5 py-2.5 rounded-xl text-slate-800 focus:border-emerald-300 focus:bg-white transition-all focus:ring-1 focus:ring-emerald-300"
                    />
                  </div>

                  {/* SALES CHANNELS CHECKBOXES SELECTION (AMO, iFood, 99Food, Website, Motoboy) */}
                  <div className="space-y-2 border-y border-slate-100 py-4.5">
                    <label className="text-xs font-bold text-slate-500 block mb-1">
                      {language === "pt" ? "Canais de Faturamento Ativos" : "Active Revenue Sales Channels"}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 col-span-full">
                      {["AMO", "iFood", "99Food", "Website", "Motoboy"].map((channel) => {
                        const isChecked = (activeStore.activeChannels || []).includes(channel);
                        return (
                          <label 
                            key={channel}
                            className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                              isChecked 
                                ? "border-emerald-500/40 bg-emerald-50/30 text-slate-850"
                                : "border-slate-100 hover:border-slate-200 bg-slate-50/40 text-slate-400"
                            }`}
                          >
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleChannel(channel)}
                              className="accent-emerald-600 rounded w-4 h-4 cursor-pointer shrink-0"
                            />
                            <span className="text-xs font-bold">{channel}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>


                  {/* SAVE ACTION */}
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3.5 px-4 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isSaving 
                      ? (language === "pt" ? "Salvando Alterações..." : "Saving Parameters...") 
                      : (language === "pt" ? "Salvar Alterações da Loja" : "Save Store Configuration")}
                  </button>

                </form>
              </>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                {language === "pt" ? "Crie ou selecione uma loja para começar." : "Please select or create a store branch to proceed."}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
