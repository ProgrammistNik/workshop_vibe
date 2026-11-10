# Контракт архитектуры — workshop_vibe

Единый источник правды для всех агентов. Код обязан соответствовать этому документу. Менять документ может только роль `lead`, и только аддитивно (не ломая уже реализованное). Нужна правка — запиши задачу в `.team/inbox/lead.md`.

ТЗ воркшопа: https://github.com/itmo-workshop-09-11-2026/workshop-guide/blob/main/docs/task.md — всё важное из него продублировано ниже.

---

## 0. Продукт

**«Ступка и колба»** — лавка алхимика. Учебный магазин: каталог, корзина, фильтры, промокод, избранное, заказ через API с остатками.

Цель команды — максимум баллов и лучшее демо:

| Группа | ID | Обязательно сделать |
|---|---|---|
| Минимум | — | ≥3 товара (у нас 12) с названием, ценой в ₽ и кнопкой «Добавить»; добавление; удаление; общая сумма, в пустой корзине «0 ₽» |
| Интерфейс | F1–F10 | Все десять |
| Backend | B1–B6 | Все шесть |
| Качество | Q1, Q2 | Автотесты (unit + Go + e2e) и воспроизводимый запуск по README |
| Деплой | D1, D2 | GitHub Pages по HTTPS, автодеплой при push в `main` (workflow уже есть, не трогать) |

Проверочный пример ТЗ должен воспроизводиться буквально: «Перо феникса» 100 ₽ + «Флакон утренней росы» 200 ₽ = 300 ₽ → удалить перо → 200 ₽ → удалить флакон → корзина пуста, 0 ₽. С промокодом 300 ₽ → 270 ₽.

Публичный URL (после деплоя): https://itmo-workshop-09-11-2026.github.io/workshop_vibe/

---

## 1. Структура и владельцы

```text
AGENTS.md                      lead
CLAUDE.md                      lead
README.md                      lead
docs/CONTRACT.md               lead
docs/DEMO.md                   lead
docs/SUBMISSION.md             lead
docs/BACKEND.md                backend
docs/TESTING.md                qa
docs/screenshots/**            qa
main.go                        backend
internal/**                    backend
go.mod, go.sum                 backend
Dockerfile, Makefile           backend
.env.example, api.http         backend
.gitignore, .dockerignore      backend
site/index.html                ui
site/styles.css                ui
site/app.js                    ui
site/js/ui/**                  ui
site/js/catalog.js             ui   (данные из раздела 2 менять нельзя, только описания и картинки)
site/assets/**                 ui   (site/assets/shop.svg не удалять — его проверяет smoke-тест)
site/js/config.js              lead
site/js/core.js                lead
site/js/store.js               lead
site/js/api.js                 backend
tests/unit/**                  lead
tests/smoke.py                 qa
e2e/**                         qa
scripts/**                     qa
.github/workflows/check.yml    qa
.github/workflows/pages.yml    никто (не трогать)
.team/status/<role>.md         соответствующая роль
.team/inbox/<role>.md          все дописывают, владелец отмечает
.team/FREEZE                   lead или человек
```

---

## 2. Каталог

Файл `site/js/catalog.js` — единственный источник данных о товарах. Его читают: браузер (офлайн-режим, работает даже через `file://`) и Go-сервер (сид базы данных).

Строгий формат файла (сервер парсит его, ломать нельзя):

```js
window.Shop = window.Shop || {};
window.Shop.catalog = { ...валидный JSON... };
```

Всё между `window.Shop.catalog = ` и последней `;` — строгий JSON: двойные кавычки, без завершающих запятых, без комментариев, UTF-8.

Схема товара:

