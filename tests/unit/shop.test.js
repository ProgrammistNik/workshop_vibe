"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../../site/js/core.js");
const { createStore } = require("../../site/js/store.js");

const config = Object.freeze({
  storageKeys: { cart: "t:cart", favorites: "t:favorites", promo: "t:promo", theme: "t:theme" },
  promoCodes: { ALCHEMY10: 10 },
  maxQuantity: 99,
  searchDebounceMs: 0
});

const products = [
  { id: "phoenix-feather", name: "Перо феникса", price: 100, category: "Ингредиенты", stock: 25 },
  { id: "morning-dew", name: "Флакон утренней росы", price: 200, category: "Ингредиенты", stock: 40 },
  { id: "troll-honey", name: "Мёд горного тролля", price: 280, category: "Ингредиенты", stock: 18 },
  { id: "healing-potion", name: "Зелье исцеления", price: 490, category: "Зелья", stock: 30 },
  { id: "invisibility-potion", name: "Зелье невидимости", price: 1290, category: "Зелья", stock: 2 },
  { id: "teleport-scroll", name: "Свиток телепортации", price: 2100, category: "Свитки", stock: 0 }
];

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    dump: () => Object.fromEntries(data)
  };
}

function makeStore({ storage = memoryStorage(), api = null, mode = "static" } = {}) {
  const store = createStore({ config, storage, getApi: () => api });
  store.init({ products, mode });
  return { store, storage };
}

const plain = (text) => text.replace(/\s+/g, " ");

test("пример из ТЗ: 100 + 200 = 300, затем 200, затем 0", () => {
  const { store } = makeStore();
  store.actions.add("phoenix-feather");
  store.actions.add("morning-dew");
  assert.equal(store.getState().cart.total, 300);
  store.actions.remove("phoenix-feather");
  assert.equal(store.getState().cart.total, 200);
  store.actions.remove("morning-dew");
  assert.equal(store.getState().cart.total, 0);
  assert.equal(store.getState().cart.lines.length, 0);
});

test("formatPrice даёт рубли с разделителем разрядов", () => {
  assert.equal(plain(core.formatPrice(1290)), "1 290 ₽");
  assert.equal(plain(core.formatPrice(0)), "0 ₽");
});

test("повторное добавление увеличивает количество и упирается в остаток", () => {
  const { store } = makeStore();
  store.actions.add("invisibility-potion");
  store.actions.add("invisibility-potion");
  store.actions.add("invisibility-potion");
  const [line] = store.getState().cart.lines;
  assert.equal(line.qty, 2);
  assert.equal(line.maxQty, 2);
  store.actions.add("teleport-scroll");
  assert.equal(store.getState().cart.lines.length, 1);
});

test("decrement не опускается ниже 1, setQty(0) удаляет строку", () => {
  const { store } = makeStore();
  store.actions.add("healing-potion");
  store.actions.decrement("healing-potion");
  assert.equal(store.getState().cart.lines[0].qty, 1);
  store.actions.increment("healing-potion");
  assert.equal(store.getState().cart.subtotal, 980);
  store.actions.setQty("healing-potion", 0);
  assert.equal(store.getState().cart.count, 0);
});

test("промокод: 300 → 270, повтор не копит скидку", () => {
  const { store } = makeStore();
  store.actions.add("phoenix-feather");
  store.actions.add("morning-dew");
  assert.deepEqual(store.actions.applyPromo("  alchemy10 "), { ok: true, code: "ALCHEMY10", percent: 10 });
  assert.equal(store.getState().cart.total, 270);
  assert.deepEqual(store.actions.applyPromo("ALCHEMY10"), { ok: false, reason: "already_applied" });
  assert.equal(store.getState().cart.total, 270);
  assert.deepEqual(store.actions.applyPromo("SALE50"), { ok: false, reason: "unknown" });
  assert.deepEqual(store.actions.applyPromo("  "), { ok: false, reason: "empty" });
  assert.equal(core.computeDiscount(105, 10), 11);
});

test("поиск без учёта регистра и ё, категория и сортировка", () => {
  const { store } = makeStore();
  store.actions.setFilters({ query: "МЕД" });
  assert.deepEqual(store.getState().visibleProducts.map((p) => p.id), ["troll-honey"]);
  store.actions.setFilters({ query: "зелье" });
  assert.equal(store.getState().visibleProducts.length, 2);
  store.actions.setFilters({ query: "", category: "Ингредиенты", sort: "price-desc" });
  assert.deepEqual(store.getState().visibleProducts.map((p) => p.price), [280, 200, 100]);
  store.actions.resetFilters();
  assert.equal(store.getState().visibleProducts.length, products.length);
});

test("избранное показывается отдельным видом, сброс фильтров вид не трогает", () => {
  const { store } = makeStore();
  store.actions.toggleFavorite("healing-potion");
  store.actions.setFilters({ view: "favorites", query: "зелье" });
  assert.deepEqual(store.getState().visibleProducts.map((p) => p.id), ["healing-potion"]);
  store.actions.resetFilters();
  assert.equal(store.getState().filters.view, "favorites");
});

test("корзина, избранное и промокод переживают перезагрузку, мусор отбрасывается", () => {
  const storage = memoryStorage();
  const first = makeStore({ storage }).store;
  first.actions.add("morning-dew");
  first.actions.add("morning-dew");
  first.actions.toggleFavorite("troll-honey");
  first.actions.applyPromo("ALCHEMY10");
  const { store } = makeStore({ storage });
  assert.equal(store.getState().cart.total, 360);
  assert.deepEqual(store.getState().favorites, ["troll-honey"]);

  const broken = memoryStorage({ "t:cart": "{oops", "t:favorites": JSON.stringify(["ghost", "morning-dew"]) });
  const restored = makeStore({ storage: broken }).store.getState();
  assert.equal(restored.cart.lines.length, 0);
  assert.deepEqual(restored.favorites, ["morning-dew"]);
});

test("checkout отправляет количества и очищает корзину", async () => {
  const sent = [];
  const api = {
    createOrder: async (order) => {
      sent.push(order);
      return { id: "ord_1", total: 270 };
    },
    getProducts: async () => products
  };
  const { store } = makeStore({ api, mode: "api" });
  store.actions.add("phoenix-feather");
  store.actions.add("morning-dew");
  store.actions.applyPromo("ALCHEMY10");
  const result = await store.actions.checkout();
  assert.equal(result.ok, true);
  assert.deepEqual(sent[0], {
    items: [{ productId: "phoenix-feather", quantity: 1 }, { productId: "morning-dew", quantity: 1 }],
    promoCode: "ALCHEMY10"
  });
  assert.equal(store.getState().cart.count, 0);
  assert.equal(store.getState().lastOrder.id, "ord_1");
});

test("checkout при 409 сохраняет корзину и возвращает ошибку", async () => {
  const api = {
    createOrder: async () => {
      throw Object.assign(new Error("Недостаточно товара"), { status: 409, code: "out_of_stock" });
    },
    getProducts: async () => products
  };
  const { store } = makeStore({ api, mode: "api" });
  store.actions.add("healing-potion");
  const result = await store.actions.checkout();
  assert.equal(result.ok, false);
  assert.equal(result.error.status, 409);
  assert.equal(store.getState().cart.count, 1);
  assert.equal(store.getState().checkoutPending, false);
});
