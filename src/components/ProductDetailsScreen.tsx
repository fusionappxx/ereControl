import React, { useState, useMemo, useEffect } from "react";
import { 
  ArrowLeft, 
  Tag, 
  Calendar, 
  Store, 
  TrendingDown, 
  TrendingUp, 
  DollarSign, 
  Scale, 
  Camera, 
  Barcode as BarcodeIcon,
  Check,
  Edit2,
  Info,
  Layers,
  Trash2,
  Plus,
  Droplet,
  Zap,
  Flame,
  ChefHat,
  PlusCircle,
  FileText,
  Briefcase,
  HelpCircle,
  Percent,
  CheckCircle2
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { ReceiptItem } from "../types";
import { 
  formatCurrency, 
  getGlobalCurrency,
  getProductPhoto, 
  getStableBarcode, 
  parseVolumeOrWeight,
  safeStorage
} from "../utils";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const compressBase64Image = (base64Str: string, maxWidth = 400, maxHeight = 400, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith("data:image")) {
      resolve(base64Str);
      return;
    }
    // If it's already quite small (e.g. under 100KB), no need to compress it
    if (base64Str.length < 150000) {
      resolve(base64Str);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed);
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
    img.src = base64Str;
  });
};

interface ProductDetailsScreenProps {
  productName: string;
  items: ReceiptItem[];
  language?: "en" | "pt";
  onBack: () => void;
  onUpdateProductSpecs: (
    productName: string, 
    specs: { 
      customBarcode?: string; 
      customWeightOrVolValue?: number; 
      customWeightOrVolUnit?: 'g' | 'kg' | 'ml' | 'l' | 'unit'; 
    }
  ) => void;
  onRenameProduct: (oldName: string, newName: string) => Promise<void>;
  onNavigateToCosting?: (productName: string) => void;
}