| Поле | Тип | Правило |
|---|---|---|
| `id` | string | `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤64, уникален |
| `name` | string | 1–120 символов |
| `price` | integer | целые рубли, 1–1 000 000 |
| `category` | string | 1–60 символов |
| `description` | string | ≤500 символов |
| `image` | string | относительный путь `assets/products/<id>.svg` |
| `stock` | integer | 0–100 000 |

Зафиксированный набор (id, название, цена, категория, остаток неизменны; порядок = порядок «по умолчанию»):

| # | id | Название | Цена | Категория | Остаток |
|---|---|---|---|---|---|
| 1 | `phoenix-feather` | Перо феникса | 100 | Ингредиенты | 25 |
| 2 | `morning-dew` | Флакон утренней росы | 200 | Ингредиенты | 40 |
| 3 | `troll-honey` | Мёд горного тролля | 280 | Ингредиенты | 18 |
| 4 | `healing-potion` | Зелье исцеления | 490 | Зелья | 30 |
| 5 | `night-vision-elixir` | Эликсир ночного зрения | 760 | Зелья | 15 |
| 6 | `luck-tonic` | Тоник удачи | 990 | Зелья | 8 |
| 7 | `invisibility-potion` | Зелье невидимости | 1290 | Зелья | 5 |
| 8 | `fireball-scroll` | Свиток огненного шара | 640 | Свитки | 20 |
| 9 | `teleport-scroll` | Свиток телепортации | 2100 | Свитки | 2 |
| 10 | `compass-of-wishes` | Компас желаний | 1550 | Артефакты | 4 |
| 11 | `bottomless-pouch` | Бездонный кошель | 1890 | Артефакты | 6 |
| 12 | `moonstone-amulet` | Амулет из лунного камня | 2450 | Артефакты | 3 |

Категории в порядке первого появления: Ингредиенты, Зелья, Свитки, Артефакты. Все цены различны, поэтому сортировка детерминирована.

---

## 3. Бизнес-правила (одинаковы в браузере и на сервере)

### 3.1 Цены
- Целые рубли. Формат отображения: `Intl.NumberFormat("ru-RU")` + неразрывный пробел + `₽`: `1 290 ₽`, `0 ₽`.
- Тесты сравнивают текст после замены любых пробельных символов (`\s+`, включая U+00A0 и U+202F) на обычный пробел.

### 3.2 Корзина
- Строка корзины: `{ id, qty }`. Повторное «Добавить» увеличивает `qty` существующей строки.
- `maxQty = min(99, stock)`. При `stock = 0` товар нельзя добавить, кнопка неактивна с текстом «Нет в наличии».
- `qty` — целое 1…maxQty. Установка `qty ≤ 0` удаляет строку. «−» при `qty = 1` ничего не делает (в UI кнопка отключена). Больше maxQty — обрезается до maxQty.
- `subtotal = Σ price × qty`, `count = Σ qty`.

### 3.3 Поиск, категория, сортировка, избранное
- Нормализация текста: `trim` → нижний регистр (`toLocaleLowerCase("ru")` / `strings.ToLower`) → `ё` заменить на `е`.
- Поиск: нормализованное `name` содержит нормализованный запрос. Пустой запрос — все товары. Пример: «МЕД» находит «Мёд горного тролля», «зелье» — 2 товара, «свиток» — 2.
- Категория: точное совпадение; пустая строка — все категории.
- Сортировка: `default` (порядок каталога), `price-asc`, `price-desc`. Сортировка стабильная.
- Порядок применения: поиск → категория → избранное (только в браузере, вид `favorites`) → сортировка.
- Сброс фильтров: `query = ""`, `category = ""`, `sort = "default"`; вид (все/избранное) не меняется.

### 3.4 Промокод
- Единственный код: `ALCHEMY10` — скидка 10%. Ввод нечувствителен к регистру и пробелам по краям.
- `discount = round(subtotal × 10 / 100)` с округлением половины вверх (JS: `Math.round`, Go: `(subtotal*percent + 50) / 100`). `total = subtotal − discount`.
- 300 ₽ → скидка 30 ₽ → 270 ₽. Повторное применение не накапливает скидку. Пустая корзина: 0 ₽.
- Результаты применения: `ok`, `empty` (пустой ввод), `unknown` (нет такого кода), `already_applied`.

### 3.5 Хранение в браузере (F3)
GitHub Pages организации делит `localStorage` между командами, поэтому все ключи с префиксом репозитория:

| Ключ | Значение |
|---|---|
| `workshop_vibe:cart:v1` | `[{"id":"phoenix-feather","qty":1}]` |
| `workshop_vibe:favorites:v1` | `["luck-tonic"]` |
| `workshop_vibe:promo:v1` | `"ALCHEMY10"` или отсутствует |
| `workshop_vibe:theme:v1` | `"light"` / `"dark"` или отсутствует (системная) |

Битый JSON, неизвестные id, неверные `qty` — молча отбрасываются/исправляются. Недоступное хранилище (приватный режим, `file://` в некоторых браузерах) не ломает работу. Изменения из другой вкладки подхватываются через событие `storage`.

