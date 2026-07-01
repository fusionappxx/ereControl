import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShoppingBag, 
  ShoppingCart, 
  Plus, 
  Minus, 
  User, 
  Phone, 
  MapPin, 
  CreditCard, 
  Coins, 
  CheckCircle, 
  Clock, 
  ArrowRight, 
  Heart,
  ChefHat,
  Sparkles,
  Search,
  Check,
  AlertCircle,
  Truck,
  HelpCircle,
  X,
  ClipboardList
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, onSnapshot, doc, getDoc, setDoc } from "firebase/firestore";
import { Order, OrderStatus } from "../types";
import { formatCurrency, safeStorage, getProductPhoto } from "../utils";

interface StorefrontPortalProps {
  language: "en" | "pt";
  onAdminLoginClick: () => void;
}

interface CartItem {
  recipeId: string;
  recipeName: string;
  price: number;
  quantity: number;
  photoUrl: string;
  category: string;
}

const formatBrazilianPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  const limited = digits.slice(0, 11);
  if (limited.length === 0) return "";
  if (limited.length <= 2) return `(${limited}`;
  if (limited.length <= 3) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  if (limited.length <= 7) return `(${limited.slice(0, 2)}) ${limited.slice(2, 3)}-${limited.slice(3)}`;
  return `(${limited.slice(0, 2)}) ${limited.slice(2, 3)}-${limited.slice(3, 7)}-${limited.slice(7)}`;
};

