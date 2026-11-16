import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import type { DisplayScreen } from './model';
import { useSigningProcess } from './ProcessContext';

type Process = DisplayScreen['process'];

interface SigningNavigation {
  current: DisplayScreen;
  from?: Process;
  target?: Process;
  backTo: Process;
  back: () => void | Promise<void>;
}

const NavigationContext = createContext<SigningNavigation | undefined>(
  undefined,
);

// Берёт навигацию из состояния заявки. target отражает ответ сервера, current — видимый экран.
export function NavigationProvider({ children }: { children: ReactNode }) {
  const {
    state,
    commands: { back },
  } = useSigningProcess();
  const { screen, previousProcess, backScreen, lastResponse } = state;
  const target =
    lastResponse && ('task' in lastResponse ? 'WAITING' : lastResponse.process);
  const navigation = useMemo<SigningNavigation>(
    () => ({
      current: screen,
      from: previousProcess,
      target,
      // После ожидания или ошибки BACK ведёт к последнему рабочему экрану.
      backTo: backScreen?.process ?? 'START',
      back,
    }),
    [screen, previousProcess, backScreen, target, back],
  );

  return (
    <NavigationContext.Provider value={navigation}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useSigningNavigation() {
  const navigation = useContext(NavigationContext);
  if (!navigation)
    throw new Error('Навигация доступна только внутри NavigationProvider');
  return navigation;
}
