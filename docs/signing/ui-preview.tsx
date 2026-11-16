import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

import { useStatusActions } from '../../src/process/useStatusActions';
import { ProcessErrorBoundary } from '../../src/process/ProcessErrorBoundary';
import type { DisplayScreen } from '../../src/process/model';
import { CheckScreen } from '../../src/screens/check/CheckScreen';
import { SettingScreen } from '../../src/screens/setting/SettingScreen';
import type { SettingProgress } from '../../src/screens/setting/SettingScreen';
import type {
  CertificateList,
  CertificateOption,
} from '../../src/screens/shared/CertificatePicker';
import type { DocumentPreview } from '../../src/screens/signing/PreviewDialog';
import { SigningScreen } from '../../src/screens/signing/SigningScreen';
import { StartScreen } from '../../src/screens/start/StartScreen';
import { StatusScreen } from '../../src/screens/status/StatusScreen';
import { WaitingScreen } from '../../src/screens/waiting/WaitingScreen';
import { initialState } from '../../src/process/model';
import {
  checkProcess,
  settingProcess,
  signingProcess,
  statusProcess,
} from '../../src/shared/api/__tests__/fixtures';
import '../../src/styles.css';

const setting = {
  ...settingProcess,
  screen: {
    ...settingProcess.screen,
    buttons: { accent: { message: 'Запустить проверку', process: 'SETTING' } },
    lists: {
      testing: ['extension', 'program', 'certificate'].map((name, index) => ({
        ...settingProcess.screen.lists.testing[0],
        name,
        message: [
          'Доступ к расширению браузера',
          'Проверка версии КриптоПро CSP',
          'Поиск подходящих сертификатов',
        ][index],
        description: '',
        text_button: 'Подробнее',
      })),
    },
  },
};

const check = {
  ...checkProcess,
  screen: {
    ...checkProcess.screen,
    consent: {
      ...checkProcess.screen.consent,
      text: 'Подробнее об условиях проверки',
    },
    buttons: {
      accent: { message: 'Выполнить тестовую подпись', process: 'CHECK' },
    },
  },
};

const longTitle = 'Название_документа_без_пробелов_'.repeat(6);
const documents = Array.from({ length: 12 }, (_, index) => ({
  ...signingProcess.screen.lists.documents[0],
  id: String(index),
  title: index ? 'Документ ' + (index + 1) : longTitle,
}));

const signing = {
  ...signingProcess,
  screen: {
    ...signingProcess.screen,
    lists: { documents },
    buttons: { accent: { message: 'Подписать документы', process: 'SIGNING' } },
  },
};
const first = {
  id: 'first',
  title: 'Тестовый Пользователь',
  organization: 'Тестовая организация',
  serial: '001',
  expires: '31.12.2027',
};
const second = { ...first, id: 'second', serial: '002' };
const cases = {
  start: 'START',
  waiting: 'WAITING',
  setting: 'SETTING, ожидание',
  'setting-active': 'SETTING, проверка',
  'setting-error': 'SETTING, ошибка этапа',
  'check-loading': 'CHECK, поиск',
  'check-empty': 'CHECK, без сертификатов',
  'check-single': 'CHECK, один сертификат',
  'check-multiple': 'CHECK, выбор',
  'check-busy': 'CHECK, выполнение',
  signing: 'SIGNING, длинный список без шага',
  'signing-updated': 'SIGNING, новый список с шагом',
  'document-loading': 'SIGNING, загрузка документа',
  success: 'STATUS, успех',
  warning: 'STATUS, предупреждение',
  error: 'STATUS, ошибка',
  invalid: 'STATUS, недействительная ссылка',
  fallback: 'ErrorBoundary',
};

type Case = keyof typeof cases;

function BrokenScreen(): never {
  throw new Error('Синтетическая ошибка рендера');
}