---

## 4. Frontend-модули

Чистый JS без сборки и зависимостей, классические скрипты (не ES-модули — чтобы работал `file://`). Единственный глобал — `window.Shop`. Порядок подключения в `site/index.html` строго такой:

```html
<script defer src="./js/config.js"></script>
<script defer src="./js/catalog.js"></script>
<script defer src="./js/core.js"></script>
<script defer src="./js/store.js"></script>
<script defer src="./js/api.js"></script>
<script defer src="./app.js"></script>
```

Свои файлы `./js/ui/*.js` роль `ui` подключает между `api.js` и `app.js`.

### 4.1 `Shop.config` (`site/js/config.js`, lead)
Замороженный объект: `storageKeys { cart, favorites, promo, theme }`, `promoCodes { ALCHEMY10: 10 }`, `maxQuantity: 99`, `apiBase: "./api"`, `apiTimeoutMs: 1500`, `searchDebounceMs: 200`.

### 4.2 `Shop.core` (`site/js/core.js`, lead)
Чистые функции без DOM и хранилища, UMD: в браузере `window.Shop.core`, в Node — `require("../../site/js/core.js")`. Публичная часть для UI: `Shop.core.formatPrice(rubles) → "1 290 ₽"`. Остальное — внутреннее дело lead (поиск, сортировка, корзина, промокод, итоги, санитайзинг).

### 4.3 `Shop.store` (`site/js/store.js`, lead)
UMD (тестируется в Node с подменой хранилища). Публичный API:

```text
Shop.store.init({ products, mode })        mode: "static" | "api"; восстанавливает cart/favorites/promo из localStorage
Shop.store.getState() → State              замороженный снимок
Shop.store.subscribe(listener) → unsubscribe   listener(state) после каждого изменения, включая изменения из другой вкладки
Shop.store.setSearchProvider(fn)           fn(filters) → Promise<Product[]>; если задан, visibleProducts берутся с сервера (debounce searchDebounceMs, status "loading")
Shop.store.setProducts(products)           обновить каталог (например, остатки после заказа)

Shop.store.actions.add(id)
Shop.store.actions.remove(id)
Shop.store.actions.increment(id)
Shop.store.actions.decrement(id)
Shop.store.actions.setQty(id, qty)
Shop.store.actions.clearCart()
Shop.store.actions.toggleFavorite(id)
Shop.store.actions.applyPromo(code) → { ok: true, code, percent } | { ok: false, reason: "empty" | "unknown" | "already_applied" }
Shop.store.actions.removePromo()
Shop.store.actions.setFilters({ query?, category?, sort?, view? })
Shop.store.actions.resetFilters()
Shop.store.actions.checkout() → Promise<{ ok: true, order } | { ok: false, error: { status, code, message } }>
```

`checkout` работает только при `mode = "api"`: вызывает `Shop.api.createOrder`, при успехе очищает корзину и промокод, кладёт заказ в `lastOrder`, перезагружает каталог (`Shop.api.getProducts`) для свежих остатков. При `409 out_of_stock` корзина сохраняется, каталог обновляется.

State:

