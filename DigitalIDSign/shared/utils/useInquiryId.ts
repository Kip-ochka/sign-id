import { useCallback } from 'react';

const key = 'digitalid_sign_inq';

export const useInquiryId = () => {
    return useCallback(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const inquiryId = urlParams.get('id');
        if (!inquiryId || inquiryId === '') {
            return localStorage.getItem(key) || '';
        }
        localStorage.setItem(key, inquiryId);

        return inquiryId;
    }, []);
};
