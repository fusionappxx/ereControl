import React, { useState, useMemo, useEffect } from "react";
import { 
  ArrowLeft, 
  Tag, 
  TrendingUp, 
  ShoppingCart, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  DollarSign,
  Layers,
  FileSpreadsheet
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine
} from "recharts";
import { ReceiptItem } from "../types";
import { formatCurrency, getGlobalCurrency } from "../utils";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

interface SpendingBreakdownProps {
  items: ReceiptItem[];
  categories: string[];
  onBack: () => void;
  language: "en" | "pt";
}

interface FixedExpense {
  id: string;
  name: string;
  month: string;
  value: number;
  createdAt?: string;
}

interface GenericExpense {
  id: string;
  name: string;
  amount: number;
  quantity: number;
  price: number;
  category: string;
  group: "Supplies" | "Cleaning" | "Fixed" | "Variable";
  purchaseDate: string;
  storeName: string;
  type: "item" | "fixed";
}

const monthsPt = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const monthsEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const GROUP_METADATA = {
  Supplies: {
    en: "Supplies",
    pt: "Insumos & Suprimentos",
    color: "#3b82f6" // blue
  },
  Cleaning: {
    en: "Cleaning",
    pt: "Limpeza",
    color: "#10b981" // emerald
  },
  Fixed: {
    en: "Fixed",
    pt: "Despesas Fixas",
    color: "#f59e0b" // amber
  },
  Variable: {
    en: "Variable",
    pt: "Despesas Variáveis",
    color: "#ef4444" // red
  }
};

const resolveGroup = (rawCategory: string): "Supplies" | "Cleaning" | "Fixed" | "Variable" => {
  const cat = (rawCategory || "").toLowerCase().trim();
  
  // Supplies check
  if (
    cat === "açai" ||
    cat === "açaí" ||
    cat === "bebidas" ||
    cat === "beverages" ||
    cat === "carnes" ||
    cat === "meat" ||
    cat === "meat & seafood" ||
    cat === "embalagem" ||
    cat === "frutas" ||
    cat === "fruits" ||
    cat === "insumos" ||
    cat === "ingredients" ||
    cat === "salgados" ||
    cat === "snacks"
  ) {
    return "Supplies";
  }
  
  // Cleaning check
  if (
    cat === "limpeza" ||
    cat === "cleaning" ||
    cat === "household"
  ) {
    return "Cleaning";
  }

  // Fixed check
  if (cat === "fixed" || cat === "fixo" || cat === "despesas fixas" || cat === "fixed_expense") {
    return "Fixed";
  }
  
  // Default fallback/Variable check
  return "Variable";
};

const getSyntheticFixedExpenseDate = (exp: FixedExpense) => {
  let year = new Date().getFullYear();
  if (exp.createdAt) {
    try {
      const d = new Date(exp.createdAt);
      if (!isNaN(d.getTime())) {
        year = d.getFullYear();
      }
    } catch (e) {}
  }
  
  const mName = exp.month.trim().toLowerCase();
  
  let mIdx = monthsPt.findIndex(m => m.trim().toLowerCase() === mName);
  if (mIdx === -1) {
    mIdx = monthsEn.findIndex(m => m.trim().toLowerCase() === mName);
  }
  if (mIdx === -1) {
    mIdx = new Date().getMonth();
  }
  
  const monthPad = String(mIdx + 1).padStart(2, '0');
  return `${year}-${monthPad}-01`;
};

