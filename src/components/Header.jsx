import { memo, useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import appIcon from '../assets/icon.png';

export const Header = memo(function Header({
  onOpenArchitecture,
}) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('omnishift-theme');
      if (stored) return stored;
      return document.documentElement.classList.contains('light') ? 'light' : 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    localStorage.setItem('omnishift-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border-color)] bg-[var(--bg-canvas)]/90 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Left: Brand & Engine Alpha Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src={appIcon}
              alt="OmniShift"
              className="h-6 w-6 object-contain"
            />
            <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
              OmniShift
            </span>
          </div>

          <span className="hidden sm:inline-flex items-center rounded border border-[var(--border-color)] bg-[var(--bg-surface-1)] px-2 py-0.5 text-[11px] font-mono text-[var(--text-muted)]">
            v0.1.0-alpha
          </span>
        </div>

        {/* Right: Actions, Theme Switcher & GitHub */}
        <div className="flex items-center gap-3">
          {/* Architecture Blueprint Trigger */}
          <button
            type="button"
            onClick={onOpenArchitecture}
            className="hidden sm:inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-surface-1)] px-2.5 py-1 text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)] transition-colors"
          >
            <span>Architecture &amp; Security</span>
          </button>

          {/* Theme Toggle (Sun / Moon) - Clean ghost button, no border or bg */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="flex h-8 w-8 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" strokeWidth={1.25} />
            ) : (
              <Moon className="h-4 w-4" strokeWidth={1.25} />
            )}
          </button>

          {/* GitHub Link Indicator - Clean ghost button, no border or bg */}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source repository"
            className="flex h-8 w-8 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg
              className="h-4 w-4 fill-current"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
});
