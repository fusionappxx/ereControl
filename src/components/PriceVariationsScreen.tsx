import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Store, 
  Calendar, 
  FileText, 
  DollarSign, 
  AlertCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  Tag,
  ArrowRight
} from "lucide-react";
import { ReceiptItem } from "../types";
import { formatCurrency, getGlobalCurrency } from "../utils";

interface PriceVariationsScreenProps {
  items: ReceiptItem[];
  language: "en" | "pt";
  onBack: () => void;
  onViewItemDetails?: (productName: string) => void;
}

interface PricePointVariation {
  id: string;
  price: number;
  date: string;
  storeName: string;
  invoiceNumber?: string;
  quantity: number;
}

interface ItemVariationGroup {
  name: string;
  category: string;
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  priceVolatility: number; // percentage difference: ((max - min) / min) * 100
  occurrences: number;
  history: PricePointVariation[];
}

const localTranslations = {
  en: {
    back: "← Back to Scanner",
    title: "Price Variations Monitor",
    subtitle: "Analysis of the top 20 items with the highest historical price fluctuations and store deviations",
    searchPlaceholder: "Search variations...",
    emptyState: "No items with price variations detected yet.",
    itemCol: "Item Description",
    categoryCol: "Category",
    lowestCol: "Lowest Paid",
    highestCol: "Highest Paid",
    volatilityCol: "Max Deviation",
    purchasesCol: "Purchases",
    detailsTitle: "Chronological Variations History",
    comparedTolowest: "compared to lowest",
    aboveLowest: "above lowest",
    lowestIndicator: "Lowest recorded",
    stableIndicator: "Stable baseline",
    viewProductProfile: "View Product Profile",
    statsTitle: "Market Insights Summary",
    statsMostVolatile: "Most Volatile Product",
    statsAvgVol: "Avg. Price Deviation",
    statsUniqueCheck: "Items Scanned"
  },
  pt: {
    back: "← Voltar para Notas",
    title: "Monitor de Variação de Preços",
    subtitle: "Análise dos 20 itens com maior flutuação histórica e desvios de preços entre estabelecimentos",
    searchPlaceholder: "Buscar variações...",
    emptyState: "Nenhuma variação de preço identificada ainda.",
    itemCol: "Descrição do Item",
    categoryCol: "Categoria",
    lowestCol: "Menor Preço",
    highestCol: "Maior Preço",
    volatilityCol: "Desvio Máximo",
    purchasesCol: "Compras",
    detailsTitle: "Histórico Cronológico de Variações",
    comparedTolowest: "em relação ao menor",
    aboveLowest: "acima do menor",
    lowestIndicator: "Menor registrado",
    stableIndicator: "Baseline estável",
    viewProductProfile: "Ver Perfil do Produto",
    statsTitle: "Resumo de Inteligência de Mercado",
    statsMostVolatile: "Item Mais Volátil",
    statsAvgVol: "Desvio Médio de Preços",
    statsUniqueCheck: "Itens Analisados"
  }
};

