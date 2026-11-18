import { FC } from 'react';
import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import Heading from '@sber-site/sbercraft-nova-kit/components/Heading';
import Button from '@sber-site/malachite-kit/esm/components/Button';
import { useBreakpoints } from '@sber-site/sbercraft-nova-kit/hooks/useBreakpoints';

import { useStyles } from '../../../../LoaderContext';
import { ContentWrapper } from '../../shared/ui/ContentWrapper';
import { SettingItem } from '../../shared/ui/SettingItem/SettingItem';

import * as css from './Settings.css';

type Props = {
    isInitial?: boolean;
};

export const Setting: FC<Props> = () => {
    useStyles(css);
    const { isDesktop } = useBreakpoints();

    return (
        <ContentWrapper>
            <div className='sign_setting'>
                <div className='sign_setting__main'>
                    <Heading size={isDesktop ? 'h2' : 'h3'} className='sign_setting__heading'>
                        Проверьте рабочее место
                    </Heading>
                    <Text className='sign_setting__subheading'>
                        Убедитесь, что всё готово для подписания документов
                    </Text>
                    <SettingItem
                        status='WAIT'
                        message='Ждем с длинным текстом, что бы отработать оверлап с тремя точками'
                        description='Покажу но потом'
                        textButton='Подробнее'
                    />
                    <SettingItem
                        status='SUCCESS'
                        message='Успех с длинным текстом, что бы отработать оверлап с тремя точками'
                        description='Покажу но потом'
                        textButton='Подробнее'
                    />
                    <SettingItem
                        status='ERROR'
                        message='Ошибка с длинным текстом, что бы отработать оверлап с тремя точками'
                        description='Покажу но потом11'
                        textButton='Подробнее'
                    />
                </div>
                <Button className='sign_setting__button-secondary' theme='primary' size='large' type='button'>
                    Запустить проверку
                </Button>
            </div>
        </ContentWrapper>
    );
};
