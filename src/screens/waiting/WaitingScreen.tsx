import { Loading } from '../../shared/ui/Loading';
import { ScreenCard } from '../../shared/ui/ScreenCard';

export function WaitingScreen() {
  return (
    <ScreenCard title="Ожидаем результат обработки">
      <Loading>Пожалуйста, подождите</Loading>
    </ScreenCard>
  );
}
