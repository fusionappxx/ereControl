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
  Trash2,
  Database,
  UploadCloud,
  ShieldCheck,
  Loader2
} from "lucide-react";
import { translations } from "../translations";
import { OcrErrorLog } from "../types";
import { getOcrErrorLogs, clearOcrErrorLogs, safeStorage } from "../utils";
import { db } from "../firebase";
import { collection, doc, getDocs, getDoc, setDoc } from "firebase/firestore";

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

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const storageKeys = [
        "orders_list",
        "orders_channel_configs",
        "orders_integrations",
        "grocery_theme",
        "grocery_currency",
        "grocery_language",
        "grocery_custom_photos",
        "ocr_error_logs",
        "costing_sheets_initial_subtab"
      ];
      const storageData: Record<string, string | null> = {};
      storageKeys.forEach(key => {
        storageData[key] = safeStorage.getItem(key);
      });

      const collectionsToBackup = [
        "items",
        "recipes",
        "fixed_expenses",
        "channel_matrix",
        "sales_logs",
        "inventory_reports",
        "product_costings"
      ];
      
      const firestoreCollectionsData: Record<string, any[]> = {};
      
      for (const colName of collectionsToBackup) {
        try {
          const snapshot = await getDocs(collection(db, colName));
          const docsList = snapshot.docs.map(d => ({
            id: d.id,
            data: d.data()
          }));
          firestoreCollectionsData[colName] = docsList;
        } catch (colErr) {
          console.warn(`Could not backup collection ${colName}:`, colErr);
          firestoreCollectionsData[colName] = [];
        }
      }

      const docsToBackup = [
        { path: "settings", id: "store_config" },
        { path: "settings", id: "production_costs" },
        { path: "settings", id: "volume_and_app_tax" },
        { path: "settings", id: "inventory" },
        { path: "configs", id: "categories" },
        { path: "configs", id: "rules" }
      ];

      const firestoreDocumentsData: Record<string, any> = {};

      for (const docInfo of docsToBackup) {
        const pathKey = `${docInfo.path}/${docInfo.id}`;
        try {
          const docSnap = await getDoc(doc(db, docInfo.path, docInfo.id));
          if (docSnap.exists()) {
            firestoreDocumentsData[pathKey] = docSnap.data();
          } else {
            firestoreDocumentsData[pathKey] = null;
          }
        } catch (docErr) {
          console.warn(`Could not backup document ${pathKey}:`, docErr);
          firestoreDocumentsData[pathKey] = null;
        }
      }

      const backupPayload = {
        version: 1,
        appName: "ErecKitchen",
        timestamp: new Date().toISOString(),
        localStorage: storageData,
        firestore: {
          collections: firestoreCollectionsData,
          documents: firestoreDocumentsData
        }
      };

      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const formattedDate = new Date().toISOString().split('T')[0];
      link.download = `ereckitchen_backup_${formattedDate}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatusMessage({
        text: isPt 
          ? "Backup exportado com sucesso!" 
          : "Backup successfully exported!",
        type: "success"
      });
    } catch (err: any) {
      console.error("Backup failed:", err);
      setStatusMessage({
        text: (isPt ? "Erro ao exportar backup: " : "Backup export failed: ") + (err.message || err),
        type: "error"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setStatusMessage(null);

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup || typeof backup !== "object" || backup.appName !== "ErecKitchen") {
        throw new Error(isPt ? "Arquivo de backup inválido." : "Invalid backup file.");
      }

      if (backup.localStorage && typeof backup.localStorage === "object") {
        Object.entries(backup.localStorage).forEach(([key, value]) => {
          if (value !== null && typeof value === "string") {
            safeStorage.setItem(key, value);
          }
        });
      }

      if (backup.firestore?.collections && typeof backup.firestore.collections === "object") {
        for (const [colName, docsList] of Object.entries(backup.firestore.collections)) {
          if (Array.isArray(docsList)) {
            for (const docObj of docsList) {
              if (docObj && docObj.id && docObj.data) {
                await setDoc(doc(db, colName, docObj.id), docObj.data);
              }
            }
          }
        }
      }

      if (backup.firestore?.documents && typeof backup.firestore.documents === "object") {
        for (const [pathKey, docData] of Object.entries(backup.firestore.documents)) {
          if (docData && typeof docData === "object") {
            const parts = pathKey.split("/");
            if (parts.length === 2) {
              const [colPath, docId] = parts;
              await setDoc(doc(db, colPath, docId), docData);
            }
          }
        }
      }

      setStatusMessage({
        text: isPt 
          ? "Backup importado com sucesso! Recarregando a página..." 
          : "Backup successfully imported! Reloading page...",
        type: "success"
      });

      event.target.value = "";

      setTimeout(() => {
        window.location.reload();
      }, 2500);

    } catch (err: any) {
      console.error("Import failed:", err);
      setStatusMessage({
        text: (isPt ? "Erro ao importar backup: " : "Backup import failed: ") + (err.message || err),
        type: "error"
      });
    } finally {
      setIsImporting(false);
    }
  };

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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 active:bg-slate-100 dark:active:bg-slate-700 rounded-xl transition-all shadow-3xs cursor-pointer flex items-center justify-center"
            title={language === "pt" ? "Voltar ao Início" : "Back to Home"}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
              <Settings className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> {t.settingsTitle}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {t.settingsSubtitle}
            </p>
          </div>
        </div>
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

        {/* Preference Section 5: Backup and Restore */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {isPt ? "Backup & Restauração" : "Backup & Restore"}
          </h2>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {isPt 
              ? "Exporte todos os seus dados e configurações do site em um único arquivo de backup, ou recupere um backup anterior." 
              : "Export all your site data and configuration into a single backup file, or restore from a previously exported backup."}
          </p>

          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            {statusMessage && (
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-150 text-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50 dark:bg-rose-950/20 border-rose-150 text-rose-800 dark:text-rose-300"
              }`}>
                {statusMessage.type === "success" ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <span className="text-base leading-none mt-0.5 flex-shrink-0">⚠️</span>
                )}
                <span className="font-semibold">{statusMessage.text}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                id="export-backup-btn"
                onClick={handleExport}
                disabled={isExporting || isImporting}
                className="w-full sm:flex-1 text-xs font-bold py-2.5 px-4 rounded-xl border bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isPt 
                  ? (isExporting ? "Exportando..." : "Exportar Backup") 
                  : (isExporting ? "Exporting..." : "Export Backup")}
              </button>

              <div className="w-full sm:flex-1 relative">
                <input
                  type="file"
                  id="import-backup-file-input"
                  accept=".json"
                  onChange={handleImport}
                  disabled={isExporting || isImporting}
                  className="hidden"
                />
                <button
                  type="button"
                  id="trigger-import-btn"
                  onClick={() => document.getElementById("import-backup-file-input")?.click()}
                  disabled={isExporting || isImporting}
                  className="w-full text-xs font-bold py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isImporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UploadCloud className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  )}
                  {isPt 
                    ? (isImporting ? "Importando..." : "Importar Backup") 
                    : (isImporting ? "Importing..." : "Import Backup")}
                </button>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center leading-normal">
              {isPt 
                ? "Nota: A importação irá sobrescrever os dados locais e do banco de dados correspondentes aos itens contidos no arquivo." 
                : "Note: Importing will overwrite matching database records and local settings with the values contained in the file."}
            </p>
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
