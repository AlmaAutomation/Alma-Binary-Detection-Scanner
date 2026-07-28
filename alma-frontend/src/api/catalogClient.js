/**
 * Read-only Compatibility Catalog API (/bridge/catalog/*).
 */
import bridge from "./bridgeClient";

export async function fetchCatalogApplications() {
  const res = await bridge.get("/bridge/catalog/applications");
  return res.data;
}
