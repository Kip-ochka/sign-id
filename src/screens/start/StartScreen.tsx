import { Loading } from '../../shared/ui/Loading';
import { ScreenCard } from '../../shared/ui/ScreenCard';

export function StartScreen() {
  return (
    <ScreenCard title="Подготавливаем подписание">
      <Loading>Пожалуйста, подождите</Loading>
    </ScreenCard>
  );
}
