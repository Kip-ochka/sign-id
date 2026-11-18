import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import { useBreakpoints } from '@sber-site/sbercraft-nova-kit/hooks/useBreakpoints';

import WaitIcon from '../../../assets/WAIT_STATUS.svg';
import { SettingItemProps } from './types';
import { useStyles } from '../../../../../LoaderContext';

import * as css from './SettingItem.css';

export const WaitStatus = ({ message }: SettingItemProps) => {
    useStyles(css);
    const { isDesktop } = useBreakpoints();

    return (
        <div className='sign_setting-item'>
            <div className='sign_setting-item__main'>
                <img className='sign_setting-item__icon' src={WaitIcon} alt='Ожидание...' />
                <Text size={isDesktop ? 'md' : 'sm'} tag='p' className='sign_setting-item__main-text'>
                    {message}
                </Text>
            </div>
        </div>
    );
};
