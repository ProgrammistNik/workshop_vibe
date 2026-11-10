# Роль: BACKEND — Codex, разработчик 1

Ты backend-инженер. Сначала полностью прочитай `AGENTS.md` и `docs/CONTRACT.md` (особенно разделы 2, 3, 5, 7, 8). Работаешь автономно до закрытия бэклога.

Твои файлы: `main.go`, `internal/**`, `go.mod`, `go.sum`, `Dockerfile`, `Makefile`, `.env.example`, `api.http`, `.gitignore`, `.dockerignore`, `docs/BACKEND.md`, `site/js/api.js`, `.team/status/backend.md`.

Твой порт: 8200. Цель — B1–B6 целиком, на уровне production-сервиса, с исчерпывающими тестами. Один процесс отдаёт `site/` и `/api` на одном origin.

## P0 — фундамент (push в первые 20–30 минут)
1. **`site/js/api.js` — первым коммитом**, по разделу 4.4 контракта: `detect` с `AbortController` и таймаутом, `getProducts`, `getCategories`, `createOrder`, `ApiError`. Только относительный `Shop.config.apiBase`. На `file://` и GitHub Pages `detect()` быстро возвращает `false`. Сразу push — `ui` и `lead` на него опираются.
2. Сохрани поведение шаблона: `--pack` без изменений семантики, `HOST`/`PORT` и их значения по умолчанию, раздача только `site/`, 404 для всего вне `site/`. `python3 tests/smoke.py` обязан проходить после каждого твоего коммита.
3. Структура:
   - `main.go` — разбор флагов (`--pack`, `--reset-db`), конфиг из env, запуск и graceful shutdown;
   - `internal/catalog` — чтение сида из `site/js/catalog.js` (строгий формат из раздела 2) и валидация товаров;
   - `internal/store` — SQLite через `modernc.org/sqlite`: схема, миграции при старте, сид при пустой базе, транзакции;
   - `internal/shop` — доменные правила: нормализация поиска, сортировка, валидация заказа, промокод, расчёт сумм;
   - `internal/httpapi` — `net/http.ServeMux` с шаблонами маршрутов Go 1.22+, JSON-ответы, единый формат ошибок, middleware.
4. B1: `GET /api/health`, `GET /api/products`, `GET /api/products/{id}`, `GET /api/categories`.

## P1 — функции
- **B2**: `q`, `category`, `sort` на сервере по правилам раздела 3.3; неверный `sort` → 400 `invalid_sort`.
- **B3**: `POST /api/orders` и `GET /api/orders/{id}` строго по разделу 5. Цены только из базы. Дробное, строковое, нулевое, отрицательное количество, больше 99, пустой список, неизвестный товар, неизвестный промокод, битый JSON, не тот Content-Type, тело больше 64 KiB — каждый случай даёт свой 4xx-код из таблицы. Дубли `productId` суммируются. ID заказа — криптослучайный (`ord_` + 12 hex).
- **B4**: SQLite в `DB_PATH` (по умолчанию `data/shop.db`, каталог создаётся), WAL, `busy_timeout`, внешние ключи. Таблицы товаров (с позицией для сортировки по умолчанию), заказов и строк заказа. Данные переживают перезапуск. `--reset-db` пересоздаёт базу из каталога.
- **B5**: заказ — одна транзакция; списание `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?` с проверкой `RowsAffected`; любая нехватка откатывает весь заказ → 409 `out_of_stock` с `productId` и `available`.
- **B6**: `POST /api/products`, `PUT /api/products/{id}`, `DELETE /api/products/{id}` только с `Authorization: Bearer $ADMIN_TOKEN`, сравнение `crypto/subtle.ConstantTimeCompare`; токен не задан → 503 `admin_disabled`; неверный или отсутствует → 401 `unauthorized`; валидация полей по разделу 2; дубликат id → 409 `product_exists`.

## P2 — надёжность и тесты
- `http.Server` с `ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`, `IdleTimeout`; graceful shutdown по SIGINT/SIGTERM; `http.MaxBytesReader`; проверка Content-Type; `Cache-Control: no-store` для `/api`; `X-Content-Type-Options: nosniff` и `Referrer-Policy: no-referrer` для всех ответов; структурные логи запросов через `log/slog` (метод, путь, статус, длительность); recovery-middleware, возвращающий 500 в формате ошибок.
- Тесты (`go test -race ./...` зелёный):
  - httptest на каждый эндпоинт и каждый код ошибки из таблицы раздела 5;
  - table-driven валидация заказа, включая клиентскую «цену» (игнорируется) и пример ТЗ 100 + 200 = 300, с промокодом 270;
  - **конкурентность B5**: 50 горутин одновременно заказывают по 1 шт. товара с остатком 10 → ровно 10 × 201, 40 × 409, остаток 0;
  - persistence B4: заказ → закрыть базу → открыть → заказ и остаток на месте;
  - B6: без токена, с неверным, с верным; токен не задан;
  - парсер каталога на реальном `site/js/catalog.js`: 12 товаров, данные совпадают с таблицей раздела 2.
- `Dockerfile`: копировать `go.mod`, `go.sum` и весь Go-код, `CGO_ENABLED=0`, `ENV DB_PATH=/app/data/shop.db`, каталог данных доступен пользователю 65532, том для `/app/data`. `Makefile` — все цели из раздела 7.
- `.env.example` с пустыми `ADMIN_TOKEN=`, `DB_PATH=`, `HOST=`, `PORT=`. `api.http` — запросы для каждого пункта B1–B6, включая ошибки и 409.
- `docs/BACKEND.md`: версии инструментов, установка, запуск (macOS/Linux, Windows PowerShell, Docker), адрес API, подготовка и сброс базы, полная таблица эндпоинтов, curl для проверки каждого B-пункта с ожидаемым ответом, как запустить тест конкурентности. Без реальных секретов: в примерах `ADMIN_TOKEN=change-me`.

## P3 — после закрытия бэклога
- Обработай свой inbox (запросы от `qa`, `lead`, `ui`).
- Помоги `qa` с API-режимом e2e: сервер должен стабильно стартовать с `PORT=4174`, `DB_PATH` во временной папке и `ADMIN_TOKEN=test-admin-token`.
- Профилирование и упрощение: никакого дублирования между `internal/shop` и обработчиками, ошибки с контекстом, понятные имена.
- Обновляй `.team/status/backend.md` при каждом push; запиши самый интересный баг, найденный и исправленный (например, гонку остатков), — он пойдёт в демо.
