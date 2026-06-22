import { ReceiptItem, OcrErrorLog } from "./types";

export function isBeverage(name: string): boolean {
  const n = name.toLowerCase();
  const keywords = [
    "refrigerante", "suco", "agua", "água", "cafe", "café", "leite", "cha", "chá", "cerveja", 
    "vinho", "bebida", "refrigerantes", "sucos", "leites", "energéticos", "energético", 
    "pepsi", "coca", "guaraná", "fanta", "sprite", "liquido", "líquido", "champanhe", "espumante",
    "nectar", "néctar", "gatorade", "redbull", "red bull", "achocolatado", "toddy", "nescau",
    "tonica", "tônica", "cervejas", "vinhos", "fantas", "pepsis", "cocas",
    "water", "soda", "juice", "milk", "tea", "coffee", "beer", "wine", "cider", "beverage", 
    "drink", "cola", "pepsi", "sprite", "fanta", "guarana", "energy drink", "red bull", "cocktail", 
    "champagne", "liquor", "whiskey", "vodka", "gin", "rum", "syrup", "coconut water", "tonic",
    "beverages", "drinks", "sodas", "beers", "wines"
  ];
  return keywords.some(kw => n.includes(kw));
}

export function isFlour(name: string): boolean {
  const n = name.toLowerCase();
  const keywords = [
    "farinha", "polvilho", "amido", "maizena", "fermento", "tapioca", "trigo", "aveia", "fubá", "fuba", "germe", "farelo",
    "flour", "starch", "yeast", "baking powder", "cornmeal", "oatmeal", "semolina", "wheat", "bran"
  ];
  return keywords.some(kw => n.includes(kw));
}

export function isFruitOrVegetable(name: string): boolean {
  const n = name.toLowerCase();
  const keywords = [
    "fruta", "vegetal", "legume", "maçã", "maca", "banana", "pera", "pêra", "uva", "laranja", "limao", "limão", "morango", 
    "mirtilo", "framboesa", "abacaxi", "pêssego", "pessego", "ameixa", "cereja", "manga", "abacate", "melão", "melao", 
    "melancia", "kiwi", "mamão", "mamao", "figo", "goiaba", "tomate", "batata", "cebola", "alho", "cenoura", "brócolis", 
    "brocolis", "couve-flor", "repolho", "alface", "espinafre", "pimentão", "pimentao", "pepino", "abobrinha", "berinjela", 
    "abóbora", "abobora", "salsão", "salsao", "aspargo", "cogumelo", "erva", "ervas", "coentro", "salsa", "manjericão", 
    "manjericao", "alecrim", "tomilho", "batata doce", "couve", "gengibre", "rabanete", "beterraba", "alcaparra", "rúcula", 
    "rucula", "caqui", "tangerina", "mexerica", "pera", "maracuja", "maracujá", "carambola", "jabuticaba", "acerola", 
    "jaca", "cacau", "coco", "milho", "vagem", "mandioca", "aipim", "macaxeira", "chuchu", "quiabo", "jiló", "jilo", 
    "ervilha", "lentilha", "grão de bico", "grao de bico", "acelga", "agrião", "agriao", "chicória", "chicoria", 
    "rúcula", "rucula", "hortelã", "hortela",
    "fruit", "vegetable", "apple", "banana", "pear", "grape", "orange", "lemon", "lime", "strawberry", "berry", 
    "blueberry", "raspberry", "pineapple", "peach", "plum", "cherry", "mango", "avocado", "melon", "watermelon", 
    "kiwi", "papaya", "fig", "guava", "tomato", "potato", "onion", "garlic", "carrot", "broccoli", "cauliflower", 
    "cabbage", "lettuce", "spinach", "pepper", "cucumber", "zucchini", "eggplant", "pumpkin", "squash", "celery", 
    "asparagus", "mushroom", "herb", "herbs", "cilantro", "parsley", "basil", "rosemary", "thyme", "potato", 
    "sweet potato", "kale", "ginger", "radish", "beet", "spinach", "leek", "citrus", "grapefruit", "cantaloupe", 
    "blackberry", "cranberry", "apricot", "nectarine", "pomegranate", "veggie", "veggies", "scallion", "shallot"
  ];
  return keywords.some(kw => n.includes(kw));
}

