import loader from '../../assets/loader.svg';
import * as css from './Loading.css';
export function Loading() {
  useStyles(css);
  return (
    <div className="sign-loader-wrapper">
      <img src={loader} alt="Загрузка..." />
    </div>
  );
}