export default function SpendingBreakdown({
  items,
  categories,
  onBack,
  language
}: SpendingBreakdownProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);

  // Real-time Firestore loader for fixed expenses
  useEffect(() => {
    const colRef = collection(db, "fixed_expenses");
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const list: FixedExpense[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        list.push({
          id: docSnapshot.id,
          name: data.name || "",
          month: data.month || "",
          value: Number(data.value) || 0,
          createdAt: data.createdAt
        });
      });
      setFixedExpenses(list);
    }, (err) => {
      console.error("Error loading fixed expenses in SpendingBreakdown:", err);
    });
    return () => unsubscribe();
  }, []);

  // Map other items and fixed expenses into a single array of generic expenses
  const genericItems = useMemo<GenericExpense[]>(() => {
    const list: GenericExpense[] = [];
    
    // Process receipt items
    items.forEach(item => {
      const cost = (Number(item.quantity) || 0) * (Number(item.price) || 0);
      const cat = item.category || "Other";
      list.push({
        id: item.id,
        name: item.name,
        amount: cost,
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        category: cat,
        group: resolveGroup(cat),
        purchaseDate: item.purchaseDate || "",
        storeName: item.storeName || "Store",
        type: "item"
      });
    });

    // Process fixed expenses
    fixedExpenses.forEach(exp => {
      const cost = Number(exp.value) || 0;
      const syntheticDate = getSyntheticFixedExpenseDate(exp);
      list.push({
        id: exp.id,
        name: exp.name,
        amount: cost,
        quantity: 1,
        price: cost,
        category: "Fixed Expense",
        group: "Fixed",
        purchaseDate: syntheticDate,
        storeName: language === "pt" ? "Despesa Fixa" : "Fixed Expense",
        type: "fixed"
      });
    });

    return list;
  }, [items, fixedExpenses, language]);

  // Extracts all unique months from both standard purchase lists and fixed expenses
  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    genericItems.forEach(item => {
      if (item.purchaseDate) {
        const match = item.purchaseDate.substring(0, 7);
        if (/^\d{4}-\d{2}$/.test(match)) {
          months.add(match);
        }
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [genericItems]);

  const totalInvoicesCount = useMemo(() => {
    const monthFilteredItems = selectedMonth === "all"
      ? items
      : items.filter(item => item.purchaseDate && item.purchaseDate.startsWith(selectedMonth));

    const invoiceKeys = new Set<string>();
    monthFilteredItems.forEach(item => {
      const invNum = item.invoiceNumber?.trim() || "";
      const hasInvoice = invNum !== "" && invNum.toLowerCase() !== "n/a";
      const key = hasInvoice 
        ? `inv_${invNum.toLowerCase()}` 
        : `receipt_${item.purchaseDate}_${item.storeName.trim().toLowerCase()}`;
      invoiceKeys.add(key);
    });
    return invoiceKeys.size;
  }, [items, selectedMonth]);

  const formatMonthLabel = (yearMonthStr: string) => {
    const [year, month] = yearMonthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 15);
    return date.toLocaleString(language === "pt" ? "pt-BR" : "en-US", { month: "long", year: "numeric" });
  };

  // Filter items list selectively by month selection
  const filteredGenericItems = useMemo(() => {
    if (selectedMonth === "all") return genericItems;
    return genericItems.filter(item => item.purchaseDate && item.purchaseDate.startsWith(selectedMonth));
  }, [genericItems, selectedMonth]);

  // Calculates aggregated expenditures per grouped category of expenses
  const breakdownStats = useMemo(() => {
    let grandTotal = 0;
    
    // Initialize groups
    const groupTotals: Record<"Supplies" | "Cleaning" | "Fixed" | "Variable", { total: number; count: number; items: GenericExpense[] }> = {
      Supplies: { total: 0, count: 0, items: [] },
      Cleaning: { total: 0, count: 0, items: [] },
      Fixed: { total: 0, count: 0, items: [] },
      Variable: { total: 0, count: 0, items: [] }
    };

    filteredGenericItems.forEach(item => {
      grandTotal += item.amount;
      const grp = item.group;
      groupTotals[grp].total += item.amount;
      groupTotals[grp].count += 1;
      groupTotals[grp].items.push(item);
    });

    const groupsList = (Object.keys(groupTotals) as Array<"Supplies" | "Cleaning" | "Fixed" | "Variable">).map((groupKey) => {
      const stat = groupTotals[groupKey];
      const meta = GROUP_METADATA[groupKey];
      const label = language === "pt" ? meta.pt : meta.en;
      
      return {
        name: groupKey,
        label,
        amount: parseFloat(stat.total.toFixed(2)),
        itemCount: stat.count,
        percentage: grandTotal > 0 ? (stat.total / grandTotal) * 100 : 0,
        itemsList: stat.items.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()),
        color: meta.color
      };
    }).sort((a, b) => b.amount - a.amount);

    const activeGroups = groupsList.filter(g => g.amount > 0);
    const topGroup = activeGroups.length > 0 ? activeGroups[0] : null;

    return {
      grandTotal,
      allGroups: groupsList,
      activeGroups,
      topGroup,
      totalItemsCount: filteredGenericItems.length
    };
  }, [filteredGenericItems, language]);

  const toggleCategoryExpand = (catName: string) => {
    setExpandedCategory(prev => (prev === catName ? null : catName));
  };

  // Find all unique chronological months (ascending order)
  const chronologicalMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    genericItems.forEach(item => {
      if (item.purchaseDate) {
        const match = item.purchaseDate.substring(0, 7);
        if (/^\d{4}-\d{2}$/.test(match)) {
          monthsSet.add(match);
        }
      }
    });
    return Array.from(monthsSet).sort((a, b) => a.localeCompare(b));
  }, [genericItems]);

  // Map each month to its total expenditure
  const monthlySpendingMap = useMemo(() => {
    const map: Record<string, number> = {};
    chronologicalMonths.forEach(m => {
      map[m] = 0;
    });
    genericItems.forEach(item => {
      if (item.purchaseDate) {
        const m = item.purchaseDate.substring(0, 7);
        if (map[m] !== undefined) {
          map[m] += item.amount;
        }
      }
    });
    return map;
  }, [genericItems, chronologicalMonths]);

  // Compute the MoM comparisons
  const comparisonData = useMemo(() => {
    return chronologicalMonths.map((m, index) => {
      const curValue = monthlySpendingMap[m] || 0;
      
      let pctChange = 0;
      let hasPrecedingMonth = false;
      let prevMonthLabel = "";
      let prevValue = 0;
      
      if (index > 0) {
        hasPrecedingMonth = true;
        const prevM = chronologicalMonths[index - 1];
        prevValue = monthlySpendingMap[prevM] || 0;
        
        const [prevY, prevMo] = prevM.split("-");
        const prevDate = new Date(parseInt(prevY), parseInt(prevMo) - 1, 15);
        prevMonthLabel = prevDate.toLocaleString(language === "pt" ? "pt-BR" : "en-US", { month: "short", year: "numeric" });
        
        if (prevValue > 0) {
          pctChange = ((curValue - prevValue) / prevValue) * 100;
        } else if (curValue > 0) {
          pctChange = 100;
        }
      }
      
      const [yr, mo] = m.split("-");
      const curDate = new Date(parseInt(yr), parseInt(mo) - 1, 15);
      const name = curDate.toLocaleString(language === "pt" ? "pt-BR" : "en-US", { month: "short", year: "numeric" });
      
      return {
        monthKey: m,
        name,
        value: parseFloat(curValue.toFixed(2)),
        prevValue: parseFloat(prevValue.toFixed(2)),
        percentage: parseFloat(pctChange.toFixed(1)),
        hasPrecedingMonth,
        prevMonthLabel,
        color: pctChange > 0 ? "#ef4444" : pctChange < 0 ? "#10b981" : "#94a3b8"
      };
    });
  }, [chronologicalMonths, monthlySpendingMap, language]);

  // Handle empty state (where database has zero items overall)
  if (genericItems.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center max-w-2xl mx-auto animate-fade-in shadow-xs my-6">
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100 text-emerald-500">
          <Layers className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          {language === "pt" ? "Nenhuma Despesa Registrada" : "No Spending Data Available"}
        </h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
          {language === "pt"
            ? "Por favor, faça upload de notas fiscais ou insira custos fixos para visualizar Spendings Analíticos categorizados."
            : "Please upload grocery receipts, log purchases, or record custom fixed expenses to view dynamic categorized spendings."}
        </p>
        <div className="mt-6">
          <button
            onClick={onBack}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {language === "pt" ? "Voltar" : "Back"}
          </button>
        </div>
      </div>
    );
  }

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-lg border border-slate-800 text-xs shadow-md">
          <p className="font-semibold">{data.name}</p>
          <p className="font-mono text-emerald-400 mt-0.5">{formatCurrency(data.value)}</p>
          <p className="text-slate-400 text-[10px] mt-0.5">{data.percentage}%</p>
        </div>
      );
    }
    return null;
  };

  const comparisonTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const pctValue = data.percentage;
      const isPositive = pctValue >= 0;
      
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-lg border border-slate-800 text-xs shadow-md space-y-1.5 font-sans leading-relaxed">
          <p className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-1 text-[13px]">
            {data.name}
          </p>
          <div className="flex justify-between gap-5">
            <span className="text-slate-400 font-medium">
              {language === "pt" ? "Total Gasto:" : "Total Spent:"}
            </span>
            <span className="font-mono font-bold text-white">
              {formatCurrency(data.value)}
            </span>
          </div>
          {data.hasPrecedingMonth ? (
            <>
              <div className="flex justify-between gap-5">
                <span className="text-slate-400 font-medium">
                  {language === "pt" ? `Mês Anterior (${data.prevMonthLabel}):` : `Previous Month (${data.prevMonthLabel}):`}
                </span>
                <span className="font-mono text-slate-300">
                  {formatCurrency(data.prevValue)}
                </span>
              </div>
              <div className="flex justify-between gap-5 border-t border-slate-800 pt-1.5">
                <span className="text-slate-400 font-medium">
                  {language === "pt" ? "Diferença (MoM):" : "Difference (MoM):"}
                </span>
                <span className={`font-mono font-bold ${isPositive ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isPositive ? "+" : ""}{pctValue}%
                </span>
              </div>
            </>
          ) : (
            <p className="text-[10px] text-slate-500 italic pt-1">
              {language === "pt" ? "Primeiro mês disponível" : "First month available"}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header section without standard switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <button
            onClick={onBack}
            className="group mb-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" /> 
            {language === "pt" ? "Voltar" : "Back to previous screen"}
          </button>
          <h1 className="text-xl font-bold text-slate-950 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" /> {language === "pt" ? "Análise de Despesas por Grupo" : "Spending Breakdown"}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {language === "pt"
              ? "Despesas organizadas em quatro grupos principais: Insumos (Supplies), Limpeza (Cleaning), Fixas (Fixed) e Variáveis (Variable)"
              : "Expenses split into four major operational pillars: Supplies, Cleaning, Fixed, and Variable"}
          </p>
        </div>
      </div>

      {/* Stats Bento Grid Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {/* Total Spent */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4 shadow-2xs">
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-emerald-600 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{language === "pt" ? "Total Gasto" : "Total Spent"}</p>
            <h3 className="text-lg font-bold text-slate-900 mt-1 font-mono">
              {formatCurrency(breakdownStats.grandTotal)}
            </h3>
          </div>
        </div>

        {/* Item Counts - Redesigned to TOTAL INVOICES */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4 shadow-2xs">
          <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-indigo-600 shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {language === "pt" ? "TOTAL DE NOTAS" : "TOTAL INVOICES"}
            </p>
            <h3 className="text-lg font-bold text-slate-900 mt-1 font-mono">
              {totalInvoicesCount}
            </h3>
          </div>
        </div>

        {/* Month Selector Bento Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col justify-center gap-3 shadow-2xs">
          <div className="flex items-center gap-4">
            <div className="bg-violet-50 p-3 rounded-xl border border-violet-100 text-violet-600 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {language === "pt" ? "Mês:" : "Month:"}
              </p>
            </div>
          </div>
          <div className="w-full">
            <select
              id="spending-month-selector"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setExpandedCategory(null);
              }}
              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-2xs font-sans"
            >
              <option value="all">
                {language === "pt" ? `Todos os Meses (${genericItems.length} itens)` : `All Months (${genericItems.length} items)`}
              </option>
              {uniqueMonths.map(month => (
                <option key={month} value={month}>
                  {formatMonthLabel(month)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Breakdown Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: List of Groups with Expandable Items */}
        <div className="lg:col-span-12 xl:col-span-7 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs">
            
            {/* Header without Month Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600" /> {language === "pt" ? "Alocação Detalhada de Despesas" : "Expense Allocation Details"}
              </h2>
            </div>
            
            {breakdownStats.activeGroups.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 leading-normal">
                {language === "pt" 
                  ? "Nenhum custo registrado para o período de tempo correspondente."
                  : "No custom transactions mapped for the selected period."}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {breakdownStats.allGroups.map((grp) => {
                  const isSelected = expandedCategory === grp.name;
                  const progressColor = grp.color;
                  const absoluteSpend = grp.amount || 0;
                  
                  return (
                    <div key={grp.name} className="py-3.5 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: progressColor }}
                            />
                            <span className="text-xs font-bold text-slate-900">{grp.label}</span>
                            <span className="text-[10px] text-slate-400 font-medium">({grp.itemCount} {language === "pt" ? "registros" : "log entries"})</span>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${grp.percentage}%`,
                                backgroundColor: progressColor
                              }}
                            />
                          </div>
                        </div>

                        {/* Right Details */}
                        <div className="text-right shrink-0">
                          <span className="font-mono text-xs font-bold text-slate-900 block">
                            {formatCurrency(absoluteSpend)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold block">
                            {grp.percentage.toFixed(1)}%
                          </span>
                        </div>

                        {/* Clickable folder expand block */}
                        {grp.itemCount > 0 && (
                          <button
                            onClick={() => toggleCategoryExpand(grp.name)}
                            className="p-1 rounded-lg hover:bg-slate-50 border border-slate-100 hover:border-slate-200/60 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                            title={isSelected ? "Collapse list" : "Expand purchases"}
                          >
                            {isSelected ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                      </div>

                      {/* Drilldown Section: List items belonging to this group */}
                      {isSelected && grp.itemCount > 0 && (
                        <div className="mt-3.5 pl-4 ml-1.5 border-l-2 border-emerald-100 space-y-1.5 animate-slide-down">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                            {language === "pt" ? "Log de Itens & Custos" : "Purchases & Costs Log"}
                          </p>
                          <div className="max-h-60 overflow-y-auto pr-1 space-y-2 divide-y divide-slate-50">
                            {grp.itemsList.map((item, idx) => {
                              return (
                                <div key={`${item.name}-${idx}`} className="flex items-center justify-between text-xs pt-1.5 first:pt-1">
                                  <div className="min-w-0 pr-3">
                                    <p className="font-semibold text-slate-800 truncate" title={item.name}>
                                      {item.name}
                                    </p>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5 font-mono">
                                      <span className="flex items-center gap-0.5">
                                        <Calendar className="w-3 h-3 shrink-0" />
                                        {item.purchaseDate}
                                      </span>
                                      {item.type === "item" ? (
                                        <span>
                                          Qty: {item.quantity} × {formatCurrency(item.price)}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 px-1 py-0.2 rounded font-sans uppercase font-bold tracking-wider">
                                          {language === "pt" ? "Despesa Fixa" : "Fixed cost"}
                                        </span>
                                      )}
                                      <span className="bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-[9px] text-slate-500">
                                        {item.category}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0 font-mono font-medium text-slate-700">
                                    {formatCurrency(item.amount)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recharts Chart Frame */}
        <div className="lg:col-span-12 xl:col-span-5">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs sticky top-4">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>{language === "pt" ? "Comparação Mensal" : "Monthly Comparison"}</span>
              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-sm font-semibold uppercase tracking-wider">
                MoM % Variation
              </span>
            </h2>

            {comparisonData.length === 0 ? (
              <div className="py-20 text-center text-xs text-slate-400 leading-normal">
                {language === "pt" ? "Nenhuma compra registrada para gerar gráficos." : "No purchases registered to display charts."}
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={comparisonData}
                    margin={{ top: 15, right: 10, left: -25, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: "#64748b", fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: "#64748b", fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
                    <RechartsTooltip content={comparisonTooltip} />
                    <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
                      {comparisonData.map((entry, index) => {
                        return <Cell key={`cell-${index}`} fill={entry.color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-center gap-6 text-[10px] text-slate-500 font-medium select-none">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                {language === "pt" ? "Redução nos Gastos (- MoM)" : "Savings / Spending Reduction (- MoM)"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                {language === "pt" ? "Aumento nos Gastos (+ MoM)" : "Increased Spending (+ MoM)"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
