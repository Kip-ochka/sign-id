import type { ReactNode } from 'react';
import loader from '../assets/loader.svg';
import * as css from './Screen.css';
export function Loading({ children }: { children: ReactNode }) {
  useStyles(css);
  return (
    <span className="loading" role="status">
      <img className="spinner" src={loader} alt="" />
      {children}
    </span>
  );
}
