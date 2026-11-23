// Меняйте ответы и выбранные ключи здесь. node --watch перезапустит сервер.
export const config = {
    state: {
        start: 'SETTING',
        ready: 'CHECK',
        check: 'SIGNING',
        signing: 'STATUS_SUCCESS'
    },
    poll: 'STATUS_SUCCESS',
    // Для проверки ошибок поставьте 400, 401, 403, 429, 500, 503 или 504.
    // Для 303 выберите TASK в state; Location сервер не отправляет.
    http: {
        start: 200,
        ready: 200,
        check: 200,
        signing: 200,
        poll: 200,
        document: 200
    }
};

export const settings = {
    retry_time: 1000,
    retry_addition: 200,
    retry_count: 3,
    pull_time: 10000
};

const back = { message: 'Назад', process: 'BACK' };
const cryptopro = {
    sign_type: 'single',
    sign_format: 'other',
    sign_position: 'detached',
    tsp_address: 'https://example.test/tsp'
};
// Синтетические хэши для проверки UI/контракта, не хэши реального документа.
const hashes = { hash256: 'a'.repeat(64), hash512: 'b'.repeat(128) };

export const process = {
    SETTING: {
        process: 'SETTING',
        session: 'mock-session',
        screen: {
            title: 'Настройка рабочего места',
            message: 'Проверьте компоненты для подписания документов',
            lists: {
                testing: [
                    {
                        name: 'extension',
                        state: 'WAIT',
                        message: 'Расширение браузера',
                        description: 'Проверка расширения КриптоПро',
                        text_button: 'Подробнее'
                    },
                    {
                        name: 'program',
                        state: 'WAIT',
                        message: 'КриптоПро CSP',
                        description: 'Требуется версия 5.0 или выше',
                        text_button: 'Подробнее'
                    },
                    {
                        name: 'certificate',
                        state: 'WAIT',
                        message: 'Сертификат электронной подписи',
                        description: 'Проверка действующих сертификатов',
                        text_button: 'Подробнее'
                    }
                ]
            },
            buttons: {
                accent: { message: 'Запустить проверку', process: 'SETTING' }
            }
        }
    },
    CHECK: {
        process: 'CHECK',
        screen: {
            title: 'Проверка электронной подписи',
            message: 'Выберите сертификат и подпишите тестовый документ',
            consent: {
                text: 'Нажимая кнопку, вы принимаете условия проверки электронной подписи',
                hypertext: 'условия проверки электронной подписи',
                url: 'https://example.test/consent'
            },
            test_document: { format: 'txt', ...hashes },
            buttons: {
                accent: { message: 'Подписать', process: 'CHECK' },
                secondary: back
            }
        },
        cryptopro
    },
    SIGNING: {
        process: 'SIGNING',
        token: 'mock-integrity-token',
        screen: {
            title: 'Подписание документов',
            message: 'Ознакомьтесь с документами и подпишите их',
            step: 'Шаг 1 из 2',
            lists: {
                documents: [
                    { id: 'doc-1', title: 'Заявление', format: 'txt', ...hashes },
                    { id: 'doc-2', title: 'Согласие', format: 'txt', ...hashes }
                ]
            },
            buttons: {
                accent: { message: 'Подписать', process: 'SIGNING' },
                secondary: back
            }
        },
        cryptopro
    },
    STATUS_SUCCESS: {
        process: 'STATUS',
        screen: {
            level: 'SUCCESS',
            title: 'Документы подписаны',
            message: 'Подписание успешно завершено',
            buttons: { accent: back }
        }
    },
    STATUS_WARNING: {
        process: 'STATUS',
        screen: {
            level: 'WARNING',
            title: 'Требуется внимание',
            message: 'Проверьте данные и повторите попытку',
            buttons: { accent: back }
        }
    },
    STATUS_ERROR: {
        process: 'STATUS',
        screen: {
            level: 'ERROR',
            title: 'Не удалось подписать документы',
            message: 'Повторите попытку позже',
            buttons: { accent: back }
        }
    },
    STATUS_TIMER: {
        process: 'STATUS',
        timer: 5000,
        screen: {
            level: 'SUCCESS',
            title: 'Подписание завершено',
            message: 'Через 5 секунд откроется следующий процесс',
            buttons: {
                accent: {
                    message: 'Продолжить',
                    url: 'https://example.test/next-process'
                },
                secondary: back
            }
        }
    },
    TASK: { task: 'mock-task' },
    INVALID_RESPONSE: { process: 'UNKNOWN' }
};

// Варианты ответа без списка проверок, с одним документом и вне режима MVP.
process.SETTING_EMPTY = {
    ...process.SETTING,
    screen: { ...process.SETTING.screen, lists: { testing: [] } }
};
process.SIGNING_SINGLE = {
    ...process.SIGNING,
    screen: {
        ...process.SIGNING.screen,
        lists: { documents: [process.SIGNING.screen.lists.documents[0]] }
    }
};
process.SIGNING_BATCH = {
    ...process.SIGNING,
    cryptopro: { ...cryptopro, sign_type: 'batch' }
};
process.SIGNING_ARCHIVED = {
    ...process.SIGNING,
    cryptopro: {
        ...cryptopro,
        sign_type: 'archived',
        hash256_archived: hashes.hash256,
        hash512_archived: hashes.hash512
    }
};
process.SIGNING_XML = {
    ...process.SIGNING,
    cryptopro: { ...cryptopro, sign_format: 'xml' }
};
process.SIGNING_ATTACHED = {
    ...process.SIGNING,
    cryptopro: { ...cryptopro, sign_position: 'attached' }
};
process.CHECK_BATCH = {
    ...process.CHECK,
    cryptopro: { ...cryptopro, sign_type: 'batch' }
};
process.CHECK_ARCHIVED = {
    ...process.CHECK,
    cryptopro: { ...process.SIGNING_ARCHIVED.cryptopro }
};
process.CHECK_XML = {
    ...process.CHECK,
    cryptopro: { ...cryptopro, sign_format: 'xml' }
};
process.CHECK_ATTACHED = {
    ...process.CHECK,
    cryptopro: { ...cryptopro, sign_position: 'attached' }
};

// GET справочника по любому ключу ошибки возвращает один постоянный экран.
export const errorScreen = process.STATUS_WARNING;

// Один и тот же файл для любого document_id: "SIGNING mock document.\n".
export const document = {
    title: 'Моковый документ',
    format: 'txt',
    base64: 'U0lHTklORyBtb2NrIGRvY3VtZW50Lgo='
};