```text
{
  mode: "static" | "api",
  status: "ready" | "loading" | "error",
  error: string | null,
  products: Product[],
  visibleProducts: Product[],
  categories: string[],
  filters: { query: string, category: string, sort: "default" | "price-asc" | "price-desc", view: "all" | "favorites" },
  favorites: string[],
  cart: {
    lines: [{ id, product, qty, maxQty, lineTotal }],
    count: number,
    subtotal: number,
    discount: number,
    total: number,
    promo: { code, percent } | null
  },
  lastOrder: Order | null,
  checkoutPending: boolean
}
```

### 4.4 `Shop.api` (`site/js/api.js`, backend)

```text
Shop.api.detect() → Promise<boolean>                 GET ./api/health, таймаут apiTimeoutMs; никогда не reject; false на file://, GitHub Pages, ошибке
Shop.api.getProducts({ query, category, sort }?) → Promise<Product[]>   пустые параметры и sort=default не отправлять
Shop.api.getCategories() → Promise<string[]>
Shop.api.createOrder({ items: [{ productId, quantity }], promoCode? }) → Promise<Order>
```

Ошибки — reject объектом `ApiError` (`name = "ApiError"`, `status`, `code`, `message`, `details`). Сетевая ошибка: `status = 0`, `code = "network_error"`.

### 4.5 Bootstrap (`site/app.js`, ui)

```text
1. const online = Shop.api ? await Shop.api.detect() : false
2. products = online ? await Shop.api.getProducts() : Shop.catalog.products   (при ошибке API — офлайн-каталог)
3. Shop.store.init({ products, mode: online ? "api" : "static" })
4. if (online) Shop.store.setSearchProvider(filters => Shop.api.getProducts(filters))
5. Shop.store.subscribe(render); render(Shop.store.getState())
```

Приложение не падает, если `Shop.api` отсутствует или сервер недоступен.

---

## 5. HTTP API (backend, Go)

Один процесс отдаёт `site/` (как в шаблоне) и `/api/*` на одном origin — CORS не нужен и не включается. Все ответы `/api` — `application/json; charset=utf-8`, `Cache-Control: no-store`.

| Метод | Путь | Описание | Успех |
|---|---|---|---|
| GET | `/api/health` | `{"status":"ok"}` | 200 |
| GET | `/api/products?q=&category=&sort=` | Массив товаров по правилам 3.3 (B1, B2) | 200 |
| GET | `/api/products/{id}` | Товар | 200 / 404 |
| GET | `/api/categories` | Массив строк в порядке первого появления | 200 |
| POST | `/api/orders` | Создать заказ (B3, B5) | 201 |
| GET | `/api/orders/{id}` | Заказ | 200 / 404 |
| POST | `/api/products` | Создать товар (B6, админ) | 201 / 409 |
| PUT | `/api/products/{id}` | Изменить товар, кроме `id` (B6, админ) | 200 / 404 |
| DELETE | `/api/products/{id}` | Удалить товар (B6, админ) | 204 / 404 |

Неверное значение `sort` → 400 `invalid_sort`.

Запрос заказа:

```json
{"items":[{"productId":"phoenix-feather","quantity":1},{"productId":"morning-dew","quantity":1}],"promoCode":"ALCHEMY10"}
```

Ответ `201`:

```json
{
  "id": "ord_3f9a1c7e2b4d",
  "createdAt": "2026-11-10T17:00:00Z",
  "items": [
    {"productId":"phoenix-feather","name":"Перо феникса","price":100,"quantity":1,"lineTotal":100},
    {"productId":"morning-dew","name":"Флакон утренней росы","price":200,"quantity":1,"lineTotal":200}
  ],
  "subtotal": 300,
  "discount": 30,
  "total": 270,
  "promoCode": "ALCHEMY10"
}
```

