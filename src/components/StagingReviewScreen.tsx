import React, { useMemo, useState } from "react";
import { 
  CheckCircle, 
  Trash2, 
  Plus, 
  Store, 
  Calendar, 
  FileText, 
  AlertTriangle, 
  X,
  FileSpreadsheet,
  Coins
} from "lucide-react";
import { ReceiptItem } from "../types";
import { formatCurrency, generateId, safeStorage } from "../utils";

interface StagingReviewScreenProps {
  stagedItems: ReceiptItem[];
  categories: string[];
  language: "en" | "pt";
  onUpdateItem: (id: string, updated: Partial<ReceiptItem>) => void;
  onRemoveItem: (id: string) => void;
  onAddItem: (item: ReceiptItem) => void;
  onCompleteImport: () => void;
  onCancel: () => void;
}

export default function StagingReviewScreen({
  stagedItems,
  categories,
  language,
  onUpdateItem,
  onRemoveItem,
  onAddItem,
  onCompleteImport,
  onCancel
}: StagingReviewScreenProps) {
  const isPt = language === "pt";

  // Filter out and sort categories alphabetically.
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const isOtherA = a.trim().toLowerCase() === "other" || a.trim().toLowerCase() === "outro" || a.trim().toLowerCase() === "produto";
      const isOtherB = b.trim().toLowerCase() === "other" || b.trim().toLowerCase() === "outro" || b.trim().toLowerCase() === "produto";
      if (isOtherA && !isOtherB) return 1;
      if (!isOtherA && isOtherB) return -1;
      return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
    });
  }, [categories]);

  // Derived stats
  const totalStagedValue = useMemo(() => {
    return stagedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [stagedItems]);

  const uniqueInvoices = useMemo(() => {
    const list = new Set<string>();
    stagedItems.forEach(item => {
      if (item.invoiceNumber) list.add(item.invoiceNumber);
    });
    return list.size;
  }, [stagedItems]);

  const handleAddNewItem = () => {
    const defaultStore = stagedItems[0]?.storeName || "Grocery Store";
    const defaultDate = stagedItems[0]?.purchaseDate || new Date().toISOString().split("T")[0];
    const defaultInvoice = stagedItems[0]?.invoiceNumber || "";
    
    const newItem: ReceiptItem = {
      id: generateId(),
      name: isPt ? "Novo Item" : "New Item",
      quantity: 1,
      price: 0,
      category: sortedCategories[0] || "Produto",
      purchaseDate: defaultDate,
      storeName: defaultStore,
      invoiceNumber: defaultInvoice
    };
    onAddItem(newItem);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Title Area */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-50 text-emerald-750 border border-emerald-100 font-bold px-2.5 py-0.5 rounded-full text-[10px] uppercase font-mono animate-pulse">
              {isPt ? "Área de Homologação" : "Staging Review Area"}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            {isPt ? "Revisar Itens Importados" : "Review Scanned Items"}
          </h2>
          <p className="text-xs text-slate-500 max-w-xl leading-normal">
            {isPt 
              ? "Edite e refine os nomes, quantidades, preços unitários e categorias dos itens extraídos dos comprovantes digitados ou escaneados via IA antes de persisti-los na planilha principal."
              : "Review and refine names, quantities, unit prices, and categories extracted from your paper bills or scans before saving them permanently to the main spreadsheet database."}
          </p>
        </div>

        {/* Floating Stats Panel */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl">
          <div className="text-right select-none pr-3 border-r border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              {isPt ? "Total de Itens" : "Staged Items"}
            </span>
            <span className="text-lg font-black text-slate-900 font-mono mt-0.5 block">
              {stagedItems.length}
            </span>
          </div>
          <div className="text-right select-none pl-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              {isPt ? "Valor Est. Total" : "Est. Import Total"}
            </span>
            <span className="text-lg font-black text-emerald-600 font-mono mt-0.5 block">
              {formatCurrency(totalStagedValue)}
            </span>
          </div>
        </div>
      </div>

      {/* Item List / Staging Table Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {stagedItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-55 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-700 font-semibold text-sm">
                {isPt ? "Nenhum item pendente de revisão." : "No imported items pending review."}
              </p>
              <p className="text-slate-400 text-xs mt-1">
                {isPt 
                  ? "Escaneie um comprovante de compras na aba anterior para preencher a tabela de revisão." 
                  : "Scan paper grocery receipts in the main center tab to populate this staging table."}
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                {isPt ? "Voltar ao Scanner" : "Back to Scanner"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Context/Control strip */}
            <div className="px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-left">
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-550 shrink-0" />
                <span>
                  {isPt 
                    ? `Contém dados para ${uniqueInvoices} lote(s)/cupom(ns) diferente(s). Edite os campos diretamente nas células abaixo.` 
                    : `Contains parsed items spanning ${uniqueInvoices} unique receipt batch(es). Edit fields inline below.`}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddNewItem}
                  className="flex items-center gap-1.5 bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs py-1.5 px-3 rounded-lg cursor-pointer transition-all shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isPt ? "Adicionar Novo Item" : "Add New Item"}
                </button>
              </div>
            </div>

            {/* Main Interactive Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50/55 text-slate-500 font-bold border-b border-slate-100 font-mono text-[10px] uppercase select-none tracking-wider">
                    <th className="py-3 px-4 w-[28%]">{isPt ? "Nome do Produto" : "Item Name"}</th>
                    <th className="py-3 px-4 w-[10%] text-center">{isPt ? "Qtd" : "Qty"}</th>
                    <th className="py-3 px-4 w-[13%]">{isPt ? "Preço Unit." : "Unit Price"}</th>
                    <th className="py-3 px-4 w-[12%] font-medium text-slate-400">{isPt ? "Total" : "Total"}</th>
                    <th className="py-3 px-4 w-[18%]">{isPt ? "Categoria" : "Category"}</th>
                    <th className="py-3 px-4 w-[14%]">{isPt ? "Estabelecimento" : "Store & Metadata"}</th>
                    <th className="py-3 px-4 w-[5%] text-center font-sans tracking-normal font-normal"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {stagedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                      {/* Name editor inline */}
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => onUpdateItem(item.id, { name: e.target.value })}
                          className="w-full bg-transparent hover:bg-slate-55 focus:bg-white border-0 border-b border-transparent focus:border-emerald-500 focus:ring-0 px-1 py-1 rounded text-xs text-slate-800 outline-hidden font-medium transition-all"
                          placeholder={isPt ? "Ex: Leite Integral" : "Ex: Milk Bottle"}
                        />
                      </td>

                      {/* Quantity editor inline */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = Math.max(1, parseFloat(e.target.value) || 1);
                            onUpdateItem(item.id, { quantity: val });
                          }}
                          className="w-16 bg-transparent hover:bg-slate-55 focus:bg-white border-0 border-b border-transparent focus:border-emerald-500 focus:ring-0 p-1 rounded text-xs text-center font-mono font-bold text-slate-850 outline-hidden transition-all"
                        />
                      </td>

                      {/* Price editor inline */}
                      <td className="py-3 px-4">
                        <div className="relative flex items-center max-w-[120px]">
                          <span className="absolute left-1 text-[10px] text-slate-400 font-bold font-mono">
                            {currencySymbol()}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price === 0 ? "" : item.price}
                            placeholder="0.00"
                            onChange={(e) => {
                              const val = Math.max(0, parseFloat(e.target.value) || 0);
                              onUpdateItem(item.id, { price: val });
                            }}
                            className="w-full bg-transparent hover:bg-slate-55 focus:bg-white border-0 border-b border-transparent focus:border-emerald-500 focus:ring-0 pl-6 pr-1 py-1 rounded text-xs font-mono font-semibold text-slate-800 outline-hidden transition-all"
                          />
                        </div>
                      </td>

                      {/* Row Total (Calculated) */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {formatCurrency(item.price * item.quantity)}
                      </td>

                      {/* Category select dropdown */}
                      <td className="py-3 px-4">
                        <select
                          value={item.category || ""}
                          onChange={(e) => onUpdateItem(item.id, { category: e.target.value })}
                          className="w-full bg-transparent hover:bg-slate-55 focus:bg-white border border-slate-200/50 hover:border-slate-300 focus:border-emerald-500 focus:ring-0 p-1.5 rounded text-xs text-slate-700 outline-hidden font-medium transition-all cursor-pointer shadow-3xs"
                        >
                          {sortedCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Metadata inputs collapsed inside Cell for neat design */}
                      <td className="py-3 px-4 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            value={item.storeName || ""}
                            onChange={(e) => onUpdateItem(item.id, { storeName: e.target.value })}
                            className="bg-transparent hover:bg-slate-55 focus:bg-white border-0 border-b border-transparent focus:border-emerald-500 focus:ring-0 px-1 py-0.5 rounded text-[11px] text-slate-600 outline-hidden transition-all w-full truncate"
                            placeholder="Store"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <input
                            type="date"
                            value={item.purchaseDate || ""}
                            onChange={(e) => onUpdateItem(item.id, { purchaseDate: e.target.value })}
                            className="bg-transparent hover:bg-slate-55 focus:bg-white border-0 border-b border-transparent focus:border-emerald-500 focus:ring-0 px-1 py-0.5 rounded text-[11px] text-slate-500 outline-hidden transition-all font-mono"
                          />
                        </div>
                        {item.invoiceNumber && (
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              value={item.invoiceNumber || ""}
                              onChange={(e) => onUpdateItem(item.id, { invoiceNumber: e.target.value })}
                              className="bg-transparent hover:bg-slate-55 focus:bg-white border-0 border-b border-transparent focus:border-emerald-500 focus:ring-0 px-1 py-0.5 rounded text-[10px] text-slate-400 outline-hidden transition-all font-mono"
                              placeholder="Invoice #"
                            />
                          </div>
                        )}
                      </td>

                      {/* Discard line action */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title={isPt ? "Excluir este item" : "Delete this item"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Processing Control Actions Panel */}
            <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={onCancel}
                className="w-full sm:w-auto text-slate-500 hover:text-slate-800 hover:bg-slate-200 border border-slate-200/80 bg-white font-bold text-xs py-2.5 px-5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                {isPt ? "Cancelar e Descartar" : "Cancel & Discard"}
              </button>

              <button
                type="button"
                onClick={onCompleteImport}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs.5 py-3 px-7 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle className="w-4.5 h-4.5" />
                {isPt ? "Concluir Importação" : "Complete Import"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function currencySymbol() {
    const defaultSymbol = "$";
    try {
      const stored = safeStorage.getItem("grocery_currency");
      if (stored === "BRL") return "R$";
      if (stored === "EUR") return "€";
    } catch (e) {}
    return defaultSymbol;
  }
}
