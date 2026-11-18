import LoaderSvg from '../../../assets/loader.svg';
import {useStyles} from "../../../../../LoaderContext";

import * as css from './Loader.css';

export const Loader = () => {
    useStyles(css);
    return (
        <div className='sign-loader-wrapper'>
            <img src={LoaderSvg} alt='Загрузка...' />
        </div>
    );
};
