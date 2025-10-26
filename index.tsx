/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from '@google/genai';
import React, { useState, FormEvent, ChangeEvent, useEffect, useMemo, useCallback, useRef, MouseEvent } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
// FIX: Correctly import date-fns locales using named imports to resolve a type error when passing them to 'formatDistanceToNow'.
import { format, formatDistanceToNow, subDays, startOfDay } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale/ar';
import { enUS as enLocale } from 'date-fns/locale/en-US';
import { judicialData } from './data.ts';


ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const DB_NAME = 'JudgmentCaseDB';
const DB_VERSION = 5; // Incremented version to remove schema store
const STORE_NAME = 'cases';
const LOG_STORE_NAME = 'audit_logs';
const JUDICIAL_RECORDS_STORE_NAME = 'judicial_records';


interface CaseError {
  title: string;
  summary: string;
  breakdown?: {
    whatHappened: string;
    possibleCauses: string[];
    howToFix: string[];
  };
  message?: string; // For backward compatibility with service worker errors
  suggestion?: string; // For backward compatibility
  raw?: string;
}

interface CaseRecord {
  id?: number;
  originalText: string;
  analysis?: any;
  timestamp: number;
  loading?: boolean;
  error?: CaseError;
  tags?: string[];
}

type Translations = typeof translations.en;
type TranslationKey = keyof Translations;

