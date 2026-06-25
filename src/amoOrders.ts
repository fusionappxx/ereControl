import type { Order, OrderStatus } from "./types";
import { safeStorage } from "./utils";

export interface AmoChannelConfig {
  apiBaseUrl: string;
  clientId: string;
  clientSecret: string;
}

export function getAmoChannelConfig(): AmoChannelConfig | null {
  try {
    const saved = safeStorage.getItem("orders_channel_configs");
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    const amo = parsed?.amo;
    if (!amo?.clientId || !amo?.clientSecret) return null;
    return {
      apiBaseUrl: amo.apiBaseUrl || "https://api.uat.amo.delivery",
      clientId: amo.clientId,
      clientSecret: amo.clientSecret
    };
  } catch {
    return null;
  }
}

export async function updateAmoOrderStatusViaApi(
  order: Order,
  nextStatus: OrderStatus
): Promise<{ success: boolean; order?: Order; message?: string }> {
  if (order.channel !== "amo") {
    return { success: false, message: "Not an AMO order." };
  }

  const config = getAmoChannelConfig();
  if (!config) {
    return {
      success: false,
      message: "AMO credentials are not configured. Open Integrations and save Client ID and Secret."
    };
  }

  const amoOrderId = order.amoOrderId || String((order.amoData as Record<string, unknown> | undefined)?.id || "");
  if (!amoOrderId) {
    return { success: false, message: "Missing AMO order id. Sync orders from the API first." };
  }

  const response = await fetch("/api/amo/update-order-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiBaseUrl: config.apiBaseUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      amoOrderId,
      nextStatus,
      amoData: order.amoData || {}
    })
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    return {
      success: false,
      message: data.message || `Request failed with status ${response.status}`
    };
  }

  return {
    success: true,
    order: data.order as Order,
    message: data.message
  };
}
