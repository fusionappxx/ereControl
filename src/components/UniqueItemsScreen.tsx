import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { 
  ArrowLeft, 
  Search, 
  TrendingUp, 
  Scale, 
  Package, 
  ArrowUpDown, 
  BadgeHelp,
  Tag,
  Calendar,
  Layers,
  ChevronRight
} from "lucide-react";
import { ReceiptItem } from "../types";
import { parseVolumeOrWeight, formatCurrency } from "../utils";
import { translations } from "../translations";

interface UniqueItemsScreenProps {
  items: ReceiptItem[];
  categories: string[];
  language: "en" | "pt";
  onBack: () => void;
  onViewItemDetails: (productName: string) => void;
  onUpdateProductCategory: (productName: string, newCategory: string) => Promise<void>;
}

interface UniqueItemRow {
  name: string;      // Canonical casing (from most recent purchase)
  lowercaseName: string;
  category: string;
  lastPurchaseDate: string;
  lastPrice: number;
  specs: {
    value: number;
    unit: "g" | "kg" | "ml" | "l" | "unit" | null;
  };
  pricePerGram?: number;
  pricePerMl?: number;
  pricePerKg?: number;
  pricePerL?: number;
  weightLabel: string;
}

export default function UniqueItemsScreen({
  items,
  categories,
  language,
  onBack,
  onViewItemDetails,
  onUpdateProductCategory
}: UniqueItemsScreenProps) {
  const t = translations[language];
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortField, setSortField] = useState<"name" | "lastPrice" | "category" | "unitPrice" | "date">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

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

  // Aggregate items into unique name groups
  const uniqueItemsList = useMemo(() => {
    const groups: Record<string, ReceiptItem[]> = {};
    
    items.forEach(item => {
      const key = item.name.trim().toLowerCase();
      if (!key) return;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });

    const list: UniqueItemRow[] = Object.entries(groups).map(([lowName, itemList]) => {
      // Sort items of this group by date descending to grab the absolute most recent transaction details
      const sortedHistory = [...itemList].sort((a, b) => {
        return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
      });
      const latestItem = sortedHistory[0];

      // Parse specifications
      const hasCustomVal = latestItem.customWeightOrVolValue !== undefined && latestItem.customWeightOrVolValue > 0;
      const parsed = hasCustomVal 
        ? { value: latestItem.customWeightOrVolValue!, unit: latestItem.customWeightOrVolUnit! }
        : parseVolumeOrWeight(latestItem.name);

      let pricePerGram: number | undefined;
      let pricePerMl: number | undefined;
      let pricePerKg: number | undefined;
      let pricePerL: number | undefined;
      let weightLabel = "N/A";

      const lastPrice = latestItem.price;

      if (parsed.value && parsed.unit && lastPrice > 0) {
        weightLabel = parsed.unit === "unit"
          ? `${parsed.value} ${language === "pt" ? "un" : "units"}`
          : `${parsed.value} ${parsed.unit.toUpperCase()}`;
        
        if (parsed.unit === "g") {
          pricePerGram = lastPrice / parsed.value;
          pricePerKg = pricePerGram * 1000;
        } else if (parsed.unit === "kg") {
          const grams = parsed.value * 1000;
          pricePerGram = lastPrice / grams;
          pricePerKg = pricePerGram * 1000;
        } else if (parsed.unit === "ml") {
          pricePerMl = lastPrice / parsed.value;
          pricePerL = pricePerMl * 1000;
        } else if (parsed.unit === "l") {
          const mls = parsed.value * 1000;
          pricePerMl = lastPrice / mls;
          pricePerL = pricePerMl * 1000;
        }
      }

      return {
        name: latestItem.name,
        lowercaseName: lowName,
        category: latestItem.category || "Other",
        lastPurchaseDate: latestItem.purchaseDate,
        lastPrice,
        specs: parsed,
        pricePerGram,
        pricePerMl,
        pricePerKg,
        pricePerL,
        weightLabel
      };
    });

    return list;
  }, [items]);

  // Apply search query and category filters
  const filteredItems = useMemo(() => {
    return uniqueItemsList.filter(row => {
      const matchesCategory = selectedCategory === "all" || row.category === selectedCategory;
      if (!matchesCategory) return false;

      const query = searchQuery.toLowerCase();
      return (
        row.name.toLowerCase().includes(query) ||
        row.category.toLowerCase().includes(query) ||
        row.weightLabel.toLowerCase().includes(query)
      );
    });
  }, [uniqueItemsList, searchQuery, selectedCategory]);

  // Sort rows based on reactive user parameters
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "category":
          comparison = a.category.localeCompare(b.category);
          break;
        case "date":
          comparison = new Date(a.lastPurchaseDate).getTime() - new Date(b.lastPurchaseDate).getTime();
          break;
        case "lastPrice":
          comparison = a.lastPrice - b.lastPrice;
          break;
        case "unitPrice":
          {
            // Compare price per gram/ml primarily
            const valA = a.pricePerGram || a.pricePerMl || 999999;
            const valB = b.pricePerGram || b.pricePerMl || 999999;
            comparison = valA - valB;
          }
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
    return list;
  }, [filteredItems, sortField, sortDirection]);

  // Summary Metrics Analysis values
  const stats = useMemo(() => {
    const count = uniqueItemsList.length;
    const countWithUnit = uniqueItemsList.filter(row => row.pricePerGram !== undefined || row.pricePerMl !== undefined).length;
    
    let sumPrice = 0;
    uniqueItemsList.forEach(item => {
      sumPrice += item.lastPrice;
    });
    const avgPrice = count > 0 ? sumPrice / count : 0;

    return {
      count,
      countWithUnit,
      avgPrice
    };
  }, [uniqueItemsList]);

  // Handle header click to invert sort direction or select new target variable filter
  const toggleSorting = (field: "name" | "lastPrice" | "category" | "unitPrice" | "date") => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Upper header navigation section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 active:bg-slate-100 dark:active:bg-slate-700 rounded-xl transition-all shadow-3xs cursor-pointer flex items-center justify-center"
            title={language === "pt" ? "Voltar ao Início" : "Back to Home"}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              <Package className="w-5.5 h-5.5 text-emerald-600 dark:text-emerald-400" /> <span>{t.uniqueItemsTitle}</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              {t.uniqueItemsSubtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards Dashboard banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 flex items-center gap-3.5 shadow-2xs transition-colors">
          <div className="bg-indigo-50 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Package className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Unique Catalog size</p>
            <h3 className="text-base font-bold text-slate-950 dark:text-white mt-0.5 font-mono">
              {stats.count} {language === "pt" ? "Itens" : "Items"}
            </h3>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 flex items-center gap-3.5 shadow-2xs transition-colors">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Scale className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Unit-Rated Items</p>
            <h3 className="text-base font-bold text-slate-950 dark:text-white mt-0.5 font-mono">
              {stats.countWithUnit} ({stats.count > 0 ? Math.round((stats.countWithUnit / stats.count) * 100) : 0}%)
            </h3>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 flex items-center gap-3.5 shadow-2xs transition-colors">
          <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900 text-amber-600 dark:text-amber-400 shrink-0">
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Average Grocery Unit Value</p>
            <h3 className="text-base font-bold text-slate-950 dark:text-white mt-0.5 font-mono">
              {formatCurrency(stats.avgPrice)}
            </h3>
          </div>
        </div>
      </div>

      {/* Main Table Spreadsheet Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        
        {/* Sticky Filters & Search row banner */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-400 dark:placeholder-slate-500 transition-shadow"
              />
            </div>

            <div className="relative min-w-[150px]">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs rounded-lg py-1.5 pl-3 pr-8 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-400 cursor-pointer appearance-none transition-all"
              >
                <option value="all">
                  {language === "pt" ? "Todas as categorias" : "All Categories"}
                </option>
                {sortedCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 dark:text-slate-500">
                <Tag className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
          
          <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center sm:text-left shrink-0">
            Showing <strong className="text-slate-700 dark:text-slate-200">{sortedItems.length}</strong> unique catalog items.
          </div>
        </div>

        {/* Dense Spreadsheet Grid */}
        <div className="overflow-x-auto min-h-[350px]">
          {sortedItems.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 dark:text-slate-500 p-4">
              {t.noUniqueItems}
            </div>
          ) : (
            <table className="w-full text-left border-collapse table-fixed select-text">
              <thead>
                <tr className="bg-white dark:bg-slate-950/40 text-slate-600 dark:text-slate-350 border-b border-slate-200/60 dark:border-slate-800 text-[11px] font-semibold tracking-wider sticky top-0 z-10 select-none">
                  {/* Item Name header */}
                  <th className="w-[65%] sm:w-[45%] px-5 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors" onClick={() => toggleSorting("name")}>
                    <div className="flex items-center gap-1">
                      {t.itemNameCol}
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                  {/* Category header */}
                  <th className="w-[11%] px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors hidden sm:table-cell" onClick={() => toggleSorting("category")}>
                    <div className="flex items-center gap-1">
                      Category
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                  {/* Purchase Date header */}
                  <th className="w-[11%] px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors hidden sm:table-cell" onClick={() => toggleSorting("date")}>
                    <div className="flex items-center gap-1">
                      Last Scanned
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                  {/* Specs size column */}
                  <th className="w-[11%] px-4 py-3 text-center hidden sm:table-cell">
                    {t.sizeCol}
                  </th>
                  {/* Last Price Col */}
                  <th className="w-[11%] px-4 py-3 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors hidden sm:table-cell" onClick={() => toggleSorting("lastPrice")}>
                    <div className="flex items-center justify-end gap-1">
                      {t.lastPriceCol}
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                  {/* Cost per standard weight Unit column */}
                  <th className="w-[35%] sm:w-[11%] px-5 py-3 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-855 transition-colors" onClick={() => toggleSorting("unitPrice")}>
                    <div className="flex items-center justify-end gap-1">
                      {t.pricePerGramLiterCol}
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                {sortedItems.map((row) => {
                  return (
                    <tr 
                      key={row.lowercaseName} 
                      className="hover:bg-slate-50/60 focus-within:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Interactive Item Name */}
                      <td className="px-5 py-2.5">
                        <button
                          onClick={() => onViewItemDetails(row.name)}
                          className="font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline text-left cursor-pointer flex items-center gap-1.5 group transition-colors truncate max-w-full"
                        >
                          <span className="truncate">{row.name}</span>
                          <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-emerald-500 transition-all shrink-0" />
                        </button>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <div className="relative inline-block w-full">
                          <select
                            value={row.category}
                            onChange={(e) => onUpdateProductCategory(row.name, e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] rounded-lg py-1 pl-2 pr-7 border border-slate-200/80 dark:border-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer appearance-none transition-all"
                          >
                            {sortedCategories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 dark:text-slate-500">
                            <Tag className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </td>

                      {/* Last Scanned Date */}
                      <td className="px-4 py-2.5 font-mono text-[10.5px] text-slate-400 dark:text-slate-500 hidden sm:table-cell">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {row.lastPurchaseDate}
                        </div>
                      </td>

                      {/* Weight Label specifications flag */}
                      <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                        {row.weightLabel !== "N/A" ? (
                          <span className="font-mono text-[10.5px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/60">
                            {row.weightLabel}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium italic">
                            —
                          </span>
                        )}
                      </td>

                      {/* Unit Last price */}
                      <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-700 dark:text-slate-200 hidden sm:table-cell">
                        {formatCurrency(row.lastPrice)}
                      </td>

                      {/* Price Per Gram/Liter Calculation display */}
                      <td className="px-5 py-2.5 text-right font-mono">
                        {row.specs.unit === "unit" && (
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 block">
                              {formatCurrency(row.lastPrice / row.specs.value)} /{language === "pt" ? "un" : "unit"}
                            </span>
                          </div>
                        )}
                        {row.pricePerGram !== undefined && row.pricePerKg !== undefined && (
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 block">
                              {formatCurrency(row.pricePerGram)} /g
                            </span>
                            <span className="text-[9.5px] text-slate-400 dark:text-slate-500 block">
                              ({formatCurrency(row.pricePerKg)} /kg)
                            </span>
                          </div>
                        )}
                        {row.pricePerMl !== undefined && row.pricePerL !== undefined && (
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 block">
                              {formatCurrency(row.pricePerMl)} /ml
                            </span>
                            <span className="text-[9.5px] text-slate-400 dark:text-slate-500 block">
                              ({formatCurrency(row.pricePerL)} /L)
                            </span>
                          </div>
                        )}
                        {row.pricePerGram === undefined && row.pricePerMl === undefined && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 italic block">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </motion.div>
  );
}
