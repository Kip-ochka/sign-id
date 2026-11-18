import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import { ContentWrapper } from '../../shared/ui/ContentWrapper';
import { Loading } from '../../shared/ui/Loading';
import * as css from './StartScreen.css';
export function StartScreen() {
  useStyles(css);
  return (
    <ContentWrapper>
      <div className="sign-intro" role="status">
        <Loading />
        <Text className="sign-intro__text">
          {'Идёт загрузка.\nПожалуйста, подождите'}
        </Text>
      </div>
    </ContentWrapper>
  );
}
