import { useLanguage } from '../context/LanguageContext';

export const Hero = () => {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  return (
    <section className="relative pt-4 pb-4 text-center sm:pt-8 sm:pb-6">
      {/* Main Headline */}
      <h1
        className={`mx-auto max-w-2xl text-xl sm:text-3xl md:text-4xl font-bold text-[var(--text-primary)] ${
          isArabic
            ? 'leading-relaxed sm:leading-relaxed font-sans'
            : 'tracking-tight leading-snug sm:leading-tight'
        }`}
      >
        {t('heroTitle')}
      </h1>

      {/* Subtitle */}
      <p
        className={`mx-auto mt-2 max-w-lg text-xs sm:text-sm text-[var(--text-muted)] ${
          isArabic ? 'leading-relaxed' : 'leading-relaxed'
        }`}
      >
        {t('heroSubtitle')}
      </p>
    </section>
  );
};

export default Hero;
