import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import { useState } from 'react';
import { useBreakpoints } from '@sber-site/sbercraft-nova-kit/hooks/useBreakpoints';

import ErrorIcon from '../../../assets/WARNING_STATUS.svg';
import { SettingItemProps } from './types';
import { useStyles } from '../../../../../LoaderContext';

import * as css from './SettingItem.css';

export const ErrorStatus = ({ message, description, textButton = '' }: SettingItemProps) => {
    const { isDesktop } = useBreakpoints();
    const [isShow, setIsShow] = useState(false);
    useStyles(css);

    return (
        <div className='sign_setting-item'>
            <div className='sign_setting-item__error'>
                <img className='sign_setting-item__icon' src={ErrorIcon} alt='Ошибка' />
                <Text tag='p' size={isDesktop ? 'md' : 'sm'} className='sign_setting-item__main-text'>
                    {message}
                </Text>
                <button
                    onClick={() => setIsShow(state => !state)}
                    type='button'
                    className='sign_settings-item__error-button'
                >
                    {textButton}
                </button>
            </div>
            {isShow ? (
                <Text size='sm' className='sign_setting-item__error-text'>
                    {description}
                </Text>
            ) : null}
        </div>
    );
};
