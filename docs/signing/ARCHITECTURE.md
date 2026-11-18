# Архитектура SIGNING

Уточнение пользователя от 18.11.2026: `process` — слой features, `screens` — pages. Имена каталогов сохранены. Зависимости направлены вниз:

```text
App / app          провайдеры, выбор страницы, ErrorBoundary
screens            подключение UI к состоянию и командам
widgets            композиция фичей и составных блоков интерфейса
process            независимые фичи
entities/signing   модель заявки и операции с её данными
shared             транспорт, CryptoPro, базовые UI и утилиты
```

## Фичи и композиция

| Срез process | Ответственность                                                      |
| ------------ | -------------------------------------------------------------------- |
| start        | settings → start                                                     |
| setting      | проверка рабочего места, кэш, ready, подробности ошибки              |
| check        | подготовка тестовой подписи и файлов CHECK                           |
| signing      | подготовка подписей и файлов SIGNING                                 |
| signature    | однократная подготовка → отправка готовых файлов → применение ответа |
| documents    | проверка доступности документа и команда получения                   |
| status       | ошибки, BACK/внешний URL, таймер SUCCESS                             |
| polling      | последовательный опрос task с отменой                                |

`widgets/signing-process` содержит React-состояние и Context. `useProcess.ts` собирает фичи; `useOperation.ts` управляет busy, отменой и перезапуском после 401; `useResponse.ts` применяет серверные ответы и проверяет SETTING cache до показа экрана; `useSessionExpiry.ts` следит за сроком сессии. `useSignatureActions.ts` связывает выбранный сертификат и подготовку CHECK/SIGNING с общей фичей отправки. Навигационный Context выводится из состояния заявки.

`entities/signing` содержит типы заявки и контрактов операций, чистые преобразования состояния, хранилище сессии и отдельные сетевые функции start/ready/check/signing/poll/document. Retry и чтение request id находятся в `shared/api/network.ts`; таймеры, URL и resolver криптоошибок — в `shared/lib`. Это сохраняет общую HTTP-политику без импортов между фичами.

## Подключение будущего интерфейса

Текущий UI временный, его дизайн не является контрактом. При рефакторинге сохранены существующие JSX и CSS Modules; страницы стали небольшими точками подключения к Context.

- `ProcessProvider` и `NavigationProvider` из публичного API `widgets/signing-process` размещаются над страницами. Ключ `inquiryId` создаёт новый запуск и отменяет предыдущий.
- `useSigningProcess()` предоставляет `state` и `commands`: start, back, checkSetting, showSettingError, submitCheck, submitSigning, downloadDocument, recoverFromRenderError.
- `useSigningNavigation()` предоставляет current, from, target, backTo и back. Страницу выбирают по `current.process`, без React Router.
- Сертификат передаётся в команды подписи по thumbprint. Данные сертификатов, busy, фаза подписи, прогресс настройки и requestId доступны в состоянии. Форматирование списка сертификатов для текущего UI вынесено в `toCertificateList`; сценарий от него не зависит.
- Текущие `widgets/workplace`, `test-signature`, `signing-documents`, `process-status` принимают данные и callbacks. Для другого дизайна можно заменить их, сохранив Context и фичи. Просмотр документа, object URL и локальный выбор сертификата относятся к UI.
- ErrorBoundary находится в `app` и использует StatusView из widget; нижние слои не импортируют страницы.

## Границы и проверки

Срезы `screens`, `widgets`, `process` и `entities` имеют публичные `index.ts`. Соседние срезы одного слоя не импортируют друг друга; их связывает вышестоящий слой. `shared` организован по техническим сегментам.

Правило `fsd/import-boundaries` в ESLint проверяет относительные статические импорты, re-export и строковые динамические импорты: направление слоёв, изоляцию срезов и использование публичных API. Алиасы путей в проекте не используются. Интеграционные тесты исключены из ограничения слоёв, поскольку собирают несколько уровней приложения. Проверки самого правила: `node --test test/fsd.test.mjs`.

Сценарные регрессии находятся в `widgets/signing-process/process.test.ts`; композиция App/страниц/widgets/features — в `app/processComposition.test.ts`. Реальный CryptoPro и браузерный HTTP 303 этими тестами не проверяются.

## Актуальный UI от 18.11.2026

Дизайн actual-design применяется через существующие widgets без замены модели/фичей. shared/ui содержит ContentWrapper, ScreenCard, SettingItem, DocumentLink и Loading; shared/assets — исходные SVG. Локальные замены внутренних UI-kit находятся в shared/vendor; единственные алиасы — @sber-site/sbercraft-nova-kit и @sber-site/malachite-kit (TypeScript/Vite/Jest). Они всегда ведут в shared; бизнес-слои через них не импортируются. test/design-preview.html — изолированный вход Vite для синтетической визуальной проверки.
