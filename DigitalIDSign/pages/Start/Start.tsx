import Text from '@sber-site/sbercraft-nova-kit/components/Text';

import { useStyles } from '../../../../LoaderContext';
import { Loader } from '../../shared/ui/Loader';
import { ContentWrapper } from '../../shared/ui/ContentWrapper';

import * as css from './Start.css';

export const Start = () => {
    useStyles(css);

    return (
        <ContentWrapper>
            <div className='sign-intro'>
                <Loader />
                <Text className='sign-intro__text'>{'Идёт загрузка.\nПожалуйста, подождите'}</Text>
            </div>
        </ContentWrapper>
    );
};
