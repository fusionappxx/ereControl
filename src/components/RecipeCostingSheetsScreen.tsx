import React, { useState, useMemo, useEffect } from "react";
import { 
  Plus, 
  Trash2, 
  ChefHat, 
  PlusCircle, 
  FileText, 
  ArrowLeft,
  ChevronRight,
  Calculator,
  Scale,
  Coins,
  Zap,
  TrendingUp,
  LineChart,
  Tag,
  AlertCircle,
  Pencil,
  Download,
  Upload
} from "lucide-react";
import { ReceiptItem } from "../types";
import { formatCurrency, getGlobalCurrency, parseVolumeOrWeight, safeStorage } from "../utils";
import { doc, onSnapshot, setDoc, collection, deleteDoc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import FixedExpensesScreen from "./FixedExpensesScreen";
import ProductionCostsScreen from "./ProductionCostsScreen";

interface RecipeCostingSheetsScreenProps {
  items: ReceiptItem[];
  language?: "en" | "pt";
  onBack: () => void;
  initialSubTab?: 'recipe-costing' | 'volume-tax' | 'fixed-expenses' | 'production-costs';
}

interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number; 
}

interface SavedRecipe {
  id: string;
  name: string;
}

export default function RecipeCostingSheetsScreen({ items, language = "en", onBack, initialSubTab }: RecipeCostingSheetsScreenProps) {
  // Navigation & selection states
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [newRecipeNameInput, setNewRecipeNameInput] = useState<string>("");
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);

  // Core recipe calculation parameters
  const [recipeIngredients, setRecipeIngredients] = useState<Ingredient[]>([]);
  const [recipePortions, setRecipePortions] = useState<number>(1);
  const [recipeMarkup, setRecipeMarkup] = useState<number>(2.0);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);

  // Global pull values (from our newly separated Fixed Expenses & Production Costs pages!)
  const [fixedExpenses, setFixedExpenses] = useState<{ value: number; month: string }[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const today = new Date();
    const monthsPt = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthsEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return language === "pt" ? monthsPt[today.getMonth()] : monthsEn[today.getMonth()];
  });
  const [globalProductionSum, setGlobalProductionSum] = useState<number>(0);

  // Tab control state
  const [activeSubTab, setActiveSubTab] = useState<'recipe-costing' | 'volume-tax' | 'fixed-expenses' | 'production-costs'>(() => {
    if (initialSubTab) return initialSubTab;
    try {
      const saved = safeStorage.getItem("costing_sheets_initial_subtab");
      if (saved === 'volume-tax' || saved === 'fixed-expenses' || saved === 'production-costs') {
        return saved as 'recipe-costing' | 'volume-tax' | 'fixed-expenses' | 'production-costs';
      }
    } catch {}
    return 'recipe-costing';
  });

  // Sync activeSubTab if initialSubTab prop changes
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Global settings for volume and app taxes
  const [monthlyVolume, setMonthlyVolume] = useState<number>(1500);
  const [amoTax, setAmoTax] = useState<number>(10);
  const [ifoodTax, setIfoodTax] = useState<number>(23);
  const [tax99Food, setTax99Food] = useState<number>(25);
  const [siteTax, setSiteTax] = useState<number>(5);

  // Subscribe to settings/volume_and_app_tax in Firestore
  useEffect(() => {
    const docRef = doc(db, "settings", "volume_and_app_tax");
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setMonthlyVolume(data.monthlyVolume !== undefined ? Number(data.monthlyVolume) : 1500);
        setAmoTax(data.amoTax !== undefined ? Number(data.amoTax) : 10);
        setIfoodTax(data.ifoodTax !== undefined ? Number(data.ifoodTax) : 23);
        setTax99Food(data.tax99Food !== undefined ? Number(data.tax99Food) : 25);
        setSiteTax(data.siteTax !== undefined ? Number(data.siteTax) : 5);
      }
    }, (err) => {
      console.error("Error subscribing to Volume and App Tax settings:", err);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveSettings = async (volume: number, amo: number, ifood: number, food99: number, site: number) => {
    try {
      const docRef = doc(db, "settings", "volume_and_app_tax");
      await setDoc(docRef, {
        monthlyVolume: volume,
        amoTax: amo,
        ifoodTax: ifood,
        tax99Food: food99,
        siteTax: site
      });
    } catch (err) {
      console.error("Error saving Volume & App Tax settings to Firestore:", err);
    }
  };
  
  // Dynamic calculation for the selected month's fixed overhead expenses
  const globalFixedSum = useMemo(() => {
    return fixedExpenses
      .filter((itm) => itm.month.trim().toLowerCase() === selectedMonth.trim().toLowerCase())
      .reduce((sum, item) => sum + item.value, 0);
  }, [fixedExpenses, selectedMonth]);

  // Ingredient adding UI state controls
  const [selectedIngredientProduct, setSelectedIngredientProduct] = useState<string>("");
  const [customIngredientName, setCustomIngredientName] = useState<string>("");
  const [ingredientQtyInput, setIngredientQtyInput] = useState<string>("");
  const [ingredientUnitInput, setIngredientUnitInput] = useState<string>("g");
  const [ingredientPriceInput, setIngredientPriceInput] = useState<string>("0");

  // Load Saved Recipes collection in real-time
  useEffect(() => {
    const colRef = collection(db, "recipes");
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const list: SavedRecipe[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        list.push({
          id: docSnapshot.id,
          name: data.recipeName || docSnapshot.id.replace(/_/g, " ").toUpperCase()
        });
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setSavedRecipes(list);
    }, (err) => {
      console.error("Error loading saved recipes:", err);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Fixed Expenses in real-time
  useEffect(() => {
    const colRef = collection(db, "fixed_expenses");
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const list: { value: number; month: string }[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        list.push({
          value: Number(data.value) || 0,
          month: data.month || ""
        });
      });
      setFixedExpenses(list);
    }, (err) => {
      console.error("Error fetching fixed expenses list:", err);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Global Production Costs sum in real-time
  useEffect(() => {
    const docRef = doc(db, "settings", "production_costs");
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const total = (Number(data.water) || 0) + 
                      (Number(data.electricity) || 0) + 
                      (Number(data.gas) || 0) + 
                      (Number(data.electricity2) || 0);
        setGlobalProductionSum(total);
      }
    }, (err) => {
      console.error("Error fetching global production costs settings:", err);
    });
    return () => unsubscribe();
  }, []);

  // Sync selected recipe sheet values
  useEffect(() => {
    if (!selectedProduct) return;
    const docKey = selectedProduct.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    const docRef = doc(db, "recipes", docKey);

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data) {
          if (Array.isArray(data.ingredients)) setRecipeIngredients(data.ingredients);
          if (data.portions !== undefined) setRecipePortions(Number(data.portions) || 1);
          if (data.markup !== undefined) setRecipeMarkup(Number(data.markup) || 2.0);
        }
      } else {
        // Clear to default values
        setRecipeIngredients([]);
        setRecipePortions(1);
        setRecipeMarkup(2.0);
      }
    }, (error) => {
      console.error("Error getting recipe:", error);
    });

    return () => unsubscribe();
  }, [selectedProduct]);

  // Translate scanned items for auto-completions
  const uniqueGroceryItemsList = useMemo(() => {
    const namesSet = new Set<string>();
    const itemMap: Record<string, ReceiptItem> = {};
    items.forEach(itm => {
      const categoryLower = (itm.category || "").trim().toLowerCase();
      if (
        categoryLower === "consumo" ||
        categoryLower === "outros" ||
        categoryLower === "limpeza" ||
        categoryLower === "other" ||
        categoryLower === "outro" ||
        categoryLower === "equipamentos" ||
        categoryLower === "equipamento" ||
        categoryLower === "equipment" ||
        categoryLower === "consumables" ||
        categoryLower === "consumable" ||
        categoryLower === "cleaning"
      ) {
        return;
      }
      const cleanItmName = itm.name.trim();
      if (cleanItmName) {
        namesSet.add(cleanItmName);
        const existing = itemMap[cleanItmName];
        if (!existing || new Date(itm.purchaseDate).getTime() > new Date(existing.purchaseDate).getTime()) {
          itemMap[cleanItmName] = itm;
        }
      }
    });
    return Array.from(namesSet).sort().map(name => ({
      name,
      latestItem: itemMap[name]
    }));
  }, [items]);

  // Auto-fill calculations of ingredient based on scanned logs
  useEffect(() => {
    if (!selectedIngredientProduct || selectedIngredientProduct === "custom") {
      setIngredientPriceInput("");
      setIngredientUnitInput("g");
      return;
    }
    const matched = uniqueGroceryItemsList.find(g => g.name === selectedIngredientProduct);
    if (matched && matched.latestItem) {
      const lItem = matched.latestItem;
      const price = Number(lItem.price) || 0;
      
      const hasCustomWeightVal = lItem.customWeightOrVolValue !== undefined && lItem.customWeightOrVolValue > 0;
      let weightVal = hasCustomWeightVal ? lItem.customWeightOrVolValue : 0;
      let weightUnit = hasCustomWeightVal ? lItem.customWeightOrVolUnit : "";

      if (!hasCustomWeightVal) {
        const parsed = parseVolumeOrWeight(lItem.name);
        weightVal = parsed.value;
        weightUnit = parsed.unit;
      }

      if (weightVal && weightVal > 0 && weightUnit) {
        let baseQtyMultiplier = 1;
        if (weightUnit === "kg" || weightUnit === "l") {
          baseQtyMultiplier = 1000;
        }
        const totalBaseQty = weightVal * baseQtyMultiplier;
        const pricePerUnit = price / totalBaseQty;
        setIngredientPriceInput(pricePerUnit.toFixed(4));
        setIngredientUnitInput(weightUnit === "kg" || weightUnit === "g" ? "g" : "ml");
      } else {
        setIngredientPriceInput(price.toFixed(2));
        setIngredientUnitInput("unit");
      }
    }
  }, [selectedIngredientProduct, uniqueGroceryItemsList]);

  // Firestore persistent update
  const saveRecipeToFirestore = async (updated: {
    ingredients?: Ingredient[];
    portions?: number;
    markup?: number;
  }) => {
    if (!selectedProduct) return;
    const docKey = selectedProduct.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    const docRef = doc(db, "recipes", docKey);
    const payload = {
      recipeName: selectedProduct,
      ingredients: updated.ingredients !== undefined ? updated.ingredients : recipeIngredients,
      portions: updated.portions !== undefined ? updated.portions : recipePortions,
      markup: updated.markup !== undefined ? updated.markup : recipeMarkup,
      updatedAt: new Date().toISOString()
    };
    try {
      await setDoc(docRef, payload);
    } catch (err) {
      console.error("Error updating recipe sheet:", err);
    }
  };

  const handleCreateNewRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newRecipeNameInput.trim();
    if (!name) return;
    
    setSelectedProduct(name);
    setNewRecipeNameInput("");

    // Create immediate starter doc in firestore
    const docKey = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    try {
      await setDoc(doc(db, "recipes", docKey), {
        recipeName: name,
        ingredients: [],
        portions: 1,
        markup: 2.0,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error writing new recipe:", err);
    }
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExportRecipesToCSV = async () => {
    setIsExporting(true);
    try {
      const colRef = collection(db, "recipes");
      const snapshot = await getDocs(colRef);
      
      const csvRows: string[] = [];
      // Header
      csvRows.push("Recipe Name,Portions,Markup,Ingredient Name,Quantity,Unit,Price");
      
      const escapeCSV = (val: any) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const recipeName = data.recipeName || docSnapshot.id.replace(/_/g, " ").toUpperCase();
        const portions = data.portions !== undefined ? data.portions : 1;
        const markup = data.markup !== undefined ? data.markup : 2.0;
        const ingredients = Array.isArray(data.ingredients) ? data.ingredients : [];

        if (ingredients.length === 0) {
          csvRows.push([
            escapeCSV(recipeName),
            escapeCSV(portions),
            escapeCSV(markup),
            "",
            "",
            "",
            ""
          ].join(","));
        } else {
          ingredients.forEach((ing: any) => {
            csvRows.push([
              escapeCSV(recipeName),
              escapeCSV(portions),
              escapeCSV(markup),
              escapeCSV(ing.name || ""),
              escapeCSV(ing.quantity !== undefined ? ing.quantity : 0),
              escapeCSV(ing.unit || "g"),
              escapeCSV(ing.price !== undefined ? ing.price : 0)
            ].join(","));
          });
        }
      });

      const csvContent = "\uFEFF" + csvRows.join("\n"); // UTF-8 BOM
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `recipes_costing_sheets_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("Error exporting recipes to CSV:", err);
      alert(language === "pt" ? "Erro ao exportar receitas: " + err.message : "Error exporting recipes: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportRecipesFromCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const fileText = evt.target?.result as string;
        if (!fileText) {
          throw new Error("Empty file content");
        }

        const linesOfText = fileText.split(/\r?\n/).filter(line => line.trim() !== "");
        if (linesOfText.length === 0) {
          alert(language === "pt" ? "O arquivo selecionado está vazio." : "The selected file is empty.");
          setIsImporting(false);
          return;
        }

        // Auto-detect delimiter: comma or semicolon
        const firstLine = linesOfText[0];
        let separator = ",";
        if (firstLine.includes(";") && !firstLine.includes(",")) {
          separator = ";";
        } else if (firstLine.split(";").length > firstLine.split(",").length) {
          separator = ";";
        }

        // Standard robust CSV parser
        const parseCSV = (text: string, sep = ",") => {
          const lines: string[][] = [];
          let row: string[] = [];
          let inQuotes = false;
          let current = '';
          
          for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const next = text[i+1];
            
            if (char === '"') {
              if (inQuotes && next === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === sep && !inQuotes) {
              row.push(current.trim());
              current = '';
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
              if (char === '\r' && next === '\n') {
                i++;
              }
              row.push(current.trim());
              if (row.some(val => val !== '')) {
                lines.push(row);
              }
              row = [];
              current = '';
            } else {
              current += char;
            }
          }
          if (current !== '' || row.length > 0) {
            row.push(current.trim());
            if (row.some(val => val !== '')) {
              lines.push(row);
            }
          }
          return lines;
        };

        const parsedLines = parseCSV(fileText, separator);
        if (parsedLines.length === 0) {
          alert(language === "pt" ? "Nenhuma linha válida encontrada no CSV." : "No valid rows found in CSV.");
          setIsImporting(false);
          return;
        }

        let startIdx = 0;
        const checkHeader = (parsedLines[0][0] || "").toLowerCase();
        if (
          checkHeader.includes("recipe") || 
          checkHeader.includes("nome") || 
          checkHeader.includes("ficha") || 
          checkHeader.includes("title") || 
          checkHeader.includes("product")
        ) {
          startIdx = 1;
        }

        const cleanNumber = (val: string): number => {
          if (!val) return 0;
          let clean = val.replace(/[R$€\s]/g, "");
          if (clean.includes(".") && clean.includes(",")) {
            if (clean.indexOf(".") < clean.indexOf(",")) {
              clean = clean.replace(/\./g, "").replace(/,/g, ".");
            } else {
              clean = clean.replace(/,/g, "").replace(/\./g, ".");
            }
          } else if (clean.includes(",")) {
            clean = clean.replace(/,/g, ".");
          }
          const num = parseFloat(clean);
          return isNaN(num) ? 0 : num;
        };

        interface SimpleImportRecipe {
          recipeName: string;
          portions: number;
          markup: number;
          ingredients: {
            id: string;
            name: string;
            quantity: number;
            unit: string;
            price: number;
          }[];
        }

        const recipesMap = new Map<string, SimpleImportRecipe>();

        for (let i = startIdx; i < parsedLines.length; i++) {
          const row = parsedLines[i];
          const recipeName = (row[0] || "").trim();
          if (!recipeName) continue;

          const portions = cleanNumber(row[1] || "1") || 1;
          const markup = cleanNumber(row[2] || "2.0") || 2.0;
          const ingName = (row[3] || "").trim();
          const quantity = cleanNumber(row[4] || "0");
          const unit = (row[5] || "g").trim();
          const price = cleanNumber(row[6] || "0");

          if (!recipesMap.has(recipeName)) {
            recipesMap.set(recipeName, {
              recipeName,
              portions,
              markup,
              ingredients: []
            });
          }

          if (ingName) {
            recipesMap.get(recipeName)!.ingredients.push({
              id: "ing_" + Math.random().toString(36).substr(2, 9),
              name: ingName,
              quantity,
              unit,
              price
            });
          }
        }

        if (recipesMap.size === 0) {
          alert(language === "pt" ? "Nenhuma receita encontrada para importação no CSV." : "No recipes found to import in CSV.");
          setIsImporting(false);
          return;
        }

        // Save recipes to Firestore
        for (const [recipeName, data] of recipesMap.entries()) {
          const docKey = recipeName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
          await setDoc(doc(db, "recipes", docKey), {
            recipeName: data.recipeName,
            portions: data.portions,
            markup: data.markup,
            ingredients: data.ingredients,
            updatedAt: new Date().toISOString()
          });
        }

        alert(
          language === "pt"
            ? `Sucesso! Importadas ${recipesMap.size} receitas com êxito.`
            : `Success! Imported ${recipesMap.size} recipes successfully.`
        );

        // Auto select the first imported recipe if none active
        if (!selectedProduct && recipesMap.size > 0) {
          const firstImported = Array.from(recipesMap.keys())[0];
          setSelectedProduct(firstImported);
        }

      } catch (err: any) {
        console.error("Error parsing/writing imported CSV:", err);
        alert(language === "pt" ? "Erro ao importar arquivo CSV: " + err.message : "Error importing CSV file: " + err.message);
      } finally {
        setIsImporting(false);
        // Reset file input value
        if (e.target) e.target.value = "";
      }
    };

    reader.onerror = () => {
      alert(language === "pt" ? "Erro ao ler arquivo." : "Error reading file.");
      setIsImporting(false);
    };

    reader.readAsText(file);
  };

  const handleRenameRecipe = async (oldName: string) => {
    const newNameInput = window.prompt(
      language === "pt" 
        ? `Digite o novo nome para a receita "${oldName}":` 
        : `Enter new name for recipe "${oldName}":`,
      oldName
    );
    if (!newNameInput) return;
    const cleanedNewName = newNameInput.trim();
    if (!cleanedNewName || cleanedNewName.toLowerCase() === oldName.toLowerCase()) return;

    // Check if new name already exists
    const exists = savedRecipes.some(r => r.name.toLowerCase() === cleanedNewName.toLowerCase());
    if (exists) {
      alert(language === "pt" ? "Já existe uma receita com este nome!" : "A recipe with this name already exists!");
      return;
    }

    const oldKey = oldName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    const newKey = cleanedNewName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");

    try {
      const oldDocRef = doc(db, "recipes", oldKey);
      const snapshot = await getDoc(oldDocRef);
      if (snapshot.exists()) {
        const oldData = snapshot.data();
        // Save new doc with updated recipeName
        const newDocRef = doc(db, "recipes", newKey);
        await setDoc(newDocRef, {
          ...oldData,
          recipeName: cleanedNewName,
          updatedAt: new Date().toISOString()
        });
        // Delete old doc
        await deleteDoc(oldDocRef);
        // Switch selected recipe
        if (selectedProduct === oldName) {
          setSelectedProduct(cleanedNewName);
        }
      }
    } catch (err) {
      console.error("Error renaming recipe:", err);
      alert(language === "pt" ? "Erro ao renomear receita." : "Error renaming recipe.");
    }
  };

  const handleStartEditIngredient = (ing: Ingredient) => {
    setEditingIngredient(ing);
    
    // Check if the ingredient matches any scanned grocery items, else treat as custom
    const matched = uniqueGroceryItemsList.some(g => g.name === ing.name);
    if (matched) {
      setSelectedIngredientProduct(ing.name);
    } else {
      setSelectedIngredientProduct("custom");
      setCustomIngredientName(ing.name);
    }
    
    setIngredientQtyInput(String(ing.quantity));
    setIngredientPriceInput(String(ing.price));
    setIngredientUnitInput(ing.unit);
  };

  const handleCancelEditIngredient = () => {
    setEditingIngredient(null);
    setSelectedIngredientProduct("");
    setCustomIngredientName("");
    setIngredientQtyInput("");
    setIngredientPriceInput("");
  };

  const handleAddIngredient = () => {
    const ingredientName = selectedIngredientProduct === "custom" 
      ? customIngredientName.trim() 
      : selectedIngredientProduct;

    if (!ingredientName || !ingredientQtyInput || !ingredientPriceInput || !selectedProduct) return;
    const qty = parseFloat(ingredientQtyInput);
    const prc = parseFloat(ingredientPriceInput);
    if (isNaN(qty) || qty <= 0 || isNaN(prc) || prc <= 0) return;

    let updated: Ingredient[];
    if (editingIngredient) {
      updated = recipeIngredients.map(ing => 
        ing.id === editingIngredient.id
          ? { ...ing, name: ingredientName, quantity: qty, unit: ingredientUnitInput, price: prc }
          : ing
      );
      setEditingIngredient(null);
    } else {
      const newIngredient: Ingredient = {
        id: "ing_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
        name: ingredientName,
        quantity: qty,
        unit: ingredientUnitInput,
        price: prc
      };
      updated = [...recipeIngredients, newIngredient];
    }

    setRecipeIngredients(updated);
    saveRecipeToFirestore({ ingredients: updated });

    setSelectedIngredientProduct("");
    setCustomIngredientName("");
    setIngredientQtyInput("");
    setIngredientPriceInput("");
  };

  const handleDeleteIngredient = (id: string) => {
    const updated = recipeIngredients.filter(ing => ing.id !== id);
    setRecipeIngredients(updated);
    saveRecipeToFirestore({ ingredients: updated });
  };

  const handleDeleteRecipe = async (recipeName: string) => {
    const confirmation = window.confirm(language === "pt" ? `Excluir toda a receita "${recipeName}"?` : `Remove entire recipe costing sheet "${recipeName}"?`);
    if (!confirmation) return;

    const docKey = recipeName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    try {
      await deleteDoc(doc(db, "recipes", docKey));
      if (selectedProduct === recipeName) {
        setSelectedProduct("");
      }
    } catch (err) {
      console.error("Error deleting recipe from cloud:", err);
    }
  };

  // Math aggregates
  const rawIngredientsCostSum = useMemo(() => {
    return recipeIngredients.reduce((sum, ing) => sum + (ing.quantity * ing.price), 0);
  }, [recipeIngredients]);

  // Proportional pricing breakdown
  const financialCostings = useMemo(() => {
    const yieldCount = recipePortions > 0 ? recipePortions : 1;

    // Direct ingredients unit cost
    const portionRawCost = rawIngredientsCostSum / yieldCount;

    // Amortized utilities and fixed overhead allocated to each single portion directly from sheets divided by monthlyVolume
    const portionFixedOverhead = globalFixedSum / monthlyVolume;
    const portionProductionUtility = globalProductionSum / monthlyVolume;

    const totalRealUnitCost = portionRawCost + portionFixedOverhead + portionProductionUtility;
    const suggestedSellingPrice = totalRealUnitCost * recipeMarkup;
    const projectedProfitAmount = suggestedSellingPrice - totalRealUnitCost;
    const marginRatio = suggestedSellingPrice > 0 ? (projectedProfitAmount / suggestedSellingPrice) * 100 : 0;

    return {
      portionRawCost,
      portionFixedOverhead,
      portionProductionUtility,
      totalRealUnitCost,
      suggestedSellingPrice,
      projectedProfitAmount,
      marginRatio
    };
  }, [rawIngredientsCostSum, recipePortions, globalFixedSum, globalProductionSum, recipeMarkup, monthlyVolume]);

  return (
    <div className="space-y-6">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 active:bg-slate-100 rounded-xl transition-all shadow-3xs cursor-pointer flex items-center justify-center"
            title={language === "pt" ? "Voltar ao Início" : "Back to Home"}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ChefHat className="w-5.5 h-5.5 text-amber-550" />
              <span>{language === "pt" ? "Fichas Técnicas Integradas" : "Recipe Costing Sheets"}</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {language === "pt"
                ? "Calcule insumos e amortize despesas fixas e utilidades diretas na precificação exata do produto"
                : "Formulate physical recipe items, matching portion sizes with smart automated overhead distributions"}
            </p>
          </div>
        </div>
      </div>

      {/* Sub Tabs Navigation Toggle bar */}
      <div className="flex border-b border-slate-100 gap-1 pb-1">
        <button
          onClick={() => {
            setActiveSubTab('recipe-costing');
            try {
              safeStorage.setItem("costing_sheets_initial_subtab", "recipe-costing");
            } catch {}
          }}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'recipe-costing'
              ? 'border-amber-500 text-amber-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ChefHat className="w-3.5 h-3.5" />
          {language === 'pt' ? 'Fichas de Custeio por Receita' : 'Recipe Costing Profile'}
        </button>
        <button
          onClick={() => {
            setActiveSubTab('volume-tax');
            try {
              safeStorage.setItem("costing_sheets_initial_subtab", "volume-tax");
            } catch {}
          }}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'volume-tax'
              ? 'border-amber-500 text-amber-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <LineChart className="w-3.5 h-3.5" />
          {language === 'pt' ? 'Volume Mensal & Taxas de App' : 'Monthly Volume & App Tax'}
        </button>
        <button
          onClick={() => {
            setActiveSubTab('fixed-expenses');
            try {
              safeStorage.setItem("costing_sheets_initial_subtab", "fixed-expenses");
            } catch {}
          }}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'fixed-expenses'
              ? 'border-amber-500 text-amber-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          {language === 'pt' ? 'Despesas Fixas' : 'Fixed Expenses'}
        </button>
        <button
          onClick={() => {
            setActiveSubTab('production-costs');
            try {
              safeStorage.setItem("costing_sheets_initial_subtab", "production-costs");
            } catch {}
          }}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'production-costs'
              ? 'border-amber-500 text-amber-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          {language === 'pt' ? 'Custos de Produção' : 'Production Costs'}
        </button>
      </div>

      {/* VIEW A: RECIPE COSTING VIEWS */}
      {activeSubTab === 'recipe-costing' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start animate-fade-in">
        {/* COLUMN 1: Sidebar with creation and active selection */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-50">
              <PlusCircle className="w-4 h-4 text-emerald-500" />
              {language === "pt" ? "Nova Ficha" : "Add Recipe Profile"}
            </h3>
            <form onSubmit={handleCreateNewRecipe} className="space-y-2">
              <input
                type="text"
                required
                placeholder={language === "pt" ? "ex: Brownie de Nutella, Pão Branco" : "e.g., Nutella Brownie, Sourdough"}
                value={newRecipeNameInput}
                onChange={(e) => setNewRecipeNameInput(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl block w-full p-2.5 focus:ring-amber-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newRecipeNameInput.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed hover:shadow-xs text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {language === "pt" ? "Criar Perfil" : "Register Profile"}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                id="export-recipes-btn"
                onClick={handleExportRecipesToCSV}
                disabled={isExporting}
                className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-950 font-bold py-1.5 px-2 rounded-lg text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-3xs hover:shadow-2xs disabled:opacity-50"
              >
                <Download className="w-3 h-3 text-slate-500" />
                <span>{language === "pt" ? "exportar" : "export"}</span>
              </button>

              <label className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-950 font-bold py-1.5 px-2 rounded-lg text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-3xs hover:shadow-2xs disabled:opacity-50 text-center">
                <Upload className="w-3 h-3 text-slate-500" />
                <span>{language === "pt" ? "importar" : "import"}</span>
                <input
                  type="file"
                  id="import-recipes-input"
                  accept=".csv"
                  disabled={isImporting}
                  onChange={handleImportRecipesFromCSV}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-50">
              <FileText className="w-4 h-4 text-amber-500" />
              {language === "pt" ? "Receitas Disponíveis" : "Saved Recipe Sheets"}
            </h3>
            
            <div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
              {savedRecipes.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-5 text-center">
                  {language === "pt" ? "Nenhuma receita salva." : "No saved profiles yet."}
                </p>
              ) : (
                savedRecipes.map((recipe) => {
                  const isActive = selectedProduct.toLowerCase().trim() === recipe.name.toLowerCase().trim();
                  return (
                    <div key={recipe.id} className="group flex items-center gap-1">
                      <button
                        onClick={() => setSelectedProduct(recipe.name)}
                        className={`flex-1 text-left text-xs p-2.5 rounded-xl flex items-center justify-between transition-all border font-medium ${
                          isActive
                            ? "bg-amber-50 border-amber-200 text-amber-700 font-bold"
                            : "bg-slate-50 hover:bg-slate-100 border-transparent text-slate-700"
                        }`}
                      >
                        <span className="truncate pr-2">{recipe.name}</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                      </button>
                      <button
                        onClick={() => handleDeleteRecipe(recipe.name)}
                        className="p-2.5 hover:bg-rose-50 border border-transparent hover:border-rose-100 text-slate-400 hover:text-rose-600 rounded-xl cursor-pointer shrink-0 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title={language === "pt" ? "Deletar ficha" : "Delete sheet"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* COLUMNS 2,3,4: Costing Workspace of selected Recipe */}
        <div className="md:col-span-3 space-y-6">
          {!selectedProduct ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-amber-50 border border-amber-100 rounded-full flex items-center justify-center text-amber-550">
                <ChefHat className="w-8 h-8" />
              </div>
              <div className="max-w-md">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  {language === "pt" ? "Selecione ou Registre um Produto" : "Select a Recipe Profile"}
                </h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  {language === "pt"
                    ? "Abra uma ficha técnica na barra lateral ou utilize o campo abaixo para carregar sugestões diretas de compilação de custos."
                    : "To begin modeling costs, choose a recipe, or start a new product registry directly from your side control panel."}
                </p>
              </div>
              <div className="pt-2 w-full max-w-sm">
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-850 text-xs rounded-xl block w-full p-3 focus:ring-amber-500 focus:outline-none cursor-pointer font-medium"
                >
                  <option value="">
                    {language === "pt" ? "-- Selecionar Perfil Ativo --" : "-- Choose Recipe Profile --"}
                  </option>
                  {uniqueGroceryItemsList.slice(0, 15).map((g) => (
                    <option key={g.name} value={g.name}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              {/* Product Info Block */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-600">
                    {language === "pt" ? "Ficha de Custeio Ativa" : "Active Recipe Analysis"}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                    <span>{selectedProduct}</span>
                    <button
                      type="button"
                      onClick={() => handleRenameRecipe(selectedProduct)}
                      className="p-1 hover:bg-amber-50 border border-transparent hover:border-amber-100 text-slate-400 hover:text-amber-600 rounded-lg cursor-pointer transition-all shrink-0"
                      title={language === "pt" ? "Editar nome da ficha" : "Rename costing sheet"}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50/50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{language === "pt" ? "Guardado em Nuvem" : "Cloud Active Sync"}</span>
                </div>
              </div>

              {/* SECTION A: Add Ingredient Block */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-50 pb-3">
                  <PlusCircle className="w-4 h-4 text-amber-500" />
                  {language === "pt" ? "Adicionar Insumo ou Compra à Tabela" : "Add Pantry Ingredient to Recipe"}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {language === "pt" ? "Escolher item" : "Choose item"}
                    </label>
                    <select
                      value={selectedIngredientProduct}
                      onChange={(e) => setSelectedIngredientProduct(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl block w-full p-2.5 focus:ring-amber-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">{language === "pt" ? "Itens Disponíveis" : "Available Items"}</option>
                      <option value="custom">{language === "pt" ? "✍️ Item Personalizado (Manual)" : "✍️ Custom Manual Item"}</option>
                      {uniqueGroceryItemsList.map((g) => (
                        <option key={g.name} value={g.name}>{g.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>{language === "pt" ? "Qtd Necessária" : "Usage Quantity"}</span>
                      {ingredientQtyInput !== "" && !(parseFloat(ingredientQtyInput) > 0) && (
                        <span className="text-[10px] text-rose-500 font-bold lowercase">
                          {language === "pt" ? "deve ser > 0" : "must be > 0"}
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 250"
                      value={ingredientQtyInput}
                      onChange={(e) => setIngredientQtyInput(e.target.value)}
                      className={`bg-slate-50 border text-slate-900 text-xs rounded-xl block w-full p-2.5 focus:outline-none transition-all ${
                        ingredientQtyInput !== "" && !(parseFloat(ingredientQtyInput) > 0)
                          ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20"
                          : "border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {language === "pt" ? "Unidade" : "Measurement Unit"}
                    </label>
                    <select
                      value={ingredientUnitInput}
                      onChange={(e) => setIngredientUnitInput(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl block w-full p-2.5 focus:ring-amber-500 focus:outline-none cursor-pointer"
                    >
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                      <option value="l">l</option>
                      <option value="unit">{language === "pt" ? "unidade" : "unit"}</option>
                    </select>
                  </div>
                </div>

                {selectedIngredientProduct === "custom" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {language === "pt" ? "Nome do Insumo Manual" : "Custom Ingredient Description"}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Yeast, Extrato"
                        value={customIngredientName}
                        onChange={(e) => setCustomIngredientName(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl block w-full p-2.5 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>{language === "pt" ? "Custo Estimado por Base" : "Estimated Cost per Base Unit"}</span>
                        {ingredientPriceInput !== "" && !(parseFloat(ingredientPriceInput) > 0) && (
                          <span className="text-[10px] text-rose-500 font-bold lowercase">
                            {language === "pt" ? "deve ser > 0" : "must be > 0"}
                          </span>
                        )}
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold font-mono text-xs">
                          {getGlobalCurrency() === "BRL" ? "R$" : "$"}
                        </span>
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="e.g. 0.04"
                          value={ingredientPriceInput}
                          onChange={(e) => setIngredientPriceInput(e.target.value)}
                          className={`bg-slate-50 border text-slate-900 text-xs rounded-xl block w-full pl-8 p-2.5 focus:outline-none font-mono font-bold transition-all ${
                            ingredientPriceInput !== "" && !(parseFloat(ingredientPriceInput) > 0)
                              ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20"
                              : "border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedIngredientProduct !== "" && selectedIngredientProduct !== "custom" && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-150 text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <span>
                      {language === "pt" ? "Preço de compra computado da nota fiscal:" : "Interpreted purchase price from grocery slip logs:"}
                    </span>
                    <strong className="font-mono text-slate-800 font-bold bg-white px-2 py-0.5 rounded-lg border border-slate-100">
                      {formatCurrency(Number(ingredientPriceInput) || 0)} / {ingredientUnitInput}
                    </strong>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    disabled={
                      (!selectedIngredientProduct) || 
                      (selectedIngredientProduct === "custom" && !customIngredientName.trim()) || 
                      !(parseFloat(ingredientQtyInput) > 0) ||
                      !(parseFloat(ingredientPriceInput) > 0)
                    }
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-3xs"
                  >
                    {!editingIngredient && <Plus className="w-4 h-4" />}
                    {editingIngredient 
                      ? (language === "pt" ? "Salvar Alterações" : "Save Changes")
                      : (language === "pt" ? "Adicionar Insumo à Receita" : "Add Pantry Ingredient")
                    }
                  </button>
                  {editingIngredient && (
                    <button
                      type="button"
                      onClick={handleCancelEditIngredient}
                      className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl transition-all cursor-pointer"
                    >
                      {language === "pt" ? "Cancelar" : "Cancel"}
                    </button>
                  )}
                </div>
              </div>

              {/* SECTION B: Ingredients breakdown log */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-50 pb-3">
                  <Scale className="w-4 h-4 text-emerald-500" />
                  {language === "pt" ? "Matérias-Primas do Produto" : "Materials Composition Inventory"}
                </h4>

                <div className="overflow-x-auto border border-slate-100 rounded-xl bg-slate-55/5">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="p-3.5 pl-4">{language === "pt" ? "Insumo" : "Raw Supply Item"}</th>
                        <th className="p-3.5 text-right">{language === "pt" ? "Qtd Utilizada" : "Quantity Block"}</th>
                        <th className="p-3.5 text-right">{language === "pt" ? "Valor de Compra" : "Factor Price"}</th>
                        <th className="p-3.5 text-right">{language === "pt" ? "Subtotal" : "Accumulated Cost"}</th>
                        <th className="p-3.5 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipeIngredients.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-xs text-slate-400 italic font-medium">
                            {language === "pt" ? "Nenhu ingrediente adicionado para esta receita." : "No raw ingredients compiled for this recipe batch yet."}
                          </td>
                        </tr>
                      ) : (
                        recipeIngredients.map((ing) => (
                          <tr key={ing.id} className="border-b border-slate-100/70 hover:bg-slate-50/40 text-xs text-slate-700 transition">
                            <td className="p-3.5 pl-4 font-bold text-slate-800">{ing.name}</td>
                            <td className="p-3.5 text-right font-semibold text-slate-600">
                              {ing.quantity} {ing.unit}
                            </td>
                            <td className="p-3.5 text-right font-mono text-slate-500">
                              {formatCurrency(ing.price)} / {ing.unit}
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(ing.quantity * ing.price)}
                            </td>
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditIngredient(ing)}
                                  className="p-1 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition cursor-pointer"
                                  title={language === "pt" ? "Editar insumo" : "Edit ingredient"}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteIngredient(ing.id)}
                                  className="p-1 px-2.5 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition cursor-pointer"
                                  title={language === "pt" ? "Deletar insumo" : "Delete ingredient"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}

                      {recipeIngredients.length > 0 && (
                        <tr className="bg-slate-50/50 font-bold border-t border-slate-205">
                          <td colSpan={3} className="p-3 rounded-bl-xl pl-4 text-slate-600 uppercase tracking-widest text-[10px]">
                            {language === "pt" ? "Soma de Matérias-Primas" : "Total Raw Materials"}
                          </td>
                          <td className="p-3 text-right font-mono text-xs text-slate-900 font-extrabold">
                            {formatCurrency(rawIngredientsCostSum)}
                          </td>
                          <td className="p-3 rounded-br-xl"></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION C: Overhead Amortization Divisors Configuration */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="border-b border-slate-50 pb-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-indigo-500" />
                    {language === "pt" ? "Rateios e Amortização de Custos de Apoio" : "Support Cost Allocation & Amortization"}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {language === "pt"
                      ? "Puxamos dados atualizados de Despesas Fixas e Custos de Produção para amortização automatizada do lote de comercialização."
                      : "We pull monthly records. Define divisor variables to allocate a proportionate sliver of overhead onto each unit."}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Fixed expenses division factor */}
                  <div className="space-y-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-amber-550" />
                          {language === "pt" ? "Custo Fixo" : "Fixed Cost"}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-900 bg-white border border-slate-150 px-2 py-0.5 rounded-lg shadow-3xs">
                          {formatCurrency(globalFixedSum)}
                        </span>
                      </div>

                      {/* Amortized Reference Month Selector */}
                      <div className="space-y-1 pt-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">
                          {language === "pt" ? "Mês de Amortização" : "Amortized Month"}
                        </label>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-xl block w-full p-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                        >
                          {(language === "pt" 
                            ? ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
                            : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
                          ).map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      <div className="mt-4 p-3 bg-white/60 border border-slate-150/50 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                          {language === "pt" ? "Taxa de Custo Fixo" : "Fixed Cost Tax"}
                        </span>
                        <span className="text-xs font-bold font-mono text-amber-600 block">
                          {formatCurrency(globalFixedSum / monthlyVolume)} / {language === "pt" ? "unidade" : "unit"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <span className="text-[9.5px] text-slate-400 block leading-relaxed">
                        {language === "pt"
                          ? `Esta taxa de custo fixo de ${formatCurrency(globalFixedSum / monthlyVolume)} é carregada diretamente da planilha de Despesas Fixas (valor total do mês selecionado dividido pelo divisor de ${monthlyVolume}).`
                          : `This fixed cost tax of ${formatCurrency(globalFixedSum / monthlyVolume)} is drawn from the Fixed Expenses sheet (total sum for the selected month divided by the ${monthlyVolume} divisor).`}
                      </span>
                    </div>
                  </div>

                  {/* Utility production cost factors */}
                  <div className="space-y-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-blue-500" />
                          {language === "pt" ? "custo unitário" : "unit cost"}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-900 bg-white border border-slate-150 px-2 py-0.5 rounded-lg shadow-3xs">
                          {formatCurrency(globalProductionSum)}
                        </span>
                      </div>
                      
                      <div className="mt-4 p-3 bg-white/60 border border-slate-150/50 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                          {language === "pt" ? "Taxa Operacional de Utilidades" : "Utility Unit Cost Rate"}
                        </span>
                        <span className="text-xs font-bold font-mono text-emerald-600 block">
                          {formatCurrency(globalProductionSum / monthlyVolume)} / {language === "pt" ? "unidade" : "unit"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <span className="text-[9.5px] text-slate-400 block leading-relaxed">
                        {language === "pt"
                          ? `Este custo unitário de utilidades de ${formatCurrency(globalProductionSum / monthlyVolume)} é carregado diretamente da planilha de Custos de Produção (Direct Financial Spread) e aplicado como taxa padrão por unidade.`
                          : `This direct utilities unit cost of ${formatCurrency(globalProductionSum / monthlyVolume)} is drawn from the Production Costs sheet (Direct Financial Spread) and applied directly per unit.`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION D: Pricing Parameters Yield & Markup */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-50 pb-3">
                  <Calculator className="w-4 h-4 text-blue-500" />
                  {language === "pt" ? "Parâmetros Gerais de Rendimento e Markup" : "Recipe Yield & Target Markup"}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-650 uppercase block">
                      {language === "pt" ? "Rendimento Lote (Porções / Unidades)" : "Yield Count (Portions in 1 Batch)"}
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={recipePortions}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 1;
                        setRecipePortions(val);
                        saveRecipeToFirestore({ portions: val });
                      }}
                      className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl block w-full p-3 font-mono font-bold focus:outline-none focus:ring-amber-500"
                    />
                    <span className="text-[10px] text-slate-400 block leading-normal">
                      {language === "pt" ? "Determina por quantas porções ou unidades faturáveis o custo total do lote será distribuído." : "Spreads accumulated batch materials across these portion counts."}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-650 uppercase block">
                        {language === "pt" ? "Multiplicador de Markup" : "Suggested Markup Multiplier"}
                      </label>
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 font-mono">
                        {recipeMarkup.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="5.0"
                      step="0.05"
                      value={recipeMarkup}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setRecipeMarkup(val);
                        saveRecipeToFirestore({ markup: val });
                      }}
                      className="w-full h-2 bg-slate-100 hover:bg-slate-150 rounded-lg appearance-none cursor-pointer accent-amber-550"
                    />
                    <span className="text-[10px] text-slate-400 block leading-normal">
                      {language === "pt" ? "Fator multiplicador do custo total. Sugere preço de venda aplicando de 1.0x a 5.0x na produção." : "Multiplies portion unit cost to recommend comfortable retail threshold margins."}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION E: Dynamic Comprehensive Financial Pricing Report */}
              <div className="bg-slate-900 text-white rounded-3xl p-6.5 shadow-md border border-slate-800 space-y-6">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                    {language === "pt" ? "RESULTADO DA PRECIFICAÇÃO GERAL" : "FINANCIAL PRICING SUMMARY REPORT"}
                  </span>
                  <h4 className="text-sm text-slate-300 mt-1 leading-normal">
                    {language === "pt"
                      ? "Detalhamento estendido do Custo Real Unitário do produto somando insumos, amortizações e markups."
                      : "Portion level distribution model matching direct grocery ingredients with overhead amortization."}
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                  {/* Detailed Portion Cost Column */}
                  <div className="sm:col-span-2 space-y-3.5 border-b sm:border-b-0 sm:border-r border-slate-800 pb-5 sm:pb-0 sm:pr-6">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {language === "pt" ? "ESTRUTURA DE CUSTOS POR UNIDADE" : "COST BREAKDOWN PER PORTION"}
                    </span>
                    
                    <div className="space-y-2.5 text-xs text-slate-350">
                      {/* Ingredient row */}
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {language === "pt" ? "Insumos e Matérias-Primas" : "Raw Ingredients Portion"}
                        </span>
                        <strong className="font-mono text-white font-bold">{formatCurrency(financialCostings.portionRawCost)}</strong>
                      </div>

                      {/* Utilities row */}
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          {language === "pt" ? "Utilidades Proporcionais (Gás/Energia)" : "Amortized Direct Utilities"}
                        </span>
                        <strong className="font-mono text-white font-bold">{formatCurrency(financialCostings.portionProductionUtility)}</strong>
                      </div>

                      {/* Fixed row */}
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          {language === "pt" ? "Amortização de Custo Fixo" : "Fixed Expense Overhead Share"}
                        </span>
                        <strong className="font-mono text-white font-bold">{formatCurrency(financialCostings.portionFixedOverhead)}</strong>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between font-bold text-slate-100">
                        <span>{language === "pt" ? "CUSTO UNITÁRIO INTEGRADO" : "REAL UNIT COST PER PORTION"}</span>
                        <strong className="font-mono text-[13px] text-white font-black">{formatCurrency(financialCostings.totalRealUnitCost)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Output Column */}
                  <div className="space-y-4 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
                        {language === "pt" ? "PREÇO DE VENDA DO PORTFÓLIO" : "SUGGESTED SELLING PRICE"}
                      </span>
                      <strong className="font-mono text-2xl font-black text-amber-400 tracking-tight block">
                        {formatCurrency(financialCostings.suggestedSellingPrice)}
                      </strong>
                    </div>

                    <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80 space-y-1 text-[11px] text-slate-400">
                      <div className="flex justify-between">
                        <span>{language === "pt" ? "Mark-up sugerido:" : "Markup:"}</span>
                        <strong className="font-semibold text-slate-200">{recipeMarkup.toFixed(2)}x</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === "pt" ? "Lucro Unitário projetado:" : "Profit:"}</span>
                        <strong className="font-semibold text-emerald-400 font-mono">{formatCurrency(financialCostings.projectedProfitAmount)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === "pt" ? "Margem Operacional:" : "Margin:"}</span>
                        <strong className="font-semibold text-emerald-455 font-mono">{financialCostings.marginRatio.toFixed(1)}%</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Channel-Specific Selling Prices Section */}
                <div className="pt-5 border-t border-slate-800 space-y-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    {language === "pt" ? "PREÇOS DE VENDA SUGERIDOS POR CANAL (INTEGRAÇÃO DE TAXA)" : "COMMISSION-ADJUSTED CHANNEL SELLING PRICES"}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { name: "AMO Delivery", tax: amoTax, color: "border-amber-500/15" },
                      { name: "iFood", tax: ifoodTax, color: "border-rose-500/15" },
                      { name: "99Food", tax: tax99Food, color: "border-emerald-500/15" },
                      { name: "Site", tax: siteTax, color: "border-indigo-500/15" }
                    ].map((chan) => {
                      const rate = chan.tax / 100;
                      const channelPrice = rate < 1 ? financialCostings.totalRealUnitCost / (1 - rate) : financialCostings.totalRealUnitCost;
                      const channelSuggestedPrice = channelPrice * recipeMarkup;
                      const revenueAfterTax = channelSuggestedPrice * (1 - rate);
                      const channelProfit = revenueAfterTax - financialCostings.totalRealUnitCost;
                      const channelMargin = channelSuggestedPrice > 0 ? (channelProfit / channelSuggestedPrice) * 100 : 0;
                      return (
                        <div key={chan.name} className={`bg-slate-950/60 p-3.5 rounded-2xl border ${chan.color} space-y-2 text-left`}>
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60">
                            <span className="font-extrabold text-[11px] tracking-tight text-white">{chan.name}</span>
                            <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">{chan.tax}%</span>
                          </div>
                          <div className="space-y-1.5 pt-0.5">
                            <div className="flex items-center justify-between text-[10.5px]">
                              <span className="text-slate-500">{language === "pt" ? "Preço Mín.:" : "Min. Price:"}</span>
                              <strong className="font-mono font-semibold text-slate-300">{formatCurrency(channelPrice)}</strong>
                            </div>
                            <div className="flex items-center justify-between text-[10.5px]">
                              <span className="text-slate-400">{language === "pt" ? "Preço Sugerido:" : "Suggested Price:"}</span>
                              <strong className="font-mono font-black text-amber-400">{formatCurrency(channelSuggestedPrice)}</strong>
                            </div>
                            <div className="flex items-center justify-between text-[10.5px]">
                              <span className="text-slate-400">{language === "pt" ? "Lucro:" : "Profit:"}</span>
                              <strong className="font-mono font-semibold text-emerald-400">{formatCurrency(channelProfit)}</strong>
                            </div>
                            <div className="flex items-center justify-between text-[10.5px]">
                              <span className="text-slate-400">{language === "pt" ? "Margem:" : "Margin:"}</span>
                              <strong className="font-mono font-semibold text-emerald-400">{channelMargin.toFixed(1)}%</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

      {/* VIEW B: VOLUME AND APP TAX VIEW */}
      {activeSubTab === 'volume-tax' && (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
          <div className="border-b border-slate-50 pb-4">
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <LineChart className="w-5 h-5 text-emerald-500" />
              {language === "pt" ? "Planejamento de Volume e Encargo de Aplicativos" : "Volume Planning & Delivery Channel Commissions"}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-normal">
              {language === "pt"
                ? "Configure o divisor de volume operacional estimado para o mês (utilizado nos rateios automáticos de utilidades e custos fixos) e as taxas cobradas pelas plataformas de delivery."
                : "Set estimated monthly order volume used as the divisor for fixed costs and utility amortization, and register commissions taken by your various sales channels."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Divisor Configuration Card (Left Column) */}
            <div className="md:col-span-4 bg-slate-50/50 rounded-2xl border border-slate-100 p-5 space-y-4">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 block">
                {language === "pt" ? "VOLUME MENSAL (DIVISOR DE RATEIO)" : "MONTHLY VOLUME DIVISOR"}
              </span>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  {language === "pt" ? "Volume Estimado de Pedidos:" : "Expected Monthly Sales Volume:"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={monthlyVolume}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      setMonthlyVolume(val);
                      handleSaveSettings(val, amoTax, ifoodTax, tax99Food, siteTax);
                    }}
                    className="bg-white border border-slate-200 text-slate-900 text-sm rounded-xl font-bold font-mono block w-full p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-3 text-[10px] text-slate-400 font-bold bg-slate-105 px-2 py-0.5 rounded border border-slate-200">
                    {language === "pt" ? "pedidos / mês" : "orders / mo"}
                  </span>
                </div>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-[10px] text-emerald-800 leading-relaxed space-y-1.5">
                <strong className="font-bold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {language === "pt" ? "Como afeta as fichas?" : "How this affects costing:"}
                </strong>
                <p>
                  {language === "pt"
                    ? "Este número divide o total de despesas fixas e custos de utilidades para diluir o custo unitário por porção. Quanto maior o seu volume de vendas, menor o impacto dos custos fixos sobre cada unidade!"
                    : "This value acts as the denominator for fixed costs and utility rates. More volume spreads overhead thinner, diminishing portion unit costs, directly improving net margin suggested pricing."}
                </p>
              </div>
            </div>

            {/* App Taxes Configuration Card (Right Column) */}
            <div className="md:col-span-8 bg-white border border-slate-100 rounded-2xl p-5 space-y-5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 block">
                {language === "pt" ? "TAXAS DE COMISSÃO POR CANAL (%)" : "COMMISSION FEES BY CHANNEL (%)"}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. AMO */}
                <div className="bg-slate-50/40 p-4 rounded-xl border border-slate-100 space-y-2">
                  <strong className="text-xs text-slate-800 font-extrabold block">AMO Delivery</strong>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={amoTax}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setAmoTax(val);
                        handleSaveSettings(monthlyVolume, val, ifoodTax, tax99Food, siteTax);
                      }}
                      className="bg-white border border-slate-200 text-slate-900 text-sm rounded-xl font-bold font-mono block w-full p-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-450 font-mono">%</span>
                  </div>
                </div>

                {/* 2. iFood */}
                <div className="bg-slate-50/40 p-4 rounded-xl border border-slate-100 space-y-2">
                  <strong className="text-xs text-slate-800 font-extrabold block">iFood</strong>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={ifoodTax}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setIfoodTax(val);
                        handleSaveSettings(monthlyVolume, amoTax, val, tax99Food, siteTax);
                      }}
                      className="bg-white border border-slate-200 text-slate-900 text-sm rounded-xl font-bold font-mono block w-full p-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-450 font-mono">%</span>
                  </div>
                </div>

                {/* 3. 99Food */}
                <div className="bg-slate-50/40 p-4 rounded-xl border border-slate-100 space-y-2">
                  <strong className="text-xs text-slate-800 font-extrabold block">99Food</strong>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={tax99Food}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setTax99Food(val);
                        handleSaveSettings(monthlyVolume, amoTax, ifoodTax, val, siteTax);
                      }}
                      className="bg-white border border-slate-200 text-slate-900 text-sm rounded-xl font-bold font-mono block w-full p-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-450 font-mono">%</span>
                  </div>
                </div>

                {/* 4. Site / Direct Store */}
                <div className="bg-slate-50/40 p-4 rounded-xl border border-slate-100 space-y-2">
                  <strong className="text-xs text-slate-800 font-extrabold block">{language === "pt" ? "Site Próprio" : "Custom Site Direct"}</strong>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={siteTax}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setSiteTax(val);
                        handleSaveSettings(monthlyVolume, amoTax, ifoodTax, tax99Food, val);
                      }}
                      className="bg-white border border-slate-200 text-slate-900 text-sm rounded-xl font-bold font-mono block w-full p-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-450 font-mono">%</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 bg-blue-50/45 p-3.5 rounded-xl border border-blue-100 flex items-start gap-2.5 text-[10px] text-blue-700 leading-normal">
                <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">{language === "pt" ? "Como as taxas calculam o preço final?" : "Markup Multiplier Integration:"}</span>
                  <p>
                    {language === "pt"
                      ? "A plataforma calcula automaticamente o acréscimo proporcional para cada aplicativo. O cálculo segue a fórmula matemática: Preço do Aplicativo = Preço Base / (1 - Taxa). Isso assegura que, após o desconto da taxa de comissão pelo app, seu lucro líquido final permaneça exatamente o planejado inicialmente."
                      : "The system dynamically markups base target prices for your channels using the following mathematical structure: App Price = Target Price / (1 - tax proportion). It preserves initial margins completely, shielding you from app commission leakage."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'fixed-expenses' && (
        <div className="animate-fade-in bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <FixedExpensesScreen
            language={language}
            onBack={() => {
              setActiveSubTab('recipe-costing');
              try {
                safeStorage.setItem("costing_sheets_initial_subtab", "recipe-costing");
              } catch {}
            }}
            hideHeader={true}
          />
        </div>
      )}

      {activeSubTab === 'production-costs' && (
        <div className="animate-fade-in bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <ProductionCostsScreen
            language={language}
            onBack={() => {
              setActiveSubTab('recipe-costing');
              try {
                safeStorage.setItem("costing_sheets_initial_subtab", "recipe-costing");
              } catch {}
            }}
            hideHeader={true}
          />
        </div>
      )}
    </div>
  );
}
