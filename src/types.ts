export type OrderStatus = "pending" | "preparing" | "delivering" | "completed" | "cancelled";

export interface Order {
  id: string;
  channel: string;
  customerName: string;
  time: string;
  date?: string;
  items: string;
  total: number;
  status: OrderStatus;
  /** AMO Open Delivery API order id */
  amoOrderId?: string;
  /** Full raw order payload returned by AMO GET /v1/open-delivery/orders/{id} */
  amoData?: Record<string, unknown>;
  type?: "delivery" | "pickup" | "dine_in";
  orderTiming?: string;
  scheduledDateTimeStart?: string;
  phone?: string;
  address?: string;
  paymentMethod?: string;
  observations?: string;
}

export interface ReceiptItem {
  id: string; // Unique client-side ID
  name: string;
  quantity: number;
  price: number; // Unit price
  category: string;
  purchaseDate: string;
  storeName: string;
  invoiceNumber?: string;
  isDuplicate?: boolean;
  message?: string;
  customBarcode?: string;
  customWeightOrVolValue?: number;
  customWeightOrVolUnit?: 'g' | 'kg' | 'ml' | 'l' | 'unit';
  originalName?: string;
}

export interface ScannedReceiptResult {
  storeName: string;
  purchaseDate: string;
  totalAmount: number;
  invoiceNumber?: string;
  isDuplicate?: boolean;
  quotaLimitActive?: boolean;
  message?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    category: string;
  }>;
}

export const GROCERY_CATEGORIES = [
  "Produto",
  "Produce",
  "Bakery",
  "Dairy",
  "Ingredients",
  "Fruits",
  "Snacks",
  "Personal Care",
  "Other"
];

export interface OcrErrorLog {
  id: string;
  fileName: string;
  uploadDate: string;
  error: string;
}

