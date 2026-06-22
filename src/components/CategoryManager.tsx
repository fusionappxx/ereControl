import React, { useState, useMemo } from "react";
import { 
  Tag, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  HelpCircle, 
  Search,
  Settings,
  Sparkles
} from "lucide-react";
import { ReceiptItem } from "../types";

interface CategoryManagerProps {
  categories: string[];
  onAddCategory: (category: string) => void;
  onDeleteCategory: (category: string) => void;
  onUpdateCategory: (oldName: string, newName: string) => void;
  itemCategoryRules: Record<string, string>;
  onDeleteRule: (itemName: string) => void;
  onClearRules: () => void;
  items?: ReceiptItem[];
  language?: "en" | "pt";
}

export default function CategoryManager({
  categories,
  onAddCategory,
  onDeleteCategory,
  onUpdateCategory,
  itemCategoryRules,
  onDeleteRule,
  onClearRules,
  items = [],
  language = "en"
}: CategoryManagerProps) {
  // Local Category states
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [categoryError, setCategoryError] = useState("");

  // Local rule filter state
  const [ruleSearch, setRuleSearch] = useState("");

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

  // Handle category addition
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError("");
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCategoryError("Category name cannot be empty.");
      return;
    }
    if (categories.some(cat => cat.toLowerCase() === trimmed.toLowerCase())) {
      setCategoryError(`"${trimmed}" category already exists.`);
      return;
    }
    onAddCategory(trimmed);
    setNewCategoryName("");
  };

  // Start inline editing of category name
  const startEditing = (cat: string) => {
    setEditingCategory(cat);
    setEditingValue(cat);
    setCategoryError("");
  };

  // Save inline category rename
  const saveEditing = (oldCat: string) => {
    setCategoryError("");
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setCategoryError("Category name cannot be empty.");
      return;
    }
    if (trimmed.toLowerCase() === oldCat.toLowerCase()) {
      setEditingCategory(null);
      return;
    }
    if (categories.some(cat => cat.toLowerCase() === trimmed.toLowerCase() && cat.toLowerCase() !== oldCat.toLowerCase())) {
      setCategoryError(`"${trimmed}" category already exists.`);
      return;
    }
    onUpdateCategory(oldCat, trimmed);
    setEditingCategory(null);
  };

  // Cancel inline editing
  const cancelEditing = () => {
    setEditingCategory(null);
    setEditingValue("");
    setCategoryError("");
  };

  // Process rules search
  const filteredRules = Object.entries(itemCategoryRules).filter(([name, category]) => {
    const search = ruleSearch.toLowerCase();
    return name.includes(search) || category.toLowerCase().includes(search);
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xs transition-colors">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-6">
          <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 shadow-xs">
            <Tag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Category Management Drawer</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Define shopping categories and set identical product automation workflows</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Column A: Create & Edit Categories */}
          <div className="md:col-span-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
                🏷️ Edit Active Categories
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Add new labels or rename existing groups. All grocery dropdowns and filtering options auto-refresh accordingly.
              </p>
            </div>

            {/* Addition Form - Disabled */}
            <form onSubmit={(e) => e.preventDefault()} className="space-y-2 opacity-60">
              <label htmlFor="new-category-input" className="sr-only">New Category Name</label>
              <div className="flex gap-2">
                <input
                  id="new-category-input"
                  type="text"
                  placeholder={language === 'pt' ? "Criação desativada por políticas de exclusão" : "Category creation disabled by exclusion rules"}
                  value={newCategoryName}
                  disabled
                  className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-400 rounded-xl text-xs focus:outline-hidden cursor-not-allowed"
                />
                <button
                  type="button"
                  disabled
                  className="bg-slate-300 dark:bg-slate-800 text-slate-400 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </form>

            {/* List of categories */}
            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/20 dark:bg-slate-950/20 max-h-[340px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {sortedCategories.map((cat) => (
                <div key={cat} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/75 dark:hover:bg-slate-800/40 transition-colors">
                  {editingCategory === cat ? (
                    <div className="flex items-center gap-1.5 flex-1 mr-2">
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="flex-1 px-2.5 py-1 text-xs border border-emerald-500 rounded-lg focus:outline-hidden bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        autoFocus
                      />
                      <button
                        onClick={() => saveEditing(cat)}
                        className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded"
                        title="Save rename"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    (() => {
                      const isUsed = items.some(
                        (item) => (item.category || "").trim().toLowerCase() === cat.trim().toLowerCase()
                      );
                      return (
                        <>
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{cat}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEditing(cat)}
                              className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors"
                              title="Rename category"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (isUsed) {
                                  setCategoryError(
                                    language === "pt"
                                      ? `Não é possível excluir a categoria "${cat}" porque existem itens registrados nela.`
                                      : `Cannot delete category "${cat}" because there are items registered in it.`
                                  );
                                  return;
                                }
                                onDeleteCategory(cat);
                              }}
                              className={`p-1.5 rounded-lg transition-all ${
                                isUsed
                                  ? "text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-40 bg-transparent"
                                  : "text-slate-400 hover:text-rose-500 hover:bg-rose-50 cursor-pointer"
                              }`}
                              title={
                                isUsed
                                  ? (language === "pt" 
                                      ? "Categoria possui itens registrados e não pode ser excluída" 
                                      : "Category has registered items and cannot be deleted")
                                  : "Delete category"
                              }
                              disabled={isUsed}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      );
                    })()
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Column B: Identical Item Category memory rules */}
          <div className="md:col-span-6 space-y-6 md:border-l md:border-slate-100 dark:md:border-slate-800 md:pl-8">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
                <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                Category Memory Rules
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Once you change an item's category, the system links the product description with that category. 
                New identical items will automatically assign to this category!
              </p>
            </div>

            {/* Rule search bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search rules..."
                  value={ruleSearch}
                  onChange={(e) => setRuleSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              {Object.keys(itemCategoryRules).length > 0 && (
                <button
                  onClick={onClearRules}
                  className="text-[10px] font-bold text-rose-500 dark:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2.5 py-1.5 rounded-xl border border-transparent hover:border-rose-100 dark:hover:border-rose-900/40 transition-all cursor-pointer"
                >
                  Reset Memory
                </button>
              )}
            </div>

            {/* Rules registry lists */}
            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/20 dark:bg-slate-950/20 max-h-[290px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRules.length === 0 ? (
                <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                  {Object.keys(itemCategoryRules).length === 0 
                    ? "Store memories by changing an item's category in the spreadsheet grid!" 
                    : "No matching memory associations detected."}
                </div>
              ) : (
                filteredRules.map(([name, cat]) => (
                  <div key={name} className="flex items-center justify-between px-4 py-2 hover:bg-white dark:hover:bg-slate-850 transition-colors">
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={name}>{name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-0.5 font-mono">
                        Auto-maps to: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{cat}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteRule(name)}
                      className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 rounded-lg transition-colors shrink-0"
                      title="Remove rule association"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Automated guidelines warning info box */}
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/60 dark:border-emerald-900/40 rounded-xl p-3 flex gap-2.5 items-start text-[11px] text-slate-600 dark:text-slate-350">
              <HelpCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">Dynamic Autofill Logic:</span> Whenever you write or scan an item named identically to a product in the rules registry, your custom category will override generic classification instantly.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
