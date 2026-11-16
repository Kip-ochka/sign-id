# Моковый сервер SIGNING

Нужен Node.js 22 или новее. Запустите команды из каталога `back`.

```sh
npm ci
npm start
```

Сервер слушает `http://127.0.0.1:3001`. Переменная `MOCK_PORT` меняет порт. По умолчанию CHECK возвращает HTTP 303 с `{ "task": "…" }` в теле и без `Location`. При `MOCK_303_LOCATION=1` он добавляет `Location`, а GET по этому адресу возвращает тот же `task` с HTTP 200.

`npm test` запускает полный путь по локальному HTTP с синтетическими файлами. Тесты поднимают сервер на свободном порту сами.

## Маршруты

Настройки и экраны ошибок доступны через `GET /proxy/services/sbercraft-dict-ext/serviceProperties/corp-digital-id-sign/:key`. Ключ `settings` возвращает настройки polling и retry. Ключи ошибок возвращают STATUS/WARNING с кнопкой BACK.

Остальные пути указаны относительно `/proxy/services/corp-digital-id-sign/api/public/v1`. Все POST принимают `inquiry_id`, `req_time` в ISO 8601 с часовым поясом, `sc_name: "urn:front-corp-digital-id-microfront"` и `sp_name: "urn:corp-digital-id"`.

| Маршрут               | Запрос                                                                 | Ответ                                                                         |
| --------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `POST /state/start`   | Общие поля в JSON                                                      | SETTING с `session`                                                           |
| `POST /state/ready`   | Общие поля в JSON                                                      | CHECK с `test_document`                                                       |
| `POST /state/check`   | Multipart с `test_document`, сертификатом и `test.sig`                 | HTTP 303 с `task`                                                             |
| `POST /poll/status`   | Общие поля и `task` в JSON                                             | Сначала новый `task`, затем SIGNING с `token` и двумя документами             |
| `POST /document`      | Общие поля и `document_id` в JSON                                      | `multipart/mixed` с JSON-метаданными `response` и Base64-текстом файла `file` |
| `POST /state/signing` | Multipart с `documents`, сертификатом и подписью для каждого документа | Сначала SIGNING с новым `token` и одним документом, затем STATUS/SUCCESS      |

Состояние хранится в памяти отдельно для каждой заявки. Повторный `/state/start` начинает путь этой заявки заново. Для CHECK и SIGNING возвращаются параметры `single/other/detached`. Успешный STATUS содержит синтетический URL `example.test`.

## Отправка и проверка multipart

Порядок частей в `multipart/form-data` следующий.

1. `request` с MIME `application/json`. В JSON нужны общие поля, тестовый документ или текущая группа документов из ответа сервера и `certificates` с метаданными одного сертификата. Метаданные содержат `type: "signed"`, `serial_number`, `thumbprint`, `expires_at` и объекты `person`, `organization`, `issuer`. Поля `signatures` и `certificate_base64` в JSON отклоняются. Полный пример метаданных есть в `server.test.cjs`.
2. `signatures` с MIME `application/pkcs7-signature`. В CHECK нужен бинарный `test.sig`, в SIGNING по одному бинарному `<document.id>.sig` на документ.
3. `certificates` с MIME `text/plain`. Нужен один файл `<serial_number>.b64` с Base64-текстом без PEM-заголовков.

Пример отправки CHECK после `/state/ready` при серийном номере `01`. `request.json` должен содержать `test_document` из полученного ответа.

```sh
curl -i -F 'request=@request.json;type=application/json' -F 'signatures=@test.sig;type=application/pkcs7-signature' -F 'certificates=@01.b64;type=text/plain' http://127.0.0.1:3001/proxy/services/corp-digital-id-sign/api/public/v1/state/check
```

Zod проверяет JSON, состав и порядок частей, MIME-типы, имена файлов, Base64 и соответствие документов выданному шагу. Сервер использует синтетические хэши и проверяет структуру вложений. Криптографическая подлинность CMS/X.509 и содержимое подписанных данных не проверяются.

Консоль выводит JSON-строку на запрос с методом, маршрутом, URL, телом, полем `valid`, HTTP-статусом, `X-Request-Id` и причинами отказа. `valid` показывает результат проверки входных данных. Например, HTTP 401 для неизвестной заявки может сопровождаться `valid: true`, если структура запроса корректна. Лог содержит файлы подписи в Base64 и текст публичного сертификата, поэтому отправляйте только синтетические данные. Лимит тела запроса составляет 8 МБ.
