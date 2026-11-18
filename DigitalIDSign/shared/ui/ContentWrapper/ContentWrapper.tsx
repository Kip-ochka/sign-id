import { ReactNode } from 'react';

import { useStyles } from '../../../../../LoaderContext';

import * as css from './ContentWrapper.css';

export const ContentWrapper = ({ children }: { children: ReactNode }) => {
    useStyles(css);
    return (
        <div className='sign'>
            <div className='sign-content'>{children}</div>
        </div>
    );
};
