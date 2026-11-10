(function (root, factory) {
  "use strict";
  const core = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = core;
  } else {
    root.Shop = root.Shop || {};
    root.Shop.core = core;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SORTS = Object.freeze(["default", "price-asc", "price-desc"]);
  const VIEWS = Object.freeze(["all", "favorites"]);
  const DEFAULT_FILTERS = Object.freeze({ query: "", category: "", sort: "default", view: "all" });
  const priceFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

  function formatPrice(rubles) {
    return `${priceFormat.format(rubles)} ₽`;
  }

  function normalizeText(value) {
    return String(value ?? "").trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
  }

  function indexById(products) {
    return new Map(products.map((product) => [product.id, product]));
  }

  function listCategories(products) {
    return [...new Set(products.map((product) => product.category))];
  }

  function maxQuantityFor(product, limit) {
    const stock = Number.isInteger(product.stock) ? product.stock : limit;
    return Math.max(0, Math.min(limit, stock));
  }

  function filterProducts(products, { query = "", category = "" } = {}) {
    const needle = normalizeText(query);
    return products.filter(
      (product) =>
        (!needle || normalizeText(product.name).includes(needle)) &&
        (!category || product.category === category)
    );
  }

  function sortProducts(products, sort) {
    const direction = { "price-asc": 1, "price-desc": -1 }[sort] ?? 0;
    const sorted = products.slice();
    if (direction !== 0) {
      sorted.sort((left, right) => direction * (left.price - right.price));
    }
    return sorted;
  }

  function applyView(products, view, favorites) {
    if (view !== "favorites") {
      return products;
    }
    const chosen = new Set(favorites);
    return products.filter((product) => chosen.has(product.id));
  }

  function normalizeFilters(current, patch) {
    const next = { ...current, ...patch };
    return {
      query: String(next.query ?? ""),
      category: String(next.category ?? ""),
      sort: SORTS.includes(next.sort) ? next.sort : DEFAULT_FILTERS.sort,
      view: VIEWS.includes(next.view) ? next.view : DEFAULT_FILTERS.view
    };
  }

  function removeLine(lines, id) {
    return lines.filter((line) => line.id !== id);
  }

  function setLineQty(lines, id, qty, maxQty) {
    const wanted = Math.trunc(Number(qty));
    const next = Number.isFinite(wanted) ? Math.min(wanted, maxQty) : 0;
    if (next <= 0) {
      return removeLine(lines, id);
    }
    return lines.map((line) => (line.id === id ? { id, qty: next } : line));
  }

  function addLine(lines, id, maxQty) {
    const existing = lines.find((line) => line.id === id);
    if (existing) {
      return setLineQty(lines, id, existing.qty + 1, maxQty);
    }
    return maxQty > 0 ? [...lines, { id, qty: 1 }] : lines;
  }

  function sanitizeLines(raw, productsById, limit) {
    if (!Array.isArray(raw)) {
      return [];
    }
    const merged = new Map();
    for (const entry of raw) {
      const product = entry && productsById.get(entry.id);
      const qty = Number(entry?.qty);
      if (product && Number.isInteger(qty) && qty > 0) {
        merged.set(product.id, (merged.get(product.id) ?? 0) + qty);
      }
    }
    return [...merged]
      .map(([id, qty]) => ({ id, qty: Math.min(qty, maxQuantityFor(productsById.get(id), limit)) }))
      .filter((line) => line.qty > 0);
  }

  function sanitizeFavorites(raw, productsById) {
    if (!Array.isArray(raw)) {
      return [];
    }
    return [...new Set(raw.filter((id) => productsById.has(id)))];
  }

  function resolvePromo(code, promoCodes) {
    const normalized = String(code ?? "").trim().toUpperCase();
    const percent = Object.hasOwn(promoCodes, normalized) ? promoCodes[normalized] : 0;
    return percent > 0 ? { code: normalized, percent } : null;
  }

  function computeDiscount(subtotal, percent) {
    return Math.floor((subtotal * percent + 50) / 100);
  }

  function summarizeCart(lines, productsById, promo, limit) {
    const detailed = lines.flatMap((line) => {
      const product = productsById.get(line.id);
      if (!product) {
        return [];
      }
      return [
        {
          id: line.id,
          product,
          qty: line.qty,
          maxQty: maxQuantityFor(product, limit),
          lineTotal: product.price * line.qty
        }
      ];
    });
    const subtotal = detailed.reduce((sum, line) => sum + line.lineTotal, 0);
    const count = detailed.reduce((sum, line) => sum + line.qty, 0);
    const discount = promo ? computeDiscount(subtotal, promo.percent) : 0;
    return { lines: detailed, count, subtotal, discount, total: subtotal - discount, promo };
  }

  return Object.freeze({
    DEFAULT_FILTERS,
    formatPrice,
    normalizeText,
    indexById,
    listCategories,
    maxQuantityFor,
    filterProducts,
    sortProducts,
    applyView,
    normalizeFilters,
    addLine,
    removeLine,
    setLineQty,
    sanitizeLines,
    sanitizeFavorites,
    resolvePromo,
    computeDiscount,
    summarizeCart
  });
});