const translations = {
  ar: {
    appTitle: "محلل قضايا الأحكام",
    appDescription: "الصق نص قضية حكم سعودية أو قم بتحميل ملفات (JSON, JSONL, TXT, MD) تحتوي على قضايا متعددة لاستخراج البيانات المنظمة.",
    caseTextLabel: "نص القضية",
    caseTextPlaceholder: "الصق قضية واحدة أو أكثر هنا. افصل بين القضايا المتعددة بـ '---' على سطر جديد.",
    caseTextBatchSource: (index: number) => `قضية ملصقة #${index}`,
    orDivider: "أو",
    uploadFileLabel: "تحميل ملفات",
    analyzeButton: "تحليل",
    analyzingButton: "جاري التحليل...",
    analysisHistoryTitle: "سجل التحليلات",
    filterPlaceholder: "تصفية النتائج...",
    clearSearchLabel: "مسح البحث",
    exportHistoryButton: "تصدير السجل",
    clearHistoryButton: "مسح السجل",
    noHistoryPlaceholder: "سيظهر تاريخ تحليلاتك هنا.",
    noFilterResultsPlaceholder: "لا توجد نتائج تطابق بحثك.",
    caseAnalysisTitle: "تحليل القضية",
    judgmentNumberPrefix: "حكم #",
    caseIdPrefix: "معرف القضية: ",
    clickViewDetails: "انقر لعرض التفاصيل",
    caseInfoSection: "معلومات القضية",
    judgmentDetailsSection: "تفاصيل الحكم",
    appealDetailsSection: "تفاصيل الاستئناف",
    judgmentNarrationsSection: "روايات الحكم",
    appealNarrationsSection: "روايات الاستئناف",
    originalTextSection: "النص الأصلي",
    rawDataSection: "بيانات JSON الخام",
    idLabel: "المعرف",
    titleLabel: "العنوان",
    decisionTitleLabel: "عنوان القرار",
    yearLabel: "السنة",
    hijriYearLabel: "السنة الهجرية",
    exportDateLabel: "تاريخ التصدير",
    judgmentNumberLabel: "رقم الحكم",
    dateLabel: "التاريخ",
    judgmentDateLabel: "تاريخ الحكم",
    judgmentHijriDateLabel: "تاريخ الحكم الهجري",
    courtLabel: "المحكمة",
    judgmentCourtNameLabel: "محكمة الحكم",
    judgmentCityNameLabel: "مدينة الحكم",
    appealNumberLabel: "رقم الاستئناف",
    appealDateLabel: "تاريخ الاستئناف",
    appealHijriDateLabel: "تاريخ الاستئناف الهجري",
    appealCourtLabel: "محكمة الاستئناف",
    appealCourtNameLabel: "محكمة الاستئناف",
    appealCityNameLabel: "مدينة الاستئناف",
    factsLabel: "الوقائع",
    judgmentFactsLabel: "وقائع الحكم",
    reasonsLabel: "الأسباب",
    judgmentReasonsLabel: "أسباب الحكم",
    rulingLabel: "المنطوق",
    judgmentRulingLabel: "منطوق الحكم",
    textOfRulingLabel: "نص الحكم",
    judgmentTextOfRulingLabel: "نص منطوق الحكم",
    judgmentNarrationListLabel: "روايات الحكم",
    appealFactsLabel: "وقائع الاستئناف",
    appealReasonsLabel: "أسباب الاستئناف",
    appealRulingLabel: "منطوق الاستئناف",
    appealTextOfRulingLabel: "نص حكم الاستئناف",
    loadingAnalysis: "جاري التحليل...",
    analysisFailedTitle: "فشل التحليل",
    errorPasteOrUpload: "يرجى لصق نص القضية أو تحميل ملف قبل التحليل.",
    errorInvalidFile: "يرجى تحميل ملفات JSON أو JSONL أو TXT أو MD صالحة.",
    errorFailedAnalysis: "فشل تحليل القضية. يرجى مراجعة وحدة التحكم لمزيد من التفاصيل.",
    errorEmptyFile: "أحد الملفات التي تم تحميلها فارغ.",
    errorInvalidJsonl: "تنسيق JSONL غير صالح: يجب أن يكون كل سطر عبارة عن كائن JSON صالح.",
    errorJsonNotArray: "تنسيق JSON غير صالح: يجب أن يحتوي الملف على مصفوفة من عناصر القضايا.",
    errorInvalidJson: "تنسيق JSON غير صالح. يرجى التحقق من محتوى الملف.",
    errorFileNotArray: "الملف الذي تم تحليله لم ينتج عنه مصفوفة من القضايا.",
    errorFileNoCases: "لا تحتوي الملفات على أي قضايا لتحليلها.",
    errorFileNonString: "لم يتم العثور على أي نص صالح في الملف.",
    errorFailedCase: (err: string) => `فشل تحليل القضية. الخطأ: ${err}`,
    errorReadFile: "فشل قراءة الملف.",
    errorLoadHistory: "تعذر تحميل سجل التحليل.",
    errorClearHistory: "تعذر مسح السجل.",
    errorExportHistory: "تعذر تصدير السجل.",
    confirmClearHistory: "هل أنت متأكد من أنك تريد مسح كل سجل التحليل؟ لا يمكن التراجع عن هذا الإجراء.",
    confirmDeleteCase: "هل أنت متأكد من أنك تريد حذف تحليل هذه القضية؟ لا يمكن التراجع عن هذا الإجراء.",
    alertNoHistoryToExport: "لا يوجد سجل تحليل لتصديره.",
    editButtonLabel: 'تعديل',
    saveButtonLabel: 'حفظ',
    savingButtonLabel: 'جاري الحفظ...',
    cancelButtonLabel: 'إلغاء',
    deleteButtonLabel: 'حذف',
    editingAnalysisTitle: 'تعديل التحليل',
    errorInvalidJsonFormat: 'صيغة JSON غير صالحة. يرجى تصحيحها قبل الحفظ.',
    errorUpdateCase: (err: string) => `فشل تحديث القضية. الخطأ: ${err}`,
    errorDeleteCase: 'تعذر حذف القضية.',
    analyzeTab: 'تحليل',
    historyTab: 'السجل',
    copyButtonLabel: 'نسخ',
    copiedButtonLabel: 'تم النسخ!',
    confirmButtonLabel: 'تأكيد',
    analyzingCasesProgress: (current: number, total: number) => `جاري تحليل القضية ${current} من ${total}...`,
    parsingFileProgress: (current: number, total: number) => `جاري معالجة الملف ${current} من ${total}...`,
    errorUploadFailedTitle: "فشل الرفع",
    errorUploadFailedMessage: (filename: string) => `تعذر رفع الملف: ${filename}`,
    filesSelected: (count: number) => {
      if (count === 1) return `تم تحديد ملف واحد`;
      if (count === 2) return `تم تحديد ملفين`;
      if (count >= 3 && count <= 10) return `تم تحديد ${count} ملفات`;
      return `تم تحديد ${count} ملفًا`;
    },
    retryButtonLabel: 'إعادة المحاولة',
    tagsLabel: 'الوسوم',
    addTagPlaceholder: 'أضف وسمًا...',
    addTagButtonLabel: 'إضافة',
    noTagsPlaceholder: 'لا توجد وسوم بعد.',
    filterByTagTooltip: 'انقر للتصفية حسب هذا الوسم',
    errorParsingTitle: "خطأ في التحليل",
    errorParsingMessage: "لم تكن استجابة النموذج بالتنسيق المتوقع (JSON).",
    errorRateLimitTitle: "تم تجاوز حد المعدل",
    errorRateLimitMessage: "لقد قمت بتقديم عدد كبير جدًا من الطلبات في فترة قصيرة.",
    errorApiKeyTitle: "مفتاح API غير صالح",
    errorApiKeyMessage: "مفتاح API المقدم غير صالح أو انتهت صلاحيته. يرجى التحقق من الإعدادات الخاصة بك.",
    errorApiTitle: "خطأ في API",
    errorApiMessage: "حدث خطأ أثناء الاتصال بخدمة التحليل.",
    errorSafetyTitle: "انتهاك سياسة السلامة",
    errorSafetyMessage: "تم حظر التحليل لأن النص المدخل قد يكون انتهك سياسات السلامة.",
    errorShortTextTitle: "محتوى غير كافٍ",
    errorShortTextMessage: "النص المقدم قصير جدًا أو يفتقر إلى السياق الكافي لإجراء تحليل هادف.",
    errorUnclearTextTitle: "سياق غير واضح",
    errorUnclearTextMessage: "لم يتمكن النموذج من فهم سياق أو بنية النص المقدم.",
    errorTokenLimitTitle: 'تم تجاوز حد الرموز',
    errorTokenLimitMessage: 'مستند أو قضية واحدة كبيرة جدًا بحيث لا يمكن تحليلها بواسطة الواجهة البرمجية.',
    viewErrorDetails: "عرض التفاصيل",
    hideErrorDetails: "إخفاء التفاصيل",
    editAndRetryButtonLabel: "تعديل وإعادة المحاولة",
    saveAndRetryButtonLabel: "حفظ وإعادة المحاولة",
    adminDashboardButton: "لوحة التحكم",
    appViewButton: "عرض التطبيق",
    adminDashboardTitle: "لوحة تحكم المسؤول",
    analyticsSection: "التحليلات",
    userManagementSection: "إدارة المستخدمين",
    contentManagementSection: "إدارة المحتوى",
    securityMonitoringSection: "الأمان والمراقبة",
    configurationSettingsSection: "الإعدادات",
    totalCasesAnalyzed: "إجمالي القضايا المحللة",
    casesWithAppeals: "قضايا باستئناف",
    analysisErrors: "أخطاء التحليل",
    totalUniqueTags: "إجمالي الوسوم الفريدة",
    casesAnalyzedLast30Days: "القضايا المحللة في آخر 30 يومًا",
    casesByAppealStatus: "القضايا حسب حالة الاستئناف",
    withAppeal: "مع استئناف",
    withoutAppeal: "بدون استئناف",
    themeLabel: "المظهر",
    lightTheme: "فاتح",
    darkTheme: "داكن",
    backendRequiredNotice: "تتطلب هذه الميزة تكاملًا مع الواجهة الخلفية وهي معطلة حاليًا.",
    caseDataManagementSection: "إدارة بيانات القضايا",
    auditLogSection: "سجل التدقيق",
    systemStatusSection: "حالة النظام",
    apiSettingsSection: "إعدادات الواجهة البرمجية",
    inviteUserButton: "دعوة مستخدم",
    userLabel: "المستخدم",
    roleLabel: "الدور",
    lastActiveLabel: "آخر نشاط",
    statusLabel: "الحالة",
    activeLabel: "نشط",
    inactiveLabel: "غير نشط",
    adminLabel: "مسؤول",
    analystLabel: "محلل",
    actionsLabel: "الإجراءات",
    bulkActionsLabel: "إجراءات جماعية",
    filterCasesPlaceholder: "تصفية القضايا...",
    dateCreatedLabel: "تاريخ الإنشاء",
    tagsCountLabel: "عدد الوسوم",
    hasAppealLabel: "يوجد استئناف",
    logIdLabel: "معرف السجل",
    actionLabel: "الإجراء",
    detailsLabel: "التفاصيل",
    timestampLabel: "الطابع الزمني",
    serviceLabel: "الخدمة",
    geminiApiLabel: "Gemini API",
    localDatabaseLabel: "قاعدة البيانات المحلية",
    operationalLabel: "فعال",
    checkingLabel: "جاري التحقق...",
    errorLabel: "خطأ",
    recheckStatusButton: "إعادة التحقق",
    apiKeyManagedByEnv: "تتم إدارته عبر متغيرات البيئة",
    safetySettingsLabel: "إعدادات الأمان",
    defaultModelLabel: "النموذج الافتراضي",
    enableAdvanceFeatures: "تمكين الميزات المتقدمة",
    addTagsButtonLabel: 'إضافة وسوم',
    deleteSelectedButtonLabel: 'حذف المحدد',
    casesSelected: (count: number) => `تم تحديد ${count} قضية`,
    addTagsToSelectedTitle: 'إضافة وسوم إلى القضايا المحددة',
    tagsToAddPlaceholder: 'أدخل الوسوم، مفصولة بفواصل...',
    confirmBulkDeleteTitle: 'تأكيد الحذف الجماعي',
    confirmBulkDeleteMessage: (count: number) => `هل أنت متأكد أنك تريد حذف ${count} من القضايا المحددة؟ لا يمكن التراجع عن هذا الإجراء.`,
    selectAllLabel: 'تحديد الكل',
    errorBulkDelete: 'فشل حذف القضايا المحددة.',
    errorBulkUpdate: 'فشل تحديث القضايا المحددة.',
    schemaSettingsSection: "إعدادات المخطط",
    schemaDescription: "حدد بنية البيانات التي سيستخرجها Gemini. قم بتعيين حقل واحد أو أكثر كمفتاح أساسي لتعريف الحالات بشكل فريد.",
    fieldNameLabel: "اسم الحقل",
    fieldTypeLabel: "النوع",
    descriptionLabel: "الوصف",
    primaryKeyLabel: "مفتاح أساسي",
    nullableLabel: "قابل للإلغاء",
    addFieldButton: "إضافة حقل",
    saveSchemaButton: "حفظ المخطط",
    savingSchemaButton: "جاري الحفظ...",
    schemaSavedSuccess: "تم حفظ المخطط بنجاح.",
    errorSavingSchema: "فشل حفظ المخطط.",
    errorLoadSchema: "فشل تحميل المخطط المخصص.",
    judicialRecordsTab: 'السجلات القضائية',
    searchByKeyword: 'ابحث بالكلمة المفتاحية...',
    filtersTitle: 'عوامل التصفية',
    filterByCourt: 'المحكمة',
    filterByCity: 'المدينة',
    filterByYear: 'السنة الهجرية',
    filterByAppeal: 'حالة الاستئناف',
    allRecords: 'الكل',
    resetFilters: 'إعادة تعيين',
    noRecordsFound: 'لم يتم العثور على سجلات قضائية.',
    selectACase: 'اختر قضية من القائمة لعرض التفاصيل.',
    tableOfContents: 'جدول المحتويات',
    casePathfinder: 'مستكشف القضايا',
    pathfinderPlaceholder: 'استكشف القضايا والسوابق ذات الصلة (الميزة قادمة قريبًا).',
    backToList: 'العودة إلى القائمة',
    errorRecord: 'سجل خطأ',
    errorMessageLabel: 'رسالة الخطأ',
    originalUrl: 'الرابط الأصلي',
    dragAndDropPrompt: 'اسحب وأفلت ملفاتك هنا',
    errorWhatHappened: "ماذا حدث؟",
    errorPossibleCauses: "الأسباب المحتملة",
    errorHowToFix: "كيفية الإصلاح",
    errorRawDetails: "تفاصيل الخطأ الخام",
    errorParsingWhatHappened: "أنشأت خدمة التحليل استجابة، ولكن لا يمكن فهمها كبيانات منظمة صالحة. يمكن أن يحدث هذا إذا انحرف الإخراج عن تنسيق JSON المتوقع.",
    errorParsingCauseAmbiguous: "كان النص المدخل غامضًا أو منسقًا بشكل غير عادي، مما أربك النموذج.",
    errorParsingCauseModelCreative: "أدت إبداعية النموذج إلى إخراج لا يتبع المخطط المطلوب بصرامة.",
    errorParsingCauseGlitch: "حدث خلل مؤقت لمرة واحدة في خدمة التحليل.",
    errorParsingFixRephrase: "حاول إعادة صياغة النص الأصلي ليكون أكثر وضوحًا ومباشرة.",
    errorParsingFixRetry: "أعد محاولة التحليل، فقد لا تحدث المشكلة مرة أخرى.",
    errorParsingFixValidateJson: "إذا كنت تقوم بالتحرير يدويًا، فتأكد من أن JSON الخاص بك صالح قبل الحفظ وإعادة المحاولة.",
    errorRateLimitWhatHappened: "أرسل التطبيق عددًا كبيرًا جدًا من الطلبات إلى خدمة التحليل في فترة زمنية قصيرة.",
    errorRateLimitCauseManyRequests: "يمكن أن يؤدي تحليل العديد من الملفات الكبيرة أو النقر على 'تحليل' بشكل متكرر إلى تشغيل حدود المعدل.",
    errorRateLimitCauseSharedResource: "قد يتم استخدام مفتاح API من قبل تطبيقات أخرى، مما يساهم في عدد الطلبات.",
    errorRateLimitFixWait: "انتظر بضع لحظات قبل إعادة محاولة التحليل.",
    errorRateLimitFixBatch: "إذا كنت تحلل ملفات متعددة، ففكر في دمجها أو الانتظار بين الدفعات.",
    errorApiKeyWhatHappened: "لم يتمكن التطبيق من المصادقة مع خدمة التحليل لأن مفتاح API غير صالح.",
    errorApiKeyCauseInvalid: "مفتاح API المخزن في تكوين البيئة غير صحيح أو تم إبطاله.",
    errorApiKeyCauseExpired: "قد يكون مفتاح API قد انتهت صلاحيته.",
    errorApiKeyFixCheckConfig: "يحتاج المسؤول إلى التحقق من أن متغير بيئة API_KEY مهيأ بشكل صحيح بمفتاح صالح.",
    errorTokenLimitWhatHappened: "المستند المقدم للتحليل أكبر من الحجم الأقصى الذي يمكن للنموذج معالجته في طلب واحد.",
    errorTokenLimitCauseLargeDoc: "النص الأصلي للقضية طويل بشكل استثنائي.",
    errorTokenLimitCauseCombinedCases: "تم لصق حالات متعددة في منطقة النص بدون فاصل '---'، مما أدى إلى معاملتها كمستند واحد كبير.",
    errorTokenLimitFixSplit: "قسّم المستند الكبير إلى ملفات أو أجزاء أصغر وقم بتحليلها بشكل منفصل.",
    errorTokenLimitFixSeparate: "إذا قمت بلصق حالات متعددة، فتأكد من فصلها بـ '---' على سطر جديد.",
    errorSafetyWhatHappened: "قامت عوامل تصفية الأمان الخاصة بالنموذج بحظر إما النص المدخل أو التحليل الذي تم إنشاؤه لأنه تم الإبلاغ عنه على أنه قد يكون ضارًا.",
    errorSafetyCauseInput: "قد يحتوي نص القضية الأصلي على محتوى أدى إلى تشغيل سياسة الأمان (على سبيل المثال، تفاصيل شخصية حساسة، لغة عدوانية).",
    errorSafetyCauseOutput: "تم الإبلاغ عن استجابة النموذج التي تم إنشاؤها على أنها غير لائقة قبل إعادتها.",
    errorSafetyFixReview: "راجع النص الأصلي وأزل أو أعد صياغة أي محتوى يمكن اعتباره حساسًا أو ضارًا أو غير أخلاقي.",
    errorSafetyFixSimplify: "حاول تبسيط النص للتركيز على الوقائع والأحكام القانونية الأساسية.",
    errorShortTextWhatHappened: "كان النص المقدم للتحليل قصيرًا جدًا أو يفتقر إلى السياق الكافي للنموذج لإنتاج نتيجة ذات معنى.",
    errorShortTextCauseEmpty: "كانت منطقة إدخال النص أو الملف الذي تم تحميله فارغًا أو يحتوي على مسافات بيضاء فقط.",
    errorShortTextCauseLacksContext: "احتوى النص على عدد قليل جدًا من الكلمات ليتم تحديده كقضية قانونية.",
    errorShortTextFixProvideMore: "قدم النص الكامل والمفصل لقضية الحكم.",
    errorShortTextFixCheckFile: "تأكد من أن الملف الذي قمت بتحميله يحتوي على محتوى القضية الصحيح.",
    errorUnclearTextWhatHappened: "لم يتمكن النموذج من تحليل بنية النص المقدم أو فهم سياقه.",
    errorUnclearTextCauseFormatting: "يحتوي النص على تنسيق ضعيف أو أخطاء إملائية كبيرة أو ليس مستندًا قانونيًا صالحًا.",
    errorUnclearTextCauseLanguage: "النص بلغة أو لهجة كافح النموذج لفهمها في سياق قانوني.",
    errorUnclearTextFixFormat: "تأكد من أن النص منسق بوضوح وتحقق من وجود أخطاء إملائية أو نحوية.",
    errorUnclearTextFixValidCase: "تأكد من أن المحتوى هو قضية حكم سعودية كاملة وصالحة.",
    errorApiWhatHappened: "حدث خطأ عام أثناء الاتصال بخدمة التحليل. قد يكون الطلب قد تم تشكيله بشكل غير صحيح أو حدثت مشكلة غير متوقعة على الخادم.",
    errorApiCauseSafety: "قد يكون النص المدخل قد انتهك سياسة أمان غير مصنفة بشكل محدد.",
    errorApiCauseInvalidInput: "لم يتمكن النموذج من معالجة النص المدخل لمجموعة متنوعة من الأسباب، مثل المحتوى غير المدعوم.",
    errorApiFixSimplify: "حاول تبسيط النص أو إعادة صياغة المحتوى.",
    errorApiFixCheckRaw: "تحقق من تفاصيل الخطأ الخام أدناه لمزيد من المعلومات الفنية.",
    errorGenericWhatHappened: "حدث خطأ غير متوقع أثناء عملية التحليل.",
    errorGenericCauseUnknown: "تعذر تحديد سبب الخطأ. قد تكون مشكلة في الشبكة أو مشكلة مؤقتة في التطبيق.",
    errorGenericFixRetry: "حاول التحليل مرة أخرى. إذا استمرت المشكلة، فتحقق من تفاصيل الخطأ الخام.",
    errorGenericFixEditText: "يمكنك أيضًا محاولة تعديل النص الأصلي إذا كنت تشك في أنه قد يكون سبب المشكلة.",
  },
  // FIX: Add English translations to resolve type errors on lines 52 and 1373, where `translations.en` was accessed but did not exist.
  en: {
    appTitle: "Judgment Case Analyzer",
    appDescription: "Paste Saudi judgment case text or upload files (JSON, JSONL, TXT, MD) containing multiple cases to extract structured data.",
    caseTextLabel: "Case Text",
    caseTextPlaceholder: "Paste one or more cases here. Separate multiple cases with '---' on a new line.",
    caseTextBatchSource: (index: number) => `Pasted Case #${index}`,
    orDivider: "or",
    uploadFileLabel: "Upload Files",
    analyzeButton: "Analyze",
    analyzingButton: "Analyzing...",
    analysisHistoryTitle: "Analysis History",
    filterPlaceholder: "Filter results...",
    clearSearchLabel: "Clear search",
    exportHistoryButton: "Export History",
    clearHistoryButton: "Clear History",
    noHistoryPlaceholder: "Your analysis history will appear here.",
    noFilterResultsPlaceholder: "No results match your search.",
    caseAnalysisTitle: "Case Analysis",
    judgmentNumberPrefix: "Judgment #",
    caseIdPrefix: "Case ID: ",
    clickViewDetails: "Click to view details",
    caseInfoSection: "Case Information",
    judgmentDetailsSection: "Judgment Details",
    appealDetailsSection: "Appeal Details",
    judgmentNarrationsSection: "Judgment Narrations",
    appealNarrationsSection: "Appeal Narrations",
    originalTextSection: "Original Text",
    rawDataSection: "Raw JSON Data",
    idLabel: "ID",
    titleLabel: "Title",
    decisionTitleLabel: "Decision Title",
    yearLabel: "Year",
    hijriYearLabel: "Hijri Year",
    exportDateLabel: "Export Date",
    judgmentNumberLabel: "Judgment Number",
    dateLabel: "Date",
    judgmentDateLabel: "Judgment Date",
    judgmentHijriDateLabel: "Judgment Hijri Date",
    courtLabel: "Court",
    judgmentCourtNameLabel: "Judgment Court Name",
    judgmentCityNameLabel: "Judgment City",
    appealNumberLabel: "Appeal Number",
    appealDateLabel: "Appeal Date",
    appealHijriDateLabel: "Appeal Hijri Date",
    appealCourtLabel: "Appeal Court",
    appealCourtNameLabel: "Appeal Court Name",
    appealCityNameLabel: "Appeal City",
    factsLabel: "Facts",
    judgmentFactsLabel: "Judgment Facts",
    reasonsLabel: "Reasons",
    judgmentReasonsLabel: "Judgment Reasons",
    rulingLabel: "Ruling",
    judgmentRulingLabel: "Judgment Ruling",
    textOfRulingLabel: "Text of Ruling",
    judgmentTextOfRulingLabel: "Text of Judgment Ruling",
    judgmentNarrationListLabel: "Judgment Narrations",
    appealFactsLabel: "Appeal Facts",
    appealReasonsLabel: "Appeal Reasons",
    appealRulingLabel: "Appeal Ruling",
    appealTextOfRulingLabel: "Text of Appeal Ruling",
    loadingAnalysis: "Analyzing...",
    analysisFailedTitle: "Analysis Failed",
    errorPasteOrUpload: "Please paste case text or upload a file before analyzing.",
    errorInvalidFile: "Please upload valid JSON, JSONL, TXT, or MD files.",
    errorFailedAnalysis: "Failed to analyze case. Please check the console for more details.",
    errorEmptyFile: "One of the uploaded files is empty.",
    errorInvalidJsonl: "Invalid JSONL format: each line must be a valid JSON object.",
    errorJsonNotArray: "Invalid JSON format: the file must contain an array of case items.",
    errorInvalidJson: "Invalid JSON format. Please check the file content.",
    errorFileNotArray: "The parsed file did not result in an array of cases.",
    errorFileNoCases: "Files do not contain any cases to analyze.",
    errorFileNonString: "No valid text found in the file.",
    errorFailedCase: (err: string) => `Failed to analyze case. Error: ${err}`,
    errorReadFile: "Failed to read file.",
    errorLoadHistory: "Could not load analysis history.",
    errorClearHistory: "Could not clear history.",
    errorExportHistory: "Could not export history.",
    confirmClearHistory: "Are you sure you want to clear all analysis history? This action cannot be undone.",
    confirmDeleteCase: "Are you sure you want to delete this case analysis? This action cannot be undone.",
    alertNoHistoryToExport: "There is no analysis history to export.",
    editButtonLabel: 'Edit',
    saveButtonLabel: 'Save',
    savingButtonLabel: 'Saving...',
    cancelButtonLabel: 'Cancel',
    deleteButtonLabel: 'Delete',
    editingAnalysisTitle: 'Editing Analysis',
    errorInvalidJsonFormat: 'Invalid JSON format. Please correct it before saving.',
    errorUpdateCase: (err: string) => `Failed to update case. Error: ${err}`,
    errorDeleteCase: 'Could not delete case.',
    analyzeTab: 'Analyze',
    historyTab: 'History',
    copyButtonLabel: 'Copy',
    copiedButtonLabel: 'Copied!',
    confirmButtonLabel: 'Confirm',
    analyzingCasesProgress: (current: number, total: number) => `Analyzing case ${current} of ${total}...`,
    parsingFileProgress: (current: number, total: number) => `Processing file ${current} of ${total}...`,
    errorUploadFailedTitle: "Upload Failed",
    errorUploadFailedMessage: (filename: string) => `Could not upload file: ${filename}`,
    filesSelected: (count: number) => {
      if (count === 1) return `1 file selected`;
      return `${count} files selected`;
    },
    retryButtonLabel: 'Retry',
    tagsLabel: 'Tags',
    addTagPlaceholder: 'Add a tag...',
    addTagButtonLabel: 'Add',
    noTagsPlaceholder: 'No tags yet.',
    filterByTagTooltip: 'Click to filter by this tag',
    errorParsingTitle: "Parsing Error",
    errorParsingMessage: "The model's response was not in the expected format (JSON).",
    errorRateLimitTitle: "Rate Limit Exceeded",
    errorRateLimitMessage: "You have made too many requests in a short period.",
    errorApiKeyTitle: "Invalid API Key",
    errorApiKeyMessage: "The provided API key is invalid or has expired. Please check your settings.",
    errorApiTitle: "API Error",
    errorApiMessage: "An error occurred while contacting the analysis service.",
    errorSafetyTitle: "Safety Policy Violation",
    errorSafetyMessage: "The analysis was blocked because the input text may have violated safety policies.",
    errorShortTextTitle: "Insufficient Content",
    errorShortTextMessage: "The provided text is too short or lacks sufficient context for a meaningful analysis.",
    errorUnclearTextTitle: "Unclear Context",
    errorUnclearTextMessage: "The model could not understand the context or structure of the provided text.",
    errorTokenLimitTitle: 'Token Limit Exceeded',
    errorTokenLimitMessage: 'A single document or case is too large for the API to analyze.',
    viewErrorDetails: "View Details",
    hideErrorDetails: "Hide Details",
    editAndRetryButtonLabel: "Edit & Retry",
    saveAndRetryButtonLabel: "Save & Retry",
    adminDashboardButton: "Admin Dashboard",
    appViewButton: "App View",
    adminDashboardTitle: "Admin Dashboard",
    analyticsSection: "Analytics",
    userManagementSection: "User Management",
    contentManagementSection: "Content Management",
    securityMonitoringSection: "Security & Monitoring",
    configurationSettingsSection: "Configuration",
    totalCasesAnalyzed: "Total Cases Analyzed",
    casesWithAppeals: "Cases with Appeals",
    analysisErrors: "Analysis Errors",
    totalUniqueTags: "Total Unique Tags",
    casesAnalyzedLast30Days: "Cases Analyzed (Last 30 Days)",
    casesByAppealStatus: "Cases by Appeal Status",
    withAppeal: "With Appeal",
    withoutAppeal: "Without Appeal",
    themeLabel: "Theme",
    lightTheme: "Light",
    darkTheme: "Dark",
    backendRequiredNotice: "This feature requires backend integration and is currently disabled.",
    caseDataManagementSection: "Case Data Management",
    auditLogSection: "Audit Log",
    systemStatusSection: "System Status",
    apiSettingsSection: "API Settings",
    inviteUserButton: "Invite User",
    userLabel: "User",
    roleLabel: "Role",
    lastActiveLabel: "Last Active",
    statusLabel: "Status",
    activeLabel: "Active",
    inactiveLabel: "Inactive",
    adminLabel: "Admin",
    analystLabel: "Analyst",
    actionsLabel: "Actions",
    bulkActionsLabel: "Bulk Actions",
    filterCasesPlaceholder: "Filter cases...",
    dateCreatedLabel: "Date Created",
    tagsCountLabel: "Tags Count",
    hasAppealLabel: "Has Appeal",
    logIdLabel: "Log ID",
    actionLabel: "Action",
    detailsLabel: "Details",
    timestampLabel: "Timestamp",
    serviceLabel: "Service",
    geminiApiLabel: "Gemini API",
    localDatabaseLabel: "Local Database",
    operationalLabel: "Operational",
    checkingLabel: "Checking...",
    errorLabel: "Error",
    recheckStatusButton: "Re-check",
    apiKeyManagedByEnv: "Managed via environment variables",
    safetySettingsLabel: "Safety Settings",
    defaultModelLabel: "Default Model",
    enableAdvanceFeatures: "Enable Advanced Features",
    addTagsButtonLabel: 'Add Tags',
    deleteSelectedButtonLabel: 'Delete Selected',
    casesSelected: (count: number) => `${count} case(s) selected`,
    addTagsToSelectedTitle: 'Add Tags to Selected Cases',
    tagsToAddPlaceholder: 'Enter tags, separated by commas...',
    confirmBulkDeleteTitle: 'Confirm Bulk Delete',
    confirmBulkDeleteMessage: (count: number) => `Are you sure you want to delete ${count} selected case(s)? This action cannot be undone.`,
    selectAllLabel: 'Select All',
    errorBulkDelete: 'Failed to delete selected cases.',
    errorBulkUpdate: 'Failed to update selected cases.',
    schemaSettingsSection: "Schema Settings",
    schemaDescription: "Define the data structure Gemini will extract. Set one or more fields as a primary key to uniquely identify cases.",
    fieldNameLabel: "Field Name",
    fieldTypeLabel: "Type",
    descriptionLabel: "Description",
    primaryKeyLabel: "Primary Key",
    nullableLabel: "Nullable",
    addFieldButton: "Add Field",
    saveSchemaButton: "Save Schema",
    savingSchemaButton: "Saving Schema...",
    schemaSavedSuccess: "Schema saved successfully.",
    errorSavingSchema: "Failed to save schema.",
    errorLoadSchema: "Failed to load custom schema.",
    judicialRecordsTab: 'Judicial Records',
    searchByKeyword: 'Search by keyword...',
    filtersTitle: 'Filters',
    filterByCourt: 'Court',
    filterByCity: 'City',
    filterByYear: 'Hijri Year',
    filterByAppeal: 'Appeal Status',
    allRecords: 'All',
    resetFilters: 'Reset',
    noRecordsFound: 'No judicial records found.',
    selectACase: 'Select a case from the list to view details.',
    tableOfContents: 'Table of Contents',
    casePathfinder: 'Case Pathfinder',
    pathfinderPlaceholder: 'Explore related cases and precedents (feature coming soon).',
    backToList: 'Back to List',
    errorRecord: 'Error Record',
    errorMessageLabel: 'Error Message',
    originalUrl: 'Original URL',
    dragAndDropPrompt: 'Drag and drop your files here',
    errorWhatHappened: "What happened?",
    errorPossibleCauses: "Possible Causes",
    errorHowToFix: "How to Fix",
    errorRawDetails: "Raw Error Details",
    errorParsingWhatHappened: "The analysis service generated a response, but it could not be understood as valid, structured data. This can happen if the output deviated from the expected JSON format.",
    errorParsingCauseAmbiguous: "The input text was ambiguous or unusually formatted, which confused the model.",
    errorParsingCauseModelCreative: "The model's creativity led to an output that didn't strictly follow the required schema.",
    errorParsingCauseGlitch: "A temporary, one-off glitch occurred in the analysis service.",
    errorParsingFixRephrase: "Try rephrasing the original text to be more clear and direct.",
    errorParsingFixRetry: "Retry the analysis, as the issue may not occur again.",
    errorParsingFixValidateJson: "If you are editing manually, ensure your JSON is valid before saving and retrying.",
    errorRateLimitWhatHappened: "The application sent too many requests to the analysis service in a short period.",
    errorRateLimitCauseManyRequests: "Analyzing many large files or clicking 'Analyze' repeatedly can trigger rate limits.",
    errorRateLimitCauseSharedResource: "The API key might be used by other applications, contributing to the request count.",
    errorRateLimitFixWait: "Wait a few moments before retrying the analysis.",
    errorRateLimitFixBatch: "If analyzing multiple files, consider merging them or waiting between batches.",
    errorApiKeyWhatHappened: "The application could not authenticate with the analysis service because the API key is invalid.",
    errorApiKeyCauseInvalid: "The API key stored in the environment configuration is incorrect or has been revoked.",
    errorApiKeyCauseExpired: "The API key may have expired.",
    errorApiKeyFixCheckConfig: "An administrator needs to verify that the API_KEY environment variable is correctly configured with a valid key.",
    errorTokenLimitWhatHappened: "The document provided for analysis is larger than the maximum size the model can process in a single request.",
    errorTokenLimitCauseLargeDoc: "The original text of the case is exceptionally long.",
    errorTokenLimitCauseCombinedCases: "Multiple cases were pasted into the text area without a '---' separator, causing them to be treated as one large document.",
    errorTokenLimitFixSplit: "Split the large document into smaller files or chunks and analyze them separately.",
    errorTokenLimitFixSeparate: "If you pasted multiple cases, ensure they are separated by '---' on a new line.",
    errorSafetyWhatHappened: "The model's safety filters blocked either the input text or the generated analysis because it was flagged as potentially harmful.",
    errorSafetyCauseInput: "The original case text may have contained content that triggered a safety policy (e.g., sensitive personal details, aggressive language).",
    errorSafetyCauseOutput: "The model's generated response was flagged as inappropriate before being returned.",
    errorSafetyFixReview: "Review the original text and remove or rephrase any content that could be considered sensitive, harmful, or unethical.",
    errorSafetyFixSimplify: "Try simplifying the text to focus on the core legal facts and judgments.",
    errorShortTextWhatHappened: "The text provided for analysis was too short or lacked enough context for the model to produce a meaningful result.",
    errorShortTextCauseEmpty: "The text input area or uploaded file was empty or contained only whitespace.",
    errorShortTextCauseLacksContext: "The text contained too few words to be identified as a legal case.",
    errorShortTextFixProvideMore: "Provide the full, detailed text of the judgment case.",
    errorShortTextFixCheckFile: "Ensure the file you uploaded contains the correct case content.",
    errorUnclearTextWhatHappened: "The model was unable to parse the structure of the provided text or understand its context.",
    errorUnclearTextCauseFormatting: "The text has poor formatting, significant typos, or is not a valid legal document.",
    errorUnclearTextCauseLanguage: "The text is in a language or dialect the model struggled to understand in a legal context.",
    errorUnclearTextFixFormat: "Ensure the text is clearly formatted and check for typos or grammatical errors.",
    errorUnclearTextFixValidCase: "Verify the content is a complete and valid Saudi judgment case.",
    errorApiWhatHappened: "A general error occurred while communicating with the analysis service. The request may have been malformed or an unexpected issue happened on the server.",
    errorApiCauseSafety: "The input text may have violated a safety policy that was not specifically categorized.",
    errorApiCauseInvalidInput: "The model was unable to process the input text for a variety of reasons, such as unsupported content.",
    errorApiFixSimplify: "Try simplifying the text or rephrasing the content.",
    errorApiFixCheckRaw: "Check the raw error details below for more technical information.",
    errorGenericWhatHappened: "An unexpected error occurred during the analysis process.",
    errorGenericCauseUnknown: "The cause of the error could not be determined. It might be a network issue or a temporary application problem.",
    errorGenericFixRetry: "Try the analysis again. If the problem persists, check the raw error details.",
    errorGenericFixEditText: "You can also try editing the original text if you suspect it might be causing the issue.",
  }
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(LOG_STORE_NAME)) {
        db.createObjectStore(LOG_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      // Remove schema store if it exists from a previous version
      if (db.objectStoreNames.contains('schema_store')) {
        db.deleteObjectStore('schema_store');
      }
      if (!db.objectStoreNames.contains(JUDICIAL_RECORDS_STORE_NAME)) {
        db.createObjectStore(JUDICIAL_RECORDS_STORE_NAME, { keyPath: 'case_id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const addLogEntry = (action: string, details: string): Promise<number> => {
  return openDB().then(db => {
    return new Promise<number>((resolve, reject) => {
      const transaction = db.transaction(LOG_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(LOG_STORE_NAME);
      const log = { action, details, timestamp: Date.now() };
      const request = store.add(log);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  });
};

const getLogEntries = (): Promise<any[]> => {
    return openDB().then(db => {
        return new Promise<any[]>((resolve, reject) => {
            const transaction = db.transaction(LOG_STORE_NAME, 'readonly');
            const store = transaction.objectStore(LOG_STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result.sort((a,b) => b.timestamp - a.timestamp));
            request.onerror = () => reject(request.error);
        });
    });
};

const putCaseInDB = (record: CaseRecord): Promise<number> => {
  return openDB().then(db => {
    return new Promise<number>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  });
};

const deleteCaseFromDB = (id: number): Promise<void> => {
  return openDB().then(db => {
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
};

const bulkDeleteCasesFromDB = (ids: number[]): Promise<void> => {
  return openDB().then(db => {
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      ids.forEach(id => {
        store.delete(id);
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  });
};

const bulkUpdateCasesInDB = (updates: Map<number, CaseRecord>): Promise<void> => {
    return openDB().then(db => {
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            updates.forEach(record => {
                store.put(record);
            });

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    });
};

const getAllCasesFromDB = (): Promise<CaseRecord[]> => {
  return openDB().then(db => {
    return new Promise<CaseRecord[]>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => resolve(getAllRequest.result.sort((a,b) => b.timestamp - a.timestamp));
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  });
};

const clearAllCasesFromDB = (): Promise<void> => {
  return openDB().then(db => {
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  });
};

const getJudicialRecordsFromDB = (): Promise<any[]> => {
    return openDB().then(db => {
        return new Promise<any[]>((resolve, reject) => {
            const transaction = db.transaction(JUDICIAL_RECORDS_STORE_NAME, 'readonly');
            const store = transaction.objectStore(JUDICIAL_RECORDS_STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => {
                const sortedRecords = request.result.sort((a, b) => {
                    const dateA = new Date(a.scraped_at).getTime();
                    const dateB = new Date(b.scraped_at).getTime();
                    if (isNaN(dateB)) return -1;
                    if (isNaN(dateA)) return 1;
                    return dateB - dateA;
                });
                resolve(sortedRecords);
            };
            request.onerror = (event) => reject((event.target as IDBRequest).error);
        });
    });
};

interface EditableSchemaField {
  name: string;
  type: Type;
  description: string;
  isPrimaryKey: boolean;
  nullable: boolean;
}
type EditableSchema = EditableSchemaField[];

const SCHEMA_LOCALSTORAGE_KEY = 'judgment-analyzer-custom-schema';

const getCustomSchemaFromLocalStorage = (): EditableSchema | null => {
    try {
        const schemaJson = localStorage.getItem(SCHEMA_LOCALSTORAGE_KEY);
        if (schemaJson) {
            return JSON.parse(schemaJson);
        }
        return null;
    } catch (error) {
        console.error("Failed to load custom schema from localStorage", error);
        return null;
    }
};

const saveCustomSchemaToLocalStorage = (schema: EditableSchema): void => {
    try {
        localStorage.setItem(SCHEMA_LOCALSTORAGE_KEY, JSON.stringify(schema));
    } catch (error) {
        console.error("Failed to save custom schema to localStorage", error);
        throw error;
    }
};

const DEFAULT_GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: 'The ID of the case.', nullable: true },
    title: { type: Type.STRING, description: 'The main title of the case document.', nullable: true },
    decisionTitle: { type: Type.STRING, description: 'The title of the decision.', nullable: true },
    hijriYear: { type: Type.INTEGER, description: 'The Hijri year of the decision.', nullable: true },
    year: { type: Type.INTEGER, description: 'The Gregorian year of the decision.', nullable: true },
    hasJudgment: { type: Type.BOOLEAN, description: 'Indicates if a judgment has been made.', nullable: true },
    judgmentNumber: { type: Type.STRING, description: 'The official number of the judgment.', nullable: true },
    judgmentHijriDate: { type: Type.STRING, description: 'The Hijri date of the judgment.', nullable: true },
    judgmentDate: { type: Type.STRING, description: 'The Gregorian date of the judgment.', nullable: true },
    judgmentFacts: { type: Type.STRING, description: 'The facts of the case leading to the judgment.', nullable: true },
    judgmentReasons: { type: Type.STRING, description: 'The reasoning behind the judgment.', nullable: true },
    judgmentRuling: { type: Type.STRING, description: 'The final ruling of the judgment.', nullable: true },
    judgmentTextOfRuling: { type: Type.STRING, description: 'The full text of the ruling.', nullable: true },
    judgmentCourtName: { type: Type.STRING, description: 'The name of the court that made the judgment.', nullable: true },
    judgmentCityName: { type: Type.STRING, description: 'The city where the court is located.', nullable: true },
    hasAppeal: { type: Type.BOOLEAN, description: 'Indicates if an appeal was made.', nullable: true },
    appealNumber: { type: Type.STRING, nullable: true, description: 'The official number of the appeal.' },
    appealDate: { type: Type.STRING, nullable: true, description: 'The Gregorian date of the appeal.' },
    appealHijriDate: { type: Type.STRING, nullable: true, description: 'The Hijri date of the appeal.' },
    appealFacts: { type: Type.STRING, nullable: true, description: 'The facts of the case leading to the appeal.' },
    appealReasons: { type: Type.STRING, nullable: true, description: 'The reasoning behind the appeal ruling.' },
    appealRuling: { type: Type.STRING, nullable: true, description: 'The final ruling of the appeal.' },
    appealTextOfRuling: { type: Type.STRING, nullable: true, description: 'The full text of the appeal ruling.' },
    appealCourtName: { type: Type.STRING, nullable: true, description: 'The name of the court that handled the appeal.' },
    appealCityName: { type: Type.STRING, nullable: true, description: 'The city where the appeal court is located.' },
    exportDate: { type: Type.STRING, description: 'The date the document was exported or published.', nullable: true },
    isFavorite: { type: Type.BOOLEAN, description: 'Indicates if the user has marked this as a favorite.', nullable: true },
    judgmentNarrationList: {
      type: Type.ARRAY,
      description: 'A list of narrations related to the judgment.',
      items: {
        type: Type.STRING,
      },
      nullable: true
    }
  }
};

const convertGeminiSchemaToEditable = (geminiSchema: typeof DEFAULT_GEMINI_SCHEMA): EditableSchema => {
    return Object.entries(geminiSchema.properties).map(([name, props]) => ({
        name,
        type: props.type as Type,
        description: props.description || '',
        isPrimaryKey: ['title', 'judgmentNumber'].includes(name), // Default PKs
        nullable: props.nullable || false,
    }));
};

const convertEditableSchemaToGemini = (editableSchema: EditableSchema) => {
    const properties = editableSchema.reduce((acc, field) => {
        if (field.name.trim()) {
            acc[field.name.trim()] = {
                type: field.type,
                description: field.description,
                nullable: field.nullable
            };
            if (field.type === Type.ARRAY) {
                // A sensible default for arrays
                (acc[field.name.trim()] as any).items = { type: Type.STRING };
            }
        }
        return acc;
    }, {} as any);

    return {
        type: Type.OBJECT,
        properties
    };
};

const DEFAULT_EDITABLE_SCHEMA = convertGeminiSchemaToEditable(DEFAULT_GEMINI_SCHEMA);

type TFunction = (key: TranslationKey, ...args: any[]) => string;

const parseFile = async (file: File, t: TFunction): Promise<string[]> => {
    const text = await file.text();
    if (!text.trim()) {
        throw new Error(t('errorEmptyFile'));
    }
    const lowerCaseName = file.name.toLowerCase();

    const extractText = (item: any): string => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
            if (item.text && typeof item.text === 'string') return item.text;
            if (item.content && typeof item.content === 'string') return item.content;
            if (item.body && typeof item.body === 'string') return item.body;
            // Fallback for objects without a clear text field
            return JSON.stringify(item); 
        }
        return String(item);
    };

    if (lowerCaseName.endsWith('.json')) {
        try {
            const data = JSON.parse(text);
            if (!Array.isArray(data)) {
                throw new Error(t('errorJsonNotArray'));
            }
            const cases = data.map(extractText).filter(c => c.trim());
            if (cases.length === 0) throw new Error(t('errorFileNoCases'));
            return cases;
        } catch (e) {
            if (e instanceof Error && (e.message === t('errorJsonNotArray') || e.message === t('errorFileNoCases'))) {
                throw e; // Re-throw our specific logical errors
            }
            // Standard parsing failed. This is often due to a JSONL-style file (multiple root objects)
            // being saved with a .json extension. We'll try to fix it.
            console.warn("Standard JSON parsing failed. Attempting to fix by treating as a stream of objects.", e);
            try {
                // This regex splits the text by whitespace that is between a '}' and a '{'.
                // This handles multiple pretty-printed or minified JSON objects concatenated in one file.
                const objectStrings = text.trim().split(/(?<=\})\s*(?=\{)/);
                const jsonArrayString = `[${objectStrings.join(',')}]`;
                const data = JSON.parse(jsonArrayString);

                // The result of the fix should be an array.
                if (!Array.isArray(data)) throw new Error(t('errorJsonNotArray'));
                
                const cases = data.map(extractText).filter(c => c.trim());
                if (cases.length === 0) throw new Error(t('errorFileNoCases'));
                return cases; // Fix succeeded
            } catch (fixError) {
                // If the fix also fails, the file is genuinely malformed.
                console.error("Attempt to fix JSON structure also failed.", fixError);
                throw new Error(t('errorInvalidJson'));
            }
        }
    } else if (lowerCaseName.endsWith('.jsonl')) {
        try {
            // A JSONL file is a stream of JSON objects.
            // We'll use a robust split-and-join approach that handles pretty-printed objects.
            const objectStrings = text.trim().split(/(?<=\})\s*(?=\{)/);
            const jsonArrayString = `[${objectStrings.join(',')}]`;
            const data = JSON.parse(jsonArrayString);

            if (!Array.isArray(data)) {
                // This would be very unusual for a JSONL file but is a good safeguard.
                throw new Error(t('errorInvalidJsonl'));
            }
            
            const cases = data.map(extractText).filter(c => c.trim());
            if (cases.length === 0) throw new Error(t('errorFileNoCases'));
            return cases;
        } catch (e) {
             console.error("JSONL parsing error:", e);
             throw new Error(t('errorInvalidJsonl'));
        }
    } else if (lowerCaseName.endsWith('.txt') || lowerCaseName.endsWith('.md')) {
        // Split by a clear separator: --- on its own line, or 3+ newlines.
        const cases = text.split(/\n\s*---\s*\n|\n{3,}/);
        const filteredCases = cases.filter(c => c.trim());
        // If no separators are found, the split will result in a single item array.
        // This is valid for single-case text files.
        if (filteredCases.length === 0) {
             // This case happens if the file only contains separators or whitespace.
             throw new Error(t('errorFileNoCases'));
        }
        return filteredCases;
    }

    return [text]; // Fallback for other allowed extensions
};

const ConfirmationDialog = ({ isOpen, title, message, onConfirm, onCancel, t }: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    t: TFunction;
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <div className="modal-content">
                <h3 id="dialog-title">{title}</h3>
                <p>{message}</p>
                <div className="modal-actions">
                    <button className="dialog-cancel-btn" onClick={onCancel}>{t('cancelButtonLabel')}</button>
                    <button className="dialog-confirm-btn" onClick={onConfirm}>{t('confirmButtonLabel')}</button>
                </div>
            </div>
        </div>
    );
};

const SummaryLoading = ({ t }: { t: TFunction }) => (
    <div className="summary-loading">
        <span>{t('loadingAnalysis')}...</span>
        <div className="small-loader"></div>
    </div>
);

// FIX: Define props as a type and use React.FC to allow React-specific props like 'key'.
type ResultCardProps = {
    record: CaseRecord;
    onUpdate: (record: CaseRecord) => Promise<void>;
    onDelete: (id: number) => void;
    onRetry: (record: CaseRecord, newText?: string) => Promise<void>;
    t: TFunction;
    locale: string;
};

const ResultCard: React.FC<ResultCardProps> = ({
    record,
    onUpdate,
    onDelete,
    onRetry,
    t,
    locale
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedJson, setEditedJson] = useState('');
    const [editedOriginalText, setEditedOriginalText] = useState('');
    const [jsonError, setJsonError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
    const [newTag, setNewTag] = useState('');

    useEffect(() => {
        // If the record is externally set to a loading state (e.g., during save),
        // reflect this as the internal saving state to manage the button's disabled status.
        if (record.loading) {
            setIsSaving(true);
        } else {
            setIsSaving(false);
        }
    }, [record.loading]);

    const handleEdit = (e: MouseEvent) => {
        e.stopPropagation();
        setEditedJson(JSON.stringify(record.analysis, null, 2));
        setEditedOriginalText(record.originalText);
        setJsonError('');
        setIsEditing(true);
        if (!isExpanded) setIsExpanded(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setJsonError('');
    };

    const handleSave = async () => {
        setJsonError('');
        try {
            const updatedAnalysis = JSON.parse(editedJson);
            const updatedRecord = { ...record, analysis: updatedAnalysis, originalText: editedOriginalText };
            await onUpdate(updatedRecord);
            setIsEditing(false);
        } catch (e) {
            setJsonError(t('errorInvalidJsonFormat'));
            console.error(e);
        }
    };

    const handleSaveAndRetry = async () => {
        setJsonError('');
        try {
            JSON.parse(editedJson); // Validate JSON first
            await onRetry(record, editedOriginalText);
            setIsEditing(false);
        } catch (e) {
            setJsonError(t('errorInvalidJsonFormat'));
            console.error(e);
        }
    };

    const handleCopy = (textToCopy: string, key: string) => {
        navigator.clipboard.writeText(textToCopy);
        setCopiedStates(prev => ({ ...prev, [key]: true }));
        setTimeout(() => {
            setCopiedStates(prev => ({ ...prev, [key]: false }));
        }, 2000);
    };
    
    const handleAddTag = (e: FormEvent) => {
        e.preventDefault();
        const tagToAdd = newTag.trim();
        if (tagToAdd && (!record.tags || !record.tags.includes(tagToAdd))) {
            const updatedRecord = { ...record, tags: [...(record.tags || []), tagToAdd] };
            onUpdate(updatedRecord);
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        const updatedRecord = { ...record, tags: record.tags?.filter(tag => tag !== tagToRemove) };
        onUpdate(updatedRecord);
    };

    const renderFieldValue = (value: any) => {
        if (value === null || value === undefined) return <span className="text-muted">N/A</span>;
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (Array.isArray(value)) {
            if (value.length === 0) return <span className="text-muted">N/A</span>;
            return <ul>{value.map((item, i) => <li key={i}>{renderFieldValue(item)}</li>)}</ul>;
        }
        if (typeof value === 'object') {
            return <pre>{JSON.stringify(value, null, 2)}</pre>;
        }
        return String(value);
    };

    const renderSection = (titleKey: TranslationKey, fields: Record<string, any>) => {
        if (!fields || Object.values(fields).every(v => v === null || v === undefined || v === '')) return null;
        return (
            <div className="result-section">
                <h4 className="result-section-title">{t(titleKey)}</h4>
                <div className="section-grid-dynamic">
                    {Object.entries(fields).map(([key, value]) => (
                        <div key={key} className="field">
                            <strong>{t(`${key}Label` as TranslationKey, key)}</strong>
                            <div className="field-value-wrapper">{renderFieldValue(value)}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };
    
    const renderErrorContent = (error: CaseError) => {
        // Handle new structured error format
        if (error.breakdown) {
            return (
                <div className="error-card-content">
                    <p className="error-card-summary">{error.summary}</p>
                    <div className="error-card-actions">
                        <button className="action-btn" onClick={() => onRetry(record)}>{t('retryButtonLabel')}</button>
                        <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleEdit(e); }}>{t('editAndRetryButtonLabel')}</button>
                    </div>
                    <details className="error-details-collapsible">
                        <summary>
                            <span className="summary-text-open">{t('hideErrorDetails')}</span>
                            <span className="summary-text-closed">{t('viewErrorDetails')}</span>
                        </summary>
                        <div className="error-details-breakdown">
                            <div className="error-details-section">
                                <h4>{t('errorWhatHappened')}</h4>
                                <p>{error.breakdown.whatHappened}</p>
                            </div>
                            <div className="error-details-section">
                                <h4>{t('errorPossibleCauses')}</h4>
                                <ul className="error-details-list">
                                    {error.breakdown.possibleCauses.map((cause, i) => <li key={i}>{cause}</li>)}
                                </ul>
                            </div>
                            <div className="error-details-section">
                                <h4>{t('errorHowToFix')}</h4>
                                <ul className="error-details-list">
                                    {error.breakdown.howToFix.map((fix, i) => <li key={i}>{fix}</li>)}
                                </ul>
                            </div>
                            {error.raw && (
                                <div className="error-details-section">
                                    <h4>{t('errorRawDetails')}</h4>
                                    <pre><code>{error.raw}</code></pre>
                                </div>
                            )}
                        </div>
                    </details>
                </div>
            );
        }
        // Fallback for old error format from service worker
        return (
            <div className="error-card-content">
                <p className="error-card-summary">{error.message || error.summary}</p>
                {error.suggestion && <p className="error-suggestion">{error.suggestion}</p>}
                <div className="error-card-actions">
                    <button className="action-btn" onClick={() => onRetry(record)}>{t('retryButtonLabel')}</button>
                    <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleEdit(e); }}>{t('editAndRetryButtonLabel')}</button>
                </div>
                 {error.raw && (
                    <details className="error-details-collapsible">
                        <summary>{t('viewErrorDetails')}</summary>
                        <pre><code>{error.raw}</code></pre>
                    </details>
                )}
            </div>
        );
    };

    const cardTitle = record.analysis?.title || record.analysis?.judgmentNumber || t('caseAnalysisTitle');
    const dateLocale = locale === 'ar' ? arLocale : enLocale;

    return (
        <div className={`result-card ${isExpanded ? 'expanded' : ''} ${record.error ? 'error-card' : ''} ${isEditing ? 'editing' : ''}`}>
            <header className="result-card-header" onClick={() => !record.loading && setIsExpanded(!isExpanded)} aria-expanded={isExpanded} role="button" tabIndex={0}>
                {record.loading && !isEditing ? ( // Show loading indicator only when not in edit mode
                    <SummaryLoading t={t} />
                ) : (
                    <>
                        <div className="summary-info">
                            <h3>{record.error ? record.error.title : cardTitle}</h3>
                            <p title={new Date(record.timestamp).toLocaleString()}>{formatDistanceToNow(new Date(record.timestamp), { addSuffix: true, locale: dateLocale })}</p>
                        </div>
                        <div className="result-card-header-controls">
                            {!isEditing && record.id !== undefined && !record.error && (
                                <button className="edit-btn" onClick={handleEdit} disabled={isSaving}>{t('editButtonLabel')}</button>
                            )}
                            {!isEditing && record.id !== undefined && (
                                <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(record.id!); }} disabled={isSaving}>{t('deleteButtonLabel')}</button>
                            )}
                            <div className="expand-indicator"></div>
                        </div>
                    </>
                )}
            </header>
            {isExpanded && !record.loading && (
                <div className="result-card-body">
                    {isEditing ? (
                        <div className="result-card-edit-body">
                            <h4>{t('editingAnalysisTitle')}</h4>
                             <div className="edit-form-field">
                                <label htmlFor={`original-text-${record.id}`}>{t('originalTextSection')}</label>
                                <textarea id={`original-text-${record.id}`} value={editedOriginalText} onChange={(e) => setEditedOriginalText(e.target.value)} rows={10}></textarea>
                            </div>
                            <div className="edit-form-field">
                                <label htmlFor={`json-data-${record.id}`}>{t('rawDataSection')}</label>
                                <textarea id={`json-data-${record.id}`} value={editedJson} onChange={(e) => setEditedJson(e.target.value)} rows={20}></textarea>
                                {jsonError && <p className="json-error">{jsonError}</p>}
                            </div>
                            <div className="edit-form-controls">
                                <button className="cancel-btn" onClick={handleCancel}>{t('cancelButtonLabel')}</button>
                                {record.error ? (
                                    <button onClick={handleSaveAndRetry} disabled={isSaving}>{isSaving ? t('savingButtonLabel') : t('saveAndRetryButtonLabel')}</button>
                                ): (
                                    <button onClick={handleSave} disabled={isSaving}>{isSaving ? t('savingButtonLabel') : t('saveButtonLabel')}</button>
                                )}
                            </div>
                        </div>
                    ) : record.error ? (
                        renderErrorContent(record.error)
                    ) : (
                        <>
                            {renderSection('caseInfoSection', {
                                id: record.analysis.id,
                                title: record.analysis.title,
                                decisionTitle: record.analysis.decisionTitle,
                                year: record.analysis.year,
                                hijriYear: record.analysis.hijriYear,
                                exportDate: record.analysis.exportDate
                            })}
                            {renderSection('judgmentDetailsSection', {
                                judgmentNumber: record.analysis.judgmentNumber,
                                judgmentDate: record.analysis.judgmentDate,
                                judgmentHijriDate: record.analysis.judgmentHijriDate,
                                judgmentCourtName: record.analysis.judgmentCourtName,
                                judgmentCityName: record.analysis.judgmentCityName,
                                judgmentFacts: record.analysis.judgmentFacts,
                                judgmentReasons: record.analysis.judgmentReasons,
                                judgmentRuling: record.analysis.judgmentRuling,
                                judgmentTextOfRuling: record.analysis.judgmentTextOfRuling,
                            })}
                            {record.analysis.hasAppeal && renderSection('appealDetailsSection', {
                                appealNumber: record.analysis.appealNumber,
                                appealDate: record.analysis.appealDate,
                                appealHijriDate: record.analysis.appealHijriDate,
                                appealCourtName: record.analysis.appealCourtName,
                                appealCityName: record.analysis.appealCityName,
                                appealFacts: record.analysis.appealFacts,
                                appealReasons: record.analysis.appealReasons,
                                appealRuling: record.analysis.appealRuling,
                                appealTextOfRuling: record.analysis.appealTextOfRuling,
                            })}
                            <div className="result-section">
                                <h4 className="result-section-title">{t('tagsLabel')}</h4>
                                <div className="tags-container">
                                {record.tags && record.tags.length > 0 ? (
                                    record.tags.map(tag => (
                                        <span key={tag} className="tag-item">
                                            {tag}
                                            <button className="remove-tag-btn" onClick={() => handleRemoveTag(tag)}>&times;</button>
                                        </span>
                                    ))
                                ) : (
                                    <p className="no-tags-placeholder">{t('noTagsPlaceholder')}</p>
                                )}
                                </div>
                                <form onSubmit={handleAddTag} className="add-tag-form">
                                    <input 
                                        type="text"
                                        className="add-tag-input"
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        placeholder={t('addTagPlaceholder')}
                                    />
                                    <button type="submit" className="add-tag-btn">{t('addTagButtonLabel')}</button>
                                </form>
                            </div>
                            <div className="result-section">
                                <div className="result-section-header">
                                    <h4 className="result-section-title">{t('originalTextSection')}</h4>
                                    <button className="copy-btn" onClick={() => handleCopy(record.originalText, 'original')}>{copiedStates['original'] ? t('copiedButtonLabel') : t('copyButtonLabel')}</button>
                                </div>
                                <pre className="original-text">{record.originalText}</pre>
                            </div>
                            <div className="result-section">
                                <div className="result-section-header">
                                    <h4 className="result-section-title">{t('rawDataSection')}</h4>
                                    <button className="copy-btn" onClick={() => handleCopy(JSON.stringify(record.analysis, null, 2), 'json')}>{copiedStates['json'] ? t('copiedButtonLabel') : t('copyButtonLabel')}</button>
                                </div>
                                <pre><code>{JSON.stringify(record.analysis, null, 2)}</code></pre>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

const JudicialRecordsSkeletonLoader = () => {
    return (
        <div className="records-viewer-layout">
            <aside className="records-sidebar skeleton-sidebar">
                <div className="filter-group skeleton-filter-group">
                    <div className="skeleton skeleton-input"></div>
                </div>
                <div className="skeleton skeleton-label" style={{ width: '40%', height: '20px', marginTop: '24px', marginBottom: '12px' }}></div>
                {[...Array(4)].map((_, i) => (
                    <div className="filter-group skeleton-filter-group" key={i}>
                        <div className="skeleton skeleton-label"></div>
                        <div className="skeleton skeleton-input"></div>
                    </div>
                ))}
                <div className="skeleton skeleton-button"></div>
            </aside>
            <main className="records-main-content skeleton-records-list">
                {[...Array(8)].map((_, i) => (
                    <div className="skeleton-record-card" key={i}>
                        <div className="skeleton skeleton-title"></div>
                        <div className="skeleton-meta-grid">
                            <div className="skeleton skeleton-meta"></div>
                            <div className="skeleton skeleton-meta"></div>
                            <div className="skeleton skeleton-meta"></div>
                        </div>
                    </div>
                ))}
            </main>
        </div>
    );
};

const RecordDetailView = ({ record, onBack, t }: { record: any; onBack: () => void; t: TFunction }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [activeSection, setActiveSection] = useState('');

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id);
                    }
                });
            },
            { rootMargin: '-20% 0px -80% 0px', threshold: 0 }
        );

        const sections = contentRef.current?.querySelectorAll('section[id]');
        sections?.forEach((section) => observer.observe(section));

        return () => sections?.forEach((section) => observer.unobserve(section));
    }, [record]);

    const tocItems = [
        ...(record.has_judgment && record.judgment_text ? [{ id: 'judgment', label: t('judgmentDetailsSection') }] : []),
        ...(record.has_appeal && record.appeal_text ? [{ id: 'appeal', label: t('appealDetailsSection') }] : []),
        ...(record.api_message && record.api_message.startsWith('خطأ') ? [{ id: 'error', label: t('errorRecord') }] : []),
    ];

    return (
        <div className="record-detail-container">
            <button onClick={onBack} className="back-to-list-btn">
                &larr; {t('backToList')}
            </button>
            <div className="record-detail-layout">
                <div className="record-detail-content" ref={contentRef}>
                    <h2>{record.title || t('caseAnalysisTitle')}</h2>
                    <div className="record-card-meta">
                        <span><strong>{t('courtLabel')}:</strong> {record.judgment_court_name || record.appeal_court_name || 'N/A'}</span>
                        <span><strong>{t('hijriYearLabel')}:</strong> {record.hijri_year || 'N/A'}</span>
                        <span><strong>{t('judgmentNumberLabel')}:</strong> {record.judgment_number || 'N/A'}</span>
                    </div>

                    {record.has_judgment && record.judgment_text && (
                        <section id="judgment" className="admin-card">
                            <div className="admin-card-header"><h3>{t('judgmentDetailsSection')}</h3></div>
                            <div className="admin-card-body" dangerouslySetInnerHTML={{ __html: record.judgment_text }} />
                        </section>
                    )}

                    {record.has_appeal && record.appeal_text && (
                        <section id="appeal" className="admin-card">
                            <div className="admin-card-header"><h3>{t('appealDetailsSection')}</h3></div>
                            <div className="admin-card-body" dangerouslySetInnerHTML={{ __html: record.appeal_text }} />
                        </section>
                    )}

                    {record.api_message && record.api_message.startsWith('خطأ') && (
                         <section id="error" className="admin-card">
                            <div className="admin-card-header"><h3>{t('errorRecord')}</h3></div>
                            <div className="admin-card-body">
                                <p><strong>{t('errorMessageLabel')}:</strong> {record.api_message}</p>
                                <p><strong>{t('originalUrl')}:</strong> <a href={record.original_url} target="_blank" rel="noopener noreferrer">{record.original_url}</a></p>
                            </div>
                        </section>
                    )}
                </div>
                <aside className="record-detail-sidebar">
                    <div className="admin-card">
                        <div className="admin-card-header"><h3>{t('tableOfContents')}</h3></div>
                        <div className="admin-card-body">
                           {tocItems.length > 0 ? (
                                <nav className="record-detail-toc">
                                    <ul>
                                        {tocItems.map(item => (
                                            <li key={item.id}>
                                                <a href={`#${item.id}`} className={activeSection === item.id ? 'active' : ''}>{item.label}</a>
                                            </li>
                                        ))}
                                    </ul>
                                </nav>
                            ) : <p>{t('noHistoryPlaceholder')}</p>}
                        </div>
                    </div>
                     <div className="admin-card">
                        <div className="admin-card-header"><h3>{t('casePathfinder')}</h3></div>
                        <div className="admin-card-body">
                            <p>{t('pathfinderPlaceholder')}</p>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};

const JudicialRecordsViewer = ({ t }: { t: TFunction }) => {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

    useEffect(() => {
        const loadRecords = async () => {
            setLoading(true);
            try {
                const dbRecords = await getJudicialRecordsFromDB();
                setRecords(dbRecords);
            } catch (error) {
                console.error("Failed to load judicial records from DB:", error);
            } finally {
                setLoading(false);
            }
        };
        loadRecords();
    }, []);

    const [filters, setFilters] = useState({
        keyword: '',
        court: 'All',
        city: 'All',
        year: 'All',
        appeal: 'All', // 'All', 'Yes', 'No'
    });

    const uniqueOptions = useMemo(() => {
        const courts = new Set<string>();
        const cities = new Set<string>();
        const years = new Set<number>();
        records.forEach(r => {
            if (r.judgment_court_name) courts.add(r.judgment_court_name);
            if (r.appeal_court_name) courts.add(r.appeal_court_name);
            if (r.judgment_city_name) cities.add(r.judgment_city_name);
            if (r.appeal_city_name) cities.add(r.appeal_city_name);
            if (r.hijri_year && r.hijri_year > 1000) years.add(r.hijri_year);
        });
        return {
            courts: Array.from(courts).sort(),
            cities: Array.from(cities).sort(),
            years: Array.from(years).sort((a, b) => b - a),
        };
    }, [records]);

    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const { keyword, court, city, year, appeal } = filters;
            const lowerKeyword = keyword.toLowerCase();

            if (lowerKeyword && !(
                (r.title?.toLowerCase() || '').includes(lowerKeyword) ||
                (r.judgment_number?.toLowerCase() || '').includes(lowerKeyword) ||
                (r.appeal_number?.toLowerCase() || '').includes(lowerKeyword) ||
                (r.judgment_text?.toLowerCase() || '').includes(lowerKeyword) ||
                (r.appeal_text?.toLowerCase() || '').includes(lowerKeyword)
            )) return false;

            if (court !== 'All' && r.judgment_court_name !== court && r.appeal_court_name !== court) return false;
            if (city !== 'All' && r.judgment_city_name !== city && r.appeal_city_name !== city) return false;
            if (year !== 'All' && r.hijri_year !== parseInt(year)) return false;

            if (appeal === 'Yes' && !r.has_appeal) return false;
            if (appeal === 'No' && r.has_appeal) return false;
            
            return true;
        });
    }, [records, filters]);
    
    const handleFilterChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleResetFilters = () => {
        setFilters({ keyword: '', court: 'All', city: 'All', year: 'All', appeal: 'All' });
    };

    if (loading) {
        return <JudicialRecordsSkeletonLoader />;
    }

    if (selectedRecord) {
        return <RecordDetailView record={selectedRecord} onBack={() => setSelectedRecord(null)} t={t} />;
    }

    return (
        <div className="records-viewer-layout">
            <aside className="records-sidebar">
                <div className="filter-group">
                    <input
                        type="search"
                        name="keyword"
                        placeholder={t('searchByKeyword')}
                        value={filters.keyword}
                        onChange={handleFilterChange}
                    />
                </div>
                <h3 className="filters-title">{t('filtersTitle')}</h3>
                <div className="filter-group">
                    <label htmlFor="court-filter">{t('filterByCourt')}</label>
                    <select id="court-filter" name="court" value={filters.court} onChange={handleFilterChange}>
                        <option value="All">{t('allRecords')}</option>
                        {uniqueOptions.courts.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="filter-group">
                    <label htmlFor="city-filter">{t('filterByCity')}</label>
                    <select id="city-filter" name="city" value={filters.city} onChange={handleFilterChange}>
                        <option value="All">{t('allRecords')}</option>
                        {uniqueOptions.cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="filter-group">
                    <label htmlFor="year-filter">{t('filterByYear')}</label>
                    <select id="year-filter" name="year" value={filters.year} onChange={handleFilterChange}>
                        <option value="All">{t('allRecords')}</option>
                        {uniqueOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div className="filter-group">
                    <label htmlFor="appeal-filter">{t('filterByAppeal')}</label>
                    <select id="appeal-filter" name="appeal" value={filters.appeal} onChange={handleFilterChange}>
                        <option value="All">{t('allRecords')}</option>
                        <option value="Yes">{t('withAppeal')}</option>
                        <option value="No">{t('withoutAppeal')}</option>
                    </select>
                </div>
                <button onClick={handleResetFilters} className="reset-filters-btn">{t('resetFilters')}</button>
            </aside>
            <main className="records-main-content">
                {filteredRecords.length > 0 ? (
                    <div className="records-list">
                        {filteredRecords.map(record => (
                            <div key={record.case_id} className={`record-card ${record.api_message && record.api_message.startsWith('خطأ') ? 'error-record' : ''}`} onClick={() => setSelectedRecord(record)} role="button" tabIndex={0}>
                                <h4>{record.title || t('caseAnalysisTitle')}</h4>
                                <div className="record-card-meta">
                                    <span>{t('courtLabel')}: {record.judgment_court_name || record.appeal_court_name || 'N/A'}</span>
                                    <span>{t('hijriYearLabel')}: {record.hijri_year || 'N/A'}</span>
                                    <span>{t('judgmentNumberLabel')}: {record.judgment_number || 'N/A'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                     <div className="placeholder">{t('noRecordsFound')}</div>
                )}
            </main>
        </div>
    );
};


function App() {
  const [caseText, setCaseText] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<FileList | null>(null);
  const [analysisResults, setAnalysisResults] = useState<CaseRecord[]>([]);
  const [schema, setSchema] = useState<EditableSchema>(DEFAULT_EDITABLE_SCHEMA);
  const [loading, setLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [language, setLanguage] = useState(localStorage.getItem('judgment-analyzer-lang') || 'ar');
  const [theme, setTheme] = useState(localStorage.getItem('judgment-analyzer-theme') || 'light');
  const [activeTab, setActiveTab] = useState('input');
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
  }>({ isOpen: false, title: '', message: '', onConfirm: null });
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; step: 'parsing' | 'analyzing' } | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [view, setView] = useState<'app' | 'admin'>('app');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('judgment-analyzer-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('judgment-analyzer-lang', language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);
  

  useEffect(() => {
    if ('serviceWorker' in navigator) {
        const registerServiceWorker = () => {
            const path = window.location.pathname;
            const scope = path.substring(0, path.lastIndexOf('/') + 1);
            const swUrl = scope + 'service-worker.js';

            navigator.serviceWorker.register(swUrl, { type: 'module' })
                .then(registration => {
                    console.log('ServiceWorker registration successful');

                    const initWorker = () => {
                        if (navigator.serviceWorker.controller) {
                            navigator.serviceWorker.controller.postMessage({
                                type: 'INIT_ANALYZER',
                                payload: { apiKey: process.env.API_KEY }
                            });
                        }
                    };

                    if (navigator.serviceWorker.controller) {
                        initWorker();
                    } else {
                        navigator.serviceWorker.addEventListener('controllerchange', initWorker, { once: true });
                    }
                })
                .catch(err => console.error('ServiceWorker registration failed: ', err));
        };

        // Defer registration until after the page has loaded to avoid "invalid state" errors.
        window.addEventListener('load', registerServiceWorker);

        const handleMessage = (event: MessageEvent) => {
            const { type, payload } = event.data;
            if (type === 'ANALYSIS_PROGRESS') {
                const { record, placeholderTimestamp } = payload;
                setAnalysisResults(prev => prev.map(r => (r.timestamp === placeholderTimestamp ? record : r)));
                setUploadProgress(prev => prev ? ({ ...prev, current: prev.current + 1 }) : null);
            } else if (type === 'ANALYSIS_COMPLETE') {
                resetUploadState();
            }
        };
        navigator.serviceWorker.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('load', registerServiceWorker);
            navigator.serviceWorker.removeEventListener('message', handleMessage);
        };
    }
  }, []); // Should only run once


  const t = useCallback((key: TranslationKey, ...args: any[]) => {
    const lang = language as 'ar' | 'en';
    const entry = translations[lang][key] || translations.en[key];
    if (typeof entry === 'function') {
      return (entry as any)(...args);
    }
    return entry;
  }, [language]);

  useEffect(() => {
    const seedDatabase = async () => {
      try {
        const isSeeded = localStorage.getItem('judicialRecordsSeeded_v2');
        if (isSeeded) return;

        const db = await openDB();
        const transaction = db.transaction(JUDICIAL_RECORDS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(JUDICIAL_RECORDS_STORE_NAME);
        
        const clearRequest = store.clear();
        await new Promise<void>((resolve, reject) => {
            clearRequest.onsuccess = () => resolve();
            clearRequest.onerror = (event) => reject((event.target as IDBRequest).error);
        });
        
        for (const record of judicialData) {
            if (record.case_id) {
                store.put(record);
            }
        }

        await new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject((event.target as IDBRequest).error);
        });
        
        localStorage.setItem('judicialRecordsSeeded_v2', 'true');
        console.log("Judicial records database seeded successfully.");
      } catch (error) {
        console.error("Failed to seed judicial records database:", error);
      }
    };

    const loadData = async () => {
      setDbLoading(true);
      try {
        await seedDatabase();
        const history = await getAllCasesFromDB();
        const customSchema = getCustomSchemaFromLocalStorage();
        
        setAnalysisResults(history);
        if (customSchema) {
          setSchema(customSchema);
        }
      } catch (err) {
        console.error("Failed to load data:", err);
        setError(t('errorLoadHistory'));
      } finally {
        setDbLoading(false);
      }
    };
    loadData();
  }, [t]);
  
  const handleSchemaUpdate = async (newSchema: EditableSchema) => {
    try {
      saveCustomSchemaToLocalStorage(newSchema);
      setSchema(newSchema);
      await addLogEntry('SCHEMA_UPDATED', `Custom schema was updated with ${newSchema.length} fields.`);
    } catch (err) {
        console.error("Failed to save schema", err);
        throw err;
    }
  };
  
  const processSelectedFiles = (files: FileList | null): boolean => {
    if (files && files.length > 0) {
        const allowedExtensions = ['.json', '.jsonl', '.txt', '.md'];
        const allValid = Array.from(files).every(file => 
            allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
        );

        if (allValid) {
            setUploadedFiles(files);
            setCaseText(''); // Clear textarea when files are selected
            setError('');
            return true;
        }
    }
    setError(t('errorInvalidFile'));
    setUploadedFiles(null);
    return false;
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!processSelectedFiles(e.target.files)) {
        // Reset file input if validation fails
        e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    processSelectedFiles(e.dataTransfer.files);
  };

  const resetUploadState = useCallback(() => {
    setLoading(false);
    setIsBatchProcessing(false);
    setUploadedFiles(null);
    setUploadProgress(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }, []);

  const classifyError = (err: unknown, rawResponse?: string): CaseError => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const raw = rawResponse || errorMessage;

    if (err instanceof SyntaxError) {
        return {
            title: t('errorParsingTitle'),
            summary: t('errorParsingMessage'),
            breakdown: {
                whatHappened: t('errorParsingWhatHappened'),
                possibleCauses: [t('errorParsingCauseAmbiguous'), t('errorParsingCauseModelCreative'), t('errorParsingCauseGlitch')],
                howToFix: [t('errorParsingFixRephrase'), t('errorParsingFixRetry'), t('errorParsingFixValidateJson')]
            },
            raw
        };
    }

    if (/rate limit/i.test(errorMessage)) {
         return {
            title: t('errorRateLimitTitle'),
            summary: t('errorRateLimitMessage'),
            breakdown: {
                whatHappened: t('errorRateLimitWhatHappened'),
                possibleCauses: [t('errorRateLimitCauseManyRequests'), t('errorRateLimitCauseSharedResource')],
                howToFix: [t('errorRateLimitFixWait'), t('errorRateLimitFixBatch')]
            },
            raw
        };
    }

     if (/API key not valid/i.test(errorMessage)) {
         return {
            title: t('errorApiKeyTitle'),
            summary: t('errorApiKeyMessage'),
            breakdown: {
                whatHappened: t('errorApiKeyWhatHappened'),
                possibleCauses: [t('errorApiKeyCauseInvalid'), t('errorApiKeyCauseExpired')],
                howToFix: [t('errorApiKeyFixCheckConfig')]
            },
            raw
        };
    }

    if (/input token count exceeds/i.test(errorMessage)) {
      return {
          title: t('errorTokenLimitTitle'),
          summary: t('errorTokenLimitMessage'),
          breakdown: {
                whatHappened: t('errorTokenLimitWhatHappened'),
                possibleCauses: [t('errorTokenLimitCauseLargeDoc'), t('errorTokenLimitCauseCombinedCases')],
                howToFix: [t('errorTokenLimitFixSplit'), t('errorTokenLimitFixSeparate')]
            },
          raw
      };
    }

    // FIX: Use a safer type assertion to check for the 'name' property on the unknown error type.
    if (err instanceof Error && 'name' in err && (err as any).name === 'GoogleGenerativeAIError') {
        if (errorMessage.includes('[400') || err.name === 'GoogleGenerativeAIError') {
            if (/safety|blocked by response safety settings/i.test(errorMessage)) {
                return {
                    title: t('errorSafetyTitle'),
                    summary: t('errorSafetyMessage'),
                    breakdown: {
                        whatHappened: t('errorSafetyWhatHappened'),
                        possibleCauses: [t('errorSafetyCauseInput'), t('errorSafetyCauseOutput')],
                        howToFix: [t('errorSafetyFixReview'), t('errorSafetyFixSimplify')]
                    },
                    raw
                };
            }
            if (/must provide a non-empty text/i.test(errorMessage) || /insufficient/i.test(errorMessage)) {
                return {
                    title: t('errorShortTextTitle'),
                    summary: t('errorShortTextMessage'),
                    breakdown: {
                        whatHappened: t('errorShortTextWhatHappened'),
                        possibleCauses: [t('errorShortTextCauseEmpty'), t('errorShortTextCauseLacksContext')],
                        howToFix: [t('errorShortTextFixProvideMore'), t('errorShortTextFixCheckFile')]
                    },
                    raw
                };
            }
            if (/malformed/i.test(errorMessage) || /could not parse/i.test(errorMessage)) {
                 return {
                    title: t('errorUnclearTextTitle'),
                    summary: t('errorUnclearTextMessage'),
                    breakdown: {
                        whatHappened: t('errorUnclearTextWhatHappened'),
                        possibleCauses: [t('errorUnclearTextCauseFormatting'), t('errorUnclearTextCauseLanguage')],
                        howToFix: [t('errorUnclearTextFixFormat'), t('errorUnclearTextFixValidCase')]
                    },
                    raw
                };
            }
            return {
                title: t('errorApiTitle'),
                summary: t('errorApiMessage'),
                breakdown: {
                    whatHappened: t('errorApiWhatHappened'),
                    possibleCauses: [t('errorApiCauseSafety'), t('errorApiCauseInvalidInput')],
                    howToFix: [t('errorApiFixSimplify'), t('errorApiFixCheckRaw')]
                },
                raw
            };
        }
    }


    return {
        title: t('analysisFailedTitle'),
        summary: t('errorFailedCase', errorMessage),
        breakdown: {
            whatHappened: t('errorGenericWhatHappened'),
            possibleCauses: [t('errorGenericCauseUnknown')],
            howToFix: [t('errorGenericFixRetry'), t('errorGenericFixEditText')]
        },
        raw
    };
  }
  
  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    if (!caseText.trim() && !uploadedFiles) {
        setError(t('errorPasteOrUpload'));
        if (activeTab !== 'input') setActiveTab('input');
        return;
    }

    setError('');

    // The entire form is now considered a batch process, so these flags are set for all analysis paths.
    setLoading(true);
    setIsBatchProcessing(true);
    setActiveTab('history');

    let allCasesToAnalyze: { text: string; source: string }[] = [];

    try {
        if (uploadedFiles) {
            const files = Array.from(uploadedFiles);
            setUploadProgress({ current: 0, total: files.length, step: 'parsing' });

            for (let index = 0; index < files.length; index++) {
                const file = files[index] as File;
                setUploadProgress({ current: index + 1, total: files.length, step: 'parsing' });
                const casesFromFile = await parseFile(file, t);
                casesFromFile.forEach(text => {
                    allCasesToAnalyze.push({ text, source: file.name });
                });
            }
        } else if (caseText.trim()) {
            const cases = caseText.trim().split(/\n\s*---\s*\n|\n{3,}/);
            const filteredCases = cases.filter(c => c.trim());

            if (filteredCases.length === 0) {
                throw new Error(t('errorShortTextMessage'));
            }

            setCaseText('');

            filteredCases.forEach((text, index) => {
                const sourceName = filteredCases.length > 1
                    ? t('caseTextBatchSource', index + 1)
                    : t('caseTextLabel');
                allCasesToAnalyze.push({ text, source: sourceName });
            });
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("File/Text parsing failed:", err);
        setError(errorMessage);
        resetUploadState(); // This sets loading to false etc.
        return;
    }

    if (allCasesToAnalyze.length === 0) {
        setError(t('errorFileNoCases'));
        resetUploadState();
        return;
    }

    // --- Unified Batch Processing Logic (for 1 or more cases) ---
    const placeholderRecords: CaseRecord[] = allCasesToAnalyze.map((caseItem, index) => ({
        originalText: `${t('caseAnalysisTitle')} from ${caseItem.source}`,
        timestamp: Date.now() + index,
        loading: true,
    }));
    setAnalysisResults(prev => [...placeholderRecords.reverse(), ...prev]);
    setUploadProgress({ current: 0, total: allCasesToAnalyze.length, step: 'analyzing' });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            registration.active?.postMessage({
                type: 'START_ANALYSIS',
                payload: {
                    cases: allCasesToAnalyze,
                    schema,
                    placeholderRecords,
                    errorTemplates: {
                        title: t('analysisFailedTitle'),
                        message: (err: string) => t('errorFailedCase', err),
                    }
                }
            });
        }).catch(err => {
            console.error("Service worker failed to become ready:", err);
            setError("Background analysis service failed to start. Please reload.");
            resetUploadState();
        });
    } else {
        setError("Background analysis is not supported on this browser.");
        resetUploadState();
    }
  };
  
  const handleRetry = async (caseToRetry: CaseRecord, newText?: string) => {
    const textToAnalyze = newText ?? caseToRetry.originalText;
    
    const tempId = caseToRetry.id || Date.now();

    setAnalysisResults(prev => prev.map(r =>
      (r.id === tempId || r.timestamp === caseToRetry.timestamp) ? { ...caseToRetry, originalText: textToAnalyze, loading: true, error: undefined } : r
    ));

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const geminiSchema = convertEditableSchemaToGemini(schema);

    let rawResponseText: string | undefined;
    try {
      const prompt = `Analyze the following legal case text in its original Arabic language from Saudi Arabia and extract the specified information in JSON format according to the provided schema. For any fields that expect long-form text (like facts, reasons, rulings), use simple markdown for formatting: use '**text**' for bolding, '*text*' for italics, '~~text~~' for strikethrough, start lines with '* ' for bullet points, '1. ' for numbered lists, and use Markdown tables for tabular data. If a field is not present in the text, use null for its value. Here is the case text: \n\n${textToAnalyze}`;
      const response = await ai.models.generateContent({
        // Use Gemini Pro for more complex analysis as requested.
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: geminiSchema,
        },
      });
      rawResponseText = response.text;
      const analysis = JSON.parse(rawResponseText);
      const successfulRecord: CaseRecord = {
        id: caseToRetry.id,
        originalText: textToAnalyze,
        analysis,
        timestamp: Date.now(),
        loading: false,
        error: undefined,
        tags: caseToRetry.tags || []
      };
      const newId = await putCaseInDB(successfulRecord);
      addLogEntry('CASE_RETRY_SUCCESS', `Successfully re-analyzed case. Original timestamp: ${caseToRetry.timestamp}. New ID: ${newId}`);
      setAnalysisResults(prev =>
        prev.map(r => (r.id === tempId || r.timestamp === caseToRetry.timestamp) ? { ...successfulRecord, id: newId } : r)
      );
    } catch (err) {
      console.error("Retry failed:", err);
      const classifiedError = classifyError(err, rawResponseText);
      addLogEntry('CASE_RETRY_FAILED', `Failed to re-analyze case. Original timestamp: ${caseToRetry.timestamp}. Error: ${classifiedError.title}`);
      const errorRecord = {
        ...caseToRetry,
        id: caseToRetry.id,
        originalText: textToAnalyze,
        loading: false,
        error: classifiedError,
      };
      await putCaseInDB(errorRecord);
      setAnalysisResults(prev =>
        prev.map(r => (r.id === tempId || r.timestamp === caseToRetry.timestamp) ? errorRecord : r)
      );
    }
  };

  const closeDialog = () => {
    setDialogConfig({ isOpen: false, title: '', message: '', onConfirm: null });
  };

  const handleClearHistory = async () => {
    setDialogConfig({
        isOpen: true,
        title: t('clearHistoryButton'),
        message: t('confirmClearHistory'),
        onConfirm: async () => {
            try {
                const oldLength = analysisResults.length;
                await clearAllCasesFromDB();
                setAnalysisResults([]);
                addLogEntry('HISTORY_CLEARED', `All ${oldLength} case(s) were cleared from history.`);
            } catch (err) {
                console.error('Failed to clear history:', err);
                setError(t('errorClearHistory'));
            } finally {
                closeDialog();
            }
        },
    });
  };

  const handleExportHistory = async () => {
    try {
      const history = await getAllCasesFromDB();
      if (history.length === 0) {
        alert(t('alertNoHistoryToExport'));
        return;
      }
  
      const exportableHistory = history.map(({ originalText, analysis, timestamp, tags }) => ({
        originalText,
        analysis,
        timestamp,
        tags
      }));
  
      const jsonString = JSON.stringify(exportableHistory, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      const date = new Date().toISOString().split('T')[0];
      link.download = `judgment_analysis_history_${date}.json`;
      
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export history:', err);
      setError(t('errorExportHistory'));
    }
  };

  const handleUpdateCase = async (updatedRecord: CaseRecord) => {
    // Set loading to true for the specific record, keeping its current data for optimistic UI
    setAnalysisResults(prev =>
        prev.map(r => r.id === updatedRecord.id ? { ...updatedRecord, loading: true } : r)
    );
    try {
        if (updatedRecord.id === undefined) {
            throw new Error("Cannot update a record without an ID.");
        }
        await putCaseInDB(updatedRecord);
        addLogEntry('CASE_UPDATED', `Case ID: ${updatedRecord.id} was updated.`);
        // On success, update the record and remove loading state
        setAnalysisResults(prev =>
            prev.map(r => r.id === updatedRecord.id ? { ...updatedRecord, loading: false } : r)
        );
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Failed to update case:", errorMessage);
        setError(t('errorUpdateCase', errorMessage));
        // On error, just remove loading state, keeping the edited content for the user to retry
        setAnalysisResults(prev =>
            prev.map(r => r.id === updatedRecord.id ? { ...updatedRecord, loading: false } : r)
        );
        throw err; // Re-throw to allow local error handling in the component
    }
  };
  
  const requestDeleteConfirmation = (idToDelete: number) => {
    setDialogConfig({
      isOpen: true,
      title: t('deleteButtonLabel'),
      message: t('confirmDeleteCase'),
      onConfirm: async () => {
        try {
          await deleteCaseFromDB(idToDelete);
          addLogEntry('CASE_DELETED', `Case ID: ${idToDelete} was deleted.`);
          setAnalysisResults(prev => prev.filter(r => r.id !== idToDelete));
        } catch (err) {
          console.error('Failed to delete case:', err);
          setError(t('errorDeleteCase'));
        } finally {
          closeDialog();
        }
      },
    });
  };

  const handleBulkDeleteCases = async (idsToDelete: number[]) => {
    setDialogConfig({
        isOpen: true,
        title: t('confirmBulkDeleteTitle'),
        message: t('confirmBulkDeleteMessage', idsToDelete.length),
        onConfirm: async () => {
            try {
                await bulkDeleteCasesFromDB(idsToDelete);
                addLogEntry('BULK_DELETE_SUCCESS', `Successfully deleted ${idsToDelete.length} cases.`);
                setAnalysisResults(prev => prev.filter(r => r.id === undefined || !idsToDelete.includes(r.id)));
            } catch (err) {
                 console.error('Failed to bulk delete cases:', err);
                 setError(t('errorBulkDelete'));
            } finally {
                closeDialog();
            }
        },
    });
  };

  const handleBulkUpdateCases = async (updatedRecords: Map<number, CaseRecord>) => {
    try {
        await bulkUpdateCasesInDB(updatedRecords);
        addLogEntry('BULK_TAG_SUCCESS', `Successfully tagged ${updatedRecords.size} cases.`);
        
        setAnalysisResults(prev => prev.map(record => {
            if (record.id !== undefined && updatedRecords.has(record.id)) {
                return updatedRecords.get(record.id)!;
            }
            return record;
        }));

    } catch(err) {
        console.error('Failed to bulk update cases:', err);
        setError(t('errorBulkUpdate'));
    }
  };


  const filteredResults = useMemo(() => {
    if (!searchTerm.trim()) {
      return analysisResults;
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return analysisResults.filter(record => {
      const textMatch = record.originalText.toLowerCase().includes(lowerCaseSearchTerm);
      const analysisMatch = record.analysis ?
        JSON.stringify(record.analysis).toLowerCase().includes(lowerCaseSearchTerm) :
        false;
      const tagMatch = record.tags?.some(tag => tag.toLowerCase().includes(lowerCaseSearchTerm));
      return textMatch || analysisMatch || tagMatch;
    });
  }, [analysisResults, searchTerm]);

  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    analysisResults.forEach(record => {
        record.tags?.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }, [analysisResults]);


  return (
    <main className="container">
      <header>
        <div className="header-top-controls">
            <div className="theme-switcher">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                <label className="switch">
                    <input
                        type="checkbox"
                        checked={theme === 'dark'}
                        onChange={() => {
                            const newTheme = theme === 'light' ? 'dark' : 'light';
                            setTheme(newTheme);
                            addLogEntry('SETTINGS_THEME_CHANGED', `Theme changed to ${newTheme}.`);
                        }}
                        aria-label="Toggle theme"
                    />
                    <span className="slider round"></span>
                </label>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            </div>
        </div>
        <h1>{t('appTitle')}</h1>
        <p>{t('appDescription')}</p>
      </header>
      
      {/* Admin View / App View Toggle would go here if implemented in UI */}

      <div className="tabs-container">
          <button className={`tab-button ${activeTab === 'input' ? 'active' : ''}`} onClick={() => setActiveTab('input')} id="analyze-tab" aria-controls="analyze-panel" aria-selected={activeTab === 'input'} role="tab">{t('analyzeTab')}</button>
          <button className={`tab-button ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')} id="history-tab" aria-controls="history-panel" aria-selected={activeTab === 'history'} role="tab">{t('historyTab')}</button>
          <button className={`tab-button ${activeTab === 'judicialRecords' ? 'active' : ''}`} onClick={() => setActiveTab('judicialRecords')} id="records-tab" aria-controls="records-panel" aria-selected={activeTab === 'judicialRecords'} role="tab">{t('judicialRecordsTab')}</button>
      </div>

      {activeTab === 'input' && (
        <section className="input-section" id="analyze-panel" role="tabpanel" aria-labelledby="analyze-tab">
          <form onSubmit={handleAnalyze}>
            <label htmlFor="case-text">{t('caseTextLabel')}</label>
            <textarea
              id="case-text"
              rows={10}
              placeholder={t('caseTextPlaceholder')}
              value={caseText}
              onChange={(e) => {
                setCaseText(e.target.value);
                if (e.target.value.trim() && uploadedFiles) {
                  setUploadedFiles(null);
                  const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                  if (fileInput) fileInput.value = '';
                }
              }}
              disabled={loading}
            ></textarea>

            <div className="divider">{t('orDivider')}</div>

            <label
              htmlFor="file-upload"
              className={`drop-zone ${isDraggingOver ? 'drag-over' : ''}`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                id="file-upload"
                type="file"
                multiple
                onChange={handleFileChange}
                accept=".json,.jsonl,.txt,.md"
                disabled={loading}
              />
              {uploadedFiles && uploadedFiles.length > 0 ? (
                <div className="file-list-display">
                  <div className="file-list-title">{t('filesSelected', uploadedFiles.length)}</div>
                  <ul className="file-list">
                    {Array.from(uploadedFiles).map((file, index) => (
                      <li key={index} className="file-list-item">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                        <span>{file.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="drop-zone-content">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <p className="drop-zone-text">{t('dragAndDropPrompt')}</p>
                  <span className="file-label">{t('uploadFileLabel')}</span>
                </div>
              )}
            </label>

            {error && <p className="error-message">{error}</p>}
            
            <button type="submit" disabled={loading}>
              {loading ? t('analyzingButton') : t('analyzeButton')}
            </button>
            {isBatchProcessing && uploadProgress && (
              <div className="progress-indicator">
                  <p>
                    {uploadProgress.step === 'parsing' 
                        ? t('parsingFileProgress', uploadProgress.current, uploadProgress.total)
                        : t('analyzingCasesProgress', uploadProgress.current, uploadProgress.total)
                    }
                  </p>
                  <div className="progress-bar-container">
                      <div 
                          className="progress-bar"
                          style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                      ></div>
                  </div>
              </div>
            )}
          </form>
        </section>
      )}

      {activeTab === 'history' && (
        <section className="output-section" id="history-panel" role="tabpanel" aria-labelledby="history-tab">
          {dbLoading ? (
            <div className="loader"></div>
          ) : (
            <>
              <div className="results-header">
                <h2>{t('analysisHistoryTitle')}</h2>
                <div className="header-controls">
                  <div className="search-input-wrapper">
                    <input
                      type="search"
                      placeholder={t('filterPlaceholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      aria-label={t('filterPlaceholder')}
                    />
                    {searchTerm && <button onClick={() => setSearchTerm('')} className="clear-search-btn" aria-label={t('clearSearchLabel')}>&times;</button>}
                  </div>
                  <div className="button-group">
                    <button onClick={handleExportHistory} className="export-history-btn" disabled={analysisResults.length === 0}>{t('exportHistoryButton')}</button>
                    <button onClick={handleClearHistory} className="clear-history-btn" disabled={analysisResults.length === 0}>{t('clearHistoryButton')}</button>
                  </div>
                </div>
              </div>
              
              {filteredResults.length > 0 ? (
                <div className="results-container">
                  {filteredResults.map((result) => (
                    <ResultCard
                      key={result.id || result.timestamp}
                      record={result}
                      onUpdate={handleUpdateCase}
                      onDelete={requestDeleteConfirmation}
                      onRetry={handleRetry}
                      t={t}
                      locale={language}
                    />
                  ))}
                </div>
              ) : (
                searchTerm ? (
                  <div className="placeholder">{t('noFilterResultsPlaceholder')}</div>
                ) : (
                  <div className="placeholder">{t('noHistoryPlaceholder')}</div>
                )
              )}
            </>
          )}
        </section>
      )}

      {activeTab === 'judicialRecords' && (
        <section className="output-section" id="records-panel" role="tabpanel" aria-labelledby="records-tab">
            <JudicialRecordsViewer t={t} />
        </section>
      )}

      <ConfirmationDialog
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        onConfirm={() => dialogConfig.onConfirm?.()}
        onCancel={closeDialog}
        t={t}
      />
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);