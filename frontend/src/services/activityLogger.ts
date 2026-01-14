const API_BASE = "http://localhost:8000/api";

export type ActivityType =
  | "forecast_created"
  | "forecast_viewed"
  | "purchase_order_created"
  | "purchase_order_updated"
  | "inventory_optimized"
  | "inventory_updated"
  | "product_added"
  | "product_updated"
  | "product_deleted"
  | "sale_recorded"
  | "settings_updated"
  | "data_imported"
  | "data_exported";

interface ActivityDetails {
  [key: string]: any;
}

export async function logActivity(
  storeId: string,
  actionType: ActivityType,
  description: string,
  details?: ActivityDetails
): Promise<void> {
  try {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId") || "anonymous";

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    await fetch(`${API_BASE}/activity-logs/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        store_id: storeId,
        user_id: userId,
        action_type: actionType,
        description,
        details: details || {},
        metadata: {
          browser: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
      }),
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

export async function getActivityLogs(
  storeId: string,
  limit: number = 50,
  actionType?: string
): Promise<any[]> {
  try {
    const token = localStorage.getItem("token");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let url = `${API_BASE}/activity-logs/?store_id=${storeId}&limit=${limit}`;
    if (actionType) {
      url += `&action_type=${actionType}`;
    }

    const response = await fetch(url, { headers });
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch activity logs:", error);
    return [];
  }
}