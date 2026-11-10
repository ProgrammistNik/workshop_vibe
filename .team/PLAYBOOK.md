# Плейбук для людей

Четыре агента работают параллельно, каждый в своей папке-клоне и в своих файлах, пушат прямо в `main` и общаются через `.team/inbox/*.md`. Люди код не трогают: запускают агентов, подталкивают их, проверяют результат руками и сдают.

| Человек | Агент | Роль | Объясняет на демо |
|---|---|---|---|
| Разработчик 1 | Claude Code | `lead` — логика, интеграция, README, сдача | backend, заказы, остатки (B3, B5) |
| Разработчик 1 | Codex | `backend` — Go API B1–B6, SQLite | |
| Разработчик 2 | Codex | `qa` — e2e, CI, smoke, ZIP, деплой | тесты, CI, деплой (Q1, D1, D2) |
| Разработчик 3 | Claude Code | `ui` — дизайн, вёрстка, F1–F10 | каталог, корзина, промокод (F-задачи) |

## 0. Подготовка (каждый, 3 минуты)
- `git`, Go 1.24+ (macOS: `brew install go`, Windows: `winget install GoLang.Go`), Node 20+, Python 3.
- Codex и Claude Code залогинены.
- Доступ на запись в https://github.com/itmo-workshop-09-11-2026/workshop_vibe (если нет — владелец добавляет в Settings → Collaborators).
- Владелец репозитория один раз: **Settings → Pages → Source → GitHub Actions**.

## 1. Клоны (каждому агенту — своя папка)
Разработчик 1:
```bash
git clone https://github.com/itmo-workshop-09-11-2026/workshop_vibe.git vibe-lead
git clone https://github.com/itmo-workshop-09-11-2026/workshop_vibe.git vibe-backend
```
Разработчик 2: `git clone … vibe-qa`. Разработчик 3: `git clone … vibe-ui`.

## 2. Запуск агентов в полностью автономном режиме
Claude Code (в папке клона):
```bash
claude --dangerously-skip-permissions
```
Codex (в папке клона):
```bash
codex --dangerously-bypass-approvals-and-sandbox -c model_reasoning_effort="high"
```
Модель — самая сильная из доступных. Стартовать всем четверым одновременно.

## 3. Что отправить агенту (одно сообщение)
Подставь роль: `lead`, `backend`, `qa`, `ui`.

```text
Ты — агент <РОЛЬ> команды workshop_vibe. Прочитай AGENTS.md, docs/CONTRACT.md и .team/prompts/<РОЛЬ>.md и выполни свою роль полностью и автономно: без вопросов к нам, без ожидания подтверждений, до закрытия всего бэклога. Начни прямо сейчас с P0. Не пиши комментарии в коде. Пушь в main по git-протоколу из AGENTS.md.
```

## 4. Если агент остановился раньше времени
```text
Продолжай. git pull, проверь .team/inbox/<РОЛЬ>.md и свой бэклог в .team/prompts/<РОЛЬ>.md, возьми следующий незакрытый пункт. Не останавливайся, пока бэклог не закрыт или в main не появился .team/FREEZE.
```
Если Claude упёрся в лимит Pro — переключи модель на Sonnet через `/model` и отправь то же сообщение. Если лимит кончился совсем — тот же промпт роли можно отдать Codex разработчика 2 во втором клоне.

## 5. Таймлайн
| Время | Что происходит | Что делают люди |
|---|---|---|
| 0–5 мин | кит в `main`, клоны, запуск 4 агентов | всё из разделов 0–3 |
| 5–20 | `lead` пушит `store.js`, `backend` — `api.js`, `ui` верстает, `qa` пишет e2e | следят, что пуши идут |
| ~60 | минимум + большинство F работают | **создать issue сдачи с минимумом** (страховка), открыть публичный URL на телефоне |
| 60–140 | B1–B6, полировка, тесты, CI зелёный | руками проходят сценарии из `docs/TESTING.md`, найденное пишут в `.team/inbox/<роль>.md` |
| ~150 | `.team/FREEZE` (создаёт `lead`, или вы сами) | репетиция демо по `docs/DEMO.md` |
| 160–175 | `lead` — финальная проверка, ZIP, тег `v1.0.0` | обновить issue текстом из `docs/SUBMISSION.md`, прикрепить `shop.zip`, commit ID |
| 175–180 | демо | каждый рассказывает свой сценарий |

Создать FREEZE вручную:
```bash
git pull && touch .team/FREEZE && git add .team/FREEZE && git commit -m "chore: feature freeze" && git push
```

## 6. Сдача
- Issue: https://github.com/itmo-workshop-09-11-2026/workshop-guide/issues/new?template=submission.md — заголовок «Сдача: workshop_vibe — <дата>», текст из `docs/SUBMISSION.md`, прикрепить `shop.zip` (собирает `lead`: `go run . --pack`).
- Без контактов, ИСУ и токенов — только GitHub-ники.