export default function ProductDetailsScreen({
  productName,
  items,
  language = "en",
  onBack,
  onUpdateProductSpecs,
  onRenameProduct,
  onNavigateToCosting
}: ProductDetailsScreenProps) {
  // Aggregate history for items matching this name case-insensitively
  const matchingHistory = useMemo(() => {
    return items
      .filter(item => item.name.trim().toLowerCase() === productName.trim().toLowerCase())
      .sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());
  }, [items, productName]);

  // Current record fallback
  const firstMatch = matchingHistory[0];
  const lastMatch = [...matchingHistory].reverse()[0];
  const activeCategory = lastMatch?.category || "Other";

  // Editable/Custom Specs
  const [isEditingSpecs, setIsEditingSpecs] = useState(false);
  const [customBarcode, setCustomBarcode] = useState(lastMatch?.customBarcode || "");
  const [customValInput, setCustomValInput] = useState(
    lastMatch?.customWeightOrVolValue !== undefined 
      ? lastMatch.customWeightOrVolValue.toString() 
      : ""
  );
  const [customUnit, setCustomUnit] = useState<'g' | 'kg' | 'ml' | 'l' | 'unit'>(
    lastMatch?.customWeightOrVolUnit || "g"
  );

  // Synchronize input fields when items updates
  React.useEffect(() => {
    if (lastMatch) {
      setCustomBarcode(lastMatch.customBarcode || "");
      setCustomValInput(
        lastMatch.customWeightOrVolValue !== undefined 
          ? lastMatch.customWeightOrVolValue.toString() 
          : ""
      );
      setCustomUnit(lastMatch.customWeightOrVolUnit || "g");
    }
  }, [lastMatch]);

  // Renaming & Merging state parameters
  const [manageMode, setManageMode] = useState<'rename' | 'merge'>('rename');
  const [newNameInput, setNewNameInput] = useState(productName);
  const [selectedMergeTarget, setSelectedMergeTarget] = useState("");
  const [mergeFilter, setMergeFilter] = useState("");

  const originalName = useMemo(() => {
    const matchedWithOriginal = matchingHistory.find(item => item.originalName);
    return matchedWithOriginal ? matchedWithOriginal.originalName : null;
  }, [matchingHistory]);

  const otherUniqueProductNames = useMemo(() => {
    const currentLower = productName.trim().toLowerCase();
    const set = new Set<string>();
    items.forEach(item => {
      const name = item.name.trim();
      if (name && name.toLowerCase() !== currentLower) {
        set.add(name);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items, productName]);

  const filteredOtherProducts = useMemo(() => {
    if (!mergeFilter.trim()) return otherUniqueProductNames;
    const term = mergeFilter.toLowerCase();
    return otherUniqueProductNames.filter(name => name.toLowerCase().includes(term));
  }, [otherUniqueProductNames, mergeFilter]);

  // Synchronize when product changes
  React.useEffect(() => {
    setNewNameInput(productName);
    setSelectedMergeTarget("");
    setMergeFilter("");
  }, [productName]);

  const handleRenameExecute = async () => {
    const cleanNew = newNameInput.trim();
    if (!cleanNew || cleanNew === productName) return;

    // Migrate the custom photo if renaming
    try {
      const saved = safeStorage.getItem("grocery_custom_photos");
      const photos = saved ? JSON.parse(saved) : {};
      const oldKey = productName.trim().toLowerCase();
      const newKey = cleanNew.trim().toLowerCase();
      if (photos[oldKey]) {
        if (!photos[newKey]) {
          photos[newKey] = photos[oldKey];
        }
        delete photos[oldKey];
        safeStorage.setItem("grocery_custom_photos", JSON.stringify(photos));
        setCustomPhotos(photos);
      }
    } catch (err) {
      console.error("Failed to migrate photo on rename:", err);
    }

    await onRenameProduct(productName, cleanNew);
  };

  const handleMergeExecute = async () => {
    const target = selectedMergeTarget.trim();
    if (!target || target === productName) return;

    // Merge photo logic: keep the product photo if the other item doesn't have a custom photo
    try {
      const saved = safeStorage.getItem("grocery_custom_photos");
      const photos = saved ? JSON.parse(saved) : {};
      const oldKey = productName.trim().toLowerCase();
      const newKey = target.trim().toLowerCase();

      if (photos[oldKey]) {
        if (!photos[newKey]) {
          // Keep the photo because the target (other item) doesn't have a custom photo
          photos[newKey] = photos[oldKey];
        }
        // Delete old key since the items have been merged into the target and oldKey is merged/removed.
        delete photos[oldKey];
        safeStorage.setItem("grocery_custom_photos", JSON.stringify(photos));
        setCustomPhotos(photos);
      }
    } catch (err) {
      console.error("Failed to migrate photo on merge:", err);
    }

    await onRenameProduct(productName, target);
  };

  // Custom photos persisted in localStorage
  const [customPhotos, setCustomPhotos] = useState<Record<string, string>>(() => {
    try {
      const saved = safeStorage.getItem("grocery_custom_photos");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const compressedBase64 = await compressBase64Image(base64String);
      const updated = { ...customPhotos, [productName.trim().toLowerCase()]: compressedBase64 };
      setCustomPhotos(updated);
      try {
        safeStorage.setItem("grocery_custom_photos", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to persist custom photo to localStorage:", err);
      }
    };
    reader.readAsDataURL(file);
  };

  // ==========================================
  // COSTING & RECIPE SHEET STATE & HANDLERS
  // ==========================================
  const [costingTab, setCostingTab] = useState<"fixed" | "production" | "recipe">("fixed");

  const [fixedExpenses, setFixedExpenses] = useState<Array<{ id: string; name: string; month: string; value: number }>>([]);
  const [productionCosts, setProductionCosts] = useState<{
    water: number;
    electricity: number;
    gas: number;
    electricity2: number;
  }>({ water: 0, electricity: 0, gas: 0, electricity2: 0 });
  const [recipeIngredients, setRecipeIngredients] = useState<Array<{ id: string; name: string; quantity: number; unit: string; price: number }>>([]);
  const [recipePortions, setRecipePortions] = useState<number>(1);
  const [recipeMarkup, setRecipeMarkup] = useState<number>(2.0);
  const [isCostingLoading, setIsCostingLoading] = useState(true);

  // Form controls
  const [selectedIngredientProduct, setSelectedIngredientProduct] = useState<string>("");
  const [customIngredientName, setCustomIngredientName] = useState<string>("");
  const [ingredientQtyInput, setIngredientQtyInput] = useState<string>("");
  const [ingredientUnitInput, setIngredientUnitInput] = useState<string>("g");
  const [ingredientPriceInput, setIngredientPriceInput] = useState<string>("");

  const [fixedExpenseName, setFixedExpenseName] = useState<string>("");
  const [fixedExpenseMonth, setFixedExpenseMonth] = useState<string>(() => {
    const today = new Date();
    const monthsPt = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthsEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return language === "pt" ? monthsPt[today.getMonth()] : monthsEn[today.getMonth()];
  });
  const [fixedExpenseValue, setFixedExpenseValue] = useState<string>("");

  // Firestore Sync Writes
  const saveCostingToFirestore = async (updated: {
    fixedExpenses?: typeof fixedExpenses;
    productionCosts?: typeof productionCosts;
    recipeIngredients?: typeof recipeIngredients;
    recipePortions?: number;
    recipeMarkup?: number;
  }) => {
    const docKey = productName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    const docRef = doc(db, "product_costings", docKey);
    const payload = {
      fixedExpenses: updated.fixedExpenses !== undefined ? updated.fixedExpenses : fixedExpenses,
      productionCosts: updated.productionCosts !== undefined ? updated.productionCosts : productionCosts,
      recipeIngredients: updated.recipeIngredients !== undefined ? updated.recipeIngredients : recipeIngredients,
      recipePortions: updated.recipePortions !== undefined ? updated.recipePortions : recipePortions,
      recipeMarkup: updated.recipeMarkup !== undefined ? updated.recipeMarkup : recipeMarkup,
      updatedAt: new Date().toISOString()
    };
    try {
      await setDoc(docRef, payload);
    } catch (err) {
      console.error("Error saving costing fields:", err);
    }
  };

  // Sync Reads from Firestore
  useEffect(() => {
    setIsCostingLoading(true);
    const docKey = productName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    const docRef = doc(db, "product_costings", docKey);

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data) {
          if (Array.isArray(data.fixedExpenses)) setFixedExpenses(data.fixedExpenses);
          if (data.productionCosts) setProductionCosts({
            water: Number(data.productionCosts.water) || 0,
            electricity: Number(data.productionCosts.electricity) || 0,
            gas: Number(data.productionCosts.gas) || 0,
            electricity2: Number(data.productionCosts.electricity2) || 0
          });
          if (Array.isArray(data.recipeIngredients)) setRecipeIngredients(data.recipeIngredients);
          if (data.recipePortions !== undefined) setRecipePortions(Number(data.recipePortions) || 1);
          if (data.recipeMarkup !== undefined) setRecipeMarkup(Number(data.recipeMarkup) || 2.0);
        }
      } else {
        setFixedExpenses([]);
        setProductionCosts({ water: 0, electricity: 0, gas: 0, electricity2: 0 });
        setRecipeIngredients([]);
        setRecipePortions(1);
        setRecipeMarkup(2.0);
      }
      setIsCostingLoading(false);
    }, (error) => {
      console.error("Costing loading snap error: ", error);
      setIsCostingLoading(false);
    });

    return () => unsubscribe();
  }, [productName]);

  // Extract ingredients list auto-suggest
  const uniqueGroceryItemsList = useMemo(() => {
    const namesSet = new Set<string>();
    const itemMap: Record<string, ReceiptItem> = {};
    items.forEach(itm => {
      const cleanItmName = itm.name.trim();
      if (cleanItmName && cleanItmName.toLowerCase() !== productName.trim().toLowerCase()) {
        namesSet.add(cleanItmName);
        const existing = itemMap[cleanItmName];
        if (!existing || new Date(itm.purchaseDate).getTime() > new Date(existing.purchaseDate).getTime()) {
          itemMap[cleanItmName] = itm;
        }
      }
    });
    return Array.from(namesSet).sort().map(name => ({
      name,
      latestItem: itemMap[name]
    }));
  }, [items, productName]);

  // Fill forms on ingredient product switch
  useEffect(() => {
    if (!selectedIngredientProduct || selectedIngredientProduct === "custom") {
      setIngredientPriceInput("");
      setIngredientUnitInput("g");
      return;
    }
    const matched = uniqueGroceryItemsList.find(g => g.name === selectedIngredientProduct);
    if (matched && matched.latestItem) {
      const lItem = matched.latestItem;
      const price = Number(lItem.price) || 0;
      const isCustomWeightVal = lItem.customWeightOrVolValue !== undefined && lItem.customWeightOrVolValue > 0;
      let weightVal = isCustomWeightVal ? lItem.customWeightOrVolValue : 0;
      let weightUnit = isCustomWeightVal ? lItem.customWeightOrVolUnit : "";

      if (!isCustomWeightVal) {
        const parsed = parseVolumeOrWeight(lItem.name);
        weightVal = parsed.value;
        weightUnit = parsed.unit;
      }

      if (weightVal && weightVal > 0 && weightUnit) {
        let baseQtyMultiplier = 1;
        if (weightUnit === "kg" || weightUnit === "l") {
          baseQtyMultiplier = 1000;
        }
        const totalBaseQty = weightVal * baseQtyMultiplier;
        const pricePerUnit = price / totalBaseQty;
        setIngredientPriceInput(pricePerUnit.toFixed(4));
        setIngredientUnitInput(weightUnit === "kg" || weightUnit === "g" ? "g" : "ml");
      } else {
        setIngredientPriceInput(price.toFixed(2));
        setIngredientUnitInput("unit");
      }
    }
  }, [selectedIngredientProduct, uniqueGroceryItemsList]);

  // Actions
  const handleAddFixedExpense = () => {
    if (!fixedExpenseName.trim() || !fixedExpenseValue) return;
    const val = parseFloat(fixedExpenseValue);
    if (isNaN(val) || val <= 0) return;

    const newExpense = {
      id: "fe_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
      name: fixedExpenseName.trim(),
      month: fixedExpenseMonth,
      value: val
    };

    const updated = [...fixedExpenses, newExpense];
    setFixedExpenses(updated);
    saveCostingToFirestore({ fixedExpenses: updated });
    setFixedExpenseName("");
  };

  const handleDeleteFixedExpense = (id: string) => {
    const updated = fixedExpenses.filter(fe => fe.id !== id);
    setFixedExpenses(updated);
    saveCostingToFirestore({ fixedExpenses: updated });
  };

  const handleUpdateProductionCost = (key: keyof typeof productionCosts, valStr: string) => {
    const val = parseFloat(valStr) || 0;
    const updated = {
      ...productionCosts,
      [key]: Math.max(0, val)
    };
    setProductionCosts(updated);
    saveCostingToFirestore({ productionCosts: updated });
  };

  const handleAddIngredient = () => {
    const ingredientName = selectedIngredientProduct === "custom" 
      ? customIngredientName.trim() 
      : selectedIngredientProduct;

    if (!ingredientName || !ingredientQtyInput || !ingredientPriceInput) return;
    const qty = parseFloat(ingredientQtyInput);
    const prc = parseFloat(ingredientPriceInput);
    if (isNaN(qty) || qty <= 0 || isNaN(prc) || prc < 0) return;

    const newIngredient = {
      id: "ing_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
      name: ingredientName,
      quantity: qty,
      unit: ingredientUnitInput,
      price: prc
    };

    const updated = [...recipeIngredients, newIngredient];
    setRecipeIngredients(updated);
    saveCostingToFirestore({ recipeIngredients: updated });

    setSelectedIngredientProduct("");
    setCustomIngredientName("");
    setIngredientQtyInput("");
    setIngredientPriceInput("");
  };

  const handleDeleteIngredient = (id: string) => {
    const updated = recipeIngredients.filter(ing => ing.id !== id);
    setRecipeIngredients(updated);
    saveCostingToFirestore({ recipeIngredients: updated });
  };

  // Math aggregates
  const totalFixedExpensesSum = useMemo(() => {
    return fixedExpenses.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  }, [fixedExpenses]);

  const totalProductionCostsSum = useMemo(() => {
    return (
      (Number(productionCosts.water) || 0) +
      (Number(productionCosts.electricity) || 0) +
      (Number(productionCosts.gas) || 0) +
      (Number(productionCosts.electricity2) || 0)
    );
  }, [productionCosts]);

  const ingredientsCostSum = useMemo(() => {
    return recipeIngredients.reduce((sum, ing) => sum + (Number(ing.quantity) || 0) * (Number(ing.price) || 0), 0);
  }, [recipeIngredients]);

  const finalCostPerPortion = useMemo(() => {
    const portionsVal = recipePortions > 0 ? recipePortions : 1;
    const ingPortion = ingredientsCostSum / portionsVal;
    const prodPortion = totalProductionCostsSum / portionsVal;
    const fixedPortion = totalFixedExpensesSum / portionsVal;

    return {
      ingredients: ingPortion,
      production: prodPortion,
      fixed: fixedPortion,
      total: ingPortion + prodPortion + fixedPortion
    };
  }, [ingredientsCostSum, totalProductionCostsSum, totalFixedExpensesSum, recipePortions]);

  const suggestedSellingPrice = useMemo(() => {
    return finalCostPerPortion.total * recipeMarkup;
  }, [finalCostPerPortion, recipeMarkup]);

  // Photo resolution
  const photoUrl = getProductPhoto(productName, activeCategory);
  const currentPhoto = customPhotos[productName.trim().toLowerCase()] || photoUrl;

  // Parse specifications
  const parsedSpecs = useMemo(() => {
    const defaultParsed = parseVolumeOrWeight(productName);
    
    const hasCustomVal = lastMatch?.customWeightOrVolValue !== undefined && lastMatch?.customWeightOrVolValue > 0;
    const finalVal = hasCustomVal ? (lastMatch.customWeightOrVolValue || 0) : defaultParsed.value;
    const finalUnit = hasCustomVal ? (lastMatch.customWeightOrVolUnit || "g") : defaultParsed.unit;

    return {
      value: finalVal,
      unit: finalUnit,
      isCustom: hasCustomVal
    };
  }, [productName, lastMatch]);

  // Unique Barcode display
  const finalBarcode = lastMatch?.customBarcode || getStableBarcode(productName);

  // Calculate prices
  const statistics = useMemo(() => {
    if (matchingHistory.length === 0) {
      return { lowestPrice: 0, lastPrice: 0, highestPrice: 0, averagePrice: 0 };
    }
    const prices = matchingHistory.map(h => Number(h.price) || 0);
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);
    const lastPrice = Number(lastMatch?.price) || 0;
    const sum = prices.reduce((a, b) => a + b, 0);
    const averagePrice = sum / prices.length;

    return {
      lowestPrice,
      lastPrice,
      highestPrice,
      averagePrice
    };
  }, [matchingHistory, lastMatch]);

  // Math for Cost per unit (gram or milliliter)
  const unitCostAnalysis = useMemo(() => {
    const { value, unit } = parsedSpecs;
    const lastPrice = statistics.lastPrice;

    if (!value || !unit || lastPrice <= 0) {
      return null;
    }

    let baseQty = 0; // total base units (g or ml)
    let baseUnitName = "";
    let standardLabel = ""; // per 100g / 100ml
    let standardFactor = 100;

    switch (unit) {
      case "g":
        baseQty = value;
        baseUnitName = "g";
        standardLabel = "100g";
        break;
      case "kg":
        baseQty = value * 1000;
        baseUnitName = "g";
        standardLabel = "100g";
        break;
      case "ml":
        baseQty = value;
        baseUnitName = "ml";
        standardLabel = "100ml";
        break;
      case "l":
        baseQty = value * 1000;
        baseUnitName = "ml";
        standardLabel = "100ml";
        break;
      case "unit":
        baseQty = value;
        baseUnitName = language === "pt" ? "un" : "unit";
        standardLabel = language === "pt" ? "unidade" : "unit";
        standardFactor = 1;
        break;
    }

    if (baseQty <= 0) return null;

    const costPerBase = lastPrice / baseQty;
    const costPerStandard = costPerBase * standardFactor;
    const costPerKgOrL = unit === "unit" ? costPerBase : (costPerBase * 1000);
    const isVolume = ["ml", "l"].includes(unit);
    const kgOrLLabel = isVolume 
      ? "Price per Liter" 
      : (unit === "unit" 
        ? (language === "pt" ? "Preço p/ Unidade" : "Price per Unit") 
        : (language === "pt" ? "Preço por KG" : "Price per KG"));

    return {
      baseQty,
      baseUnitName,
      costPerBase,
      costPerStandard,
      costPerKgOrL,
      kgOrLLabel,
      isVolume,
      standardLabel,
      lastSpent: lastPrice,
      weightLabel: `${value} ${unit === "unit" ? (language === "pt" ? "un" : "units") : unit.toUpperCase()}`
    };
  }, [parsedSpecs, statistics.lastPrice, language]);

  // Recharts Chart Data Formatting
  const chartData = useMemo(() => {
    return matchingHistory.map(h => ({
      date: new Date(h.purchaseDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      price: Number(h.price) || 0,
      store: h.storeName || "Store",
      formattedPrice: formatCurrency(Number(h.price) || 0)
    }));
  }, [matchingHistory]);

  const handleSaveSpecs = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customValInput);
    onUpdateProductSpecs(productName, {
      customBarcode: customBarcode.trim() || undefined,
      customWeightOrVolValue: isNaN(val) ? undefined : val,
      customWeightOrVolUnit: customUnit
    });
    setIsEditingSpecs(false);
  };

  const handleQuickSetSpecs = (val: number, unit: 'g' | 'kg' | 'ml' | 'l' | 'unit') => {
    onUpdateProductSpecs(productName, {
      customWeightOrVolValue: val,
      customWeightOrVolUnit: unit
    });
    setCustomValInput(val.toString());
    setCustomUnit(unit);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 select-text">
      {/* Dynamic Header */}
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
              <span>{language === "pt" ? "Perfil do Produto" : "Product Details Profile"}</span>
              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded-full font-bold">
                {productName}
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {language === "pt" 
                ? "Visualização e parametrização avançada de peso, rendimento e ficha técnica do item selecionado."
                : "View and manage advanced metrics, spec weights, and costing details of the selected item."}
            </p>
          </div>
        </div>
      </div>

      {/* Centered Top Photo Section */}
      <div className="flex flex-col items-center justify-center w-full">
        <div className="w-full max-w-[60%] aspect-[21/9] relative bg-slate-50 flex items-center justify-center group overflow-hidden border border-slate-100 rounded-2xl shadow-xs">
          <img
            src={currentPhoto}
            alt={productName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain p-2 group-hover:scale-[1.01] transition-transform duration-500"
          />
          <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full tracking-wider uppercase">
            {activeCategory}
          </div>
          <label className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-xs hover:bg-slate-50 text-slate-800 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-1.5 cursor-pointer transition-all select-none">
            <Camera className="w-4 h-4 text-slate-500" />
            <span>Edit Photo</span>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handlePhotoUpload} 
            />
          </label>
        </div>
      </div>

      {/* Main Product Spotlight Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Product Profile & Specs */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs hover:shadow-sm transition-shadow space-y-4">
            {/* Product Metadata Context */}
            <div className="space-y-4">
              <div>
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                  {productName}
                </h1>
                {originalName && originalName.trim().toLowerCase() !== productName.trim().toLowerCase() && (
                  <div className="mt-2.5 p-2 bg-slate-55 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 rounded-xl text-slate-600 dark:text-slate-300">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500">Original Scanned Name</p>
                    <p className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-tight mt-0.5 break-all">{originalName}</p>
                  </div>
                )}
              </div>

              {/* Editable Specifications form */}
              <div className="pt-2 border-t border-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-emerald-500" /> Product Specifications
                  </span>
                  
                  {!isEditingSpecs && (
                    <button
                      type="button"
                      onClick={() => setIsEditingSpecs(true)}
                      className="text-[11px] font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" /> Edit Specs
                    </button>
                  )}
                </div>

                {isEditingSpecs ? (
                  <form onSubmit={handleSaveSpecs} className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 space-y-3.5">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1">
                        Manual Barcode Overwrite
                      </label>
                      <input
                        type="text"
                        value={customBarcode}
                        onChange={(e) => setCustomBarcode(e.target.value)}
                        placeholder="Type standard 13-digit barcode..."
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1">
                          Product Size (Value)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={customValInput}
                          onChange={(e) => setCustomValInput(e.target.value)}
                          placeholder="e.g. 500, 1.5, 750"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1">
                          Unit Metric
                        </label>
                        <select
                          value={customUnit}
                          onChange={(e) => setCustomUnit(e.target.value as any)}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden bg-white"
                        >
                          <option value="g">G (Grams)</option>
                          <option value="kg">KG (Kilograms)</option>
                          <option value="ml">ML (Milliliters)</option>
                          <option value="l">L (Liters)</option>
                          <option value="unit">{language === "pt" ? "UN (Unidades)" : "Unit (Units)"}</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      <button
                        type="submit"
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs py-1.5 rounded-lg transition-colors cursor-pointer text-center"
                      >
                        Apply Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingSpecs(false);
                          setCustomBarcode(lastMatch?.customBarcode || "");
                          setCustomValInput(lastMatch?.customWeightOrVolValue !== undefined ? lastMatch.customWeightOrVolValue.toString() : "");
                        }}
                        className="px-2.5 border border-slate-200 hover:bg-slate-100 text-slate-500 rounded-lg text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs text-slate-700 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Packaging unit size:</span>
                      {parsedSpecs.value > 0 ? (
                        <span className="font-bold text-slate-800">
                          {parsedSpecs.value} {parsedSpecs.unit?.toUpperCase()}
                          {parsedSpecs.isCustom && (
                            <span className="text-[10px] text-emerald-600 ml-1 bg-emerald-50 border border-emerald-100 px-1 py-0.1 rounded font-normal">
                              Custom Set
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-amber-500 italic flex items-center gap-1 font-medium text-[11px]">
                          <Info className="w-3.5 h-3.5 shrink-0" />
                          Not specified yet
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Category alignment:</span>
                      <span className="font-semibold text-slate-800">{activeCategory}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Barcode number:</span>
                      <span className="font-mono text-slate-800 font-semibold">{finalBarcode}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card: Rename & Merge item */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs hover:shadow-sm transition-shadow space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5 text-violet-500" /> Rename & Merge Tools
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-1">
                Refine descriptions or join similar product profiles together.
              </p>
            </div>

            {/* Choose Action style (Rename / Merge Tabs) */}
            <div className="flex gap-2 p-1 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <button
                type="button"
                onClick={() => setManageMode("rename")}
                className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all cursor-pointer ${
                  manageMode === "rename" 
                    ? "bg-white dark:bg-slate-705 text-slate-800 dark:text-slate-105 shadow-2xs" 
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                Rename Product
              </button>
              <button
                type="button"
                onClick={() => setManageMode("merge")}
                className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all cursor-pointer ${
                  manageMode === "merge" 
                    ? "bg-white dark:bg-slate-705 text-slate-800 dark:text-slate-105 shadow-2xs" 
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                Merge Similar
              </button>
            </div>

            <div className="space-y-4 pt-1">
              {manageMode === "rename" ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-550 mb-1">
                      New Product Name
                    </label>
                    <input
                      type="text"
                      value={newNameInput}
                      onChange={(e) => setNewNameInput(e.target.value)}
                      placeholder="Type a cleaner name..."
                      className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-violet-500 focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRenameExecute}
                    disabled={!newNameInput.trim() || newNameInput.trim().toLowerCase() === productName.trim().toLowerCase()}
                    className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 text-white font-semibold text-xs py-2 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-3xs hover:shadow-2xs active:scale-[0.99] select-none"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    Apply Rename
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-550 mb-1">
                      Choose Target Product
                    </label>
                    {otherUniqueProductNames.length === 0 ? (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-1">No other unique products in catalog.</p>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Filter catalog products..."
                          value={mergeFilter}
                          onChange={(e) => setMergeFilter(e.target.value)}
                          className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-md px-2 py-1 text-[11px] focus:ring-1 focus:ring-violet-500 focus:outline-hidden"
                        />
                        <select
                          value={selectedMergeTarget}
                          onChange={(e) => setSelectedMergeTarget(e.target.value)}
                          className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-violet-500 focus:outline-hidden"
                        >
                          <option value="">-- Select product profile --</option>
                          {filteredOtherProducts.map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  
                  {selectedMergeTarget && (
                    <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30 rounded-lg text-[10.5px] text-amber-800 dark:text-amber-400 leading-normal">
                      ⚠️ Current <strong>{matchingHistory.length}</strong> purchase records will merge into <strong>{selectedMergeTarget}</strong>, coalescing pricing history charts and statistics.
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!selectedMergeTarget}
                    onClick={handleMergeExecute}
                    className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 text-white font-semibold text-xs py-2 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-3xs hover:shadow-2xs active:scale-[0.99] select-none"
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    Confirm & Merge Records
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side Column (Span 2): Price Graphs & Metrics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Price History Graph */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-violet-500" /> Price History Graph
                </h3>
                <p className="text-[11px] text-slate-400">
                  Unit price progression tracked across {matchingHistory.length} historical purchases
                </p>
              </div>

              <div className="bg-rose-50 text-rose-600 font-bold text-[10px] px-2.0 py-0.5 border border-rose-100 rounded-md">
                {matchingHistory.length === 1 ? "SINGLE RECORD" : `${matchingHistory.length} PURCHASE POINTS`}
              </div>
            </div>

            {/* Price Line chart */}
            <div className="h-64 pt-3">
              {matchingHistory.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-100 text-xs">
                  No price history points to graph.
                </div>
              ) : matchingHistory.length === 1 ? (
                <div className="h-full flex flex-col items-center justify-center bg-slate-50/35 rounded-xl border border-slate-100 border-dashed p-4 text-center">
                  <p className="text-slate-600 text-xs font-semibold">Only one purchase point has been checked so far.</p>
                  <p className="text-slate-400 text-[11px] mt-1 max-w-sm">
                    As you scan more receipts referencing <b>{productName}</b>, a chronological price vector line will draw naturally here.
                  </p>
                  <div className="mt-3 bg-white border border-slate-100 rounded-lg px-3 py-1.5 shadow-2xs text-xs font-mono font-bold text-emerald-500">
                    Retail Price: {formatCurrency(statistics.lastPrice)}
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3.5" stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: "#64748b", fontSize: 9, fontWeight: 500 }} 
                      stroke="#cbd5e1"
                    />
                    <YAxis 
                      tick={{ fill: "#64748b", fontSize: 9, fontWeight: 600, fontFamily: "monospace" }} 
                      stroke="#cbd5e1"
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-800 text-white p-3.5 rounded-xl shadow-lg space-y-1 text-xs select-none">
                              <p className="text-slate-400 font-semibold text-[10px] uppercase tracking-wide flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-emerald-400" /> {data.date}
                              </p>
                              <p className="font-extrabold text-emerald-400 font-mono text-sm">
                                {data.formattedPrice}
                              </p>
                              <p className="text-slate-300 font-medium flex items-center gap-1 mt-1 text-[11px]">
                                <Store className="w-3.5 h-3.5 text-violet-400" /> {data.store}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#8b5cf6" 
                      strokeWidth={3} 
                      activeDot={{ r: 7, stroke: "#ffffff", strokeWidth: 2, fill: "#8b5cf6" }} 
                      dot={{ r: 4, fill: "#c084fc", stroke: "#ffffff", strokeWidth: 1.5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bottom: Statistics Grid row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-50-4 bg-slate-50/20 p-3 rounded-2xl">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Lowest Price</p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <p className="text-base font-extrabold text-rose-500 font-mono">
                    {formatCurrency(statistics.lowestPrice)}
                  </p>
                  <span className="text-[10px] text-green-500 font-semibold bg-green-50 px-1.2 py-0.2 rounded border border-green-100 flex items-center gap-0.5 scale-90">
                    <TrendingDown className="w-3 h-3" /> BEST
                  </span>
                </div>
              </div>

              <div className="border-l border-slate-100 pl-4">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Last Price</p>
                <p className="text-base font-extrabold text-slate-900 font-mono mt-0.5">
                  {formatCurrency(statistics.lastPrice)}
                </p>
              </div>

              <div className="border-l border-slate-100 pl-4 hidden sm:block">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Highest Price</p>
                <p className="text-base font-bold text-slate-600 font-mono mt-0.5">
                  {formatCurrency(statistics.highestPrice)}
                </p>
              </div>

              <div className="border-l border-slate-100 pl-4 hidden sm:block">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Average Paid</p>
                <p className="text-base font-semibold text-slate-600 font-mono mt-0.5">
                  {formatCurrency(statistics.averagePrice)}
                </p>
              </div>
            </div>
          </div>

          {/* Card: cost per gram or milliliter analysis */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5 border-b border-slate-50 pb-3 mb-4">
              <Scale className="w-4 h-4 text-emerald-500" /> Unit Efficiency Evaluation (Cost per Weight/Volume)
            </h3>

            {unitCostAnalysis ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* Visual Circle Score Card */}
                <div className="md:col-span-1 bg-slate-900 text-white rounded-2xl p-5 text-center flex flex-col justify-center items-center shadow-xs">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Raw price per {unitCostAnalysis.baseUnitName}</p>
                  <p className="text-lg font-black font-mono text-emerald-400 mt-2">
                    {getGlobalCurrency() === "BRL" ? "R$ " : getGlobalCurrency() === "EUR" ? "€ " : "$ "}
                    {unitCostAnalysis.costPerBase.toFixed(4)}
                  </p>
                  <p className="text-[10px] text-slate-300 font-medium tracking-tight mt-0.5">
                    per {unitCostAnalysis.baseUnitName}
                  </p>
                  <div className="mt-3.5 bg-slate-800 text-[10px] text-emerald-300 font-bold px-3 py-1.0 rounded-full border border-emerald-500/10">
                    Last Spent: {formatCurrency(unitCostAnalysis.lastSpent)}
                  </div>
                </div>

                {/* Mathematical Details Card */}
                <div className="md:col-span-2 space-y-4">
                  <div className="space-y-1">
                    <p className="text-slate-500 text-xs font-semibold leading-relaxed">
                      Based on standard packaging size of <b>{unitCostAnalysis.weightLabel}</b>, the exact calculated retail price breakdown is:
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                        {unitCostAnalysis.kgOrLLabel}
                      </p>
                      <p className="text-sm font-extrabold text-slate-800 font-mono mt-0.5">
                        {formatCurrency(unitCostAnalysis.costPerKgOrL)}
                      </p>
                    </div>

                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                      <p className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wider">
                        Price per standard {unitCostAnalysis.standardLabel}
                      </p>
                      <p className="text-sm font-extrabold text-emerald-600 font-mono mt-0.5">
                        {formatCurrency(unitCostAnalysis.costPerStandard)}
                      </p>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-normal bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 flex items-start gap-1.5 italic">
                    💡 Cost-per-unit ratios empower you to audit packaging choices instantly inside grocery rows and compare efficiency across brands.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 flex flex-col items-center text-center space-y-4">
                <div className="bg-amber-100 text-amber-600 p-3 rounded-full">
                  <Scale className="w-6 h-6 text-amber-500" />
                </div>
                <div className="space-y-1 max-w-md">
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Packaging Specification Required
                  </h4>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    We could not extract any grams or milliliters from the description <b>"{productName}"</b>. 
                    Please set the item packaging specs below to unlock unit-efficiency metrics.
                  </p>
                </div>

                {/* Quick actions for specs */}
                <div className="pt-2">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2.5">
                    Quick Assign Units
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickSetSpecs(500, "g")}
                      className="bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-700 font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      500 g
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSetSpecs(1, "kg")}
                      className="bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-700 font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      1 kg
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSetSpecs(350, "ml")}
                      className="bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-700 font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      350 ml
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSetSpecs(1, "l")}
                      className="bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-700 font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      1 L
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingSpecs(true)}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Or Type Custom
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card: Redirection to centralized Financial Costing & Recipe Sheet */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-500 shrink-0">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  {language === "pt" ? "Central de Fichas Técnicas & Custeio" : "Centralized Financial Costing & Recipes"}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-normal max-w-lg">
                  {language === "pt"
                    ? "As ferramentas de Ficha Técnica, Custos de Produção e Despesas Fixas agora possuem uma tela exclusiva para gerenciamento simplificado. Toque no botão para abrir este painel."
                    : "Ingredient sheets, monthly fixed expenses, and utility production costs have been consolidated into their own dedicated workspace for simple management. Tap the button to open directly."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToCosting && onNavigateToCosting(productName)}
              className="w-full sm:w-auto shrink-0 bg-amber-500 hover:bg-amber-600 font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 text-white shadow-xs hover:shadow-sm cursor-pointer transition-colors"
            >
              <ChefHat className="w-4 h-4" />
              {language === "pt" ? "Abrir Custeio & Ficha Técnica" : "Open Costing Workspace"} →
            </button>
          </div>

          {false && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-50 pb-4 gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  <ChefHat className="w-4 h-4 text-violet-500" /> 
                  {language === "pt" ? "Planejamento Financeiro e Ficha Técnica" : "Financial Costing & Recipe Sheet"}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {language === "pt" 
                    ? "Gerencie despesas, custos de insumos e gere fichas de produção automaticamente"
                    : "Manage expenses, production overheads, and build ingredient breakdown sheets"}
                </p>
              </div>

              {/* Real-time saving status indicators */}
              <div className="flex items-center gap-1.5 self-start sm:self-center text-[10px] font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {language === "pt" ? "Salvo em Nuvem" : "Cloud Synchronized"}
              </div>
            </div>

            {/* Switch buttons (Tabs) */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100/70 p-1.5 rounded-xl border border-slate-200/30">
              <button
                type="button"
                onClick={() => setCostingTab("fixed")}
                className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                  costingTab === "fixed"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/50"
                    : "text-slate-500 hover:bg-white/30 hover:text-slate-800 cursor-pointer"
                }`}
              >
                {language === "pt" ? "Despesas Fixas" : "Fixed Expenses"}
              </button>
              <button
                type="button"
                onClick={() => setCostingTab("production")}
                className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                  costingTab === "production"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/50"
                    : "text-slate-500 hover:bg-white/30 hover:text-slate-800 cursor-pointer"
                }`}
              >
                {language === "pt" ? "Custos de Produção" : "Production Costs"}
              </button>
              <button
                type="button"
                onClick={() => setCostingTab("recipe")}
                className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                  costingTab === "recipe"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/50"
                    : "text-slate-500 hover:bg-white/30 hover:text-slate-800 cursor-pointer"
                }`}
              >
                {language === "pt" ? "Ficha Técnica" : "Recipe Sheet"}
              </button>
            </div>

            {isCostingLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs text-center space-y-2">
                <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                <p>{language === "pt" ? "Sincronizando custeios..." : "Fetching costing database..."}</p>
              </div>
            ) : (
              <div className="animate-fade-in-up">
                {/* 1. FIXED EXPENSES TAB */}
                {costingTab === "fixed" && (
                  <div className="space-y-4">
                    <p className="text-[11px] text-slate-500 leading-relaxed italic bg-violet-50/50 border border-violet-100/50 p-2.5 rounded-lg text-center sm:text-left">
                      💡 {language === "pt" 
                        ? "Insira custos fixos mensais de sua operação (aluguel, internet, pessoal) para amortizar na ficha técnica." 
                        : "Define monthly operating overhead costs here. These will feed into your standard unit recipe margins."}
                    </p>

                    {/* Table */}
                    <div className="overflow-x-auto border border-slate-100 rounded-xl bg-slate-50/30">
                      <table className="w-full text-left border-collapse min-w-[340px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <th className="p-3 font-semibold">{language === "pt" ? "Nome da Despesa" : "Expense Name"}</th>
                            <th className="p-3 font-semibold">{language === "pt" ? "Mês/Referência" : "Month/Ref"}</th>
                            <th className="p-3 font-semibold text-right">{language === "pt" ? "Valor de Custeio" : "Costing Value"}</th>
                            <th className="p-3 font-semibold text-center w-12">{language === "pt" ? "Ações" : "Action"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fixedExpenses.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-6 text-center text-xs text-slate-400 font-medium italic">
                                {language === "pt" ? "Nenhuma despesa fixa adicionada para este produto." : "No fixed expenses added yet."}
                              </td>
                            </tr>
                          ) : (
                            fixedExpenses.map((itm) => (
                              <tr key={itm.id} className="border-b border-slate-100/75 hover:bg-slate-50/50 text-xs text-slate-700 transition-colors">
                                <td className="p-3 font-semibold text-slate-800">{itm.name}</td>
                                <td className="p-3 text-slate-505">{itm.month}</td>
                                <td className="p-3 text-right font-mono font-bold text-slate-850">
                                  {formatCurrency(itm.value)}
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFixedExpense(itm.id)}
                                    className="p-1 px-1.5 bg-rose-50 text-rose-500 rounded-md hover:bg-rose-100 hover:text-rose-700 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                          {/* SUM ROW */}
                          {fixedExpenses.length > 0 && (
                            <tr className="bg-slate-100/50 font-bold border-t border-slate-200">
                              <td colSpan={2} className="p-3 text-xs text-slate-700 uppercase tracking-wide">
                                {language === "pt" ? "Soma Total das Despesas" : "Total Fixed Expenses Sum"}
                              </td>
                              <td className="p-3 text-right font-mono text-xs text-slate-950 font-black">
                                {formatCurrency(totalFixedExpensesSum)}
                              </td>
                              <td></td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Add form */}
                    <div className="bg-slate-50/75 p-3 rounded-xl border border-slate-100 space-y-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {language === "pt" ? "Adicionar Lançamento de Custo" : "Add Expense Record"}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* Name Input */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">
                            {language === "pt" ? "Nome do Custo" : "Expense Name"}
                          </label>
                          <input
                            type="text"
                            placeholder={language === "pt" ? "Aluguel, Equipe, etc." : "e.g. Rent, Gas tank"}
                            value={fixedExpenseName}
                            onChange={(e) => setFixedExpenseName(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-800 text-xs rounded-lg block w-full p-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-hidden"
                          />
                        </div>
                        {/* Month Input */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">
                            {language === "pt" ? "Mês Referência" : "Reference Month"}
                          </label>
                          <select
                            value={fixedExpenseMonth}
                            onChange={(e) => setFixedExpenseMonth(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-800 text-xs rounded-lg block w-full p-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-hidden cursor-pointer"
                          >
                            {(language === "pt" 
                              ? ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
                              : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
                            ).map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                        {/* Value Input */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">
                            {language === "pt" ? "Valor" : "Value"}
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none text-xs font-semibold">
                              {getGlobalCurrency() === "BRL" ? "R$" : getGlobalCurrency() === "EUR" ? "€" : "$"}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={fixedExpenseValue}
                              onChange={(e) => setFixedExpenseValue(e.target.value)}
                              className="bg-white border border-slate-200 text-slate-900 text-xs rounded-lg block w-full pl-8 p-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-hidden font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddFixedExpense}
                        disabled={!fixedExpenseName.trim() || !fixedExpenseValue}
                        className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed hover:shadow-xs text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {language === "pt" ? "Adicionar à Tabela" : "Add Record"}
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. PRODUCTION COSTS TAB */}
                {costingTab === "production" && (
                  <div className="space-y-4">
                    <p className="text-[11px] text-slate-500 leading-relaxed italic bg-emerald-50/50 border border-emerald-100/50 p-2.5 rounded-lg text-center sm:text-left">
                      💡 {language === "pt" 
                        ? "Insira os custos diretos de serviços públicos consumidos no seu preparo." 
                        : "Enter utilities or operational service parameters below to compute preparation direct values."}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Water */}
                      <div className="space-y-1 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                          <Droplet className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          {language === "pt" ? "Custos de Água" : "Water Cost"}
                        </label>
                        <div className="relative mt-1.5">
                          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none text-xs font-bold leading-none">
                            {getGlobalCurrency() === "BRL" ? "R$" : getGlobalCurrency() === "EUR" ? "€" : "$"}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={productionCosts.water || ""}
                            placeholder="0.00"
                            onChange={(e) => handleUpdateProductionCost("water", e.target.value)}
                            className="bg-white border border-slate-200 text-slate-900 text-xs rounded-lg block w-full pl-8 p-2.5 focus:ring-violet-500 focus:outline-hidden font-mono font-bold"
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 block mt-1">
                          {language === "pt" ? "Valor estimado consumido" : "Allocated production consumption"}
                        </span>
                      </div>

                      {/* Electricity */}
                      <div className="space-y-1 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          {language === "pt" ? "Custos de Energia" : "Electricity Cost"}
                        </label>
                        <div className="relative mt-1.5">
                          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none text-xs font-bold leading-none">
                            {getGlobalCurrency() === "BRL" ? "R$" : getGlobalCurrency() === "EUR" ? "€" : "$"}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={productionCosts.electricity || ""}
                            placeholder="0.00"
                            onChange={(e) => handleUpdateProductionCost("electricity", e.target.value)}
                            className="bg-white border border-slate-200 text-slate-900 text-xs rounded-lg block w-full pl-8 p-2.5 focus:ring-violet-500 focus:outline-hidden font-mono font-bold"
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 block mt-1">
                          {language === "pt" ? "Energia elétrica consumida" : "Apportioned operational electricity"}
                        </span>
                      </div>

                      {/* Gas */}
                      <div className="space-y-1 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          {language === "pt" ? "Custos de Gás" : "Gas Cost"}
                        </label>
                        <div className="relative mt-1.5">
                          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none text-xs font-bold leading-none">
                            {getGlobalCurrency() === "BRL" ? "R$" : getGlobalCurrency() === "EUR" ? "€" : "$"}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={productionCosts.gas || ""}
                            placeholder="0.00"
                            onChange={(e) => handleUpdateProductionCost("gas", e.target.value)}
                            className="bg-white border border-slate-200 text-slate-900 text-xs rounded-lg block w-full pl-8 p-2.5 focus:ring-violet-500 focus:outline-hidden font-mono font-bold"
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 block mt-1">
                          {language === "pt" ? "Gás Glp utilizado" : "Baking/boiler cylinder proportion"}
                        </span>
                      </div>

                      {/* Electricity 2 */}
                      <div className="space-y-1 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                          {language === "pt" ? "Energia de Produção Extra" : "Extra Electricity Cost"}
                        </label>
                        <div className="relative mt-1.5">
                          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none text-xs font-bold leading-none">
                            {getGlobalCurrency() === "BRL" ? "R$" : getGlobalCurrency() === "EUR" ? "€" : "$"}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={productionCosts.electricity2 || ""}
                            placeholder="0.00"
                            onChange={(e) => handleUpdateProductionCost("electricity2", e.target.value)}
                            className="bg-white border border-slate-200 text-slate-900 text-xs rounded-lg block w-full pl-8 p-2.5 focus:ring-violet-500 focus:outline-hidden font-mono font-bold"
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 block mt-1">
                          {language === "pt" ? "Custos adicionais de energia" : "Complimentary/Auxiliary electricity cost"}
                        </span>
                      </div>
                    </div>

                    {/* Cost Summary Box */}
                    <div className="bg-slate-900 text-white rounded-xl p-4.5 border border-slate-800 flex items-center justify-between shadow-2xs">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{language === "pt" ? "SOMA DE CUSTOS DE PRODUÇÃO" : "TOTAL COMPILATION"}</p>
                        <p className="text-[11px] text-slate-300 mt-0.5">{language === "pt" ? "Consumos de água, gás e energia agregados" : "Aggregated direct utilities expenditures"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-mono font-black text-emerald-400">{formatCurrency(totalProductionCostsSum)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. RECIPE SHEET TAB */}
                {costingTab === "recipe" && (
                  <div className="space-y-5">
                    {/* Intro */}
                    <div className="bg-violet-50/40 border border-violet-100 p-3 rounded-xl flex items-start gap-2.5">
                      <ChefHat className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-violet-950 uppercase tracking-wide">
                          {language === "pt" ? `Ficha Técnica para ${productName}` : `Recipe Cost Analysis: ${productName}`}
                        </h4>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {language === "pt"
                            ? "Monte receitas combinando frações de outros insumos de sua despensa. O app calculará a despesa exata por porção, os overheads amortizados e sugerirá o preço ideal de venda!"
                            : "Compile standard preparation sheets with real tracked products. We compute exact unit costs, overhead ratios, and markups in real-time."}
                        </p>
                      </div>
                    </div>

                    {/* Parameters Row (Yield & Markup) */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          🥞 {language === "pt" ? "Rendimento (Porções/Unidades)" : "Yield (Portions/Units)"}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={recipePortions}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setRecipePortions(val);
                            saveCostingToFirestore({ recipePortions: val });
                          }}
                          className="bg-white border border-slate-200 text-slate-900 text-xs rounded-lg block w-full p-2 mt-1.5 focus:ring-violet-500 focus:outline-hidden font-bold"
                        />
                        <span className="text-[9px] text-slate-450 block mt-1">
                          {language === "pt" ? "Divide o custo total em porções" : "Spreads final cost amongst portions"}
                        </span>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          📈 {language === "pt" ? "Multiplicador de Markup" : "Markup Multiplier"}
                        </label>
                        <div className="flex items-center gap-2 mt-1.5">
                          <input
                            type="range"
                            min="1.0"
                            max="5.0"
                            step="0.1"
                            value={recipeMarkup}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 2.0;
                              setRecipeMarkup(val);
                              saveCostingToFirestore({ recipeMarkup: val });
                            }}
                            className="accent-violet-500 h-1.5 flex-1 bg-slate-200 rounded-lg cursor-pointer"
                          />
                          <span className="font-mono text-xs font-black bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs text-slate-900 shrink-0">
                            {recipeMarkup.toFixed(1)}x
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-450 block mt-1">
                          {language === "pt" ? "Fator multiplicador do preço sugerido (ex. 2.0x, 3.0x)" : "Target gross multiplier for suggested retail pricing"}
                        </span>
                      </div>
                    </div>

                    {/* Add Ingredient Form */}
                    <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl space-y-3">
                      <p className="text-[10px] font-black text-slate-550 uppercase tracking-wider flex items-center gap-1.2">
                        <PlusCircle className="w-3.5 h-3.5 text-violet-500" />
                        {language === "pt" ? "Adicionar Insumo/Ingrediente" : "Add Recipe Ingredient"}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Selected Grocery Item */}
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">
                            {language === "pt" ? "Item da Despensa (Sincronizado de Compras)" : "Pantry Item (Synced from scan entries)"}
                          </label>
                          <select
                            value={selectedIngredientProduct}
                            onChange={(e) => setSelectedIngredientProduct(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-800 text-xs rounded-lg block w-full p-2 focus:ring-violet-500 focus:outline-hidden cursor-pointer"
                          >
                            <option value="">-- {language === "pt" ? "Selecione o Insumo" : "Select pantry item"} --</option>
                            <optgroup label={language === "pt" ? "Últimas Compras Identificadas" : "Recent Grocery Purchases"}>
                              {uniqueGroceryItemsList.map((g) => (
                                <option key={g.name} value={g.name}>
                                  {g.name} (último: {formatCurrency(Number(g.latestItem.price))})
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label={language === "pt" ? "Outras opções" : "Others"}>
                              <option value="custom">{language === "pt" ? "✍️ Digitar Item Personalizado" : "✍️ Custom Ingredient (Manual value)"}</option>
                            </optgroup>
                          </select>
                        </div>

                        {/* Custom Name (only if custom chosen) */}
                        {selectedIngredientProduct === "custom" && (
                          <div className="space-y-1 sm:col-span-2 animate-fade-in-up">
                            <label className="text-[9px] font-bold text-slate-500 uppercase">
                              {language === "pt" ? "Nome do Insumo Personalizado" : "Custom Ingredient Name"}
                            </label>
                            <input
                              type="text"
                              placeholder={language === "pt" ? "Açúcar de confeiteiro, Corante, etc." : "e.g. Vanilla extract, sprinkles"}
                              value={customIngredientName}
                              onChange={(e) => setCustomIngredientName(e.target.value)}
                              className="bg-white border border-slate-200 text-slate-900 text-xs rounded-lg block w-full p-2.5 focus:ring-violet-500 focus:outline-hidden"
                            />
                          </div>
                        )}

                        {/* Quantity */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">
                            {language === "pt" ? "Quantidade Necessária" : "Ingredients Quantity"}
                          </label>
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              step="any"
                              placeholder="0"
                              value={ingredientQtyInput}
                              onChange={(e) => setIngredientQtyInput(e.target.value)}
                              className="bg-white border border-slate-200 text-slate-900 text-xs rounded-lg block w-full p-2 focus:ring-violet-500 focus:outline-hidden font-mono"
                            />
                            <select
                              value={ingredientUnitInput}
                              onChange={(e) => setIngredientUnitInput(e.target.value)}
                              className="bg-white border border-slate-200 text-slate-800 text-xs rounded-lg p-2 focus:ring-violet-500 focus:outline-hidden px-3 cursor-pointer"
                            >
                              <option value="g">g</option>
                              <option value="kg">kg</option>
                              <option value="ml">ml</option>
                              <option value="l">L</option>
                              <option value="unit">{language === "pt" ? "unidade" : "units"}</option>
                            </select>
                          </div>
                        </div>

                        {/* Cost per unit of ingredient */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">
                            {language === "pt" ? `Custo Estimado por ${ingredientUnitInput}` : `Estimated cost per ${ingredientUnitInput}`}
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none text-xs font-semibold">
                              {getGlobalCurrency() === "BRL" ? "R$" : getGlobalCurrency() === "EUR" ? "€" : "$"}
                            </span>
                            <input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              value={ingredientPriceInput}
                              onChange={(e) => setIngredientPriceInput(e.target.value)}
                              className="bg-white border border-slate-200 text-slate-900 text-xs rounded-lg block w-full pl-8 p-2 focus:ring-violet-500 focus:outline-hidden font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddIngredient}
                        disabled={
                          !ingredientQtyInput || 
                          !ingredientPriceInput || 
                          (!selectedIngredientProduct) ||
                          (selectedIngredientProduct === "custom" && !customIngredientName.trim())
                        }
                        className="w-full bg-violet-600 hover:bg-violet-750 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {language === "pt" ? "Adicionar Insumo" : "Add Ingredient"}
                      </button>
                    </div>

                    {/* Ingredients Table */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                        {language === "pt" ? "Matérias-Primas e Insumos adicionados" : "Ingredient cost allocations"}
                      </p>
                      
                      <div className="overflow-x-auto border border-slate-100 rounded-xl bg-slate-50/20">
                        <table className="w-full text-left border-collapse min-w-[340px]">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <th className="p-3 font-semibold">{language === "pt" ? "Ingrediente" : "Ingredient"}</th>
                              <th className="p-3 font-semibold text-center">{language === "pt" ? "Qtd Utilizada" : "Usage Qty"}</th>
                              <th className="p-3 font-semibold text-right">{language === "pt" ? "Preço / Unid" : "Rate"}</th>
                              <th className="p-3 font-semibold text-right">{language === "pt" ? "Subtotal" : "Subtotal"}</th>
                              <th className="p-3 text-center w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {recipeIngredients.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-6 text-center text-xs text-slate-400 font-medium italic">
                                  {language === "pt" ? "Nenhum ingrediente somado à receita ainda." : "No recipe ingredients added."}
                                </td>
                              </tr>
                            ) : (
                              recipeIngredients.map((ing) => {
                                const subtotal = (Number(ing.quantity) || 0) * (Number(ing.price) || 0);
                                return (
                                  <tr key={ing.id} className="border-b border-slate-100/75 hover:bg-slate-50/50 text-xs text-slate-700 transition-colors">
                                    <td className="p-3 font-semibold text-slate-800">{ing.name}</td>
                                    <td className="p-3 text-center font-semibold font-mono text-slate-650">
                                      {ing.quantity} {ing.unit}
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-500">
                                      {formatCurrency(ing.price)}
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                                      {formatCurrency(subtotal)}
                                    </td>
                                    <td className="p-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteIngredient(ing.id)}
                                        className="p-1 px-1.5 bg-rose-50 text-rose-500 rounded-md hover:bg-rose-100 transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                            {recipeIngredients.length > 0 && (
                              <tr className="bg-slate-100 font-bold border-t border-slate-200">
                                <td colSpan={3} className="p-3 text-xs text-slate-700 uppercase tracking-wider">
                                  {language === "pt" ? "Soma de Insumos Diretos" : "Total Raw Ingredients"}
                                </td>
                                <td className="p-3 text-right font-mono text-xs text-slate-950 font-black">
                                  {formatCurrency(ingredientsCostSum)}
                                </td>
                                <td></td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Master Financial Summary Card */}
                    <div className="bg-slate-950 text-white rounded-2xl p-5 border border-slate-900 space-y-4 shadow-sm">
                      <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300">
                          {language === "pt" ? "DEMONSTRATIVO DE PRECIFICAÇÃO" : "PRODUCT PRICING SUMMARY REPORT"}
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Cost allocations */}
                        <div className="space-y-2 border-b sm:border-b-0 sm:border-r border-slate-800 pb-3 sm:pb-0 sm:pr-4 text-xs">
                          <p className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">
                            {language === "pt" ? "Origem de Custos (Total / Porção)" : "Cost Drivers (Total / Portion)"}
                          </p>
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-slate-300">
                              <span>🍎 {language === "pt" ? "Ingredientes" : "Matter Cost"}</span>
                              <span className="font-mono">{formatCurrency(finalCostPerPortion.ingredients)}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-300">
                              <span>⚡ {language === "pt" ? "Produtividade (Água/Gás/Energia)" : "Utility Overhead"}</span>
                              <span className="font-mono text-amber-300">+{formatCurrency(finalCostPerPortion.production)}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-300">
                              <span>🏢 {language === "pt" ? "Despesas Fixas" : "Fixed Expense"}</span>
                              <span className="font-mono text-slate-300">+{formatCurrency(finalCostPerPortion.fixed)}</span>
                            </div>
                            <div className="border-t border-slate-800 pt-1.5 flex justify-between items-center font-bold text-emerald-300">
                              <span>💰 {language === "pt" ? "Custo por Rendimento (Unitário)" : "Total Unit Cost"}</span>
                              <span className="font-mono font-black text-xs">{formatCurrency(finalCostPerPortion.total)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Sale Price block */}
                        <div className="flex flex-col justify-center space-y-3 pl-0 sm:pl-2">
                          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-center">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                              {language === "pt" ? "Sugerido com Markup" : `Suggested Sale Price (${recipeMarkup.toFixed(1)}x)`}
                            </p>
                            <p className="text-xl font-black font-mono text-emerald-400 mt-1">
                              {formatCurrency(suggestedSellingPrice)}
                            </p>
                          </div>

                          <div className="flex items-start gap-1.5 text-[9.5px] text-slate-450 leading-normal italic px-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>
                              {language === "pt"
                                ? `Preço de venda estimado cobrindo ${recipeMarkup.toFixed(1)}x custos operacionais e insumos diretos.`
                                : `Target sales covers raw supplies with an adjusted ${recipeMarkup.toFixed(1)}x security profit buffer.`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Subcomponent: SVG Barcode Renderer
function SVGBarcode({ code }: { code: string }) {
  // Simple generator for deterministic barcode patterns
  const bars: { width: number; spacing: number }[] = [];
  let seed = 0;
  for (let i = 0; i < code.length; i++) {
    seed += code.charCodeAt(i);
  }
  
  for (let i = 0; i < 46; i++) {
    const w = ((seed + i * 17) % 3) + 1; // 1, 2, or 3px wide
    const s = ((seed + i * 13) % 3) + 1; // 1, 2, or 3px space
    bars.push({ width: w, spacing: s });
  }

  return (
    <div className="flex flex-col items-center bg-white p-4 rounded-xl border border-slate-100 shadow-3xs max-w-sm">
      <svg width="220" height="75" className="text-slate-900 bg-white" viewBox="0 0 220 75">
        <g fill="currentColor">
          {/* Edge guard bars */}
          <rect x="10" y="5" width="2" height="62" />
          <rect x="14" y="5" width="2" height="62" />
          
          {/* Dynamic computed bars */}
          {bars.map((bar, idx) => {
            let xPos = 20;
            for (let j = 0; j < idx; j++) {
              xPos += bars[j].width + bars[j].spacing;
            }
            if (xPos > 195) return null;
            
            // Center separator guard bars
            if (idx === 22) {
              return (
                <g key={idx}>
                  <rect x={xPos} y="5" width="1.5" height="62" fill="#ef4444" />
                  <rect x={xPos + 3.5} y="5" width="1.5" height="62" fill="#ef4444" />
                </g>
              );
            }
            
            return (
              <rect 
                key={idx} 
                x={xPos} 
                y="5" 
                width={bar.width} 
                height="54" 
              />
            );
          })}
          
          {/* Edge guard bars */}
          <rect x="202" y="5" width="2" height="62" />
          <rect x="206" y="5" width="2" height="62" />
        </g>
      </svg>
      {/* Code Text below */}
      <div className="font-mono text-xs tracking-widest text-slate-800 mt-1.5 font-bold uppercase select-all">
        {code.substring(0, 1)} {code.substring(1, 7)} {code.substring(7)}
      </div>
    </div>
  );
}
