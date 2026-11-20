import type {
  SettingList,
  SettingScreen as SettingResponse,
} from '../../shared/api';
import Heading from '@sber-site/sbercraft-nova-kit/components/Heading';
import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import { useBreakpoints } from '@sber-site/sbercraft-nova-kit/hooks/useBreakpoints';
import { ContentWrapper } from '../../shared/ui/ContentWrapper';

import { SettingItem } from '../../shared/ui/SettingItem';
import { WorkActions } from '../../entities/signing';
import * as css from './Workplace.css';
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
  const { isDesktop } = useBreakpoints();
  const { title, message, lists, buttons } = response.screen;
  const rows = lists?.testing ?? [];
  return (
    <ContentWrapper>
      <div className="sign_setting">
        <div className="sign_setting__main">
          <Heading
            tag="h1"
            size={isDesktop ? 'h2' : 'h3'}
            className="sign_setting__heading"
          >
            {title}
          </Heading>
          <Text className="sign_setting__subheading">{message}</Text>
          {rows.length > 0 && (
            <>
              {rows.map((item, index) => {
                const result = progress?.get(item.name);
                return (
                  <SettingItem
                    key={index}

                    status={result?.state ?? 'WAIT'}
                    message={
                      item.message || stageLabels.get(item.name) || item.name
                    }
                    textButton={item.text_button || 'Подробнее'}
                    disabled={busy}
                    onDetails={result?.onDetails}
                  />
                );
              })}
            </>
          )}
          {!onCheck && <Text>Проверка рабочего места пока недоступна.</Text>}
        </div>
        <WorkActions
          className="sign_setting__button-secondary"
          buttons={buttons}
          busy={busy}
          loading={busy}
          onAction={onCheck}
        />
      </div>
    </ContentWrapper>
  );
}
