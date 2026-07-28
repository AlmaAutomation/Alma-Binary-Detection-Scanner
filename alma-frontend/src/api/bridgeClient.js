import axios from "axios";

const bridgeBase =
  process.env.REACT_APP_BRIDGE_API_BASE ||
  (typeof window !== "undefined"
    ? `${window.location.origin}/bridge-api`
    : "http://127.0.0.1:9010");

const bridgeApiKey = process.env.REACT_APP_BRIDGE_API_KEY || "";

const bridge = axios.create({
  baseURL: bridgeBase,
  timeout: 600000,
});

if (bridgeApiKey) {
  bridge.defaults.headers.common["X-API-Key"] = bridgeApiKey;
}

/** True when Bridge API is reachable (direct /health or scanner /bridge-api proxy). */
export function isBridgeOnline(health) {
  if (!health) return false;
  return health.status === "ok" || health.bridge?.status === "ok";
}

export default bridge;
