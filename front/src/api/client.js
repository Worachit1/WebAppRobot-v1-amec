// ใช้ host เดียวกับหน้าที่เปิดอยู่ — เปิดจาก 192.168.1.10 จะยิง API ไป 192.168.1.10:4000 (ไม่ติด localhost)
const getApiBase = () => {
  if (typeof window === "undefined")
    return import.meta.env.VITE_API_BASE_URL;
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (
    envUrl &&
    envUrl.includes("localhost") &&
    window.location.hostname !== "localhost"
  ) {
    return `${window.location.protocol}//${window.location.hostname}:4000/api`;
  }
  if (envUrl) return envUrl;
  return `${window.location.protocol}//${window.location.hostname}:4000/api`;
};
const API_BASE = getApiBase();

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error || "Request failed";
    throw new Error(message);
  }
  return data;
}

export function login(username, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

// zone pick
export function fetchZonePick(params = {}) {
  return apiRequest("/zones/get/groups");
}
// zone drop
export function fetchZoneDrop(params = {}) {
  return apiRequest("/zones/get/drops");
}
// get robots
export function fetchRobots(params = {}) {
  return apiRequest("/robots/get");
}
// get cart
export function fetchCarts(params = {}) {
  return apiRequest("/robots/get/carts");
}

export function createOrder(payload) {
  return apiRequest("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


export function createHomeOrder(payload) {
  return apiRequest("/orders/home", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

//  claerCart()
export function updateSpotStatusCart(spotId, statusCart) {
  return apiRequest(`/orders/${spotId}/status-cart`, {
    method: "PATCH",
    body: JSON.stringify({
      statusCart,
    }),
  });
}

// claer order
export function clearTask(orderId) {
  return apiRequest(`/order/${orderId}/clear-task`, {
    method: "POST",
  });
}

// cancel order
export function cancelOrder(orderId) {
  return apiRequest(`/orders/${orderId}/cancel`, {
    method: "POST",
  });
}

export function cancelRunningOrder(orderId, releaseOnly = false) {
  return apiRequest(`/orders/${orderId}/cancel-running`, {
    method: "POST",
    body: JSON.stringify({
      releaseOnly,
    }),
  });
}

export function fetchHistory(params = {}) {
  const search = new URLSearchParams(params);
  const suffix = search.toString() ? `?${search}` : "";
  return apiRequest(`/orders/history${suffix}`);
}

// ----------- ของเก่าเอาค้างไว้ก่อน ------------------
export function fetchConfig() {
  return apiRequest("/config");
}

export function updateConfig(config) {
  return apiRequest("/config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export function fetchRobotStatus(robotId) {
  return apiRequest(`/status/${robotId}`);
}


/** Origin ของ backend (ไม่มี /api) — สำหรับ POST /door/... และ GET /door/... */
function backendOrigin() {
  let b = API_BASE.replace(/\/$/, "");
  if (b.endsWith("/api")) return b.slice(0, -4);
  return b;
}
