# Моковый API SIGNING

Самостоятельное Node.js-приложение. Папку можно скопировать отдельно от клиента;
импортов из клиентского проекта нет. Зависимости и lock-файл находятся здесь же.

## Запуск

Из этой папки выполните:

`npm ci`

`npm start` — обычный запуск; `npm run dev` — перезапуск при изменениях.

Адрес по умолчанию: `http://127.0.0.1:3001`.
Другой порт задаётся переменной окружения `MOCK_PORT`.

## Настройка ответов

Все синтетические данные находятся в `data.mjs`:

- `config.state`: постоянные ответы на start, ready, check, signing;
- `config.poll`: постоянный ответ polling (TASK продолжает ожидание);
- `config.http`: HTTP-статусы отдельных событий и документа;
- `settings`, `errorScreen`, `document`: справочник и файл документа.

Для открытия процесса сразу измените `config.state.start` и обновите страницу.
Кэш SETTING клиента может сразу отправить ready; для проверки SETTING удалите
`digital_id_sign` из localStorage.

Для заявки `workplace-diagnostics` мок отдаёт SETTING на start и экран
«Рабочее место готово» на ready. Клиент в dev выбирает эту заявку для URL
без `id` и пропускает кэш проверки.

Доступны SETTING/SETTING_EMPTY, CHECK, SIGNING/SIGNING_SINGLE,
STATUS_SUCCESS/WARNING/ERROR/TIMER, TASK, INVALID_RESPONSE и варианты
CHECK/SIGNING с суффиксами BATCH, ARCHIVED, XML, ATTACHED.

API использует префикс `/proxy/services/corp-digital-id-sign/api/public/v1`;
справочник — `/proxy/services/sbercraft-dict-ext/serviceProperties/corp-digital-id-sign`.
`/document` возвращает постоянный текстовый файл в multipart/mixed.
Подписи в multipart не проверяются, хэши синтетические.
HTTP 303 отправляется без Location: выберите TASK для соответствующего события.
Автоматической смены ответов нет. Проверка реального CryptoPro и приёма подписей
этим сервером не выполняется.
