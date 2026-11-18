import { ContentWrapper } from '../../shared/ui/ContentWrapper';
import { Loading } from '../../shared/ui/Loading';

export function WaitingScreen() {
  return (
    <ContentWrapper>
      <Loading>{'Ожидаем результат обработки.\nПожалуйста, подождите'}</Loading>
    </ContentWrapper>
  );
}
