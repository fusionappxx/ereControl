import React, { useState, useEffect, useMemo } from "react";
import { 
  ArrowLeft, 
  Coins, 
  Plus, 
  Trash2, 
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  Briefcase
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { formatCurrency, getGlobalCurrency } from "../utils";

interface FixedExpense {
  id: string;
  name: string;
  month: string;
  value: number;
}

interface FixedExpensesScreenProps {
  language?: "en" | "pt";
  onBack: () => void;
  hideHeader?: boolean;
}

export default function FixedExpensesScreen({ language = "en", onBack, hideHeader = false }: FixedExpensesScreenProps) {
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
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

  // Active month filter for view and calculations - default to current month
  const [filterMonth, setFilterMonth] = useState(() => {
    const today = new Date();
    const monthsPt = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthsEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return language === "pt" ? monthsPt[today.getMonth()] : monthsEn[today.getMonth()];
  });

  // Form controls
  const [expenseName, setExpenseName] = useState("");
  const [expenseMonth, setExpenseMonth] = useState(() => {
    const today = new Date();
    const monthsPt = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthsEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return language === "pt" ? monthsPt[today.getMonth()] : monthsEn[today.getMonth()];
  });
  const [expenseValue, setExpenseValue] = useState("");

  // Load fixed expenses in real-time
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
          value: Number(data.value) || 0
        });
      });
      // Sort: newest first
      setExpenses(list);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "fixed_expenses");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(item => item.month.trim().toLowerCase() === filterMonth.trim().toLowerCase());
  }, [expenses, filterMonth]);

  const totalSum = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + item.value, 0);
  }, [filteredExpenses]);

  const dailyAmortized = useMemo(() => {
    return totalSum / 30;
  }, [totalSum]);

  const fixedCostTax = useMemo(() => {
    return totalSum / monthlyVolume;
  }, [totalSum, monthlyVolume]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = expenseName.trim();
    const val = parseFloat(expenseValue);
    if (!name || isNaN(val) || val <= 0) return;

    try {
      await addDoc(collection(db, "fixed_expenses"), {
        name,
        month: expenseMonth,
        value: val,
        createdAt: new Date().toISOString()
      });
      setExpenseName("");
      setExpenseValue("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "fixed_expenses");
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteDoc(doc(db, "fixed_expenses", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `fixed_expenses/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-4">
          {!hideHeader && (
            <button
              onClick={onBack}
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 active:bg-slate-100 rounded-xl transition-all shadow-3xs cursor-pointer flex items-center justify-center"
              title={language === "pt" ? "Voltar ao Início" : "Back to Home"}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            {hideHeader ? (
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-5 h-5 text-amber-550" />
                {language === "pt" ? "Demonstrativo de Despesas Fixas" : "Fixed Expenses Sheet"}
              </h3>
            ) : (
              <>
                <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                  <Coins className="w-5.5 h-5.5 text-amber-550" />
                  <span>{language === "pt" ? "Demonstrativo de Despesas Fixas" : "Fixed Expenses Sheet"}</span>
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {language === "pt"
                    ? "Registre custos recorrentes mensais de sua operação para distribuição inteligente"
                    : "Register recurring monthly operational expenses for seamless kitchen cost amortization"}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Registered Month Selector */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl self-start sm:self-center shrink-0">
          <Calendar className="w-4 h-4 text-amber-550 ml-1" />
          <span className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">
            {language === "pt" ? "Mês Registrado:" : "Registered Month:"}
          </span>
          <select
            value={filterMonth}
            onChange={(e) => {
              setFilterMonth(e.target.value);
              setExpenseMonth(e.target.value);
            }}
            className="bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
          >
            {(language === "pt" 
              ? ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
              : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
            ).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Dashboard Analytics Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              {language === "pt" ? "Total Mensal" : "Total Monthly Sum"}
            </span>
            <span className="text-xl font-extrabold text-slate-900 block font-mono">
              {formatCurrency(totalSum)}
            </span>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              {language === "pt" ? "Rateio Diário (30 dias)" : "Daily Amortized (30 days)"}
            </span>
            <span className="text-xl font-extrabold text-slate-900 block font-mono">
              {formatCurrency(dailyAmortized)}
            </span>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              {language === "pt" ? "Taxa de Custo Fixo" : "Fixed Cost Tax"}
            </span>
            <span className="text-xl font-extrabold text-slate-900 block font-mono">
              {formatCurrency(fixedCostTax)}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Left Column: Form Builder */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-3">
            <Briefcase className="w-4 h-4 text-amber-550" />
            {language === "pt" ? "Novo Custo Fixo" : "Add Fixed Expense"}
          </h3>

          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {language === "pt" ? "Nome da Despesa" : "Expense Description"}
              </label>
              <input
                type="text"
                required
                placeholder={language === "pt" ? "ex: Aluguel da Cozinha, Internet, Contabilidade" : "e.g., Kitchen Rent, Accounting, Staff wage"}
                value={expenseName}
                onChange={(e) => setExpenseName(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl block w-full p-3 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {language === "pt" ? "Mês de Referência" : "Reference Month"}
              </label>
              <select
                value={expenseMonth}
                onChange={(e) => setExpenseMonth(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl block w-full p-3 focus:ring-amber-500 focus:outline-none cursor-pointer"
              >
                {(language === "pt" 
                  ? ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
                  : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
                ).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {language === "pt" ? "Valor de Gasto" : "Value Amount"}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none text-xs font-bold font-mono">
                  {getGlobalCurrency() === "BRL" ? "R$" : getGlobalCurrency() === "EUR" ? "€" : "$"}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={expenseValue}
                  onChange={(e) => setExpenseValue(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl block w-full pl-9 p-3 focus:ring-amber-500 focus:border-amber-500 focus:outline-none font-mono font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!expenseName.trim() || !expenseValue}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed hover:shadow-xs text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {language === "pt" ? "Adicionar Custo" : "Add Fixed Expense"}
            </button>
          </form>
        </div>

        {/* Right Column: Interactive Table */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-3">
            <Calendar className="w-4 h-4 text-blue-500" />
            {language === "pt" ? "Custos Fixos Ativos" : "Active Monthly Outlays"}
          </h3>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs text-center space-y-2">
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              <p>{language === "pt" ? "Carregando despesas fixas..." : "Loading fixed expenses..."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-xl bg-slate-50/5">
              <table className="w-full text-left border-collapse min-w-[400px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="p-3.5 pl-4">{language === "pt" ? "Descrição" : "Description"}</th>
                    <th className="p-3.5">{language === "pt" ? "Mês" : "Month"}</th>
                    <th className="p-3.5 text-right">{language === "pt" ? "Valor de Despesa" : "Expense Amount"}</th>
                    <th className="p-3.5 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-xs text-slate-400 italic">
                        {language === "pt" 
                          ? `Nenhuma despesa fixa adicionada ainda para o mês de ${filterMonth}.` 
                          : `No fixed expenses added yet for ${filterMonth}.`}
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((itm) => (
                      <tr 
                        key={itm.id} 
                        className="border-b border-slate-100/70 hover:bg-slate-50/40 text-xs text-slate-700 transition-colors"
                      >
                        <td className="p-3.5 pl-4 font-semibold text-slate-800">{itm.name}</td>
                        <td className="p-3.5 text-slate-500 font-medium">{itm.month}</td>
                        <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(itm.value)}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(itm.id)}
                            className="p-1 px-2.5 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 hover:text-rose-700 transition-colors cursor-pointer"
                            title={language === "pt" ? "Excluir lançamento" : "Delete expense item"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
