/**
 * A small inline icon set.
 *
 * Inline rather than an icon package: the demo ships five kilobytes of SVG it
 * actually uses, instead of a dependency it uses two per cent of — and an SVG
 * tool that pulled in an icon font would be a poor advertisement for itself.
 */
export type IconName =
  | 'group'
  | 'path'
  | 'shape'
  | 'text'
  | 'image'
  | 'unknown'
  | 'eye'
  | 'eyeOff'
  | 'chevron'
  | 'upload'
  | 'zoomIn'
  | 'zoomOut'
  | 'fit'
  | 'copy'
  | 'download'
  | 'search'
  | 'close'
  | 'alert'
  | 'info'
  | 'error'
  | 'reset';

const PATHS: Record<IconName, string> = {
  group: 'M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 2h4.5A1.5 1.5 0 0 1 14 6.5v5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5z',
  path: 'M3 13c0-5 3-8 5-8s2 3 5 3M3 13H2m1 0h1m9-5h-1m1 0h1',
  shape: 'M3 3.5h10v9H3z',
  text: 'M4 4h8M8 4v8M6.5 12h3',
  image: 'M2.5 3.5h11v9h-11zM2.5 10l3-3 3 3M9 8.5l1.5-1.5 3 3M10.5 6.2h.01',
  unknown: 'M8 11.5h.01M6.2 6a1.9 1.9 0 1 1 2.4 2.3c-.4.2-.6.5-.6.9v.3',
  eye: 'M1.5 8S3.9 3.8 8 3.8 14.5 8 14.5 8 12.1 12.2 8 12.2 1.5 8 1.5 8z M9.7 8a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0z',
  eyeOff: 'M6.6 4a5.9 5.9 0 0 1 1.4-.2c4.1 0 6.5 4.2 6.5 4.2a11 11 0 0 1-1.8 2.4M4 4.9A11 11 0 0 0 1.5 8S3.9 12.2 8 12.2c1 0 1.9-.2 2.7-.6M2 2l12 12',
  chevron: 'M6 4l4 4-4 4',
  upload: 'M8 11V2.5M4.8 5.7 8 2.5l3.2 3.2M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2',
  zoomIn: 'M7.2 12.4a5.2 5.2 0 1 0 0-10.4 5.2 5.2 0 0 0 0 10.4zM14 14l-3.1-3.1M5.2 7.2h4M7.2 5.2v4',
  zoomOut: 'M7.2 12.4a5.2 5.2 0 1 0 0-10.4 5.2 5.2 0 0 0 0 10.4zM14 14l-3.1-3.1M5.2 7.2h4',
  fit: 'M2.5 6V3.5a1 1 0 0 1 1-1H6M10 2.5h2.5a1 1 0 0 1 1 1V6M13.5 10v2.5a1 1 0 0 1-1 1H10M6 13.5H3.5a1 1 0 0 1-1-1V10',
  copy: 'M5.5 5.5V3.6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1.9M3.5 5.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z',
  download: 'M8 2.5V11M4.8 7.8 8 11l3.2-3.2M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2',
  search: 'M7.2 12.4a5.2 5.2 0 1 0 0-10.4 5.2 5.2 0 0 0 0 10.4zM14 14l-3.1-3.1',
  close: 'M4 4l8 8M12 4l-8 8',
  alert: 'M8 2.8 1.8 13.2h12.4zM8 6.6v3M8 11.4h.01',
  info: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM8 7.5v3.2M8 5.3h.01',
  error: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM5.9 5.9l4.2 4.2M10.1 5.9l-4.2 4.2',
  reset: 'M13.5 8a5.5 5.5 0 1 1-1.7-4M13.5 2.5V6H10',
};

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 16, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