export function resolveItemCategory(
  name: string, 
  historicalRules: Record<string, string>, 
  historicalItems: ReceiptItem[],
  categoryMappings?: Record<string, string>
): string {
  const cleanName = name.trim().toLowerCase();
  if (!cleanName) return "Other";

  const isCategoryExcluded = (cat: string): boolean => {
    const c = cat.toLowerCase().trim();
    return (
      c.includes("beverage") ||
      c.includes("frozen") ||
      c.includes("household") ||
      c.includes("meat") ||
      c.includes("pantry")
    );
  };

  const sanitizeCategory = (categoryName: string): string => {
    if (isCategoryExcluded(categoryName)) {
      return "Other";
    }
    return categoryName;
  };

  const getMappedName = (internalKey: string): string => {
    return (categoryMappings && categoryMappings[internalKey]) || internalKey;
  };

  // Rule 1: All beverages to "Beverages"
  if (isBeverage(cleanName)) {
    return sanitizeCategory(getMappedName("Beverages"));
  }

  // Rule 2: All flours, to "Ingredients"
  if (isFlour(cleanName)) {
    return sanitizeCategory(getMappedName("Ingredients"));
  }

  // Rule 3: All fruits and vegetables, to "Fruits"
  if (isFruitOrVegetable(cleanName)) {
    return sanitizeCategory(getMappedName("Fruits"));
  }

  // 4. Fall back to historical user-defined rules mapping
  if (historicalRules && historicalRules[cleanName]) {
    return sanitizeCategory(historicalRules[cleanName]);
  }

  // 5. Fall back to historical items with exact match name
  if (historicalItems && historicalItems.length > 0) {
    const matchedExact = historicalItems.find(it => it.name.trim().toLowerCase() === cleanName);
    if (matchedExact && matchedExact.category) {
      return sanitizeCategory(matchedExact.category);
    }

    // 6. Loose / partial match in historical items for better accuracy
    const matchedPartial = historicalItems.find(it => {
      const histLower = it.name.trim().toLowerCase();
      return histLower.includes(cleanName) || cleanName.includes(histLower);
    });
    if (matchedPartial && matchedPartial.category) {
      return sanitizeCategory(matchedPartial.category);
    }
  }

  return "Other";
}

// Generate unique sequential or random IDs
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Convert receipt date format to clean YYYY-MM-DD
export function cleanDate(dateStr?: string): string {
  if (!dateStr) {
    const today = new Date();
    return today.toISOString().split("T")[0];
  }
  // Try parsing date
  const timestamp = Date.parse(dateStr);
  if (isNaN(timestamp)) {
    const today = new Date();
    return today.toISOString().split("T")[0];
  }
  return new Date(timestamp).toISOString().split("T")[0];
}

// Global currency state dynamically synchronised with the app's settings screen
let globalCurrency = "USD";

export function getGlobalCurrency(): string {
  return globalCurrency;
}

export function setGlobalCurrency(currency: string): void {
  globalCurrency = currency;
}

// Format currency
export function formatCurrency(amount: number, currencyCode?: string): string {
  const code = currencyCode || globalCurrency;
  const map: Record<string, { locale: string; currency: string }> = {
    USD: { locale: "en-US", currency: "USD" },
    BRL: { locale: "pt-BR", currency: "BRL" },
    EUR: { locale: "fr-FR", currency: "EUR" }
  };
  const cfg = map[code] || map.USD;
  return new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency: cfg.currency,
  }).format(amount);
}

