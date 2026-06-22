import React, { useState, useEffect, useMemo } from "react";
import { jsPDF } from "jspdf";
import { 
  Boxes, 
  Settings, 
  ClipboardList, 
  Save, 
  History, 
  X, 
  CheckCircle, 
  Calendar, 
  Trash2, 
  ChevronRight, 
  AlertCircle,
  FileSpreadsheet,
  Check,
  Printer
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { ReceiptItem } from "../types";
import { generateId, formatCurrency } from "../utils";

interface InventoryBentoProps {
  items: ReceiptItem[];
  categories: string[];
  language?: "en" | "pt";
}

interface SavedReportItem {
  name: string;
  category: string;
  quantity: number;
}

interface SavedInventoryReport {
  id: string;
  createdAt: string;
  categories: string[];
  items: SavedReportItem[];
  title?: string;
}

export default function InventoryBento({ items, categories, language = "en" }: InventoryBentoProps) {
  // Real-time Firestore loaded states
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [savedReports, setSavedReports] = useState<SavedInventoryReport[]>([]);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [isReportsLoading, setIsReportsLoading] = useState(true);

  // Modal / Interaction states
  const [activeModal, setActiveModal] = useState<"settings" | "generate" | "history" | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Clear delete confirmation on modal change
  useEffect(() => {
    setDeleteConfirmId(null);
  }, [activeModal]);
  
  // Generating report form state
  const [reportTitle, setReportTitle] = useState("");
  const [stockQuantities, setStockQuantities] = useState<Record<string, number>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">( "idle" );

  // Load Settings
  useEffect(() => {
    const docRef = doc(db, "settings", "inventory");
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (Array.isArray(data.categories)) {
          setSelectedCategories(data.categories);
        }
      } else {
        // Fallback: select Produce, Dairy, Bakery by default if fresh db
        const defaults = categories.filter(c => ["Produce", "Dairy", "Bakery", "Produto"].includes(c));
        setSelectedCategories(defaults.length > 0 ? defaults : categories.slice(0, 3));
      }
      setIsSettingsLoading(false);
    }, (error) => {
      console.error("Error loading inventory settings:", error);
      setIsSettingsLoading(false);
    });
    return () => unsubscribe();
  }, [categories]);

  // Load Reports
  useEffect(() => {
    const reportsCollection = collection(db, "inventory_reports");
    const unsubscribe = onSnapshot(reportsCollection, (snapshot) => {
      const reportsList: SavedInventoryReport[] = [];
      snapshot.forEach((doc) => {
        reportsList.push(doc.data() as SavedInventoryReport);
      });
      // Sort newest first
      reportsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSavedReports(reportsList);
      setIsReportsLoading(false);
    }, (error) => {
      console.error("Error loading inventory reports:", error);
      setIsReportsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Compute unique database items and filter by matching selected categories
  const targetItems = useMemo(() => {
    const uniqueMap = new Map<string, string>(); // Name -> Category
    items.forEach(item => {
      const name = item.name.trim();
      const cat = item.category || "Other";
      if (name && !uniqueMap.has(name)) {
        uniqueMap.set(name, cat);
      }
    });

    const list: { name: string; category: string }[] = [];
    uniqueMap.forEach((category, name) => {
      if (selectedCategories.includes(category)) {
        list.push({ name, category });
      }
    });

    // Sort alphabetically by category, then by name
    return list.sort((a, b) => {
      const catCompare = a.category.localeCompare(b.category);
      if (catCompare !== 0) return catCompare;
      return a.name.localeCompare(b.name);
    });
  }, [items, selectedCategories]);

  // Pre-fill quantities dictionary when generating
  const handleOpenGenerate = () => {
    const initialDict: Record<string, number> = {};
    targetItems.forEach(item => {
      initialDict[item.name] = 0;
    });
    setStockQuantities(initialDict);
    setReportTitle(
      language === "pt" 
        ? `Contagem de Estoque - ${new Date().toLocaleDateString("pt-BR")}`
        : `Stock Count - ${new Date().toLocaleDateString()}`
    );
    setSaveStatus("idle");
    setActiveModal("generate");
  };

  // Toggle Category setting selection
  const handleToggleCategory = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  // Save Inventory target categories config to Firestore
  const handleSaveSettings = async () => {
    try {
      setSaveStatus("saving");
      await setDoc(doc(db, "settings", "inventory"), {
        categories: selectedCategories
      });
      setSaveStatus("success");
      setTimeout(() => {
        setSaveStatus("idle");
        setActiveModal(null);
      }, 800);
    } catch (err) {
      console.error("Failed to save inventory settings:", err);
      setSaveStatus("error");
    }
  };

  // Save generated report sheet to database
  const handleSaveReport = async () => {
    try {
      setSaveStatus("saving");
      const reportId = "inv_" + generateId();
      
      const itemsToSave = targetItems.map(item => ({
        name: item.name,
        category: item.category,
        quantity: Number(stockQuantities[item.name]) || 0
      }));

      const reportData: SavedInventoryReport = {
        id: reportId,
        title: reportTitle.trim(),
        createdAt: new Date().toISOString(),
        categories: selectedCategories,
        items: itemsToSave
      };

      await setDoc(doc(db, "inventory_reports", reportId), reportData);
      setSaveStatus("success");
      
      setTimeout(() => {
        setSaveStatus("idle");
        setActiveModal(null);
      }, 1000);
    } catch (err) {
      console.error("Failed to save stock report to database:", err);
      setSaveStatus("error");
    }
  };

  const handlePrintPDF = () => {
    if (targetItems.length === 0) return;

    // Get current date formatted
    const dateObj = new Date();
    const formattedDate = dateObj.toLocaleDateString(
      language === "pt" ? "pt-BR" : "en-US", 
      { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }
    );

    const titleText = reportTitle.trim() || (language === "pt" ? "Contagem de Estoque" : "Inventory On-Hand Count");

    // Partition targetItems into groups of pages
    // On page 1: We start at Y = 45, max Y = 280. (280 - 45) / 12 = 19 rows per columns.
    // On page 2+: We start at Y = 34, max Y = 280. (280 - 34) / 12 = 20 rows per columns.
    const pages: Array<{ left: typeof targetItems; right: typeof targetItems }> = [];
    let currentItemIndex = 0;
    let pageNum = 0;

    while (currentItemIndex < targetItems.length) {
      const rowsCount = pageNum === 0 ? 19 : 20;
      const leftItems: typeof targetItems = [];
      const rightItems: typeof targetItems = [];
      
      for (let i = 0; i < rowsCount && currentItemIndex < targetItems.length; i++) {
        leftItems.push(targetItems[currentItemIndex]);
        currentItemIndex++;
      }
      for (let i = 0; i < rowsCount && currentItemIndex < targetItems.length; i++) {
        rightItems.push(targetItems[currentItemIndex]);
        currentItemIndex++;
      }
      
      pages.push({ left: leftItems, right: rightItems });
      pageNum++;
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    pages.forEach((pageData, pageIndex) => {
      if (pageIndex > 0) {
        doc.addPage();
      }
      
      let startY = 45;
      
      if (pageIndex === 0) {
        // Draw page 1 header
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text((language === "pt" ? "Data do Relatório: " : "Report Date: ") + formattedDate, 15, 15);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(15, 23, 42);
        doc.text(titleText, 15, 23);
        
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(15, 28, 195, 28);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(language === "pt" ? "QTD" : "QTY", 15, 36);
        doc.text(language === "pt" ? "ITEM" : "ITEM", 32, 36);
        
        doc.text(language === "pt" ? "QTD" : "QTY", 110, 36);
        doc.text(language === "pt" ? "ITEM" : "ITEM", 127, 36);
        
        doc.setDrawColor(203, 213, 225);
        doc.line(15, 39, 100, 39);
        doc.line(110, 39, 195, 39);
        
        startY = 45;
      } else {
        // Draw running page header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(titleText + " (" + (language === "pt" ? "Continuação" : "Continued") + ")", 15, 15);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text((language === "pt" ? "Página " : "Page ") + (pageIndex + 1), 195, 15, { align: "right" });
        
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(15, 18, 195, 18);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(language === "pt" ? "QTD" : "QTY", 15, 25);
        doc.text(language === "pt" ? "ITEM" : "ITEM", 32, 25);
        
        doc.text(language === "pt" ? "QTD" : "QTY", 110, 25);
        doc.text(language === "pt" ? "ITEM" : "ITEM", 127, 25);
        
        doc.setDrawColor(203, 213, 225);
        doc.line(15, 28, 100, 28);
        doc.line(110, 28, 195, 28);
        
        startY = 34;
      }
      
      const rowHeight = 12;
      
      // Draw Left Column items
      pageData.left.forEach((item, idx) => {
        const y = startY + idx * rowHeight;
        
        // 1. Draw rounded box for entering quantity (aligned to left of column)
        doc.setDrawColor(148, 163, 184); // slate-400
        doc.setLineWidth(0.4);
        doc.setFillColor(255, 255, 255);
        doc.rect(15, y - 4, 12, 6, "FD");
        
        // 2. Draw item name (bold)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59); // slate-800
        
        let name = item.name;
        if (name.length > 32) {
          name = name.substring(0, 30) + "...";
        }
        doc.text(name, 32, y);
        
        // 3. Draw category underneath
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(item.category.toUpperCase(), 32, y + 4.5);
        
        // 4. Border-bottom style divider line
        doc.setDrawColor(241, 245, 249); // slate-100
        doc.setLineWidth(0.2);
        doc.line(15, y + 6, 100, y + 6);
      });
      
      // Draw Right Column items
      pageData.right.forEach((item, idx) => {
        const y = startY + idx * rowHeight;
        
        // 1. Draw rounded box for entering quantity (aligned to left of column)
        doc.setDrawColor(148, 163, 184); // slate-400
        doc.setLineWidth(0.4);
        doc.setFillColor(255, 255, 255);
        doc.rect(110, y - 4, 12, 6, "FD");
        
        // 2. Draw item name (bold)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59); // slate-800
        
        let name = item.name;
        if (name.length > 32) {
          name = name.substring(0, 30) + "...";
        }
        doc.text(name, 127, y);
        
        // 3. Draw category underneath
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(item.category.toUpperCase(), 127, y + 4.5);
        
        // 4. Border-bottom style divider line
        doc.setDrawColor(241, 245, 249); // slate-100
        doc.setLineWidth(0.2);
        doc.line(110, y + 6, 195, y + 6);
      });
    });

    const fileName = titleText.toLowerCase().replace(/[^a-z0-9]+/g, "_") + "_checklist.pdf";
    doc.save(fileName);
  };

  // Delete historic report doc
  const handleDeleteReport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, "inventory_reports", id));
      if (selectedReportId === id) {
        setSelectedReportId(null);
      }
      if (deleteConfirmId === id) {
        setDeleteConfirmId(null);
      }
    } catch (err) {
      console.error("Failed to delete inventory report:", err);
    }
  };

  // Selected report details resolver
  const detailedReport = useMemo(() => {
    return savedReports.find(r => r.id === selectedReportId) || null;
  }, [savedReports, selectedReportId]);

  // Map of lowercase item name -> latest purchase price
  const lastPurchasePriceMap = useMemo(() => {
    const map = new Map<string, number>();
    const latestDateMap = new Map<string, string>();

    items.forEach(it => {
      const nameKey = it.name.trim().toLowerCase();
      const dateStr = it.purchaseDate || "";
      const price = Number(it.price) || 0;

      if (!map.has(nameKey)) {
        map.set(nameKey, price);
        latestDateMap.set(nameKey, dateStr);
      } else {
        const existingDate = latestDateMap.get(nameKey) || "";
        if (dateStr >= existingDate) {
          map.set(nameKey, price);
          latestDateMap.set(nameKey, dateStr);
        }
      }
    });

    return map;
  }, [items]);

  // Sum of last purchase price * stock quantities for this report
  const detailedReportTotalValue = useMemo(() => {
    if (!detailedReport) return 0;
    return detailedReport.items.reduce((sum, it) => {
      const nameKey = it.name.trim().toLowerCase();
      const lastPrice = lastPurchasePriceMap.get(nameKey) || 0;
      return sum + (lastPrice * (Number(it.quantity) || 0));
    }, 0);
  }, [detailedReport, lastPurchasePriceMap]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-4">
      
      {/* Bento Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100 text-amber-600">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              {language === "pt" ? "Inventário de Estoque" : "Inventory"}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {language === "pt" 
                ? "Controle e auditoria de insumos em estoque"
                : "Auditing and tracking on-hand ingredient volumes"}
            </p>
          </div>
        </div>

        {/* Categories Defined Badge Count */}
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          {selectedCategories.length} {language === "pt" ? "Categorias" : "Categories"}
        </span>
      </div>

      {/* Action triggers grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        {/* Button 1: Settings to Define Categories */}
        <button
          onClick={() => {
            setSaveStatus("idle");
            setActiveModal("settings");
          }}
          className="bg-slate-50 hover:bg-amber-50/70 text-slate-800 hover:text-amber-700 font-bold text-xs py-3 px-4 rounded-xl border border-slate-200/50 hover:border-amber-250 transition-all cursor-pointer flex items-center justify-between group/btn"
        >
          <span className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400 group-hover/btn:text-amber-500 shrink-0" />
            <span>{language === "pt" ? "Configurar Categorias" : "Define Categories"}</span>
          </span>
          <span className="text-[10px] text-amber-600 opacity-40 group-hover/btn:opacity-100">
            →
          </span>
        </button>

        {/* Button 2: Generate Stock Count Report */}
        <button
          onClick={handleOpenGenerate}
          className="bg-slate-50 hover:bg-amber-50/70 text-slate-800 hover:text-amber-700 font-bold text-xs py-3 px-4 rounded-xl border border-slate-200/50 hover:border-amber-250 transition-all cursor-pointer flex items-center justify-between group/btn"
        >
          <span className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-slate-400 group-hover/btn:text-amber-500 shrink-0" />
            <span>{language === "pt" ? "Contar Estoque" : "Generate Report"}</span>
          </span>
          <span className="text-[10px] text-amber-600 opacity-40 group-hover/btn:opacity-100">
            →
          </span>
        </button>

        {/* Button 3: Display Saved Reports */}
        <button
          onClick={() => {
            setActiveModal("history");
            setSelectedReportId(savedReports[0]?.id || null);
          }}
          className="bg-slate-50 hover:bg-amber-50/70 text-slate-800 hover:text-amber-700 font-bold text-xs py-3 px-4 rounded-xl border border-slate-200/50 hover:border-amber-250 transition-all cursor-pointer flex items-center justify-between group/btn"
        >
          <span className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400 group-hover/btn:text-amber-500 shrink-0" />
            <span>{language === "pt" ? "Relatórios Salvos" : "Display Saved"}</span>
          </span>
          <span className="text-[10px] text-amber-600 opacity-40 group-hover/btn:opacity-100">
            ({savedReports.length})
          </span>
        </button>

      </div>

      {/* --- MODAL 1: SETTING CATEGORIES DEFINE --- */}
      {activeModal === "settings" && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 text-base">
                  {language === "pt" ? "Categorias do Inventário" : "Define Report Categories"}
                </h3>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Instruction */}
            <p className="text-xs text-slate-500 mt-4 leading-relaxed bg-slate-50 border border-slate-150 p-3.5 rounded-xl">
              {language === "pt" 
                ? "Marque quais categorias de insumos e matérias-primas devem constar na planilha de contagem de estoque."
                : "Select which categories of products should populate the inventory stock worksheet. Only items tagged with verified choices will appear."}
            </p>

            {/* Selection Grid */}
            <div className="flex-1 overflow-y-auto my-4 pr-1 space-y-1.5 max-h-[40vh] scrollbar-thin">
              {categories.map(cat => {
                const isChecked = selectedCategories.includes(cat);
                return (
                  <label 
                    key={cat} 
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      isChecked 
                        ? "bg-amber-50/40 border-amber-250 font-bold text-amber-900" 
                        : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    <span className="text-xs">{cat}</span>
                    <input 
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleCategory(cat)}
                      className="w-4.5 h-4.5 rounded border-slate-300 text-amber-500 accent-amber-500"
                    />
                  </label>
                );
              })}
            </div>

            {/* Footer triggers */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setSelectedCategories([...categories])}
                className="text-[11px] font-bold text-amber-600 hover:underline cursor-pointer"
              >
                {language === "pt" ? "Selecionar Todas" : "Select All Available"}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {language === "pt" ? "Cancelar" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={saveStatus === "saving"}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1"
                >
                  {saveStatus === "saving" ? (
                    language === "pt" ? "Salvando..." : "Saving..."
                  ) : saveStatus === "success" ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      {language === "pt" ? "Salvo!" : "Saved!"}
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      {language === "pt" ? "Salvar" : "Save Choice"}
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- MODAL 2: GENERATE STOCK SHEET REPORT --- */}
      {activeModal === "generate" && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {language === "pt" ? "Nova Contagem de Estoque" : "New On-Hand Stock Report"}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {language === "pt" ? `Filtro ativo: ${selectedCategories.length} categorias` : `Active filters: ${selectedCategories.length} categories`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Custom Report Custom Title */}
            <div className="mt-4 space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                {language === "pt" ? "Título do Relatório" : "Report Sheet Title Name"}
              </label>
              <input 
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 outline-hidden focus:border-amber-400"
                placeholder="E.g., Morning Stock Count, Fim do Lote..."
                maxLength={100}
              />
            </div>

            {/* List of worksheet inputs */}
            <div className="flex-1 overflow-y-auto my-4 pr-1 scrollbar-thin">
              {targetItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto opacity-70" />
                  <p className="text-xs font-semibold">
                    {language === "pt" ? "Nenhum ingrediente ou item cadastrado nessas categorias" : "No raw ingredients compiled insideselected categories."}
                  </p>
                  <p className="text-[10px] max-w-sm mx-auto opacity-80">
                    {language === "pt" 
                      ? "Certifique-se de que os produtos possuem as categorias selecionadas."
                      : "Add parsed receipts containing targeted items first or adjust the report categories setup."}
                  </p>
                </div>
              ) : (
                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                        <th className="p-3.5">{language === "pt" ? "Item / Matéria-prima" : "Item / Raw Material"}</th>
                        <th className="p-3.5 hidden sm:table-cell">{language === "pt" ? "Categoria" : "Category"}</th>
                        <th className="p-3.5 text-right w-28">{language === "pt" ? "Quantidade" : "Quantity"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {targetItems.map(item => (
                        <tr key={item.name} className="hover:bg-amber-50/10">
                          <td className="p-3 text-slate-850 font-semibold">{item.name}</td>
                          <td className="p-3 hidden sm:table-cell">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/50">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <input 
                              type="number"
                              min="0"
                              step="any"
                              value={stockQuantities[item.name] === 0 ? "" : stockQuantities[item.name]}
                              onChange={(e) => {
                                const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                setStockQuantities(prev => ({
                                  ...prev,
                                  [item.name]: isNaN(val) ? 0 : val
                                }));
                              }}
                              className="w-24 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-right font-mono font-bold text-slate-800 outline-hidden focus:border-amber-400"
                              placeholder="0"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer action */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-medium font-mono">
                {targetItems.length} items logged
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {language === "pt" ? "Descartar" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handlePrintPDF}
                  disabled={targetItems.length === 0}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                  title={language === "pt" ? "Imprimir PDF para preenchimento de contagem" : "Print PDF for manual stock count"}
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  {language === "pt" ? "Imprimir PDF" : "Print PDF"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveReport}
                  disabled={saveStatus === "saving" || targetItems.length === 0}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  {saveStatus === "saving" ? (
                    language === "pt" ? "Salvando..." : "Saving..."
                  ) : saveStatus === "success" ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      {language === "pt" ? "Relatório Salvo!" : "Report Saved!"}
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      {language === "pt" ? "Salvar Relatório" : "Save Report"}
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- MODAL 3: SHOW AND DISPLAY SAVED REPORTS --- */}
      {activeModal === "history" && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-6 shadow-2xl border border-slate-100 flex flex-col md:flex-row gap-6 max-h-[90vh]">
            
            {/* Left Column: Report Logs List */}
            <div className="w-full md:w-80 flex flex-col max-h-[80vh] shrink-0">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-slate-900 text-base">
                    {language === "pt" ? "Contagens Realizadas" : "Saved Reports Archive"}
                  </h3>
                </div>
                <button 
                  onClick={() => setActiveModal(null)}
                  className="md:hidden p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin">
                {savedReports.length === 0 ? (
                  <p className="text-xs text-slate-400 py-12 text-center">
                    {language === "pt" ? "Nenhum relatório de contagem salvo no histórico ainda." : "No saved audit sheets registered yet."}
                  </p>
                ) : (
                  savedReports.map(report => {
                    const isSelected = report.id === selectedReportId;
                    const date = new Date(report.createdAt).toLocaleDateString(language === "pt" ? "pt-BR" : "en-US", {
                      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                    });
                    return (
                      <div
                        key={report.id}
                        onClick={() => setSelectedReportId(report.id)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group ${
                          isSelected 
                            ? "bg-amber-50/30 border-amber-300 shadow-3xs" 
                            : "bg-white hover:bg-slate-50 border-slate-100"
                        }`}
                      >
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 truncate" title={report.title || "Untiled Stock"}>
                            {report.title || (language === "pt" ? "Contagem s/ título" : "Untitled Stock Report")}
                          </h4>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                            <Calendar className="w-3 h-3" />
                            {date}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {deleteConfirmId === report.id ? (
                            <div className="flex items-center gap-0.5 bg-rose-50 border border-rose-100 p-0.5 rounded-xl" onClick={(ev) => ev.stopPropagation()}>
                              <button
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  handleDeleteReport(report.id, ev);
                                }}
                                className="px-2 py-1 text-[9px] font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-all cursor-pointer"
                                title={language === "pt" ? "Confirmar exclusão" : "Confirm delete"}
                              >
                                {language === "pt" ? "Sim" : "Yes"}
                              </button>
                              <button
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setDeleteConfirmId(null);
                                }}
                                className="px-1.5 py-1 text-[9px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-all cursor-pointer"
                                title={language === "pt" ? "Cancelar" : "Cancel"}
                              >
                                {language === "pt" ? "Não" : "No"}
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-150 px-2 py-0.5 rounded-full">
                                {report.items.length} items
                              </span>
                              
                              <button
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setDeleteConfirmId(report.id);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                title={language === "pt" ? "Remover" : "Delete Log"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-0.5 transition-transform hidden sm:block" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Active Log Items Detail View */}
            <div className="flex-1 min-w-0 bg-slate-50 border border-slate-100 rounded-2xl p-4.5 flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-150 mb-3">
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">
                  {language === "pt" ? "Detalhamento da Ficha" : "Audit Sheet Particulars"}
                </span>
                
                <button 
                  onClick={() => setActiveModal(null)}
                  className="hidden md:block p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {detailedReport ? (
                <div className="flex-1 flex flex-col min-h-0 text-xs">
                  {/* Summary params */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-slate-150/80 mb-3">
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-800 break-words text-sm" id="detailed-report-title-label">
                        {detailedReport.title || "Stock Count Detail"}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        ID: {detailedReport.id}
                      </p>
                    </div>
                    <span 
                      id="detailed-report-total-badge"
                      className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-150 font-bold px-2 py-0.5 rounded-full font-sans shadow-sm shrink-0 inline-block text-center self-start sm:self-center"
                    >
                      {language === "pt" ? "Valor Total: " : "Total Value: "}<strong>{formatCurrency(detailedReportTotalValue)}</strong>
                    </span>
                  </div>

                  {/* Stock Levels Lists */}
                  <div className="flex-1 overflow-y-auto pr-0.5 space-y-2 scrollbar-thin min-h-0">
                    {detailedReport.items.map((it, idx) => {
                      const nameKey = it.name.trim().toLowerCase();
                      const lastPrice = lastPurchasePriceMap.get(nameKey) || 0;
                      const totalValue = lastPrice * (Number(it.quantity) || 0);

                      return (
                        <div 
                          key={`${it.name}_${idx}`} 
                          className="flex items-center justify-between border-b border-slate-150/40 pb-1.5 last:border-0"
                          id={`audit-item-${idx}`}
                        >
                          <div className="min-w-0 pr-2 flex-1">
                            <p className="font-semibold text-slate-700 truncate" title={it.name}>
                              {it.name}
                            </p>
                            <span 
                              id={`audit-item-value-${idx}`}
                              className="text-[9px] text-slate-500 font-medium"
                            >
                              {formatCurrency(lastPrice)} × {it.quantity} = <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatCurrency(totalValue)}</strong>
                            </span>
                          </div>
                          <div className="text-right font-mono shrink-0">
                            <span className="font-bold text-slate-800 bg-amber-500/10 text-amber-850 px-2.5 py-0.5 rounded-md border border-amber-300/30 text-xs text-right">
                              {it.quantity}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Spreadsheet integration placeholder details banner */}
                  <div className="bg-emerald-50/50 border border-emerald-150 p-2.5 rounded-xl flex items-start gap-1.5 text-[10px] text-emerald-700 font-medium leading-relaxed mt-4">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-650 mt-0.5 shrink-0" />
                    <p>
                      {language === "pt" 
                        ? "Essa contagem foi sincronizada do banco de dados em tempo real com segurança."
                        : "Stock assets logged dynamically to direct storage archives."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center text-slate-400 py-12">
                  <ClipboardList className="w-10 h-10 text-slate-300 mb-2 animate-none" />
                  <p className="text-xs">
                    {language === "pt" ? "Selecione um lote para ver" : "Select an audit instance to browse detailed quantities."}
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
