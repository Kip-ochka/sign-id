import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import { useBreakpoints } from '@sber-site/sbercraft-nova-kit/hooks/useBreakpoints';
import waitIcon from '../../assets/WAIT_STATUS.svg';
import successIcon from '../../assets/SUCCESS_STATUS.svg';
import errorIcon from '../../assets/WARNING_STATUS.svg';
import * as css from './SettingItem.css';
type Props = {
  status: 'WAIT' | 'RUNNING' | 'SUCCESS' | 'ERROR';
  message: string;
  textButton?: string;
  onDetails?: () => void;
  disabled?: boolean;
};
const icons = {
  WAIT: waitIcon,
  RUNNING: waitIcon,
  SUCCESS: successIcon,
  ERROR: errorIcon,
};
const labels = {
  WAIT: 'Ожидает проверки',
  RUNNING: 'Проверяем',
  SUCCESS: 'Проверено',
  ERROR: 'Ошибка проверки',
};
export function SettingItem({
  status,
  message,
  textButton = 'Подробнее',
  onDetails,
  disabled,
}: Props) {
  useStyles(css);
  const { isDesktop } = useBreakpoints();
  return (
    <div className="sign_setting-item">
      <div
        className={
          status === 'ERROR'
            ? 'sign_setting-item__error'
            : 'sign_setting-item__main'
        }
      >
        <img
          className="sign_setting-item__icon"
          src={icons[status]}
          alt={labels[status]}
        />
        <Text
          tag="p"
          size={isDesktop ? 'md' : 'sm'}
          className="sign_setting-item__main-text"
          title={message}
        >
          {message}
        </Text>
        {status === 'ERROR' && onDetails && (
          <button
            type="button"
            onClick={onDetails}
            disabled={disabled}
            className="sign_settings-item__error-button"
          >
            {textButton}
          </button>
        )}
      </div>
    </div>
  );
}
