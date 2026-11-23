import Button from '@sber-site/malachite-kit/esm/components/Button';
import Heading from '@sber-site/sbercraft-nova-kit/components/Heading';
import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import { useBreakpoints } from '@sber-site/sbercraft-nova-kit/hooks/useBreakpoints';

import successIcon from '../../shared/assets/success.svg';
import warningIcon from '../../shared/assets/warning.svg';
import type { DisplayScreen } from '../../entities/signing';
import { canActivate } from '../../process/status';
import { ContentWrapper } from '../../shared/ui/ContentWrapper';
import { ActionGroup } from '../../shared/ui/ActionGroup';

import * as css from './StatusView.css';

const levels = {
    SUCCESS: { label: 'Успешно' },
    WARNING: { label: 'Внимание' },
    ERROR: { label: 'Ошибка' }
} as const;

export function StatusView({
    response,
    requestId,
    activate
}: {
    response: Extract<DisplayScreen, { process: 'STATUS' }>;
    requestId?: string;
    activate: (slot: 'accent' | 'secondary') => void;
}) {
    useStyles(css);
    const { isDesktop } = useBreakpoints();
    const { title, message, level, buttons } = response.screen;
    const { label: indicatorLabel } = levels[level];
    const showRequestId = Boolean(requestId) && level !== 'SUCCESS';
    const actions = (['accent', 'secondary'] as const).flatMap(slot => {
        const button = buttons?.[slot];
        if (!button || !canActivate(button)) {
            return [];
        }
        return [{ slot, label: button.message }];
    });
    return (
        <ContentWrapper>
            <section className='sign_status' data-level={level}>
                <img
                    className='sign_status__icon'
                    src={level === 'SUCCESS' ? successIcon : warningIcon}
                    alt={indicatorLabel}
                    width={96}
                    height={96}
                />
                <div className='sign_status__copy'>
                    <Heading tag='h1' size={isDesktop ? 'h2' : 'h3'} className='sign_status__heading'>
                        {title}
                    </Heading>
                    {(message || showRequestId) && (
                        <div className='sign_status__details'>
                            {message && <Text tag='p'>{message}</Text>}
                            {showRequestId && (
                                <Text tag='p'>
                                    Идентификатор запроса <code>{requestId}</code>
                                </Text>
                            )}
                        </div>
                    )}
                </div>
                {actions.length > 0 && (
                    <ActionGroup className='sign_status__actions'>
                        {actions.map(({ slot, label }) => (
                            <Button
                                type='button'
                                theme={slot === 'accent' ? 'primary' : 'secondary'}
                                key={slot}
                                size='large'
                                onClick={() => activate(slot)}
                            >
                                {label}
                            </Button>
                        ))}
                    </ActionGroup>
                )}
            </section>
        </ContentWrapper>
    );
}