Правила заказа:
- Цены только из базы сервера; любые `price`/`total` от клиента игнорируются (неизвестные поля не ошибка).
- `items` обязателен и не пуст; `quantity` — целое JSON-число 1…99 (дробное, строка, 0, отрицательное → ошибка); повторяющиеся `productId` суммируются, сумма тоже ≤99.
- `promoCode` необязателен; пустая строка = нет кода; неизвестный → 400 `invalid_promo`.
- Списание остатков атомарно для всего заказа в одной транзакции: либо списано всё, либо ничего. Продать больше остатка нельзя, в том числе при параллельных запросах.

Формат ошибок (всегда):

```json
{"error":{"code":"out_of_stock","message":"Недостаточно товара «Зелье невидимости»: доступно 2","details":{"productId":"invisibility-potion","available":2}}}
```

| HTTP | code |
|---|---|
| 400 | `invalid_json`, `empty_items`, `invalid_quantity`, `unknown_product`, `invalid_promo`, `invalid_product`, `invalid_sort` |
| 401 | `unauthorized` |
| 404 | `not_found` |
| 409 | `out_of_stock`, `product_exists` |
| 413 | `payload_too_large` (тело > 64 KiB) |
| 415 | `unsupported_media_type` (не `application/json`) |
| 503 | `admin_disabled` (не задан `ADMIN_TOKEN`) |

Админ-доступ (B6): заголовок `Authorization: Bearer <ADMIN_TOKEN>`, сравнение за постоянное время. Токен только в переменной окружения, никогда в `site/`.

Окружение:

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `HOST` | `127.0.0.1` | адрес |
| `PORT` | `8000` | порт |
| `DB_PATH` | `data/shop.db` | SQLite; каталог создаётся автоматически; в git не попадает |
| `ADMIN_TOKEN` | пусто | токен B6 |

Флаги: `--pack` (как в шаблоне, поведение не менять), `--reset-db` (пересоздать базу из `site/js/catalog.js` и выйти).

---

## 6. UI: регионы и `data-testid`

E2E-тесты используют только эти `data-testid` (плюс роли/имена для доступности). UI обязан их выставить, QA — использовать.

| testid | Элемент | Атрибуты/содержимое |
|---|---|---|
| `mode-badge` | индикатор режима | `data-mode="api"` / `"static"` |
| `theme-toggle` | переключатель темы | `aria-pressed` |
| `search-input` | `input type="search"` | с `<label>` |
| `category-select` | `select`, первая опция «Все категории» (value `""`) | |
| `sort-select` | `select`: `default`, `price-asc`, `price-desc` | |
| `filters-reset` | кнопка «Сбросить» | |
| `view-all` | вкладка «Все товары» | `aria-selected` |
| `view-favorites` | вкладка «Избранное» | `aria-selected` |
| `favorites-count` | число избранных | |
| `results-count` | «Найдено: N» | |
| `catalog` | список товаров (`ul`/`ol`) | |
| `product-card` | карточка | `data-product-id`, `data-in-stock="true/false"` |
| `product-image` | `img` товара | |
| `product-name` | название | |
| `product-price` | цена «1 290 ₽» | |
| `product-stock` | «В наличии: N» / «Осталось N» / «Нет в наличии» | |
| `add-to-cart` | кнопка «Добавить» | `disabled` при нулевом остатке или qty = maxQty |
| `favorite-toggle` | кнопка избранного | `aria-pressed` |
| `empty-results` | «Ничего не найдено» + кнопка сброса | |
| `cart-toggle` | кнопка корзины в шапке/плавающая на мобильном | содержит `cart-count` |
| `cart-count` | число товаров (Σ qty) | |
| `cart` | корзина: сайдбар ≥1024px, панель-диалог на мобильном | |
| `cart-close` | закрыть панель (мобильный) | |
| `cart-empty` | «Корзина пуста» | |
| `cart-line` | строка корзины | `data-product-id` |
| `cart-line-name` | название | |
| `cart-line-qty` | количество (число) | |
| `cart-line-total` | сумма строки | |
| `qty-increase` | «+» | `aria-label="Увеличить количество: <название>"` |
| `qty-decrease` | «−» | `disabled` при qty = 1 |
| `remove-from-cart` | «Удалить» | `aria-label="Удалить из корзины: <название>"` |
| `promo-input` | поле промокода | с `<label>` |
| `promo-apply` | «Применить» | |
| `promo-remove` | убрать промокод | |
| `promo-message` | сообщение | `data-state="success"` / `"error"` |
| `cart-subtotal` | «Товары: N ₽» | |
| `cart-discount` | «Скидка: −N ₽» (только если промокод активен) | |
| `cart-total` | «Итого: N ₽»; в пустой корзине 0 ₽ | |
| `checkout` | «Оформить заказ» — только при `mode = "api"` и непустой корзине | |
| `order-confirmation` | диалог успешного заказа | |
| `order-id` | номер заказа | |
| `order-total` | сумма с сервера | |
| `order-close` | закрыть диалог | |
| `toast` | всплывающее уведомление в `aria-live="polite"` | |
| `toast-undo` | «Отменить» (после удаления из корзины) | |

