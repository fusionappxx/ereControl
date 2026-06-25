import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, 
  Search, 
  TrendingUp, 
  Calendar, 
  ChevronRight,
  FileText,
  User,
  ShoppingBag,
  Clock,
  Coins,
  Store,
  ArrowUpDown,
  Tag,
  Pencil,
  Check,
  X
} from "lucide-react";
import { ReceiptItem } from "../types";
import { formatCurrency } from "../utils";

interface UniqueInvoicesScreenProps {
  items: ReceiptItem[];
  language: "en" | "pt";
  onBack: () => void;
  onViewItemDetails?: (productName: string) => void;
  onUpdateInvoiceDate?: (itemsToUpdate: ReceiptItem[], newDate: string) => Promise<void>;
}

interface InvoiceGroup {
  id: string; // Internal unique ID for grouping
  invoiceNumber: string;
  storeName: string;
  purchaseDate: string;
  itemCount: number;
  totalValue: number;
  items: ReceiptItem[];
}

export default function UniqueInvoicesScreen({
  items,
  language,
  onBack,
  onViewItemDetails,
  onUpdateInvoiceDate
}: UniqueInvoicesScreenProps) {
  const isPt = language === "pt";
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"date" | "totalValue" | "itemCount" | "storeName" | "invoiceNumber">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [openDateTooltipId, setOpenDateTooltipId] = useState<string | null>(null);

  // Editing state for the selected invoice purchase date
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editingDateValue, setEditingDateValue] = useState("");

  // Group items by invoice properties
  const invoicesList = useMemo(() => {
    const groups: Record<string, ReceiptItem[]> = {};
    
    items.forEach(item => {
      const invNum = item.invoiceNumber?.trim() || "";
      const hasInvoice = invNum !== "" && invNum.toLowerCase() !== "n/a";
      
      // Group key: if has valid invoice, group by invoice number.
      // Otherwise group by (purchaseDate + storeName) to separate distinct physical shopping trips
      const key = hasInvoice 
        ? `inv_${invNum.toLowerCase()}` 
        : `receipt_${item.purchaseDate}_${item.storeName.trim().toLowerCase()}`;
        
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });
    
    return Object.entries(groups).map(([key, groupItems]) => {
      const firstItem = groupItems[0];
      const invNum = firstItem.invoiceNumber?.trim() || "";
      const isNA = !invNum || invNum.toLowerCase() === "n/a";
      const invoiceNumber = isNA ? "N/A" : invNum;
      const storeName = firstItem.storeName || (isPt ? "Loja Desconhecida" : "Unknown Store");
      const purchaseDate = firstItem.purchaseDate || "";
      
      // Sum the line quantity of items
      const itemCount = groupItems.reduce((sum, itm) => sum + (Number(itm.quantity) || 0), 0);
      // Sum (quantity * price)
      const totalValue = groupItems.reduce((sum, itm) => sum + ((Number(itm.quantity) || 0) * (Number(itm.price) || 0)), 0);
      
      return {
        id: key,
        invoiceNumber,
        storeName,
        purchaseDate,
        itemCount,
        totalValue,
        items: groupItems
      };
    });
  }, [items, isPt]);

  // Apply search query filter (matches invoice number, store name, or date)
  const filteredInvoices = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return invoicesList;
    
    return invoicesList.filter(inv => {
      return (
        inv.invoiceNumber.toLowerCase().includes(query) ||
        inv.storeName.toLowerCase().includes(query) ||
        inv.purchaseDate.includes(query)
      );
    });
  }, [invoicesList, searchQuery]);

  // Apply reactive sorting
  const sortedInvoices = useMemo(() => {
    const list = [...filteredInvoices];
    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          comparison = new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime();
          break;
        case "totalValue":
          comparison = a.totalValue - b.totalValue;
          break;
        case "itemCount":
          comparison = a.itemCount - b.itemCount;
          break;
        case "storeName":
          comparison = a.storeName.localeCompare(b.storeName);
          break;
        case "invoiceNumber":
          comparison = a.invoiceNumber.localeCompare(b.invoiceNumber);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return list;
  }, [filteredInvoices, sortField, sortDirection]);

  // Handle Sort Toggle
  const triggerSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc"); // Default to desc for metrics, a-z for strings in practical sense
    }
  };

  // Find the active selected invoice object
  const selectedInvoice = useMemo(() => {
    return invoicesList.find(inv => inv.id === selectedInvoiceId) || null;
  }, [invoicesList, selectedInvoiceId]);

  // Synchronize editing value with active invoice date
  useEffect(() => {
    setIsEditingDate(false);
    if (selectedInvoice) {
      setEditingDateValue(selectedInvoice.purchaseDate || "");
    }
  }, [selectedInvoiceId, selectedInvoice]);

  return (
    <div className="space-y-6">
      {/* Top Header Row with Navigate Back Button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 active:bg-slate-100 dark:active:bg-slate-700 rounded-xl transition-all shadow-3xs cursor-pointer flex items-center justify-center"
            title={isPt ? "Voltar para Início" : "Return to Home"}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {isPt ? "Painel de Notas Fiscais" : "Registered Invoices Database"}
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {isPt 
                ? "Resumo detalhado por cupons, valores de compras, estabelecimentos e itens importados"
                : "A granular aggregation of store trips, invoice receipts, total quantities, and expenditure"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Layout Block */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Invoice Catalog and Filter Layout */}
        <div className={`space-y-4 col-span-12 ${selectedInvoiceId ? "xl:col-span-7 hidden xl:block" : "xl:col-span-12 block"}`}>
          {/* Action Bar (Search & Sorts Selector) */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-550 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                aria-label={isPt ? "Buscar notas..." : "Search invoices..."}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isPt ? "Buscar por nota, mercado ou data..." : "Search by invoice#, store, date..."}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-violet-500 focus:border-violet-500 focus:outline-hidden placeholder-slate-400"
              />
            </div>
            
            {/* Sort Controls dropdown for mobile, but also usable directly */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/40 p-1 rounded-xl border border-slate-100 dark:border-slate-800/60">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase px-2">
                {isPt ? "Odernar:" : "Sort:"}
              </span>
              <div className="flex gap-0.5">
                {[
                  { field: "date" as const, label: isPt ? "Data" : "Date" },
                  { field: "totalValue" as const, label: isPt ? "Total" : "Total" },
                  { field: "itemCount" as const, label: isPt ? "Quant." : "Qty" }
                ].map((option) => (
                  <button
                    key={option.field}
                    onClick={() => triggerSort(option.field)}
                    className={`text-[11px] font-semibold px-2 py-1 rounded-lg transition-all cursor-pointer ${
                      sortField === option.field 
                        ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-3xs" 
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-350"
                    }`}
                  >
                    {option.label}
                    {sortField === option.field && (
                      <span className="ml-1 text-[9px]">{sortDirection === "asc" ? "▲" : "▼"}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Invoices Grid / Table Container */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-2xs">
            {sortedInvoices.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {isPt ? "Nenhuma nota fiscal registrada sob os critérios de busca." : "No registered invoices matched your search criteria."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-25/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider select-none">
                      <th className="px-5 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" onClick={() => triggerSort("invoiceNumber")}>
                        <div className="flex items-center gap-1">
                          {isPt ? "Nota Fiscal" : "Invoice #"}
                          <ArrowUpDown className="w-3 h-3 text-slate-350" />
                        </div>
                      </th>
                      <th className="px-5 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" onClick={() => triggerSort("storeName")}>
                        <div className="flex items-center gap-1">
                          {isPt ? "Estabelecimento" : "Establishment"}
                          <ArrowUpDown className="w-3 h-3 text-slate-350" />
                        </div>
                      </th>
                      <th className="px-5 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" onClick={() => triggerSort("date")}>
                        <div className="flex items-center gap-1">
                          {isPt ? "Data" : "Date"}
                          <ArrowUpDown className="w-3 h-3 text-slate-350" />
                        </div>
                      </th>
                      <th className="px-5 py-3 text-right cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" onClick={() => triggerSort("itemCount")}>
                        <div className="flex items-center justify-end gap-1">
                          {isPt ? "Itens" : "Items"}
                          <ArrowUpDown className="w-3 h-3 text-slate-350" />
                        </div>
                      </th>
                      <th className="px-5 py-3 text-right cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" onClick={() => triggerSort("totalValue")}>
                        <div className="flex items-center justify-end gap-1">
                          {isPt ? "Valor Total" : "Total Value"}
                          <ArrowUpDown className="w-3 h-3 text-slate-350" />
                        </div>
                      </th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60 dark:divide-slate-800/40 text-[12px]">
                    {sortedInvoices.map((inv) => {
                      const isActive = inv.id === selectedInvoiceId;
                      const formattedDate = inv.purchaseDate;
                      
                      return (
                        <tr
                          key={inv.id}
                          onClick={() => setSelectedInvoiceId(inv.id)}
                          className={`hover:bg-slate-25/40 dark:hover:bg-slate-800/20 transition-all cursor-pointer ${
                            isActive 
                              ? "bg-violet-25/50 border-l-2 border-l-violet-500 border-y border-slate-100/80 dark:bg-violet-950/15" 
                              : ""
                          }`}
                        >
                          {/* Invoice Reference Column */}
                          <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100">
                            {inv.invoiceNumber === "N/A" ? (
                              <span className="text-[10px] bg-slate-50 text-slate-400 px-2 py-0.5 rounded-md font-mono font-medium">Standard Receipt</span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">#{inv.invoiceNumber}</span>
                              </div>
                            )}
                          </td>
                          {/* Store Name */}
                          <td className="px-5 py-3.5 ">
                            <div className="flex items-center gap-1.5 min-w-0 max-w-[180px] sm:max-w-[260px]">
                              <Store className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span className="truncate font-medium text-slate-700 dark:text-slate-250 font-sans" title={inv.storeName}>
                                {inv.storeName}
                              </span>
                            </div>
                          </td>
                          {/* Date */}
                          <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{formattedDate}</span>
                            </div>
                          </td>
                          {/* Quantity */}
                          <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                            {Number(inv.itemCount).toFixed(2)} <span className="text-[10px] font-medium text-slate-400 font-sans">{isPt ? "un" : "it"}</span>
                          </td>
                          {/* Total Price */}
                          <td className="px-5 py-3.5 text-right font-mono font-extrabold text-slate-900 dark:text-slate-100">
                            {formatCurrency(inv.totalValue)}
                          </td>
                          {/* Chevron */}
                          <td className="px-3 py-3.5 text-right shrink-0">
                            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isActive ? "rotate-90 text-violet-500" : ""}`} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Side / Toggle Mode Cover: Selected Invoice Itemized Details */}
        <div className={`col-span-12 xl:col-span-5 ${selectedInvoiceId ? "block" : "hidden"}`}>
          <AnimatePresence mode="wait">
            {!selectedInvoice ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full bg-slate-25/40 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[300px]"
              >
                <div className="bg-slate-100 dark:bg-slate-850 p-4 rounded-full text-slate-400 mb-4 shadow-3xs border border-white dark:border-slate-800">
                  <FileText className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                  {isPt ? "Selecione uma Nota Fiscal" : "Inspect Invoice Details"}
                </h3>
                <p className="text-[11px] text-slate-400 max-w-[260px] leading-relaxed mt-1.5">
                  {isPt
                    ? "Clique em qualquer linha do histórico para carregar a nota de compras e auditar a lista de itens, valores e tags."
                    : "Select a transaction row to view detailed item breakdown, unit prices, category allocations, and original scan profiles."}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={selectedInvoice.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18 }}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4"
              >
                {/* Mobile Back to List Toggle Arrow */}
                <div className="flex items-center justify-between xl:hidden">
                  <button
                    onClick={() => setSelectedInvoiceId(null)}
                    className="text-xs font-bold text-violet-600 hover:text-violet-750 flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/45 rounded-xl cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    {isPt ? "Voltar para Lista de Notas" : "Back to Invoices List"}
                  </button>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {isPt ? "Detalhes do Cupom" : "Receipt Details"}
                  </span>
                </div>

                {/* Profile Header for Active Selected Receipt */}
                <div className="bg-slate-25/60 dark:bg-slate-850/30 p-4 rounded-xl border border-slate-100/50 dark:border-slate-800/60 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        {selectedInvoice.invoiceNumber === "N/A" ? (isPt ? "Cupom Comum" : "Standard Receipt") : (isPt ? "Número da Nota" : "Invoice ID")}
                      </p>
                      <h3 className="font-mono text-base font-extrabold text-slate-850 dark:text-slate-150 leading-tight mt-0.5 break-all">
                        {selectedInvoice.invoiceNumber === "N/A" ? (isPt ? "Sem Identificador" : "Unnumbered") : `#${selectedInvoice.invoiceNumber}`}
                      </h3>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-100/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                        {isPt ? "Registrada" : "Stored"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-100/50 dark:border-slate-800/30">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight block">
                        {isPt ? "Local" : "Establishment"}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 block truncate">
                        {selectedInvoice.storeName}
                      </span>
                    </div>
                     <div>
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight block">
                        {isPt ? "Data de Aquisição" : "Date Acquired"}
                      </span>
                      {isEditingDate ? (
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type="date"
                            value={editingDateValue}
                            onChange={(e) => setEditingDateValue(e.target.value)}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs rounded-lg p-1 focus:ring-1 focus:ring-violet-500 focus:outline-hidden w-28 font-mono select-none"
                          />
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (onUpdateInvoiceDate && selectedInvoice) {
                                await onUpdateInvoiceDate(selectedInvoice.items, editingDateValue);
                              }
                              setIsEditingDate(false);
                            }}
                            className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0"
                            title={isPt ? "Salvar" : "Save"}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsEditingDate(false);
                              setEditingDateValue(selectedInvoice.purchaseDate || "");
                            }}
                            className="p-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0"
                            title={isPt ? "Cancelar" : "Cancel"}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                            {selectedInvoice.purchaseDate}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDateValue(selectedInvoice.purchaseDate || "");
                              setIsEditingDate(true);
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer flex items-center justify-center"
                            title={isPt ? "Editar data" : "Edit date"}
                          >
                            <Pencil className="w-3 h-3 text-slate-400 hover:text-violet-500" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Invoice Stats Aggregate Panel */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-25/25 border border-slate-100/60 dark:border-slate-800/45 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">{isPt ? "Soma de Itens" : "Total Quantities"}</p>
                    <p className="text-sm font-bold text-slate-850 dark:text-slate-150 font-mono mt-1">{Number(selectedInvoice.itemCount).toFixed(2)} un</p>
                  </div>
                  <div className="bg-slate-25/25 border border-slate-100/60 dark:border-slate-800/45 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">{isPt ? "Custo total" : "Consumed Spend"}</p>
                    <p className="text-sm font-extrabold text-violet-600 dark:text-violet-400 font-mono mt-1">{formatCurrency(selectedInvoice.totalValue)}</p>
                  </div>
                </div>

                {/* Specific List of Items inside the active selected Invoice */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">
                      {isPt 
                        ? `Lista de Itens (${selectedInvoice.items.length} fileiras)`
                        : `Itemized Purchase rows (${selectedInvoice.items.length})`}
                    </h4>
                  </div>
                  
                  <div className="border border-slate-100 dark:border-slate-800/80 rounded-xl overflow-hidden max-h-[340px] overflow-y-auto scrollbar-thin divide-y divide-slate-100 dark:divide-slate-800/50">
                    {selectedInvoice.items.map((itm) => {
                      const rowTotal = (Number(itm.quantity) || 0) * (Number(itm.price) || 0);
                      const originalScannedName = itm.originalName || null;
                      
                      return (
                        <div key={itm.id} className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-25/30 transition-all">
                          <div className="flex items-start justify-between gap-3">
                            {/* Product Name & details */}
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => onViewItemDetails && onViewItemDetails(itm.name)}
                                className="text-left font-bold text-slate-800 dark:text-slate-100 font-sans hover:text-violet-600 dark:hover:text-violet-400 cursor-pointer block leading-tight truncate w-full"
                                title={isPt ? "Clique para gerenciar este item" : "Click to manage this item's profiling"}
                              >
                                {itm.name}
                              </button>
                              
                              {originalScannedName && originalScannedName.trim().toLowerCase() !== itm.name.trim().toLowerCase() && (
                                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 truncate" title={`Scanned originally as: ${originalScannedName}`}>
                                  {isPt ? "Escaneado como:" : "Scanned as:"} <span className="italic">{originalScannedName}</span>
                                </p>
                              )}
                              
                              <div className="flex items-center gap-1.5 mt-2">
                                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                                  {itm.category || "Other"}
                                </span>
                                <span className="text-slate-300 dark:text-slate-800">•</span>
                                <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400">
                                  {Number(itm.quantity).toFixed(2)} x {formatCurrency(itm.price)}
                                </span>
                              </div>
                            </div>
                            
                            {/* Row total price */}
                            <div className="text-right shrink-0">
                              <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">
                                {formatCurrency(rowTotal)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Close Detailed Side panel button (Only block on desktop for aesthetic completeness) */}
                <div className="hidden xl:block pt-1.5">
                  <button
                    onClick={() => setSelectedInvoiceId(null)}
                    type="button"
                    className="w-full bg-slate-50 border border-slate-100 hover:bg-slate-100 dark:bg-slate-800/40 dark:border-slate-800 hover:dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-[11px] py-1.5 rounded-xl cursor-pointer transition-all"
                  >
                    {isPt ? "Esconder Visualização Detalhada" : "Close Detailed Inspector"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
