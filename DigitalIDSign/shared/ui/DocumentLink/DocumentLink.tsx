import Icon from '@sber-site/malachite-kit/esm/components/Icon';
import Text from '@sber-site/sbercraft-nova-kit/components/Text';

import { useStyles } from '../../../../../LoaderContext';

import * as css from './DocumentLink.css';

type DocumentLinkProps = {
    format: 'DOC' | 'PDF' | 'OTHER';
    title: string;
};

const docFormat = {
    DOC: 'doc-file',
    PDF: 'pdf-file',
    OTHER: 'default-file',
};

export const DocumentLink = ({ format, title }: DocumentLinkProps) => {
    useStyles(css);
    return (
        <div className='document-link'>
            <Icon size='24' name={docFormat[format]} theme='ghost' />
            <Text tag='p' className='document-link__main-text'>
                {title}
            </Text>
            <Icon size='24' name='chevron-right-small' theme='ghost' />
        </div>
    );
};
