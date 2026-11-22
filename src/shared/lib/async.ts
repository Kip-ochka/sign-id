const maxTimerDelay = 2_147_483_647;

export function schedule(callback: () => void, milliseconds: number) {
    let timer: ReturnType<typeof setTimeout>;
    function next(remaining: number) {
        const delay = Math.min(remaining, maxTimerDelay);
        timer = setTimeout(() => {
            if (remaining > delay) {
                next(remaining - delay);
            } else {
                callback();
            }
        }, delay);
    }
    next(milliseconds);
    return () => clearTimeout(timer);
}

export function wait(milliseconds: number, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        signal.throwIfAborted();
        const cancel = schedule(() => {
            signal.removeEventListener('abort', abort);
            resolve();
        }, milliseconds);
        function abort() {
            cancel();
            reject(signal.reason);
        }
        signal.addEventListener('abort', abort, { once: true });
    });
}