Тексты сообщений промокода: `ok` — «Промокод ALCHEMY10 применён: −10%», `empty` — «Введите промокод», `unknown` — «Такого промокода нет», `already_applied` — «Промокод уже применён». Рядом с полем подсказка: «Попробуйте ALCHEMY10».

---

## 7. Команды

| Команда | Что делает |
|---|---|
| `go run .` | сервер сайта + API на http://localhost:8000 |
| `go run . --pack` | `shop.zip` из `site/` |
| `go run . --reset-db` | пересоздать базу |
| `node --test tests/unit` | unit-тесты core/store |
| `go vet ./... && go test -race ./...` | тесты backend |
| `python3 tests/smoke.py` | smoke шаблона (сервер, MIME, ZIP, изоляция исходников) |
| `cd e2e && npm ci && npx playwright test` | e2e |

Цели `Makefile`: `run`, `pack`, `reset-db`, `test` (= unit + go + smoke), `test-unit`, `test-go`, `test-e2e`, `smoke`, `docker-build`, `docker-run`.

---

## 8. Определение готовности

| ID | Готово, когда |
|---|---|
| Минимум | Пример 100 + 200 = 300 → 200 → 0 ₽ проходит в e2e в статическом и API-режиме, в том числе из распакованного ZIP |
| F1 | У всех 12 товаров SVG с подписью; при ошибке загрузки — аккуратная заглушка (e2e подменяет ответ картинки на 404) |
| F2 | +/− меняют количество и пересчитывают суммы; лимит maxQty |
| F3 | Корзина, избранное и промокод переживают перезагрузку; битые данные в хранилище не ломают страницу |
| F4 | Поиск по названию без учёта регистра и ё/е |
| F5 | Фильтр категорий + «Сбросить» |
| F6 | Сортировка по возрастанию и убыванию цены |
| F7 | ALCHEMY10: 300 → 270, повторное применение не копит скидку |
| F8 | Избранное с отдельной вкладкой и счётчиком |
| F9 | 360px без горизонтального скролла, плавающая кнопка корзины, панель корзины |
| F10 | Весь сценарий минимума проходит только клавиатурой; axe без serious/critical |
| B1 | Страница при запуске через `go run .` грузит каталог из `GET /api/products` (`mode-badge` = api) |
| B2 | Поиск/категория/сортировка в API-режиме уходят на сервер параметрами `q`, `category`, `sort` |
| B3 | `POST /api/orders` считает сумму на сервере, все ошибки валидации — 4xx по разделу 5 |
| B4 | Товары, остатки и заказы в SQLite переживают перезапуск сервера |
| B5 | Тест: 50 параллельных заказов на остаток 10 → ровно 10 успешных, остаток 0 |
| B6 | Изменение каталога только с `Authorization: Bearer $ADMIN_TOKEN`; без токена 401/503 |
| Q1 | В CI зелёные: unit, Go (`-race`), smoke (Linux + Windows), e2e |
| Q2 | Чистый клон → команды README → всё работает |
| D1/D2 | Публичный URL отвечает 200 по HTTPS, обновляется после push в `main` |
