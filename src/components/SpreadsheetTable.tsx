import React, { useState, useMemo, useRef } from "react";
import { 
  Plus, 
  Trash2, 
  FileSpreadsheet, 
  Download, 
  Upload,
  Search, 
  Filter, 
  RefreshCw, 
  Check, 
  Calendar,
  AlertCircle,
  Pencil,
  X,
  ArrowLeft,
  Tag
} from "lucide-react";
import { ReceiptItem } from "../types";
import { formatCurrency, exportToCSV, getGlobalCurrency, fileCSVToItems } from "../utils";

interface SpreadsheetTableProps {
  items: ReceiptItem[];
  onItemUpdate: (id: string, updatedFields: Partial<ReceiptItem>) => void;
  onItemDelete: (id: string) => void;
  onItemAdd: (newItemData?: Omit<ReceiptItem, 'id'>) => void;
  onClearAll: () => void;
  onImportCSV: (importedItems: Omit<ReceiptItem, 'id'>[]) => void;
  onLoadDemo: () => void;
  categories: string[];
  onViewItemDetails: (item: ReceiptItem) => void;
  language?: "en" | "pt";
  onBack: () => void;
  onManageCategories?: () => void;
}

export default function SpreadsheetTable({
  items,
  onItemUpdate,
  onItemDelete,
  onItemAdd,
  onClearAll,
  onImportCSV,
  onLoadDemo,
  categories,
  onViewItemDetails,
  language = "en",
  onBack,
  onManageCategories,
}: SpreadsheetTableProps) {
  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStore, setSelectedStore] = useState("All");

  // Local Sort state
  const [sortBy, setSortBy] = useState<"name" | "price" | "date" | "total">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Sort categories alphabetically, with "Other" / "Outro" last
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const isOtherA = a.trim().toLowerCase() === "other" || a.trim().toLowerCase() === "outro";
      const isOtherB = b.trim().toLowerCase() === "other" || b.trim().toLowerCase() === "outro";
      if (isOtherA && !isOtherB) return 1;
      if (!isOtherA && isOtherB) return -1;
      return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
    });
  }, [categories]);
  
  // Clear confirmation and file import refs
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Manual Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItemForModal, setEditingItemForModal] = useState<ReceiptItem | null>(null);
  const [addForm, setAddForm] = useState({
    name: "",
    quantity: 1,
    price: "",
    category: "",
    storeName: "",
    invoiceNumber: "",
    purchaseDate: new Date().toISOString().split("T")[0],
  });

  const handleOpenAddModal = () => {
    setEditingItemForModal(null);
    setAddForm({
      name: "",
      quantity: 1,
      price: "",
      category: sortedCategories[0] || "Produce",
      storeName: items[0]?.storeName || "Local Grocer",
      invoiceNumber: "",
      purchaseDate: new Date().toISOString().split("T")[0],
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (item: ReceiptItem) => {
    setEditingItemForModal(item);
    setAddForm({
      name: item.name,
      quantity: item.quantity,
      price: item.price === 0 ? "" : String(item.price),
      category: item.category || sortedCategories[0] || "Produce",
      storeName: item.storeName || "",
      invoiceNumber: item.invoiceNumber || "",
      purchaseDate: item.purchaseDate || new Date().toISOString().split("T")[0],
    });
    setIsAddModalOpen(true);
  };

  const handleSaveManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim()) return;

    if (editingItemForModal) {
      onItemUpdate(editingItemForModal.id, {
        name: addForm.name.trim(),
        quantity: Math.max(1, Number(addForm.quantity) || 1),
        price: Math.max(0, parseFloat(addForm.price) || 0),
        category: addForm.category || sortedCategories[0] || "Produce",
        storeName: addForm.storeName.trim() || "Local Grocer",
        invoiceNumber: addForm.invoiceNumber.trim() || "",
        purchaseDate: addForm.purchaseDate || new Date().toISOString().split("T")[0],
      });
    } else {
      onItemAdd({
        name: addForm.name.trim(),
        quantity: Math.max(1, Number(addForm.quantity) || 1),
        price: Math.max(0, parseFloat(addForm.price) || 0),
        category: addForm.category || sortedCategories[0] || "Produce",
        storeName: addForm.storeName.trim() || "Local Grocer",
        invoiceNumber: addForm.invoiceNumber.trim() || "",
        purchaseDate: addForm.purchaseDate || new Date().toISOString().split("T")[0],
      });
    }

    setIsAddModalOpen(false);
    setEditingItemForModal(null);
  };

  // Get list of unique stores in current spreadsheet list
  const uniqueStores = useMemo(() => {
    const stores = new Set<string>();
    items.forEach(item => {
      if (item.storeName && item.storeName.trim()) {
        stores.add(item.storeName.trim());
      }
    });
    return Array.from(stores);
  }, [items]);

  // Filter and Sort items
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(term) || 
        item.storeName.toLowerCase().includes(term)
      );
    }

    // Category filter
    if (selectedCategory !== "All") {
      result = result.filter(item => item.category === selectedCategory);
    }

    // Store filter
    if (selectedStore !== "All") {
      result = result.filter(item => item.storeName.trim() === selectedStore);
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortBy === "total" ? "price" : sortBy];
      let valB: any = b[sortBy === "total" ? "price" : sortBy];

      if (sortBy === "total") {
        valA = a.quantity * a.price;
        valB = b.quantity * b.price;
      }

      if (typeof valA === "string") {
        return sortDirection === "asc" 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }
    });

    return result;
  }, [items, searchTerm, selectedCategory, selectedStore, sortBy, sortDirection]);

  // Calculations for Footer
  const calculations = useMemo(() => {
    let totalItemsCount = 0;
    let totalCost = 0;

    filteredAndSortedItems.forEach(item => {
      totalItemsCount += Number(item.quantity) || 0;
      totalCost += (Number(item.quantity) || 0) * (Number(item.price) || 0);
    });

    return {
      totalItemsCount,
      totalCost
    };
  }, [filteredAndSortedItems]);

  // Change sort configuration
  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDirection("desc");
    }
  };

  const handleCSVImportClick = () => {
    csvInputRef.current?.click();
  };

  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        try {
          const parsed = fileCSVToItems(text);
          if (parsed.length > 0) {
            onImportCSV(parsed);
          }
        } catch (err) {
          console.error("Failed to parse CSV file", err);
        }
      }
      // Reset input value so same file can be selected again
      if (csvInputRef.current) csvInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    exportToCSV(items);
  };

  return (
    <div className="space-y-6">
      {/* Standardized Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 active:bg-slate-100 rounded-xl transition-all shadow-3xs cursor-pointer flex items-center justify-center animate-fade-in"
            title={language === "pt" ? "Voltar ao Início" : "Back to Home"}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-5.5 h-5.5 text-emerald-600" />
              <span>{language === "pt" ? "Planilha de Itens de Compras" : "Grocery Spreadsheet"}</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {language === "pt" 
                ? "Painel interativo para edição em massa de notas fiscais, quantidades, categorias e valores."
                : "Interactive spreadsheet to view, bulk-edit, and manage grocery items, quantities, categories, and totals."}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full">
        {/* Spreadsheet Operations Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-xs text-slate-500 font-semibold">
            {language === "pt"
              ? `Exibindo ${filteredAndSortedItems.length} de ${items.length} itens cadastrados.`
              : `Displaying ${filteredAndSortedItems.length} of ${items.length} items. All cells are interactive.`}
          </div>

          <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenAddModal}
            className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> {language === "pt" ? "Adicionar Item" : "Add Row"}
          </button>
          
          <button
            onClick={handleExport}
            disabled={items.length === 0}
            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export to CSV
          </button>

          <input
            type="file"
            ref={csvInputRef}
            onChange={handleCSVFileChange}
            accept=".csv"
            className="hidden"
          />

          <button
            onClick={handleCSVImportClick}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" /> Import CSV
          </button>

          {onManageCategories && (
            <button
              onClick={onManageCategories}
              className="bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5 text-violet-600" /> {language === "pt" ? "Categorias & Automação" : "Categories & Automation"}
            </button>
          )}

          {showClearConfirm ? (
            <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg p-1 select-none">
              <span className="text-[10.5px] font-bold text-rose-700 px-1">Clear all items?</span>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setShowClearConfirm(false);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              >
                Yes, Clear
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10.5px] font-semibold px-2 py-1 rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={items.length === 0}
              className="border border-slate-200 hover:bg-rose-50/50 hover:border-rose-200 disabled:opacity-50 text-slate-700 hover:text-rose-600 text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              Clear Sheet
            </button>
          )}

          {items.length === 0 && (
            <button
              onClick={onLoadDemo}
              className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Load Demo Data
            </button>
          )}
        </div>
      </div>

      {/* Spreadsheet Search and Filtering Filters */}
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3 bg-white">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search items or stores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
          />
        </div>

        <div className="flex items-center gap-2 min-w-[150px]">
          <span className="text-slate-500 text-[11px] font-medium shrink-0">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full border border-slate-200 rounded-lg py-1.5 px-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          >
            <option value="All">All Categories</option>
            {sortedCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 min-w-[150px]">
          <span className="text-slate-500 text-[11px] font-medium shrink-0">Store:</span>
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="w-full border border-slate-200 rounded-lg py-1.5 px-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          >
            <option value="All">All Stores</option>
            {uniqueStores.map(store => (
              <option key={store} value={store}>{store}</option>
            ))}
          </select>
        </div>

        {(searchTerm || selectedCategory !== "All" || selectedStore !== "All") && (
          <button
            onClick={() => {
              setSearchTerm("");
              setSelectedCategory("All");
              setSelectedStore("All");
            }}
            className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 hover:underline transition-colors ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-x-auto min-h-[350px]">
        {filteredAndSortedItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/20">
            <AlertCircle className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-700">No items found matching the selected filters.</p>
            <p className="text-xs text-slate-400 mt-1">Try expanding your search query or clear filters above.</p>
            {items.length === 0 && (
              <button
                onClick={onItemAdd}
                className="mt-4 bg-white border border-slate-200 text-emerald-600 hover:bg-emerald-50/50 hover:border-emerald-200 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Create First Item
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-collapse table-fixed select-text">
            {/* Headers */}
            <thead className="bg-white border-b border-slate-200/60 text-slate-600 text-[11px] font-semibold tracking-wider sticky top-0 z-10 select-none">
              <tr>
                <th className="w-[76%] px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort("name")}>
                  Item Description {sortBy === "name" && (sortDirection === "asc" ? "▲" : "▼")}
                </th>
                <th className="w-[14%] px-5 py-3 cursor-pointer hover:bg-slate-50 text-right transition-colors" onClick={() => handleSort("price")}>
                  Unit Price {sortBy === "price" && (sortDirection === "asc" ? "▲" : "▼")}
                </th>
                <th className="w-[10%] px-3 py-3 text-center">Action</th>
              </tr>
            </thead>
            {/* Rows */}
            <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
              {filteredAndSortedItems.map((item) => {
                return (
                  <tr key={item.id} className="hover:bg-slate-50/60 focus-within:bg-slate-50 transition-colors">
                    {/* Item Description, with Date and Store below it */}
                    <td className="px-5 py-3 bg-white focus-within:ring-1 focus-within:ring-emerald-500">
                      <div className="flex flex-col gap-1">
                        {editingItemId === item.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => onItemUpdate(item.id, { name: e.target.value })}
                              onBlur={() => setEditingItemId(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  setEditingItemId(null);
                                }
                              }}
                              autoFocus
                              className="w-full px-2 py-1 focus:outline-hidden border-0 bg-transparent text-xs font-bold text-slate-850"
                              placeholder="Item name..."
                            />
                            <button
                              type="button"
                              onClick={() => setEditingItemId(null)}
                              className="p-1 text-emerald-600 hover:bg-emerald-55 rounded cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group min-h-[28px]">
                            <button
                              type="button"
                              onClick={() => onViewItemDetails(item)}
                              className="text-slate-800 font-bold hover:text-emerald-600 transition-colors text-left truncate flex-1 hover:underline cursor-pointer"
                              title="Click to view details and cost analysis screen"
                            >
                              {item.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItemId(item.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 rounded-xs transition-opacity hover:bg-slate-50 cursor-pointer ml-1.5 shrink-0"
                              title="Edit Name"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        {/* Date below description */}
                        <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <input
                            type="date"
                            value={item.purchaseDate}
                            onChange={(e) => onItemUpdate(item.id, { purchaseDate: e.target.value })}
                            className="bg-transparent border-0 p-0 text-[10.5px] text-slate-400 dark:text-slate-500 focus:outline-hidden cursor-pointer w-[110px]"
                            title="Edit Purchase Date"
                          />
                          {item.storeName && (
                            <span className="text-[10px] text-slate-400 select-none font-sans hidden sm:inline truncate max-w-[150px]">
                              • {item.storeName}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Unit Price (Editable) */}
                    <td className="px-5 py-3 bg-white focus-within:ring-1 focus-within:ring-emerald-500 text-right">
                      <div className="flex items-center justify-end font-mono">
                        <span className="text-slate-400 text-[10.5px] select-none mr-0.5">
                          {getGlobalCurrency() === "BRL" ? "R$" : getGlobalCurrency() === "EUR" ? "€" : "$"}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price === 0 ? "" : item.price}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            onItemUpdate(item.id, { price: val });
                          }}
                          className="w-20 px-1 py-1.5 text-right border-0 bg-transparent focus:outline-hidden font-semibold text-slate-800"
                          placeholder="0.00"
                        />
                      </div>
                    </td>

                    {/* Action Bar */}
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="text-slate-400 hover:text-amber-500 active:text-amber-600 hover:bg-amber-50 p-1.5 rounded-lg transition-all cursor-pointer"
                          title={language === "pt" ? "Editar item" : "Edit item details"}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onItemDelete(item.id)}
                          className="text-slate-400 hover:text-rose-500 active:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all cursor-pointer"
                          title={language === "pt" ? "Excluir linha" : "Delete spreadsheet row"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Grid Summary Footer Bar */}
      <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <span className="text-slate-400 font-medium">Spreadsheet Summary</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Total Items Count:</span>
            <span className="font-semibold font-mono bg-slate-800 text-emerald-400 px-2.0 py-0.5 rounded text-xs">
              {calculations.totalItemsCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-sans">
            <span className="text-slate-400">{language === "pt" ? "Valor Total Acumulado:" : "Grand Total Spent:"}</span>
            <span className="font-semibold font-mono bg-slate-800 text-emerald-400 px-2 py-0.5 rounded text-xs text-base">
              {formatCurrency(calculations.totalCost)}
            </span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 italic font-sans">
          {language === "pt" 
            ? "As alterações são sincronizadas na nuvem e as fórmulas de totais autolimpantes são recalculadas." 
            : "Changes are persisted to cloud; grand totals auto-refresh instantly."}
        </div>
      </div>

      {/* Manual Add Item Modal */}
      {isAddModalOpen && (
        <div id="add-manual-item-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                {editingItemForModal ? (
                  <Pencil className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Plus className="w-5 h-5 text-emerald-500" />
                )}
                <h3 className="font-bold text-slate-900 text-base">
                  {editingItemForModal
                    ? (language === "pt" ? "Editar Detalhes do Item" : "Edit Item Details")
                    : (language === "pt" ? "Adicionar Item Manual" : "Add Row Manually")}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveManualItem} className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              {/* Name */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  {language === "pt" ? "Nome *" : "Name *"}
                </label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder={language === "pt" ? "Ex: Leite Integral" : "e.g. Whole Milk"}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-hidden transition-all font-semibold"
                />
              </div>

              {/* Grid 2 Columns for Quantity and Price/Value */}
              <div className="grid grid-cols-2 gap-4">
                {/* Quantity */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {language === "pt" ? "Quantidade" : "Quantity"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={addForm.quantity}
                    onChange={(e) => setAddForm({ ...addForm, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-hidden transition-all font-mono font-semibold"
                  />
                </div>

                {/* Price (labeled as 'Value') */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {language === "pt" ? "Valor Unitário" : "Value (Price)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={addForm.price}
                    onChange={(e) => setAddForm({ ...addForm, price: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-hidden transition-all font-mono font-semibold"
                  />
                </div>
              </div>

              {/* Grid 2 Columns for Category and Store */}
              <div className="grid grid-cols-2 gap-4">
                {/* Category selector */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {language === "pt" ? "Categoria" : "Category"}
                  </label>
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-hidden transition-all font-semibold"
                  >
                    {sortedCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Store */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {language === "pt" ? "Loja / Estabelecimento" : "Store"}
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.storeName}
                    onChange={(e) => setAddForm({ ...addForm, storeName: e.target.value })}
                    placeholder={language === "pt" ? "Nome do mercado" : "Store name"}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-hidden transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Grid 2 Columns for Invoice Number and Purchase Date */}
              <div className="grid grid-cols-2 gap-4">
                {/* Invoice Number */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {language === "pt" ? "Número da Nota (Invoice)" : "Invoice Number"}
                  </label>
                  <input
                    type="text"
                    value={addForm.invoiceNumber}
                    onChange={(e) => setAddForm({ ...addForm, invoiceNumber: e.target.value })}
                    placeholder={language === "pt" ? "Opcional" : "Optional"}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-hidden transition-all font-mono font-semibold"
                  />
                </div>

                {/* Purchase Date */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {language === "pt" ? "Data da Compra" : "Purchase Date"}
                  </label>
                  <input
                    type="date"
                    required
                    value={addForm.purchaseDate}
                    onChange={(e) => setAddForm({ ...addForm, purchaseDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-hidden transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all shadow-2xs cursor-pointer text-center"
                >
                  {language === "pt" ? "Cancelar" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer text-center"
                >
                  {editingItemForModal
                    ? (language === "pt" ? "Salvar Alterações" : "Save Changes")
                    : (language === "pt" ? "Adicionar Item" : "Add Item")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
