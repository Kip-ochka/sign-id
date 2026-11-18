import { FC, useRef } from 'react';
import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import Heading from '@sber-site/sbercraft-nova-kit/components/Heading';
import Button from '@sber-site/malachite-kit/esm/components/Button';
import Select from '@sber-site/malachite-kit/esm/components/Select';
import { useBreakpoints } from '@sber-site/sbercraft-nova-kit/hooks/useBreakpoints';
import { Link } from '@sber-site/malachite-kit';

import { useStyles } from '../../../../LoaderContext';
import { ContentWrapper } from '../../shared/ui/ContentWrapper';

import * as css from './Check.css';

type Props = {
    isInitial?: boolean;
};

export const Check: FC<Props> = () => {
    const ref = useRef<HTMLInputElement>(null);
    useStyles(css);
    const { isDesktop } = useBreakpoints();

    return (
        <ContentWrapper>
            <div className='sign_check'>
                <div className='sign_check__main'>
                    <Heading size={isDesktop ? 'h2' : 'h3'} className='sign_check__heading'>
                        Подтвердите владение ключом ЭП
                    </Heading>
                    <Text className='sign_check__subheading'>Чтобы получить доступ к документам для подписания</Text>
                    <Select
                        className='sign_check__select'
                        autoFocus={false}
                        name='check'
                        required={false}
                        defaultValue={undefined}
                        placeholder='Выберите сертификат'
                        inputRef={ref}
                        autoComplete='none'
                        data={[{ id: '1', value: '1', text: 'SHIT' }]}
                    />
                </div>
                <Button className='sign_check__button-secondary' theme='primary' size='large' type='button'>
                    Подтвердить
                </Button>
                <Text tag='p' className='sign_check__agreement sign_check_agreement_padding'>
                    Нажимая на кнопку, я даю своё{' '}
                    <Link theme='secondary' className='sign_check__agreement sign_check__link' href='www.google.com'>
                        согласие на взаимодействие и обработку персональных данных
                    </Link>
                </Text>
            </div>
        </ContentWrapper>
    );
};
