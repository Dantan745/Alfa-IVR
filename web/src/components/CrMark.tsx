import { useId } from "react";

/** Знак цифрового рубля: круг и рублёвая решётка. Цвет круга — бирюза приложения, не чужой плоский тил. */
export default function CrMark({ size = 64, title }: { size?: number; title?: string }) {
  const raw = useId().replace(/:/g, "");
  const grad = `cr-${raw}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={grad} x1="10" y1="2" x2="54" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3EE4DA" />
          <stop offset="1" stopColor="#087E7A" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${grad})`} />
      <g fill="none" stroke="#FFFFFF" strokeWidth="3.6" strokeLinecap="round">
        <circle cx="32" cy="32" r="16.6" />
        <path d="M32 15.4V48.6" />
        <path d="M15.4 33H48.6" />
        <path d="M32 24.4H48.6" />
      </g>
    </svg>
  );
}
