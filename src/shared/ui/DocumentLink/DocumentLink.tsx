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
        <div
            role="button"
            tabIndex={disabled || pending ? -1 : 0}
            className="document-link"
            aria-disabled={disabled || pending || undefined}
            aria-busy={pending || undefined}
            aria-label={'Открыть документ «' + title + '»'}
            title={title}
            onKeyDown={(event) => {
                if (!disabled && !pending && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onClick?.();
                }
            }}
            onClick={(event) => {
                if (disabled || pending) {
                    return;
                }
                event.currentTarget.focus();
                onClick?.();
            }}
        >
            <Icon size="24" name={icons[format]} theme="ghost" />
            <Text tag="p" className="document-link__main-text">
                {title}
            </Text>
            <Icon size="24" name="chevron-right-small" theme="ghost" />
        </div>
    );
}
