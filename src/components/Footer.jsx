import { useState, useRef, useEffect, memo } from 'react';
import { Sun, Moon, Laptop, Globe } from 'lucide-react';
import appIcon from '../assets/icon.png';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export const Footer = memo(function Footer() {
  const { t, toggleLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const themeMenuRef = useRef(null);

  // Close theme popover when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) {
        setIsThemeOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsThemeOpen(false);
      }
    }

    if (isThemeOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isThemeOpen]);

  const activeThemeIcon = {
    light: <Sun className="h-3.5 w-3.5" />,
    dark: <Moon className="h-3.5 w-3.5" />,
    system: <Laptop className="h-3.5 w-3.5" />,
  }[theme] || <Laptop className="h-3.5 w-3.5" />;

  return (
    <footer className="w-full mt-20 sm:mt-28 border-t border-[var(--border-subtle)] bg-[var(--bg-canvas)] py-6 text-center transition-colors">
      <div className="mx-auto flex max-w-5xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 text-xs text-[var(--text-muted)]">
        {/* Left: Brand */}
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <img src={appIcon} alt="OmniShift" className="h-4 w-4 object-contain" />
          <span className="font-semibold text-[var(--text-primary)]">OmniShift</span>
        </div>

        {/* Right: Theme Popover & Borderless Language Switcher */}
        <div className="flex items-center gap-4">
          {/* Theme Dropdown / Popover */}
          <div className="relative" ref={themeMenuRef}>
            <button
              type="button"
              onClick={() => setIsThemeOpen((prev) => !prev)}
              aria-label="Theme options"
              aria-haspopup="true"
              aria-expanded={isThemeOpen}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono text-[var(--text-muted)] hover:text-[#FF5A1F] transition-colors cursor-pointer bg-transparent border-none"
            >
              {activeThemeIcon}
              <span className="capitalize">{t(`theme${theme.charAt(0).toUpperCase() + theme.slice(1)}`)}</span>
            </button>

            {isThemeOpen && (
              <div
                role="menu"
                className="absolute bottom-full mb-2 end-0 z-50 min-w-[130px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-1)] p-1 shadow-xl backdrop-blur-md"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setTheme('light');
                    setIsThemeOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors bg-transparent text-left rtl:text-right cursor-pointer ${
                    theme === 'light'
                      ? 'text-[#FF5A1F] font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[#FF5A1F]'
                  }`}
                >
                  <Sun className="h-3.5 w-3.5 shrink-0" />
                  <span>{t('themeLight')}</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setTheme('dark');
                    setIsThemeOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors bg-transparent text-left rtl:text-right cursor-pointer ${
                    theme === 'dark'
                      ? 'text-[#FF5A1F] font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[#FF5A1F]'
                  }`}
                >
                  <Moon className="h-3.5 w-3.5 shrink-0" />
                  <span>{t('themeDark')}</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setTheme('system');
                    setIsThemeOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors bg-transparent text-left rtl:text-right cursor-pointer ${
                    theme === 'system'
                      ? 'text-[#FF5A1F] font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[#FF5A1F]'
                  }`}
                >
                  <Laptop className="h-3.5 w-3.5 shrink-0" />
                  <span>{t('themeSystem')}</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-3.5 w-[1px] bg-[var(--border-color)]" />

          {/* Borderless & Backgroundless Language Switcher */}
          <button
            type="button"
            onClick={toggleLang}
            aria-label="Toggle language"
            className="flex items-center gap-1.5 px-1 py-1 text-xs font-mono text-[var(--text-muted)] hover:text-[#FF5A1F] transition-colors cursor-pointer bg-transparent border-none"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>{t('langToggle')}</span>
          </button>
        </div>
      </div>
    </footer>
  );
});
