import Icon from '@sber-site/malachite-kit/esm/components/Icon';
import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import * as css from './DocumentLink.css';
const icons = {
  DOC: 'doc-file',
  PDF: 'pdf-file',
  OTHER: 'default-file',
} as const;
export function DocumentLink({
  format,
  title,
  disabled,
  pending,
  onClick,
}: {
  format: 'DOC' | 'PDF' | 'OTHER';
  title: string;
  disabled?: boolean;
  pending?: boolean;
  onClick?: () => void;
}) {
  useStyles(css);
  return (
    <button
      type="button"
      className="document-link"
      disabled={disabled}
      aria-disabled={pending || undefined}
      aria-busy={pending || undefined}
      aria-label={'Открыть документ «' + title + '»'}
      title={title}
      onClick={(event) => {
        if (pending) {
          return;
        }
        event.currentTarget.focus();
        onClick?.();
      }}
    >
      <Icon size="24" name={icons[format]} theme="ghost" />
      <Text tag="span" className="document-link__main-text">
        {title}
      </Text>
      <Icon size="24" name="chevron-right-small" theme="ghost" />
    </button>
  );
}
