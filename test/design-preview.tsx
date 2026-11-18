import ReactDOM from 'react-dom';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Workplace } from '../src/widgets/workplace';
import type { SettingProgress } from '../src/widgets/workplace';
import { TestSignature } from '../src/widgets/test-signature';
import { SigningDocuments } from '../src/widgets/signing-documents';
import { StatusView } from '../src/widgets/process-status';
import { StartScreen } from '../src/screens/start';
import { WaitingScreen } from '../src/screens/waiting';
import {
  checkProcess,
  settingProcess,
  signingProcess,
} from '../src/shared/api/__tests__/fixtures';
import '../src/styles.css';
import styles from './design-preview.module.css';
const names = [
  'START',
  'SETTING',
  'CHECK',
  'SIGNING',
  'WAITING',
  'SUCCESS',
  'WARNING',
  'ERROR',
] as const;
function Preview() {
  const [result, setResult] = useState('');
  const screen =
    new URLSearchParams(window.location.search).get('screen') ?? 'SIGNING';
  const certificates = {
    status: 'loaded' as const,
    options: [
      {
        id: 'one',
        title: 'Тестов Иван Иванович',
        organization: 'Тестовая организация',
        serial: '0001',
        expires: '18.11.2027',
      },
      {
        id: 'two',
        title:
          'Демонстрационный сертификат с очень длинным наименованием организации',
        organization: 'Тестовая организация',
        serial: '0002',
      },
    ],
  };
  const buttons = { accent: { message: 'Подтвердить', process: 'BACK' } };
  const progress = new Map<string, SettingProgress>([
    ['extension', { state: 'SUCCESS' }],
    [
      'program',
      {
        state: 'ERROR',
        onDetails: () => setResult('Открыта инструкция настройки КриптоПро'),
      },
    ],
    ['certificate', { state: 'WAIT' }],
  ]);
  let content: ReactNode = (
    <SigningDocuments
      response={{
        ...signingProcess,
        screen: {
          ...signingProcess.screen,
          title: 'Подпишите документы',
          message: 'Ознакомьтесь с документами и поставьте подпись',
          step: 'Шаг 1 из 4',
          buttons,
          lists: {
            documents: signingProcess.screen.lists.documents.map(
              (doc, index) => ({
                ...doc,
                format: 'TXT',
                title:
                  index === 0
                    ? 'Согласие на электронное взаимодействие и обработку персональных данных'
                    : 'Заявление на подключение сервиса',
              }),
            ),
          },
        },
      }}
      busy={false}
      certificates={certificates}
      onSign={() => setResult('Вызвана команда подписания (демонстрация)')}
      downloadDocument={async () => ({
        title: 'Демонстрационный документ',
        format: 'TXT',
        binary: btoa('Synthetic document for UI preview.'),
      })}
    />
  );
  if (screen === 'START') {
    content = <StartScreen />;
  }
  if (screen === 'WAITING') {
    content = <WaitingScreen />;
  }
  if (screen === 'SETTING') {
    content = (
      <Workplace
        response={{
          ...settingProcess,
          screen: {
            ...settingProcess.screen,
            title: 'Проверьте рабочее место',
            message: 'Убедитесь, что всё готово для подписания документов',
            lists: {
              testing: settingProcess.screen.lists.testing.map((item) => ({
                ...item,
                message:
                  {
                    certificate: 'Наличие действующего сертификата',
                    extension: 'Расширение браузера установлено',
                    program: 'Необходимо установить КриптоПро CSP',
                  }[item.name] ?? item.name,
              })),
            },
            buttons: {
              accent: { message: 'Запустить проверку', process: 'SETTING' },
            },
          },
        }}
        busy={false}
        progress={progress}
        onCheck={() =>
          setResult('Вызвана проверка рабочего места (демонстрация)')
        }
      />
    );
  }
  if (screen === 'CHECK') {
    content = (
      <TestSignature
        response={{
          ...checkProcess,
          screen: {
            ...checkProcess.screen,
            title: 'Подтвердите владение ключом ЭП',
            message: 'Чтобы получить доступ к документам для подписания',
            buttons,
            consent: {
              text: 'Нажимая на кнопку, я даю своё согласие на взаимодействие и обработку персональных данных',
              hypertext:
                'согласие на взаимодействие и обработку персональных данных',
              url: 'https://example.test/consent',
            },
          },
        }}
        busy={false}
        certificates={certificates}
        onSign={() => setResult('Вызвана тестовая подпись (демонстрация)')}
      />
    );
  }
  if (screen === 'SUCCESS' || screen === 'WARNING' || screen === 'ERROR') {
    content = (
      <StatusView
        response={{
          process: 'STATUS',
          screen: {
            level: screen,
            title:
              screen === 'SUCCESS'
                ? 'Документы подписаны'
                : 'Не удалось завершить подписание',
            message: 'Текст результата операции',
            buttons: { accent: { message: 'Продолжить', process: 'BACK' } },
          },
        }}
        activate={() => setResult('Вызвано действие статуса (демонстрация)')}
      />
    );
  }
  return (
    <>
      <nav
        className={styles.nav}
        aria-label="Визуальная проверка — синтетические данные"
      >
        {names.map((name) => (
          <a
            key={name}
            href={'?screen=' + name}
            aria-current={screen === name ? 'page' : undefined}
          >
            {name}
          </a>
        ))}
      </nav>
      {content}
      {result && (
        <output className={styles.result} onClick={() => setResult('')}>
          {result}
        </output>
      )}
    </>
  );
}
if (import.meta.env.DEV) {
  ReactDOM.render(<Preview />, document.getElementById('root'));
}
