"use strict";
(function (root) {
  const Shop = (root.Shop = root.Shop || {});
  const config = Shop.config;

  class ApiError extends Error {
    constructor({ status, code, message, details = null }) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }

  function endpoint(path, params = {}) {
    const url = new URL(`${config.apiBase}${path}`, root.location.href);
    Object.entries(params).forEach(([name, value]) => {
      if (value) {
        url.searchParams.set(name, value);
      }
    });
    return url;
  }

  async function request(path, { method = "GET", params, body, timeoutMs = 8000 } = {}) {
    const controller = new AbortController();
    const timer = root.setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await root.fetch(endpoint(path, params), {
        method,
        headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        cache: "no-store"
      });
    } catch {
      throw new ApiError({ status: 0, code: "network_error", message: "Сервер недоступен" });
    } finally {
      root.clearTimeout(timer);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const info = payload?.error ?? {};
      throw new ApiError({
        status: response.status,
        code: info.code ?? "http_error",
        message: info.message ?? `Ошибка сервера: ${response.status}`,
        details: info.details ?? null
      });
    }
    return payload;
  }

  function canReachServer() {
    const { protocol, hostname } = root.location;
    return (protocol === "http:" || protocol === "https:") && !hostname.endsWith("github.io");
  }

  async function detect() {
    if (!canReachServer()) {
      return false;
    }
    try {
      const health = await request("/health", { timeoutMs: config.apiTimeoutMs });
      return health?.status === "ok";
    } catch {
      return false;
    }
  }

  async function getProducts({ query = "", category = "", sort = "default" } = {}) {
    const products = await request("/products", {
      params: { q: query.trim(), category, sort: sort === "default" ? "" : sort }
    });
    return Array.isArray(products) ? products : [];
  }

  async function getCategories() {
    const categories = await request("/categories");
    return Array.isArray(categories) ? categories : [];
  }

  function createOrder(order) {
    return request("/orders", { method: "POST", body: order });
  }

  Shop.api = Object.freeze({ detect, getProducts, getCategories, createOrder, ApiError });
})(window);
