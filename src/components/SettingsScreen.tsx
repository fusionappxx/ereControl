import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  Settings, 
  Sun, 
  Moon, 
  DollarSign, 
  Globe, 
  ArrowLeft,
  Check,
  Palette,
  Languages,
  CreditCard,
  FileText,
  Download,
  Trash2
} from "lucide-react";
import { translations } from "../translations";
import { OcrErrorLog } from "../types";
import { getOcrErrorLogs, clearOcrErrorLogs } from "../utils";

interface SettingsScreenProps {
  theme: "light" | "dark";
  currency: "USD" | "BRL" | "EUR";
  language: "en" | "pt";
  onThemeChange: (theme: "light" | "dark") => void;
  onCurrencyChange: (currency: "USD" | "BRL" | "EUR") => void;
  onLanguageChange: (lang: "en" | "pt") => void;
  onBack: () => void;
}

export default function SettingsScreen({
  theme,
  currency,
  language,
  onThemeChange,
  onCurrencyChange,
  onLanguageChange,
  onBack
}: SettingsScreenProps) {
  const t = translations[language];
  const [errorLogs, setErrorLogs] = useState<OcrErrorLog[]>(() => getOcrErrorLogs());
  const isPt = language === "pt";

  const handleDownloadLogFile = () => {
    if (errorLogs.length === 0) return;
    
    let content = `========================================\n`;
    content += `   ERECKITCHEN SCANNER ERROR LOG\n`;
    content += `   Exported on: ${new Date().toISOString()}\n`;
    content += `========================================\n\n`;
    
    errorLogs.forEach((log, index) => {
      content += `Error Entry #${index + 1}\n`;
      content += `----------------------------------------\n`;
      content += `File Name    : ${log.fileName}\n`;
      content += `Upload Date  : ${log.uploadDate} (${new Date(log.uploadDate).toLocaleString()})\n`;
      content += `Error Message: ${log.error}\n`;
      content += `\n`;
    });
    
    content += `========================================\n`;
    content += `End of Logs (${errorLogs.length} entries recorded).\n`;
    
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ocr_upload_error_log_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClearLogFile = () => {
    clearOcrErrorLogs();
    setErrorLogs([]);
  };

  // Config options configuration
  const themesList = [
    { id: "light" as const, label: t.lightTheme, icon: Sun, color: "text-amber-500 bg-amber-50 dark:bg-slate-800/60" },
    { id: "dark" as const, label: t.darkTheme, icon: Moon, color: "text-indigo-400 bg-indigo-950/45 dark:bg-slate-800/60" }
  ];

  const currenciesList = [
    { id: "USD" as const, name: t.dollar, symbol: "$", localeLabel: "en-US (USD)" },
    { id: "BRL" as const, name: t.brazilianReal, symbol: "R$", localeLabel: "pt-BR (BRL)" },
    { id: "EUR" as const, name: t.euro, symbol: "€", localeLabel: "de-DE (EUR)" }
  ];

  const languagesList = [
    { id: "en" as const, label: t.english, flag: "🇺🇸", locale: "English" },
    { id: "pt" as const, label: t.portuguese, flag: "🇧🇷", locale: "Português" }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="max-w-xl mx-auto space-y-6"
    >
      {/* Header section */}
      <div>
        <button
          onClick={onBack}
          className="group mb-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" /> 
          {t.returnToSubmit}
        </button>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
          <Settings className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> {t.settingsTitle}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          {t.settingsSubtitle}
        </p>
      </div>

      {/* Preferences Block Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-6 transition-colors">
        
        {/* Preference Section 1: Visual Theme Selector */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Palette className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {t.theme}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {themesList.map((item) => {
              const IconComp = item.icon;
              const isSelected = theme === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onThemeChange(item.id)}
                  className={`relative p-4 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    isSelected 
                      ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/15" 
                      : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/55"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${item.color}`}>
                      <IconComp className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.label}</span>
                  </div>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preference Section 2: Currency Switcher */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {t.currency}
          </h2>
          <div className="space-y-2">
            {currenciesList.map((item) => {
              const isSelected = currency === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onCurrencyChange(item.id)}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    isSelected 
                      ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/15" 
                      : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/55"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold font-mono ${
                      isSelected 
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    }`}>
                      {item.symbol}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{item.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{item.localeLabel}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-4.5 h-4.5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preference Section 3: Interface Language Selector */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Languages className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {t.language}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {languagesList.map((item) => {
              const isSelected = language === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onLanguageChange(item.id)}
                  className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    isSelected 
                      ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/15" 
                      : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/55"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" role="img" aria-label={item.locale}>{item.flag}</span>
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">{item.label}</span>
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest">{item.id === "en" ? "EN_US" : "PT_BR"}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preference Section 4: OCR & Upload Errors Logs */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {isPt ? "Histórico de Erros & Diagnósticos" : "Error Log & Diagnostics"}
          </h2>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {isPt 
              ? "Lista de falhas de processamento ou erros de OCR ao enviar cupons fiscais" 
              : "Review image processing or AI OCR scanning error logs encountered during receipt uploads"}
          </p>

          <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isPt ? "Entradas Gravadas:" : "Logged errors count:"}
              </span>
              <span className={`font-mono text-xs px-2.5 py-0.5 rounded-md font-bold ${
                errorLogs.length > 0 
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400" 
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}>
                {errorLogs.length}
              </span>
            </div>

            {errorLogs.length > 0 && (
              <div 
                className="max-h-[140px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden"
              >
                {errorLogs.map((log) => (
                  <div key={log.id} className="p-2.5 text-[11px] transition-colors">
                    <div className="flex justify-between items-start text-slate-505 dark:text-slate-400 font-medium mb-1.5">
                      <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded truncate max-w-[140px] md:max-w-[200px]" title={log.fileName}>
                        {log.fileName}
                      </span>
                      <span className="font-mono text-[9px] text-slate-400 text-right">
                        {new Date(log.uploadDate).toLocaleString(isPt ? "pt-BR" : "en-US")}
                      </span>
                    </div>
                    <p className="font-mono font-semibold text-rose-600 dark:text-rose-400 leading-relaxed pl-1 border-l border-rose-200 dark:border-rose-900/50 break-all select-all">
                      {log.error}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1 border-t border-slate-100/40 dark:border-slate-800/20">
              <button
                type="button"
                id="download-error-log-btn"
                onClick={handleDownloadLogFile}
                disabled={errorLogs.length === 0}
                className={`flex-1 text-xs font-bold py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  errorLogs.length > 0 
                    ? "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-200" 
                    : "bg-slate-100/40 border-slate-200/40 text-slate-350 cursor-not-allowed dark:bg-slate-900/40 dark:border-slate-800/40 dark:text-slate-600"
                }`}
                title={isPt ? "Baixar arquivo de registro .txt" : "Download comprehensive error record as .txt"}
              >
                <Download className="w-3.5 h-3.5" />
                {isPt ? "Baixar Log" : "Download Log file"}
              </button>
              
              <button
                type="button"
                id="clear-error-log-btn"
                onClick={handleClearLogFile}
                disabled={errorLogs.length === 0}
                className={`flex-1 text-xs font-bold py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  errorLogs.length > 0 
                    ? "bg-rose-50/50 hover:bg-rose-100 border-rose-200 hover:border-rose-300 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 dark:border-rose-900/60 dark:text-rose-450" 
                    : "bg-slate-100/40 border-slate-200/40 text-slate-350 cursor-not-allowed dark:bg-slate-900/40 dark:border-slate-800/40 dark:text-slate-600"
                }`}
                title={isPt ? "Limpar todos os registros salvos localmente" : "Clear all currently logged entries locally"}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isPt ? "Limpar Log" : "Clear Log"}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Dismiss Button row */}
      <div className="flex justify-end pt-3">
        <button
          onClick={onBack}
          className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl cursor-pointer shadow-md shadow-emerald-500/10 transition-all flex items-center gap-1.5"
        >
          {t.saveSettings}
        </button>
      </div>
    </motion.div>
  );
}
