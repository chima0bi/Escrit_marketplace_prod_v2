import { useTheme } from '../lib/ThemeContext.jsx';
import { SunIcon, MoonIcon, SystemIcon } from './icons.jsx';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
  { value: 'system', label: 'System', Icon: SystemIcon },
];

// Three-way control: "system" is a real third state and can differ from
// light or dark, so it is not hidden behind a two-state switch.
export default function ThemeToggle({ className = '' }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={`inline-flex items-center border border-line rounded-full p-0.5 ${className}`}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => setTheme(value)}
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
              active ? 'bg-ink text-paper' : 'text-ink/45 hover:text-ink/80'
            }`}
          >
            <Icon width={14} height={14} />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