function Fixture({
  scenario,
  show,
}: {
  scenario: Case;
  show: (next: Case) => void;
}) {
  const [preview, setPreview] = useState<DocumentPreview>();
  const [result, setResult] = useState('');
  const url = preview?.url;
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  const invalid = initialState('').screen;
  const status: DisplayScreen =
    scenario === 'invalid'
      ? invalid
      : {
          process: 'STATUS',
          ...(scenario === 'warning' ? { timer: 0 } : {}),
          screen: {
            ...statusProcess.screen,
            level:
              scenario === 'success'
                ? 'SUCCESS'
                : scenario === 'error'
                  ? 'ERROR'
                  : 'WARNING',
            title:
              scenario === 'success'
                ? 'Документы приняты'
                : scenario === 'error'
                  ? 'Не удалось продолжить'
                  : 'Требуется повторная проверка',
            message:
              scenario === 'error'
                ? 'Повторите попытку позже. ' + longTitle
                : 'Вернитесь к предыдущему шагу.',
            buttons: { accent: { message: 'Назад', process: 'BACK' } },
          },
        };
  const activate = useStatusActions(
    status,
    () => show('setting'),
    () => undefined,
  );

  if (scenario === 'start') return <StartScreen />;
  if (scenario === 'waiting') return <WaitingScreen />;
  if (scenario === 'fallback') {
    return (
      <ProcessErrorBoundary
        onError={() => undefined}
        onRetry={() => show('setting')}
      >
        <BrokenScreen />
      </ProcessErrorBoundary>
    );
  }
  if (
    scenario === 'setting' ||
    scenario === 'setting-active' ||
    scenario === 'setting-error'
  ) {
    const progress = new Map<string, SettingProgress>();
    if (scenario === 'setting-active')
      progress.set('extension', { state: 'RUNNING' });
    if (scenario === 'setting-error') {
      progress.set('extension', { state: 'SUCCESS' });
      progress.set('program', {
        state: 'ERROR',
        onDetails: () => show('error'),
      });
    }
    return (
      <SettingScreen
        response={setting}
        busy={scenario === 'setting-active'}
        progress={progress}
        onCheck={() => show('setting-active')}
      />
    );
  }
  if (
    scenario === 'success' ||
    scenario === 'warning' ||
    scenario === 'error' ||
    scenario === 'invalid'
  ) {
    if (status.process !== 'STATUS') throw new Error('Ожидался STATUS');
    return (
      <StatusScreen
        response={status}
        requestId={
          scenario === 'error' ? 'synthetic-request-0123456789' : undefined
        }
        activate={(slot) => void activate(slot)}
      />
    );
  }

  const isSigning =
    scenario === 'signing' ||
    scenario === 'signing-updated' ||
    scenario === 'document-loading';
  const response =
    scenario === 'signing-updated'
      ? {
          ...signing,
          screen: {
            ...signing.screen,
            step: 'Подписание дополнительного документа',
            lists: {
              documents: [
                {
                  ...documents[0],
                  id: 'updated',
                  title: 'Дополнительное соглашение',
                },
              ],
            },
          },
        }
      : isSigning
        ? signing
        : check;
  const certificates: CertificateList =
    scenario === 'check-loading'
      ? { status: 'loading' }
      : {
          status: 'loaded',
          options:
            scenario === 'check-empty'
              ? []
              : scenario === 'check-single' || scenario === 'check-busy'
                ? [first]
                : [first, second],
        };

  const onSign = (certificate: CertificateOption) =>
    setResult('Фикстура: выбран сертификат ' + certificate.serial);

  return (
    <>
      {response.process === 'CHECK' ? (
        <CheckScreen
          response={response}
          certificates={certificates}
          busy={scenario === 'check-busy'}
          onSign={onSign}
        />
      ) : (
        <SigningScreen
          response={response}
          busy={scenario === 'check-busy'}
          certificates={certificates}
          onSign={onSign}
          pendingDocumentId={scenario === 'document-loading' ? '0' : undefined}
          onOpenDocument={(id) => {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 380;
            const context = canvas.getContext('2d');
            if (!context) return;
            context.fillStyle = '#f2f5fa';
            context.fillRect(0, 0, 640, 380);
            context.fillStyle = '#182230';
            context.font = '26px system-ui';
            context.fillText('Синтетический документ', 36, 68);
            canvas.toBlob((blob) => {
              if (!blob) return;
              const title =
                response.screen.lists.documents.find((item) => item.id === id)
                  ?.title ?? 'Документ';
              setPreview({
                title,
                url: URL.createObjectURL(blob),
                filename: 'fixture.png',
                kind: 'image',
              });
            });
          }}
          preview={preview}
          closePreview={() => setPreview(undefined)}
        />
      )}
      {result && <output>{result}</output>}
    </>
  );
}

function Preview() {
  const fromUrl = new URLSearchParams(window.location.search).get('case');
  const [scenario, show] = useState<Case>(
    fromUrl && Object.hasOwn(cases, fromUrl) ? (fromUrl as Case) : 'setting',
  );
  return (
    <>
      <label>
        Синтетический сценарий{' '}
        <select
          id="fixture-case"
          value={scenario}
          onChange={(event) => show(event.target.value as Case)}
        >
          {Object.entries(cases).map(([id, label]) => (
            <option value={id} key={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <Fixture
        key={scenario === 'signing-updated' ? 'signing' : scenario}
        scenario={scenario}
        show={show}
      />
    </>
  );
}

if (import.meta.env.DEV) {
  ReactDOM.render(<Preview />, document.getElementById('root'));
}
