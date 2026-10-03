import { memo } from 'react';
import appIcon from '../assets/icon.png';
import { useLanguage } from '../context/LanguageContext';
import { cn } from "../lib/utils";

export const Header = memo(function Header({ currentView = 'studio', onNavigate }) {
  const { t } = useLanguage();

  return (
    <header className={cn('w-full', 'bg-transparent', 'transition-colors')}>
      <div className={cn('mx-auto', 'flex', 'h-14', 'max-w-5xl', 'items-center', 'justify-between', 'px-4', 'sm:px-6')}>
        {/* Left: Clean Brand Logo */}
        <div className={cn('flex', 'items-center', 'gap-2.5')}>
          <img
            src={appIcon}
            alt="OmniShift"
            className={cn('h-6', 'w-6', 'object-contain')}
          />
          <span className={cn('text-sm', 'font-semibold', 'tracking-tight', 'text-[var(--text-primary)]')}>
            OmniShift
          </span>
        </div>

        {/* Center/Right: Navigation & GitHub */}
        <div className={cn('flex', 'items-center', 'gap-3')}>
          {/* Navigation Links */}
          <nav className={cn('flex', 'items-center', 'gap-1', 'rounded-lg', 'bg-[var(--bg-surface-2)]', 'p-1', 'border', 'border-[var(--border-subtle)]')}>
            <button
              type="button"
              onClick={() => onNavigate?.('studio')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                currentView === 'studio'
                  ? 'bg-[#FF5A1F] text-black shadow-2xs'
                  : 'text-[var(--text-muted)] hover:text-[#FF5A1F]'
              }`}
            >
              {t('studio')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('guide')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                currentView === 'guide'
                  ? 'bg-[#FF5A1F] text-black shadow-2xs'
                  : 'text-[var(--text-muted)] hover:text-[#FF5A1F]'
              }`}
            >
              {t('guide')}
            </button>
          </nav>

          {/* GitHub Link */}
          <a
            href="https://github.com/KamalAboueidd/omniShift"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source repository"
            className={cn('flex', 'h-8', 'w-8', 'items-center', 'justify-center', 'rounded-md', 'text-[var(--text-muted)]', 'hover:text-[#FF5A1F]', 'transition-colors')}
          >
            <svg
              className={cn('h-4', 'w-4', 'fill-current')}
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
