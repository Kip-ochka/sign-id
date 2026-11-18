import { useCallback, useLayoutEffect, useRef } from 'react';

import type { ScreenButtonAction } from '../shared/api';
import type { DisplayScreen } from './model';
import { schedule } from './network';

type StatusButton = 'accent' | 'secondary';

function resolveAction(button?: ScreenButtonAction) {
  if (!button) return;
  if (button.url === undefined) {
    if (button.process === 'BACK') return { type: 'back' } as const;
    return;
  }
  if (button.process !== undefined || !/^https?:\/\//i.test(button.url)) return;
  try {
    return { type: 'url', url: new URL(button.url).href } as const;
  } catch {
    return;
  }
}

export function canActivate(button: ScreenButtonAction) {
  return resolveAction(button) !== undefined;
}

// Кнопки STATUS и таймер SUCCESS используют одно действие.
export function useStatusActions(
  screen: DisplayScreen,
  back: (manual: boolean) => void | Promise<void>,
) {
  const actionTaken = useRef(false);
  const cancelTimer = useRef<() => void>();

  const activate = useCallback(
    (slot: StatusButton, manual = true) => {
      if (screen.process !== 'STATUS' || actionTaken.current) return;
      const action = resolveAction(screen.screen.buttons?.[slot]);
      if (!action) return;
      // Клик и таймер могут сработать подряд до того, как React сменит экран.
      actionTaken.current = true;
      cancelTimer.current?.();
      if (action.type === 'back') return back(manual);
      // Q-11: полный URL открывает внешний процесс. Внутренние экраны меняет Context.
      window.location.assign(action.url);
    },
    [back, screen],
  );

  useLayoutEffect(() => {
    actionTaken.current = false;
  }, [screen]);

  useLayoutEffect(() => {
    if (
      screen.process !== 'STATUS' ||
      screen.screen.level !== 'SUCCESS' ||
      screen.timer === undefined ||
      actionTaken.current ||
      !resolveAction(screen.screen.buttons?.accent)
    )
      return;

    const cancel = schedule(() => activate('accent', false), screen.timer);
    cancelTimer.current = cancel;
    return cancel;
  }, [activate, screen]);

  return activate;
}
