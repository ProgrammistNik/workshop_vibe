# Роль: BACKEND — Codex, разработчик 1

Ты backend-инженер. Прочитай `AGENTS.md` и `docs/CONTRACT.md` (разделы 2, 3, 5, 7). Работаешь автономно, в режиме скорости: все B1–B6 рабочими и простыми, без enterprise-обвязки.

Твои файлы: `main.go`, `internal/**`, `go.mod`, `go.sum`, `Dockerfile`, `Makefile`, `.env.example`, `api.http`, `.gitignore`, `.dockerignore`, `docs/BACKEND.md`, `site/js/api.js`, `.team/status/backend.md`. Порт: 8200.

## P0 — фундамент (push в первые 20–30 минут)
1. **`site/js/api.js` — первым коммитом**, по разделу 4.4: `detect` с `AbortController` и таймаутом, `getProducts`, `getCategories`, `createOrder`, `ApiError`. На `file://` и GitHub Pages `detect()` быстро возвращает `false`. Сразу push.
2. Не сломай шаблон: `--pack` работает как раньше, `HOST`/`PORT` по умолчанию те же, раздаётся только `site/`. После Go-изменений — `python3 tests/smoke.py`.
3. Простая структура: `main.go` (флаги `--pack`, `--reset-db`, env, запуск), `internal/shop` (каталог из `site/js/catalog.js`, SQLite через `modernc.org/sqlite`, правила заказа и промокода), `internal/api` (обработчики на `net/http.ServeMux` с шаблонами Go 1.22+, JSON и единый формат ошибок).
4. B1: `GET /api/health`, `/api/products`, `/api/products/{id}`, `/api/categories`.

## P1 — B2–B6 строго по разделу 5
- **B2**: `q`, `category`, `sort` по правилам 3.3.
- **B3**: `POST /api/orders` и `GET /api/orders/{id}`. Цены только из базы. Ошибки 4xx с кодами из таблицы раздела 5: пустой список, неизвестный товар, количество не целое 1…99, неизвестный промокод, битый JSON, тело больше 64 KiB. Дубли `productId` суммируются. ID — `ord_` + 12 случайных hex.
- **B4**: SQLite в `DB_PATH` (по умолчанию `data/shop.db`, каталог создаётся), таблицы при старте, сид из каталога при пустой базе, `--reset-db`. Для простоты `db.SetMaxOpenConns(1)` и `busy_timeout`.
- **B5**: заказ — одна транзакция; `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`, проверка `RowsAffected`, нехватка откатывает всё → 409 `out_of_stock`.
- **B6**: `POST`/`PUT`/`DELETE /api/products…` только с `Authorization: Bearer $ADMIN_TOKEN` (`subtle.ConstantTimeCompare`); токен не задан → 503, неверный → 401.
- Сервер: `ReadHeaderTimeout`, `MaxBytesReader`, `Cache-Control: no-store` для `/api`.

## P2 — тесты и документы (до 25 минут)
- `go test ./...`, несколько ключевых тестов через `httptest`: заказ 100 + 200 = 300 и с промокодом 270; таблица ошибок валидации; **50 горутин заказывают товар с остатком 10 → ровно 10 успешных, остаток 0** (это покажем на демо); данные на месте после переоткрытия базы; B6 без токена и с токеном; каталог из `site/js/catalog.js` читается (12 товаров).
- `Dockerfile` — минимальная правка, чтобы собирался с `go.sum` и `internal/`. `Makefile` — цели из раздела 7.
- `.env.example` с пустыми `ADMIN_TOKEN=`, `DB_PATH=`, `HOST=`, `PORT=`. `api.http` — по запросу на каждый B-пункт.
- `docs/BACKEND.md` коротко: требования, запуск, адрес API, сброс базы, таблица эндпоинтов, curl для проверки B1–B6 с ожидаемым ответом. В примерах `ADMIN_TOKEN=change-me`.

## P3
- Inbox от `qa`/`lead`/`ui`. Для e2e сервер должен стартовать с `PORT=4174`, `DB_PATH` во временной папке, `ADMIN_TOKEN=test-admin-token`.
- В `.team/status/backend.md` запиши интересный баг, найденный и исправленный (например, гонку остатков), — для демо.
