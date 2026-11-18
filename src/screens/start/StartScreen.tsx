import { ContentWrapper } from '../../shared/ui/ContentWrapper';
import { Loading } from '../../shared/ui/Loading';
export function StartScreen() {
  return (
    <ContentWrapper>
      <Loading>{'Идёт загрузка.\nПожалуйста, подождите'}</Loading>
    </ContentWrapper>
  );
}
