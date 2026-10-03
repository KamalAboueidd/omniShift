import { useState, memo } from 'react';
import { 
  ArrowLeft, 
  BookOpen, 
  Image, 
  FileText, 
  Database, 
  Cpu, 
  ShieldCheck, 
  Terminal,
  Zap,
  ChevronRight,
  HelpCircle
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../lib/utils';

export const GuidePage = memo(function GuidePage({ onBackToApp }) {
  const { lang, isRTL, t } = useLanguage();
  const [activeDoc, setActiveDoc] = useState('overview');

  const docsNav = [
    {
      category: t('catGettingStarted'),
      items: [
        { id: 'overview', label: t('docSystemOverview'), icon: BookOpen },
        { id: 'quickstart', label: t('docQuickStart'), icon: Zap },
      ],
    },
    {
      category: t('catEngines'),
      items: [
        { id: 'images', label: t('docImageEngine'), icon: Image },
        { id: 'pdf', label: t('docPdfEngine'), icon: FileText },
        { id: 'data', label: t('docDataEngine'), icon: Database },
      ],
    },
    {
      category: t('catUnderHood'),
      items: [
        { id: 'workers', label: t('docWorkers'), icon: Cpu },
        { id: 'privacy', label: t('docPrivacy'), icon: ShieldCheck },
        { id: 'shortcuts', label: t('docShortcuts'), icon: Terminal },
        { id: 'faq', label: t('docFaq'), icon: HelpCircle },
      ],
    },
  ];

  return (
    <div className={cn('w-full', 'max-w-6xl', 'mx-auto', 'px-4', 'sm:px-6', 'py-6', 'transition-colors')}>
      {/* Top Docs Header */}
      <div className={cn('flex', 'items-center', 'justify-between', 'pb-4', 'border-b', 'border-[var(--border-color)]')}>
        <div className={cn('flex', 'items-center', 'gap-3')}>
          <button
            type="button"
            onClick={onBackToApp}
            className={cn(
              'inline-flex',
              'items-center',
              'gap-1.5',
              'px-3',
              'py-1.5',
              'text-xs',
              'font-mono',
              'font-medium',
              'text-[var(--text-primary)]',
              'hover:text-[#FF5A1F]',
              'transition-colors',
              'cursor-pointer',
              'bg-transparent',
              'border-none'
            )}
          >
            <ArrowLeft className={cn('h-3.5', 'w-3.5', 'rtl:rotate-180')} />
            <span>{t('returnToStudio')}</span>
          </button>
        </div>
      </div>

      {/* Main Layout: Left Sidebar + Right Content */}
      <div className={cn('flex', 'flex-col', 'md:flex-row', 'gap-8', 'mt-6')}>
        {/* Sidebar */}
        <aside className={cn('w-full', 'md:w-64', 'shrink-0')}>
          <div className={cn('sticky', 'top-20', 'space-y-6')}>
            {docsNav.map((group) => (
              <div key={group.category} className="space-y-1.5">
                <p className={cn('font-mono', 'text-[11px]', 'font-semibold', 'uppercase', 'tracking-wider', 'text-[var(--text-muted)]', 'px-2')}>
                  {group.category}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeDoc === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveDoc(item.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs transition-colors text-left rtl:text-right cursor-pointer bg-transparent border-none ${
                          isActive
                            ? 'text-[#FF5A1F] font-semibold'
                            : 'text-[var(--text-muted)] hover:text-[#FF5A1F]'
                        }`}
                      >
                        <div className={cn('flex', 'items-center', 'gap-2', 'truncate')}>
                          <Icon className={cn('h-3.5', 'w-3.5', 'shrink-0', isActive ? 'text-[#FF5A1F]' : 'opacity-70')} strokeWidth={1.5} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {isActive && <ChevronRight className={cn('h-3', 'w-3', 'shrink-0', 'rtl:rotate-180')} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Right Content Area: Clean Prose Typography without Cards */}
        <div className={cn('flex-1', 'min-w-0', 'max-w-3xl', 'pb-16')}>
          
          {/* ARTICLE 1: Overview */}
          {activeDoc === 'overview' && (
            <article className={cn('space-y-5', 'text-sm', 'text-[var(--text-muted)]', 'leading-relaxed')}>
              <div>
                <h1 className={cn('text-2xl sm:text-3xl', 'font-bold', 'tracking-tight', 'text-[var(--text-primary)]')}>
                  {lang === 'ar' ? 'نظرة عامة على نظام OmniShift' : 'OmniShift System Overview'}
                </h1>
                <p className={cn('mt-3', 'text-base', 'text-[var(--text-muted)]', 'leading-relaxed')}>
                  {lang === 'ar'
                    ? 'منصة OmniShift هي محرك تشغيل متكامل لتحويل ومعالجة الوسائط والمستندات والبيانات محلياً داخل ذاكرة المتصفح (Client-side In-Memory Engine) دون إرسال أي بايت لخوادم سحابية خارجية.'
                    : 'OmniShift is a fully client-side in-memory media and document transmutation runtime, executing all transformations locally within your browser with zero server network egress.'}
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {lang === 'ar' ? 'الفكرة وفلسفة التصميم' : 'Motivation & Architecture'}
                </h2>
                <p>
                  {lang === 'ar'
                    ? 'في كل مرة تحتاج فيها إلى تحويل صورة من PNG إلى WebP، أو دمج ملفين PDF، تجبرك معظم المواقع التقليدية على رفع ملفاتك الحساسة إلى خوادمها. هذا الإجراء يستهلك باقة الإنترنت، ويستغرق وقتاً طويلاً في الرفع والتنزيل، ويعرض ملفات العمل والعقود والبيانات الخاصة لمخاطر التسريب. جاء OmniShift ليغير هذه المعادلة بالكامل: حاسوبك أو هاتفك يمتلك اليوم معالجاً متعدد الأنوية وذاكرة RAM فائقة السرعة، فلماذا ترفع ملفاتك إلى السحابة بينما يمكن معالجتها في أجزاء من الثانية على جهازك مباشرة؟'
                    : 'Whenever you need to convert an image or merge PDFs, legacy web converters force you to upload sensitive files to their servers. This wastes internet bandwidth, introduces latency, and creates privacy risks for confidential documents. OmniShift changes this paradigm entirely: modern devices possess multi-core CPUs and fast RAM, enabling instant in-memory processing without server dependencies.'}
                </p>
              </div>

              {/* Responsive Compact Comparison Table */}
              <div className="space-y-3 pt-1">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {lang === 'ar' ? 'المقارنة: OmniShift مقابل المنصات السحابية التقليدية' : 'Comparison: OmniShift vs. Cloud Converters'}
                </h2>
                <div className="overflow-x-auto border border-[var(--border-color)] rounded-lg">
                  <table className="w-full text-[10px] sm:text-xs font-mono border-collapse">
                    <thead className="bg-[var(--bg-surface-2)]">
                      <tr>
                        <th className="p-2 sm:p-2.5 text-left rtl:text-right text-[var(--text-primary)] border-b border-[var(--border-color)]">
                          {lang === 'ar' ? 'المعيار' : 'Metric'}
                        </th>
                        <th className="p-2 sm:p-2.5 text-left rtl:text-right text-[#FF5A1F] font-bold border-b border-[var(--border-color)]">
                          OmniShift (Local)
                        </th>
                        <th className="p-2 sm:p-2.5 text-left rtl:text-right text-[var(--text-muted)] border-b border-[var(--border-color)]">
                          {lang === 'ar' ? 'المنصات السحابية' : 'Cloud Converters'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      <tr>
                        <td className="p-2 sm:p-2.5 font-semibold text-[var(--text-primary)]">
                          {lang === 'ar' ? 'الخصوصية والأمان' : 'Data Privacy'}
                        </td>
                        <td className="p-2 sm:p-2.5 text-emerald-500 font-medium">
                          {lang === 'ar' ? 'محلية 100% (صفر رفع)' : '100% Local (Zero Egress)'}
                        </td>
                        <td className="p-2 sm:p-2.5 text-red-400">
                          {lang === 'ar' ? 'تُرفع لسيرفرات خارجية' : 'Uploaded to remote disks'}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 sm:p-2.5 font-semibold text-[var(--text-primary)]">
                          {lang === 'ar' ? 'سرعة المعالجة' : 'Processing Speed'}
                        </td>
                        <td className="p-2 sm:p-2.5 text-emerald-500 font-medium">
                          {lang === 'ar' ? 'فورية في أجزاء من الثانية' : 'Instant (CPU Bound)'}
                        </td>
                        <td className="p-2 sm:p-2.5">
                          {lang === 'ar' ? 'تعتمد على سرعة رفع الإنترنت' : 'Throttled by network upload'}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 sm:p-2.5 font-semibold text-[var(--text-primary)]">
                          {lang === 'ar' ? 'استهلاك باقة الإنترنت' : 'Bandwidth Usage'}
                        </td>
                        <td className="p-2 sm:p-2.5 text-emerald-500 font-medium">
                          {lang === 'ar' ? '0 بايت (صفر استهلاك)' : '0 Bytes transferred'}
                        </td>
                        <td className="p-2 sm:p-2.5">
                          {lang === 'ar' ? 'ضعف حجم الملف (رفع + تنزيل)' : '2x file size (Up + Down)'}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 sm:p-2.5 font-semibold text-[var(--text-primary)]">
                          {lang === 'ar' ? 'العمل بدون إنترنت' : 'Offline Capability'}
                        </td>
                        <td className="p-2 sm:p-2.5 text-emerald-500 font-medium">
                          {lang === 'ar' ? 'شغال 100% كـ PWA' : 'Fully functional offline'}
                        </td>
                        <td className="p-2 sm:p-2.5 text-red-400">
                          {lang === 'ar' ? 'يتوقف تماماً' : 'Fails without connection'}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 sm:p-2.5 font-semibold text-[var(--text-primary)]">
                          {lang === 'ar' ? 'الحد الأقصى للتكلفة' : 'Limits & Pricing'}
                        </td>
                        <td className="p-2 sm:p-2.5 text-emerald-500 font-medium">
                          {lang === 'ar' ? 'مجاني وبلا حدود للأبد' : 'Free & Unlimited forever'}
                        </td>
                        <td className="p-2 sm:p-2.5">
                          {lang === 'ar' ? 'اشتراكات وحدود للملفات' : 'Daily quotas & paywalls'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4 Pipeline Stages as Clean Prose List */}
              <div className="space-y-3 pt-2">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {lang === 'ar' ? 'مراحل دورة حياة الملف داخل الذاكرة' : 'The 4 In-Memory Processing Stages'}
                </h2>
                <ol className="list-decimal pl-5 rtl:pr-5 rtl:pl-0 space-y-2.5">
                  <li>
                    <strong className="text-[var(--text-primary)]">
                      {lang === 'ar' ? 'قراءة المخزن (Buffer Ingestion):' : 'Buffer Ingestion:'}
                    </strong>{' '}
                    {lang === 'ar'
                      ? 'يتم استدعاء file.arrayBuffer() ونقل البايتات الخام إلى ذاكرة RAM المخصصة لتبويب المتصفح دون إنشاء نسخ مؤقتة على القرص.'
                      : 'Raw binary bytes are read directly into an ArrayBuffer inside the browser process heap without disk writes.'}
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">
                      {lang === 'ar' ? 'توزيع الأنوية (Worker Thread Allocation):' : 'Worker Thread Allocation:'}
                    </strong>{' '}
                    {lang === 'ar'
                      ? 'يقوم النظام بتوزيع المهام عبر مسارات Web Workers مستقلة بالتوازي بنظام الصفر نسخ (Zero-Copy Transfer) لتفادي أي ضغط على الذاكرة.'
                      : 'Tasks are scheduled across independent background Web Workers, transferring memory ownership in 0ms.'}
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">
                      {lang === 'ar' ? 'التحويل المحلي (Native Local Transmutation):' : 'Local Transmutation:'}
                    </strong>{' '}
                    {lang === 'ar'
                      ? 'تُستخدم مكتبات العتاد و OffscreenCanvas و pdf-lib المدمجة لتشفير ومعالجة الملف بالصيغة المطلوبة بكفاءة كاملة.'
                      : 'Native OffscreenCanvas codecs and client-side libraries transform the binary payload into target formats.'}
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">
                      {lang === 'ar' ? 'التدفق المباشر للقرص (Direct Disk Streaming):' : 'Direct Disk Streaming:'}
                    </strong>{' '}
                    {lang === 'ar'
                      ? 'يتم تنزيل الملف بهيئة تدفق مباشر يكتب على القرص الصلب، ثم يُفرغ الـ RAM فوراً عبر استدعاء URL.revokeObjectURL.'
                      : 'Output is securely streamed to local storage, automatically disposing allocated memory.'}
                  </li>
                </ol>
              </div>
            </article>
          )}

          {/* ARTICLE 2: Quick Start */}
          {activeDoc === 'quickstart' && (
            <article className={cn('space-y-5', 'text-sm', 'text-[var(--text-muted)]', 'leading-relaxed')}>
              <div>
                <h1 className={cn('text-2xl sm:text-3xl', 'font-bold', 'tracking-tight', 'text-[var(--text-primary)]')}>
                  {lang === 'ar' ? 'دليل البدء السريع والاحترافي' : 'Getting Started & Pro Workflow'}
                </h1>
                <p className="mt-3 text-base text-[var(--text-muted)]">
                  {lang === 'ar'
                    ? 'خطوات عملية واضحة للتعامل مع ملفاتك وتحويلها بأعلى كفاءة وسرعة:'
                    : 'Follow these straightforward steps to transmute files through OmniShift:'}
                </p>
              </div>

              <ol className="list-decimal pl-5 rtl:pr-5 rtl:pl-0 space-y-4">
                <li>
                  <strong className="text-[var(--text-primary)]">
                    {lang === 'ar' ? 'إضافة الملفات والسحب والإفلات:' : 'Ingesting Files:'}
                  </strong>{' '}
                  {lang === 'ar'
                    ? 'يمكنك سحب أي ملف وإفلاته في أي مكان داخل الشاشة، أو النقر على منطقة الإفلات لتصفح جهازك. كما يدعم النظام ميزة اللصق المباشر من الحافظة (Ctrl+V أو ⌘+V): إذا قمت بنسخ أي صورة أو أخذت لقطة شاشة (Screenshot)، يمكنك لصقها مباشرة في الصفحة لتدخل منطقة التجهيز فوراً دون الحاجة لحفظها أولاً على حاسوبك.'
                    : 'Drag & drop files anywhere onto the screen, or click to browse. OmniShift also supports direct clipboard pasting (Ctrl+V / ⌘+V): copy any screenshot or image from your clipboard, hit paste, and it stages immediately.'}
                </li>
                <li>
                  <strong className="text-[var(--text-primary)]">
                    {lang === 'ar' ? 'التعرف الذكي وتحديد الصيغة:' : 'Format Selection:'}
                  </strong>{' '}
                  {lang === 'ar'
                    ? 'يتعرف OmniShift تلقائياً على نوع الملفات المضافة؛ إذا أضفت صوراً يتيح لك صيغ WebP و AVIF و PNG و JPEG، وإذا أسقطت ملفين PDF أو أكثر يتحول النظام تلقائياً لوضع دمج المستندات (PDF Merge)، وإذا كانت ملفات بيانات يتيح لك جداول CSV و JSON. اختر الصيغة المطلوبة بنقرة واحدة.'
                    : 'OmniShift dynamically categorizes files: raster images unlock WebP, AVIF, PNG, and JPEG; multiple PDFs activate the document merger; and data files activate CSV/JSON tabular modes.'}
                </li>
                <li>
                  <strong className="text-[var(--text-primary)]">
                    {lang === 'ar' ? 'ميزة الحفظ التلقائي (Auto-Download):' : 'Smart Auto-Download:'}
                  </strong>{' '}
                  {lang === 'ar'
                    ? 'أعلى لوحة الملفات ستجد خيار Auto-Download. عند تفعيله، سيقوم المتصفح فور اكتمال عملية التحويل بتنزيل الملف تلقائياً إلى مجلد التنزيلات على جهازك دون أن تضطر للضغط يدوياً على زر التحميل في كل مرة.'
                    : 'Toggle the Auto-Download checkbox above the file list. When enabled, your ready files will download automatically the exact millisecond conversion finishes.'}
                </li>
                <li>
                  <strong className="text-[var(--text-primary)]">
                    {lang === 'ar' ? 'بدء التحويل والمقارنة التفاعلية:' : 'Conversion & Visual Diff:'}
                  </strong>{' '}
                  {lang === 'ar'
                    ? 'اضغط زر التحويل لمتابعة شريط التقدم السلس عبر مراحل المعالجة الأربعة. عند تحويل صورة مفردة، يظهر سلايدر تفاعلي ذكي يتيح لك مقارنة الصورة الأصلية بالصورة المحولة بيكسل ببيكسل للتأكد من ثبات الجودة بنسبة 100%.'
                    : 'Click Convert to initiate processing. When transmuting a single image, an interactive Visual Diff slider lets you inspect pixel-by-pixel fidelity.'}
                </li>
                <li>
                  <strong className="text-[var(--text-primary)]">
                    {lang === 'ar' ? 'التحميل الفردي أو التحزيم الشامل (.ZIP):' : 'Individual or Batch ZIP Download:'}
                  </strong>{' '}
                  {lang === 'ar'
                    ? 'يمكنك تنزيل كل ملف على حدة، أو النقر على زر Download All (.ZIP) لتجميع كل الملفات المحولة وضغطها في ملف .zip واحد يتم إنشاؤه محلياً في ذاكرة الرام عبر JSZip وتنزيله في ثانية واحدة.'
                    : 'Download individual files, or click Download All (.ZIP) to compress all converted assets into a consolidated in-memory .zip archive.'}
                </li>
              </ol>
            </article>
          )}

          {/* ARTICLE 3: Images */}
          {activeDoc === 'images' && (
            <article className={cn('space-y-5', 'text-sm', 'text-[var(--text-muted)]', 'leading-relaxed')}>
              <div>
                <h1 className={cn('text-2xl sm:text-3xl', 'font-bold', 'tracking-tight', 'text-[var(--text-primary)]')}>
                  {lang === 'ar' ? 'محرك الصور (OffscreenCanvas & Native Codecs)' : 'Image Transmutation Engine'}
                </h1>
                <p className="mt-3 text-base text-[var(--text-muted)]">
                  {lang === 'ar'
                    ? 'يعتمد محرك الصور في OmniShift على تقنية OffscreenCanvas المعزولة في مسارات Web Workers، مما يتيح معالجة الصور فائقة الدقة (حتى 8K+) بسرعة دون أي تجميد لواجهة المتصفح.'
                    : 'The image engine runs inside dedicated Web Workers using OffscreenCanvas and native browser codecs, ensuring ultra-fast conversions without freezing the UI thread.'}
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {lang === 'ar' ? 'دليل الصيغ المدعومة ومتى تختار كل صيغة؟' : 'Supported Formats & Guidelines'}
                </h2>
                <ul className="list-disc pl-5 rtl:pr-5 rtl:pl-0 space-y-2">
                  <li>
                    <strong className="text-[var(--text-primary)]">WEBP:</strong>{' '}
                    {lang === 'ar'
                      ? 'المعيار الذهبي للويب الحديث؛ يقلل حجم الملفات بنسبة تتراوح بين 40% إلى 80% مقارنة بـ PNG و JPEG مع الحفاظ التام على حدة الألوان والشفافية (Alpha Channel).'
                      : 'The modern web standard, reducing image payload sizes by 40-80% while retaining full transparency and visual crispness.'}
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">AVIF:</strong>{' '}
                    {lang === 'ar'
                      ? 'الجيل الأحدث المبني على خوارزميات ضغط الفيديو AV1؛ يقدم أعلى معدل ضغط ممكن حالياً، وهو ممتاز للصور الفوتوغرافية الغنية بالتفاصيل والتدرجات اللونية.'
                      : 'Next-gen format based on the AV1 video codec, delivering cutting-edge compression for detailed photographic content.'}
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">PNG:</strong>{' '}
                    {lang === 'ar'
                      ? 'تحويل دقيق وخالٍ تماماً من الفقدان (Lossless Bit-Exact)؛ مثالي للشعارات، الأيقونات، الرسومات التوضيحية، واللقطات التي تتطلب خلفيات شفافة نقية.'
                      : 'Bit-exact lossless compression. Ideal for logos, icons, diagrams, and graphics requiring pristine transparency.'}
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">JPEG / JPG:</strong>{' '}
                    {lang === 'ar'
                      ? 'الصيغة الكلاسيكية الأكثر انتشاراً وتوافقاً مع كافة الأنظمة والأجهزة القديمة والطابعات.'
                      : 'Universal compatibility across legacy platforms, hardware printers, and older devices.'}
                  </li>
                </ul>
              </div>

              <div className="space-y-3 pt-1">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {lang === 'ar' ? 'القدرات الهندسية للمحرك' : 'Technical Capabilities'}
                </h2>
                <ul className="list-disc pl-5 rtl:pr-5 rtl:pl-0 space-y-2">
                  <li>
                    <strong className="text-[var(--text-primary)]">
                      {lang === 'ar' ? 'تعديل الاتجاه التلقائي (EXIF Orientation):' : 'EXIF Orientation Preservation:'}
                    </strong>{' '}
                    {lang === 'ar'
                      ? 'يقرأ المحرك بيانات المستشعر من كاميرات الهواتف الذكية ويضبط تدوير الصورة تلقائياً حتى لا تظهر مقلوبة بعد التحويل.'
                      : 'Reads sensor metadata from phone cameras and automatically corrects rotation so photos never appear inverted.'}
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">
                      {lang === 'ar' ? 'المعالجة دون تجميد الشاشة (60 FPS Locked):' : 'Zero Main-Thread Starvation:'}
                    </strong>{' '}
                    {lang === 'ar'
                      ? 'حتى عند معالجة صور ضخمة بدقة 4K أو 8K، تظل الواجهة والأنيميشن تعمل بنعومة تامة دون أي تشنج.'
                      : 'Maintains locked 60 FPS UI performance even when decoding and transcoding 8K images.'}
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">
                      {lang === 'ar' ? 'تحسين متجهات الـ SVG:' : 'Vector SVG Minification:'}
                    </strong>{' '}
                    {lang === 'ar'
                      ? 'تنظيف وضغط ملفات المتجهات SVG وإزالة العناصر الزائدة والمسافات مع الحفاظ الكامل على أبعاد وإحداثيات الرسم.'
                      : 'Strips redundant attributes and whitespace from vector SVG trees without altering rendering coordinates.'}
                  </li>
                </ul>
              </div>
            </article>
          )}

          {/* ARTICLE 4: PDF */}
          {activeDoc === 'pdf' && (
            <article className={cn('space-y-5', 'text-sm', 'text-[var(--text-muted)]', 'leading-relaxed')}>
              <div>
                <h1 className={cn('text-2xl sm:text-3xl', 'font-bold', 'tracking-tight', 'text-[var(--text-primary)]')}>
                  {lang === 'ar' ? 'محرك مستندات PDF في الذاكرة' : 'In-Memory PDF Document Engine'}
                </h1>
                <p className="mt-3 text-base text-[var(--text-muted)]">
                  {lang === 'ar'
                    ? 'يقوم محرك PDF في OmniShift بمعالجة المستندات عبر تكامل خفيف لمكتبة pdf-lib، ينفذ عمليات الدمج والضغط واستخراج المحتوى مباشرة على مصفوفات Uint8Array في ذاكرة RAM دون حفظ أي ملفات مؤقتة على القرص.'
                    : 'The PDF engine operates over Uint8Array buffers in memory using a client-side pdf-lib integration, executing merges and optimizations without touching server disks.'}
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {lang === 'ar' ? 'دمج ملفات PDF المتعددة (Multi-PDF Merge)' : 'One-Click Multi-PDF Merge'}
                </h2>
                <p>
                  {lang === 'ar'
                    ? 'عندما تقوم بإسقاط ملفين أو أكثر من نوع PDF داخل OmniShift، يستشعر النظام فوراً حالة الدمج ويعرض لك زراً مخصصاً "Merge Documents". يقوم المحرك بإنشاء مستند PDF جديد في الذاكرة، ويقوم بنسخ صفحات كل مستند بالترتيب مع الحفاظ الكامل على الخطوط المتجهة (Vector Fonts)، الروابط الداخلية، والطبقات، وينتج ملفاً نهائياً موحداً وجاهزاً للتنزيل فوراً.'
                    : 'When you stage two or more PDF files, OmniShift automatically enters merge mode. It stitches pages in sequence, preserving vector typography, hyperlinks, and document structure into a consolidated output.'}
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {lang === 'ar' ? 'الأمان القانوني للمستندات الحساسة' : 'Legal & Corporate Compliance'}
                </h2>
                <p>
                  {lang === 'ar'
                    ? 'المستندات القانونية مثل العقود، كشوف الحسابات المصرفية، الفواتير المالية، والهويات الشخصية تحتوي على بيانات شديدة الحساسية. نظراً لأن OmniShift يعمل بالكامل على جهاز المستخدم، فهو متوافق بطبيعته مع أعلى معايير الخصوصية مثل GDPR و HIPAA لأن بياناتك لا تخرج من حدود متصفحك أبداً.'
                    : 'Sensitive documents like contracts, medical records, and bank statements should never be exposed to public web converters. OmniShift is architecturally compliant with GDPR and enterprise policies because data never leaves the client boundary.'}
                </p>
              </div>
            </article>
          )}

          {/* ARTICLE 5: Data */}
          {activeDoc === 'data' && (
            <article className={cn('space-y-5', 'text-sm', 'text-[var(--text-muted)]', 'leading-relaxed')}>
              <div>
                <h1 className={cn('text-2xl sm:text-3xl', 'font-bold', 'tracking-tight', 'text-[var(--text-primary)]')}>
                  {lang === 'ar' ? 'محرك تسلسل البيانات (JSON / CSV / Excel)' : 'Tabular Data Engine (JSON / CSV / XLSX)'}
                </h1>
                <p className="mt-3 text-base text-[var(--text-muted)]">
                  {lang === 'ar'
                    ? 'يوفر OmniShift محرك تسلسل عالي الأداء يتيح التحويل المتبادل السلس بين كائنات JSON وهياكل CSV وجداول Excel مع معالجة ذكية للترميز العربي.'
                    : 'A high-throughput streaming parser engineered to convert between JSON trees, CSV sheets, and tabular datasets.'}
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {lang === 'ar' ? 'حل مشكلة اللغة العربية في Microsoft Excel (UTF-8 with BOM)' : 'Arabic UTF-8 BOM Support'}
                </h2>
                <p>
                  {lang === 'ar'
                    ? 'من أشهر المشاكل التي تواجه المستخدمين عند تحويل ملفات CSV وفتحها في Microsoft Excel هي ظهور الكلمات والحروف العربية على شكل رموز مشوهة وغير مفهومة. يقوم محرك OmniShift تلقائياً بإدراج ترويسة Byte Order Mark (\\uFEFF) في بداية ملف الـ CSV ليجبر برنامج Excel على قراءة الملف بترميز UTF-8 القياسي وعرض النصوص والبيانات العربية بوضوح تام.'
                    : 'Opening UTF-8 CSVs in Excel often scrambles non-ASCII and Arabic characters. OmniShift automatically injects a Byte Order Mark (\\uFEFF) header, ensuring Excel renders Arabic and international characters flawlessly.'}
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {lang === 'ar' ? 'المسارات المدعومة للبيانات' : 'Supported Data Transformations'}
                </h2>
                <ul className="list-disc pl-5 rtl:pr-5 rtl:pl-0 space-y-2">
                  <li>
                    <strong className="text-[var(--text-primary)]">JSON &rarr; CSV:</strong>{' '}
                    {lang === 'ar'
                      ? 'تسطيح مصفوفات الكائنات المتداخلة تلقائياً واستخراج الحقول كرؤوس أعمدة منظمة، مع معالجة الفواصل وعلامات التنصيص وفق معيار RFC 4180.'
                      : 'Flattens complex nested JSON arrays into normalized tabular rows and headers following RFC 4180 specs.'}
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">CSV &rarr; JSON:</strong>{' '}
                    {lang === 'ar'
                      ? 'قراءة جداول البيانات وتحويلها فوراً إلى كائنات ومصفوفات JSON مهيكلة وجاهزة للاستخدام البرمجي في قواعد البيانات وتطبيقات الويب.'
                      : 'Parses delimiter rows into structured, clean JSON object collections ready for database consumption.'}
                  </li>
                </ul>
              </div>
            </article>
          )}

          {/* ARTICLE 6: Workers */}
          {activeDoc === 'workers' && (
            <article className={cn('space-y-5', 'text-sm', 'text-[var(--text-muted)]', 'leading-relaxed')}>
              <div>
                <h1 className={cn('text-2xl sm:text-3xl', 'font-bold', 'tracking-tight', 'text-[var(--text-primary)]')}>
                  {lang === 'ar' ? 'مسارات Web Workers وتعدد الأنوية' : 'Multi-Threaded Worker Pool'}
                </h1>
                <p className="mt-3 text-base text-[var(--text-muted)]">
                  {lang === 'ar'
                    ? 'كيف يستغل OmniShift القوة الكاملة لمعالج جهازك بالتوازي دون إبطاء واجهة التصفح؟'
                    : 'How OmniShift harnesses your native CPU cores without sacrificing browser responsiveness.'}
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {lang === 'ar' ? 'اكتشاف الأنوية وعزل المسار الرئيسي' : 'Core Detection & UI Isolation'}
                </h2>
                <p>
                  {lang === 'ar'
                    ? 'يستعلم النظام عن عدد الأنوية المنطقية لجهازك عبر navigator.hardwareConcurrency. لحماية الشاشة من أي بطء، يحجز OmniShift نواة كاملة دائماً مخصصة لواجهة المستخدم لتظل تعمل بسلاسة تامة عند 60 إطار بالثانية (60 FPS Locked)، ويوزع باقي الأنوية كحوض عمال (Worker Pool) مستقل يستقبل ملفاتك ويعالجها بالتوازي.'
                    : 'OmniShift inspects navigator.hardwareConcurrency upon launch. To protect UI smoothness, it always keeps one logical thread free for 60 FPS rendering, delegating heavy computation across remaining worker cores.'}
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {lang === 'ar' ? 'نقل الذاكرة بالصفر نسخ (Zero-Copy Transfer)' : 'Zero-Copy Transferable Memory'}
                </h2>
                <p>
                  {lang === 'ar'
                    ? 'بدلاً من نسخ محتوى الملفات الكبيرة في الذاكرة عدة مرات أثناء نقلها بين العمال والشاشة، يستخدم النظام خاصية Transferable Objects الأصلية في جافا سكريبت لنقل ملكية الـ ArrayBuffer مباشرة بأسلوب Pointer Handoff، مما يقلل استهلاك الـ RAM إلى النصف ويحافظ على بطارية أجهزة اللابتوب.'
                    : 'Instead of cloning heavy buffers during thread communication, OmniShift utilizes JavaScript Transferable Objects to transfer memory ownership in 0ms, halving RAM footprint.'}
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {lang === 'ar' ? 'نظام الحماية الاحتياطي (Main-Thread Fallback)' : 'Fail-Safe Main-Thread Fallback'}
                </h2>
                <p>
                  {lang === 'ar'
                    ? 'إذا كان المستخدم يعمل في بيئة متصفح مقيدة أو لا تدعم الـ Web Workers لأسباب أمنية داخلية، لا يتوقف النظام أبداً؛ بل ينتقل تلقائياً لمحرك الاحتياط المحلي localFallbackTransmute على المسار الرئيسي ليضمن اكتمال العملية بنجاح 100%.'
                    : 'If workers encounter browser sandboxing limitations, the system automatically redirects to an optimized main-thread fallback engine, ensuring 100% conversion completion.'}
                </p>
              </div>
            </article>
          )}

          {/* ARTICLE 7: Privacy */}
          {activeDoc === 'privacy' && (
            <article className={cn('space-y-5', 'text-sm', 'text-[var(--text-muted)]', 'leading-relaxed')}>
              <div>
                <h1 className={cn('text-2xl sm:text-3xl', 'font-bold', 'tracking-tight', 'text-[var(--text-primary)]')}>
                  {lang === 'ar' ? 'الخصوصية المطلقة ودورة حياة الذاكرة' : 'Zero-Egress & Memory Management'}
                </h1>
                <p className="mt-3 text-base text-[var(--text-muted)]">
                  {lang === 'ar'
                    ? 'في OmniShift، الخصوصية مبدأ هندسي مبني في صلب الكود البرمجي وليست مجرد سياسة.'
                    : 'In OmniShift, privacy is an architectural guarantee embedded directly into the codebase, not an arbitrary policy.'}
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {lang === 'ar' ? 'كيف تتأكد بنفسك أن ملفاتك لا تخرج من جهازك؟' : 'Verify for Yourself: Inspect the Network'}
                </h2>
                <p>
                  {lang === 'ar'
                    ? 'يمكن لأي مستخدم التأكد التقني بنفسه: اضغط F12 في المتصفح وافتح تبويب Network (الشبكة)، ثم افصل الإنترنت تماماً أو اختر وضع Offline. قم بسحب الملفات وتحويلها وتنزيلها؛ ستلاحظ أن كل شيء يعمل بكفاءة كاملة وصفر طلبات شبكية. لا توجد أي خوادم نائية، ولا توجد تحليلات تسجل محتوى ملفاتك.'
                    : 'Open Developer Tools (F12), switch to the Network tab, and toggle your browser to Offline mode. Drag and convert files: you will observe zero HTTP/fetch requests and 0 bytes transmitted. Everything is computed within local memory.'}
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {lang === 'ar' ? 'إدارة الذاكرة ومنع تسريب الـ RAM' : 'Strict RAM Reclamation & Leak Prevention'}
                </h2>
                <ul className="list-disc pl-5 rtl:pr-5 rtl:pl-0 space-y-2">
                  <li>
                    <strong className="text-[var(--text-primary)]">
                      {lang === 'ar' ? 'التنظيف اللحظي (URL.revokeObjectURL):' : 'Instant Revocation:'}
                    </strong>{' '}
                    {lang === 'ar'
                      ? 'بمجرد تنزيل الملف أو الضغط على "تحويل ملف آخر"، يتم تحرير مساحة الـ Blob واستعادة الذاكرة فوراً لمنع تراكم الملفات القديمة.'
                      : 'When resetting or switching tasks, URL.revokeObjectURL immediately frees heap allocations.'}
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">
                      {lang === 'ar' ? 'إغلاق مساحات الرسم (Canvas & Bitmap Discard):' : 'Canvas Context Disposal:'}
                    </strong>{' '}
                    {lang === 'ar'
                      ? 'يتم استدعاء imageBitmap.close() فور الانتهاء من الرسم لتحرير ذاكرة كارت الشاشة (GPU VRAM) على الفور.'
                      : 'Bitmaps are closed via imageBitmap.close() immediately after drawing, liberating GPU VRAM.'}
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">
                      {lang === 'ar' ? 'تدفق التحميل الآمن (Direct Data Stream):' : 'Safe Data URL Streaming:'}
                    </strong>{' '}
                    {lang === 'ar'
                      ? 'يحمي التطبيق عمليات التحميل من أخطاء متصفحات Chromium الشائعة عبر ترميز البيانات المباشر وتأخير إزالة عناصر الـ DOM حتى استقرار الملف على القرص.'
                      : 'Encodes payloads as self-contained streams to prevent Chromium prematurely terminating download buffers.'}
                  </li>
                </ul>
              </div>
            </article>
          )}

          {/* ARTICLE 8: Shortcuts */}
          {activeDoc === 'shortcuts' && (
            <article className={cn('space-y-5', 'text-sm', 'text-[var(--text-muted)]', 'leading-relaxed')}>
              <div>
                <h1 className={cn('text-2xl sm:text-3xl', 'font-bold', 'tracking-tight', 'text-[var(--text-primary)]')}>
                  {lang === 'ar' ? 'اختصارات لوحة المفاتيح والتحكم السريع' : 'Keyboard Shortcuts & Gestures'}
                </h1>
                <p className="mt-3 text-base text-[var(--text-muted)]">
                  {lang === 'ar'
                    ? 'صُمم OmniShift مع دعم كامل لاختصارات لوحة المفاتيح العالمية لتوفير أعلى إنتاجية ممكنة للمصممين والمطورين:'
                    : 'OmniShift includes global hotkeys and touch gestures designed to streamline workflows for power users:'}
                </p>
              </div>

              {/* Responsive Compact Shortcuts Table */}
              <div className="overflow-x-auto border border-[var(--border-color)] rounded-lg">
                <table className="w-full text-[10px] sm:text-xs font-mono border-collapse">
                  <thead className="bg-[var(--bg-surface-2)]">
                    <tr>
                      <th className="p-2 sm:p-2.5 text-left rtl:text-right text-[var(--text-primary)] border-b border-[var(--border-color)]">
                        {lang === 'ar' ? 'الاختصار' : 'Shortcut'}
                      </th>
                      <th className="p-2 sm:p-2.5 text-left rtl:text-right text-[var(--text-primary)] border-b border-[var(--border-color)]">
                        {lang === 'ar' ? 'الوظيفة والتأثير' : 'Action & Scope'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    <tr>
                      <td className="p-2 sm:p-2.5 text-[#FF5A1F] font-bold whitespace-nowrap">Ctrl + V / ⌘ + V</td>
                      <td className="p-2 sm:p-2.5">
                        {lang === 'ar'
                          ? 'لصق فوري لأي صورة أو مستند من الحافظة مباشرة إلى منطقة المعالجة دون الحاجة لحفظها أولاً.'
                          : 'Paste images or documents directly from OS clipboard into the staging workbench.'}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-2.5 text-[#FF5A1F] font-bold whitespace-nowrap">Ctrl + S / ⌘ + S</td>
                      <td className="p-2 sm:p-2.5">
                        {lang === 'ar'
                          ? 'بدء تنزيل الملف المحول أو ملف الـ ZIP الجماعي فور اكتمال عملية المعالجة.'
                          : 'Trigger instant download of the completed conversion or batch ZIP archive.'}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-2.5 text-[#FF5A1F] font-bold whitespace-nowrap">Esc</td>
                      <td className="p-2 sm:p-2.5">
                        {lang === 'ar'
                          ? 'إلغاء التحديد وتفريغ قائمة الملفات وتصفير مساحة الذاكرة المؤقتة بالكامل.'
                          : 'Reset staging queue, clear all active files, and revoke in-memory buffer URLs.'}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-2.5 text-[#FF5A1F] font-bold whitespace-nowrap">Global Drop</td>
                      <td className="p-2 sm:p-2.5">
                        {lang === 'ar'
                          ? 'اسحب أي ملف من سطح المكتب وأفلته في أي مساحة داخل الشاشة لبدء الاستيراد الذاتي.'
                          : 'Drag files over any portion of the browser viewport to trigger the full-screen drop overlay.'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {/* ARTICLE 9: FAQ */}
          {activeDoc === 'faq' && (
            <article className={cn('space-y-5', 'text-sm', 'text-[var(--text-muted)]', 'leading-relaxed')}>
              <div>
                <h1 className={cn('text-2xl sm:text-3xl', 'font-bold', 'tracking-tight', 'text-[var(--text-primary)]')}>
                  {lang === 'ar' ? 'الأسئلة الشائعة وتفاصيل النظام' : 'FAQ & Deep System Insights'}
                </h1>
                <p className="mt-3 text-base text-[var(--text-muted)]">
                  {lang === 'ar'
                    ? 'إليك إجابات وافية وشاملة عن كل ما قد يدور في ذهنك حول كيفية عمل OmniShift وأمانه:'
                    : 'Detailed answers to common questions regarding architecture, limits, and security:'}
                </p>
              </div>

              {/* Clean Q&A Prose without Cards */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    <span className="text-[#FF5A1F] font-mono mr-1.5 rtl:ml-1.5">Q.</span>
                    {lang === 'ar' ? 'هل يوجد حد أقصى لحجم الملفات التي يمكن تحويلها؟' : 'Is there a file size limit?'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed pl-5 rtl:pr-5 rtl:pl-0">
                    {lang === 'ar'
                      ? 'لا توجد أي قيود أو حدود مصطنعة من جانبنا؛ في المواقع السحابية يفرضون حداً أقصى لتوفير خوادمهم بدون اشتراك مدفوع. في OmniShift، تتم المعالجة بالكامل على جهازك، والحد الوحيد هو مقدار ذاكرة الرام (RAM) المتاحة في جهازك أثناء التحويل.'
                      : 'There are no artificial quotas or file size paywalls. Since all computation takes place on your own device, the only limiting constraint is your available browser system RAM.'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    <span className="text-[#FF5A1F] font-mono mr-1.5 rtl:ml-1.5">Q.</span>
                    {lang === 'ar' ? 'هل يعمل الموقع إذا انقطع الإنترنت تماماً؟' : 'Does OmniShift work completely offline?'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed pl-5 rtl:pr-5 rtl:pl-0">
                    {lang === 'ar'
                      ? 'نعم 100%! بمجرد أن تفتح صفحة الموقع أول مرة، يقوم المتصفح بتخزين الأكواد محلياً كـ Progressive Web App (PWA). يمكنك إيقاف الواي فاي أو تشغيل وضع الطيران، واستخدام التطبيق بالكامل لتحويل الصور والمستندات والبيانات بدون أي مشكلة.'
                      : 'Yes. Once loaded, OmniShift caches all assets via service workers as a Progressive Web App (PWA). You can enable airplane mode and continue transmuting files with zero interruptions.'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    <span className="text-[#FF5A1F] font-mono mr-1.5 rtl:ml-1.5">Q.</span>
                    {lang === 'ar' ? 'لماذا صُمم OmniShift ليكون مجانياً وبدون إعلانات؟' : 'Why is OmniShift free and ad-free?'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed pl-5 rtl:pr-5 rtl:pl-0">
                    {lang === 'ar'
                      ? 'المنصات الأخرى تضع إعلانات وتطلب اشتراكات شهرية لأنها تدفع تكاليف استئجار خوادم سحابية وباندويث لنقل الملفات. في OmniShift، بنية المعالجة اللامركزية تعتمد على جهازك، وبالتالي تكلفة تشغيل المنصة تقترب من الصفر، مما يتيح تقديم تجربة مستخدم سريعة ومجانية تماماً وبدون إعلانات مزعجة.'
                      : 'Traditional services incur cloud server bills, forcing them to run intrusive ads and paywalls. OmniShift executes locally on your hardware, eliminating cloud server costs and allowing a clean, fast, and free experience.'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    <span className="text-[#FF5A1F] font-mono mr-1.5 rtl:ml-1.5">Q.</span>
                    {lang === 'ar' ? 'هل يحتفظ المتصفح بأي نسخة من ملفاتي بعد إغلاقه؟' : 'Does the browser retain any traces of files after closing?'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed pl-5 rtl:pr-5 rtl:pl-0">
                    {lang === 'ar'
                      ? 'مطلقاً. جميع الكائنات المؤقتة تعيش فقط في الـ Heap الخاص بتبويب المتصفح المفتوح. بمجرد إغلاق التبويب أو النقر على "تحويل ملف آخر" أو زر مسح الذاكرة، يتم مسح كل البايتات واستدعاء Garbage Collector لتفريغ الذاكرة فوراً وبشكل نهائي.'
                      : 'Never. Data exists solely in ephemeral memory buffers tied to the current browser tab. Closing the tab or clicking Clear immediately purges all allocated memory.'}
                  </p>
                </div>
              </div>
            </article>
          )}

        </div>
      </div>
    </div>
  );
});
