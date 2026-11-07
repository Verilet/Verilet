interface ChevronIconProps {
  /** Points up instead of down (used when a section is expanded). */
  up?: boolean;
}

// TODO: swap for the exported "icon/chevron" SVG from Figma. The Figma asset host was blocked in the
// environment this was built in, so this is a stand-in with the same 16x16 box.
export default function ChevronIcon({ up = false }: ChevronIconProps) {
  return (
    <svg
      className="chevron"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={up ? { transform: 'rotate(180deg)' } : undefined}
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
