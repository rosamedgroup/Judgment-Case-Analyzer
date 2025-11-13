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
// FIX: Switched to date-fns v3 submodule imports to resolve module export errors. This ensures compatibility with build tools that may not correctly handle the main package entry point.
import { format } from 'date-fns/format';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { subDays } from 'date-fns/subDays';
import { startOfDay } from 'date-fns/startOfDay';
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
    appTitle: "محلل الأحكام",
    appDescription: "حلل الأحكام القضائية السعودية. الصق نص القضية أو قم بتحميل ملفات (JSON, JSONL, TXT, MD) لاستخراج رؤى منظمة.",
    caseTextLabel: "نص القضية",
    caseTextPlaceholder: "الصق قضية واحدة أو أكثر. افصل بين القضايا بـ '---' على سطر جديد.",
    caseTextBatchSource: (index: number) => `قضية ملصقة #${index}`,
    orDivider: "أو",
    uploadFileLabel: "تحميل ملفات",
    analyzeButton: "تحليل",
    analyzingButton: "جاري التحليل...",
    analysisHistoryTitle: "السجل",
    filterPlaceholder: "تصفية النتائج...",
    clearSearchLabel: "مسح البحث",
    exportHistoryButton: "تصدير السجل",
    clearHistoryButton: "مسح السجل",
    noHistoryPlaceholder: "سيظهر سجل تحليلاتك هنا.",
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
    judicialRecordsTab: 'بحث القضايا',
    searchByKeyword: 'ابحث بالكلمة المفتاحية',
    searchByKeywordPlaceholder: 'مثال: عقد تجاري، إيجار',
    filtersTitle: 'عوامل التصفية',
    filterByCourt: 'المحكمة',
    filterByCourtPlaceholder: 'مثال: المحكمة العليا',
    filterByCity: 'المدينة',
    filterByYear: 'السنة الهجرية',
    filterByAppeal: 'حالة الاستئناف',
    filterByDecision: 'القرار',
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
    addCaseFromUrlButton: "إضافة قضية من رابط",
    addCaseModalTitle: "إضافة قضايا جديدة من رابط",
    addCaseModalDescription: "الصق رابطًا واحدًا أو أكثر من laws.moj.gov.sa أدناه، رابط واحد في كل سطر. سيتم جلب القضايا وتخزينها محليًا.",
    urlInputLabel: "روابط القضايا",
    urlInputPlaceholder: "أدخل رابطًا واحدًا في كل سطر...",
    addButton: "إضافة القضايا",
    addingButton: "جاري الإضافة...",
    closeButtonLabel: "إغلاق",
    addCaseSuccess: (caseNumber: string) => `تمت إضافة القضية ${caseNumber} بنجاح.`,
    addCaseExists: "هذه القضية موجودة بالفعل في قاعدة البيانات.",
    addCaseApiError: (error: string) => `فشل جلب القضية: حدث خطأ غير متوقع: ${error}`,
    addCaseApiLogicError: (error: string) => `فشل جلب القضية: أبلغت الواجهة البرمجية عن مشكلة: ${error}`,
    addCaseInvalidUrl: (url: string) => `تنسيق الرابط غير صالح: ${url}`,
    addCaseApiErrorStatus: (status: string) => `فشل جلب القضية: استجاب الخادم بخطأ (${status}).`,
    addCaseApiErrorParse: `فشل جلب القضية: لم تكن استجابة الخادم بتنسيق قابل للقراءة.`,
    addCaseApiErrorNetwork: `فشل جلب القضية: حدث خطأ في الشبكة. يرجى التحقق من اتصالك بالإنترنت.`,
    searchButton: "بحث",
    fetchingCases: "جاري جلب القضايا...",
    fetchCasesSuccess: (count: number) => `تم جلب ${count} قضية جديدة بنجاح.`,
    fetchCasesError: "فشل جلب السجلات القضائية من الواجهة البرمجية.",
    noNewCasesFound: "لم يتم العثور على قضايا جديدة مطابقة لبحثك.",
    rulingTypeElzam: "إلزام",
    rulingTypeNoJurisdiction: "عدم اختصاص",
    rulingTypeDismissal: "رفض",
    rulingTypeNonAcceptance: "عدم قبول",
  },
  en: {
    appTitle: "Judgment Analyzer",
    appDescription: "Analyze Saudi legal judgments. Paste case text or upload files (JSON, JSONL, TXT, MD) to extract structured insights.",
    caseTextLabel: "Case Text",
    caseTextPlaceholder: "Paste one or more cases. Separate multiple cases with '---' on a new line.",
    caseTextBatchSource: (index: number) => `Pasted Case #${index}`,
    orDivider: "or",
    uploadFileLabel: "Upload Files",
    analyzeButton: "Analyze",
    analyzingButton: "Analyzing...",
    analysisHistoryTitle: "History",
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
    judicialRecordsTab: 'Case Search',
    searchByKeyword: 'Search by Keyword',
    searchByKeywordPlaceholder: 'e.g., commercial contract, rent',
    filtersTitle: 'Filters',
    filterByCourt: 'Filter by Court',
    filterByCourtPlaceholder: 'e.g., Supreme Court',
    filterByCity: 'City',
    filterByYear: 'Hijri Year',
    filterByAppeal: 'Appeal Status',
    filterByDecision: 'Decision',
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
    addCaseFromUrlButton: "Add Case by URL",
    addCaseModalTitle: "Add New Cases from URL",
    addCaseModalDescription: "Paste one or more URLs from laws.moj.gov.sa below, one per line. Cases will be fetched and stored locally.",
    urlInputLabel: "Case URLs",
    urlInputPlaceholder: "Enter one URL per line...",
    addButton: "Add Cases",
    addingButton: "Adding...",
    closeButtonLabel: "Close",
    addCaseSuccess: (caseNumber: string) => `Successfully added case ${caseNumber}.`,
    addCaseExists: "This case already exists in the database.",
    addCaseApiError: (error: string) => `Failed to fetch case: An unexpected error occurred: ${error}`,
    addCaseApiLogicError: (error: string) => `Failed to fetch case: The API reported an issue: ${error}`,
    addCaseInvalidUrl: (url: string) => `Invalid URL format: ${url}`,
    addCaseApiErrorStatus: (status: string) => `Failed to fetch case: The server responded with an error (${status}).`,
    addCaseApiErrorParse: `Failed to fetch case: The server's response was not in a readable format.`,
    addCaseApiErrorNetwork: `Failed to fetch case: A network error occurred. Please check your internet connection.`,
    searchButton: "Search",
    fetchingCases: "Fetching cases...",
    fetchCasesSuccess: (count: number) => `Successfully fetched ${count} new cases.`,
    fetchCasesError: "Failed to fetch judicial records from API.",
    noNewCasesFound: "No new cases found matching your search.",
    rulingTypeElzam: "Binding",
    rulingTypeNoJurisdiction: "No Jurisdiction",
    rulingTypeDismissal: "Dismissal",
    rulingTypeNonAcceptance: "Non-acceptance",
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

const addJudicialRecordToDB = (record: any): Promise<'success' | 'exists'> => {
  return openDB().then(db => {
    return new Promise<'success' | 'exists'>((resolve, reject) => {
      const transaction = db.transaction(JUDICIAL_RECORDS_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(JUDICIAL_RECORDS_STORE_NAME);
      const getRequest = store.get(record.case_id);
      getRequest.onsuccess = () => {
        if (getRequest.result) {
          resolve('exists');
        } else {
          const addRequest = store.add(record);
          addRequest.onsuccess = () => resolve('success');
          addRequest.onerror = () => reject(addRequest.error);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
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

const isValidEditableSchema = (data: any): data is EditableSchema => {
    if (!Array.isArray(data)) return false;
    const validTypes = Object.values(Type);
    for (const item of data) {
        if (
            typeof item !== 'object' ||
            item === null ||
            typeof item.name !== 'string' ||
            typeof item.type !== 'string' ||
            !validTypes.includes(item.type) ||
            typeof item.description !== 'string' ||
            typeof item.isPrimaryKey !== 'boolean' ||
            typeof item.nullable !== 'boolean'
        ) {
            return false;
        }
    }
    return true;
};

const getCustomSchemaFromLocalStorage = (): EditableSchema | null => {
    try {
        const schemaJson = localStorage.getItem(SCHEMA_LOCALSTORAGE_KEY);
        if (schemaJson) {
            const parsedSchema = JSON.parse(schemaJson);
            if (isValidEditableSchema(parsedSchema)) {
                return parsedSchema;
            } else {
                console.warn("Invalid schema structure in localStorage. Removing and using default.");
                localStorage.removeItem(SCHEMA_LOCALSTORAGE_KEY);
                return null;
            }
        }
        return null;
    } catch (error) {
        console.error("Failed to parse schema from localStorage. Removing and using default.", error);
        localStorage.removeItem(SCHEMA_LOCALSTORAGE_KEY);
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
            if (item.originalText && typeof item.originalText === 'string') return item.originalText;
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
        const lines = text.trim().split('\n');
        const data = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) { // Skip empty lines
                try {
                    data.push(JSON.parse(line));
                } catch (e) {
                    console.error(`JSONL parsing error on line ${i + 1}:`, line, e);
                    // Throw a more informative error without needing new translations
                    throw new Error(`${t('errorInvalidJsonl')} (Error on line ${i + 1})`);
                }
            }
        }

        if (data.length === 0) {
            throw new Error(t('errorFileNoCases'));
        }
        
        const cases = data.map(extractText).filter(c => c.trim());
        if (cases.length === 0) throw new Error(t('errorFileNonString'));
        return cases;
    } else if (lowerCaseName.endsWith('.txt') || lowerCaseName.endsWith('.md')) {
        // Split by a clear separator: --- on its own line, or 3+ newlines.
        const cases = text.split(/\n---\n|\n\n\n+/).map(c => c.trim()).filter(Boolean);
        if (cases.length > 0) {
            return cases;
        }
    }
    // Fallback if no specific logic matched or worked
    if (text.trim()) {
        return [text];
    }

    throw new Error(t('errorInvalidFile'));
};


const classifyGeminiError = (error: any, t: TFunction): CaseError => {
  let title = t('errorApiTitle');
  let summary = t('errorApiMessage');
  let breakdown = {
      whatHappened: t('errorApiWhatHappened'),
      possibleCauses: [t('errorApiCauseSafety'), t('errorApiCauseInvalidInput')],
      howToFix: [t('errorApiFixSimplify'), t('errorApiFixCheckRaw')]
  };

  const errorMessage = error?.message || '';

  if (errorMessage.includes('400') && errorMessage.includes('API_KEY_INVALID')) {
      title = t('errorApiKeyTitle');
      summary = t('errorApiKeyMessage');
      breakdown = {
          whatHappened: t('errorApiKeyWhatHappened'),
          possibleCauses: [t('errorApiKeyCauseInvalid'), t('errorApiKeyCauseExpired')],
          howToFix: [t('errorApiKeyFixCheckConfig')]
      }
  } else if (errorMessage.includes('429')) {
      title = t('errorRateLimitTitle');
      summary = t('errorRateLimitMessage');
      breakdown = {
          whatHappened: t('errorRateLimitWhatHappened'),
          possibleCauses: [t('errorRateLimitCauseManyRequests'), t('errorRateLimitCauseSharedResource')],
          howToFix: [t('errorRateLimitFixWait'), t('errorRateLimitFixBatch')]
      }
  } else if (errorMessage.includes('500') || errorMessage.includes('503')) {
      // These are generic server errors, the default message is appropriate.
  } else if (errorMessage.includes('Failed to parse JSON response')) {
      title = t('errorParsingTitle');
      summary = t('errorParsingMessage');
      breakdown = {
          whatHappened: t('errorParsingWhatHappened'),
          possibleCauses: [t('errorParsingCauseAmbiguous'), t('errorParsingCauseModelCreative'), t('errorParsingCauseGlitch')],
          howToFix: [t('errorParsingFixRephrase'), t('errorParsingFixRetry'), t('errorParsingFixValidateJson')]
      };
  } else if (errorMessage.includes('user input is too long')) {
      title = t('errorTokenLimitTitle');
      summary = t('errorTokenLimitMessage');
      breakdown = {
          whatHappened: t('errorTokenLimitWhatHappened'),
          possibleCauses: [t('errorTokenLimitCauseLargeDoc'), t('errorTokenLimitCauseCombinedCases')],
          howToFix: [t('errorTokenLimitFixSplit'), t('errorTokenLimitFixSeparate')]
      };
  } else if (errorMessage.includes('SAFETY')) {
      title = t('errorSafetyTitle');
      summary = t('errorSafetyMessage');
      breakdown = {
          whatHappened: t('errorSafetyWhatHappened'),
          possibleCauses: [t('errorSafetyCauseInput'), t('errorSafetyCauseOutput')],
          howToFix: [t('errorSafetyFixReview'), t('errorSafetyFixSimplify')]
      };
  } else if (errorMessage.includes('short')) {
      title = t('errorShortTextTitle');
      summary = t('errorShortTextMessage');
      breakdown = {
          whatHappened: t('errorShortTextWhatHappened'),
          possibleCauses: [t('errorShortTextCauseEmpty'), t('errorShortTextCauseLacksContext')],
          howToFix: [t('errorShortTextFixProvideMore'), t('errorShortTextFixCheckFile')]
      };
  } else if (errorMessage.includes('context')) {
      title = t('errorUnclearTextTitle');
      summary = t('errorUnclearTextMessage');
      breakdown = {
          whatHappened: t('errorUnclearTextWhatHappened'),
          possibleCauses: [t('errorUnclearTextCauseFormatting'), t('errorUnclearTextCauseLanguage')],
          howToFix: [t('errorUnclearTextFixFormat'), t('errorUnclearTextFixValidCase')]
      };
  } else if (errorMessage.includes('400')) {
        // This is a generic "bad request" but not an API key issue. It often happens
        // if the model just can't process the input for some reason. The default "API Error" is good.
  }
  
  if (error instanceof Error) {
    return { title, summary, breakdown, raw: error.toString() };
  } else {
    // If it's not a standard Error object, try to stringify it.
    return { title, summary, breakdown, raw: typeof error === 'string' ? error : JSON.stringify(error, null, 2) };
  }
};


// FIX: Added missing ResultCard, HistoryView, JudicialRecordsViewer, and AdminDashboard components.
// These components were referenced in the App component but were not defined, causing compilation errors.

const CopyButton: React.FC<{ text: string, t: TFunction }> = ({ text, t }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button onClick={handleCopy} className="copy-btn">
            <span className="material-symbols-outlined">{copied ? 'check' : 'content_copy'}</span>
            {copied ? t('copiedButtonLabel') : t('copyButtonLabel')}
        </button>
    );
};

const ResultCard: React.FC<{ record: CaseRecord, onDelete: (id: number) => void, onUpdate: (id: number, updatedRecord: CaseRecord) => void, onRetry: (record: CaseRecord) => void, t: TFunction, dateLocale: any, setActiveTag: (tag: string | null) => void }> = ({ record, onDelete, onUpdate, onRetry, t, dateLocale, setActiveTag }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedJson, setEditedJson] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [showRawError, setShowRawError] = useState(false);

    const handleEdit = () => {
        setEditedJson(JSON.stringify(record.analysis || {}, null, 2));
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
    };

    const handleSave = () => {
        try {
            const newAnalysis = JSON.parse(editedJson);
            onUpdate(record.id!, { ...record, analysis: newAnalysis, error: undefined });
            setIsEditing(false);
        } catch (error) {
            alert(t('errorInvalidJsonFormat'));
        }
    };

    const handleAddTag = (e: FormEvent) => {
        e.preventDefault();
        if (tagInput && !record.tags?.includes(tagInput)) {
            const newTags = [...(record.tags || []), tagInput];
            onUpdate(record.id!, { ...record, tags: newTags });
            setTagInput('');
        }
    };
    
    const removeTag = (tagToRemove: string) => {
        const newTags = record.tags?.filter(tag => tag !== tagToRemove);
        onUpdate(record.id!, { ...record, tags: newTags });
    };

    const renderFieldValue = (labelKey: TranslationKey, value: any) => {
        if (value === null || value === undefined || value === '') return null;
        return (
            <p><strong>{t(labelKey)}:</strong> {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}</p>
        );
    };

    if (record.loading) {
        return (
            <div className="result-card loading">
                <div className="spinner"></div>
                <p>{t('loadingAnalysis')}</p>
            </div>
        );
    }
    
    if (record.error) {
        return (
            <div className="result-card error-card">
                <div className="result-card-header">
                    <h3>{record.error.title || t('analysisFailedTitle')}</h3>
                    <div className="card-actions">
                         <button onClick={() => onRetry(record)} className="icon-btn" title={t('retryButtonLabel')}><span className="material-symbols-outlined">refresh</span></button>
                         <button onClick={() => onDelete(record.id!)} className="icon-btn" title={t('deleteButtonLabel')}><span className="material-symbols-outlined">delete</span></button>
                    </div>
                </div>
                 <div className="result-card-body">
                    <p>{record.error.summary || record.error.message}</p>
                    {record.error.breakdown && (
                        <div className="error-breakdown">
                            <h4>{t('errorWhatHappened')}</h4>
                            <p>{record.error.breakdown.whatHappened}</p>
                            <h4>{t('errorPossibleCauses')}</h4>
                            <ul>
                                {record.error.breakdown.possibleCauses.map((cause, i) => <li key={i}>{cause}</li>)}
                            </ul>
                            <h4>{t('errorHowToFix')}</h4>
                            <ul>
                                {record.error.breakdown.howToFix.map((fix, i) => <li key={i}>{fix}</li>)}
                            </ul>
                        </div>
                    )}
                    {record.error.raw && (
                        <div className="raw-error-details">
                            <button onClick={() => setShowRawError(!showRawError)} className="details-toggle">
                            {showRawError ? t('hideErrorDetails') : t('viewErrorDetails')}
                            <span className="material-symbols-outlined">{showRawError ? 'expand_less' : 'expand_more'}</span>
                            </button>
                            {showRawError && <pre><code>{record.error.raw}</code></pre>}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const { analysis } = record;
    const title = analysis?.title || analysis?.decisionTitle || `${t('judgmentNumberPrefix')}${analysis?.judgmentNumber || 'N/A'}`;

    return (
        <div className={`result-card ${isExpanded ? 'expanded' : ''}`}>
            <div className="result-card-header" onClick={() => !isEditing && setIsExpanded(!isExpanded)} style={{ cursor: isEditing ? 'default' : 'pointer' }}>
                <h3>{title}</h3>
                <div className="card-meta">
                    <span>{t('caseIdPrefix')}{record.id}</span>
                    <span>{formatDistanceToNow(new Date(record.timestamp), { addSuffix: true, locale: dateLocale })}</span>
                </div>
                <div className="card-actions">
                     <button onClick={(e) => { e.stopPropagation(); handleEdit(); }} className="icon-btn" title={t('editButtonLabel')}><span className="material-symbols-outlined">edit</span></button>
                     <button onClick={(e) => { e.stopPropagation(); if (confirm(t('confirmDeleteCase'))) onDelete(record.id!); }} className="icon-btn" title={t('deleteButtonLabel')}><span className="material-symbols-outlined">delete</span></button>
                </div>
            </div>
            {isExpanded && !isEditing && (
                <div className="result-card-body">
                    {/* Case Info */}
                    <details open>
                        <summary>{t('caseInfoSection')}</summary>
                        <div className="details-grid">
                           {renderFieldValue('titleLabel', analysis.title)}
                           {renderFieldValue('decisionTitleLabel', analysis.decisionTitle)}
                           {renderFieldValue('yearLabel', analysis.year)}
                           {renderFieldValue('hijriYearLabel', analysis.hijriYear)}
                           {renderFieldValue('exportDateLabel', analysis.exportDate)}
                        </div>
                    </details>
                    {/* Judgment Details */}
                    {analysis.hasJudgment && (
                        <details>
                            <summary>{t('judgmentDetailsSection')}</summary>
                            <div className="details-grid">
                                {renderFieldValue('judgmentNumberLabel', analysis.judgmentNumber)}
                                {renderFieldValue('judgmentDateLabel', analysis.judgmentDate)}
                                {renderFieldValue('judgmentHijriDateLabel', analysis.judgmentHijriDate)}
                                {renderFieldValue('judgmentCourtNameLabel', analysis.judgmentCourtName)}
                                {renderFieldValue('judgmentCityNameLabel', analysis.judgmentCityName)}
                                {renderFieldValue('judgmentFactsLabel', analysis.judgmentFacts)}
                                {renderFieldValue('judgmentReasonsLabel', analysis.judgmentReasons)}
                                {renderFieldValue('judgmentRulingLabel', analysis.judgmentRuling)}
                                {renderFieldValue('judgmentTextOfRulingLabel', analysis.judgmentTextOfRuling)}
                            </div>
                        </details>
                    )}
                    {/* Appeal Details */}
                    {analysis.hasAppeal && (
                        <details>
                            <summary>{t('appealDetailsSection')}</summary>
                            <div className="details-grid">
                                {renderFieldValue('appealNumberLabel', analysis.appealNumber)}
                                {renderFieldValue('appealDateLabel', analysis.appealDate)}
                                {renderFieldValue('appealHijriDateLabel', analysis.appealHijriDate)}
                                {renderFieldValue('appealCourtNameLabel', analysis.appealCourtName)}
                                {renderFieldValue('appealCityNameLabel', analysis.appealCityName)}
                                {renderFieldValue('appealFactsLabel', analysis.appealFacts)}
                                {renderFieldValue('appealReasonsLabel', analysis.appealReasons)}
                                {renderFieldValue('appealRulingLabel', analysis.appealRuling)}
                                {renderFieldValue('appealTextOfRulingLabel', analysis.appealTextOfRuling)}
                            </div>
                        </details>
                    )}
                    {/* Raw Data */}
                     <details>
                        <summary>{t('rawDataSection')}</summary>
                        <div className="raw-data-controls">
                           <CopyButton text={JSON.stringify(analysis, null, 2)} t={t} />
                        </div>
                        <pre><code>{JSON.stringify(analysis, null, 2)}</code></pre>
                    </details>
                    {/* Original Text */}
                     <details>
                        <summary>{t('originalTextSection')}</summary>
                        <p className="original-text">{record.originalText}</p>
                    </details>
                </div>
            )}
             {isEditing && (
                <div className="result-card-edit-body">
                    <h4>{t('editingAnalysisTitle')}</h4>
                    <textarea value={editedJson} onChange={(e) => setEditedJson(e.target.value)} rows={20}></textarea>
                    <div className="edit-actions">
                        <button onClick={handleSave} className="primary">{t('saveButtonLabel')}</button>
                        <button onClick={handleCancel}>{t('cancelButtonLabel')}</button>
                    </div>
                </div>
            )}
            <div className="result-card-footer">
                <div className="tags-section">
                    <strong>{t('tagsLabel')}:</strong>
                    <div className="tags-list">
                       {record.tags && record.tags.length > 0 ? record.tags.map(tag => (
                           <span key={tag} className="tag" title={t('filterByTagTooltip')} onClick={() => setActiveTag(tag)}>
                               {tag}
                               <button onClick={(e) => { e.stopPropagation(); removeTag(tag); }} className="remove-tag">&times;</button>
                           </span>
                       )) : <span className="no-tags">{t('noTagsPlaceholder')}</span>}
                    </div>
                </div>
                <form onSubmit={handleAddTag} className="add-tag-form">
                    <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder={t('addTagPlaceholder')} />
                    <button type="submit">{t('addTagButtonLabel')}</button>
                </form>
            </div>
        </div>
    );
};

const HistoryView: React.FC<{ history: CaseRecord[], filter: string, setFilter: (f: string) => void, clearHistory: () => void, exportHistory: () => void, setHistory: React.Dispatch<React.SetStateAction<CaseRecord[]>>, t: TFunction, dateLocale: any, allTags: string[], activeTag: string | null, setActiveTag: (t: string | null) => void, analyzeCase: (text: string, sourceName: string) => Promise<CaseRecord>, getGeminiSchema: any }> = ({ history, filter, setFilter, clearHistory, exportHistory, setHistory, t, dateLocale, allTags, activeTag, setActiveTag, analyzeCase, getGeminiSchema }) => {

    const handleDelete = async (id: number) => {
        try {
            await deleteCaseFromDB(id);
            setHistory(prev => prev.filter(c => c.id !== id));
            await addLogEntry('CASE_DELETED', `Deleted case ID: ${id}`);
        } catch (error) {
            console.error(t('errorDeleteCase'), error);
            alert(t('errorDeleteCase'));
        }
    };
    
    const handleUpdate = async (id: number, updatedRecord: CaseRecord) => {
        try {
            await putCaseInDB(updatedRecord);
            setHistory(prev => prev.map(c => c.id === id ? updatedRecord : c));
            await addLogEntry('CASE_UPDATED', `Updated case ID: ${id}`);
        } catch (error) {
            console.error(t('errorUpdateCase', String(error)));
            alert(t('errorUpdateCase', String(error)));
        }
    };

    const handleRetry = async (recordToRetry: CaseRecord) => {
        if (!recordToRetry.id) return;

        const placeholder: CaseRecord = { ...recordToRetry, loading: true };
        setHistory(prev => prev.map(c => c.id === recordToRetry.id ? placeholder : c));
        
        const newRecord = await analyzeCase(recordToRetry.originalText, `Retry of Case ID ${recordToRetry.id}`);
        
        // The analyzeCase function already saves to DB, we just need to update the UI state.
        // It returns a full record with a *new* ID. We need to replace the old one.
        await deleteCaseFromDB(recordToRetry.id); // Delete the old error record
        setHistory(prev => {
            const historyWithoutOld = prev.filter(c => c.id !== recordToRetry.id);
            return [newRecord, ...historyWithoutOld].sort((a,b) => b.timestamp - a.timestamp);
        });
    };

    return (
        <>
            <h2>{t('analysisHistoryTitle')}</h2>
            <div className="history-controls">
                <div className="filter-input-container">
                    <input type="text" placeholder={t('filterPlaceholder')} value={filter} onChange={(e) => setFilter(e.target.value)} />
                    {filter && <button onClick={() => setFilter('')} className="clear-search-btn" aria-label={t('clearSearchLabel')}>&times;</button>}
                </div>
                <button onClick={exportHistory} className="secondary">{t('exportHistoryButton')}</button>
                <button onClick={clearHistory} className="danger">{t('clearHistoryButton')}</button>
            </div>
            {allTags.length > 0 && (
                 <div className="tag-filter-bar">
                    <button className={`tag-filter ${activeTag === null ? 'active' : ''}`} onClick={() => setActiveTag(null)}>{t('allRecords')}</button>
                    {allTags.map(tag => (
                       <button key={tag} className={`tag-filter ${activeTag === tag ? 'active' : ''}`} onClick={() => setActiveTag(tag)}>{tag}</button>
                    ))}
                </div>
            )}
            <div className="history-list">
                {history.length > 0 ? (
                    history.map(record => (
                        <ResultCard 
                          key={record.id || record.timestamp} 
                          record={record}
                          onDelete={handleDelete}
                          onUpdate={handleUpdate}
                          onRetry={handleRetry}
                          t={t}
                          dateLocale={dateLocale}
                          setActiveTag={setActiveTag}
                        />
                    ))
                ) : (
                    <div className="placeholder">
                        <p>{filter ? t('noFilterResultsPlaceholder') : t('noHistoryPlaceholder')}</p>
                    </div>
                )}
            </div>
        </>
    );
};

const JudicialRecordsViewer: React.FC<{ records: any[], setRecords: React.Dispatch<React.SetStateAction<any[]>>, selectedRecord: any | null, setSelectedRecord: React.Dispatch<React.SetStateAction<any | null>>, isLoading: boolean, setIsLoading: React.Dispatch<React.SetStateAction<boolean>>, t: TFunction }> = ({ records, selectedRecord, setSelectedRecord, isLoading, t }) => {
    const [filters, setFilters] = useState({
        keyword: '',
        court: '',
        city: '',
        year: '',
        appeal: 'All',
        decision: 'All',
    });

    const handleFilterChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const resetFilters = () => {
        setFilters({ keyword: '', court: '', city: '', year: '', appeal: 'All', decision: 'All' });
    };

    const filteredRecords = useMemo(() => {
        return records.filter(rec => {
            const keywordMatch = filters.keyword ? JSON.stringify(rec).toLowerCase().includes(filters.keyword.toLowerCase()) : true;
            const courtMatch = filters.court ? (rec.judgment_court_name || '').toLowerCase().includes(filters.court.toLowerCase()) : true;
            const cityMatch = filters.city ? (rec.judgment_city_name || '').toLowerCase().includes(filters.city.toLowerCase()) : true;
            const yearMatch = filters.year ? String(rec.hijri_year) === filters.year : true;
            const appealMatch = filters.appeal === 'All' ? true : (filters.appeal === 'With Appeal' ? rec.has_appeal : !rec.has_appeal);
            const decisionMatch = filters.decision === 'All' ? true : (rec.judgment_ruling === filters.decision);

            return keywordMatch && courtMatch && cityMatch && yearMatch && appealMatch && decisionMatch;
        });
    }, [records, filters]);
    
    if (selectedRecord) {
        return (
            <div className="record-detail-view">
                <button onClick={() => setSelectedRecord(null)} className="back-btn"><span className="material-symbols-outlined">arrow_back</span> {t('backToList')}</button>
                <h2>{selectedRecord.title}</h2>
                <div className="details-grid">
                    <p><strong>{t('judgmentNumberLabel')}:</strong> {selectedRecord.judgment_number}</p>
                    <p><strong>{t('judgmentHijriDateLabel')}:</strong> {selectedRecord.judgment_hijri_date}</p>
                    <p><strong>{t('judgmentCourtNameLabel')}:</strong> {selectedRecord.judgment_court_name}</p>
                    <p><strong>{t('judgmentCityNameLabel')}:</strong> {selectedRecord.judgment_city_name}</p>
                    <p><strong>{t('judgmentRulingLabel')}:</strong> {selectedRecord.judgment_ruling}</p>
                    {selectedRecord.has_appeal && <>
                        <p><strong>{t('appealNumberLabel')}:</strong> {selectedRecord.appeal_number}</p>
                        <p><strong>{t('appealHijriDateLabel')}:</strong> {selectedRecord.appeal_hijri_date}</p>
                        <p><strong>{t('appealCourtNameLabel')}:</strong> {selectedRecord.appeal_court_name}</p>
                    </>}
                </div>
                <hr/>
                <details>
                    <summary>{t('judgmentTextOfRulingLabel')}</summary>
                    <div className="record-text" dangerouslySetInnerHTML={{ __html: selectedRecord.judgment_text }}></div>
                </details>
                {selectedRecord.has_appeal && selectedRecord.appeal_text && (
                     <details>
                        <summary>{t('appealTextOfRulingLabel')}</summary>
                        <div className="record-text" dangerouslySetInnerHTML={{ __html: selectedRecord.appeal_text }}></div>
                    </details>
                )}
                <hr/>
                 <a href={selectedRecord.original_url} target="_blank" rel="noopener noreferrer" className="link-button">{t('originalUrl')}</a>
            </div>
        )
    }

    return (
        <>
            <h2 className="page-title">{t('judicialRecordsTab')}</h2>
            <div className="records-viewer-layout">
                <aside className="records-sidebar">
                    <h3>{t('filtersTitle')}</h3>
                    <div className="filter-group">
                        <label htmlFor="keyword">{t('searchByKeyword')}</label>
                        <input type="text" id="keyword" name="keyword" value={filters.keyword} onChange={handleFilterChange} placeholder={t('searchByKeywordPlaceholder')} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="court">{t('filterByCourt')}</label>
                        <input type="text" id="court" name="court" value={filters.court} onChange={handleFilterChange} placeholder={t('filterByCourtPlaceholder')} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="city">{t('filterByCity')}</label>
                        <input type="text" id="city" name="city" value={filters.city} onChange={handleFilterChange} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="year">{t('filterByYear')}</label>
                        <input type="number" id="year" name="year" value={filters.year} onChange={handleFilterChange} />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="appeal">{t('filterByAppeal')}</label>
                        <select id="appeal" name="appeal" value={filters.appeal} onChange={handleFilterChange}>
                            <option value="All">{t('allRecords')}</option>
                            <option value="With Appeal">{t('withAppeal')}</option>
                            <option value="Without Appeal">{t('withoutAppeal')}</option>
                        </select>
                    </div>
                    <div className="filter-group">
                        <label htmlFor="decision">{t('filterByDecision')}</label>
                        <select id="decision" name="decision" value={filters.decision} onChange={handleFilterChange}>
                            <option value="All">{t('allRecords')}</option>
                            <option value="إلزام">{t('rulingTypeElzam')}</option>
                            <option value="عدم اختصاص">{t('rulingTypeNoJurisdiction')}</option>
                            <option value="رفض">{t('rulingTypeDismissal')}</option>
                            <option value="عدم قبول">{t('rulingTypeNonAcceptance')}</option>
                        </select>
                    </div>
                    <button onClick={resetFilters} className="secondary">{t('resetFilters')}</button>
                </aside>
                <main className="records-main-content">
                    {isLoading ? (
                        <div className="placeholder"><div className="spinner"></div><p>{t('fetchingCases')}</p></div>
                    ) : filteredRecords.length > 0 ? (
                        <ul className="records-list">
                            {filteredRecords.map(rec => (
                                <li className="record-card" key={rec.case_id} onClick={() => setSelectedRecord(rec)}>
                                    <h4>{rec.title}</h4>
                                    <div className="record-meta">
                                        <span className="meta-item">
                                            <span className="material-symbols-outlined">gavel</span>
                                            {rec.judgment_number || 'N/A'}
                                        </span>
                                        <span className="meta-item">
                                            <span className="material-symbols-outlined">apartment</span>
                                            {rec.judgment_court_name || 'N/A'}
                                        </span>
                                        <span className="meta-item">
                                            <span className="material-symbols-outlined">calendar_month</span>
                                            {rec.judgment_hijri_date || 'N/A'}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="placeholder"><p>{t('noRecordsFound')}</p></div>
                    )}
                </main>
            </div>
        </>
    );
};

const AdminDashboard: React.FC<{ history: CaseRecord[], setHistory: React.Dispatch<React.SetStateAction<CaseRecord[]>>, allTags: string[], t: TFunction, dateLocale: any, customSchema: EditableSchema, setCustomSchema: React.Dispatch<React.SetStateAction<EditableSchema>>, handleSaveSchema: () => Promise<void>, isSavingSchema: boolean, schemaSaveStatus: 'success' | 'error' | null }> = ({ history, setHistory, allTags, t, dateLocale, customSchema, setCustomSchema, handleSaveSchema, isSavingSchema, schemaSaveStatus }) => {
    const [activeAdminTab, setActiveAdminTab] = useState('analytics');
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [selectedCases, setSelectedCases] = useState<Set<number>>(new Set());
    const [tagsToAdd, setTagsToAdd] = useState('');
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);

    useEffect(() => {
        if (activeAdminTab === 'audit') {
            getLogEntries().then(setAuditLogs);
        }
    }, [activeAdminTab]);

    const analyticsData = useMemo(() => {
        const successfulAnalyses = history.filter(c => c.analysis && !c.error);
        const totalCases = history.length;
        const casesWithAppeals = successfulAnalyses.filter(c => c.analysis.hasAppeal).length;
        const analysisErrors = history.filter(c => c.error).length;
        
        const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));
        const casesByDay = successfulAnalyses
            .filter(c => c.timestamp >= thirtyDaysAgo.getTime())
            .reduce((acc, c) => {
                const day = format(new Date(c.timestamp), 'yyyy-MM-dd');
                acc[day] = (acc[day] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

        const labels = Array.from({ length: 30 }, (_, i) => format(subDays(new Date(), i), 'MMM d')).reverse();
        const data = labels.map(label => {
            const date = new Date(label + ', ' + new Date().getFullYear()); // a bit of a hack to get the right date
            const formattedDate = format(date, 'yyyy-MM-dd');
            return casesByDay[formattedDate] || 0;
        });

        return {
            totalCases,
            casesWithAppeals,
            analysisErrors,
            casesAnalyzedLast30Days: { labels, data },
            casesByAppealStatus: {
                labels: [t('withAppeal'), t('withoutAppeal')],
                data: [casesWithAppeals, successfulAnalyses.length - casesWithAppeals],
            }
        };
    }, [history, t]);
    
    const handleSelectCase = (id: number) => {
        const newSelection = new Set(selectedCases);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedCases(newSelection);
    };
    
    const handleSelectAll = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIds = history.map(c => c.id!).filter(Boolean);
            setSelectedCases(new Set(allIds));
        } else {
            setSelectedCases(new Set());
        }
    };

    const handleBulkDelete = async () => {
        if (selectedCases.size === 0) return;
        if (confirm(t('confirmBulkDeleteMessage', selectedCases.size))) {
            try {
                const idsToDelete = Array.from(selectedCases);
                await bulkDeleteCasesFromDB(idsToDelete);
                setHistory(prev => prev.filter(c => c.id && !selectedCases.has(c.id)));
                setSelectedCases(new Set());
            } catch (err) {
                alert(t('errorBulkDelete'));
                console.error(err);
            }
        }
    };
    
    const handleBulkAddTags = async () => {
        if (selectedCases.size === 0 || !tagsToAdd.trim()) return;
        const tags = tagsToAdd.split(',').map(t => t.trim()).filter(Boolean);
        if (tags.length === 0) return;

        const updates = new Map<number, CaseRecord>();
        history.forEach(rec => {
            if (rec.id && selectedCases.has(rec.id)) {
                const newTags = new Set([...(rec.tags || []), ...tags]);
                updates.set(rec.id, { ...rec, tags: Array.from(newTags) });
            }
        });
        
        try {
            await bulkUpdateCasesInDB(updates);
            setHistory(prev => prev.map(rec => rec.id && updates.has(rec.id) ? updates.get(rec.id)! : rec));
            setIsTagModalOpen(false);
            setTagsToAdd('');
            setSelectedCases(new Set());
        } catch (err) {
            alert(t('errorBulkUpdate'));
            console.error(err);
        }
    };
    
    const handleSchemaFieldChange = (index: number, field: keyof EditableSchemaField, value: any) => {
        const newSchema = [...customSchema];
        (newSchema[index] as any)[field] = value;
        setCustomSchema(newSchema);
    };

    const addSchemaField = () => {
        setCustomSchema([...customSchema, { name: '', type: Type.STRING, description: '', isPrimaryKey: false, nullable: true }]);
    };
    
    const removeSchemaField = (index: number) => {
        setCustomSchema(customSchema.filter((_, i) => i !== index));
    };


    return (
        <section className="admin-dashboard">
            <h2>{t('adminDashboardTitle')}</h2>
            <div className="admin-tabs">
                <button className={activeAdminTab === 'analytics' ? 'active' : ''} onClick={() => setActiveAdminTab('analytics')}>{t('analyticsSection')}</button>
                <button className={activeAdminTab === 'data' ? 'active' : ''} onClick={() => setActiveAdminTab('data')}>{t('caseDataManagementSection')}</button>
                <button className={activeAdminTab === 'schema' ? 'active' : ''} onClick={() => setActiveAdminTab('schema')}>{t('schemaSettingsSection')}</button>
                <button className={activeAdminTab === 'audit' ? 'active' : ''} onClick={() => setActiveAdminTab('audit')}>{t('auditLogSection')}</button>
                <button className={activeAdminTab === 'status' ? 'active' : ''} onClick={() => setActiveAdminTab('status')}>{t('systemStatusSection')}</button>
            </div>
            <div className="admin-content">
                {activeAdminTab === 'analytics' && (
                    <div className="analytics-section">
                       <div className="stat-cards-grid">
                           <div className="stat-card"><h4>{t('totalCasesAnalyzed')}</h4><p>{analyticsData.totalCases}</p></div>
                           <div className="stat-card"><h4>{t('casesWithAppeals')}</h4><p>{analyticsData.casesWithAppeals}</p></div>
                           <div className="stat-card"><h4>{t('analysisErrors')}</h4><p>{analyticsData.analysisErrors}</p></div>
                           <div className="stat-card"><h4>{t('totalUniqueTags')}</h4><p>{allTags.length}</p></div>
                       </div>
                       <div className="charts-grid">
                           <div className="chart-wrapper">
                               <h3>{t('casesAnalyzedLast30Days')}</h3>
                               <Bar data={{ labels: analyticsData.casesAnalyzedLast30Days.labels, datasets: [{ label: t('casesAnalyzedLast30Days'), data: analyticsData.casesAnalyzedLast30Days.data, backgroundColor: 'rgba(54, 162, 235, 0.6)' }] }} options={{ responsive: true, plugins: { legend: { display: false } } }} />
                           </div>
                            <div className="chart-wrapper">
                               <h3>{t('casesByAppealStatus')}</h3>
                               <Doughnut data={{ labels: analyticsData.casesByAppealStatus.labels, datasets: [{ data: analyticsData.casesByAppealStatus.data, backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(255, 159, 64, 0.6)'] }] }} options={{ responsive: true }} />
                           </div>
                       </div>
                    </div>
                )}
                {activeAdminTab === 'data' && (
                    <div className="data-management-section">
                        <div className="bulk-actions">
                            <span>{t('casesSelected', selectedCases.size)}</span>
                            <button onClick={() => setIsTagModalOpen(true)} disabled={selectedCases.size === 0}>{t('addTagsButtonLabel')}</button>
                            <button onClick={handleBulkDelete} className="danger" disabled={selectedCases.size === 0}>{t('deleteSelectedButtonLabel')}</button>
                        </div>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th><input type="checkbox" onChange={handleSelectAll} checked={selectedCases.size === history.length && history.length > 0} aria-label={t('selectAllLabel')} /></th>
                                    <th>{t('titleLabel')}</th>
                                    <th>{t('judgmentNumberLabel')}</th>
                                    <th>{t('dateCreatedLabel')}</th>
                                    <th>{t('tagsCountLabel')}</th>
                                    <th>{t('hasAppealLabel')}</th>
                                    <th>{t('statusLabel')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map(c => (
                                    <tr key={c.id}>
                                        <td><input type="checkbox" checked={selectedCases.has(c.id!)} onChange={() => handleSelectCase(c.id!)} /></td>
                                        <td>{c.analysis?.title || 'N/A'}</td>
                                        <td>{c.analysis?.judgmentNumber || 'N/A'}</td>
                                        <td>{format(new Date(c.timestamp), 'PPpp', { locale: dateLocale })}</td>
                                        <td>{c.tags?.length || 0}</td>
                                        <td>{c.analysis ? (c.analysis.hasAppeal ? t('withAppeal') : t('withoutAppeal')) : 'N/A'}</td>
                                        <td>{c.error ? <span className="status-error">{t('errorLabel')}</span> : <span className="status-ok">{t('activeLabel')}</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {isTagModalOpen && (
                            <div className="modal-overlay">
                                <div className="modal">
                                    <h3>{t('addTagsToSelectedTitle')}</h3>
                                    <input type="text" value={tagsToAdd} onChange={e => setTagsToAdd(e.target.value)} placeholder={t('tagsToAddPlaceholder')} />
                                    <div className="modal-actions">
                                        <button onClick={handleBulkAddTags} className="primary">{t('addTagsButtonLabel')}</button>
                                        <button onClick={() => setIsTagModalOpen(false)}>{t('cancelButtonLabel')}</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {activeAdminTab === 'schema' && (
                    <div className="schema-settings-section">
                        <p>{t('schemaDescription')}</p>
                        <div className="schema-editor">
                            <div className="schema-header">
                                <div className="field-name">{t('fieldNameLabel')}</div>
                                <div className="field-type">{t('fieldTypeLabel')}</div>
                                <div className="field-desc">{t('descriptionLabel')}</div>
                                <div className="field-pk">{t('primaryKeyLabel')}</div>
                                <div className="field-nullable">{t('nullableLabel')}</div>
                                <div className="field-action"></div>
                            </div>
                            {customSchema.map((field, index) => (
                                <div className="schema-row" key={index}>
                                    <input type="text" value={field.name} onChange={(e) => handleSchemaFieldChange(index, 'name', e.target.value)} />
                                    <select value={field.type} onChange={(e) => handleSchemaFieldChange(index, 'type', e.target.value as Type)}>
                                        {Object.values(Type).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <input type="text" value={field.description} onChange={(e) => handleSchemaFieldChange(index, 'description', e.target.value)} />
                                    <input type="checkbox" checked={field.isPrimaryKey} onChange={(e) => handleSchemaFieldChange(index, 'isPrimaryKey', e.target.checked)} />
                                    <input type="checkbox" checked={field.nullable} onChange={(e) => handleSchemaFieldChange(index, 'nullable', e.target.checked)} />
                                    <button onClick={() => removeSchemaField(index)} className="admin-button-icon"><span className="material-symbols-outlined">delete</span></button>
                                </div>
                            ))}
                        </div>
                        <div className="schema-actions">
                            <button onClick={addSchemaField}>{t('addFieldButton')}</button>
                            <button onClick={handleSaveSchema} className="primary" disabled={isSavingSchema}>
                                {isSavingSchema ? t('savingSchemaButton') : t('saveSchemaButton')}
                            </button>
                             {schemaSaveStatus === 'success' && <span className="status-ok">{t('schemaSavedSuccess')}</span>}
                             {schemaSaveStatus === 'error' && <span className="status-error">{t('errorSavingSchema')}</span>}
                        </div>
                    </div>
                )}
                 {activeAdminTab === 'audit' && (
                     <div className="audit-log-section">
                         <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>{t('logIdLabel')}</th>
                                    <th>{t('actionLabel')}</th>
                                    <th>{t('detailsLabel')}</th>
                                    <th>{t('timestampLabel')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.map(log => (
                                    <tr key={log.id}>
                                        <td>{log.id}</td>
                                        <td>{log.action}</td>
                                        <td>{log.details}</td>
                                        <td>{format(new Date(log.timestamp), 'PPpp', { locale: dateLocale })}</td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                    </div>
                 )}
                 {activeAdminTab === 'status' && (
                     <div className="system-status-section">
                         <div className="status-item">
                             <h4>{t('geminiApiLabel')}</h4>
                             <p className="status-ok">{t('operationalLabel')}</p>
                         </div>
                         <div className="status-item">
                             <h4>{t('localDatabaseLabel')}</h4>
                             <p className="status-ok">{t('operationalLabel')}</p>
                         </div>
                         <div className="status-item">
                             <h4>{t('apiKeyManagedByEnv')}</h4>
                             <p className="status-info">OK</p>
                         </div>
                    </div>
                 )}
            </div>
        </section>
    );
};

const App: React.FC = () => {
  const [caseText, setCaseText] = useState<string>('');
  const [history, setHistory] = useState<CaseRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filter, setFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'analyze' | 'history' | 'records' | 'admin'>('analyze');
  const [files, setFiles] = useState<FileList | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<{ current: number, total: number }>({ current: 0, total: 0 });

  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [isAdminView, setIsAdminView] = useState(false);

  const [allTags, setAllTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  
  const [customSchema, setCustomSchema] = useState<EditableSchema>([]);
  const [isSavingSchema, setIsSavingSchema] = useState(false);
  const [schemaSaveStatus, setSchemaSaveStatus] = useState<'success' | 'error' | null>(null);

  const [judicialRecords, setJudicialRecords] = useState<any[]>([]);
  const [isFetchingRecords, setIsFetchingRecords] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isJudicialDataLoaded, setIsJudicialDataLoaded] = useState(false);

  // Drag and Drop state
  const [isDragging, setIsDragging] = useState(false);

  const dropZoneRef = useRef<HTMLLabelElement>(null);


  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'dark' || currentTheme === 'light') {
      setTheme(currentTheme);
    } else {
       // Default to light if no theme or an invalid theme is set
       const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
       setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }, [theme, lang]);

  const toggleTheme = () => {
    setTheme(prevTheme => {
        const newTheme = prevTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        return newTheme;
    });
  };

  const { t, dateLocale } = useMemo(() => {
    const locale = translations[lang];
    const dateLocale = lang === 'ar' ? arLocale : enLocale;
    const tFunction = (key: TranslationKey, ...args: any[]): string => {
      const translation = locale[key];
      if (typeof translation === 'function') {
        return (translation as (...args: any[]) => string)(...args);
      }
      return translation || (key as string);
    };
    return { t: tFunction, dateLocale };
  }, [lang]);
  
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragging to false if the leave event is for the drop zone itself, not its children
    if (e.target === dropZoneRef.current) {
        setIsDragging(false);
    }
  }, []);
  
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const droppedFiles = e.dataTransfer.files;
        // Filter files based on extension
        const allowedTypes = ['application/json', 'text/plain', 'text/markdown'];
        const allowedExtensions = ['.json', '.jsonl', '.txt', '.md'];
        
        const validFiles = Array.from(droppedFiles).filter(file => 
            allowedTypes.includes(file.type) || allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
        );

        if (validFiles.length > 0) {
            // Create a new FileList
            const dataTransfer = new DataTransfer();
            validFiles.forEach(file => dataTransfer.items.add(file));
            setFiles(dataTransfer.files);
            setCaseText(''); // Clear text area
        } else {
            alert(t('errorInvalidFile'));
        }
    }
  }, [t]);

  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (dropZone) {
      // Use 'dragenter' and 'dragleave' on the window to detect dragging over the page
      const handleWindowDragEnter = (e: DragEvent) => {
        // Check if files are being dragged
        if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
          // This check is important, otherwise it might trigger for text drags, etc.
          // No visual change needed here, we just need to know files are being dragged
        }
      };

      // When dragging enters the dropzone specifically
      const handleZoneDragEnter = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
          setIsDragging(true);
        }
      };

      // When dragging leaves the dropzone
      const handleZoneDragLeave = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // A timeout helps prevent flickering when moving over child elements
        setTimeout(() => {
          if (dropZone && !dropZone.contains(e.relatedTarget as Node)) {
            setIsDragging(false);
          }
        }, 50);
      };
      
      const handleZoneDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            handleDrop(e);
        }
      };


      // Attach events
      dropZone.addEventListener('dragenter', handleZoneDragEnter);
      dropZone.addEventListener('dragleave', handleZoneDragLeave);
      dropZone.addEventListener('dragover', handleDragOver);
      dropZone.addEventListener('drop', handleZoneDrop);
      
      return () => {
        // Cleanup events
        dropZone.removeEventListener('dragenter', handleZoneDragEnter);
        dropZone.removeEventListener('dragleave', handleZoneDragLeave);
        dropZone.removeEventListener('dragover', handleDragOver);
        dropZone.removeEventListener('drop', handleZoneDrop);
      };
    }
  }, [handleDrop, handleDragOver]);


  useEffect(() => {
    const loadSchema = () => {
      const loadedSchema = getCustomSchemaFromLocalStorage();
      setCustomSchema(loadedSchema || DEFAULT_EDITABLE_SCHEMA);
    };
    loadSchema();
  }, []);

  const handleSaveSchema = async () => {
      setIsSavingSchema(true);
      setSchemaSaveStatus(null);
      try {
          // Basic validation: ensure no empty field names
          if (customSchema.some(field => field.name.trim() === '')) {
              throw new Error("Field names cannot be empty.");
          }
          saveCustomSchemaToLocalStorage(customSchema);
          await addLogEntry('SCHEMA_UPDATED', `Schema updated by admin.`);
          setSchemaSaveStatus('success');
      } catch (error) {
          console.error(t('errorSavingSchema'), error);
          setSchemaSaveStatus('error');
      } finally {
          setIsSavingSchema(false);
          setTimeout(() => setSchemaSaveStatus(null), 3000);
      }
  };


  useEffect(() => {
    const loadHistory = async () => {
      try {
        const cases = await getAllCasesFromDB();
        setHistory(cases);
        const tags = new Set<string>();
        cases.forEach(c => {
          c.tags?.forEach(tag => tags.add(tag));
        });
        setAllTags(Array.from(tags).sort());
      } catch (error) {
        console.error(t('errorLoadHistory'), error);
        alert(t('errorLoadHistory'));
      }
    };
    if(activeTab === 'history' || activeTab === 'admin') {
      loadHistory();
    }
  }, [activeTab, t]);

  const getGeminiSchema = useMemo(() => {
      return convertEditableSchemaToGemini(customSchema);
  }, [customSchema]);

  const analyzeCase = async (text: string, sourceName: string): Promise<CaseRecord> => {
    const placeholderRecord: CaseRecord = {
        originalText: text,
        timestamp: Date.now(),
        loading: true,
        tags: []
    };

    // Add placeholder to history immediately for better UX
    setHistory(prev => [placeholderRecord, ...prev]);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const prompt = `Analyze the following legal case text in its original Arabic language from Saudi Arabia and extract the specified information in JSON format according to the provided schema. For any fields that expect long-form text (like facts, reasons, rulings), use simple markdown for formatting: use '**text**' for bolding, '*text*' for italics, '~~text~~' for strikethrough, start lines with '* ' for bullet points, '1. ' for numbered lists, and use Markdown tables for tabular data. If a field is not present in the text, use null for its value. Here is the case text: \n\n${text}`;
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-pro', 
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: getGeminiSchema,
          },
        });

        const analysis = JSON.parse(response.text);

        const newRecord: CaseRecord = {
            ...placeholderRecord,
            analysis,
            loading: false,
        };

        const newId = await putCaseInDB(newRecord);
        await addLogEntry('CASE_ANALYZED', `Analyzed case from ${sourceName}. New Case ID: ${newId}`);
        
        return { ...newRecord, id: newId };

    } catch (error) {
        console.error(t('errorFailedAnalysis'), error);
        const classifiedError = classifyGeminiError(error, t);
        
        const errorRecord: CaseRecord = {
            ...placeholderRecord,
            loading: false,
            error: classifiedError,
        };

        const errorId = await putCaseInDB(errorRecord);
        await addLogEntry('ANALYSIS_FAILED', `Failed to analyze case from ${sourceName}. Error: ${(error as Error).message}`);
        
        return { ...errorRecord, id: errorId };
    }
  };

  const handleAddCases = async (source: 'paste' | 'upload', files?: FileList | null) => {
    let casesToProcess: { text: string, source: string }[] = [];
    setIsLoading(true);

    try {
      if (source === 'upload' && files) {
        setIsProcessingFiles(true);
        setProcessingProgress({ current: 0, total: files.length });
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setProcessingProgress({ current: i + 1, total: files.length });
          try {
            const parsedCases = await parseFile(file, t);
            parsedCases.forEach((caseText, idx) => {
              casesToProcess.push({ text: caseText, source: `${file.name} #${idx + 1}` });
            });
          } catch (uploadError) {
             if (uploadError instanceof Error) {
                alert(`${t('errorUploadFailedMessage', file.name)}: ${uploadError.message}`);
             } else {
                alert(`${t('errorUploadFailedMessage', file.name)}: ${String(uploadError)}`);
             }
             console.error(t('errorUploadFailedMessage', file.name), uploadError);
          }
        }
        setIsProcessingFiles(false);
      } else if (source === 'paste' && caseText.trim()) {
        const pastedCases = caseText.split(/\n---\n|\n\n\n+/).map(c => c.trim()).filter(Boolean);
        pastedCases.forEach((caseText, idx) => {
          casesToProcess.push({ text: caseText, source: t('caseTextBatchSource', idx + 1) });
        });
      } else {
        alert(t('errorPasteOrUpload'));
        setIsLoading(false);
        return;
      }

      if (casesToProcess.length === 0) {
        setIsLoading(false);
        return; 
      }
      
      setProcessingProgress({ current: 0, total: casesToProcess.length });

      const newRecords: CaseRecord[] = [];
      const placeholderRecords: CaseRecord[] = casesToProcess.map((c, i) => ({
          originalText: c.text,
          timestamp: Date.now() + i, // Use index to ensure uniqueness
          loading: true,
          tags: []
      }));
      const placeholderTimestamps = new Set(placeholderRecords.map(p => p.timestamp));

      // Add all placeholders at once
      setHistory(prev => [...placeholderRecords, ...prev]);

      for (let i = 0; i < casesToProcess.length; i++) {
        const { text, source } = casesToProcess[i];
        setProcessingProgress({ current: i + 1, total: casesToProcess.length });
        const newRecord = await analyzeCase(text, source);
        newRecords.push(newRecord);
      }
      
      setHistory(prev => {
          // Filter out the placeholders we added for this batch
          const historyWithoutPlaceholders = prev.filter(p => !placeholderTimestamps.has(p.timestamp));
          // Add the new final records (success or error)
          return [...newRecords, ...historyWithoutPlaceholders].sort((a, b) => b.timestamp - a.timestamp);
      });

      setCaseText('');
      setFiles(null);
      setActiveTab('history');

    } catch (err: unknown) {
      console.error(t('errorReadFile'), err);
      if (err instanceof Error) {
        alert(`${t('errorReadFile')}: ${err.message}`);
      } else {
        alert(`${t('errorReadFile')}: ${String(err)}`);
      }
    } finally {
      setIsLoading(false);
      setIsProcessingFiles(false);
      setProcessingProgress({ current: 0, total: 0 });
    }
  };


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLoading || isProcessingFiles) return;

    if (files && files.length > 0) {
        await handleAddCases('upload', files);
    } else if (caseText.trim()) {
        await handleAddCases('paste');
    } else {
        alert(t('errorPasteOrUpload'));
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      setFiles(selectedFiles);
      setCaseText(''); // Clear textarea when files are selected
    }
  };

  const filteredHistory = useMemo(() => {
    let results = history;
    if (activeTag) {
      results = results.filter(c => c.tags?.includes(activeTag));
    }
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      results = results.filter(c =>
        c.originalText.toLowerCase().includes(lowerFilter) ||
        (c.analysis?.title && c.analysis.title.toLowerCase().includes(lowerFilter)) ||
        (c.analysis?.judgmentNumber && c.analysis.judgmentNumber.includes(lowerFilter)) ||
        c.tags?.some(tag => tag.toLowerCase().includes(lowerFilter))
      );
    }
    return results;
  }, [history, filter, activeTag]);

  const clearHistory = async () => {
    if (confirm(t('confirmClearHistory'))) {
      try {
        await clearAllCasesFromDB();
        await addLogEntry('HISTORY_CLEARED', 'All case analyses were cleared.');
        setHistory([]);
      } catch (error) {
        console.error(t('errorClearHistory'), error);
        alert(t('errorClearHistory'));
      }
    }
  };
  
  const exportHistory = () => {
    if (history.length === 0) {
      alert(t('alertNoHistoryToExport'));
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(history, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `judgment_analysis_history_${new Date().toISOString()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    addLogEntry('HISTORY_EXPORTED', `Exported ${history.length} cases.`);
  };

  const toggleLang = () => {
    setLang(prevLang => (prevLang === 'en' ? 'ar' : 'en'));
  };

  const handleRecordsTabClick = async () => {
    setActiveTab('records');
    setIsFetchingRecords(true);
    try {
        if (!isJudicialDataLoaded) {
            const recordsWithDate = judicialData.map(record => ({
                ...record,
                scraped_at: record.scraped_at ? new Date(record.scraped_at).toISOString() : new Date().toISOString(),
            }));
            // Simulate bulk adding to DB if they don't exist
            await Promise.all(recordsWithDate.map(addJudicialRecordToDB));
            setIsJudicialDataLoaded(true);
        }
        
        // Always load from DB on click
        const records = await getJudicialRecordsFromDB();
        setJudicialRecords(records);
    } catch (err) {
        console.error("Error loading judicial records:", err);
        alert(t('errorLoadHistory'));
    } finally {
        setIsFetchingRecords(false);
    }
  };

  return (
    <div className="container">
      <header>
        <div className="header-top-controls">
          <div className="theme-switcher">
            <span className="material-symbols-outlined">{theme === 'light' ? 'light_mode' : 'dark_mode'}</span>
              <label className="switch">
                  <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
                  <span className="slider round"></span>
              </label>
          </div>
          <button className="lang-switcher" onClick={toggleLang}>{lang === 'en' ? 'العربية' : 'English'}</button>
          <button className="admin-toggle-btn" onClick={() => { setIsAdminView(!isAdminView); if (!isAdminView) { setActiveTab('admin'); } else { setActiveTab('analyze'); }}}>
            <span className="material-symbols-outlined">{isAdminView ? 'visibility' : 'admin_panel_settings'}</span>
            {isAdminView ? t('appViewButton') : t('adminDashboardButton')}
          </button>
        </div>
        <h1>{t('appTitle')}</h1>
        <p>{t('appDescription')}</p>
      </header>

      {isAdminView ? (
        <AdminDashboard
          history={history}
          setHistory={setHistory}
          allTags={allTags}
          t={t}
          dateLocale={dateLocale}
          customSchema={customSchema}
          setCustomSchema={setCustomSchema}
          handleSaveSchema={handleSaveSchema}
          isSavingSchema={isSavingSchema}
          schemaSaveStatus={schemaSaveStatus}
        />
      ) : (
        <>
          <div className="tabs-container">
            <button className={`tab-button ${activeTab === 'analyze' ? 'active' : ''}`} onClick={() => setActiveTab('analyze')} aria-controls="analyze-panel" aria-selected={activeTab === 'analyze'}>{t('analyzeTab')}</button>
            <button className={`tab-button ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')} aria-controls="history-panel" aria-selected={activeTab === 'history'}>{t('historyTab')}</button>
            <button 
              className={`tab-button ${activeTab === 'records' ? 'active' : ''}`} 
              onClick={handleRecordsTabClick}
              aria-controls="records-panel" 
              aria-selected={activeTab === 'records'}
            >
              {t('judicialRecordsTab')}
            </button>
          </div>

          {activeTab === 'analyze' && (
            <section id="analyze-panel" className="input-section" role="tabpanel" aria-labelledby="analyze-tab">
              <form onSubmit={handleSubmit}>
                <label htmlFor="case-text">{t('caseTextLabel')}</label>
                <textarea
                  id="case-text"
                  value={caseText}
                  onChange={(e) => {
                    setCaseText(e.target.value);
                    if (files) setFiles(null);
                  }}
                  placeholder={t('caseTextPlaceholder')}
                  rows={10}
                  disabled={!!files}
                />

                <div className="divider">{t('orDivider')}</div>

                <label 
                  htmlFor="file-upload" 
                  ref={dropZoneRef}
                  className={`drop-zone ${isDragging ? 'drag-over' : ''}`}
                  aria-label={t('uploadFileLabel')}
                >
                    <input id="file-upload" type="file" multiple onChange={handleFileChange} accept=".json,.jsonl,.txt,.md,text/plain,application/json,text/markdown" />
                    {files && files.length > 0 ? (
                      <div className="file-list-display">
                        <span className="file-list-title">{t('filesSelected', files.length)}</span>
                        <ul className="file-list" aria-label="Selected files">
                          {Array.from(files).map((file, index) => (
                            <li key={index} className="file-list-item">
                               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                               <span>{file.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="drop-zone-content">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" x2="12" y1="3" y2="15"></line></svg>
                        <p className="drop-zone-text">{t('dragAndDropPrompt')}</p>
                        <span className="file-label">{t('uploadFileLabel')}</span>
                      </div>
                    )}
                </label>
                
                <button type="submit" disabled={isLoading || isProcessingFiles}>
                  {isLoading ? t('analyzingButton') : t('analyzeButton')}
                </button>

                {(isLoading || isProcessingFiles) && (
                  <div className="progress-indicator">
                      <p>
                        {isProcessingFiles && processingProgress.total > 0 && 
                          t('parsingFileProgress', processingProgress.current, processingProgress.total)}
                        {!isProcessingFiles && processingProgress.total > 0 &&
                          t('analyzingCasesProgress', processingProgress.current, processingProgress.total)}
                      </p>
                      <div className="progress-bar-container">
                          <div 
                              className="progress-bar" 
                              style={{ width: `${(processingProgress.current / (processingProgress.total || 1)) * 100}%` }}
                          ></div>
                      </div>
                  </div>
                )}
              </form>
            </section>
          )}

          {activeTab === 'history' && (
            <section id="history-panel" className="output-section" role="tabpanel" aria-labelledby="history-tab">
              <HistoryView 
                history={filteredHistory} 
                filter={filter}
                setFilter={setFilter} 
                clearHistory={clearHistory}
                exportHistory={exportHistory}
                setHistory={setHistory}
                t={t}
                dateLocale={dateLocale}
                allTags={allTags}
                activeTag={activeTag}
                setActiveTag={setActiveTag}
                analyzeCase={analyzeCase}
                getGeminiSchema={getGeminiSchema}
              />
            </section>
          )}

          {activeTab === 'records' && (
            <section id="records-panel" className="output-section" role="tabpanel" aria-labelledby="records-tab">
              <JudicialRecordsViewer 
                records={judicialRecords}
                setRecords={setJudicialRecords}
                selectedRecord={selectedRecord}
                setSelectedRecord={setSelectedRecord}
                isLoading={isFetchingRecords}
                setIsLoading={setIsFetchingRecords}
                t={t}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
};
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);