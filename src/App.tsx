import { useState, useEffect, useMemo, useRef } from "react";
import { 
  FileSpreadsheet, 
  Receipt, 
  HelpCircle, 
  TrendingUp, 
  Store, 
  Tag, 
  ShoppingCart, 
  AlertCircle,
  RefreshCw,
  Database,
  Settings,
  Home,
  ArrowUp,
  ChefHat,
  Coins,
  Zap,
  LineChart,
  Calendar,
  Camera,
  Image as ImageIcon
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch, deleteField } from "firebase/firestore";
import ReceiptScanner from "./components/ReceiptScanner";
import SpreadsheetTable from "./components/SpreadsheetTable";
import CategoryManager from "./components/CategoryManager";
import ProductDetailsScreen from "./components/ProductDetailsScreen";
import SpendingBreakdown from "./components/SpendingBreakdown";
import SettingsScreen from "./components/SettingsScreen";
import UniqueItemsScreen from "./components/UniqueItemsScreen";
import UniqueInvoicesScreen from "./components/UniqueInvoicesScreen";
import PriceVariationsScreen from "./components/PriceVariationsScreen";
import FixedExpensesScreen from "./components/FixedExpensesScreen";
import ProductionCostsScreen from "./components/ProductionCostsScreen";
import RecipeCostingSheetsScreen from "./components/RecipeCostingSheetsScreen";
import InventoryBento from "./components/InventoryBento";
import RevenueScreen from "./components/RevenueScreen";
import StagingReviewScreen from "./components/StagingReviewScreen";
import OrdersBento from "./components/OrdersBento";
import IntegrationsScreen from "./components/IntegrationsScreen";
import OrdersDetailScreen from "./components/OrdersDetailScreen";
import { ReceiptItem, ScannedReceiptResult } from "./types";
import { generateId, cleanDate, DEMO_RECEIPT_ITEMS, formatCurrency, setGlobalCurrency, resolveItemCategory, safeStorage } from "./utils";
import { translations } from "./translations";

export function KitchenLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={`${className} fill-current`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer C/e shape */}
      <path 
        d="M 75,25 A 35,35 0 1,0 75,75" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="11" 
        strokeLinecap="round" 
      />
      {/* Fork handle */}
      <path 
        d="M 22,50 H 52" 
        stroke="currentColor" 
        strokeWidth="9" 
        strokeLinecap="round" 
      />
      {/* Fork base block */}
      <path 
        d="M 52,43 H 55 V 57 H 52 Z" 
        fill="currentColor" 
      />
      {/* Fork tines */}
      <path 
        d="M 55,43 H 74 M 55,47.5 H 74 M 55,52.5 H 74 M 55,57 H 74" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
      />
    </svg>
  );
}

