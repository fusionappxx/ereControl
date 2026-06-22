export interface AppTranslations {
  title: string;
  subtitle: string;
  scanReceipt: string;
  openSpreadsheet: string;
  spendingBreakdown: string;
  manageCategories: string;
  settings: string;
  totalGrocerySpent: string;
  topExpenseType: string;
  dominantSector: string;
  totalItemsCataloged: string;
  averageItemValue: string;
  theme: string;
  lightTheme: string;
  darkTheme: string;
  currency: string;
  dollar: string;
  brazilianReal: string;
  euro: string;
  language: string;
  english: string;
  portuguese: string;
  settingsTitle: string;
  settingsSubtitle: string;
  returnToSubmit: string;
  lastSpent: string;
  saveSettings: string;
  databaseStats: string;
  expenseRatios: string;
  unrecognizedItems: string;
  rulesConfigured: string;
  onboardingTitle: string;
  onboardingDesc: string;
  duplicateTitle: string;
  duplicateDesc: string;
  acceptDuplicate: string;
  declineDuplicate: string;
  recentPriceAlerts: string;
  priceCheckStatus: string;
  retailPrice: string;
  historicalPurchases: string;
  priceTrend: string;
  uniqueItemsTitle: string;
  uniqueItemsSubtitle: string;
  itemNameCol: string;
  lastPriceCol: string;
  pricePerGramLiterCol: string;
  sizeCol: string;
  searchPlaceholder: string;
  noUniqueItems: string;
  backToTop: string;
}

export const translations: Record<"en" | "pt", AppTranslations> = {
  en: {
    title: "ereKitchen Scanner",
    subtitle: "AI-Powered Smart Fiscal Scanner & Price Tracker",
    scanReceipt: "Scan Receipt",
    openSpreadsheet: "Open Spreadsheet",
    spendingBreakdown: "Spending Breakdown",
    manageCategories: "Manage Categories",
    settings: "Settings",
    totalGrocerySpent: "Total Grocery Spent",
    topExpenseType: "Top Expense Type",
    dominantSector: "Dominant Sector",
    totalItemsCataloged: "Total Items Cataloged",
    averageItemValue: "Average Item Value",
    theme: "Visual Theme",
    lightTheme: "Light Theme",
    darkTheme: "Dark Theme",
    currency: "Currency Code",
    dollar: "US Dollar ($)",
    brazilianReal: "Brazilian Real (R$)",
    euro: "Euro (€)",
    language: "Language",
    english: "English (US)",
    portuguese: "Português (BR)",
    settingsTitle: "Configuration & Preferences",
    settingsSubtitle: "Customize theme parameters, monetary values, and UI translation settings",
    returnToSubmit: "Scan Receipt Submission",
    lastSpent: "Last Spent",
    saveSettings: "Save Settings",
    databaseStats: "Database Stats",
    expenseRatios: "Expense Allocation Index",
    unrecognizedItems: "Unmapped Rows",
    rulesConfigured: "Smart Rules",
    onboardingTitle: "No Receipts Uploaded Yet",
    onboardingDesc: "Drop a grocery receipt, enter a 44-digit SEFAZ key, or load sandbox data to get started.",
    duplicateTitle: "Duplicate Invoice Detected",
    duplicateDesc: "This invoice number is already stored in your database. Do you want to force import it anyway?",
    acceptDuplicate: "Import Anyway",
    declineDuplicate: "Cancel Duplicate Scan",
    recentPriceAlerts: "Recent Value & Inflation Alerts",
    priceCheckStatus: "Compare against previous purchases to detect rises and drops",
    retailPrice: "Retail Value",
    historicalPurchases: "Historical Purchases",
    priceTrend: "Price Trend Analytics",
    uniqueItemsTitle: "Unique Items Database",
    uniqueItemsSubtitle: "Comprehensive registry of unique inventory items, last logged unit price, and price-to-size unit ratios",
    itemNameCol: "Item Name",
    lastPriceCol: "Last Price",
    pricePerGramLiterCol: "Price per Gram / Liter",
    sizeCol: "Parsed Size",
    searchPlaceholder: "Search unique grocery items...",
    noUniqueItems: "No unique grocery items detected are matching current filter.",
    backToTop: "Back to top"
  },
  pt: {
    title: "ereKitchen Scanner",
    subtitle: "Rastreador Inteligente de Preços e Leitor de Notas Fiscais com IA",
    scanReceipt: "Escanear Nota",
    openSpreadsheet: "Abrir Planilha",
    spendingBreakdown: "Painel de Gastos",
    manageCategories: "Gerenciar Categorias",
    settings: "Configurações",
    totalGrocerySpent: "Total de Despesas",
    topExpenseType: "Maior Tipo de Despesa",
    dominantSector: "Setor Dominante",
    totalItemsCataloged: "Mapeamento Total",
    averageItemValue: "Valor Médio do Item",
    theme: "Tema Visual",
    lightTheme: "Tema Claro",
    darkTheme: "Tema Escuro",
    currency: "Símbolo Monetário",
    dollar: "Dólar Comercial ($)",
    brazilianReal: "Real Brasileiro (R$)",
    euro: "Euro (€)",
    language: "Idioma",
    english: "English (US)",
    portuguese: "Português (BR)",
    settingsTitle: "Configurações e Preferências",
    settingsSubtitle: "Personalize parâmetros visuais de cores, convenções de moedas e tradução",
    returnToSubmit: "Leitura de Notas",
    lastSpent: "Último Gasto",
    saveSettings: "Salvar Preferências",
    databaseStats: "Registros Salvos",
    expenseRatios: "Gráfico de Alocação de Gastos",
    unrecognizedItems: "Não Mapeados",
    rulesConfigured: "Regras do Motor",
    onboardingTitle: "Nenhum Cupom Cadastrado",
    onboardingDesc: "Arraste um PDF/Imagem, informe a Chave de Acesso de 44 dígitos da SEFAZ, ou clique em rodar simulação para preencher.",
    duplicateTitle: "Cupom Fiscal Duplicado Detectado",
    duplicateDesc: "Esta nota já consta importada em seu banco de dados. Gostaria de forçar a importação redundante do mesmo jeito?",
    acceptDuplicate: "Importar Duplicata",
    declineDuplicate: "Cancelar Leitura",
    recentPriceAlerts: "Alertas de Inflação e Curva de Custos",
    priceCheckStatus: "Comparativos históricos para identificar subidas e quedas de preços",
    retailPrice: "Valor Unitário",
    historicalPurchases: "Histórico de Transações",
    priceTrend: "Análise de Tendência de Preço",
    uniqueItemsTitle: "Banco de Itens Únicos",
    uniqueItemsSubtitle: "Registro completo de itens únicos catalogados, com o preço de última compra e as taxas de preço por grama/litro",
    itemNameCol: "Nome do Item",
    lastPriceCol: "Último Preço",
    pricePerGramLiterCol: "Preço por Grama / Litro",
    sizeCol: "Tamanho Identificado",
    searchPlaceholder: "Pesquisar itens únicos de supermercado...",
    noUniqueItems: "Nenhum item único corresponde ao filtro especificado.",
    backToTop: "Voltar ao topo"
  }
};
