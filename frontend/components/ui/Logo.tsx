/** Parlascanned logo: magnifying glass with parliament hemicycle inside. */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Magnifying glass ring */}
      <circle cx="10.5" cy="10.5" r="7" stroke="white" strokeWidth="1.8" />
      {/* Handle */}
      <line
        x1="16"
        y1="16"
        x2="20.5"
        y2="20.5"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Parliament hemicycle — 3 members in a slight arc */}
      <circle cx="7.5" cy="11.5" r="1.6" fill="white" />
      <circle cx="10.5" cy="8" r="1.6" fill="white" />
      <circle cx="13.5" cy="11.5" r="1.6" fill="white" />
    </svg>
  );
}
