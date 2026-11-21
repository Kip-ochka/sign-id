import type { SVGAttributes } from 'react';
type Props = SVGAttributes<SVGSVGElement> & {
  name: 'doc-file' | 'pdf-file' | 'default-file' | 'chevron-right-small';
  size?: string;
  theme?: 'ghost';
};
export default function Icon({ name, size = '24', theme, ...props }: Props) {
  if (name === 'chevron-right-small') {
    return (
      <svg
        data-theme={theme}
        {...props}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  const label = { 'doc-file': 'DOC', 'pdf-file': 'PDF', 'default-file': '' }[
    name
  ];
  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 2h9l5 5v15H5zM14 2v6h5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="6">
        {label}
      </text>
    </svg>
  );
}
