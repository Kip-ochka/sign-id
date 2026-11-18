import { QueryClient } from 'react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 0,
            retry: 0,
            cacheTime: 0,
        },
        mutations: {
            retry: 0,
        },
    },
});
