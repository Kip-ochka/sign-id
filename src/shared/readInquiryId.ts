export const readInquiryId = (search: string) => {
    const ids = new URLSearchParams(search).getAll('id');
    return ids.length === 1 && ids[0].trim().length > 0 ? ids[0] : '';
};