// Map of categories and items to professional Unsplash photo URLs
export function getProductPhoto(name: string, category: string): string {
  const normalized = name.toLowerCase();
  
  if (normalized.includes("apple")) {
    return "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop&q=80";
  }
  if (normalized.includes("milk")) {
    return "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop&q=80";
  }
  if (normalized.includes("bread") || normalized.includes("boule") || normalized.includes("sourdough") || normalized.includes("toast")) {
    return "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80";
  }
  if (normalized.includes("steak") || normalized.includes("ribeye") || normalized.includes("beef") || normalized.includes("meat")) {
    return "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=600&auto=format&fit=crop&q=80";
  }
  if (normalized.includes("olive oil") || normalized.includes("oil")) {
    return "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop&q=80";
  }
  if (normalized.includes("water") || normalized.includes("sparkling") || normalized.includes("beverage") || normalized.includes("soda") || normalized.includes("coke") || normalized.includes("juice")) {
    return "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80";
  }
  if (normalized.includes("banana")) {
    return "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&auto=format&fit=crop&q=80";
  }
  if (normalized.includes("cheese")) {
    return "https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=600&auto=format&fit=crop&q=80";
  }
  if (normalized.includes("coffee") || normalized.includes("cafe") || normalized.includes("espresso")) {
    return "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80";
  }
  if (normalized.includes("egg")) {
    return "https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?w=600&auto=format&fit=crop&q=80";
  }
  if (normalized.includes("honey")) {
    return "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&auto=format&fit=crop&q=80";
  }
  if (normalized.includes("beer") || normalized.includes("wine")) {
    return "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=600&auto=format&fit=crop&q=80";
  }
  if (normalized.includes("chocolate") || normalized.includes("snack") || normalized.includes("cookie") || normalized.includes("chips")) {
    return "https://images.unsplash.com/photo-1511381939415-e44015466834?w=600&auto=format&fit=crop&q=80";
  }
  if (normalized.includes("shampoo") || normalized.includes("soap") || normalized.includes("personal")) {
    return "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=600&auto=format&fit=crop&q=80";
  }
  if (normalized.includes("detergent") || normalized.includes("cleaner") || normalized.includes("wash") || normalized.includes("wipes")) {
    return "https://images.unsplash.com/photo-1584824486516-0555a07fc511?w=600&auto=format&fit=crop&q=80";
  }

  // Category defaults
  switch (category) {
    case "Produce":
      return "https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=600&auto=format&fit=crop&q=80";
    case "Fruits":
      return "https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?w=600&auto=format&fit=crop&q=80";
    case "Ingredients":
      return "https://images.unsplash.com/photo-1549590143-d515590b5a62?w=600&auto=format&fit=crop&q=80";
    case "Bakery":
      return "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80";
    case "Dairy":
      return "https://images.unsplash.com/photo-1528498033373-3c6c08e93d79?w=600&auto=format&fit=crop&q=80";
    case "Meat & Seafood":
      return "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=600&auto=format&fit=crop&q=80";
    case "Pantry":
      return "https://images.unsplash.com/photo-1514986879800-d4cf2257bd76?w=600&auto=format&fit=crop&q=80";
    case "Beverages":
      return "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80";
    case "Frozen Foods":
      return "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80";
    case "Snacks":
      return "https://images.unsplash.com/photo-1599490659223-es3a9712c7ef?w=600&auto=format&fit=crop&q=80";
    case "Household":
      return "https://images.unsplash.com/photo-1584824486500-112e4185ff5b?w=600&auto=format&fit=crop&q=80";
    case "Personal Care":
      return "https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=600&auto=format&fit=crop&q=80";
    default:
      return "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80"; // general supermarket aisle
  }
}

// Generates a stable EAN-13 barcode dynamically from the product name
export function getStableBarcode(name: string): string {
  // Simple hashing to a stable 12-digit number
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 100000000000;
  }
  // Convert to absolute value and pad to 12 digits
  const code = Math.abs(hash).toString().padStart(12, "7").substring(0, 12);
  
  // Calculate EAN-13 checksum (standard algorithm)
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checksum = (10 - (sum % 10)) % 10;
  return code + checksum.toString();
}

