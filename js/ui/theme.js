"use strict";
(function (root) {
  let saved = null;
  try {
    saved = root.localStorage.getItem(root.Shop.config.storageKeys.theme);
  } catch {
    saved = null;
  }
  if (saved === "light" || saved === "dark") {
    root.document.documentElement.dataset.theme = saved;
  }
})(window);
