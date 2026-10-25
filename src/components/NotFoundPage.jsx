import { useEffect, memo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../lib/utils';
import appIcon from '../assets/icon.png';

export const NotFoundPage = memo(function NotFoundPage({ onReturnToStudio }) {
  const { t } = useLanguage();

  // Listen for Escape or Enter key to return smoothly to studio
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        onReturnToStudio?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onReturnToStudio]);

  return (
    <div className={cn('w-full', 'max-w-3xl', 'mx-auto', 'px-4', 'sm:px-6', 'py-20', 'flex', 'flex-col', 'items-center', 'justify-center', 'text-center')}>
      {/* Background Ambient Glow */}
      <div className="relative flex flex-col items-center w-full">
        <div
          className="absolute -top-16 -z-10 h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-[#FF5A1F]/15 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* 404 Visual Display with Clean OmniShift Icon directly in the center of the zero */}
        <div className="flex items-center justify-center font-black select-none my-2 font-mono">
          <span className="text-8xl sm:text-9xl tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#FF5A1F] via-[#FF5A1F]/85 to-[var(--text-muted)] opacity-95">
            4
          </span>
          <div className="relative inline-flex items-center justify-center mx-0.5">
            <span className="text-8xl sm:text-9xl tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#FF5A1F] via-[#FF5A1F]/85 to-[var(--text-muted)] opacity-95">
              0
            </span>
            <img
              src={appIcon}
              alt="OmniShift Icon"
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 object-contain drop-shadow-xl pointer-events-none"
            />
          </div>
          <span className="text-8xl sm:text-9xl tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#FF5A1F] via-[#FF5A1F]/85 to-[var(--text-muted)] opacity-95">
            4
          </span>
        </div>

        {/* Clear Headline & Subtitle */}
        <div className="max-w-md mt-4 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            {t('notFoundHeading')}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed font-sans">
            {t('notFoundSubtitle')}
          </p>
        </div>
      </div>
    </div>
  );
});
