import { useEffect, useState } from 'react';
export function useBreakpoints() {
    const [isDesktop, setDesktop] = useState(
        () =>
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(min-width: 1024px)').matches,
    );
    useEffect(() => {
        if (typeof window.matchMedia !== 'function') {
            return undefined;
        }
        const query = window.matchMedia('(min-width: 1024px)');
        const update = () => setDesktop(query.matches);
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    return { isDesktop };
}
