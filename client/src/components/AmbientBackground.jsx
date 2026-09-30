import { useMemo } from 'react';

// Decorative only: a few faint brand marks that drift and fade behind the
// page. Fixed, non-interactive and very low opacity, so they never compete
// with content.
const COUNT = 4;

function seededMarks(count) {
  // Generated once per page load so marks do not jump on re-render.
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    top: `${Math.round(Math.random() * 80)}%`,
    left: `${Math.round(Math.random() * 80)}%`,
    size: 70 + Math.round(Math.random() * 70), // 70–140px
    duration: 28 + Math.round(Math.random() * 20), // 28–48s — slow, ambient
    delay: -Math.round(Math.random() * 30), // negative = already mid-cycle on load
    // vw/vh units keep the drift proportional on any screen size.
    driftX: Math.round((Math.random() - 0.5) * 36), // vw
    driftY: Math.round((Math.random() - 0.5) * 28), // vh
    // Kept faint; tokens.css scales this up slightly in light mode.
    maxOpacity: 0.035 + Math.random() * 0.025, // 0.035–0.06 (pre-multiplier)
  }));
}

export default function AmbientBackground() {
  const marks = useMemo(() => seededMarks(COUNT), []);

  return (
    <div aria-hidden="true" className="fixed inset-0 overflow-hidden">
      {marks.map((m) => (
        <svg
          key={m.id}
          // Brand amber reads better at low opacity than plain ink.
          className="ambient-mark text-seal"
          viewBox="0 0 100 100"
          width={m.size}
          height={m.size}
          style={{
            top: m.top,
            left: m.left,
            '--drift-duration': `${m.duration}s`,
            '--drift-delay': `${m.delay}s`,
            '--drift-x': `${m.driftX}vw`,
            '--drift-y': `${m.driftY}vh`,
            '--drift-max-opacity': m.maxOpacity,
          }}
        >
          {/* Simplified shield + dollar mark, echoing the logo. */}
          <path
            d="M50 6 L86 20 V48 C86 74 70 90 50 96 C30 90 14 74 14 48 V20 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M50 26 V78 M40 36 a10 8 0 0 1 20 -1 a10 8 0 0 1 -20 8 a10 8 0 0 0 20 8 a10 8 0 0 1 -20 -1"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      ))}
    </div>
  );
}