// Parse weight/milliliters from the item description string
export function parseVolumeOrWeight(name: string): { value: number; unit: "g" | "kg" | "ml" | "l" | null } {
  // Try matching milliliters, liters, grams, kilograms, etc.
  // Match combinations like: 750ml, 1.5 l, 5 kg, 200g, 1Gal, 500 grams, 3 Litros
  const regex = /(\d+(?:\.\d+)?)\s*(ml|l|g|kg|gr|gramas|grams|litros|liters|kilos|kg)/i;
  const match = name.match(regex);
  
  if (match) {
    const value = parseFloat(match[1]);
    const rawUnit = match[2].toLowerCase();
    
    let unit: "g" | "kg" | "ml" | "l" | null = null;
    if (rawUnit === "ml") {
      unit = "ml";
    } else if (rawUnit === "l" || rawUnit === "litros" || rawUnit === "liters") {
      unit = "l";
    } else if (rawUnit === "g" || rawUnit === "gr" || rawUnit === "gramas" || rawUnit === "grams") {
      unit = "g";
    } else if (rawUnit === "kg" || rawUnit === "kilos") {
      unit = "kg";
    }
    
    return { value, unit };
  }

  // Second try checks for gallons just in case
  const galRegex = /(\d+(?:\.\d+)?)\s*(gal|gallon|gallons|galao)/i;
  const galMatch = name.match(galRegex);
  if (galMatch) {
    const galValue = parseFloat(galMatch[1]);
    // Convert liquid gallons to liters (1 gal ≈ 3.785 liters)
    return { value: parseFloat((galValue * 3.785).toFixed(2)), unit: "l" };
  }
  
  return { value: 0, unit: null };
}

