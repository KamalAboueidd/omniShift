import { useLanguage } from '../context/LanguageContext';

export const Hero = () => {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  return (
    <section className="relative pt-6 pb-6 text-center sm:pt-12 sm:pb-8">
      {/* Main Headline */}
      <h1
        className={`mx-auto max-w-2xl text-2xl sm:text-4xl font-bold text-[var(--text-primary)] ${
          isArabic
            ? 'leading-relaxed sm:leading-relaxed font-sans'
            : 'tracking-tight leading-snug sm:leading-tight'
        }`}
      >
        {t('heroTitle')}
      </h1>

      {/* Subtitle */}
      <p
        className={`mx-auto mt-3 max-w-xl text-sm sm:text-base text-[var(--text-muted)] ${
          isArabic ? 'leading-relaxed' : 'leading-normal sm:leading-relaxed'
        }`}
      >
        {t('heroSubtitle')}
      </p>
    </section>
  );
};

export default Hero;
