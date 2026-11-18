import { FC, useRef } from 'react';
import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import Heading from '@sber-site/sbercraft-nova-kit/components/Heading';
import Button from '@sber-site/malachite-kit/esm/components/Button';
import Select from '@sber-site/malachite-kit/esm/components/Select';
import Typography from '@sber-site/malachite-kit/esm/components/Typography';
import { useBreakpoints } from '@sber-site/sbercraft-nova-kit/hooks/useBreakpoints';

import { useStyles } from '../../../../LoaderContext';
import { ContentWrapper } from '../../shared/ui/ContentWrapper';
import { DocumentLink } from '../../shared/ui/DocumentLink';

import * as css from './Signing.css';

type Props = {
    isInitial?: boolean;
};

export const Signing: FC<Props> = () => {
    useStyles(css);
    const ref = useRef<HTMLInputElement>(null);

    const { isDesktop } = useBreakpoints();

    return (
        <ContentWrapper>
            <div className='sign_signing'>
                <div className='sign_signing__main'>
                    <div className='sign_signinig_stepper'>
                        <Typography.Paragraph>Шаг 1 из 4</Typography.Paragraph>
                    </div>
                    <Heading size={isDesktop ? 'h2' : 'h3'} className='sign_signing__heading'>
                        Подпишите документы
                    </Heading>
                    <Text className='sign_signing__subheading'>Ознакомьтесь с документами и поставьте подпись</Text>
                    <Select
                        className='sign_signing__select'
                        autoFocus={false}
                        name='check'
                        required={false}
                        defaultValue={null}
                        placeholder='Выберите сертификат'
                        inputRef={ref}
                        autoComplete='none'
                        data={[{ id: '1', value: '1', text: 'SHIT' }]}
                    />
                    <div className='sign_signing__document-wrapper'>
                        <DocumentLink format='DOC' title='JOPA' />
                        <DocumentLink
                            format='DOC'
                            title='Очень длинный текст пизда какой длинный текст, я должен не видеть этот длинный текст, РАДИ ВСЕГО СВЯТОГО НЕ СМОТРИ НА ЭТОТ ДЛИННЫЙ ТЕКСТ САША КРАСИВАЯ'
                        />
                        <DocumentLink format='PDF' title='JOPA' />
                        <DocumentLink format='OTHER' title='JOPA' />
                        <DocumentLink format='DOC' title='JOPA' />
                        <DocumentLink format='DOC' title='JOPA' />
                        <DocumentLink format='DOC' title='JOPA' />
                    </div>
                </div>
                <Button className='sign_signing__button-secondary' theme='primary' size='large' type='button'>
                    Подтвердить
                </Button>
            </div>
        </ContentWrapper>
    );
};
