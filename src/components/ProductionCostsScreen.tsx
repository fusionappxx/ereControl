import React, { useState, useEffect, useMemo } from "react";
import { 
  ArrowLeft, 
  Zap, 
  Droplet, 
  Flame, 
  Settings,
  Scale,
  DollarSign,
  TrendingUp,
  Clock,
  Sparkles,
  CloudLightning,
  AlertCircle
} from "lucide-react";
import { db } from "../firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { formatCurrency, getGlobalCurrency } from "../utils";

interface ProductionCosts {
  water: number;
  electricity: number;
  gas: number;
  electricity2: number;
}

interface ProductionCostsScreenProps {
  language?: "en" | "pt";
  onBack: () => void;
  hideHeader?: boolean;
}

export default function ProductionCostsScreen({ language = "en", onBack, hideHeader = false }: ProductionCostsScreenProps) {
  const [costs, setCosts] = useState<ProductionCosts>({
    water: 0,
    electricity: 0,
    gas: 0,
    electricity2: 0
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [monthlyVolume, setMonthlyVolume] = useState<number>(1500);

  // Load monthly volume and app tax in real-time
  useEffect(() => {
    const docRef = doc(db, "settings", "volume_and_app_tax");
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setMonthlyVolume(Number(data.monthlyVolume) || 1500);
      }
    }, (err) => {
      console.error("Error loading monthly volume setting:", err);
    });
    return () => unsubscribe();
  }, []);

  // Load production costs setting in real-time
  useEffect(() => {
    const docRef = doc(db, "settings", "production_costs");
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setCosts({
          water: Number(data.water) || 0,
          electricity: Number(data.electricity) || 0,
          gas: Number(data.gas) || 0,
          electricity2: Number(data.electricity2) || 0
        });
      }
      setIsLoading(false);
    }, (err) => {
      console.error("Error loading production costs:", err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const totalSum = useMemo(() => {
    return costs.water + costs.electricity + costs.gas + costs.electricity2;
  }, [costs]);

  const unitCost = useMemo(() => {
    return totalSum / monthlyVolume;
  }, [totalSum, monthlyVolume]);

  const dailyAverageSum = useMemo(() => {
    return totalSum / 30;
  }, [totalSum]);

  const handleUpdateField = async (field: keyof ProductionCosts, valueStr: string) => {
    const value = parseFloat(valueStr);
    const sanitizedValue = isNaN(value) || value < 0 ? 0 : value;
    
    // Optimistic state update
    const updated = {
      ...costs,
      [field]: sanitizedValue
    };
    setCosts(updated);

    try {
      setIsSaving(true);
      const docRef = doc(db, "settings", "production_costs");
      await setDoc(docRef, updated);
      setIsSaving(false);
    } catch (err) {
      console.error("Error saving production costs field:", err);
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          {!hideHeader && (
            <button
              onClick={onBack}
              className="p-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center"
              title="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            {hideHeader ? (
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-5 h-5 text-amber-550 animate-pulse" />
                {language === "pt" ? "Custos de Produção & Utilidades" : "Direct Production & Utility Costs"}
              </h3>
            ) : (
              <>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  <Zap className="w-5.5 h-5.5 text-amber-550 animate-pulse" />
                  {language === "pt" ? "Custos de Produção & Utilidades" : "Direct Production & Utility Costs"}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {language === "pt"
                    ? "Aloque taxas diretas de insumos operacionais essenciais (luz, água, gás de cozinha, etc.)"
                    : "Manage direct manufacturing utility rates such as electricity, baking gas cylinder refills, and water rates"}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Sync indicators */}
        <div className="flex items-center gap-2 self-start sm:self-center text-[11px] font-semibold text-slate-400 bg-slate-50 border border-slate-100 px-3.5 py-1.5 rounded-xl">
          <div className={`w-1.5 h-1.5 rounded-full ${isSaving ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
          <span>
            {isSaving 
              ? (language === "pt" ? "Sincronizando..." : "Saving to cloud...") 
              : (language === "pt" ? "Nuvem Sincronizada" : "Cloud Saved")
            }
          </span>
        </div>
      </div>

      {/* Hero Tip Card */}
      <div className="bg-amber-50 border border-amber-200/50 rounded-2xl p-4.5 flex items-start gap-4 shadow-3xs">
        <div className="p-3 bg-white text-amber-600 rounded-xl border border-amber-100 shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-900">
            {language === "pt" ? "Como funcionam os Custos de Produção?" : "How do Direct Utility Costs work?"}
          </h4>
          <p className="text-[11px] text-slate-600 leading-normal max-w-2xl">
            {language === "pt"
              ? "Custos de Produção são despesas variáveis de serviços consumidos diretamente para criar seus produtos. Estimar o rateio de gás, água e eletricidade é fundamental para gerar uma precificação de markup precisa em suas Fichas Técnicas."
              : "Direct production utilities represent variables consumed as a outcome of running baking equipment and kitchen sinks. Filling in these average estimates will help auto-amortize utilities into your dynamic Recipe Costing Sheets."}
          </p>
        </div>
      </div>

      {/* Main Grid: Inputs vs Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Left Columns: Parameters list (size 2) */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-5">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-3">
            <Settings className="w-4 h-4 text-slate-400" />
            {language === "pt" ? "Parâmetros do Rateio de Insumos" : "Direct Utility Parameters"}
          </h3>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs text-center space-y-2">
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              <p>{language === "pt" ? "Conectando ao banco de utilidades..." : "Connecting utility database..."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Parameter 1: Water */}
              <div className="space-y-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-blue-500 shrink-0" />
                  {language === "pt" ? "Custos de Água" : "Water Base Cost"}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none text-xs font-bold font-mono">
                    {getGlobalCurrency() === "BRL" ? "R$" : getGlobalCurrency() === "EUR" ? "€" : "$"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={costs.water || ""}
                    onChange={(e) => handleUpdateField("water", e.target.value)}
                    className="bg-white border border-slate-200 text-slate-900 text-xs rounded-xl block w-full pl-9 p-3 focus:ring-amber-500 focus:border-amber-500 focus:outline-none font-mono font-bold"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block leading-normal">
                  {language === "pt" 
                    ? "Soma total ou estimativa direta proporcional de água na produção"
                    : "Direct water volume rate or proportional allocation"}
                </span>
              </div>

              {/* Parameter 2: Electricity */}
              <div className="space-y-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                  <CloudLightning className="w-4 h-4 text-amber-500 shrink-0" />
                  {language === "pt" ? "Eletricidade dos Fornos" : "Energy / Baking Power"}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none text-xs font-bold font-mono">
                    {getGlobalCurrency() === "BRL" ? "R$" : getGlobalCurrency() === "EUR" ? "€" : "$"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={costs.electricity || ""}
                    onChange={(e) => handleUpdateField("electricity", e.target.value)}
                    className="bg-white border border-slate-200 text-slate-900 text-xs rounded-xl block w-full pl-9 p-3 focus:ring-amber-500 focus:border-amber-500 focus:outline-none font-mono font-bold"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block leading-normal">
                  {language === "pt" 
                    ? "Gasto com energia elétrica de fornos, batedeiras e freezers"
                    : "Baking equipment electricity consumption factor"}
                </span>
              </div>

              {/* Parameter 3: Gas */}
              <div className="space-y-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                  {language === "pt" ? "Gás de Cozinha" : "Gas Cylinder"}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none text-xs font-bold font-mono">
                    {getGlobalCurrency() === "BRL" ? "R$" : getGlobalCurrency() === "EUR" ? "€" : "$"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={costs.gas || ""}
                    onChange={(e) => handleUpdateField("gas", e.target.value)}
                    className="bg-white border border-slate-200 text-slate-900 text-xs rounded-xl block w-full pl-9 p-3 focus:ring-amber-500 focus:border-amber-500 focus:outline-none font-mono font-bold"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block leading-normal">
                  {language === "pt" 
                    ? "Custo estimado com reposição de botijão de gás (GLP ou GN)"
                    : "LPG cylinders/ovens heating resources estimate"}
                </span>
              </div>

              {/* Parameter 4: Electricity Extra */}
              <div className="space-y-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                  <Settings className="w-4 h-4 text-indigo-500 shrink-0" />
                  {language === "pt" ? "Manutenção Personalizada" : "Custom Maintenance"}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none text-xs font-bold font-mono">
                    {getGlobalCurrency() === "BRL" ? "R$" : getGlobalCurrency() === "EUR" ? "€" : "$"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={costs.electricity2 || ""}
                    onChange={(e) => handleUpdateField("electricity2", e.target.value)}
                    className="bg-white border border-slate-200 text-slate-900 text-xs rounded-xl block w-full pl-9 p-3 focus:ring-amber-500 focus:border-amber-500 focus:outline-none font-mono font-bold"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block leading-normal">
                  {language === "pt" 
                    ? "Custos com manutenção personalizada ou reparos operacionais"
                    : "Costs for custom maintenance or operational repairs"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Visual Summary */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-3">
            <Scale className="w-4 h-4 text-emerald-500" />
            {language === "pt" ? "Resumo Financeiro Direto" : "Direct Financial Spread"}
          </h3>

          <div className="space-y-4">
            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-6 text-center">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">
                {language === "pt" ? "Custo Unitário" : "Unit Cost"}
              </span>
              <span className="text-2xl font-black text-slate-900 font-mono tracking-tight text-emerald-600">
                {formatCurrency(unitCost)}
              </span>
            </div>

            <div className="space-y-2.5 pt-1.5">
              {/* Utility item 1 */}
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-2 font-medium">
                  <Droplet className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  {language === "pt" ? "Água" : "Water Base"}
                </span>
                <span className="font-semibold font-mono text-slate-800">{formatCurrency(costs.water)}</span>
              </div>

              {/* Utility item 2 */}
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-2 font-medium">
                  <CloudLightning className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  {language === "pt" ? "Fornos / Equipamentos" : "Active Baking"}
                </span>
                <span className="font-semibold font-mono text-slate-800">{formatCurrency(costs.electricity)}</span>
              </div>

              {/* Utility item 3 */}
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-2 font-medium">
                  <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  {language === "pt" ? "Gás" : "Cooking Gas"}
                </span>
                <span className="font-semibold font-mono text-slate-800">{formatCurrency(costs.gas)}</span>
              </div>

              {/* Utility item 4 */}
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-2 font-medium">
                  <Settings className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  {language === "pt" ? "Manutenção Personalizada" : "Custom Maintenance"}
                </span>
                <span className="font-semibold font-mono text-slate-800">{formatCurrency(costs.electricity2)}</span>
              </div>

              {/* Direct Production & Utility Costs Sum Row */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-800 font-bold">
                <span className="flex items-center gap-2">
                  <Scale className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  {language === "pt" ? "Custos de Produção & Utilidades" : "Direct Production & Utility Costs"}
                </span>
                <span className="font-semibold font-mono text-slate-900">{formatCurrency(totalSum)}</span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-800 font-bold">
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  {language === "pt" ? "Média Diária Proporcional" : "Interim Daily Overhead"}
                </span>
                <span className="font-mono text-emerald-650 font-extrabold">{formatCurrency(dailyAverageSum)}</span>
              </div>
            </div>

            {/* Note alert card */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5 text-[10px] text-blue-600 mt-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {language === "pt"
                  ? "Sua ficha técnica poderá puxar esta base de dados para incluir uma porção exata deste rateio no produto final."
                  : "Your Recipe costing sheets can automatically pull this direct database to calculate portion-level utility amortizations."}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