// Export item array to CSV spreadsheet
export function exportToCSV(items: ReceiptItem[]): void {
  const headers = ["Item Name", "Quantity", "Unit Price ($)", "Total ($)", "Category", "Purchase Date", "Store Name", "Invoice Number"];
  
  const rows = items.map((item) => {
    const itemTotal = (item.quantity * item.price).toFixed(2);
    return [
      `"${item.name.replace(/"/g, '""')}"`,
      item.quantity,
      item.price.toFixed(2),
      itemTotal,
      `"${item.category}"`,
      `"${item.purchaseDate}"`,
      `"${item.storeName.replace(/"/g, '""')}"`,
      `"${(item.invoiceNumber || "").replace(/"/g, '""')}"`
    ];
  });

  const csvContent = "data:text/csv;charset=utf-8," 
    + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `grocery_spreadsheet_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Convert uploaded CSV data to Omit<ReceiptItem, 'id'>[]
export function fileCSVToItems(csvText: string): Omit<ReceiptItem, 'id'>[] {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse header line to determine column mappings
  const rawHeaders = lines[0].split(",");
  const headers = rawHeaders.map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase());

  // Helper matching indices
  const findIndex = (keywords: string[]) => {
    return headers.findIndex(h => keywords.some(kw => h.includes(kw)));
  };

  const nameIdx = findIndex(["item name", "item description", "description", "item", "name"]);
  const qtyIdx = findIndex(["qty", "quantity", "units", "amount"]);
  const priceIdx = findIndex(["unit price", "price", "rate", "cost"]);
  const categoryIdx = findIndex(["category", "class", "type"]);
  const dateIdx = findIndex(["purchase date", "date", "day", "acquired"]);
  const storeIdx = findIndex(["store name", "store", "shop", "vendor", "retailer", "market"]);
  const invoiceIdx = findIndex(["invoice number", "invoice no.", "invoice", "bill no", "receipt"]);

  const importedItems: Omit<ReceiptItem, 'id'>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Split line by commas keeping quoted fields together
    const values: string[] = [];
    let curVal = "";
    let insideQuotes = false;
    for (let charIdx = 0; charIdx < rawLine.length; charIdx++) {
      const char = rawLine[charIdx];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(curVal.trim().replace(/^["']|["']$/g, ""));
        curVal = "";
      } else {
        curVal += char;
      }
    }
    values.push(curVal.trim().replace(/^["']|["']$/g, ""));

    // Skip empty lines or headers mismatches
    if (values.length === 0 || (values.length === 1 && !values[0])) continue;

    const name = nameIdx !== -1 && values[nameIdx] ? values[nameIdx] : "Imported Item";
    const quantity = qtyIdx !== -1 && values[qtyIdx] ? Math.max(1, parseInt(values[qtyIdx]) || 1) : 1;
    
    let rawPrice = priceIdx !== -1 && values[priceIdx] ? values[priceIdx] : "0";
    const cleanPriceStr = rawPrice.replace(/[^\d.-]/g, "");
    const price = Math.max(0, parseFloat(cleanPriceStr) || 0);

    const category = categoryIdx !== -1 && values[categoryIdx] ? values[categoryIdx] : "Produto";
    const purchaseDate = dateIdx !== -1 && values[dateIdx] ? values[dateIdx] : new Date().toISOString().split("T")[0];
    const storeName = storeIdx !== -1 && values[storeIdx] ? values[storeIdx] : "CSV Import";
    const invoiceNumber = invoiceIdx !== -1 && values[invoiceIdx] ? values[invoiceIdx] : undefined;

    importedItems.push({
      name,
      quantity,
      price,
      category,
      purchaseDate,
      storeName,
      invoiceNumber
    });
  }

  return importedItems;
}

// Onboarding seed/demo receipt items
export const DEMO_RECEIPT_ITEMS: ReceiptItem[] = [
  {
    id: "demo-1",
    name: "Organic Honeycrisp Apples",
    quantity: 1,
    price: 4.99,
    category: "Produce",
    purchaseDate: "2026-05-25",
    storeName: "Whole Foods Market"
  },
  {
    id: "demo-history-apples",
    name: "Organic Honeycrisp Apples",
    quantity: 1,
    price: 5.49, // Price decreased from 5.49 to 4.99!
    category: "Produce",
    purchaseDate: "2026-05-15",
    storeName: "Whole Foods Market"
  },
  {
    id: "demo-2",
    name: "Fresh Whole Milk 1Gal",
    quantity: 1,
    price: 3.49,
    category: "Dairy",
    purchaseDate: "2026-05-25",
    storeName: "Whole Foods Market"
  },
  {
    id: "demo-history-milk",
    name: "Fresh Whole Milk 1Gal",
    quantity: 1,
    price: 2.99, // Price increased from 2.99 to 3.49!
    category: "Dairy",
    purchaseDate: "2026-05-18",
    storeName: "Whole Foods Market"
  },
  {
    id: "demo-3",
    name: "Sourdough Boule",
    quantity: 2,
    price: 5.50,
    category: "Bakery",
    purchaseDate: "2026-05-25",
    storeName: "Whole Foods Market"
  },
  {
    id: "demo-4",
    name: "Premium Ribeye Steak",
    quantity: 1,
    price: 18.99,
    category: "Meat & Seafood",
    purchaseDate: "2026-05-25",
    storeName: "Whole Foods Market"
  },
  {
    id: "demo-5",
    name: "Organic Olive Oil 750ml",
    quantity: 1,
    price: 12.99,
    category: "Pantry",
    purchaseDate: "2026-05-24",
    storeName: "Trader Joe's"
  },
  {
    id: "demo-6",
    name: "Sparkling Water 12-pack",
    quantity: 2,
    price: 4.80,
    category: "Beverages",
    purchaseDate: "2026-05-24",
    storeName: "Trader Joe's"
  }
];

// LocalStorage helpers for tracking upload and OCR errors
export function saveOcrErrorLog(fileName: string, errorMsg: string): OcrErrorLog {
  const newLog: OcrErrorLog = {
    id: Math.random().toString(36).substring(2, 9),
    fileName: fileName || "unnamed_upload",
    uploadDate: new Date().toISOString(),
    error: errorMsg || "Unknown error occurred"
  };
  try {
    const existing = localStorage.getItem("ocr_error_logs");
    const logs = existing ? JSON.parse(existing) : [];
    logs.push(newLog);
    localStorage.setItem("ocr_error_logs", JSON.stringify(logs));
  } catch (e) {
    console.error("Failed to write to local storage OCR logs:", e);
  }
  return newLog;
}

export function getOcrErrorLogs(): OcrErrorLog[] {
  try {
    const existing = localStorage.getItem("ocr_error_logs");
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    console.error("Failed to parse ocr error logs:", e);
    return [];
  }
}

export function clearOcrErrorLogs(): void {
  try {
    localStorage.removeItem("ocr_error_logs");
  } catch (e) {
    console.error("Failed to clear ocr error logs:", e);
  }
}

