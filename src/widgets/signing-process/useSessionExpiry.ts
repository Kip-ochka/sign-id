import { useLayoutEffect } from 'react';
import { sessionStorage } from '../../entities/signing';
import type { ProcessState } from '../../entities/signing';
import type { UpdateProcess } from '../../entities/signing';
import { schedule } from '../../shared/lib/async';

export function useSessionExpiry(state: ProcessState, setState: UpdateProcess) {
  useLayoutEffect(() => {
    const session = state.session;
    if (!session) {
      return undefined;
    }
    const entry = sessionStorage.readEntry();
    let cancel: () => void;
    const expire = () => {
      const current = sessionStorage.readEntry();
      // Повторный SETTING может продлить срок даже для прежнего session id.
      if (current?.id === session) {
        cancel = schedule(expire, Math.max(0, current.expiresAt - Date.now()));
        return;
      }
      setState((previous) =>
        previous.session === session
          ? { ...previous, session: current?.id }
          : previous,
      );
    };
    cancel = schedule(
      expire,
      Math.max(0, (entry?.expiresAt ?? Date.now()) - Date.now()),
    );
    return () => cancel();
  }, [state.session, state.lastResponse, setState]);
}
