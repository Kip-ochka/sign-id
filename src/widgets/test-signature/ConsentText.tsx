import { Link } from '@sber-site/malachite-kit';
import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import type { Consent } from '../../shared/api';
import { httpUrl } from '../../shared/lib/httpUrl';
import * as css from './ConsentText.css';
export function ConsentText({ consent }: { consent: Consent }) {
    useStyles(css);
    const url = httpUrl(consent.url);
    if (!url || !consent.hypertext) {
        return (
            <Text tag="p" className="sign_check__agreement sign_check_agreement_padding">
                {consent.text}
            </Text>
        );
    }
    const start = consent.text.indexOf(consent.hypertext);
    const link = (
        <Link
            theme="secondary"
            className="sign_check__agreement sign_check__link"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
        >
            {consent.hypertext}
        </Link>
    );
    if (start < 0) {
        return (
            <Text tag="p" className="sign_check__agreement sign_check_agreement_padding">
                {consent.text} {link}
            </Text>
        );
    }
    return (
        <Text tag="p" className="sign_check__agreement sign_check_agreement_padding">
            {consent.text.slice(0, start)}
            {link}
            {consent.text.slice(start + consent.hypertext.length)}
        </Text>
    );
}
