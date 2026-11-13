interface ChevronIconProps {
  /** Points up instead of down (used when a section is expanded). */
  up?: boolean;
}

export default function ChevronIcon({ up = false }: ChevronIconProps) {
  return (
    <svg
      className={up ? 'chevron chevron--up' : 'chevron'}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
