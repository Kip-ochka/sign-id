import type {
  SettingList,
  SettingScreen as SettingResponse,
} from '../../shared/api';
import { ScreenCard } from '../shared/ScreenCard';
import { WorkActions } from '../shared/WorkActions';
import styles from '../shared/Screen.module.css';
import local from './SettingScreen.module.css';
export type SettingProgress = {
  state: SettingList['state'] | 'RUNNING';
  onDetails?: () => void;
};

const stageLabels = new Map([
  ['extension', 'Расширение'],
  ['program', 'Криптопровайдер'],
  ['certificate', 'Сертификаты'],
]);
const stageStates = {
  WAIT: 'Ожидает проверки',
  RUNNING: 'Проверяем',
  SUCCESS: 'Проверено',
  ERROR: 'Ошибка проверки',
};

export function SettingScreen({
  response,
  busy,
  progress,
  onCheck,
}: {
  response: SettingResponse;
  busy: boolean;
  progress?: ReadonlyMap<string, SettingProgress>;
  onCheck?: () => void;
}) {
  const { title, message, lists, buttons } = response.screen;
  return (
    <ScreenCard title={title} message={message}>
      <ul className={styles.list} aria-label="Этапы проверки">
        {lists.testing.map((item, index) => {
          const result = progress?.get(item.name);
          const state = result?.state ?? item.state;
          return (
            <li key={index} className={styles.row}>
              <div>
                <strong>{stageLabels.get(item.name) ?? item.name}</strong>
                {item.message && (
                  <div className={styles.detail}>{item.message}</div>
                )}
                {item.description && (
                  <div className={styles.detail}>{item.description}</div>
                )}
              </div>
              <div className={local.rowActions}>
                <span className={local.stage} data-state={state} role="status">
                  {stageStates[state]}
                </span>
                {state === 'ERROR' && result?.onDetails && (
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={busy}
                    onClick={result.onDetails}
                  >
                    {item.text_button || 'Подробнее'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {!onCheck && (
        <p className={styles.detail}>
          Проверка рабочего места пока недоступна.
        </p>
      )}
      <WorkActions buttons={buttons} busy={busy} onAction={onCheck} />
    </ScreenCard>
  );
}