export default function PriceVariationsScreen({
  items,
  language,
  onBack,
  onViewItemDetails
}: PriceVariationsScreenProps) {
  const t = localTranslations[language] || localTranslations.en;
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Group items by name and calculate price variations and volatility
  const variationsList = useMemo(() => {
    const groups: Record<string, ReceiptItem[]> = {};
    items.forEach(item => {
      const nameKey = item.name.trim().toLowerCase();
      if (!nameKey) return;
      if (!groups[nameKey]) {
        groups[nameKey] = [];
      }
      groups[nameKey].push(item);
    });

    const calculatedGroups: ItemVariationGroup[] = [];

    Object.entries(groups).forEach(([nameKey, itemArray]) => {
      if (itemArray.length === 0) return;

      const prices = itemArray.map(itm => Number(itm.price) || 0).filter(p => p > 0);
      if (prices.length === 0) return;

      const lowestPrice = Math.min(...prices);
      const highestPrice = Math.max(...prices);
      const sum = prices.reduce((a, b) => a + b, 0);
      const averagePrice = sum / prices.length;

      // Price Volatility: percentage spread between max and min
      const priceVolatility = lowestPrice > 0 
        ? ((highestPrice - lowestPrice) / lowestPrice) * 100 
        : 0;

      // Map raw items to variations points
      const historyPoints: PricePointVariation[] = itemArray.map(itm => ({
        id: itm.id,
        price: Number(itm.price) || 0,
        date: itm.purchaseDate,
        storeName: itm.storeName || "Unknown Retailer",
        invoiceNumber: itm.invoiceNumber,
        quantity: Number(itm.quantity) || 1
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // descending by default (most recent first)

      calculatedGroups.push({
        name: itemArray[0].name, // Keep casing of the first match
        category: itemArray[0].category || "Other",
        lowestPrice,
        highestPrice,
        averagePrice,
        priceVolatility,
        occurrences: itemArray.length,
        history: historyPoints
      });
    });

    // Filter only groups that have SOME variation or are scanned items,
    // order by priceVolatility descending, and restrict to top 20
    const sorted = calculatedGroups
      .sort((a, b) => b.priceVolatility - a.priceVolatility)
      .slice(0, 20);

    return sorted;
  }, [items]);

  // Apply Search query
  const filteredVariations = useMemo(() => {
    if (!searchQuery.trim()) return variationsList;
    const term = searchQuery.toLowerCase();
    return variationsList.filter(v => 
      v.name.toLowerCase().includes(term) ||
      v.category.toLowerCase().includes(term)
    );
  }, [variationsList, searchQuery]);

  // Insights Stats
  const insightsStats = useMemo(() => {
    if (variationsList.length === 0) {
      return { mostVolatile: "—", avgVolatility: 0, itemsAnalyzed: 0 };
    }

    const withFluc = variationsList.filter(v => v.priceVolatility > 0);
    const avgVol = withFluc.length > 0 
      ? withFluc.reduce((sum, current) => sum + current.priceVolatility, 0) / withFluc.length 
      : 0;

    const topVolatile = variationsList[0];

    return {
      mostVolatile: topVolatile && topVolatile.priceVolatility > 0 ? topVolatile.name : "—",
      avgVolatility: avgVol,
      itemsAnalyzed: variationsList.length
    };
  }, [variationsList]);

  // Handle accordion toggle
  const toggleRow = (itemName: string) => {
    if (expandedItem === itemName) {
      setExpandedItem(null);
    } else {
      setExpandedItem(itemName);
    }
  };

  const currentCurrency = getGlobalCurrency() === "BRL" ? "R$" : getGlobalCurrency() === "EUR" ? "€" : "$";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="space-y-6 select-text"
    >
      {/* Top Header Block */}
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
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5.5 h-5.5 text-violet-500" /> {t.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              {t.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Insights Cards banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Stat 1 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 flex items-center gap-3.5 shadow-2xs transition-colors">
          <div className="bg-violet-50 dark:bg-violet-950/40 p-2.5 rounded-xl border border-violet-100 dark:border-violet-900 text-violet-600 dark:text-violet-400 shrink-0">
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t.statsMostVolatile}</p>
            <h3 className="text-xs font-extrabold text-slate-800 dark:text-white mt-1 truncate" title={insightsStats.mostVolatile}>
              {insightsStats.mostVolatile}
            </h3>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 flex items-center gap-3.5 shadow-2xs transition-colors">
          <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900 text-amber-600 dark:text-amber-400 shrink-0">
            <TrendingDown className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t.statsAvgVol}</p>
            <h3 className="text-sm font-extrabold text-slate-950 dark:text-white mt-1 font-mono">
              {insightsStats.avgVolatility > 0 ? `+${insightsStats.avgVolatility.toFixed(1)}%` : "0.0%"}
            </h3>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 flex items-center gap-3.5 shadow-2xs transition-colors">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Eye className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t.statsUniqueCheck}</p>
            <h3 className="text-sm font-extrabold text-slate-950 dark:text-white mt-1 font-mono">
              {insightsStats.itemsAnalyzed} {language === "pt" ? "Registrados" : "Monitored"}
            </h3>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        
        {/* Sticky Filters row */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400 dark:placeholder-slate-500 transition-all font-medium"
            />
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Showing the top <strong className="text-slate-700 dark:text-slate-200">{filteredVariations.length}</strong> items.
          </div>
        </div>

        {/* Accordion Table */}
        <div className="overflow-x-auto min-h-[300px]">
          {filteredVariations.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 dark:text-slate-500 p-4">
              <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              {t.emptyState}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {/* Table Header mock row */}
              <div className="hidden sm:flex bg-slate-50/55 dark:bg-slate-950/20 text-slate-600 dark:text-slate-400 text-[11px] font-bold tracking-wider px-6 py-3 border-b border-slate-200/60 dark:border-slate-800 select-none">
                <div className="w-[45%]">{t.itemCol}</div>
                <div className="w-[15%] text-center">{t.purchasesCol}</div>
                <div className="w-[13%] text-right">{t.lowestCol}</div>
                <div className="w-[13%] text-right">{t.highestCol}</div>
                <div className="w-[14%] text-right">{t.volatilityCol}</div>
              </div>

              {/* Accordion List Rows */}
              {filteredVariations.map((group) => {
                const isExpanded = expandedItem === group.name;
                const percentLabel = group.priceVolatility > 0 ? `+${group.priceVolatility.toFixed(0)}%` : "0%";

                return (
                  <div key={group.name} className="flex flex-col hover:bg-slate-50/30 transition-colors">
                    {/* Main Row */}
                    <div 
                      onClick={() => toggleRow(group.name)}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center px-6 py-4 cursor-pointer select-none gap-2.5 sm:gap-0"
                    >
                      {/* Item info */}
                      <div className="sm:w-[45%] flex items-start gap-2.5 min-w-0 pr-2">
                        <div className="mt-1">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm hover:text-emerald-600 transition-colors truncate">
                            {group.name}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                            <Tag className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                            {group.category}
                          </p>
                        </div>
                      </div>

                      {/* Number of recorded purchases */}
                      <div className="sm:w-[15%] flex justify-between sm:justify-center items-center text-xs text-slate-500 dark:text-slate-400 border-t sm:border-t-0 p-1.5 sm:p-0 border-slate-100">
                        <span className="sm:hidden font-semibold text-[10px] uppercase text-slate-400">{t.purchasesCol}</span>
                        <span className="font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          {group.occurrences}x
                        </span>
                      </div>

                      {/* Minimum paid */}
                      <div className="sm:w-[13%] flex justify-between sm:justify-end items-center text-xs dark:text-slate-100 font-mono border-t sm:border-t-0 p-1.5 sm:p-0 border-slate-100">
                        <span className="sm:hidden font-semibold text-[10px] uppercase text-slate-400">{t.lowestCol}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 px-1.5 py-0.5 rounded">
                          {formatCurrency(group.lowestPrice)}
                        </span>
                      </div>

                      {/* Maximum paid */}
                      <div className="sm:w-[13%] flex justify-between sm:justify-end items-center text-xs font-mono border-t sm:border-t-0 p-1.5 sm:p-0 border-slate-100">
                        <span className="sm:hidden font-semibold text-[10px] uppercase text-slate-400">{t.highestCol}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 px-1.5 py-0.5 rounded">
                          {formatCurrency(group.highestPrice)}
                        </span>
                      </div>

                      {/* Volatility/Spread range */}
                      <div className="sm:w-[14%] flex justify-between sm:justify-end items-center text-xs font-mono border-t sm:border-t-0 p-1.5 sm:p-0 border-slate-100">
                        <span className="sm:hidden font-semibold text-[10px] uppercase text-slate-400">{t.volatilityCol}</span>
                        <div>
                          {group.priceVolatility > 0 ? (
                            <span className="font-extrabold text-[10.5px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-2 py-1 rounded-lg border border-rose-100/50 dark:border-rose-900/30">
                              ▲ {percentLabel}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-405 dark:text-slate-500 font-semibold bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">
                              {t.stableIndicator}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Accordion Detail subtable of raw purchase instances */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          id={`expanded-sub-[${group.name}]`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden bg-slate-50/50 dark:bg-slate-950/15 border-t border-slate-100/80 dark:border-slate-800/80 px-6 sm:px-12 py-3.5 space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-indigo-400" />
                              {t.detailsTitle}
                            </h4>
                            
                            {onViewItemDetails && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewItemDetails(group.name);
                                }}
                                className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto hover:underline"
                              >
                                {t.viewProductProfile} <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="rounded-xl border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900/50 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                            {group.history.map((inst, index) => {
                              // Compare price against the minimum to show % difference
                              const matchesLowest = inst.price === group.lowestPrice;
                              const diffPercent = group.lowestPrice > 0 
                                ? ((inst.price - group.lowestPrice) / group.lowestPrice) * 100 
                                : 0;

                              return (
                                <div key={inst.id} className="flex flex-wrap sm:flex-nowrap items-center justify-between px-4 py-3 text-xs gap-2.5 sm:gap-0 hover:bg-slate-50/20 dark:hover:bg-slate-800/10 transition-colors">
                                  {/* Date and Store name group */}
                                  <div className="w-[50%] sm:w-[35%] min-w-0">
                                    <p className="font-bold text-slate-700 dark:text-slate-350 flex items-center gap-1.5 truncate">
                                      <Store className="w-3.5 h-3.5 text-slate-450 dark:text-slate-500 shrink-0" />
                                      {inst.storeName}
                                    </p>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1.5">
                                      <Calendar className="w-3 h-3 shrink-0" />
                                      {inst.date}
                                    </p>
                                  </div>

                                  {/* Invoice Info */}
                                  <div className="w-[40%] sm:w-[25%] text-slate-500 dark:text-slate-400 font-mono text-[10.5px] hidden sm:block truncate pr-2">
                                    {inst.invoiceNumber ? (
                                      <span className="bg-slate-50 dark:bg-slate-800/40 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                                        Nfc-e Ref: {inst.invoiceNumber.slice(-8)}
                                      </span>
                                    ) : (
                                      <span className="italic text-slate-400">No NFC-e Ref</span>
                                    )}
                                  </div>

                                  {/* Variation Price and Badge comparing to minimum */}
                                  <div className="w-[45%] sm:w-[40%] text-right flex items-center justify-end gap-3 font-mono">
                                    <div>
                                      <p className="text-[9.5px] text-slate-400 font-medium">Quantity/Unit price</p>
                                      <p className="text-slate-800 dark:text-slate-200 mt-0.5">
                                        <span className="text-[10px] font-bold text-slate-400 pr-0.5 mr-0.5 px-1 bg-slate-50 dark:bg-slate-800 rounded font-sans">{inst.quantity}x</span>
                                        <span className="font-bold">{formatCurrency(inst.price)}</span>
                                      </p>
                                    </div>
                                    
                                    <div className="w-24 shrink-0 text-right">
                                      {matchesLowest ? (
                                        <span className="text-[9.5px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 px-2 py-0.5 rounded-full border border-emerald-100/40">
                                          {t.lowestIndicator}
                                        </span>
                                      ) : (
                                        <div className="text-[10px]">
                                          <span className="font-bold text-amber-600 dark:text-amber-400">
                                            +{diffPercent.toFixed(0)}%
                                          </span>
                                          <span className="text-[8.5px] text-slate-404 block">{t.aboveLowest}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
