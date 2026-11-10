"use strict";
window.Shop = window.Shop || {};
window.Shop.config = Object.freeze({
  storageKeys: Object.freeze({
    cart: "workshop_vibe:cart:v1",
    favorites: "workshop_vibe:favorites:v1",
    promo: "workshop_vibe:promo:v1",
    theme: "workshop_vibe:theme:v1"
  }),
  promoCodes: Object.freeze({ ALCHEMY10: 10 }),
  maxQuantity: 99,
  apiBase: "./api",
  apiTimeoutMs: 1500,
  searchDebounceMs: 200
});
