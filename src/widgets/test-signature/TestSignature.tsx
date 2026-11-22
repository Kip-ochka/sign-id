import * as css from './TestSignature.css';
import type { CheckScreen as CheckResponse } from '../../shared/api';
import { CertificatePicker, useSelectedCertificate } from '../../entities/signing';
import type { SignatureControls } from '../../entities/signing';
import { ConsentText } from './ConsentText';
import Heading from '@sber-site/sbercraft-nova-kit/components/Heading';
import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import { useBreakpoints } from '@sber-site/sbercraft-nova-kit/hooks/useBreakpoints';
import { ContentWrapper } from '../../shared/ui/ContentWrapper';

import { WorkActions } from '../../entities/signing';
export function TestSignature({
    response,
    certificates,
    busy,
    phase,
    onSign,
}: SignatureControls & {
    response: CheckResponse;
    phase?: 'signing' | 'sending';
}) {
    useStyles(css);
    const { isDesktop } = useBreakpoints();
    const { selected, selectCertificate } = useSelectedCertificate(certificates);
    const { title, message, buttons, consent } = response.screen;
    const blocked = busy || certificates.status === 'loading';
    let sign: (() => void) | undefined;
    if (selected && onSign) {
        sign = () => onSign(selected);
    }
    return (
        <ContentWrapper>
            <div className="sign_check">
                <div className="sign_check__main">
                    <Heading tag="h1" size={isDesktop ? 'h2' : 'h3'} className="sign_check__heading">
                        {title}
                    </Heading>
                    <Text className="sign_check__subheading">{message}</Text>
                    <CertificatePicker
                        className="sign_check__select"
                        certificates={certificates}
                        selected={selected}
                        onSelect={selectCertificate}
                        busy={blocked}
                    />
                </div>
                <WorkActions
                    className="sign_check__actions"
                    buttons={buttons}
                    busy={blocked}
                    loading={busy || phase !== undefined}
                    onAction={sign}
                />
                <ConsentText consent={consent} />
            </div>
        </ContentWrapper>
    );
}
