# Роль: QA — Codex, разработчик 2

Ты инженер по качеству и CI. Прочитай `AGENTS.md` и `docs/CONTRACT.md` (разделы 3, 5, 6, 7). Работаешь автономно, в режиме скорости: ключевые сценарии под автотестами и зелёный CI, без исчерпывающих наборов.

Твои файлы: `e2e/**`, `tests/smoke.py`, `.github/workflows/check.yml`, `scripts/**`, `docs/TESTING.md`, `docs/screenshots/**`, `.team/status/qa.md`. `.github/workflows/pages.yml` не трогать. Порты: 8400, e2e — 4173 (статика) и 4174 (API).

## P0 — e2e по контракту, не дожидаясь UI (30 минут)
Тесты по `data-testid` из раздела 6 и данным из раздела 2. Пока UI не готов, они падают — это нормально, не помечай их `skip`.
1. `e2e/package.json` + `package-lock.json`, `@playwright/test` с точной версией, `e2e/playwright.config.js`:
   - `webServer` статика: `python3 -m http.server 4173 --bind 127.0.0.1 --directory ../site`;
   - `webServer` API: `go run .` из корня с `PORT=4174`, `HOST=127.0.0.1`, `DB_PATH` во временной папке, `ADMIN_TOKEN=test-admin-token`, ожидание `/api/health`;
   - проекты `static-desktop`, `static-mobile` (Pixel 7), `api-desktop`; trace при падении.
2. Три файла:
   - `minimum.spec.js` — ≥3 карточек с названием, ценой и кнопкой; перо 100 + роса 200 = 300 ₽ → удалить перо → 200 ₽ → удалить росу → «Корзина пуста», 0 ₽; нет ошибок в консоли;
   - `features.spec.js` — по одному короткому тесту на F1 (картинка → 404 через `page.route`, видна заглушка), F2, F3 (перезагрузка), F4 («МЕД»), F5 + сброс, F6, F7 (300 → 270, повтор не копит), F8, F9 (360px без горизонтального скролла), F10 (минимум только клавиатурой);
   - `api.spec.js` (только `api-desktop`) — `mode-badge` = api; поиск уходит запросом с `q`; заказ создан, виден номер, остаток уменьшился; плюс через `request`: дробное количество → 400, B6 без токена → 401.
3. Push. Баги, которые видит пользователь, — в inbox владельца (`ui` — вёрстка и `app.js`, `lead` — `core`/`store`, `backend` — API и `api.js`) с шагами воспроизведения.

## P1 — CI и smoke (20 минут)
- `.github/workflows/check.yml`: оставить существующую матрицу smoke; добавить jobs на ubuntu: `unit` (`node --test tests/unit`), `go` (`go test ./...`), `e2e` (setup-go, setup-node с кешем npm, `npm ci`, `npx playwright install --with-deps chromium`, прогон, артефакт отчёта при падении). Job `e2e` добавь, когда `minimum.spec.js` зелёный локально на текущем `main`.
- `tests/smoke.py` — правь, только если он упал из-за новой структуры: игнорировать `node_modules`, `e2e`, `data` при копировании; не удалять существующие проверки.

## P2 — для README и демо (15 минут)
- `scripts/screenshots.js` на Playwright → `docs/screenshots/desktop.png`, `mobile.png`, `dark.png` (с товарами в корзине и промокодом). Запусти, когда UI готов, и повтори после крупных изменений.
- После деплоя: `curl` публичного URL https://itmo-workshop-09-11-2026.github.io/workshop_vibe/ — 200, грузятся `styles.css` и `app.js`; результат в `docs/TESTING.md`.
- `docs/TESTING.md` коротко: как запускать тесты и таблица «ID → автотест → ручная проверка для ментора в 1–2 шага».
- Быстрый ручной проход после крупных push `ui`/`backend`: двойной клик по «Добавить», удаление последней строки, пустой поиск, мобильная ширина. Только видимые баги — в inbox.
- Обновляй `.team/status/qa.md`: какие ID покрыты зелёными тестами, какой баг поймали (для демо).

Не делать: axe, Lighthouse, e2e против публичного сайта, проверку через `file://`, Windows-джобы для Go.
