(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./core.js"));
    return;
  }
  const Shop = (root.Shop = root.Shop || {});
  const { createStore } = factory(Shop.core);
  Shop.store = createStore({
    config: Shop.config,
    storage: openStorage(root),
    getApi: () => Shop.api ?? null,
    eventTarget: root,
    setTimer: root.setTimeout.bind(root),
    clearTimer: root.clearTimeout.bind(root)
  });

  function openStorage(scope) {
    try {
      return scope.localStorage;
    } catch {
      return null;
    }
  }
})(typeof self !== "undefined" ? self : this, function (core) {
  "use strict";

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.values(value).forEach(deepFreeze);
    }
    return value;
  }

  function toErrorInfo(failure) {
    return {
      status: Number.isInteger(failure?.status) ? failure.status : 0,
      code: failure?.code ?? "unknown_error",
      message: failure?.message || "Не удалось оформить заказ"
    };
  }

  function createStore({ config, storage, getApi = () => null, eventTarget = null, setTimer = setTimeout, clearTimer = clearTimeout }) {
    const keys = config.storageKeys;
    const listeners = new Set();
    let products = [];
    let productsById = new Map();
    let mode = "static";
    let status = "ready";
    let error = null;
    let filters = { ...core.DEFAULT_FILTERS };
    let lines = [];
    let favorites = [];
    let promoCode = null;
    let lastOrder = null;
    let checkoutPending = false;
    let searchProvider = null;
    let remoteResults = null;
    let searchTimer = null;
    let searchToken = 0;
    let listening = false;
    let snapshot = buildState();

    function read(key) {
      try {
        const raw = storage?.getItem(key);
        return raw == null ? null : JSON.parse(raw);
      } catch {
        return null;
      }
    }

    function write(key, value) {
      try {
        if (value == null) {
          storage?.removeItem(key);
        } else {
          storage?.setItem(key, JSON.stringify(value));
        }
      } catch {
        return false;
      }
      return true;
    }

    function persist() {
      write(keys.cart, lines);
      write(keys.favorites, favorites);
      write(keys.promo, promoCode);
    }

    function restore() {
      lines = core.sanitizeLines(read(keys.cart), productsById, config.maxQuantity);
      favorites = core.sanitizeFavorites(read(keys.favorites), productsById);
      promoCode = core.resolvePromo(read(keys.promo), config.promoCodes)?.code ?? null;
    }

    function setCatalog(list) {
      products = Array.isArray(list) ? list.slice() : [];
      productsById = core.indexById(products);
    }

    function buildState() {
      const promo = promoCode ? core.resolvePromo(promoCode, config.promoCodes) : null;
      const matched = remoteResults ?? core.sortProducts(core.filterProducts(products, filters), filters.sort);
      return deepFreeze({
        mode,
        status,
        error,
        products,
        visibleProducts: core.applyView(matched, filters.view, favorites),
        categories: core.listCategories(products),
        filters: { ...filters },
        favorites: [...favorites],
        cart: core.summarizeCart(lines, productsById, promo, config.maxQuantity),
        lastOrder,
        checkoutPending
      });
    }

    function commit({ save = true } = {}) {
      if (save) {
        persist();
      }
      snapshot = buildState();
      listeners.forEach((listener) => listener(snapshot));
    }

    function maxFor(id) {
      const product = productsById.get(id);
      return product ? core.maxQuantityFor(product, config.maxQuantity) : 0;
    }

    function findLine(id) {
      return lines.find((line) => line.id === id);
    }

    function onStorage(event) {
      if (event.key !== null && !Object.values(keys).includes(event.key)) {
        return;
      }
      restore();
      commit({ save: false });
    }

    function init({ products: list, mode: nextMode = "static" } = {}) {
      setCatalog(list);
      mode = nextMode === "api" ? "api" : "static";
      restore();
      if (!listening && eventTarget?.addEventListener) {
        eventTarget.addEventListener("storage", onStorage);
        listening = true;
      }
      commit();
      return snapshot;
    }

    function setProducts(list) {
      setCatalog(list);
      lines = core.sanitizeLines(lines, productsById, config.maxQuantity);
      favorites = core.sanitizeFavorites(favorites, productsById);
      commit();
    }

    async function runSearch(token) {
      const { query, category, sort } = filters;
      try {
        const results = await searchProvider({ query, category, sort });
        if (token !== searchToken) {
          return;
        }
        remoteResults = Array.isArray(results) ? results : [];
        status = "ready";
        error = null;
      } catch {
        if (token !== searchToken) {
          return;
        }
        remoteResults = null;
        status = "error";
        error = "Сервер не ответил, показаны результаты из офлайн-каталога";
      }
      commit({ save: false });
    }

    function scheduleSearch(delay) {
      clearTimer(searchTimer);
      status = "loading";
      const token = ++searchToken;
      searchTimer = setTimer(() => runSearch(token), delay);
    }

    function setSearchProvider(provider) {
      searchProvider = typeof provider === "function" ? provider : null;
      remoteResults = null;
      commit({ save: false });
    }

    function setFilters(patch) {
      const next = core.normalizeFilters(filters, patch);
      const searchChanged = next.query !== filters.query || next.category !== filters.category || next.sort !== filters.sort;
      filters = next;
      if (searchChanged && searchProvider) {
        scheduleSearch(config.searchDebounceMs);
      }
      commit({ save: false });
    }

    async function refreshCatalog(api) {
      try {
        setProducts(await api.getProducts());
        if (searchProvider) {
          scheduleSearch(0);
        }
      } catch {
        commit({ save: false });
      }
    }

    async function checkout() {
      const api = getApi();
      if (mode !== "api" || !api) {
        return { ok: false, error: { status: 0, code: "offline", message: "Оформление заказа доступно при запуске с сервером" } };
      }
      if (checkoutPending) {
        return { ok: false, error: { status: 0, code: "pending", message: "Заказ уже оформляется" } };
      }
      if (lines.length === 0) {
        return { ok: false, error: { status: 0, code: "empty_items", message: "Корзина пуста" } };
      }
      checkoutPending = true;
      commit({ save: false });
      const items = lines.map((line) => ({ productId: line.id, quantity: line.qty }));
      try {
        const order = await api.createOrder(promoCode ? { items, promoCode } : { items });
        lines = [];
        promoCode = null;
        lastOrder = order;
        checkoutPending = false;
        commit();
        await refreshCatalog(api);
        return { ok: true, order };
      } catch (failure) {
        checkoutPending = false;
        const info = toErrorInfo(failure);
        if (info.status === 409) {
          await refreshCatalog(api);
        } else {
          commit({ save: false });
        }
        return { ok: false, error: info };
      }
    }

    const actions = Object.freeze({
      add(id) {
        if (!productsById.has(id)) {
          return;
        }
        lines = core.addLine(lines, id, maxFor(id));
        commit();
      },
      remove(id) {
        lines = core.removeLine(lines, id);
        commit();
      },
      increment(id) {
        const line = findLine(id);
        if (line) {
          lines = core.setLineQty(lines, id, line.qty + 1, maxFor(id));
          commit();
        }
      },
      decrement(id) {
        const line = findLine(id);
        if (line && line.qty > 1) {
          lines = core.setLineQty(lines, id, line.qty - 1, maxFor(id));
          commit();
        }
      },
      setQty(id, qty) {
        lines = core.setLineQty(lines, id, qty, maxFor(id));
        commit();
      },
      clearCart() {
        lines = [];
        commit();
      },
      toggleFavorite(id) {
        if (!productsById.has(id)) {
          return;
        }
        favorites = favorites.includes(id) ? favorites.filter((favorite) => favorite !== id) : [...favorites, id];
        commit();
      },
      applyPromo(code) {
        if (!String(code ?? "").trim()) {
          return { ok: false, reason: "empty" };
        }
        const promo = core.resolvePromo(code, config.promoCodes);
        if (!promo) {
          return { ok: false, reason: "unknown" };
        }
        if (promoCode === promo.code) {
          return { ok: false, reason: "already_applied" };
        }
        promoCode = promo.code;
        commit();
        return { ok: true, code: promo.code, percent: promo.percent };
      },
      removePromo() {
        if (promoCode) {
          promoCode = null;
          commit();
        }
      },
      setFilters,
      resetFilters() {
        setFilters({ query: "", category: "", sort: "default" });
      },
      checkout
    });

    return Object.freeze({
      init,
      getState: () => snapshot,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      setSearchProvider,
      setProducts,
      actions
    });
  }

  return { createStore };
});
