interface HouseProps {
  /** Body colour, set per stop. */
  color: string;
}

/** Decorative house drawing used on the How it works road. */
export function HouseIcon({ color }: HouseProps) {
  return (
    <svg
      className="house"
      width="120"
      height="112"
      viewBox="0 0 120 112"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="10"
        y="48"
        width="100"
        height="62"
        rx="4"
        fill={color}
        stroke="#2b1d12"
        strokeWidth="2"
      />
      <polygon
        points="60,2 118,50 2,50"
        fill="#c2512f"
        stroke="#2b1d12"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="50" y="78" width="20" height="32" rx="3" fill="#2b1d12" />
      <rect
        x="20"
        y="62"
        width="20"
        height="18"
        rx="2"
        fill="#fffcf7"
        stroke="#2b1d12"
        strokeWidth="1.5"
      />
      <rect
        x="80"
        y="62"
        width="20"
        height="18"
        rx="2"
        fill="#fffcf7"
        stroke="#2b1d12"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** Decorative top-down car, heading down the page. */
export function CarIcon() {
  return (
    <svg
      className="car"
      width="34"
      height="62"
      viewBox="0 0 34 62"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0" y="10" width="5" height="12" rx="2" fill="#2b1d12" />
      <rect x="29" y="10" width="5" height="12" rx="2" fill="#2b1d12" />
      <rect x="0" y="40" width="5" height="12" rx="2" fill="#2b1d12" />
      <rect x="29" y="40" width="5" height="12" rx="2" fill="#2b1d12" />
      <rect
        x="2"
        y="2"
        width="30"
        height="58"
        rx="10"
        fill="#c2512f"
        stroke="#2b1d12"
        strokeWidth="2"
      />
      <rect x="6" y="8" width="22" height="8" rx="3" fill="#f1d3c8" />
      <rect x="6" y="30" width="22" height="14" rx="4" fill="#fff3dc" />
      <rect x="6" y="54" width="6" height="4" rx="2" fill="#ffd27a" />
      <rect x="22" y="54" width="6" height="4" rx="2" fill="#ffd27a" />
    </svg>
  );
}
