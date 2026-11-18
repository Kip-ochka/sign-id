import type {
  SettingList,
  SettingScreen as SettingResponse,
} from '../../shared/api';
import { ScreenCard } from '../../shared/ui/ScreenCard';
import { SettingItem } from '../../shared/ui/SettingItem';
import { WorkActions } from '../../entities/signing';
import * as css from '../../shared/ui/Screen.css';
export type SettingProgress = {
  state: SettingList['state'] | 'RUNNING';
  onDetails?: () => void;
};
const stageLabels = new Map([
  ['extension', 'Расширение'],
  ['program', 'Криптопровайдер'],
  ['certificate', 'Сертификаты'],
]);
export function Workplace({
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
  useStyles(css);
  const { title, message, lists, buttons } = response.screen;
  const rows = lists?.testing ?? [];
  return (
    <ScreenCard title={title} message={message}>
      {rows.length > 0 && (
        <ul className="list" aria-label="Этапы проверки" aria-live="polite">
          {rows.map((item, index) => {
            const result = progress?.get(item.name);
            return (
              <li key={index}>
                <SettingItem
                  status={result?.state ?? 'WAIT'}
                  message={
                    item.message || stageLabels.get(item.name) || item.name
                  }
                  description={item.description}
                  textButton={item.text_button || 'Подробнее'}
                  disabled={busy}
                  onDetails={result?.onDetails}
                />
              </li>
            );
          })}
        </ul>
      )}
      {!onCheck && (
        <p className="detail">Проверка рабочего места пока недоступна.</p>
      )}
      <WorkActions buttons={buttons} busy={busy} onAction={onCheck} />
    </ScreenCard>
  );
}
