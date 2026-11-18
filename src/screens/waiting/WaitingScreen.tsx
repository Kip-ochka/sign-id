import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import { ContentWrapper } from '../../shared/ui/ContentWrapper';
import { Loading } from '../../shared/ui/Loading';
import * as css from './WaitingScreen.css';
export function WaitingScreen() {
  useStyles(css);
  return (
    <ContentWrapper>
      <div className="sign-intro" role="status">
        <Loading />
        <Text className="sign-intro__text">
          {'Ожидаем результат обработки.\nПожалуйста, подождите'}
        </Text>
      </div>
    </ContentWrapper>
  );
}