export default function App() {
  // State for recording and presenting duplicate scanned invoices preventing double claim entry
  const [duplicateScanError, setDuplicateScanError] = useState<{
    invoiceNumber: string;
    storeName: string;
    purchaseDate: string;
    totalAmount: number;
    pendingResult: ScannedReceiptResult;
  } | null>(null);

  // Global, real-time shared state from Firestore
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const scannerRef = useRef<{ triggerChooseFile: () => void; triggerTakePhoto: () => void }>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<Record<string, string>>({});
  const [itemCategoryRules, setItemCategoryRules] = useState<Record<string, string>>({});
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [newlyAddedCategories, setNewlyAddedCategories] = useState<string[]>([]);
  const [stagedItems, setStagedItems] = useState<ReceiptItem[]>([]);

  // 1. Listen for Items
  useEffect(() => {
    const itemsCollection = collection(db, "items");
    const unsubscribe = onSnapshot(itemsCollection, (snapshot) => {
      const dbItems: ReceiptItem[] = [];
      snapshot.forEach((doc) => {
        dbItems.push(doc.data() as ReceiptItem);
      });
      // Sort: purchase date descending (newest first), stable formatting
      dbItems.sort((a, b) => {
        const timeA = new Date(a.purchaseDate).getTime() || 0;
        const timeB = new Date(b.purchaseDate).getTime() || 0;
        if (timeB !== timeA) return timeB - timeA;
        return (a.id || "").localeCompare(b.id || "");
      });
      setItems(dbItems);
      setIsDbLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "items");
    });
    return () => unsubscribe();
  }, []);

  // 2. Listen for Categories Config document
  useEffect(() => {
    const docRef = doc(db, "configs", "categories");
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      const defaults = [
        "Produce",
        "Bakery",
        "Dairy",
        "Ingredients",
        "Fruits",
        "Snacks",
        "Personal Care",
        "Bebidas",
        "Consumo",
        "Equipamentos",
        "Limpeza",
        "Embalagem",
        "Other"
      ];
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && Array.isArray(data.list)) {
          // Actively exclude: Beverages, Frozen, Household, Meat, Pantry (unless they are explicitly requested Portuguese names)
          const filteredList = data.list.filter(cat => {
            const low = cat.toLowerCase().trim();
            return !(
              low.includes("beverage") ||
              low.includes("frozen") ||
              low.includes("household") ||
              low.includes("meat") ||
              low.includes("pantry")
            );
          });

          // Ensure the user-requested Portuguese categories are in the list
          const requestedCats = ["Bebidas", "Consumo", "Equipamentos", "Limpeza", "Embalagem"];
          const missingCats = requestedCats.filter(
            rc => !filteredList.some(fc => fc.trim().toLowerCase() === rc.toLowerCase())
          );

          if (missingCats.length > 0) {
            const updatedList = [...filteredList, ...missingCats];
            setDoc(docRef, { list: updatedList, mappings: data.mappings || {} }, { merge: true })
              .catch(err => console.error("Error updating user requested categories:", err));
          } else {
            setCategoryMappings(data.mappings || {});
            setCategories(filteredList.length > 0 ? filteredList : defaults);
          }
        }
      } else {
        setDoc(docRef, { list: defaults })
          .catch((err) => handleFirestoreError(err, OperationType.WRITE, "configs/categories"));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "configs/categories");
    });
    return () => unsubscribe();
  }, []);

  // 3. Listen for Rules Config document
  useEffect(() => {
    const docRef = doc(db, "configs", "rules");
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && data.mapping) {
          setItemCategoryRules(data.mapping);
        }
      } else {
        setDoc(docRef, { mapping: {} })
          .catch((err) => handleFirestoreError(err, OperationType.WRITE, "configs/rules"));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "configs/rules");
    });
    return () => unsubscribe();
  }, []);

  // 4. Clean up / Prune categories with no items (and not newly added in current session)
  useEffect(() => {
    if (isDbLoading || items.length === 0 || categories.length === 0) return;

    // Normalized list of categories currently used by items
    const usedCategories = new Set(
      items.map((item) => (item.category || "").trim().toLowerCase()).filter(Boolean)
    );

    // Filter categories to only keep those that have at least one item,
    // or were newly added in this session, or are our exempt categories.
    const categoriesToKeep = categories.filter((cat) => {
      const lowerCat = cat.trim().toLowerCase();
      const isExempt = [
        "bebidas", "consumo", "equipamentos", "limpeza", "embalagem",
        "produce", "bakery", "dairy", "ingredients", "fruits", "snacks", "personal care", "other"
      ].includes(lowerCat);
      const hasItems = usedCategories.has(lowerCat);
      const isNewlyAdded = newlyAddedCategories.some(
        (n) => n.trim().toLowerCase() === lowerCat
      );
      return hasItems || isNewlyAdded || isExempt;
    });

    // If there is any difference, save the filtered list back to Firestore
    if (categoriesToKeep.length !== categories.length) {
      const docRef = doc(db, "configs", "categories");
      setDoc(docRef, { list: categoriesToKeep, mappings: categoryMappings }, { merge: true })
        .catch((err) => console.error("Error pruning unused categories:", err));
    }
  }, [items, categories, isDbLoading, categoryMappings, newlyAddedCategories]);

  // Filter out any categories that have no items registered (unless they were newly added in current session or are exempt)
  const activeCategories = useMemo(() => {
    if (items.length === 0) {
      return categories;
    }
    const usedCategories = new Set(
      items.map((item) => (item.category || "").trim().toLowerCase()).filter(Boolean)
    );
    return categories.filter((cat) => {
      const lowerCat = cat.trim().toLowerCase();
      const isExempt = [
        "bebidas", "consumo", "equipamentos", "limpeza", "embalagem",
        "produce", "bakery", "dairy", "ingredients", "fruits", "snacks", "personal care", "other"
      ].includes(lowerCat);
      const hasItems = usedCategories.has(lowerCat);
      const isNewlyAdded = newlyAddedCategories.some(
        (n) => n.trim().toLowerCase() === lowerCat
      );
      return hasItems || isNewlyAdded || isExempt;
    });
  }, [categories, items, newlyAddedCategories]);

  // Track the active screen/tab: any of the spreadsheet, configuration, metrics, or financial tools
  const [currentTab, setCurrentTab] = useState<'scan' | 'spreadsheet' | 'categories' | 'breakdown' | 'settings' | 'uniqueItems' | 'priceVariations' | 'uniqueInvoices' | 'fixed-expenses' | 'production-costs' | 'recipe-costing-sheets' | 'revenue' | 'staged-review' | 'integrations' | 'orders-detail'>('scan');
  const [selectedIntegrationChannel, setSelectedIntegrationChannel] = useState<string | undefined>(undefined);
  const [selectedOrderDetailChannel, setSelectedOrderDetailChannel] = useState<string>("all");
  const [initialRevenueSubTab, setInitialRevenueSubTab] = useState<'store-config' | 'daily' | 'summary'>('summary');
  const [activeCostingTab, setActiveCostingTab] = useState<'fixed' | 'production' | 'recipe'>('fixed');

  // Load and manage custom preferences
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (safeStorage.getItem("grocery_theme") as 'light' | 'dark') || 'light';
    } catch {
      return 'light';
    }
  });
  const [currency, setCurrency] = useState<'USD' | 'BRL' | 'EUR'>(() => {
    try {
      const val = safeStorage.getItem("grocery_currency");
      return (val === "USD" || val === "BRL" || val === "EUR") ? val : "USD";
    } catch {
      return 'USD';
    }
  });
  const [language, setLanguage] = useState<'en' | 'pt'>(() => {
    try {
      const val = safeStorage.getItem("grocery_language");
      return (val === "en" || val === "pt") ? val : "en";
    } catch {
      return 'en';
    }
  });

  // Track product item name to display custom detail screen page analyzed
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<string | null>(null);

  // Synchronise preferences with localStorage
  useEffect(() => {
    try {
      safeStorage.setItem("grocery_theme", theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    try {
      safeStorage.setItem("grocery_currency", currency);
    } catch {}
    setGlobalCurrency(currency);
  }, [currency]);

  useEffect(() => {
    try {
      safeStorage.setItem("grocery_language", language);
    } catch {}
  }, [language]);

  // Support custom tab switches from scanned queue
  useEffect(() => {
    const handleTabSwitch = (e: Event) => {
      const targetTab = (e as CustomEvent<string>).detail;
      if (['scan', 'spreadsheet', 'categories', 'breakdown', 'settings', 'uniqueItems', 'staged-review'].includes(targetTab)) {
        setCurrentTab(targetTab as any);
      }
    };
    window.addEventListener("tab-switch", handleTabSwitch);
    return () => window.removeEventListener("tab-switch", handleTabSwitch);
  }, []);

  // Load translation dictionary
  const t = useMemo(() => {
    return translations[language];
  }, [language]);

  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "info" | "error";
    detailStats?: {
      itemsQty: number;
      uniqueCount: number;
      invoicesCount: number;
    };
  } | null>(null);

  // Category CRUD Handlers
  const handleAddCategory = async (newCat: string) => {
    setNotification({
      message: language === "pt"
        ? "Não é permitido criar outras categorias de acordo com as regras de exclusão."
        : "Creating other categories is disabled per exclusion rules.",
      type: "error"
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDeleteCategory = async (catToDelete: string) => {
    if (categories.length <= 1) {
      setNotification({
        message: "Cannot delete the only remaining category. You must keep at least one category.",
        type: "error"
      });
      setTimeout(() => setNotification(null), 4000);
      return;
    }

    const linkedItems = items.filter(
      (item) => (item.category || "").trim().toLowerCase() === catToDelete.trim().toLowerCase()
    );
    if (linkedItems.length > 0) {
      setNotification({
        message: language === "pt"
          ? `Não é possível excluir a categoria "${catToDelete}" porque existem itens registrados nela.`
          : `Cannot delete category "${catToDelete}" because there are items registered in it.`,
        type: "error"
      });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    const fallback = categories.find(cat => cat !== catToDelete) || "Other";

    const batch = writeBatch(db);

    // 1. Update categories list
    const categoriesDocRef = doc(db, "configs", "categories");
    batch.set(categoriesDocRef, { list: categories.filter(cat => cat !== catToDelete) });

    // 2. Update linked items in Firestore
    linkedItems.forEach(item => {
      const itemRef = doc(db, "items", item.id);
      batch.update(itemRef, { category: fallback });
    });

    // 3. Update rules matching this category
    const updatedRules = { ...itemCategoryRules };
    let rulesChanged = false;
    Object.entries(updatedRules).forEach(([name, cat]) => {
      if (cat === catToDelete) {
        updatedRules[name] = fallback;
        rulesChanged = true;
      }
    });

    if (rulesChanged) {
      const rulesDocRef = doc(db, "configs", "rules");
      batch.set(rulesDocRef, { mapping: updatedRules });
    }

    try {
      await batch.commit();
      setNotification({
        message: `Category "${catToDelete}" deleted. ${linkedItems.length} item(s) re-assigned to "${fallback}".`,
        type: "info"
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "batch_category_delete");
    }
  };

  const handleUpdateCategory = async (oldName: string, newName: string) => {
    const cleanedNewName = newName.trim();
    if (!cleanedNewName || oldName === cleanedNewName) return;

    const linkedItems = items.filter(item => item.category === oldName);
    const batch = writeBatch(db);

    // 1. Update categories list & mappings
    const updatedMappings = { ...categoryMappings };
    let found = false;
    Object.keys(updatedMappings).forEach(key => {
      if (updatedMappings[key] === oldName) {
        updatedMappings[key] = cleanedNewName;
        found = true;
      }
    });
    
    const originalCategories = [
      "Produto", "Produce", "Bakery", "Dairy", "Ingredients", "Fruits", "Snacks", 
      "Personal Care", "Other"
    ];
    if (!found && originalCategories.includes(oldName)) {
      updatedMappings[oldName] = cleanedNewName;
    }

    const categoriesDocRef = doc(db, "configs", "categories");
    batch.set(categoriesDocRef, { 
      list: categories.map(cat => cat === oldName ? cleanedNewName : cat),
      mappings: updatedMappings
    });

    // 2. Update linked items
    linkedItems.forEach(item => {
      const itemRef = doc(db, "items", item.id);
      batch.update(itemRef, { category: cleanedNewName });
    });

    // 3. Update memory rules
    const updatedRules = { ...itemCategoryRules };
    let rulesChanged = false;
    Object.entries(updatedRules).forEach(([name, cat]) => {
      if (cat === oldName) {
        updatedRules[name] = cleanedNewName;
        rulesChanged = true;
      }
    });

    if (rulesChanged) {
      const rulesDocRef = doc(db, "configs", "rules");
      batch.set(rulesDocRef, { mapping: updatedRules });
    }

    try {
      await batch.commit();
      setNotification({
        message: `Category "${oldName}" successfully renamed to "${cleanedNewName}".`,
        type: "success"
      });
      setTimeout(() => setNotification(null), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "batch_category_update");
    }
  };

  const handleDeleteRule = async (itemName: string) => {
    const updated = { ...itemCategoryRules };
    delete updated[itemName];
    const rulesDocRef = doc(db, "configs", "rules");
    try {
      await setDoc(rulesDocRef, { mapping: updated });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "configs/rules");
    }
  };

  const handleClearRules = async () => {
    const rulesDocRef = doc(db, "configs", "rules");
    try {
      await setDoc(rulesDocRef, { mapping: {} });
      setNotification({
        message: "Product category memory cleared.",
        type: "info"
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "configs/rules");
    }
  };

  const handleUpdateProductSpecs = async (
    productName: string,
    specs: {
      customBarcode?: string;
      customWeightOrVolValue?: number;
      customWeightOrVolUnit?: 'g' | 'kg' | 'ml' | 'l' | 'unit';
    }
  ) => {
    const targetName = productName.trim().toLowerCase();
    const matchingItems = items.filter(item => item.name.trim().toLowerCase() === targetName);
    
    if (matchingItems.length === 0) return;

    const batch = writeBatch(db);
    matchingItems.forEach(item => {
      const itemRef = doc(db, "items", item.id);
      
      const updateData: Record<string, any> = {};
      
      if (specs.customBarcode !== undefined && specs.customBarcode.trim() !== "") {
        updateData.customBarcode = specs.customBarcode.trim();
      } else {
        updateData.customBarcode = deleteField();
      }

      if (specs.customWeightOrVolValue !== undefined && !isNaN(specs.customWeightOrVolValue) && specs.customWeightOrVolValue > 0) {
        updateData.customWeightOrVolValue = specs.customWeightOrVolValue;
      } else {
        updateData.customWeightOrVolValue = deleteField();
      }

      if (specs.customWeightOrVolUnit !== undefined && specs.customWeightOrVolUnit.trim() !== "") {
        updateData.customWeightOrVolUnit = specs.customWeightOrVolUnit;
      } else {
        updateData.customWeightOrVolUnit = deleteField();
      }

      batch.update(itemRef, updateData);
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "batch_product_specs_update");
    }
  };

  const handleUpdateProductCategory = async (productName: string, newCategory: string) => {
    const targetKey = productName.trim().toLowerCase();
    if (!targetKey || !newCategory) return;

    const linkedItems = items.filter(item => item.name.trim().toLowerCase() === targetKey);
    const batch = writeBatch(db);

    // 1. Update linked items
    linkedItems.forEach(item => {
      const itemRef = doc(db, "items", item.id);
      batch.update(itemRef, { category: newCategory });
    });

    // 2. Update memory rules
    const updatedRules = { ...itemCategoryRules, [targetKey]: newCategory };
    const rulesDocRef = doc(db, "configs", "rules");
    batch.set(rulesDocRef, { mapping: updatedRules });

    try {
      await batch.commit();
      setNotification({
        message: `Category for "${productName}" updated to "${newCategory}".`,
        type: "success"
      });
      setTimeout(() => setNotification(null), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "batch_product_category_update");
    }
  };

  const handleRenameProduct = async (oldName: string, newName: string) => {
    const targetOld = oldName.trim().toLowerCase();
    const targetNew = newName.trim();
    if (!targetOld || !targetNew || targetOld === targetNew.toLowerCase()) return;

    const matchingItems = items.filter(item => item.name.trim().toLowerCase() === targetOld);
    if (matchingItems.length === 0) return;

    const batch = writeBatch(db);
    matchingItems.forEach(item => {
      const itemRef = doc(db, "items", item.id);
      // If originalName is already present, keep it. Otherwise set it to the current name.
      const originalName = item.originalName || item.name;
      batch.update(itemRef, {
        name: targetNew,
        originalName: originalName
      });
    });

    try {
      await batch.commit();

      // Update selectedItemForDetail if the current product was renamed / merged!
      if (selectedItemForDetail && selectedItemForDetail.trim().toLowerCase() === targetOld) {
        setSelectedItemForDetail(targetNew);
      }

      setNotification({
        message: `Successfully renamed "${oldName}" structure.`,
        type: "success"
      });
      setTimeout(() => setNotification(null), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "batch_product_rename");
    }
  };

  const handleUpdateInvoiceDate = async (itemsToUpdate: ReceiptItem[], newDate: string) => {
    if (!itemsToUpdate || itemsToUpdate.length === 0 || !newDate) return;
    const batch = writeBatch(db);
    itemsToUpdate.forEach(item => {
      const itemRef = doc(db, "items", item.id);
      batch.update(itemRef, { purchaseDate: newDate });
    });
    try {
      await batch.commit();
      setNotification({
        message: language === "pt"
          ? `Data da nota fiscal atualizada para ${newDate}.`
          : `Invoice date updated to ${newDate}.`,
        type: "success"
      });
      setTimeout(() => setNotification(null), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "batch_invoice_date_update");
    }
  };

  const existingInvoices = useMemo(() => {
    const list: string[] = [];
    items.forEach((item) => {
      if (item.invoiceNumber && item.invoiceNumber.trim() !== "") {
        const num = item.invoiceNumber.trim();
        if (!list.includes(num)) {
          list.push(num);
        }
      }
    });
    return list;
  }, [items]);

  const uniqueItemsCount = useMemo(() => {
    const names = new Set(
      items
        .map((item) => item.name.trim().toLowerCase())
        .filter((name) => name !== "")
    );
    return names.size;
  }, [items]);

  // Handle scanned receipt insertion
  const handleScanSuccess = async (scanResult: ScannedReceiptResult, isPartOfBatch = false) => {
    // If server side duplicate precheck detected isDuplicate, block immediately
    if (scanResult.isDuplicate) {
      setDuplicateScanError({
        invoiceNumber: scanResult.invoiceNumber?.trim() || "N/A",
        storeName: scanResult.storeName?.trim() || "N/A",
        purchaseDate: cleanDate(scanResult.purchaseDate || new Date().toISOString().split("T")[0]),
        totalAmount: scanResult.totalAmount || 0,
        pendingResult: scanResult,
      });
      return;
    }

    if (!scanResult || !scanResult.items || scanResult.items.length === 0) {
      setNotification({
        message: "Scanning succeeded, but no individual items could be parsed structurally.",
        type: "info"
      });
      return;
    }

    const normalizedScannedInvoiceNum = scanResult.invoiceNumber?.trim() || "";
    
    // Check if duplicate invoice exists in current database
    if (normalizedScannedInvoiceNum !== "") {
      const alreadyExists = items.some(
        (item) => item.invoiceNumber && item.invoiceNumber.trim().toLowerCase() === normalizedScannedInvoiceNum.toLowerCase()
      );
      
      if (alreadyExists) {
        setDuplicateScanError({
          invoiceNumber: normalizedScannedInvoiceNum,
          storeName: scanResult.storeName?.trim() || "Grocery Store",
          purchaseDate: cleanDate(scanResult.purchaseDate),
          totalAmount: scanResult.totalAmount || 0,
          pendingResult: scanResult
        });
        return; // Halt insertion entirely!
      }
    }

    const scanDate = cleanDate(scanResult.purchaseDate);
    const merchantName = scanResult.storeName?.trim() || "Grocery Store";

    // Transform parsed items into our application structure
    const newlyExtractedRows: ReceiptItem[] = scanResult.items.map((item) => {
      let matchedCategory = resolveItemCategory(item.name || "", itemCategoryRules, items, categoryMappings);
      if (matchedCategory === "Other") {
        if (item.category && item.category.trim().toLowerCase() !== "other" && item.category.trim().toLowerCase() !== "produto") {
          matchedCategory = item.category;
        } else {
          matchedCategory = "Produto";
        }
      }
      return {
        id: generateId(),
        name: item.name || "Unknown Item",
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0.0,
        category: matchedCategory,
        purchaseDate: scanDate,
        storeName: merchantName,
        invoiceNumber: normalizedScannedInvoiceNum,
      };
    });

    // Append newly extracted rows to the staging state
    setStagedItems((prev) => [...prev, ...newlyExtractedRows]);

    // Force redirection to the staging review screen (only if not part of a batch)
    if (!isPartOfBatch) {
      setCurrentTab('staged-review');
    }

    const itemsQty = newlyExtractedRows.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const uniqueCount = new Set(newlyExtractedRows.map(item => item.name.trim().toLowerCase())).size;
    const invoicesCount = new Set(newlyExtractedRows.map(item => item.invoiceNumber?.trim() || "").filter(inv => inv !== "")).size || 1;

    // Create a rich success alert indicating the number of items added and automatic reset callback
    if (scanResult.quotaLimitActive) {
      setNotification({
        message: `⚠️ API Daily Quota Limit Exceeded (429)! Processed receipt offline (generated ${newlyExtractedRows.length} items from ${merchantName} for review).`,
        type: "error",
        detailStats: {
          itemsQty,
          uniqueCount,
          invoicesCount
        }
      });
    } else {
      setNotification({
        message: `🎉 Success! Added ${newlyExtractedRows.length} item(s) from ${merchantName} to the staging review area.`,
        type: "success",
        detailStats: {
          itemsQty,
          uniqueCount,
          invoicesCount
        }
      });
    }

    // Auto dismiss notification banner
    setTimeout(() => setNotification(null), scanResult.quotaLimitActive ? 15000 : 8000);
  };

  // Staging Area Action & Persistence Functions
  const handleUpdateStagedItem = (id: string, updatedFields: Partial<ReceiptItem>) => {
    setStagedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updatedFields } : item))
    );
  };

  const handleRemoveStagedItem = (id: string) => {
    setStagedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddStagedItem = (item: ReceiptItem) => {
    setStagedItems((prev) => [...prev, item]);
  };

  const handleCompleteImport = async () => {
    if (stagedItems.length === 0) return;

    const batch = writeBatch(db);
    stagedItems.forEach((item) => {
      const itemRef = doc(db, "items", item.id);
      batch.set(itemRef, item);
    });

    try {
      await batch.commit();
      setNotification({
        message: language === "pt"
          ? `🎉 Importação completa! ${stagedItems.length} item(ns) adicionados com sucesso ao banco de dados.`
          : `🎉 Import complete! Successfully added ${stagedItems.length} item(s) to the main database.`,
        type: "success"
      });
      setStagedItems([]);
      setCurrentTab("spreadsheet");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "complete_staged_import");
    }
  };

  const handleCancelImport = () => {
    setStagedItems([]);
    setCurrentTab("scan");
  };

  // Inline Cell Update Helper
  const handleUpdateItem = async (id: string, updatedFields: Partial<ReceiptItem>) => {
    const parentRow = items.find(i => i.id === id);
    if (!parentRow) return;

    const batch = writeBatch(db);

    // 1. If Category has changed, remember this choice as an automation rule
    if (updatedFields.category) {
      const nameKey = (updatedFields.name || parentRow.name || "").trim().toLowerCase();
      if (nameKey && itemCategoryRules[nameKey] !== updatedFields.category) {
        const updatedRules = { ...itemCategoryRules, [nameKey]: updatedFields.category };
        const rulesDocRef = doc(db, "configs", "rules");
        batch.set(rulesDocRef, { mapping: updatedRules });
      }
    }

    // 2. If Description is modified, run automatic category resolution rules and memories first
    if (updatedFields.name !== undefined && updatedFields.name.trim() !== (parentRow.name || "").trim()) {
      if (!parentRow.originalName) {
        updatedFields.originalName = parentRow.name;
      }
      const resolved = resolveItemCategory(updatedFields.name, itemCategoryRules, items, categoryMappings);
      if (resolved && resolved !== "Other") {
        updatedFields.category = resolved;
      } else if (itemCategoryRules[updatedFields.name.trim().toLowerCase()]) {
        updatedFields.category = itemCategoryRules[updatedFields.name.trim().toLowerCase()];
      }
    }

    // Prepare complete updated fields to filter out undefined
    const cleanUpdatedFields: Record<string, any> = {};
    Object.entries(updatedFields).forEach(([k, v]) => {
      if (v !== undefined) {
        cleanUpdatedFields[k] = v;
      }
    });

    const itemRef = doc(db, "items", id);
    batch.update(itemRef, cleanUpdatedFields);

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `items/${id}`);
    }
  };

  // Delete Row
  const handleDeleteItem = async (id: string) => {
    const itemRef = doc(db, "items", id);
    try {
      await deleteDoc(itemRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `items/${id}`);
    }
  };

  // Add a manual item or default row
  const handleAddNewItem = async (newItemData?: Omit<ReceiptItem, 'id'>) => {
    const freshRow: ReceiptItem = {
      id: generateId(),
      name: newItemData?.name || "",
      quantity: newItemData ? Number(newItemData.quantity) || 0 : 1,
      price: newItemData ? Number(newItemData.price) || 0 : 0.0,
      category: newItemData?.category || (activeCategories[0] || "Produce"),
      purchaseDate: newItemData?.purchaseDate || new Date().toISOString().split("T")[0],
      storeName: newItemData?.storeName || items[0]?.storeName || "Local Grocer",
      invoiceNumber: newItemData?.invoiceNumber || "",
    };
    const itemRef = doc(db, "items", freshRow.id);
    try {
      await setDoc(itemRef, freshRow);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `items/${freshRow.id}`);
    }
  };

  // Clear all items on the spreadsheet immediately (confirmation is handled inline by the UI)
  const handleClearAll = async () => {
    if (items.length === 0) return;
    const batch = writeBatch(db);
    items.forEach(item => {
      batch.delete(doc(db, "items", item.id));
    });

    try {
      await batch.commit();
      setNotification({
        message: "Spreadsheet cleared.",
        type: "info"
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "items_all");
    }
  };

  // Import items parsed from CSV file
  const handleImportCSVItems = async (imported: Omit<ReceiptItem, 'id'>[]) => {
    const itemsWithIds: ReceiptItem[] = imported.map(item => {
      let finalCategory = item.category;
      if (!finalCategory || finalCategory.trim().toLowerCase() === "other" || finalCategory.trim().toLowerCase() === "produto") {
        const resolved = resolveItemCategory(item.name || "", itemCategoryRules, items, categoryMappings);
        if (resolved && resolved !== "Other") {
          finalCategory = resolved;
        } else {
          finalCategory = "Produto";
        }
      } else {
        // Run standard categorizer in case name matches new rules (Beverages, Ingredients, Fruits)
        const resolved = resolveItemCategory(item.name || "", itemCategoryRules, items, categoryMappings);
        const beveragesName = categoryMappings["Beverages"] || "Beverages";
        const ingredientsName = categoryMappings["Ingredients"] || "Ingredients";
        const fruitsName = categoryMappings["Fruits"] || "Fruits";
        if (resolved === beveragesName || resolved === ingredientsName || resolved === fruitsName) {
          finalCategory = resolved;
        }
      }
      return {
        ...item,
        category: finalCategory,
        id: generateId()
      };
    });

    const batch = writeBatch(db);
    itemsWithIds.forEach(item => {
      const itemRef = doc(db, "items", item.id);
      batch.set(itemRef, item);
    });

    try {
      await batch.commit();

      const itemsQty = itemsWithIds.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const uniqueCount = new Set(itemsWithIds.map(item => item.name.trim().toLowerCase())).size;
      const invoicesCount = new Set(itemsWithIds.map(item => item.invoiceNumber?.trim() || "").filter(inv => inv !== "")).size || 1;

      setNotification({
        message: `Imported ${itemsWithIds.length} items from CSV spreadsheet successfully.`,
        type: "success",
        detailStats: {
          itemsQty,
          uniqueCount,
          invoicesCount
        }
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "batch_csv_import");
    }
  };

  // Load Seed items
  const handleLoadDemo = async () => {
    const batch = writeBatch(db);
    // Delete old items first to prevent pollution
    items.forEach(item => {
      batch.delete(doc(db, "items", item.id));
    });
    // Add Demo items
    DEMO_RECEIPT_ITEMS.forEach(item => {
      batch.set(doc(db, "items", item.id), item);
    });

    try {
      await batch.commit();

      const itemsQty = DEMO_RECEIPT_ITEMS.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const uniqueCount = new Set(DEMO_RECEIPT_ITEMS.map(item => item.name.trim().toLowerCase())).size;
      const invoicesCount = new Set(DEMO_RECEIPT_ITEMS.map(item => item.invoiceNumber?.trim() || "").filter(inv => inv !== "")).size || 1;

      setNotification({
        message: "Loaded demo sandbox receipt data. Double click or select rows to edit fields.",
        type: "success",
        detailStats: {
          itemsQty,
          uniqueCount,
          invoicesCount
        }
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "batch_demo_load");
    }
  };

  // --- Analytical Calculations for Bento Panel ---
  const calculatedStats = useMemo(() => {
    let grandTotal = 0;
    let monthlyTotalExpense = 0;
    const categoryTotals: Record<string, number> = {};
    const monthlyCategoryTotals: Record<string, number> = {};
    const storeFrequencies: Record<string, number> = {};

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed (0 - 11)

    items.forEach((item) => {
      const rowSum = (Number(item.quantity) || 0) * (Number(item.price) || 0);
      grandTotal += rowSum;

      // Filter to current month for Monthly Total Expense
      let isCurrentMonth = false;
      if (item.purchaseDate) {
        const parts = item.purchaseDate.split('-');
        if (parts.length >= 2) {
          const itemYear = parseInt(parts[0], 10);
          const itemMonth = parseInt(parts[1], 10);
          isCurrentMonth = itemYear === currentYear && (itemMonth - 1) === currentMonth;
        }
      }
      if (isCurrentMonth) {
        monthlyTotalExpense += rowSum;
        const cat = item.category || "Other";
        monthlyCategoryTotals[cat] = (monthlyCategoryTotals[cat] || 0) + rowSum;
      }

      // Category accumulation
      const cat = item.category || "Other";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + rowSum;

      // Store frequency
      const str = item.storeName?.trim() || "Unknown";
      storeFrequencies[str] = (storeFrequencies[str] || 0) + rowSum;
    });

    // Extract Top Category
    let topCategoryName = "None";
    let maxCatVal = 0;
    Object.entries(categoryTotals).forEach(([cat, val]) => {
      if (val > maxCatVal) {
        maxCatVal = val;
        topCategoryName = cat;
      }
    });

    // Extract Top Store
    let topStoreName = "None";
    let maxStoreVal = 0;
    Object.entries(storeFrequencies).forEach(([store, val]) => {
      if (val > maxStoreVal) {
        maxStoreVal = val;
        topStoreName = store;
      }
    });

    // Sort categories by expenditure for visual rankings
    const sortedCategoriesList = Object.entries(categoryTotals)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);

    const sortedMonthlyCategoriesList = Object.entries(monthlyCategoryTotals)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);

    const currentMonthName = now.toLocaleString(language === 'pt' ? 'pt-BR' : 'en-US', { month: 'long' });
    const capitalizedCurrentMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

    return {
      grandTotal,
      monthlyTotalExpense,
      topCategory: topCategoryName,
      topStore: topStoreName,
      categoriesRanked: sortedCategoriesList,
      monthlyCategoriesRanked: sortedMonthlyCategoriesList,
      currentMonthName: capitalizedCurrentMonth
    };
  }, [items, language]);

  // --- Calculate 15-Day Price History ---
  const priceHistory15Days = useMemo(() => {
    const today = new Date();
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const fifteenDaysAgoStr = fifteenDaysAgo.toISOString().split("T")[0];

    // Filter items within the last 15 days (inclusive)
    const recentItems = items.filter(
      (item) => item.purchaseDate >= fifteenDaysAgoStr && item.name.trim() !== ""
    );

    // Group items by name (case-insensitive)
    const grouped: Record<string, typeof items> = {};
    recentItems.forEach((item) => {
      const nameKey = item.name.trim().toLowerCase();
      if (!grouped[nameKey]) {
        grouped[nameKey] = [];
      }
      grouped[nameKey].push(item);
    });

    const historyList = Object.entries(grouped).map(([key, groupItems]) => {
      // Sort group items by date ascending (oldest first)
      const sortedByDate = [...groupItems].sort(
        (a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
      );

      const latestItem = sortedByDate[sortedByDate.length - 1];
      const currentPrice = latestItem.price;

      // Extract unique sequential prices
      const pricePoints: number[] = [];
      sortedByDate.forEach((itm) => {
        if (pricePoints.length === 0 || pricePoints[pricePoints.length - 1] !== itm.price) {
          pricePoints.push(itm.price);
        }
      });

      let priceChangeText = "Stable";
      let priceChangePercent = 0;
      let changeType: "stable" | "increased" | "decreased" = "stable";
      let previousPrice: number | null = null;

      if (pricePoints.length > 1) {
        previousPrice = pricePoints[pricePoints.length - 2]; // one before latest unique price
        const diff = currentPrice - previousPrice;
        priceChangePercent = previousPrice > 0 ? (diff / previousPrice) * 100 : 0;

        if (diff > 0) {
          changeType = "increased";
          priceChangeText = `+${formatCurrency(diff)} (+${priceChangePercent.toFixed(1)}%)`;
        } else if (diff < 0) {
          changeType = "decreased";
          priceChangeText = `-${formatCurrency(Math.abs(diff))} (-${Math.abs(priceChangePercent).toFixed(1)}%)`;
        }
      }

      return {
        name: latestItem.name,
        currentPrice,
        previousPrice,
        pricePoints,
        priceChangeText,
        priceChangePercent,
        changeType,
        lastPurchaseDate: latestItem.purchaseDate,
        category: latestItem.category,
        storeName: latestItem.storeName
      };
    });

    // Sort: price changes first, then alphabetically
    return historyList.sort((a, b) => {
      if (a.changeType !== "stable" && b.changeType === "stable") return -1;
      if (a.changeType === "stable" && b.changeType !== "stable") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [items]);

  const isRecipeTab = currentTab === 'recipe-costing-sheets' || currentTab === 'fixed-expenses' || currentTab === 'production-costs';
  const containerWidthClass = isRecipeTab
    ? 'w-[80%] max-w-[80%]'
    : (currentTab === 'spreadsheet' || currentTab === 'uniqueItems' || currentTab === 'priceVariations' || currentTab === 'uniqueInvoices' || currentTab === 'staged-review' || currentTab === 'orders-detail') 
      ? 'w-[90%] max-w-[90%]' 
      : 'max-w-4xl';

  return (
    <div className={`min-h-screen font-sans antialiased flex flex-col justify-between transition-colors duration-200 ${
      theme === "dark" 
        ? "bg-slate-950 text-slate-200 dark" 
        : "bg-[#fafbfc] text-slate-800"
    }`}>
      <div>
        {/* Primary Container */}
        <main className={`${containerWidthClass} mx-auto px-4 sm:px-6 lg:px-8 py-8`}>
          
          {/* Banner Alert Notification */}
          {notification && (
            <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 shadow-xs text-xs ${
              notification.type === "success" 
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : notification.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}>
              <AlertCircle className="w-4.5 h-4.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">{notification.message}</p>
                {notification.detailStats && (
                  <div className={`mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-medium p-2 rounded-lg border select-none ${
                    notification.type === "success"
                      ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-800/90 dark:text-emerald-305"
                      : "bg-rose-500/5 border-rose-500/15 text-rose-800/90 dark:text-rose-305"
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold font-mono text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 px-1.5 py-0.5 rounded-sm">{notification.detailStats.itemsQty}</span>
                      <span>Total Quantity</span>
                    </div>
                    <div className="opacity-35 font-normal">|</div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold font-mono text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 px-1.5 py-0.5 rounded-sm">{notification.detailStats.uniqueCount}</span>
                      <span>Unique Items</span>
                    </div>
                    <div className="opacity-35 font-normal">|</div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold font-mono text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 px-1.5 py-0.5 rounded-sm">{notification.detailStats.invoicesCount}</span>
                      <span>Invoices Added</span>
                    </div>
                  </div>
                )}
                {currentTab === 'scan' && notification.type === 'success' && (
                  <button 
                    onClick={() => setCurrentTab('spreadsheet')}
                    className="mt-1.5 text-emerald-600 hover:text-emerald-700 font-bold underline text-xs cursor-pointer block"
                  >
                    View added item(s) in spreadsheet now →
                  </button>
                )}
              </div>
              <button 
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-slate-600 font-bold px-1.5 py-0.5 rounded-sm"
              >
                ✕
              </button>
            </div>
          )}

          {selectedItemForDetail ? (
            <div className="animate-fade-in-up">
              <ProductDetailsScreen
                productName={selectedItemForDetail}
                items={items}
                language={language}
                onBack={() => setSelectedItemForDetail(null)}
                onUpdateProductSpecs={handleUpdateProductSpecs}
                onRenameProduct={handleRenameProduct}
                onNavigateToCosting={(name) => {
                  setSelectedItemForDetail(null);
                  setCurrentTab('recipe-costing-sheets');
                }}
              />
            </div>
          ) : (
            <>
              {/* VIEW 1: MAIN SUBMISSION & SCANNING VIEW */}
              {currentTab === 'scan' && (
            <div className="space-y-6">
              {/* Orders Bento Card (Full Width) */}
              <OrdersBento 
                language={language} 
                onConfigure={(channelKey) => {
                  setSelectedIntegrationChannel(channelKey);
                  setCurrentTab('integrations');
                }}
                onSelectChannel={(channelKey) => {
                  setSelectedOrderDetailChannel(channelKey);
                  setCurrentTab('orders-detail');
                }}
              />

              {/* Bento Board Stats Dashboard */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Card 1: Total Spent */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-3.5 shadow-2xs hover:shadow-xs transition-shadow">
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-emerald-600 shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-[10.5px] font-bold text-slate-400 uppercase tracking-wider leading-tight">
                      {language === "pt" ? "Despesa Total Mensal" : "Monthly Total Expense"}
                    </p>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1 font-mono leading-none">
                      {formatCurrency(calculatedStats.monthlyTotalExpense)}
                    </h3>
                  </div>
                </div>

                {/* Card 2: Database Stats */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-start gap-4 shadow-2xs hover:shadow-xs transition-shadow">
                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-blue-600 self-start mt-0.5">
                    <Database className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Database</p>
                    <div className="grid grid-cols-2 gap-3 border-t border-slate-50 pt-2">
                      <div>
                        <button
                          id="uniqueItems-stats-btn"
                          type="button"
                          onClick={() => {
                            setSelectedItemForDetail(null);
                            setCurrentTab('uniqueItems');
                          }}
                          className="text-left cursor-pointer group/item hover:bg-slate-50 dark:hover:bg-slate-800/40 p-2 -m-2 rounded-xl transition-all focus:outline-hidden block w-full border border-transparent hover:border-emerald-100/50 dark:hover:border-emerald-900/10"
                          title="Click to view unique items spreadsheet database"
                        >
                          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 group-hover/item:text-emerald-500 uppercase tracking-tight transition-colors">Unique Items</p>
                          <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-200 font-mono mt-0.5 group-hover/item:text-emerald-600 dark:group-hover/item:text-emerald-400 transition-colors">{uniqueItemsCount}</h4>
                        </button>
                      </div>
                      <div className="border-l border-slate-100 pl-3">
                        <button
                          id="uniqueInvoices-stats-btn"
                          type="button"
                          onClick={() => {
                            setSelectedItemForDetail(null);
                            setCurrentTab('uniqueInvoices');
                          }}
                          className="text-left cursor-pointer group/item hover:bg-slate-50 dark:hover:bg-slate-800/40 p-2 -m-2 rounded-xl transition-all focus:outline-hidden block w-full border border-transparent hover:border-blue-100/50 dark:hover:border-blue-900/10"
                          title="Click to view unique invoices details"
                        >
                          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 group-hover/item:text-blue-500 uppercase tracking-tight transition-colors">Unique Invoices</p>
                          <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-200 font-mono mt-0.5 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors">{existingInvoices.length}</h4>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                 {/* Card 3: Receipt Scan Center Actions */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-shadow min-h-[110px]">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-emerald-600 shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wider leading-none">
                        {language === "pt" ? "Central de Digitalização" : "Receipt Scan Center"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => scannerRef.current?.triggerChooseFile()}
                      className="bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-[11px] px-2.5 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                      title={language === "pt" ? "Escolher arquivos da sua galeria de fotos" : "Choose photos directly from your photo library"}
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-sky-450 shrink-0" />
                      <span className="truncate">{language === "pt" ? "Galeria" : "Gallery"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => scannerRef.current?.triggerTakePhoto()}
                      className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-[11px] px-2.5 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                      title={language === "pt" ? "Tirar foto usando a câmera do seu dispositivo" : "Take direct photo using device native camera"}
                    >
                      <Camera className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{language === "pt" ? "Câmera" : "Camera"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Scanner Section (Visually hidden scanner component, visible duplicate error banner) */}
              {duplicateScanError ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  <div className="md:col-span-12">
                    <div className="bg-white rounded-2xl shadow-sm border border-rose-100 p-8 text-center max-w-2xl mx-auto animate-fade-in">
                      <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100 text-rose-500">
                        <AlertCircle className="w-8 h-8" />
                      </div>
                      
                      <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                        Duplicate Invoice Prevented
                      </h2>
                      
                      <div className="mt-4 bg-slate-50 rounded-xl p-5 border border-slate-100 max-w-md mx-auto text-left space-y-2 text-xs">
                        <p className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Invoice Parameters Found</p>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Invoice Number:</span>
                          <span className="font-bold font-mono text-slate-800">{duplicateScanError.invoiceNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Validation Check:</span>
                          <span className="font-bold text-rose-600 uppercase tracking-widest text-[9px] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">MATCH FOUND (BLOCKED)</span>
                        </div>
                      </div>

                      <p className="text-sm text-slate-600 mt-5 leading-relaxed max-w-md mx-auto">
                        This scanned invoice (<b>#{duplicateScanError.invoiceNumber}</b>) has already been included in your spreadsheet database. Duplicates are blocked. OCR of the remaining information was not performed.
                      </p>

                      <div className="mt-6 flex justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            // Reset the duplicate indicator and let them scan/upload a different one!
                            setDuplicateScanError(null);
                          }}
                          className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-xs px-6 py-3 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Add a New Receipt
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="hidden">
                  <ReceiptScanner 
                    ref={scannerRef}
                    onScanSuccess={handleScanSuccess} 
                    existingInvoices={existingInvoices} 
                    onBatchComplete={() => setCurrentTab('staged-review')}
                    language={language}
                  />
                </div>
              )}

              {/* Meta information & Category Split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  {/* Expenditures by Category */}
                  <div 
                    onClick={() => setCurrentTab('breakdown')}
                    className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:border-emerald-200 cursor-pointer group transition-all"
                    title="Click to view full interactive spending breakdown screen"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Tag className="w-4 h-4 text-emerald-500" />
                          {language === 'pt' ? 'Painel de Gastos' : 'Spending Breakdown'}
                        </h3>
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-sans shrink-0">
                          {calculatedStats.currentMonthName}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-semibold group-hover:underline flex items-center gap-0.5 shrink-0">
                        {language === 'pt' ? 'Ver Tudo →' : 'Full Screen →'}
                      </span>
                    </div>
                    
                    {items.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">
                        {language === 'pt' ? 'Escaneie ou insira cupons para exibir índices de gastos.' : 'Scan or input receipts to display expense allocation indexes.'}
                      </p>
                    ) : calculatedStats.monthlyCategoriesRanked.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center leading-normal">
                        {language === 'pt' 
                          ? `Nenhuma despesa registrada em ${calculatedStats.currentMonthName} ainda.` 
                          : `No expenses logged in ${calculatedStats.currentMonthName} yet.`}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {calculatedStats.monthlyCategoriesRanked.slice(0, 3).map((cat) => {
                          const percentage = calculatedStats.monthlyTotalExpense > 0 
                            ? (cat.amount / calculatedStats.monthlyTotalExpense) * 100 
                            : 0;
                          return (
                            <div key={cat.name} className="space-y-1">
                              <div className="flex justify-between text-xs text-slate-700">
                                <span className="font-medium">{cat.name}</span>
                                <span className="font-mono text-slate-500">
                                  {formatCurrency(cat.amount)} ({percentage.toFixed(0)}%)
                                </span>
                              </div>
                              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                        <div className="pt-2 text-center text-[10px] text-slate-400 font-medium border-t border-slate-50 mt-1">
                          {language === 'pt' ? 'E outras ' : 'And '}
                          {Math.max(0, calculatedStats.monthlyCategoriesRanked.length - 3)}
                          {language === 'pt' ? ' categorias. Clique para ver tudo!' : ' other categories. Click to see all!'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Price History Block */}
                  <div 
                    onClick={() => setCurrentTab('priceVariations')}
                    className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:border-violet-200/60 cursor-pointer group/card transition-all flex flex-col justify-between"
                    title="Click to view full price variations screen"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 transition-colors group-hover/card:text-violet-600">
                        <TrendingUp className="w-4 h-4 text-amber-550" />
                        Price History (15d)
                      </h3>
                      <span className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold group-hover/card:underline flex items-center gap-0.5">
                        View top variations →
                      </span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pr-0.5 space-y-1.5 max-h-[145px] scrollbar-thin">
                      {priceHistory15Days.length === 0 ? (
                        <p className="text-xs text-slate-400 py-6 text-center">No recent trends</p>
                      ) : (
                        priceHistory15Days.slice(0, 4).map((hist) => (
                          <div key={hist.name} className="flex items-center justify-between gap-2 text-xs border-b border-slate-100/40 pb-1.5 last:border-0 last:pb-0">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-700 dark:text-slate-350 truncate animate-none" title={hist.name}>
                                {hist.name}
                              </p>
                              <p className="text-[10px] text-slate-405 dark:text-slate-500 truncate">
                                {hist.storeName || "Store"} • {hist.lastPurchaseDate}
                              </p>
                            </div>
                            
                            <div className="text-right shrink-0 font-mono">
                              <p className="font-bold text-slate-800 dark:text-slate-200">
                                {formatCurrency(hist.currentPrice)}
                              </p>
                              {hist.changeType === "increased" ? (
                                <span className="text-[10px] font-bold text-rose-600 font-mono bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded-[4px]" title={`Previous: ${formatCurrency(hist.previousPrice || 0)}`}>
                                  ▲ +{hist.priceChangePercent.toFixed(0)}%
                                </span>
                              ) : hist.changeType === "decreased" ? (
                                <span className="text-[10px] font-bold text-emerald-600 font-mono bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded-[4px]" title={`Previous: ${formatCurrency(hist.previousPrice || 0)}`}>
                                  ▼ -{Math.abs(hist.priceChangePercent).toFixed(0)}%
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">Stable</span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

              {/* Revenue Bento Card - Full Width! */}
              <div 
                id="revenue-bento-card"
                className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-4 animate-fade-in"
              >
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Store className="w-5 h-5 text-emerald-600" />
                      {language === 'pt' ? 'Faturamento & Vendas' : 'Revenue'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Button 1: Monthly Summary */}
                    <button
                      id="bento-monthly-summary-btn"
                      onClick={() => {
                        setCurrentTab('revenue');
                        setInitialRevenueSubTab('summary');
                      }}
                      className="bg-slate-50 hover:bg-emerald-50/70 text-slate-800 hover:text-emerald-700 font-bold text-xs py-3.5 px-4 rounded-xl border border-slate-200/50 hover:border-emerald-250 transition-all cursor-pointer flex items-center justify-between group/btn"
                    >
                      <span className="flex items-center gap-2">
                        <LineChart className="w-4 h-4 text-slate-400 group-hover/btn:text-emerald-500 shrink-0" />
                        <span>{language === 'pt' ? 'Resumo Mensal' : 'Monthly Summary'}</span>
                      </span>
                      <span className="text-[10px] text-emerald-600 opacity-40 group-hover/btn:opacity-100">
                        →
                      </span>
                    </button>

                    {/* Button 2: Daily Revenue */}
                    <button
                      id="bento-daily-revenue-btn"
                      onClick={() => {
                        setCurrentTab('revenue');
                        setInitialRevenueSubTab('daily');
                      }}
                      className="bg-slate-50 hover:bg-emerald-50/70 text-slate-800 hover:text-emerald-700 font-bold text-xs py-3.5 px-4 rounded-xl border border-slate-200/50 hover:border-emerald-250 transition-all cursor-pointer flex items-center justify-between group/btn"
                    >
                      <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400 group-hover/btn:text-emerald-500 shrink-0" />
                        <span>{language === 'pt' ? 'Faturamento Diário' : 'Daily Revenue'}</span>
                      </span>
                      <span className="text-[10px] text-emerald-600 opacity-40 group-hover/btn:opacity-100">
                        →
                      </span>
                    </button>

                    {/* Button 3: Store Config */}
                    <button
                      id="bento-store-config-btn"
                      onClick={() => {
                        setCurrentTab('revenue');
                        setInitialRevenueSubTab('store-config');
                      }}
                      className="bg-slate-50 hover:bg-emerald-50/70 text-slate-800 hover:text-emerald-700 font-bold text-xs py-3.5 px-4 rounded-xl border border-slate-200/50 hover:border-emerald-250 transition-all cursor-pointer flex items-center justify-between group/btn"
                    >
                      <span className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-slate-400 group-hover/btn:text-emerald-500 shrink-0" />
                        <span>{language === 'pt' ? 'Configuração da Loja' : 'Store Config'}</span>
                      </span>
                      <span className="text-[10px] text-emerald-600 opacity-40 group-hover/btn:opacity-100">
                        →
                      </span>
                    </button>
                  </div>
              </div>

              {/* Recipe Costing Bento Card - Full Width! */}
              <div 
                className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-4"
              >
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ChefHat className="w-5 h-5 text-amber-550" />
                      {language === 'pt' ? 'Custeio & Fichas Técnicas' : 'Costing & Recipe Sheets'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Button 1: Recipe Costing Sheets */}
                    <button
                      onClick={() => {
                        setCurrentTab('recipe-costing-sheets');
                        try {
                          safeStorage.setItem("costing_sheets_initial_subtab", "recipe-costing");
                        } catch {}
                      }}
                      className="bg-slate-50 hover:bg-amber-50/70 text-slate-800 hover:text-amber-700 font-bold text-xs py-3 px-4 rounded-xl border border-slate-200/50 hover:border-amber-250 transition-all cursor-pointer flex items-center justify-between group/btn"
                    >
                      <span className="flex items-center gap-2">
                        <ChefHat className="w-4 h-4 text-slate-400 group-hover/btn:text-amber-500 shrink-0" />
                        <span>{language === 'pt' ? 'Fichas de Custeio' : 'Recipe Sheets'}</span>
                      </span>
                      <span className="text-[10px] text-amber-600 opacity-40 group-hover/btn:opacity-100">
                        →
                      </span>
                    </button>

                    {/* Button 2: Volume and App Tax */}
                    <button
                      onClick={() => {
                        setCurrentTab('recipe-costing-sheets');
                        try {
                          safeStorage.setItem("costing_sheets_initial_subtab", "volume-tax");
                        } catch {}
                      }}
                      className="bg-slate-50 hover:bg-amber-50/70 text-slate-800 hover:text-amber-700 font-bold text-xs py-3 px-4 rounded-xl border border-slate-200/50 hover:border-amber-250 transition-all cursor-pointer flex items-center justify-between group/btn"
                    >
                      <span className="flex items-center gap-2">
                        <LineChart className="w-4 h-4 text-slate-400 group-hover/btn:text-amber-500 shrink-0" />
                        <span>{language === 'pt' ? 'Volume & Taxas App' : 'Volume & App Tax'}</span>
                      </span>
                      <span className="text-[10px] text-amber-600 opacity-40 group-hover/btn:opacity-100">
                        →
                      </span>
                    </button>

                    {/* Button 3: Fixed Expenses */}
                    <button
                      onClick={() => {
                        setCurrentTab('fixed-expenses');
                      }}
                      className="bg-slate-50 hover:bg-amber-50/70 text-slate-800 hover:text-amber-700 font-bold text-xs py-3 px-4 rounded-xl border border-slate-200/50 hover:border-amber-250 transition-all cursor-pointer flex items-center justify-between group/btn"
                    >
                      <span className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-slate-400 group-hover/btn:text-amber-500 shrink-0" />
                        <span>{language === 'pt' ? 'Despesas Fixas' : 'Fixed Expenses'}</span>
                      </span>
                      <span className="text-[10px] text-amber-600 opacity-40 group-hover/btn:opacity-100">
                        →
                      </span>
                    </button>

                    {/* Button 4: Production Costs */}
                    <button
                      onClick={() => {
                        setCurrentTab('production-costs');
                      }}
                      className="bg-slate-50 hover:bg-amber-50/70 text-slate-800 hover:text-amber-700 font-bold text-xs py-3 px-4 rounded-xl border border-slate-200/50 hover:border-amber-250 transition-all cursor-pointer flex items-center justify-between group/btn"
                    >
                      <span className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-slate-400 group-hover/btn:text-amber-400 shrink-0" />
                        <span>{language === 'pt' ? 'Custos de Produção' : 'Production Costs'}</span>
                      </span>
                      <span className="text-[10px] text-amber-600 opacity-40 group-hover/btn:opacity-100">
                        →
                      </span>
                    </button>
                  </div>
                </div>

                {/* Inventory Bento Card */}
                <InventoryBento 
                  items={items}
                  categories={activeCategories}
                  language={language}
                  onManageCategories={() => setCurrentTab('categories')}
                />
              </div>
          )}

          {/* VIEW 2: SPREADSHEET TABLE DATABASE VIEW */}
          {currentTab === 'spreadsheet' && (
            <div className="space-y-4 animate-fade-in">
              <SpreadsheetTable 
                items={items}
                onItemUpdate={handleUpdateItem}
                onItemDelete={handleDeleteItem}
                onItemAdd={handleAddNewItem}
                onClearAll={handleClearAll}
                onImportCSV={handleImportCSVItems}
                onLoadDemo={handleLoadDemo}
                categories={activeCategories}
                onViewItemDetails={(item) => setSelectedItemForDetail(item.name)}
                language={language}
                onBack={() => setCurrentTab('scan')}
                onManageCategories={() => setCurrentTab('categories')}
              />
            </div>
          )}

          {/* VIEW 3: CATEGORIES AND RECOGNITION RULES WORKFLOW VIEW */}
          {currentTab === 'categories' && (
            <div className="space-y-4 animate-fade-in">
              <CategoryManager
                categories={activeCategories}
                onAddCategory={handleAddCategory}
                onDeleteCategory={handleDeleteCategory}
                onUpdateCategory={handleUpdateCategory}
                itemCategoryRules={itemCategoryRules}
                onDeleteRule={handleDeleteRule}
                onClearRules={handleClearRules}
                items={items}
                language={language}
                onBack={() => setCurrentTab('scan')}
              />
            </div>
          )}

          {/* VIEW 4: SPENDING BREAKDOWN GRAPHIC VIEW */}
          {currentTab === 'breakdown' && (
            <SpendingBreakdown
              items={items}
              categories={activeCategories}
              onBack={() => setCurrentTab('scan')}
              language={language}
            />
          )}

          {/* VIEW 5: SETTINGS & CONFIGURATIONS PREFERENCES VIEW */}
          {currentTab === 'settings' && (
            <SettingsScreen
              theme={theme}
              currency={currency}
              language={language}
              onThemeChange={setTheme}
              onCurrencyChange={setCurrency}
              onLanguageChange={setLanguage}
              onBack={() => setCurrentTab('scan')}
            />
          )}

          {/* VIEW 6: UNIQUE ITEMS SPREADSHEET VIEW */}
          {currentTab === 'uniqueItems' && (
            <UniqueItemsScreen
              items={items}
              categories={activeCategories}
              language={language}
              onBack={() => {
                setSelectedItemForDetail(null);
                setCurrentTab('scan');
              }}
              onViewItemDetails={(productName) => {
                setSelectedItemForDetail(productName);
              }}
              onUpdateProductCategory={handleUpdateProductCategory}
            />
          )}

          {/* VIEW 7: PRICE VARIATIONS MONITOR VIEW */}
          {currentTab === 'priceVariations' && (
            <PriceVariationsScreen
              items={items}
              language={language}
              onBack={() => {
                setSelectedItemForDetail(null);
                setCurrentTab('scan');
              }}
              onViewItemDetails={(productName) => {
                setSelectedItemForDetail(productName);
              }}
            />
          )}

          {/* VIEW 8: UNIQUE INVOICES ANALYTICS SCREEN */}
          {currentTab === 'uniqueInvoices' && (
            <UniqueInvoicesScreen
              items={items}
              language={language}
              onBack={() => {
                setSelectedItemForDetail(null);
                setCurrentTab('scan');
              }}
              onViewItemDetails={(productName) => {
                setSelectedItemForDetail(productName);
              }}
              onUpdateInvoiceDate={handleUpdateInvoiceDate}
            />
          )}

          {/* VIEW 9: FIXED EXPENSES SCREEN */}
          {currentTab === 'fixed-expenses' && (
            <RecipeCostingSheetsScreen
              items={items}
              language={language}
              onBack={() => {
                setSelectedItemForDetail(null);
                setCurrentTab('scan');
              }}
              initialSubTab="fixed-expenses"
            />
          )}

          {/* VIEW 10: PRODUCTION COSTS SCREEN */}
          {currentTab === 'production-costs' && (
            <RecipeCostingSheetsScreen
              items={items}
              language={language}
              onBack={() => {
                setSelectedItemForDetail(null);
                setCurrentTab('scan');
              }}
              initialSubTab="production-costs"
            />
          )}

          {/* VIEW 11: RECIPE COSTING SHEETS SCREEN */}
          {currentTab === 'recipe-costing-sheets' && (
            <RecipeCostingSheetsScreen
              items={items}
              language={language}
              onBack={() => {
                setSelectedItemForDetail(null);
                setCurrentTab('scan');
              }}
            />
          )}

          {/* VIEW 12: REVENUE OPERATIONS SCREEN */}
          {currentTab === 'revenue' && (
            <RevenueScreen
              language={language}
              initialSubTab={initialRevenueSubTab}
              onBack={() => {
                setSelectedItemForDetail(null);
                setCurrentTab('scan');
              }}
            />
          )}

          {/* VIEW 13: STAGING & IMPORT REVIEW SCREEN */}
          {currentTab === 'staged-review' && (
            <StagingReviewScreen
              stagedItems={stagedItems}
              categories={activeCategories}
              language={language}
              onUpdateItem={handleUpdateStagedItem}
              onRemoveItem={handleRemoveStagedItem}
              onAddItem={handleAddStagedItem}
              onCompleteImport={handleCompleteImport}
              onCancel={handleCancelImport}
            />
          )}

          {/* VIEW 14: INTERACTIVE INTEGRATIONS FEED PAGE */}
          {currentTab === 'integrations' && (
            <IntegrationsScreen
              language={language}
              initialChannelKey={selectedIntegrationChannel}
              onBack={() => {
                setSelectedIntegrationChannel(undefined);
                setCurrentTab('scan');
              }}
            />
          )}

          {/* VIEW 15: DETAILED ORDERS DETAILS PAGE */}
          {currentTab === 'orders-detail' && (
            <OrdersDetailScreen
              language={language}
              initialChannel={selectedOrderDetailChannel}
              onBack={() => {
                setCurrentTab('scan');
              }}
            />
          )}
            </>
          )}
        </main>
      </div>

      {/* ACCESS BUTTON AT THE BOTTOM OF THE PAGE */}
      <footer className="border-t border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900 py-6 mt-8 shadow-inner transition-colors">
        <div className={`${containerWidthClass} mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4`}>
          
          {/* Settings Left-Aligned Footer Block */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
            <button
              id="view-home-btn"
              onClick={() => {
                setSelectedItemForDetail(null);
                setCurrentTab('scan');
              }}
              className={`font-semibold text-xs p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                currentTab === 'scan' && !selectedItemForDetail
                  ? 'border-emerald-500 bg-emerald-50/20 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-950/20'
                  : 'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-50 dark:bg-slate-850'
              }`}
              title={language === 'pt' ? 'Início' : 'Home'}
              aria-label={language === 'pt' ? 'Início' : 'Home'}
            >
              <Home className="w-4 h-4" />
            </button>
            <button
              id="view-settings-btn"
              onClick={() => {
                setSelectedItemForDetail(null);
                setCurrentTab('settings');
              }}
              className={`font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                currentTab === 'settings'
                  ? 'border-emerald-500 bg-emerald-50/20 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-950/20'
                  : 'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-50 dark:bg-slate-850'
              }`}
            >
              <Settings className="w-4 h-4" />
              {t.settings}
            </button>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              Total Database: <strong className="text-slate-700 dark:text-slate-300">{items.length} {language === 'pt' ? 'itens' : 'items'}</strong>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
            <button
              id="back-to-top-btn"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer border border-slate-200 dark:border-slate-800 group"
              title={t.backToTop}
              aria-label={t.backToTop}
            >
              <ArrowUp className="w-4 h-4 text-slate-500 group-hover:-translate-y-0.5 transition-transform" />
            </button>

            {!selectedItemForDetail && currentTab !== 'scan' && (
              <button
                id="view-scan-btn"
                onClick={() => setCurrentTab('scan')}
                className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-slate-750"
              >
                <Receipt className="w-4 h-4 text-slate-500" />
                {t.scanReceipt}
              </button>
            )}

            {!selectedItemForDetail && currentTab !== 'spreadsheet' && (
              <button
                id="view-table-btn"
                onClick={() => {
                  setSelectedItemForDetail(null);
                  setCurrentTab('spreadsheet');
                }}
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/10"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {t.openSpreadsheet} ({items.length})
              </button>
            )}

            {stagedItems.length > 0 && currentTab !== 'staged-review' && (
              <button
                id="view-staged-btn"
                onClick={() => {
                  setSelectedItemForDetail(null);
                  setCurrentTab('staged-review');
                }}
                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-600/10 animate-pulse"
              >
                <FileSpreadsheet className="w-4 h-4 text-white" />
                {language === 'pt' ? 'Revisar Pendentes' : 'Review Staged'} ({stagedItems.length})
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