export default function StorefrontPortal({ language, onAdminLoginClick }: StorefrontPortalProps) {
  // Real-time collections for price calculation
  const [recipes, setRecipes] = useState<any[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<any[]>([]);
  const [productionCosts, setProductionCosts] = useState({ water: 0, electricity: 0, gas: 0, electricity2: 0 });
  const [monthlyVolume, setMonthlyVolume] = useState(1500);
  const [loading, setLoading] = useState(true);

  // Store profile config
  const [storeName, setStoreName] = useState("");

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Form State
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [observations, setObservations] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"dinheiro" | "cartão" | "pix">("pix");
  const [needsChange, setNeedsChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [checkoutStep, setCheckoutStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (!isCartOpen) {
      setCheckoutStep(1);
    }
  }, [isCartOpen]);

  // Autocomplete and delivery fee states
  const [storeCity, setStoreCity] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [deliveryType, setDeliveryType] = useState<"delivery" | "retirada">("delivery");
  const [toast, setToast] = useState<{ message: string } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const [storeIcon, setStoreIcon] = useState<string | undefined>(undefined);
  const [streetQuery, setStreetQuery] = useState("");
  const [streetSuggestions, setStreetSuggestions] = useState<any[]>([]);
  const [isStreetLoading, setIsStreetLoading] = useState(false);
  const [showStreetSuggestions, setShowStreetSuggestions] = useState(false);

  // Delivery Fees and Neighborhood states
  const [deliveryFees, setDeliveryFees] = useState<Record<string, number>>({});
  const [selectedNeighborhood, setSelectedNeighborhood] = useState("");
  const [storefrontPrices, setStorefrontPrices] = useState<Record<string, number>>({});
  const [categoriesOrder, setCategoriesOrder] = useState<string[]>([]);

  // Customer order history tracking states
  const [myOrders, setMyOrders] = useState<Order[]>([]);

  // User authentication and session states
  const [currentUser, setCurrentUser] = useState<{ name: string; phone: string } | null>(() => {
    try {
      const saved = safeStorage.getItem("storefront_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"login" | "register">("login");
  const [modalName, setModalName] = useState("");
  const [modalPhone, setModalPhone] = useState("");
  const [modalPassword, setModalPassword] = useState("");
  const [modalError, setModalError] = useState("");

  // Checkout-specific authentication states
  const [checkoutMode, setCheckoutMode] = useState<"login" | "register">("login");
  const [checkoutPassword, setCheckoutPassword] = useState("");
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [checkoutError, setCheckoutError] = useState("");

  const loginUser = (user: { name: string; phone: string }) => {
    setCurrentUser(user);
    safeStorage.setItem("storefront_user", JSON.stringify(user));
  };

  const logoutUser = () => {
    setCurrentUser(null);
    safeStorage.removeItem("storefront_user");
  };

  const sanitizePhone = (val: string) => val.replace(/\D/g, "");

  const filteredMyOrders = useMemo(() => {
    if (!currentUser) return [];
    const userPhoneClean = sanitizePhone(currentUser.phone);
    return myOrders.filter(o => {
      const oPhoneClean = sanitizePhone(o.phone || "");
      return oPhoneClean === userPhoneClean;
    });
  }, [myOrders, currentUser]);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.name);
      setPhone(currentUser.phone);
    } else {
      setFullName("");
      setPhone("");
    }
  }, [currentUser]);

  // Pre-load last used address of the user
  useEffect(() => {
    if (currentUser && filteredMyOrders.length > 0) {
      if (!streetQuery && !houseNumber) {
        const lastOrder = filteredMyOrders[0];
        if (lastOrder.address) {
          const addressStr = lastOrder.address;
          let street = "";
          let num = "";
          let comp = "";
          let neighborhood = "";

          const partsBairro = addressStr.split(", Bairro: ");
          if (partsBairro.length > 1) {
            neighborhood = partsBairro[1].trim();
          }
          let remaining = partsBairro[0];

          const partsComp = remaining.split(", Comp: ");
          if (partsComp.length > 1) {
            comp = partsComp[1].trim();
          }
          remaining = partsComp[0];

          const partsNum = remaining.split(", Nº ");
          if (partsNum.length > 1) {
            num = partsNum[1].trim();
          }
          street = partsNum[0].trim();

          setStreetQuery(street);
          setHouseNumber(num);
          setComplement(comp);
          setSelectedNeighborhood(neighborhood);
        }
      }
    }
  }, [currentUser, filteredMyOrders.length]);

  const handleModalAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");

    const cleanPhone = sanitizePhone(modalPhone);

    if (modalMode === "login") {
      if (!cleanPhone || cleanPhone.length < 8) {
        setModalError(language === "pt" ? "Por favor, digite um telefone válido." : "Please enter a valid phone number.");
        return;
      }
      if (!modalPassword.trim()) {
        setModalError(language === "pt" ? "Por favor, insira a senha." : "Please enter the password.");
        return;
      }

      try {
        const userDocRef = doc(db, "storefront_users", cleanPhone);
        const userSnap = await getDoc(userDocRef);
        if (!userSnap.exists()) {
          setModalError(language === "pt" ? "Conta não encontrada. Crie uma conta primeiro." : "Account not found. Please create an account first.");
          return;
        }
        const userData = userSnap.data();
        if (userData.password !== modalPassword.trim()) {
          setModalError(language === "pt" ? "Senha incorreta. Tente novamente." : "Incorrect password. Please try again.");
          return;
        }

        loginUser({ name: userData.name, phone: userData.phone });
        setModalPassword("");
        setModalPhone("");
        setIsUserModalOpen(false);
      } catch (err) {
        console.error("Login error:", err);
        handleFirestoreError(err, OperationType.GET, `storefront_users/${cleanPhone}`);
        setModalError(language === "pt" ? "Erro ao fazer login. Tente novamente." : "Error logging in. Please try again.");
      }
    } else {
      // Register
      if (!modalName.trim()) {
        setModalError(language === "pt" ? "Por favor, insira seu nome completo." : "Please enter your full name.");
        return;
      }
      if (!cleanPhone || cleanPhone.length < 8) {
        setModalError(language === "pt" ? "Por favor, digite um telefone válido." : "Please enter a valid phone number.");
        return;
      }
      if (!modalPassword.trim() || modalPassword.length < 4) {
        setModalError(language === "pt" ? "A senha deve ter pelo menos 4 caracteres." : "Password must be at least 4 characters.");
        return;
      }

      try {
        const userDocRef = doc(db, "storefront_users", cleanPhone);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          setModalError(language === "pt" ? "Já existe uma conta com este telefone. Faça login." : "An account already exists with this phone. Please log in.");
          return;
        }

        const newUser = {
          name: modalName.trim(),
          phone: modalPhone.trim(),
          password: modalPassword.trim(),
          createdAt: new Date().toISOString()
        };

        await setDoc(userDocRef, newUser);
        loginUser({ name: newUser.name, phone: newUser.phone });
        setModalName("");
        setModalPhone("");
        setModalPassword("");
        setIsUserModalOpen(false);
      } catch (err) {
        console.error("Register error:", err);
        handleFirestoreError(err, OperationType.WRITE, `storefront_users/${cleanPhone}`);
        setModalError(language === "pt" ? "Erro ao criar conta. Tente novamente." : "Error creating account. Please try again.");
      }
    }
  };

  const handleCheckoutAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError("");

    const cleanPhone = sanitizePhone(checkoutPhone);

    if (checkoutMode === "login") {
      if (!cleanPhone || cleanPhone.length < 8) {
        setCheckoutError(language === "pt" ? "Por favor, digite um telefone válido." : "Please enter a valid phone number.");
        return;
      }
      if (!checkoutPassword.trim()) {
        setCheckoutError(language === "pt" ? "Por favor, insira a senha." : "Please enter the password.");
        return;
      }

      try {
        const userDocRef = doc(db, "storefront_users", cleanPhone);
        const userSnap = await getDoc(userDocRef);
        if (!userSnap.exists()) {
          setCheckoutError(language === "pt" ? "Conta não encontrada. Crie uma conta abaixo." : "Account not found. Please create an account below.");
          return;
        }
        const userData = userSnap.data();
        if (userData.password !== checkoutPassword.trim()) {
          setCheckoutError(language === "pt" ? "Senha incorreta. Tente novamente." : "Incorrect password. Please try again.");
          return;
        }

        loginUser({ name: userData.name, phone: userData.phone });
        setCheckoutPassword("");
        setCheckoutPhone("");
      } catch (err) {
        console.error("Checkout login error:", err);
        handleFirestoreError(err, OperationType.GET, `storefront_users/${cleanPhone}`);
        setCheckoutError(language === "pt" ? "Erro ao fazer login. Tente novamente." : "Error logging in. Please try again.");
      }
    } else {
      // Register
      if (!checkoutName.trim()) {
        setCheckoutError(language === "pt" ? "Por favor, insira seu nome completo." : "Please enter your full name.");
        return;
      }
      if (!cleanPhone || cleanPhone.length < 8) {
        setCheckoutError(language === "pt" ? "Por favor, digite um telefone válido." : "Please enter a valid phone number.");
        return;
      }
      if (!checkoutPassword.trim() || checkoutPassword.length < 4) {
        setCheckoutError(language === "pt" ? "A senha deve ter pelo menos 4 caracteres." : "Password must be at least 4 characters.");
        return;
      }

      try {
        const userDocRef = doc(db, "storefront_users", cleanPhone);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          setCheckoutError(language === "pt" ? "Já existe uma conta com este telefone. Faça login." : "An account already exists with this phone. Please log in.");
          return;
        }

        const newUser = {
          name: checkoutName.trim(),
          phone: checkoutPhone.trim(),
          password: checkoutPassword.trim(),
          createdAt: new Date().toISOString()
        };

        await setDoc(userDocRef, newUser);
        loginUser({ name: newUser.name, phone: newUser.phone });
        setCheckoutName("");
        setCheckoutPhone("");
        setCheckoutPassword("");
      } catch (err) {
        console.error("Checkout register error:", err);
        handleFirestoreError(err, OperationType.WRITE, `storefront_users/${cleanPhone}`);
        setCheckoutError(language === "pt" ? "Erro ao criar conta. Tente novamente." : "Error creating account. Please try again.");
      }
    }
  };

  const [isMyOrdersOpen, setIsMyOrdersOpen] = useState(false);
  const [activeChannels, setActiveChannels] = useState<string[]>(["iFood", "Website"]);
  const [integrations, setIntegrations] = useState<Record<string, boolean>>(() => {
    try {
      const saved = safeStorage.getItem("orders_integrations");
      return saved ? JSON.parse(saved) : { ifood: true, amo: false, "99food": false, website: true };
    } catch {
      return { ifood: true, amo: false, "99food": false, website: true };
    }
  });

  const isWebsiteEnabled = useMemo(() => {
    return !!integrations.website;
  }, [integrations]);

  const syncMyOrders = () => {
    try {
      const savedOrdersStr = safeStorage.getItem("orders_list");
      if (savedOrdersStr) {
        const parsed = JSON.parse(savedOrdersStr) as Order[];
        setMyOrders(parsed);
      } else {
        setMyOrders([]);
      }
    } catch (e) {
      console.error("Error syncing my orders list:", e);
    }

    try {
      const saved = safeStorage.getItem("orders_integrations");
      if (saved) {
        setIntegrations(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Error syncing integrations:", e);
    }
  };

  useEffect(() => {
    syncMyOrders();
    const interval = setInterval(syncMyOrders, 2000);
    window.addEventListener("storage", syncMyOrders);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", syncMyOrders);
    };
  }, []);

  // Active placed order tracking state
  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => {
    try {
      return safeStorage.getItem("active_storefront_order_id");
    } catch {
      return null;
    }
  });
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // Fetch collections
  useEffect(() => {
    const unsubRecipes = onSnapshot(collection(db, "recipes"), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setRecipes(list);
      setLoading(false);
    });

    const unsubFixed = onSnapshot(collection(db, "fixed_expenses"), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setFixedExpenses(list);
    });

    const unsubProd = onSnapshot(doc(db, "settings", "production_costs"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setProductionCosts({
          water: Number(data.water) || 0,
          electricity: Number(data.electricity) || 0,
          gas: Number(data.gas) || 0,
          electricity2: Number(data.electricity2) || 0
        });
      }
    });

    const unsubVolume = onSnapshot(doc(db, "settings", "volume_and_app_tax"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setMonthlyVolume(Number(data.monthlyVolume) || 1500);
      }
    });

    const unsubStore = onSnapshot(doc(db, "settings", "store_config"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.stores && Array.isArray(data.stores) && data.activeStoreId) {
          const activeStore = data.stores.find((s: any) => s.id === data.activeStoreId);
          if (activeStore) {
            setStoreName(activeStore.storeName || "");
            setStoreCity(activeStore.city || "");
            setStoreAddress(activeStore.address || "");
            setStorePhone(activeStore.phone || "");
            setActiveChannels(activeStore.activeChannels || []);
            setStoreIcon(activeStore.storeIcon || undefined);
            return;
          }
        }
        setStoreName(data.storeName || "");
        setStoreCity(data.city || "");
        setStoreAddress(data.address || "");
        setStorePhone(data.phone || "");
        setActiveChannels(data.activeChannels || ["iFood", "Website"]);
        setStoreIcon(data.storeIcon || undefined);
      }
    });

    const unsubPrices = onSnapshot(doc(db, "settings", "storefront_prices"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setStorefrontPrices(data.prices || {});
      }
    });

    const unsubFees = onSnapshot(doc(db, "settings", "delivery_fees"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setDeliveryFees(data.fees || {});
      }
    });

    const unsubCategoriesOrder = onSnapshot(doc(db, "settings", "categories_order"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setCategoriesOrder(data.order || []);
      }
    });

    return () => {
      unsubRecipes();
      unsubFixed();
      unsubProd();
      unsubVolume();
      unsubStore();
      unsubPrices();
      unsubFees();
      unsubCategoriesOrder();
    };
  }, []);

  // Poll current order from safeStorage for real-time status tracker
  useEffect(() => {
    if (!activeOrderId) {
      setActiveOrder(null);
      return;
    }

    const checkOrderStatus = () => {
      try {
        const savedOrders = safeStorage.getItem("orders_list");
        if (savedOrders) {
          const parsed = JSON.parse(savedOrders) as Order[];
          const found = parsed.find(o => o.id === activeOrderId);
          if (found) {
            setActiveOrder(found);
            return;
          }
        }
      } catch (e) {
        console.error("Error polling active order:", e);
      }
    };

    checkOrderStatus();
    const interval = setInterval(checkOrderStatus, 1500);
    return () => clearInterval(interval);
  }, [activeOrderId]);

  // Filter out the recipes with category "Preparo" from the storefront listing
  const filteredRecipes = useMemo(() => {
    return recipes.filter(
      (r) => (r.category || "").trim().toLowerCase() !== "preparo"
    );
  }, [recipes]);

  // Pricing math aggregates
  const calculatedPrices = useMemo(() => {
    const globalFixedSum = fixedExpenses.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    const globalProductionSum = productionCosts.water + productionCosts.electricity + productionCosts.gas + productionCosts.electricity2;
    const vol = monthlyVolume > 0 ? monthlyVolume : 1500;

    const priceMap: Record<string, number> = {};

    filteredRecipes.forEach((r) => {
      const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
      const rawIngredientsCostSum = ingredients.reduce((sum, ing: any) => sum + ((Number(ing.quantity) || 0) * (Number(ing.price) || 0)), 0);
      const yieldCount = Number(r.portions) > 0 ? Number(r.portions) : 1;
      const portionRawCost = rawIngredientsCostSum / yieldCount;
      const portionFixedOverhead = globalFixedSum / vol;
      const portionProductionUtility = globalProductionSum / vol;
      const totalRealUnitCost = portionRawCost + portionFixedOverhead + portionProductionUtility;
      
      const markupValue = Number(r.markup) || 2.0;
      const suggestedPrice = totalRealUnitCost * markupValue;

      // Use price defined in "items price" settings with robust fallbacks
      const overridenPrice = storefrontPrices[r.id];
      const parsedOverridenPrice = overridenPrice !== undefined && overridenPrice !== null ? Number(overridenPrice) : NaN;
      priceMap[r.id] = !isNaN(parsedOverridenPrice) ? parsedOverridenPrice : (suggestedPrice > 0 ? suggestedPrice : 15.00);
    });

    return priceMap;
  }, [filteredRecipes, fixedExpenses, productionCosts, monthlyVolume, storefrontPrices]);

  // Total quantity in cart
  const cartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Sorted recipes based on categoriesOrder setting
  const sortedRecipes = useMemo(() => {
    return [...filteredRecipes].sort((a, b) => {
      const catA = (a.category || "").trim();
      const catB = (b.category || "").trim();

      const hasCatA = !!catA;
      const hasCatB = !!catB;

      // Uncategorized items must be listed last
      if (!hasCatA && hasCatB) return 1;
      if (hasCatA && !hasCatB) return -1;
      if (!hasCatA && !hasCatB) {
        return a.recipeName.localeCompare(b.recipeName);
      }

      const indexA = categoriesOrder.indexOf(catA);
      const indexB = categoriesOrder.indexOf(catB);

      if (indexA !== -1 && indexB !== -1) {
        if (indexA !== indexB) {
          return indexA - indexB;
        }
      } else if (indexA !== -1) {
        return -1;
      } else if (indexB !== -1) {
        return 1;
      } else {
        const catCompare = catA.localeCompare(catB);
        if (catCompare !== 0) return catCompare;
      }

      return a.recipeName.localeCompare(b.recipeName);
    });
  }, [filteredRecipes, categoriesOrder]);

  const storefrontCategories = useMemo(() => {
    const cats = new Set<string>();
    filteredRecipes.forEach((r) => {
      if (r.category && r.category.trim()) {
        cats.add(r.category.trim());
      }
    });
    
    // Sort based on categoriesOrder
    const ordered = categoriesOrder.filter(cat => cats.has(cat));
    // Sort remaining categories alphabetically to match sortedRecipes fallback sorting
    const remainingSorted = Array.from(cats)
      .filter(cat => !ordered.includes(cat))
      .sort((a, b) => a.localeCompare(b));

    remainingSorted.forEach(cat => {
      ordered.push(cat);
    });

    // If there are recipes with no category, add empty string representing "Outros" listed last
    const hasUncategorized = filteredRecipes.some(r => !r.category || !r.category.trim());
    if (hasUncategorized) {
      ordered.push("");
    }

    return ordered;
  }, [filteredRecipes, categoriesOrder]);

  const handleScrollToCategory = (catName: string) => {
    const sectionId = catName.trim() ? `category-section-${catName.trim().replace(/\s+/g, "-")}` : "category-section-uncategorized";
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Total value in cart
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [cart]);

  const [cityName, stateUf] = useMemo(() => {
    if (!storeCity) return ["", ""];
    const parts = storeCity.split(" - ");
    if (parts.length === 2) {
      return [parts[0].trim(), parts[1].trim()];
    }
    return [storeCity, ""];
  }, [storeCity]);

  useEffect(() => {
    const trimmed = streetQuery.trim();
    // Bypass fetch if query contains any digit or a comma, which indicates entering a number/details
    if (!cityName || !stateUf || trimmed.length < 3 || /\d/.test(trimmed) || trimmed.includes(",")) {
      setStreetSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      setIsStreetLoading(true);
      const url = `https://viacep.com.br/ws/${encodeURIComponent(stateUf)}/${encodeURIComponent(cityName)}/${encodeURIComponent(trimmed)}/json/`;
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            // Deduplicate logradouros
            const seen = new Set();
            const unique = data.filter((item) => {
              const key = `${item.logradouro} - ${item.bairro}`.toLowerCase();
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            setStreetSuggestions(unique.slice(0, 8));
          } else {
            setStreetSuggestions([]);
          }
        })
        .catch((err) => {
          console.error("Error fetching streets autocomplete:", err);
        })
        .finally(() => {
          setIsStreetLoading(false);
        });
    }, 350);

    return () => clearTimeout(delayDebounceFn);
  }, [streetQuery, cityName, stateUf]);

  const deliveryFee = useMemo(() => {
    if (!selectedNeighborhood) return 0;
    const normalizedSelected = selectedNeighborhood.trim().toLowerCase();
    const matchKey = Object.keys(deliveryFees).find(
      (k) => k.trim().toLowerCase() === normalizedSelected
    );
    return matchKey ? Number(deliveryFees[matchKey]) : 0;
  }, [deliveryFees, selectedNeighborhood]);

  const cartTotal = useMemo(() => {
    return cartSubtotal + deliveryFee;
  }, [cartSubtotal, deliveryFee]);

  const handleAddToCart = (recipe: any) => {
    const price = calculatedPrices[recipe.id] || 15.0;
    const photo = recipe.photoUrl || getProductPhoto(recipe.recipeName, recipe.category || "Bakery");
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.recipeId === recipe.id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx].quantity += 1;
        return updated;
      } else {
        return [
          ...prev,
          {
            recipeId: recipe.id,
            recipeName: recipe.recipeName,
            price: price,
            quantity: 1,
            photoUrl: photo,
            category: recipe.category || "Other"
          }
        ];
      }
    });

    setToast({
      message: language === "pt"
        ? `${recipe.recipeName} adicionado ao carrinho!`
        : `${recipe.recipeName} added to cart!`
    });
  };

  const handleUpdateQuantity = (recipeId: string, delta: number) => {
    setCart((prev) => {
      return prev.map((item) => {
        if (item.recipeId === recipeId) {
          const newQty = item.quantity + delta;
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const validateDeliveryDetails = () => {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) {
      errors.fullName = language === "pt" ? "Por favor, insira seu nome completo." : "Please enter your full name.";
    }
    if (!phone.trim()) {
      errors.phone = language === "pt" ? "Por favor, informe seu número de telefone." : "Please enter your contact phone number.";
    }
    if (deliveryType === "delivery") {
      if (!streetQuery.trim()) {
        errors.streetQuery = language === "pt" ? "Por favor, digite o nome da rua." : "Please enter street address.";
      } else if (!selectedNeighborhood) {
        errors.streetQuery = language === "pt" ? "Por favor, selecione uma rua da lista de sugestões para detectar o bairro automaticamente." : "Please select a street from suggestions to auto-detect the neighborhood.";
      }
      if (!houseNumber.trim()) {
        errors.houseNumber = language === "pt" ? "Por favor, insira o número." : "Please enter house number.";
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (validateDeliveryDetails()) {
      setCheckoutStep(2);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) {
      errors.fullName = language === "pt" ? "Por favor, insira seu nome completo." : "Please enter your full name.";
    }
    if (!phone.trim()) {
      errors.phone = language === "pt" ? "Por favor, informe seu número de telefone." : "Please enter your contact phone number.";
    }
    if (deliveryType === "delivery") {
      if (!streetQuery.trim()) {
        errors.streetQuery = language === "pt" ? "Por favor, digite o nome da rua." : "Please enter street address.";
      } else if (!selectedNeighborhood) {
        errors.streetQuery = language === "pt" ? "Por favor, selecione uma rua da lista de sugestões para detectar o bairro automaticamente." : "Please select a street from suggestions to auto-detect the neighborhood.";
      }
      if (!houseNumber.trim()) {
        errors.houseNumber = language === "pt" ? "Por favor, insira o número." : "Please enter house number.";
      }
    }
    if (paymentMethod === "dinheiro" && needsChange && (!changeFor.trim() || Number(changeFor) <= cartTotal)) {
      errors.changeFor = language === "pt" 
        ? "O valor para troco deve ser maior que o total do pedido." 
        : "Change amount must be greater than the order total.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePlaceOrder = () => {
    if (!isWebsiteEnabled) {
      alert(language === "pt" ? "Pedidos pelo site estão temporariamente indisponíveis." : "Orders via website are temporarily disabled.");
      return;
    }
    if (!validateForm()) return;

    // Create unique website order ID
    const webId = `WEB-${Math.floor(1000 + Math.random() * 9000)}`;

    // Build the formatted order items text description
    const itemsDescription = cart.map((item) => `${item.quantity}x ${item.recipeName}`).join(", ");

    const d = new Date();
    const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const dateStr = d.toISOString().split("T")[0];

    const fullAddress = deliveryType === "retirada"
      ? (language === "pt" ? "Retirada na Loja" : "Pickup at Store")
      : `${streetQuery.trim()}${houseNumber.trim() ? `, Nº ${houseNumber.trim()}` : ""}${complement.trim() ? `, Comp: ${complement.trim()}` : ""}${selectedNeighborhood ? `, Bairro: ${selectedNeighborhood}` : ""}`;

    // Assembly Order payload compliant with types.ts interface
    const newOrder: Order = {
      id: webId,
      channel: "website",
      customerName: fullName.trim(),
      phone: phone.trim(),
      address: fullAddress,
      paymentMethod: paymentMethod,
      time: timeStr,
      date: dateStr,
      items: itemsDescription,
      total: cartTotal,
      status: "pending" as OrderStatus,
      type: deliveryType === "retirada" ? "pickup" : "delivery",
      observations: observations.trim() || undefined
    };

    // Save order into system safeStorage orders_list
    try {
      const savedOrdersStr = safeStorage.getItem("orders_list");
      const savedOrders = savedOrdersStr ? JSON.parse(savedOrdersStr) : [];
      const updated = [newOrder, ...savedOrders];
      safeStorage.setItem("orders_list", JSON.stringify(updated));
    } catch (e) {
      console.error("Error inserting storefront order to orders_list:", e);
    }

    // Set order as active to show real-time tracking
    try {
      safeStorage.setItem("active_storefront_order_id", webId);
    } catch {}

    setActiveOrderId(webId);
    setActiveOrder(newOrder);

    // Clear cart and form inputs
    setCart([]);
    setIsCartOpen(false);
    setFullName("");
    setPhone("");
    setStreetQuery("");
    setHouseNumber("");
    setComplement("");
    setSelectedNeighborhood("");
    setObservations("");
    setNeedsChange(false);
    setChangeFor("");
  };

  const handleResetActiveOrder = () => {
    try {
      safeStorage.removeItem("active_storefront_order_id");
    } catch {}
    setActiveOrderId(null);
    setActiveOrder(null);
  };

  // Stepper rendering helpers for Order status
  const getStatusStepIndex = (status?: OrderStatus): number => {
    if (!status) return 0;
    switch (status) {
      case "pending": return 0;
      case "preparing": return 1;
      case "delivering": return 2;
      case "completed": return 3;
      case "cancelled": return -1;
      default: return 0;
    }
  };

  const currentStepIdx = getStatusStepIndex(activeOrder?.status);

  // Display default header name
  const displayName = storeName || "";

  return (
    <div className="min-h-[85vh] bg-slate-50/50 rounded-3xl pt-2.5 pb-4 px-3 sm:p-8 border border-slate-100 flex flex-col justify-between animate-fade-in">
      
      {/* 1. ORDER TRACKING SCREEN */}
      {activeOrderId && activeOrder ? (
        <div className="max-w-xl mx-auto w-full bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm space-y-6 text-center">
          <div className="relative">
            <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center border ${
              activeOrder.status === "cancelled" 
                ? "bg-rose-50 border-rose-100 text-rose-500" 
                : activeOrder.status === "completed" 
                ? "bg-emerald-50 border-emerald-100 text-emerald-500 animate-bounce" 
                : "bg-indigo-50 border-indigo-100 text-indigo-500 animate-pulse"
            }`}>
              {activeOrder.status === "cancelled" ? (
                <X className="w-8 h-8" />
              ) : activeOrder.status === "completed" ? (
                <CheckCircle className="w-8 h-8" />
              ) : (
                <Clock className="w-8 h-8" />
              )}
            </div>
            {activeOrder.status !== "cancelled" && activeOrder.status !== "completed" && (
              <span className="absolute top-0 right-[38%] flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-indigo-500"></span>
              </span>
            )}
          </div>

          <div>
            <span className="text-[10px] font-mono font-extrabold uppercase bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full border border-slate-200">
              ID: {activeOrder.id}
            </span>
            <h2 className="text-xl font-extrabold text-slate-950 mt-3 tracking-tight">
              {activeOrder.status === "cancelled" 
                ? (language === "pt" ? "Pedido Cancelado" : "Order Cancelled")
                : activeOrder.status === "completed" 
                ? (language === "pt" ? "Pedido Entregue!" : "Order Delivered!")
                : (language === "pt" ? "Pedido em Andamento..." : "Order in Progress...")}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {activeOrder.status === "cancelled"
                ? (language === "pt" ? "Seu pedido foi cancelado pelo estabelecimento." : "Your order was declined by the restaurant.")
                : activeOrder.status === "completed"
                ? (language === "pt" ? "Agradecemos a sua preferência! Bom apetite." : "Thank you for choosing us! Enjoy your meal.")
                : (language === "pt" ? "Mantenha esta página aberta. O status é atualizado em tempo real!" : "Keep this browser window active to monitor real-time fulfillment status!")}
            </p>
          </div>

          {/* Stepper tracking progress */}
          {activeOrder.status !== "cancelled" && (
            <div className="py-4 border-y border-slate-50">
              <div className="relative flex items-center justify-between max-w-sm mx-auto">
                {/* Horizontal progress lines */}
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-100 -z-10" />
                <div 
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-indigo-500 -z-10 transition-all duration-500" 
                  style={{ width: `${(currentStepIdx / 3) * 100}%` }}
                />

                {/* Steps circles */}
                {[
                  { labelPt: "Recebido", labelEn: "Pending", icon: ShoppingBag },
                  { labelPt: "Preparo", labelEn: "Cooking", icon: ChefHat },
                  { labelPt: "A Caminho", labelEn: "Delivery", icon: Truck },
                  { labelPt: "Entregue", labelEn: "Done", icon: CheckCircle },
                ].map((step, idx) => {
                  const StepIcon = step.icon;
                  const isPast = idx < currentStepIdx;
                  const isCurrent = idx === currentStepIdx;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1.5 relative">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
                        isPast 
                          ? "bg-indigo-500 border-indigo-500 text-white shadow-md shadow-indigo-500/10" 
                          : isCurrent 
                          ? "bg-white border-indigo-500 text-indigo-600 ring-4 ring-indigo-500/10 scale-110 font-bold" 
                          : "bg-white border-slate-200 text-slate-400"
                      }`}>
                        {isPast ? <Check className="w-4.5 h-4.5 font-bold" /> : <StepIcon className="w-4.5 h-4.5" />}
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${
                        isCurrent ? "text-indigo-600 font-extrabold" : "text-slate-400"
                      }`}>
                        {language === "pt" ? step.labelPt : step.labelEn}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Order Summary Details */}
          <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4.5 text-left text-xs space-y-3">
            <h4 className="font-extrabold text-slate-800 uppercase tracking-widest text-[10px] border-b border-slate-150 pb-2 flex items-center justify-between">
              <span>{language === "pt" ? "Resumo do Pedido" : "Order Summary"}</span>
              <span className="font-mono text-indigo-600">{activeOrder.time}</span>
            </h4>
            <div className="space-y-1.5">
              <p className="text-slate-700 font-medium">
                <span className="text-slate-400 uppercase font-bold text-[9px] tracking-wider block">{language === "pt" ? "Produtos:" : "Products:"}</span>
                <span className="text-slate-900 font-semibold">{activeOrder.items}</span>
              </p>
              <p className="text-slate-700 font-medium">
                <span className="text-slate-400 uppercase font-bold text-[9px] tracking-wider block">{language === "pt" ? "Entregar para:" : "Deliver to:"}</span>
                <span className="text-slate-900 font-semibold">{activeOrder.customerName}</span>
              </p>
              <p className="text-slate-700 font-medium">
                <span className="text-slate-400 uppercase font-bold text-[9px] tracking-wider block">{language === "pt" ? "Endereço:" : "Address:"}</span>
                <span className="text-slate-900 font-semibold">{activeOrder.address}</span>
              </p>
              <div className="grid grid-cols-2 gap-2 border-t border-slate-150 pt-2.5">
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[9px] tracking-wider block">{language === "pt" ? "Pagamento:" : "Payment Method:"}</span>
                  <span className="text-slate-900 font-extrabold uppercase font-mono">{activeOrder.paymentMethod}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 uppercase font-bold text-[9px] tracking-wider block">{language === "pt" ? "Total Pago:" : "Total Paid:"}</span>
                  <span className="text-indigo-600 font-extrabold text-sm font-mono">{formatCurrency(activeOrder.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cancel Order Button */}
          <button
            onClick={() => {
              const cleanPhone = (storePhone || "").replace(/\D/g, "");
              const orderId = activeOrder.id || "";
              const url = `https://wa.me/55${cleanPhone}?text=Gostaria%20de%20cancelar%20o%20pedido%20${encodeURIComponent(orderId)}.`;
              window.open(url, "_blank");
            }}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-500 font-bold text-xs rounded-xl cursor-pointer border border-slate-200 tracking-wider uppercase transition-all flex items-center justify-center gap-2"
          >
            {language === "pt" ? "Cancelar Pedido" : "Cancel Order"}
          </button>

          <button
            onClick={handleResetActiveOrder}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md shadow-slate-950/15 tracking-wider uppercase transition-all"
          >
            {language === "pt" ? "Voltar" : "Back"}
          </button>
        </div>
      ) : (
        /* 2. CATALOG & CART STOREFRONT STORE */
        <div className="space-y-3.5 sm:space-y-6">
          {/* Header Storefront */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 sm:pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              {storeIcon ? (
                <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-md shrink-0 border border-slate-100">
                  <img 
                    src={storeIcon} 
                    alt="Store Logo" 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="p-3 bg-amber-500 rounded-2xl text-white shadow-md shadow-amber-500/20">
                  <ShoppingBag className="w-6 h-6" />
                </div>
              )}
              <div className="text-left">
                {storeName && (
                  <h1 className="text-xl font-extrabold text-slate-950 tracking-tight leading-none">
                    {displayName}
                  </h1>
                )}
                <div className="mt-1.5 flex items-center">
                  {isWebsiteEnabled ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-widest animate-pulse">
                      {language === "pt" ? "Aberto" : "Live"}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-widest">
                      {language === "pt" ? "Indisponível" : "Offline"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-row items-center justify-center sm:justify-end gap-1.5 sm:gap-2 w-full sm:w-auto">
              {/* Meus Pedidos button */}
              {currentUser && (
                <button
                  onClick={() => setIsMyOrdersOpen(true)}
                  className="flex-1 sm:flex-none relative bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-[10px] sm:text-xs px-2 sm:px-4 py-2.5 sm:py-3 rounded-2xl border border-slate-150 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-2 min-w-0"
                >
                  <ClipboardList className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">{language === "pt" ? "Pedidos" : "Orders"}</span>
                  {filteredMyOrders.filter(o => o.status !== "completed" && o.status !== "cancelled").length > 0 && (
                    <span className="absolute -top-1.5 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-indigo-600 text-white font-mono font-extrabold text-[9px] shadow-sm animate-bounce">
                      {filteredMyOrders.filter(o => o.status !== "completed" && o.status !== "cancelled").length}
                    </span>
                  )}
                </button>
              )}

              {/* Shopping Cart Trigger Indicator Button */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="flex-1 sm:flex-none relative bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-[10px] sm:text-xs px-2 sm:px-4 py-2.5 sm:py-3 rounded-2xl border border-slate-150 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-2 min-w-0"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">{language === "pt" ? "Carrinho" : "Cart"}</span>
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-amber-500 text-white font-mono font-extrabold text-[9px] shadow-sm animate-bounce">
                    {cartCount}
                  </span>
                )}
              </button>

              {/* User Account Trigger Button */}
              <button
                onClick={() => {
                  setModalError("");
                  setIsUserModalOpen(true);
                }}
                className={`flex-1 sm:flex-none relative bg-white hover:bg-slate-50 font-extrabold text-[10px] sm:text-xs px-2 sm:px-4 py-2.5 sm:py-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-2 min-w-0 ${
                  currentUser 
                    ? "border-emerald-500 text-emerald-700 hover:bg-emerald-50/20" 
                    : "border-slate-150 text-slate-700"
                }`}
              >
                <User className={`w-3.5 h-3.5 shrink-0 ${currentUser ? "text-emerald-500" : "text-slate-400"}`} />
                <span className="truncate">
                  {currentUser 
                    ? currentUser.name.split(" ")[0] 
                    : (language === "pt" ? "Entrar" : "Login")
                  }
                </span>
              </button>
            </div>
          </div>

          {/* Categories horizontal touch-scrollable navigation row */}
          {storefrontCategories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none border-b border-slate-100 touch-pan-x overscroll-x-contain pointer-events-auto">
              {storefrontCategories.map((cat) => {
                const label = cat.trim() || (language === "pt" ? "Outros" : "Others");
                return (
                  <button
                    key={cat}
                    onClick={() => handleScrollToCategory(cat)}
                    className="shrink-0 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 active:bg-slate-100 font-bold text-[11px] rounded-full border border-slate-200 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Website integration disabled banner */}
          {!isWebsiteEnabled && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3 text-rose-800 text-xs text-left font-semibold">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{language === "pt" ? "Pedidos pelo site estão temporariamente desativados." : "Website online orders are temporarily disabled."}</p>
                <p className="text-[11px] text-rose-600/90 font-medium mt-0.5">{language === "pt" ? "Este canal de vendas foi desativado pelo administrador. Você ainda pode visualizar o catálogo e acompanhar pedidos já feitos, mas novos pedidos não são permitidos no momento." : "This sales channel has been deactivated by the store administrator. You can still browse the catalog and track past orders, but new orders are paused."}</p>
              </div>
            </div>
          )}

          {/* Catalog grid */}
          {loading ? (
            <div className="py-24 text-center">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-xs text-slate-400 font-medium">{language === "pt" ? "carregando cardápio..." : "carregando cardápio..."}</p>
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="py-16 text-center max-w-sm mx-auto space-y-4">
              <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500 border border-amber-100">
                <ChefHat className="w-7 h-7" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">{language === "pt" ? "Nenhum produto cadastrado" : "No recipes saved yet"}</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {language === "pt" 
                    ? "Faça login como administrador para criar e gerenciar fichas técnicas de receitas. Elas aparecerão aqui automaticamente!" 
                    : "Log in as administrator using 'admin' / 'admin' in the footer to add technical recipe costing sheets."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              {storefrontCategories.map((cat) => {
                const recipesForCategory = sortedRecipes.filter(r => {
                  const rCat = (r.category || "").trim();
                  return rCat === cat.trim();
                });

                if (recipesForCategory.length === 0) return null;

                const sectionId = cat.trim() ? `category-section-${cat.trim().replace(/\s+/g, "-")}` : "category-section-uncategorized";
                const catLabel = cat.trim() || (language === "pt" ? "Outros" : "Others");

                return (
                  <div key={cat} id={sectionId} className="space-y-4">
                    <div className="pt-2 pb-2 text-left border-b border-slate-100/80 mb-2">
                      <h2 className="text-xs font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full shrink-0" />
                        {catLabel}
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                      {recipesForCategory.map((r) => {
                        const price = calculatedPrices[r.id] || 15.0;
                        const photo = r.photoUrl || getProductPhoto(r.recipeName, r.category || "Bakery");
                        return (
                          <div 
                            key={r.id} 
                            className="bg-white rounded-xl sm:rounded-3xl border border-slate-100 p-1.5 sm:p-0 overflow-hidden shadow-2xs hover:shadow-md hover:border-slate-200/60 transition-all flex group"
                          >
                            {/* Mobile Compact Layout */}
                            <div className="flex sm:hidden items-center justify-between w-full gap-2.5">
                              {/* Photo cover */}
                              <div className="relative w-14 h-14 bg-slate-50 rounded-lg overflow-hidden shrink-0">
                                <img 
                                  src={photo} 
                                  alt={r.recipeName}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  onError={(e) => {
                                    e.currentTarget.src = "https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=600";
                                  }}
                                />
                              </div>

                              {/* Title & Price */}
                              <div className="text-left flex-1 min-w-0 space-y-0.5">
                                <h3 className="font-bold text-xs text-slate-950 tracking-tight leading-tight truncate">
                                  {r.recipeName}
                                </h3>
                                <span className="font-mono text-xs font-extrabold text-slate-950 block">
                                  {formatCurrency(price)}
                                </span>
                              </div>

                              {/* Add Button */}
                              <div className="shrink-0">
                                <button
                                  onClick={() => isWebsiteEnabled && handleAddToCart(r)}
                                  disabled={!isWebsiteEnabled}
                                  className={`font-extrabold text-[10px] px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                                    isWebsiteEnabled 
                                      ? "bg-slate-900 hover:bg-amber-500 text-white cursor-pointer hover:scale-103 active:scale-98 shadow-xs" 
                                      : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                  }`}
                                >
                                  <Plus className="w-3 h-3 text-white" />
                                  <span>
                                    {isWebsiteEnabled 
                                      ? (language === "pt" ? "Add" : "Add") 
                                      : (language === "pt" ? "Fechado" : "Closed")
                                    }
                                  </span>
                                </button>
                              </div>
                            </div>

                            {/* Tablet & Desktop Layout */}
                            <div className="hidden sm:flex flex-col w-full h-full justify-between">
                              {/* Photo cover */}
                              <div className="relative h-44 w-full bg-slate-50 overflow-hidden shrink-0">
                                <img 
                                  src={photo} 
                                  alt={r.recipeName}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  onError={(e) => {
                                    e.currentTarget.src = "https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=600";
                                  }}
                                />
                                <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs text-slate-800 font-bold px-2.5 py-0.5 rounded-lg text-[9px] uppercase tracking-wider border border-white/50">
                                  {r.category || (language === "pt" ? "Outros" : "Bakery")}
                                </span>
                              </div>

                              {/* Description & actions card */}
                              <div className="p-5 flex-1 flex flex-col justify-between gap-4 min-w-0">
                                <div className="text-left space-y-1.5">
                                  <h3 className="font-bold text-sm text-slate-950 tracking-tight leading-tight group-hover:text-amber-600 transition-colors">
                                    {r.recipeName}
                                  </h3>
                                </div>

                                <div className="flex items-center justify-between gap-3 pt-2">
                                  <div className="text-left">
                                    <span className="font-mono text-base font-extrabold text-slate-950 block">
                                      {formatCurrency(price)}
                                    </span>
                                  </div>

                                  <button
                                    onClick={() => isWebsiteEnabled && handleAddToCart(r)}
                                    disabled={!isWebsiteEnabled}
                                    className={`font-extrabold text-[11px] px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 ${
                                      isWebsiteEnabled 
                                        ? "bg-slate-900 hover:bg-amber-500 text-white cursor-pointer hover:scale-103 active:scale-98 shadow-xs" 
                                        : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                    }`}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>
                                      {isWebsiteEnabled 
                                        ? (language === "pt" ? "Add" : "Add") 
                                        : (language === "pt" ? "Fechado" : "Closed")
                                      }
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. SIDEBAR DRAWER MODAL OVERLAY FOR USER'S ORDERS */}
      {isMyOrdersOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex justify-end animate-fade-in">
          <div className="w-full max-w-md bg-white h-full flex flex-col justify-between shadow-2xl relative animate-slide-left border-l border-slate-100">
            {/* Header drawer */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-950 tracking-tight">
                  {language === "pt" ? "Meus Pedidos" : "My Orders"}
                </h3>
              </div>
              <button 
                onClick={() => setIsMyOrdersOpen(false)}
                className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Content list drawer */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {filteredMyOrders.length === 0 ? (
                <div className="py-24 text-center max-w-xs mx-auto space-y-3">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-xs text-slate-700">{language === "pt" ? "Nenhum pedido feito" : "No orders found"}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {language === "pt" ? "Você ainda não realizou pedidos com esta conta." : "You have not placed any orders with this account yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {language === "pt" ? "Histórico de Pedidos" : "Order History"}
                  </p>
                  
                  {filteredMyOrders.map((order) => {
                    const isCancelled = order.status === "cancelled";
                    const isCompleted = order.status === "completed";
                    const statusTextPt = isCancelled ? "Cancelado" : isCompleted ? "Entregue" : order.status === "preparing" ? "Em Preparo" : order.status === "delivering" ? "A Caminho" : "Pendente";
                    const statusTextEn = isCancelled ? "Cancelled" : isCompleted ? "Delivered" : order.status === "preparing" ? "Cooking" : order.status === "delivering" ? "In Transit" : "Pending";
                    
                    return (
                      <div 
                        key={order.id} 
                        onClick={() => {
                          setActiveOrderId(order.id);
                          setActiveOrder(order);
                          try {
                            safeStorage.setItem("active_storefront_order_id", order.id);
                          } catch {}
                          setIsMyOrdersOpen(false);
                        }}
                        className="p-4 rounded-2xl border border-slate-150 hover:border-indigo-200 bg-white hover:bg-slate-50/40 transition-all cursor-pointer text-left space-y-2.5 shadow-3xs group"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                            #{order.id.slice(-5).toUpperCase()}
                          </span>
                          <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                            isCancelled 
                              ? "bg-rose-50 border-rose-100 text-rose-600" 
                              : isCompleted 
                              ? "bg-emerald-50 border-emerald-100 text-emerald-600" 
                              : "bg-indigo-50 border-indigo-100 text-indigo-600"
                          }`}>
                            {language === "pt" ? statusTextPt : statusTextEn}
                          </span>
                        </div>

                        <div className="text-xs space-y-1">
                          <p className="font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                            {order.items}
                          </p>
                          <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                            <span>{order.date} {order.time}</span>
                            <span className="font-mono font-bold text-slate-700">{formatCurrency(order.total)}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                          <span>{language === "pt" ? "Acompanhar Status" : "Track Status"}</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer drawer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setIsMyOrdersOpen(false)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md transition-all uppercase tracking-wider"
              >
                {language === "pt" ? "Fechar" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. SIDEBAR DRAWER MODAL OVERLAY FOR CART CHECKOUT */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex justify-end animate-fade-in">
          <div className="w-full max-w-md bg-white h-full flex flex-col justify-between shadow-2xl relative animate-slide-left border-l border-slate-100">
            {/* Header drawer */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-950 tracking-tight">
                  {language === "pt" ? "Carrinho" : "Cart"}
                </h3>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Content list drawer */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {cart.length === 0 ? (
                <div className="py-24 text-center max-w-xs mx-auto space-y-3">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-xs text-slate-700">{language === "pt" ? "Seu carrinho está vazio" : "Your cart is currently empty"}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {language === "pt" ? "Adicione delícias do catálogo para realizar um pedido." : "Explore catalog dishes to populate shopping cart items."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Item List */}
                  {checkoutStep === 1 && (
                    <div className="space-y-3 animate-fade-in">
                      {cart.map((item) => (
                        <div key={item.recipeId} className="flex gap-3 items-center bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                          <img 
                            src={item.photoUrl} 
                            alt={item.recipeName} 
                            className="w-12 h-12 object-cover rounded-lg bg-slate-100 shrink-0 border border-slate-100"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-xs text-slate-900 truncate">{item.recipeName}</h4>
                            <p className="text-[11px] text-indigo-600 font-mono font-bold mt-0.5">{formatCurrency(item.price)}</p>
                          </div>
                          <div className="flex items-center gap-1.5 border border-slate-200/60 bg-white rounded-lg p-0.5 shrink-0">
                            <button
                              onClick={() => handleUpdateQuantity(item.recipeId, -1)}
                              className="p-1 hover:bg-slate-50 text-slate-500 rounded cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono text-xs font-bold text-slate-800 w-5 text-center">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateQuantity(item.recipeId, 1)}
                              className="p-1 hover:bg-slate-50 text-slate-500 rounded cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Customer Checkout Registration Form */}
                  <div className="border-t border-slate-100 pt-4 space-y-3.5 text-xs text-slate-700">
                    {!currentUser ? (
                      // Auth sub-form (Login / Register) inside cart drawer
                      <div className="space-y-4">
                        <div className="bg-indigo-50/40 border border-indigo-150 p-3.5 rounded-2xl space-y-1">
                          <h5 className="font-extrabold text-[11px] text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                            <User className="w-4 h-4 text-indigo-500" />
                            {checkoutMode === "login" 
                              ? (language === "pt" ? "Identifique-se para continuar" : "Sign in to continue") 
                              : (language === "pt" ? "Criar Conta" : "Create Account")}
                          </h5>
                          <p className="text-[10px] text-indigo-600 font-medium">
                            {checkoutMode === "login" 
                              ? (language === "pt" ? "Insira seu telefone e senha para agilizar seu pedido." : "Enter your phone and password to complete your order.") 
                              : (language === "pt" ? "Preencha seus dados. Na primeira compra, defina sua senha abaixo." : "Fill your info. On your first purchase, set your password below.")}
                          </p>
                        </div>

                        {checkoutError && (
                          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-rose-700 text-[10px] font-bold flex items-center gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span>{checkoutError}</span>
                          </div>
                        )}

                        <form onSubmit={handleCheckoutAuthSubmit} className="space-y-3">
                          {checkoutMode === "register" && (
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                {language === "pt" ? "Nome Completo" : "Full Name"}
                              </label>
                              <input
                                type="text"
                                required
                                placeholder={language === "pt" ? "Ex: Maria Silva" : "e.g. Mary Jane"}
                                value={checkoutName}
                                onChange={(e) => setCheckoutName(e.target.value)}
                                className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl block w-full p-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-hidden transition-all"
                              />
                            </div>
                          )}

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              {language === "pt" ? "Telefone" : "Phone"}
                            </label>
                            <input
                              type="tel"
                              required
                              placeholder={language === "pt" ? "Ex: (11) 99999-9999" : "e.g. (11) 9-9999-9999"}
                              value={checkoutPhone}
                              onChange={(e) => setCheckoutPhone(formatBrazilianPhone(e.target.value))}
                              className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl block w-full p-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-hidden transition-all"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              {language === "pt" ? "Senha" : "Password"}
                            </label>
                            <input
                              type="password"
                              required
                              placeholder="••••••••"
                              value={checkoutPassword}
                              onChange={(e) => setCheckoutPassword(e.target.value)}
                              className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl block w-full p-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-hidden transition-all"
                            />
                          </div>

                          <button
                            type="submit"
                            className="w-full bg-slate-900 hover:bg-indigo-600 text-white font-extrabold text-xs py-3 rounded-xl tracking-wider uppercase shadow-md shadow-slate-950/10 hover:shadow-lg transition-all cursor-pointer mt-1"
                          >
                            {checkoutMode === "login" 
                              ? (language === "pt" ? "Entrar" : "Sign In") 
                              : (language === "pt" ? "Criar Conta e Continuar" : "Create Account & Continue")
                            }
                          </button>

                          <div className="pt-2 text-center">
                            {checkoutMode === "login" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setCheckoutMode("register");
                                  setCheckoutError("");
                                }}
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-extrabold cursor-pointer underline"
                              >
                                {language === "pt" ? "Não tem conta? Criar Conta" : "Don't have an account? Create Account"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setCheckoutMode("login");
                                  setCheckoutError("");
                                }}
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-extrabold cursor-pointer underline"
                              >
                                {language === "pt" ? "Já tem uma conta? Entrar" : "Already have an account? Log In"}
                              </button>
                            )}
                          </div>
                        </form>
                      </div>
                    ) : (
                      // Logged-in Customer Checkout Address & Payment Form
                      <>
                        {checkoutStep === 1 ? (
                          <div className="space-y-4 animate-fade-in">
                            {/* Observações (Notes/Remarks) Field */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block" htmlFor="observations-input">
                                {language === "pt" ? "Observações do Pedido" : "Order Observations"}
                              </label>
                              <textarea
                                id="observations-input"
                                rows={2}
                                placeholder={language === "pt" ? "Ex: Sem cebola, campainha estragada, talheres descartáveis..." : "e.g., No onions, call upon arrival, leave at desk..."}
                                value={observations}
                                onChange={(e) => setObservations(e.target.value)}
                                className="bg-slate-50/50 border border-slate-200 text-slate-900 text-xs rounded-xl block w-full p-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-hidden transition-all resize-none"
                              />
                            </div>

                            {/* Delivery Type Switch: Retirada / Delivery */}
                            <div className="space-y-1.5 pt-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                {language === "pt" ? "Método de Entrega" : "Delivery Method"}
                              </label>
                              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                                <button
                                  type="button"
                                  onClick={() => setDeliveryType("delivery")}
                                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                    deliveryType === "delivery"
                                      ? "bg-white text-slate-900 shadow-xs"
                                      : "text-slate-500 hover:text-slate-800"
                                  }`}
                                >
                                  {language === "pt" ? "Delivery" : "Delivery"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeliveryType("retirada")}
                                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                    deliveryType === "retirada"
                                      ? "bg-white text-slate-900 shadow-xs"
                                      : "text-slate-500 hover:text-slate-800"
                                  }`}
                                >
                                  {language === "pt" ? "Retirada" : "Pickup"}
                                </button>
                              </div>
                            </div>

                            {deliveryType === "retirada" ? (
                              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3 mt-2 animate-fade-in text-left">
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    {language === "pt" ? "Cidade da Loja" : "Store Location City"}
                                  </span>
                                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                                    {storeCity || "São Paulo - SP"}
                                  </span>
                                </div>

                                <div className="space-y-1 border-t border-slate-100 pt-2.5">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    {language === "pt" ? "Endereço para Retirada" : "Pickup Address"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const fullQuery = encodeURIComponent(`${storeAddress || ""}, ${storeCity || ""}`);
                                      window.open(`https://www.google.com/maps/search/?api=1&query=${fullQuery}`, "_blank");
                                    }}
                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 text-left transition-colors cursor-pointer group w-full"
                                  >
                                    <MapPin className="w-4 h-4 text-indigo-500 shrink-0 group-hover:scale-110 transition-transform" />
                                    <span>{storeAddress || (language === "pt" ? "Endereço não cadastrado" : "Address not configured")}</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4 animate-fade-in">
                                {/* Street Address with Autocomplete within activeStore's City */}
                                <div className="space-y-1 relative">
                                  <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                      {language === "pt" ? "Rua" : "Street"}
                                    </label>
                                    {cityName && (
                                      <span className="text-[10px] text-indigo-600 font-semibold italic">
                                        {language === "pt" ? `Cidade: ${cityName}` : `City: ${cityName}`}
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="relative z-50">
                                    <input
                                      type="text"
                                      placeholder={language === "pt" ? "Digite o nome da rua..." : "Type street name..."}
                                      value={streetQuery}
                                      onChange={(e) => {
                                        setStreetQuery(e.target.value);
                                        setShowStreetSuggestions(true);
                                      }}
                                      onFocus={() => setShowStreetSuggestions(true)}
                                      className={`bg-slate-50/50 border text-slate-900 text-xs rounded-xl block w-full p-2.5 pr-8 focus:outline-hidden transition-all ${
                                        formErrors.streetQuery ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20" : "border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                                      }`}
                                    />
                                    {isStreetLoading && (
                                      <div className="absolute right-3 top-3 w-4.5 h-4.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                    )}
                                  </div>

                                  {/* Suggestions list dropdown */}
                                  {showStreetSuggestions && streetSuggestions.length > 0 && (
                                    <>
                                      <div 
                                        className="fixed inset-0 z-40 cursor-default" 
                                        onClick={() => setShowStreetSuggestions(false)} 
                                      />
                                      <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100">
                                        {streetSuggestions.map((item, idx) => {
                                          const desc = `${item.logradouro}${item.bairro ? `, Bairro: ${item.bairro}` : ""}`;
                                          return (
                                            <button
                                              key={idx}
                                              type="button"
                                              onClick={() => {
                                                setStreetQuery(item.logradouro || "");
                                                setShowStreetSuggestions(false);
                                                
                                                // Look for a matching registered delivery neighborhood
                                                if (item.bairro) {
                                                  const cleanedBairro = item.bairro.trim().toLowerCase();
                                                  const matchingKey = Object.keys(deliveryFees).find(
                                                    (k) => k.trim().toLowerCase() === cleanedBairro
                                                  );
                                                  if (matchingKey) {
                                                    setSelectedNeighborhood(matchingKey);
                                                  } else {
                                                    setSelectedNeighborhood(item.bairro);
                                                  }
                                                } else {
                                                  setSelectedNeighborhood("");
                                                }
                                              }}
                                              className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-xs text-slate-700 font-medium transition-colors cursor-pointer"
                                            >
                                              {desc}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </>
                                  )}

                                  {/* Suggestions empty feedback if no results but user typed 3+ characters */}
                                  {showStreetSuggestions && streetQuery.trim().length >= 3 && streetSuggestions.length === 0 && !isStreetLoading && (
                                    <>
                                      <div 
                                        className="fixed inset-0 z-40 cursor-default" 
                                        onClick={() => setShowStreetSuggestions(false)} 
                                      />
                                      <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-slate-100 rounded-xl p-3 shadow-md text-[11px] text-slate-400 italic">
                                        {language === "pt" 
                                          ? "Nenhuma rua encontrada com esse nome nesta cidade." 
                                          : "No matching streets found in this city."}
                                      </div>
                                    </>
                                  )}

                                  {formErrors.streetQuery && <p className="text-[10px] text-rose-500 font-semibold">{formErrors.streetQuery}</p>}
                                </div>

                                {/* Número da Casa / Apto */}
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block" htmlFor="house-number-input">
                                    {language === "pt" ? "Número da Casa" : "House Number"}
                                  </label>
                                  <input
                                    id="house-number-input"
                                    type="text"
                                    placeholder={language === "pt" ? "Ex: 123" : "e.g. 123"}
                                    value={houseNumber}
                                    onChange={(e) => setHouseNumber(e.target.value)}
                                    className={`bg-slate-50/50 border text-slate-900 text-xs rounded-xl block w-full p-2.5 focus:outline-hidden transition-all ${
                                      formErrors.houseNumber ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20" : "border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                                    }}`}
                                  />
                                  {formErrors.houseNumber && <p className="text-[10px] text-rose-500 font-semibold">{formErrors.houseNumber}</p>}
                                </div>

                                {/* Complemento (Apartment, unit, block number) */}
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block" htmlFor="complement-input">
                                    {language === "pt" ? "Complemento" : "Complement"}
                                  </label>
                                  <input
                                    id="complement-input"
                                    type="text"
                                    placeholder={language === "pt" ? "Ex: Apto 42, Bloco B" : "e.g. Apt 42, Block B"}
                                    value={complement}
                                    onChange={(e) => setComplement(e.target.value)}
                                    className="bg-slate-50/50 border border-slate-200 text-slate-900 text-xs rounded-xl block w-full p-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-hidden transition-all"
                                  />
                                </div>

                                {/* Auto-detected Delivery Neighborhood */}
                                {selectedNeighborhood && (
                                  <div className="space-y-1.5 animate-fade-in">
                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                                      <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                          {language === "pt" ? "Bairro Auto-detectado" : "Auto-detected Neighborhood"}
                                        </span>
                                        <span className="text-xs font-bold text-slate-800">{selectedNeighborhood}</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                          {language === "pt" ? "Taxa de Entrega" : "Delivery Fee"}
                                        </span>
                                        <span className="text-xs font-bold font-mono text-indigo-600">
                                          {deliveryFee === 0 && !Object.keys(deliveryFees).some(k => k.trim().toLowerCase() === selectedNeighborhood.trim().toLowerCase()) ? (
                                            <span className="text-rose-500 font-semibold text-[10px] uppercase">
                                              {language === "pt" ? "Não Cadastrado" : "Not Registered"}
                                            </span>
                                          ) : deliveryFee === 0 ? (
                                            (language === "pt" ? "Grátis" : "Free")
                                          ) : (
                                            formatCurrency(deliveryFee)
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                    {!Object.keys(deliveryFees).some(k => k.trim().toLowerCase() === selectedNeighborhood.trim().toLowerCase()) && (
                                      <p className="text-[10px] text-rose-500 font-semibold bg-rose-50 border border-rose-100 p-2.5 rounded-lg leading-normal">
                                        {language === "pt" 
                                          ? "Aviso: Este bairro não está cadastrado nas taxas de entrega do administrador." 
                                          : "Warning: This neighborhood is not registered in the store's delivery fees list."}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-4 animate-fade-in">
                            {/* Payment selection */}
                            <div className="space-y-2 border-t border-slate-50 pt-3">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                {language === "pt" ? "Forma de Pagamento" : "Payment Method"}
                              </label>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { key: "pix", label: "PIX", icon: Sparkles },
                                  { key: "cartão", label: language === "pt" ? "Cartão" : "Card", icon: CreditCard },
                                  { key: "dinheiro", label: language === "pt" ? "Dinheiro" : "Cash", icon: Coins },
                                ].map((m) => {
                                  const IconComp = m.icon;
                                  const isSel = paymentMethod === m.key;
                                  return (
                                    <button
                                      key={m.key}
                                      type="button"
                                      onClick={() => setPaymentMethod(m.key as any)}
                                      className={`py-2 px-1 rounded-lg border text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                                        isSel 
                                          ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs" 
                                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                      }`}
                                    >
                                      <IconComp className={`w-4 h-4 ${isSel ? "text-indigo-600" : "text-slate-400"}`} />
                                      <span>{m.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Troco option if Cash */}
                            {paymentMethod === "dinheiro" && (
                              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 animate-fade-in">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={needsChange}
                                    onChange={(e) => setNeedsChange(e.target.checked)}
                                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                                  />
                                  <span className="text-[11px] font-bold text-slate-700">{language === "pt" ? "Precisa de troco?" : "Need change back?"}</span>
                                </label>
                                {needsChange && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] text-slate-400">{language === "pt" ? "Troco para quanto?" : "Change for how much?"}</span>
                                    <input
                                      type="number"
                                      placeholder="Ex: R$ 50,00"
                                      value={changeFor}
                                      onChange={(e) => setChangeFor(e.target.value)}
                                      className={`bg-white border text-xs rounded-lg block w-full p-2 focus:outline-hidden ${
                                        formErrors.changeFor ? "border-rose-400" : "border-slate-200"
                                      }`}
                                    />
                                    {formErrors.changeFor && <p className="text-[10px] text-rose-500 font-semibold">{formErrors.changeFor}</p>}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Total checkout drawer footer */}
            {cart.length > 0 && currentUser && (
              <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-3">
                {checkoutStep === 2 && (
                  <div className="space-y-3 animate-fade-in">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-semibold">{language === "pt" ? "Subtotal:" : "Subtotal:"}</span>
                      <span className="font-mono text-slate-700 font-bold">{formatCurrency(cartSubtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-semibold">{language === "pt" ? "Taxa de Entrega:" : "Delivery Tax:"}</span>
                      <span className="font-mono text-slate-700 font-bold">
                        {selectedNeighborhood ? (
                          deliveryFee === 0 ? (language === "pt" ? "Grátis" : "Free") : formatCurrency(deliveryFee)
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">{language === "pt" ? "Aguardando endereço" : "Awaiting address"}</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-200/60 pt-2.5">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">{language === "pt" ? "Total do Pedido:" : "Order Total:"}</span>
                      <span className="font-mono text-base font-extrabold text-indigo-600">{formatCurrency(cartTotal)}</span>
                    </div>
                  </div>
                )}

                {checkoutStep === 1 ? (
                  <button
                    onClick={() => handleNextStep()}
                    className="w-full font-extrabold text-xs py-3.5 rounded-xl tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 mt-2 bg-slate-900 hover:bg-indigo-600 text-white cursor-pointer shadow-md shadow-slate-950/15"
                  >
                    <span>{language === "pt" ? "Definir Pagamento" : "Define Payment"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="flex gap-2.5 mt-2 animate-fade-in">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep(1)}
                      className="px-4 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer transition-all border border-slate-200 shrink-0"
                    >
                      {language === "pt" ? "Voltar" : "Back"}
                    </button>
                    <button
                      onClick={() => isWebsiteEnabled && handlePlaceOrder()}
                      disabled={!isWebsiteEnabled}
                      className={`flex-1 font-extrabold text-xs py-3.5 rounded-xl tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 ${
                        isWebsiteEnabled 
                          ? "bg-slate-900 hover:bg-indigo-600 text-white cursor-pointer shadow-md shadow-slate-950/15" 
                          : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                      }`}
                    >
                      <span>{isWebsiteEnabled ? (language === "pt" ? "Realizar Pedido" : "Confirm and Place Order") : (language === "pt" ? "Pedidos Desativados" : "Orders Disabled")}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Session Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div 
            className="fixed inset-0 cursor-default" 
            onClick={() => setIsUserModalOpen(false)} 
          />
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative z-50 border border-slate-100 animate-scale-up space-y-4 text-left">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900 tracking-tight">
                  {currentUser 
                    ? (language === "pt" ? "Sua Conta" : "Your Account") 
                    : modalMode === "login" 
                      ? (language === "pt" ? "Acesse sua Conta" : "Access your Account")
                      : (language === "pt" ? "Criar Nova Conta" : "Create New Account")
                  }
                </h3>
              </div>
              <button 
                onClick={() => setIsUserModalOpen(false)}
                className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {currentUser ? (
              // Logged in UI
              <div className="space-y-4">
                <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 space-y-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {language === "pt" ? "Nome do Cliente" : "Customer Name"}
                    </span>
                    <span className="text-xs font-extrabold text-slate-800">{currentUser.name}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {language === "pt" ? "Telefone / WhatsApp" : "Phone / WhatsApp"}
                    </span>
                    <span className="text-xs font-bold font-mono text-slate-700">{currentUser.phone}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    logoutUser();
                    setIsUserModalOpen(false);
                  }}
                  className="w-full text-center font-extrabold text-xs py-3 px-4 rounded-xl text-rose-600 border border-rose-200 hover:bg-rose-50/50 cursor-pointer transition-all"
                >
                  {language === "pt" ? "Sair da Conta (Logout)" : "Log Out"}
                </button>
              </div>
            ) : (
              // Auth forms (Login / Register)
              <form onSubmit={handleModalAuthSubmit} className="space-y-3.5">
                {modalError && (
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-rose-700 text-[11px] font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                {modalMode === "register" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {language === "pt" ? "Nome Completo" : "Full Name"}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={language === "pt" ? "Ex: Maria Silva" : "e.g. Mary Jane"}
                      value={modalName}
                      onChange={(e) => setModalName(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-950 text-xs rounded-xl block w-full p-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-hidden transition-all"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {language === "pt" ? "Telefone" : "Phone"}
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder={language === "pt" ? "Ex: (11) 99999-9999" : "e.g. (11) 9-9999-9999"}
                    value={modalPhone}
                    onChange={(e) => setModalPhone(formatBrazilianPhone(e.target.value))}
                    className="bg-slate-50 border border-slate-200 text-slate-950 text-xs rounded-xl block w-full p-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-hidden transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {language === "pt" ? "Senha" : "Password"}
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={modalPassword}
                    onChange={(e) => setModalPassword(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-950 text-xs rounded-xl block w-full p-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-hidden transition-all"
                  />
                  {modalMode === "register" && (
                    <span className="text-[9px] text-slate-400 leading-none">
                      {language === "pt" ? "* Defina uma senha para sua primeira compra" : "* Create a password for your account"}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-indigo-600 text-white font-extrabold text-xs py-3 rounded-xl tracking-wider uppercase shadow-md shadow-slate-950/10 hover:shadow-lg transition-all cursor-pointer mt-1"
                >
                  {modalMode === "login" 
                    ? (language === "pt" ? "Entrar" : "Sign In") 
                    : (language === "pt" ? "Criar Conta e Entrar" : "Create Account & Sign In")
                  }
                </button>

                <div className="pt-2 text-center">
                  {modalMode === "login" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setModalMode("register");
                        setModalError("");
                      }}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold tracking-tight cursor-pointer underline"
                    >
                      {language === "pt" ? "Não tem uma conta? Crie uma" : "Don't have an account? Sign up"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setModalMode("login");
                        setModalError("");
                      }}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold tracking-tight cursor-pointer underline"
                    >
                      {language === "pt" ? "Já tem uma conta? Acesse aqui" : "Already have an account? Log in"}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white text-xs font-bold px-4 py-3 rounded-full shadow-xl flex items-center gap-2 border border-slate-800 pointer-events-none"
          >
            <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
