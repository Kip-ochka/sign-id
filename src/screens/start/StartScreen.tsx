import { Loading } from '../shared/Loading';
import { ScreenCard } from '../shared/ScreenCard';

export function StartScreen() {
  return (
    <ScreenCard title="Подготавливаем подписание">
      <Loading>Пожалуйста, подождите</Loading>
    </ScreenCard>
  );
}
