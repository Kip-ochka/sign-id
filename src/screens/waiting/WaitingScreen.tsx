import { Loading } from '../shared/Loading';
import { ScreenCard } from '../shared/ScreenCard';

export function WaitingScreen() {
  return (
    <ScreenCard title="Ожидаем результат обработки">
      <Loading>Пожалуйста, подождите</Loading>
    </ScreenCard>
  );
}
