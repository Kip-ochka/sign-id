import { useCallback, useLayoutEffect, useRef } from 'react';

import type { ScreenButtonAction } from '../../shared/api';
import type { DisplayScreen } from '../../entities/signing';
import { schedule } from '../../shared/lib/async';

type StatusButton = 'accent' | 'secondary';

function resolveAction(button?: ScreenButtonAction) {
  if (!button) {
    return undefined;
  }
  if (button.url === undefined) {
    if (button.process === 'BACK') {
      return { type: 'back' } as const;
    }
    return undefined;
  }
  if (button.process !== undefined || !/^https?:\/\//i.test(button.url)) {
    return undefined;
  }
  try {
    return { type: 'url', url: new URL(button.url).href } as const;
  } catch {
    return undefined;
  }
}

export function canActivate(button: ScreenButtonAction) {
  return resolveAction(button) !== undefined;
}

// Кнопки STATUS и таймер SUCCESS используют одно действие.
export function useStatusActions(
  screen: DisplayScreen,
  back: () => void | Promise<void>,
) {
  const actionTaken = useRef(false);
  const cancelTimer = useRef<() => void>();

  const activate = useCallback(
    (slot: StatusButton) => {
      if (screen.process !== 'STATUS' || actionTaken.current) {
        return undefined;
      }
      const action = resolveAction(screen.screen.buttons?.[slot]);
      if (!action) {
        return undefined;
      }
      // Клик и таймер могут сработать подряд до того, как React сменит экран.
      actionTaken.current = true;
      cancelTimer.current?.();
      if (action.type === 'back') {
        return back();
      }
      window.location.assign(action.url);
      return undefined;
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
    ) {
      return undefined;
    }

    const cancel = schedule(() => activate('accent'), screen.timer);
    cancelTimer.current = cancel;
    return cancel;
  }, [activate, screen]);

  return activate;
}
