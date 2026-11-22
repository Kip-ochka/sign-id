import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import { ContentWrapper } from '../ContentWrapper';
import { Loading } from '../Loading';
import * as css from './LoadingScreen.css';
export function LoadingScreen() {
    useStyles(css);
    return (
        <ContentWrapper>
            <div className="sign-intro" role="status">
                <Loading />
                <Text className="sign-intro__text">{'Идёт загрузка.\nПожалуйста, подождите'}</Text>
            </div>
        </ContentWrapper>
    );
}
