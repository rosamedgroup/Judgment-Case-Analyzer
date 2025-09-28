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
import format from 'date-fns/format';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import subDays from 'date-fns/subDays';
import startOfDay from 'date-fns/startOfDay';
import { default as arLocale } from 'date-fns/locale/ar';
import { default as enLocale } from 'date-fns/locale/en-US';
import { judicialData } from './data.js';


ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const DB_NAME = 'JudgmentCaseDB';
const DB_VERSION = 4; // Incremented version for new object store
const STORE_NAME = 'cases';
const LOG_STORE_NAME = 'audit_logs';
const SCHEMA_STORE_NAME = 'schema_store';
const JUDICIAL_RECORDS_STORE_NAME = 'judicial_records';


interface CaseError {
  title: string;
  message: string;
  suggestion?: string;
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
    caseTextPlaceholder: "الصق النص الكامل لقضية الحكم هنا...",
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
    errorParsingSuggestion: "قد يحدث هذا مع المدخلات المعقدة أو الغامضة. حاول إعادة صياغة النص الأصلي والمحاولة مرة أخرى.",
    errorRateLimitTitle: "تم تجاوز حد المعدل",
    errorRateLimitMessage: "لقد قمت بتقديم عدد كبير جدًا من الطلبات في فترة قصيرة.",
    errorRateLimitSuggestion: "يرجى الانتظار للحظة قبل المحاولة مرة أخرى.",
    errorApiKeyTitle: "مفتاح API غير صالح",
    errorApiKeyMessage: "مفتاح API المقدم غير صالح أو انتهت صلاحيته. يرجى التحقق من الإعدادات الخاصة بك.",
    errorApiTitle: "خطأ في API",
    errorApiMessage: "حدث خطأ أثناء الاتصال بخدمة التحليل.",
    errorApiSuggestion: "قد يكون النص المدخل غير صالح أو ينتهك سياسات السلامة. حاول تبسيط النص. انظر التفاصيل أدناه.",
    errorSafetyTitle: "انتهاك سياسة السلامة",
    errorSafetyMessage: "تم حظر التحليل لأن النص المدخل قد يكون انتهك سياسات السلامة.",
    errorSafetySuggestion: "يرجى مراجعة النص بحثًا عن أي محتوى قد يكون ضارًا أو غير أخلاقي أو حساس والمحاولة مرة أخرى. إذا كنت تعتقد أن هذا خطأ، ففكر في إعادة صياغة المحتوى.",
    errorShortTextTitle: "محتوى غير كافٍ",
    errorShortTextMessage: "النص المقدم قصير جدًا أو يفتقر إلى السياق الكافي لإجراء تحليل هادف.",
    errorShortTextSuggestion: "يرجى تقديم نص أكثر تفصيلاً واكتمالاً لقضية الحكم.",
    errorUnclearTextTitle: "سياق غير واضح",
    errorUnclearTextMessage: "لم يتمكن النموذج من فهم سياق أو بنية النص المقدم.",
    errorUnclearTextSuggestion: "يرجى التأكد من أن النص هو قضية قانونية صالحة ومنسقة بوضوح. تحقق من وجود أخطاء إملائية أو مشكلات في التنسيق قد تجعل من الصعب تحليله.",
    errorGenericSuggestion: "يمكنك إعادة محاولة التحليل، أو تعديل النص الأصلي إذا كنت تشك في أنه قد يكون سبب المشكلة.",
    errorTokenLimitTitle: 'تم تجاوز حد الرموز',
    errorTokenLimitMessage: 'مستند أو قضية واحدة كبيرة جدًا بحيث لا يمكن تحليلها بواسطة الواجهة البرمجية.',
    errorTokenLimitSuggestion: 'يرجى تقسيم المستند الكبير إلى ملفات أو أجزاء أصغر والمحاولة مرة أخرى.',
    viewErrorDetails: "عرض تفاصيل الخطأ",
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
  },
  en: {
    appTitle: "Judgment Case Analyzer",
    appDescription: "Paste the text from a Saudi Arabian judgment case or upload files (JSON, JSONL, TXT, MD) with multiple cases to extract structured data.",
    caseTextLabel: "Case Text",
    caseTextPlaceholder: "Paste the full text of the judgment case here...",
    orDivider: "OR",
    uploadFileLabel: "Upload Files",
    analyzeButton: "Analyze",
    analyzingButton: "Analyzing...",
    analysisHistoryTitle: "Analysis History",
    filterPlaceholder: "Filter results...",
    clearSearchLabel: "Clear search",
    exportHistoryButton: "Export History",
    clearHistoryButton: "Clear History",
    noHistoryPlaceholder: "Your analysis history will appear here.",
    noFilterResultsPlaceholder: "No results match your filter.",
    caseAnalysisTitle: `Case Analysis`,
    judgmentNumberPrefix: `Judgment #`,
    caseIdPrefix: `Case ID: `,
    clickViewDetails: 'Click to view details',
    caseInfoSection: "Case Information",
    judgmentDetailsSection: "Judgment Details",
    appealDetailsSection: "Appeal Details",
    judgmentNarrationsSection: "Judgment Narrations",
    appealNarrationsSection: "Appeal Narrations",
    originalTextSection: "Original Text",
    rawDataSection: "Raw JSON Data",
    idLabel: 'ID',
    titleLabel: 'Title',
    decisionTitleLabel: 'Decision Title',
    yearLabel: 'Year',
    hijriYearLabel: 'Hijri Year',
    exportDateLabel: 'Export Date',
    judgmentNumberLabel: 'Judgment Number',
    dateLabel: 'Date',
    judgmentDateLabel: 'Judgment Date',
    judgmentHijriDateLabel: 'Judgment Hijri Date',
    courtLabel: 'Court',
    judgmentCourtNameLabel: 'Judgment Court',
    judgmentCityNameLabel: 'Judgment City',
    appealNumberLabel: 'Appeal Number',
    appealDateLabel: 'Appeal Date',
    appealHijriDateLabel: 'Appeal Hijri Date',
    appealCourtLabel: 'Appeal Court',
    appealCourtNameLabel: 'Appeal Court',
    appealCityNameLabel: 'Appeal City',
    factsLabel: "Facts",
    judgmentFactsLabel: "Judgment Facts",
    reasonsLabel: "Reasons",
    judgmentReasonsLabel: "Judgment Reasons",
    rulingLabel: "Ruling",
    judgmentRulingLabel: "Judgment Ruling",
    textOfRulingLabel: "Text of Ruling",
    judgmentTextOfRulingLabel: "Judgment Text of Ruling",
    judgmentNarrationListLabel: 'Judgment Narrations',
    appealFactsLabel: "Appeal Facts",
    appealReasonsLabel: "Appeal Reasons",
    appealRulingLabel: "Appeal Ruling",
    appealTextOfRulingLabel: "Appeal Text of Ruling",
    loadingAnalysis: "Analyzing...",
    analysisFailedTitle: "Analysis Failed",
    errorPasteOrUpload: 'Please paste the case text or upload a file before analyzing.',
    errorInvalidFile: 'Please upload valid JSON, JSONL, TXT, or MD files.',
    errorFailedAnalysis: 'Failed to analyze the case. Please check the console for more details.',
    errorEmptyFile: 'An uploaded file is empty.',
    errorInvalidJsonl: 'Invalid JSONL format: Each line must be a valid JSON object.',
    errorJsonNotArray: 'Invalid JSON format: The file should contain an array of case objects.',
    errorInvalidJson: 'Invalid JSON format. Please check the file content.',
    errorFileNotArray: 'The parsed file did not result in an array of cases.',
    errorFileNoCases: 'The files contain no cases to analyze.',
    errorFileNonString: 'No valid text content found in the file.',
    errorFailedCase: (err: string) => `Failed to analyze case. Error: ${err}`,
    errorReadFile: 'Failed to read the file.',
    errorLoadHistory: "Could not load analysis history.",
    errorClearHistory: 'Could not clear history.',
    errorExportHistory: 'Could not export history.',
    confirmClearHistory: 'Are you sure you want to clear all analysis history? This action cannot be undone.',
    confirmDeleteCase: 'Are you sure you want to delete this case analysis? This action cannot be undone.',
    alertNoHistoryToExport: "No analysis history to export.",
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
    parsingFileProgress: (current: number, total: number) => `Parsing file ${current} of ${total}...`,
    errorUploadFailedTitle: "Upload Failed",
    errorUploadFailedMessage: (filename: string) => `Could not upload file: ${filename}`,
    filesSelected: (count: number) => `${count} file${count === 1 ? '' : 's'} selected`,
    retryButtonLabel: 'Retry',
    tagsLabel: 'Tags',
    addTagPlaceholder: 'Add a tag...',
    addTagButtonLabel: 'Add',
    noTagsPlaceholder: 'No tags yet.',
    filterByTagTooltip: 'Click to filter by this tag',
    errorParsingTitle: "Parsing Error",
    errorParsingMessage: "The model's response was not in the expected format (JSON).",
    errorParsingSuggestion: "This can happen with complex or ambiguous input. Try rephrasing the original text and retrying.",
    errorRateLimitTitle: "Rate Limit Exceeded",
    errorRateLimitMessage: "You have made too many requests in a short period.",
    errorRateLimitSuggestion: "Please wait for a moment before retrying.",
    errorApiKeyTitle: "Invalid API Key",
    errorApiKeyMessage: "The provided API key is invalid or has expired. Please check your configuration.",
    errorApiTitle: "API Error",
    errorApiMessage: "An error occurred while communicating with the analysis service.",
    errorApiSuggestion: "The input text might be invalid or violate safety policies. Try simplifying the text. See details below.",
    errorSafetyTitle: "Safety Policy Violation",
    errorSafetyMessage: "The analysis was blocked because the input text may have violated safety policies.",
    errorSafetySuggestion: "Please review the text for any potentially harmful, unethical, or sensitive content and try again. If you believe this is an error, consider rephrasing the content.",
    errorShortTextTitle: "Insufficient Content",
    errorShortTextMessage: "The provided text is too short or lacks sufficient context for a meaningful analysis.",
    errorShortTextSuggestion: "Please provide a more detailed and complete text of the judgment case.",
    errorUnclearTextTitle: "Unclear Context",
    errorUnclearTextMessage: "The model could not understand the context or structure of the provided text.",
    errorUnclearTextSuggestion: "Please ensure the text is a valid legal case and is clearly formatted. Check for typos or formatting issues that might make it difficult to parse.",
    errorGenericSuggestion: "You can retry the analysis, or edit the original text if you suspect it may be causing the issue.",
    errorTokenLimitTitle: 'Token Limit Exceeded',
    errorTokenLimitMessage: 'A single document or case is too large to be analyzed by the API.',
    errorTokenLimitSuggestion: 'Please split the oversized document into smaller files or parts and try again.',
    viewErrorDetails: "View Error Details",
    editAndRetryButtonLabel: "Edit & Retry",
    saveAndRetryButtonLabel: "Save & Retry",
    adminDashboardButton: "Admin Dashboard",
    appViewButton: "App View",
    adminDashboardTitle: "Admin Dashboard",
    analyticsSection: "Analytics",
    userManagementSection: "User Management",
    contentManagementSection: "Content Management",
    securityMonitoringSection: "Security & Monitoring",
    configurationSettingsSection: "Configuration & Settings",
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
    backendRequiredNotice: "This feature requires a backend integration and is currently disabled.",
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
    tagsCountLabel: "Tags #",
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
    apiKeyManagedByEnv: "Managed via environment variable",
    safetySettingsLabel: "Safety Settings",
    defaultModelLabel: "Default Model",
    enableAdvanceFeatures: "Enable Advanced Features",
    addTagsButtonLabel: 'Add Tags',
    deleteSelectedButtonLabel: 'Delete Selected',
    casesSelected: (count: number) => `${count} case${count === 1 ? '' : 's'} selected`,
    addTagsToSelectedTitle: 'Add Tags to Selected Cases',
    tagsToAddPlaceholder: 'Enter tags, comma-separated...',
    confirmBulkDeleteTitle: 'Confirm Bulk Deletion',
    confirmBulkDeleteMessage: (count: number) => `Are you sure you want to delete ${count} selected case${count === 1 ? '' : 's'}? This action cannot be undone.`,
    selectAllLabel: 'Select all',
    errorBulkDelete: 'Failed to delete selected cases.',
    errorBulkUpdate: 'Failed to update selected cases.',
    schemaSettingsSection: "Schema Settings",
    schemaDescription: "Define the data structure for Gemini to extract. Designate one or more fields as a Primary Key to uniquely identify cases.",
    fieldNameLabel: "Field Name",
    fieldTypeLabel: "Type",
    descriptionLabel: "Description",
    primaryKeyLabel: "Primary Key",
    nullableLabel: "Nullable",
    addFieldButton: "Add Field",
    saveSchemaButton: "Save Schema",
    savingSchemaButton: "Saving...",
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
    pathfinderPlaceholder: 'Explore related cases and precedents (Feature coming soon).',
    backToList: 'Back to List',
    errorRecord: 'Error Record',
    errorMessageLabel: 'Error Message',
    originalUrl: 'Original URL',
    dragAndDropPrompt: 'Drag & drop your files here',
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
      if (!db.objectStoreNames.contains(SCHEMA_STORE_NAME)) {
        db.createObjectStore(SCHEMA_STORE_NAME, { keyPath: 'id' });
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

interface EditableSchemaField {
  name: string;
  type: Type;
  description: string;
  isPrimaryKey: boolean;
  nullable: boolean;
}
type EditableSchema = EditableSchemaField[];

const getCustomSchemaFromDB = (): Promise<EditableSchema | null> => {
    return openDB().then(db => {
        return new Promise<EditableSchema | null>((resolve, reject) => {
            const transaction = db.transaction(SCHEMA_STORE_NAME, 'readonly');
            const store = transaction.objectStore(SCHEMA_STORE_NAME);
            const request = store.get('custom_schema');
            request.onsuccess = () => resolve(request.result?.schema || null);
            request.onerror = () => reject(request.error);
        });
    });
};

const putCustomSchemaInDB = (schema: EditableSchema): Promise<void> => {
    return openDB().then(db => {
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(SCHEMA_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(SCHEMA_STORE_NAME);
            const request = store.put({ id: 'custom_schema', schema });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
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
                // This regex finds a closing brace, followed by optional whitespace/newlines,
                // and then an opening brace, and inserts a comma between them. This can fix
                // both single-line and multi-line object streams.
                const fixedText = `[${text.trim().replace(/}\s*{/g, '},{')}]`;
                const data = JSON.parse(fixedText);

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
            // A JSONL file is a stream of JSON objects. The most robust way to parse this,
            // including pretty-printed objects, is to wrap it as a JSON array.
            const fixedText = `[${text.trim().replace(/}\s*{/g, '},{')}]`;
            const data = JSON.parse(fixedText);

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
        const isSeeded = localStorage.getItem('judicialRecordsSeeded_v1');
        if (isSeeded) return;

        const db = await openDB();
        const transaction = db.transaction(JUDICIAL_RECORDS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(JUDICIAL_RECORDS_STORE_NAME);
        
        for (const record of judicialData) {
            store.put(record);
        }

        await new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
        
        localStorage.setItem('judicialRecordsSeeded_v1', 'true');
        console.log("Judicial records database seeded successfully.");
      } catch (error) {
        console.error("Failed to seed judicial records database:", error);
      }
    };

    const loadData = async () => {
      setDbLoading(true);
      try {
        await seedDatabase();
        const [history, customSchema] = await Promise.all([
          getAllCasesFromDB(),
          getCustomSchemaFromDB()
        ]);
        setAnalysisResults(history);
        if (customSchema) {
          setSchema(customSchema);
        }
      } catch (err) {
        console.error("Failed to load data from DB:", err);
        setError(t('errorLoadHistory'));
      } finally {
        setDbLoading(false);
      }
    };
    loadData();
  }, [t]);
  
  const handleSchemaUpdate = async (newSchema: EditableSchema) => {
    try {
      await putCustomSchemaInDB(newSchema);
      setSchema(newSchema);
      addLogEntry('SCHEMA_UPDATED', `Custom schema was updated with ${newSchema.length} fields.`);
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
    if (err instanceof SyntaxError) {
        return {
            title: t('errorParsingTitle'),
            message: t('errorParsingMessage'),
            suggestion: t('errorParsingSuggestion'),
            raw: rawResponse || err.message
        };
    }
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (/rate limit/i.test(errorMessage)) {
         return {
            title: t('errorRateLimitTitle'),
            message: t('errorRateLimitMessage'),
            suggestion: t('errorRateLimitSuggestion'),
        };
    }

     if (/API key not valid/i.test(errorMessage)) {
         return {
            title: t('errorApiKeyTitle'),
            message: t('errorApiKeyMessage'),
        };
    }

    if (/input token count exceeds/i.test(errorMessage)) {
      return {
          title: t('errorTokenLimitTitle'),
          message: t('errorTokenLimitMessage'),
          suggestion: t('errorTokenLimitSuggestion'),
          raw: errorMessage,
      };
    }
    
    // FIX: Safely check for the 'name' property on the 'err' object before access.
    const isGoogleApiError = typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'GoogleGenerativeAIError';
    if (errorMessage.includes('[400') || isGoogleApiError) {
        if (/safety|blocked by response safety settings/i.test(errorMessage)) {
            return {
                title: t('errorSafetyTitle'),
                message: t('errorSafetyMessage'),
                suggestion: t('errorSafetySuggestion'),
                raw: errorMessage,
            };
        }
        if (/must provide a non-empty text/i.test(errorMessage) || /insufficient/i.test(errorMessage)) {
            return {
                title: t('errorShortTextTitle'),
                message: t('errorShortTextMessage'),
                suggestion: t('errorShortTextSuggestion'),
                raw: errorMessage,
            };
        }
        if (/malformed/i.test(errorMessage) || /could not parse/i.test(errorMessage)) {
             return {
                title: t('errorUnclearTextTitle'),
                message: t('errorUnclearTextMessage'),
                suggestion: t('errorUnclearTextSuggestion'),
                raw: errorMessage,
            };
        }

        // Generic API error if no specific pattern matches
         return {
            title: t('errorApiTitle'),
            message: t('errorApiMessage'),
            suggestion: t('errorApiSuggestion'),
            raw: errorMessage,
        };
    }

    return {
        title: t('analysisFailedTitle'),
        message: t('errorFailedCase', errorMessage),
        suggestion: t('errorGenericSuggestion'),
        raw: errorMessage,
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

    if (uploadedFiles) {
        setLoading(true);
        const files = Array.from(uploadedFiles);
        setUploadProgress({ current: 0, total: files.length, step: 'parsing' });
        setActiveTab('history');

        let allCasesToAnalyze: { text: string; source: string }[] = [];
        
        try {
            for (let index = 0; index < files.length; index++) {
                const file = files[index] as File;
                setUploadProgress({ current: index + 1, total: files.length, step: 'parsing' });
                const casesFromFile = await parseFile(file, t);
                casesFromFile.forEach(text => {
                    allCasesToAnalyze.push({ text, source: file.name });
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error("File parsing failed:", err);
            setError(errorMessage);
            resetUploadState();
            return;
        }

        if (allCasesToAnalyze.length === 0) {
            setError(t('errorFileNoCases'));
            resetUploadState();
            return;
        }

        const placeholderRecords: CaseRecord[] = allCasesToAnalyze.map((caseItem, index) => ({
            originalText: `${t('caseAnalysisTitle')} from ${caseItem.source}`,
            timestamp: Date.now() + index,
            loading: true,
        }));
        setAnalysisResults(prev => [...placeholderRecords.reverse(), ...prev]);
        setUploadProgress({ current: 0, total: allCasesToAnalyze.length, step: 'analyzing' });
        setIsBatchProcessing(true);

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                // We have a registration, so post the message to the active worker.
                // The optional chaining ?. is a safeguard in case there's no active worker
                // despite `ready` resolving, which is a rare edge case.
                registration.active?.postMessage({
                    type: 'START_ANALYSIS',
                    payload: {
                        cases: allCasesToAnalyze,
                        schema,
                        placeholderRecords,
                        errorTemplates: {
                            title: t('analysisFailedTitle'),
                            message: (err: string) => t('errorFailedCase', err),
                            suggestion: t('errorGenericSuggestion'),
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
    } else {
        setLoading(true);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const text = caseText;

        const placeholder: CaseRecord = {
            originalText: text,
            timestamp: Date.now(),
            loading: true,
        };

        setAnalysisResults(prev => [placeholder, ...prev]);
        setActiveTab('history');
        setCaseText('');
        
        const geminiSchema = convertEditableSchemaToGemini(schema);
        let rawResponseText: string | undefined;

        try {
            const prompt = `Analyze the following legal case text in its original Arabic language from Saudi Arabia and extract the specified information in JSON format according to the provided schema. For any fields that expect long-form text (like facts, reasons, rulings), use simple markdown for formatting: use '**text**' for bolding, '*text*' for italics, '~~text~~' for strikethrough, start lines with '* ' for bullet points, '1. ' for numbered lists, and use Markdown tables for tabular data. If a field is not present in the text, use null for its value. Here is the case text: \n\n${text}`;
            const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: geminiSchema,
            },
            });
            rawResponseText = response.text;
            const analysis = JSON.parse(rawResponseText);
            const newRecord: CaseRecord = { originalText: text, analysis, timestamp: Date.now(), tags: [] };
            const newId = await putCaseInDB(newRecord);
            addLogEntry('CASE_ANALYZED', `Analyzed single case. New Case ID: ${newId}`);
            setAnalysisResults(prev =>
            prev.map(r => r.timestamp === placeholder.timestamp ? { ...newRecord, id: newId, loading: false } : r)
            );
        } catch (err) {
            console.error(err);
            const classifiedError = classifyError(err, rawResponseText);
            const errorRecord: CaseRecord = {
                ...placeholder,
                loading: false,
                error: classifiedError
            };
            const newId = await putCaseInDB(errorRecord);
            setAnalysisResults(prev =>
                prev.map(r => r.timestamp === placeholder.timestamp ? { ...errorRecord, id: newId } : r)
            );
        } finally {
            setLoading(false);
        }
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
        model: 'gemini-2.5-flash',
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
    try {
        if (updatedRecord.id === undefined) {
            throw new Error("Cannot update a record without an ID.");
        }
        await putCaseInDB(updatedRecord);
        addLogEntry('CASE_UPDATED', `Case ID: ${updatedRecord.id} was updated.`);
        setAnalysisResults(prev =>
            prev.map(r => r.id === updatedRecord.id ? updatedRecord : r)
        );
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Failed to update case:", errorMessage);
        setError(t('errorUpdateCase', errorMessage));
        // Re-throw to allow local error handling in the component
        throw err;
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
            <button onClick={() => setLanguage(lang => lang === 'ar' ? 'en' : 'ar')} className="lang-switcher">
                {language === 'ar' ? 'English' : 'العربية'}
            </button>
            <button onClick={() => setView(v => v === 'app' ? 'admin' : 'app')} className="admin-toggle-btn">
                {view === 'app' ? t('adminDashboardButton') : t('appViewButton')}
            </button>
        </div>
        <h1>{t('appTitle')}</h1>
        <p>{t('appDescription')}</p>
      </header>
      
      <ConfirmationDialog
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        onConfirm={() => dialogConfig.onConfirm && dialogConfig.onConfirm()}
        onCancel={closeDialog}
        t={t}
      />

      {view === 'app' ? (
        <>
            <div className="tabs-container" role="tablist">
                <button
                    className={`tab-button ${activeTab === 'input' ? 'active' : ''}`}
                    onClick={() => setActiveTab('input')}
                    role="tab"
                    aria-selected={activeTab === 'input'}
                    aria-controls="input-panel"
                    id="input-tab"
                >
                    {t('analyzeTab')}
                </button>
                <button
                    className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                    role="tab"
                    aria-selected={activeTab === 'history'}
                    aria-controls="history-panel"
                    id="history-tab"
                >
                    {t('historyTab')}
                </button>
                 <button
                    className={`tab-button ${activeTab === 'records' ? 'active' : ''}`}
                    onClick={() => setActiveTab('records')}
                    role="tab"
                    aria-selected={activeTab === 'records'}
                    aria-controls="records-panel"
                    id="records-tab"
                >
                    {t('judicialRecordsTab')}
                </button>
            </div>
            <div className="tab-content">
            {activeTab === 'input' && (
                <div id="input-panel" className="input-section" role="tabpanel" aria-labelledby="input-tab">
                    {error && <div className="error-message">{error}</div>}
                    {isBatchProcessing && uploadProgress ? (
                    <div className="progress-indicator">
                        <p>{uploadProgress.step === 'parsing' ? t('parsingFileProgress', uploadProgress.current, uploadProgress.total) : t('analyzingCasesProgress', uploadProgress.current, uploadProgress.total)}</p>
                        <div className="progress-bar-container">
                        <div
                            className="progress-bar"
                            style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                            aria-valuenow={uploadProgress.current}
                            aria-valuemin={0}
                            aria-valuemax={uploadProgress.total}
                        ></div>
                        </div>
                    </div>
                    ) : (
                    <form onSubmit={handleAnalyze}>
                        <label htmlFor="case-text">{t('caseTextLabel')}</label>
                        <textarea
                            id="case-text"
                            value={caseText}
                            onChange={(e) => {
                                setCaseText(e.target.value);
                                if (uploadedFiles) {
                                    setUploadedFiles(null);
                                    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                                    if (fileInput) fileInput.value = '';
                                }
                            }}
                            placeholder={t('caseTextPlaceholder')}
                            rows={15}
                            disabled={loading || isBatchProcessing}
                            aria-label="Case Text Input"
                        />
                        <div className="divider">{t('orDivider')}</div>
                        <label
                            htmlFor="file-upload"
                            className={`drop-zone ${isDraggingOver ? 'drag-over' : ''}`}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                        >
                            <input id="file-upload" type="file" onChange={handleFileChange} accept=".json,.jsonl,.txt,.md" disabled={loading || isBatchProcessing} multiple />
                            <div className="drop-zone-content">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                { uploadedFiles ? (
                                    <span className="file-name">{t('filesSelected', uploadedFiles.length)}</span>
                                ) : (
                                    <>
                                        <p className="drop-zone-text">{t('dragAndDropPrompt')}</p>
                                        <div className="divider" style={{margin: 'var(--spacing-unit) 0'}}>{t('orDivider')}</div>
                                        <span className="file-label">{t('uploadFileLabel')}</span>
                                    </>
                                )}
                            </div>
                        </label>
                        <button type="submit" disabled={loading || isBatchProcessing}>
                        {loading || isBatchProcessing ? t('analyzingButton') : t('analyzeButton')}
                        </button>
                    </form>
                    )}
                </div>
            )}
            {activeTab === 'history' && (
                <div id="history-panel" className="output-section" role="tabpanel" aria-labelledby="history-tab">
                    {error && activeTab === 'history' && <div className="error-message">{error}</div>}
                    {dbLoading ? (
                        <div className="loader"></div>
                    ) : (analysisResults.length > 0 || searchTerm) ? (
                        <ResultsDisplay 
                            results={filteredResults} 
                            schema={schema}
                            allTags={allTags}
                            onClear={handleClearHistory}
                            onExport={handleExportHistory}
                            onUpdateCase={handleUpdateCase}
                            onDeleteCase={requestDeleteConfirmation}
                            onRetry={handleRetry}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            t={t}
                        />
                    ) : (
                        <div className="placeholder">{t('noHistoryPlaceholder')}</div>
                    )}
                </div>
            )}
             {activeTab === 'records' && (
                <div id="records-panel" className="output-section" role="tabpanel" aria-labelledby="records-tab">
                   <JudicialRecordsViewer t={t} />
                </div>
            )}
            </div>
        </>
      ) : (
        <AdminDashboard
            allCases={analysisResults}
            schema={schema}
            onSchemaUpdate={handleSchemaUpdate}
            onBulkDelete={handleBulkDeleteCases}
            onBulkUpdate={handleBulkUpdateCases}
            t={t}
            theme={theme}
            setTheme={setTheme}
        />
      )}
    </main>
  );
}

const ResultsDisplay = ({ results, schema, allTags, onClear, onExport, onUpdateCase, onDeleteCase, onRetry, searchTerm, setSearchTerm, t }: { 
  results: CaseRecord[], 
  schema: EditableSchema,
  allTags: string[],
  onClear: () => void, 
  onExport: () => void,
  onUpdateCase: (record: CaseRecord) => Promise<void>,
  onDeleteCase: (id: number) => void,
  onRetry: (record: CaseRecord, newText?: string) => void,
  searchTerm: string, 
  setSearchTerm: (term: string) => void,
  t: TFunction
}) => {
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  return (
    <div className="results-container">
      <div className="results-header">
        <h2>{t('analysisHistoryTitle')} ({results.filter(r => !r.loading && !r.error).length})</h2>
        <div className="header-controls">
          <div className="search-input-wrapper">
            <input
              type="search"
              placeholder={t('filterPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Filter analysis history"
            />
            {searchTerm && (
              <button className="clear-search-btn" onClick={() => setSearchTerm('')} aria-label={t('clearSearchLabel')}>
                &times;
              </button>
            )}
          </div>
          <div className="button-group">
            <button className="export-history-btn" onClick={onExport}>{t('exportHistoryButton')}</button>
            <button className="clear-history-btn" onClick={onClear}>{t('clearHistoryButton')}</button>
          </div>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="tag-cloud">
          {allTags.map(tag => (
            <button
              key={tag}
              className={`tag-cloud-item ${searchTerm === tag ? 'active' : ''}`}
              onClick={() => setSearchTerm(tag)}
              title={t('filterByTagTooltip')}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {results.map((result) => {
        const itemKey = result.id ?? result.timestamp;
        return (
          <ResultCard 
            key={itemKey} 
            record={result}
            schema={schema}
            isExpanded={expandedId === itemKey}
            onToggle={() => setExpandedId(currentId => currentId === itemKey ? null : itemKey)}
            onUpdateCase={onUpdateCase}
            onDeleteCase={onDeleteCase}
            onRetry={onRetry}
            onSetSearchTerm={setSearchTerm}
            t={t}
          />
        );
      })}
       {results.length === 0 && searchTerm && (
        <div className="placeholder">{t('noFilterResultsPlaceholder')}</div>
      )}
    </div>
  );
};

const MarkdownRenderer = ({ text }: { text: string | null | undefined }) => {
  if (!text) {
    return null;
  }

  const processInlineMarkdown = (subText: string): React.ReactNode => {
    // This function is now recursive to handle nested markdown elements.
    if (!subText) {
      return null;
    }

    // Regular expression to find the first occurrence of any supported markdown syntax.
    const regex = /(\[([^\]]*)\]\(([^)]*)\))|(\*\*(.*?)\*\*)|(\*(.*?)\*)|(~~(.*?)~~)|(`(.*?)`)/;
    
    const parts: React.ReactNode[] = [];
    let remainingText = subText;
    let key = 0;

    while (remainingText) {
      const match = remainingText.match(regex);

      if (!match) {
        parts.push(remainingText);
        break;
      }
      
      const prefix = remainingText.substring(0, match.index);
      if (prefix) {
        parts.push(prefix);
      }
      
      const fullMatch = match[0];
      
      if (match[1]) { // Link: [text](url)
        const linkText = match[2];
        const url = match[3];
        parts.push(
          <a href={url} key={`${key}-link`} target="_blank" rel="noopener noreferrer">
            {processInlineMarkdown(linkText)}
          </a>
        );
      } else if (match[4]) { // Bold: **content**
        const content = match[5];
        parts.push(<strong key={`${key}-bold`}>{processInlineMarkdown(content)}</strong>);
      } else if (match[6]) { // Italic: *content*
        const content = match[7];
        parts.push(<em key={`${key}-italic`}>{processInlineMarkdown(content)}</em>);
      } else if (match[8]) { // Strikethrough: ~~content~~
        const content = match[9];
        parts.push(<del key={`${key}-del`}>{processInlineMarkdown(content)}</del>);
      } else if (match[10]) { // Inline code: `content`
        const content = match[11];
        parts.push(<code key={`${key}-code`}>{content}</code>);
      } else {
        parts.push(fullMatch);
      }

      remainingText = remainingText.substring(match.index! + fullMatch.length);
      key++;
    }

    return <>{parts}</>;
  };

  const elements: React.ReactNode[] = [];
  let currentUnorderedList: React.ReactNode[] = [];
  let currentOrderedList: React.ReactNode[] = [];
  let currentCodeBlock: string[] = [];
  let inCodeBlock = false;

  const flushUnorderedList = () => {
    if (currentUnorderedList.length > 0) {
      elements.push(<ul key={`ul-${elements.length}`}>{currentUnorderedList}</ul>);
      currentUnorderedList = [];
    }
  };

  const flushOrderedList = () => {
    if (currentOrderedList.length > 0) {
      elements.push(<ol key={`ol-${elements.length}`}>{currentOrderedList}</ul>);
      currentOrderedList = [];
    }
  };

  const flushCodeBlock = () => {
    if (currentCodeBlock.length > 0) {
      elements.push(
        <pre key={`pre-${elements.length}`}>
          <code>{currentCodeBlock.join('\n')}</code>
        </pre>
      );
      currentCodeBlock = [];
    }
  }

  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        flushUnorderedList();
        flushOrderedList();
        inCodeBlock = true;
      }
      continue;
    }
    
    if (inCodeBlock) {
      currentCodeBlock.push(line);
      continue;
    }

    const parseTableCells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map(s => s.trim());
    
    const isSeparatorLine = (l: string) => {
        if (!l.includes('|')) return false;
        const parts = parseTableCells(l);
        if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) return false;
        return parts.every(p => /^\s*:?-+:?\s*$/.test(p) && p.trim() !== '');
    };
    const isTableLine = (l: string) => l.includes('|');

    // Table Detection
    if (isTableLine(line) && i + 1 < lines.length && isSeparatorLine(lines[i + 1])) {
        flushUnorderedList();
        flushOrderedList();

        const headerContent = parseTableCells(line);
        const bodyRows = [];
        
        i += 2; // Move index past header and separator

        while(i < lines.length && isTableLine(lines[i])) {
            bodyRows.push(parseTableCells(lines[i]));
            i++;
        }
        i--; // Decrement because the for loop will increment it

        elements.push(
            <table key={`table-${elements.length}`}>
                <thead>
                    <tr>
                        {headerContent.map((header, index) => (
                            <th key={index}>{processInlineMarkdown(header)}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {bodyRows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                                <td key={cellIndex}>{processInlineMarkdown(cell)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
        continue;
    }

    if (line.trim().startsWith('* ')) {
      flushOrderedList();
      const content = line.trim().substring(2);
      currentUnorderedList.push(<li key={i}>{processInlineMarkdown(content)}</li>);
    } else if (/^\d+\.\s/.test(line.trim())) {
      flushUnorderedList();
      const content = line.trim().replace(/^\d+\.\s/, '');
      currentOrderedList.push(<li key={i}>{processInlineMarkdown(content)}</li>);
    } else {
      flushUnorderedList();
      flushOrderedList();
      if (line.trim() !== '') {
        elements.push(<p key={i}>{processInlineMarkdown(line)}</p>);
      }
    }
  }

  flushUnorderedList();
  flushOrderedList();
  flushCodeBlock();

  return <div className="markdown-content">{elements}</div>;
};

const highlightJsonString = (jsonString: string): string => {
  if (!jsonString) return '';
  return jsonString
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') // Basic HTML escaping
    .replace(/"(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?/g, (match) => {
      let cls = 'json-string';
      if (/:$/.test(match)) {
        cls = 'json-key';
      }
      return `<span class="${cls}">${match}</span>`;
    })
    .replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>')
    .replace(/\b(null)\b/g, '<span class="json-null">$1</span>')
    .replace(/\b-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g, '<span class="json-number">$&</span>');
};

const JsonSyntaxHighlighter = ({ json }: { json: object | null }) => {
  if (!json) {
    return <pre></pre>;
  }
  const jsonString = JSON.stringify(json, null, 2);
  const highlightedJson = highlightJsonString(jsonString);

  return <pre dangerouslySetInnerHTML={{ __html: highlightedJson }} />;
}

type MarkdownToolType = 'bold' | 'italic' | 'strikethrough' | 'code' | 'ul' | 'ol' | 'link';

const MarkdownToolbar = ({ onApply }: { onApply: (type: MarkdownToolType) => void }) => {
    return (
        <div className="markdown-toolbar">
            <button type="button" onClick={() => onApply('bold')} title="Bold"><b>B</b></button>
            <button type="button" onClick={() => onApply('italic')} title="Italic"><i>I</i></button>
            <button type="button" onClick={() => onApply('strikethrough')} title="Strikethrough"><del>S</del></button>
            <button type="button" onClick={() => onApply('ul')} title="Bullet Points" aria-label="Bullet Points">●</button>
            <button type="button" onClick={() => onApply('ol')} title="Numbered List" aria-label="Numbered List">1.</button>
            <button type="button" onClick={() => onApply('code')} title="Inline Code" aria-label="Inline Code">&lt;/&gt;</button>
            <button type="button" onClick={() => onApply('link')} title="Link" aria-label="Link">🔗</button>
        </div>
    );
};

const MarkdownEditor = ({ value, onChange, disabled, rows, id }: { value: string, onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void, disabled?: boolean, rows?: number, id?: string }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    const applyMarkdown = (type: MarkdownToolType) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = value.substring(start, end);

        const wrap = (prefix: string, suffix: string, placeholder: string) => {
            const textToWrap = selectedText || placeholder;
            const newText = `${prefix}${textToWrap}${suffix}`;
            const newValue = value.substring(0, start) + newText + value.substring(end);
            onChange({ target: { value: newValue } } as ChangeEvent<HTMLTextAreaElement>);
            
            setTimeout(() => {
              textarea.focus();
              textarea.setSelectionRange(start + prefix.length, start + prefix.length + textToWrap.length);
            }, 0);
        };

        const prefixLine = (prefix: string) => {
            let lineStart = start;
            while (lineStart > 0 && value[lineStart - 1] !== '\n') {
                lineStart--;
            }
            const newValue = value.substring(0, lineStart) + prefix + value.substring(lineStart);
            onChange({ target: { value: newValue } } as ChangeEvent<HTMLTextAreaElement>);
            
            setTimeout(() => {
              textarea.focus();
              textarea.setSelectionRange(start + prefix.length, end + prefix.length);
            }, 0);
        };
        
        switch(type) {
            case 'bold': wrap('**', '**', 'bold text'); break;
            case 'italic': wrap('*', '*', 'italic text'); break;
            case 'strikethrough': wrap('~~', '~~', 'strikethrough'); break;
            case 'code': wrap('`', '`', 'code'); break;
            case 'link': wrap('[', '](url)', 'link text'); break;
            case 'ul': prefixLine('* '); break;
            case 'ol': prefixLine('1. '); break;
        }
    };
    
    return (
        <div className="markdown-editor-container">
            <MarkdownToolbar onApply={applyMarkdown} />
            <textarea
                id={id}
                ref={textareaRef}
                value={value}
                onChange={onChange}
                disabled={disabled}
                rows={rows}
            />
        </div>
    );
};

// FIX: Define a dedicated props type for ResultCard. This helps TypeScript correctly
// identify it as a React component and understand that the `key` prop is a special,
// reserved prop that doesn't need to be defined in the component's props.
type ResultCardProps = {
    record: CaseRecord;
    schema: EditableSchema;
    isExpanded: boolean;
    onToggle: () => void;
    onUpdateCase: (record: CaseRecord) => Promise<void>;
    onDeleteCase: (id: number) => void;
    onRetry: (record: CaseRecord, newText?: string) => void;
    onSetSearchTerm: (term: string) => void;
    t: TFunction;
};

// FIX: Explicitly type ResultCard as a React.FC to resolve the 'key' prop error.
const ResultCard: React.FC<ResultCardProps> = ({ record, schema, isExpanded, onToggle, onUpdateCase, onDeleteCase, onRetry, onSetSearchTerm, t }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingOriginal, setIsEditingOriginal] = useState(false);
    const [editedAnalysis, setEditedAnalysis] = useState<string>('');
    const [editedOriginalText, setEditedOriginalText] = useState<string>(record.originalText);
    const [jsonError, setJsonError] = useState('');
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('analysis'); // 'analysis', 'original', 'raw'
    // FIX: The 'language' property does not exist on HTMLElement. Switched to using the correct 'lang' property.
    const language = document.documentElement.lang;

    const handleEdit = () => {
        setEditedAnalysis(JSON.stringify(record.analysis, null, 2));
        setIsEditing(true);
        setActiveTab('raw');
    };

    const handleCancel = () => {
        setIsEditing(false);
        setIsEditingOriginal(false);
        setJsonError('');
        setEditedAnalysis('');
        setEditedOriginalText(record.originalText);
    };

    const handleSave = async () => {
        setSaving(true);
        setJsonError('');
        try {
            const newAnalysis = JSON.parse(editedAnalysis);
            await onUpdateCase({ ...record, analysis: newAnalysis, timestamp: Date.now() });
            setIsEditing(false);
        } catch (e) {
            setJsonError(t('errorInvalidJsonFormat'));
        } finally {
            setSaving(false);
        }
    };
    
    const handleSaveAndRetry = async () => {
        setSaving(true);
        await onRetry(record, editedOriginalText);
        setIsEditingOriginal(false);
        setSaving(false);
    };

    const copyToClipboard = (text: string, successMessage: string, event: MouseEvent<HTMLButtonElement>) => {
        navigator.clipboard.writeText(text).then(() => {
            const button = event.target as HTMLButtonElement;
            if (button) {
                const originalText = button.textContent;
                button.textContent = successMessage;
                setTimeout(() => {
                    button.textContent = originalText;
                }, 2000);
            }
        });
    };

    const analysisTitle = record.analysis?.title || record.analysis?.decisionTitle || `${t('judgmentNumberPrefix')} ${record.analysis?.judgmentNumber || 'N/A'}`;
    const caseDate = record.analysis?.date || record.analysis?.judgmentDate;
    
    if (record.loading) {
        return (
            <div className="summary-loading">
                <span dangerouslySetInnerHTML={{ __html: record.originalText.length > 100 ? record.originalText.substring(0, 100) + '...' : record.originalText }}></span>
                <div className="small-loader"></div>
            </div>
        );
    }
    
    const handleDelete = () => {
        if(record.id) {
            onDeleteCase(record.id);
        }
    }
    
    if (record.error && !isEditingOriginal) {
        return (
            <div className="result-card error-card">
                 <div className="error-card-content">
                    <h3>{record.error.title}</h3>
                    <p className="error-card-message">{record.error.message}</p>
                    {record.error.suggestion && <p className="error-suggestion">{record.error.suggestion}</p>}
                    {record.error.raw && (
                         <details>
                            <summary>{t('viewErrorDetails')}</summary>
                            <pre><code>{record.error.raw}</code></pre>
                        </details>
                    )}
                 </div>
                <div className="error-card-actions">
                    <button className="action-btn" onClick={() => setIsEditingOriginal(true)}>{t('editAndRetryButtonLabel')}</button>
                    <button className="action-btn" onClick={() => onRetry(record)}>{t('retryButtonLabel')}</button>
                    {record.id && <button className="delete-btn" onClick={handleDelete}>{t('deleteButtonLabel')}</button>}
                </div>
            </div>
        );
    }
    
    if (isEditingOriginal) {
        return (
             <div className="result-card editing error-card editing">
                 <div className="result-card-edit-body">
                    <h4>{t('editingAnalysisTitle')}</h4>
                    <div className="edit-form-field">
                      <label htmlFor={`original-text-edit-${record.timestamp}`}>{t('originalTextSection')}</label>
                       <MarkdownEditor 
                            id={`original-text-edit-${record.timestamp}`}
                            value={editedOriginalText}
                            onChange={(e) => setEditedOriginalText(e.target.value)}
                            disabled={saving}
                            rows={15}
                        />
                    </div>
                     <div className="edit-form-controls">
                        <button className="cancel-btn" onClick={handleCancel} disabled={saving}>{t('cancelButtonLabel')}</button>
                        <button onClick={handleSaveAndRetry} disabled={saving}>
                            {saving ? t('savingButtonLabel') : t('saveAndRetryButtonLabel')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    
    const TagManager = ({ record, onUpdateCase, t }: { record: CaseRecord, onUpdateCase: (record: CaseRecord) => void, t: TFunction }) => {
        const [newTag, setNewTag] = useState('');

        const handleAddTag = (e: FormEvent) => {
            e.preventDefault();
            const tagToAdd = newTag.trim();
            if (tagToAdd && !(record.tags || []).includes(tagToAdd)) {
                const updatedTags = [...(record.tags || []), tagToAdd].sort();
                onUpdateCase({ ...record, tags: updatedTags });
                setNewTag('');
            }
        };

        const handleRemoveTag = (tagToRemove: string) => {
            const updatedTags = (record.tags || []).filter(tag => tag !== tagToRemove);
            onUpdateCase({ ...record, tags: updatedTags });
        };
        
        return (
            <div className="tags-section">
                <div className="tags-container">
                    {(record.tags && record.tags.length > 0) ? record.tags.map(tag => (
                        <span key={tag} className="tag-item" title={t('filterByTagTooltip')} onClick={() => onSetSearchTerm(tag)}>
                            {tag}
                            <button className="remove-tag-btn" onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }} aria-label={`Remove tag ${tag}`}>&times;</button>
                        </span>
                    )) : <span className="no-tags-placeholder">{t('noTagsPlaceholder')}</span>}
                </div>
                <form onSubmit={handleAddTag} className="add-tag-form">
                    <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder={t('addTagPlaceholder')}
                        className="add-tag-input"
                    />
                    <button type="submit" className="add-tag-btn">{t('addTagButtonLabel')}</button>
                </form>
            </div>
        );
    };
    
    const AnalysisRenderer = ({ analysis, schema, t }: { analysis: any, schema: EditableSchema, t: TFunction }) => {
        // FIX: Update field arrays to match the schema and added translations.
        // FIX: Changed field names to their corresponding TranslationKey to ensure type safety.
        const caseInfoFields: TranslationKey[] = ['idLabel', 'titleLabel', 'decisionTitleLabel', 'yearLabel', 'hijriYearLabel', 'exportDateLabel'];
        const judgmentFields: TranslationKey[] = ['judgmentNumberLabel', 'judgmentDateLabel', 'judgmentHijriDateLabel', 'judgmentCourtNameLabel', 'judgmentCityNameLabel'];
        const appealFields: TranslationKey[] = ['hasAppealLabel', 'appealNumberLabel', 'appealDateLabel', 'appealHijriDateLabel', 'appealCourtNameLabel', 'appealCityNameLabel'];
        const narrationFields: TranslationKey[] = ['judgmentFactsLabel', 'judgmentReasonsLabel', 'judgmentRulingLabel', 'judgmentTextOfRulingLabel', 'judgmentNarrationListLabel'];
        const appealNarrationFields: TranslationKey[] = ['appealFactsLabel', 'appealReasonsLabel', 'appealRulingLabel', 'appealTextOfRulingLabel'];
        
        const renderField = (fieldLabelKey: TranslationKey) => {
            const fieldName = fieldLabelKey.replace(/Label$/, '');
            if (analysis[fieldName] === null || analysis[fieldName] === undefined || analysis[fieldName] === '') return null;
            
            const fieldSchema = schema.find(f => f.name === fieldName);
            const label = t(fieldLabelKey, fieldName);

            let valueDisplay;
            if (typeof analysis[fieldName] === 'boolean') {
                valueDisplay = analysis[fieldName] ? '✔️' : '❌';
            } else if (Array.isArray(analysis[fieldName])) {
                valueDisplay = (
                  <ul>
                    {analysis[fieldName].map((item: any, index: number) => (
                      <li key={index}><MarkdownRenderer text={String(item)} /></li>
                    ))}
                  </ul>
                );
            } else {
                 valueDisplay = <MarkdownRenderer text={String(analysis[fieldName])} />;
            }

            return (
                <div className="field" key={fieldName}>
                    <strong>{fieldSchema?.description || label}</strong>
                    <div className="field-value-wrapper">{valueDisplay}</div>
                </div>
            );
        };
        
        const renderSection = (titleKey: TranslationKey, fields: TranslationKey[]) => {
            const renderedFields = fields.map(renderField).filter(Boolean);
            if (renderedFields.length === 0) return null;
            const isNarration = titleKey.toLowerCase().includes('narration');
            
            return (
                <div className={`result-section ${isNarration ? 'narration-section' : ''}`}>
                    <h4 className="result-section-title">{t(titleKey)}</h4>
                    <div className={isNarration ? '' : 'section-grid-dynamic'}>
                        {renderedFields}
                    </div>
                </div>
            );
        };

        return (
            <>
                {renderSection('caseInfoSection', caseInfoFields)}
                {renderSection('judgmentDetailsSection', judgmentFields)}
                {analysis.hasAppeal && renderSection('appealDetailsSection', appealFields)}
                {renderSection('judgmentNarrationsSection', narrationFields)}
                {analysis.hasAppeal && renderSection('appealNarrationsSection', appealNarrationFields)}
            </>
        );
    };
    
    return (
        <div className={`result-card ${isExpanded ? 'expanded' : ''} ${isEditing ? 'editing' : ''}`}>
            <div className="result-card-header" onClick={onToggle}>
                <div className="summary-info">
                    <h3>{analysisTitle}</h3>
                    <p>{t('caseIdPrefix')}{record.id} &bull; {caseDate ? format(new Date(caseDate), 'PP', { locale: language === 'ar' ? arLocale : enLocale }) : formatDistanceToNow(new Date(record.timestamp), { addSuffix: true, locale: language === 'ar' ? arLocale : enLocale })}</p>
                </div>
                <div className="result-card-header-controls">
                    <div className="expand-indicator"></div>
                </div>
            </div>

            {isExpanded && (
                <div className="result-card-body">
                    <div className="result-card-tabs">
                        <button className={activeTab === 'analysis' ? 'active' : ''} onClick={() => setActiveTab('analysis')}>{t('caseAnalysisTitle')}</button>
                        <button className={activeTab === 'original' ? 'active' : ''} onClick={() => setActiveTab('original')}>{t('originalTextSection')}</button>
                        <button className={activeTab === 'raw' ? 'active' : ''} onClick={() => setActiveTab('raw')}>{t('rawDataSection')}</button>
                    </div>

                    {activeTab === 'analysis' && !isEditing && (
                        <div>
                             <div className="result-section result-section-controls">
                               <TagManager record={record} onUpdateCase={onUpdateCase} t={t} />
                               <div className="card-actions">
                                  <button className="edit-btn" onClick={handleEdit}>{t('editButtonLabel')}</button>
                                  {record.id && <button className="delete-btn" onClick={handleDelete}>{t('deleteButtonLabel')}</button>}
                               </div>
                            </div>
                            <AnalysisRenderer analysis={record.analysis} schema={schema} t={t} />
                        </div>
                    )}
                    
                    {activeTab === 'original' && !isEditing && (
                        <div className="result-section">
                           <div className="result-section-header">
                               <h4 className="result-section-title">{t('originalTextSection')}</h4>
                                <button className="copy-btn" onClick={(e) => copyToClipboard(record.originalText, t('copiedButtonLabel'), e)}>{t('copyButtonLabel')}</button>
                           </div>
                           <pre className="original-text">{record.originalText}</pre>
                        </div>
                    )}

                    {(activeTab === 'raw' || isEditing) && (
                        <div className="result-section">
                             <div className="result-section-header">
                               <h4 className="result-section-title">{isEditing ? t('editingAnalysisTitle') : t('rawDataSection')}</h4>
                               {isEditing ? (
                                    <div className="edit-form-controls">
                                        <button className="cancel-btn" onClick={handleCancel} disabled={saving}>{t('cancelButtonLabel')}</button>
                                        <button onClick={handleSave} disabled={saving}>
                                            {saving ? t('savingButtonLabel') : t('saveButtonLabel')}
                                        </button>
                                    </div>
                               ) : (
                                  <button className="copy-btn" onClick={(e) => copyToClipboard(JSON.stringify(record.analysis, null, 2), t('copiedButtonLabel'), e)}>{t('copyButtonLabel')}</button>
                               )}
                           </div>
                            {isEditing ? (
                                <>
                                    <textarea 
                                        value={editedAnalysis}
                                        onChange={(e) => setEditedAnalysis(e.target.value)}
                                        rows={20}
                                        disabled={saving}
                                        className="json-editor"
                                    />
                                    {jsonError && <div className="json-error">{jsonError}</div>}
                                </>
                            ) : (
                                <JsonSyntaxHighlighter json={record.analysis} />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const RecordDetailView = ({ record, onBack, t }: { record: any, onBack: () => void, t: TFunction }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [activeSection, setActiveSection] = useState('');

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.id);
                }
            });
        }, { rootMargin: "-50% 0px -50% 0px", threshold: 0 });

        const sections = contentRef.current?.querySelectorAll('section[id]');
        sections?.forEach(section => observer.observe(section));

        return () => sections?.forEach(section => observer.unobserve(section));
    }, [record]);


    const renderDetailField = (labelKey: TranslationKey, value: any) => {
        if (value === null || value === undefined || value === '') return null;
        return (
            <div className="field">
                <strong>{t(labelKey)}</strong>
                <div className="field-value-wrapper">
                    {typeof value === 'boolean' ? (value ? '✔️' : '❌') : <MarkdownRenderer text={String(value)} />}
                </div>
            </div>
        );
    };

    const sections = [
        { id: 'case-info', titleKey: 'caseInfoSection', fields: ['title', 'hijri_year'] },
        { id: 'judgment-details', titleKey: 'judgmentDetailsSection', fields: ['judgment_number', 'judgment_hijri_date', 'judgment_court_name', 'judgment_city_name'] },
        { id: 'judgment-text', titleKey: 'judgmentNarrationsSection', fields: ['judgment_text'] },
        ...(record.has_appeal ? [
            { id: 'appeal-details', titleKey: 'appealDetailsSection', fields: ['appeal_number', 'appeal_hijri_date', 'appeal_court_name', 'appeal_city_name'] },
            { id: 'appeal-text', titleKey: 'appealNarrationsSection', fields: ['appeal_text'] }
        ] : []),
        { id: 'metadata', titleKey: 'rawDataSection', fields: ['original_url'] }
    ].filter(section => section.fields.some(field => record[field]));


    if (record.error) {
        return (
             <div className="record-detail-container">
                <button onClick={onBack} className="back-to-list-btn">&larr; {t('backToList')}</button>
                <div className="admin-card">
                    <div className="admin-card-header"><h3>{t('errorRecord')}</h3></div>
                    <div className="admin-card-body">
                        {renderDetailField('errorMessageLabel', record.error)}
                        {renderDetailField('originalUrl', record.original_url)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="record-detail-container">
            <button onClick={onBack} className="back-to-list-btn">&larr; {t('backToList')}</button>
            <div className="record-detail-layout">
                <div className="record-detail-content" ref={contentRef}>
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3>{record.title || t('caseAnalysisTitle')}</h3>
                        </div>
                        <div className="admin-card-body">
                            <section id="case-info">
                                <h4 className="result-section-title">{t('caseInfoSection')}</h4>
                                <div className="section-grid-dynamic">
                                    {renderDetailField('titleLabel', record.title)}
                                    {renderDetailField('yearLabel', record.hijri_year)}
                                </div>
                            </section>
                             <section id="judgment-details">
                                <h4 className="result-section-title">{t('judgmentDetailsSection')}</h4>
                                <div className="section-grid-dynamic">
                                    {renderDetailField('judgmentNumberLabel', record.judgment_number)}
                                    {renderDetailField('dateLabel', record.judgment_hijri_date)}
                                    {renderDetailField('courtLabel', record.judgment_court_name)}
                                    {renderDetailField('courtLabel', record.judgment_city_name)}
                                </div>
                            </section>
                            <section id="judgment-text">
                                <h4 className="result-section-title">{t('judgmentNarrationsSection')}</h4>
                                {renderDetailField('textOfRulingLabel', record.judgment_text)}
                            </section>
                            {record.has_appeal && (
                                <>
                                 <section id="appeal-details">
                                    <h4 className="result-section-title">{t('appealDetailsSection')}</h4>
                                    <div className="section-grid-dynamic">
                                       {renderDetailField('appealNumberLabel', record.appeal_number)}
                                       {renderDetailField('appealDateLabel', record.appeal_hijri_date)}
                                       {renderDetailField('appealCourtLabel', record.appeal_court_name)}
                                       {renderDetailField('appealCourtLabel', record.appeal_city_name)}
                                    </div>
                                </section>
                                 <section id="appeal-text">
                                    <h4 className="result-section-title">{t('appealNarrationsSection')}</h4>
                                    {renderDetailField('appealTextOfRulingLabel', record.appeal_text)}
                                </section>
                                </>
                            )}
                             <section id="metadata">
                                <h4 className="result-section-title">{t('rawDataSection')}</h4>
                                {renderDetailField('originalUrl', <a href={record.original_url} target="_blank" rel="noopener noreferrer">{record.original_url}</a>)}
                            </section>
                        </div>
                    </div>
                </div>
                <aside className="record-detail-sidebar">
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h4>{t('tableOfContents')}</h4>
                        </div>
                        <div className="admin-card-body">
                             <nav className="record-detail-toc">
                                <ul>
                                    {sections.map(section => (
                                         <li key={section.id}>
                                            <a href={`#${section.id}`} className={activeSection === section.id ? 'active' : ''}>{t(section.titleKey)}</a>
                                        </li>
                                    ))}
                                </ul>
                            </nav>
                        </div>
                    </div>
                     <div className="admin-card case-pathfinder-card">
                        <div className="admin-card-header">
                            <h4>{t('casePathfinder')}</h4>
                        </div>
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
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    
    const [filters, setFilters] = useState({
        keyword: '',
        court: '',
        city: '',
        year: '',
        hasAppeal: 'all',
    });

    useEffect(() => {
        const fetchRecords = async () => {
            try {
                setLoading(true);
                const db = await openDB();
                const transaction = db.transaction(JUDICIAL_RECORDS_STORE_NAME, 'readonly');
                const store = transaction.objectStore(JUDICIAL_RECORDS_STORE_NAME);
                const allRecords = await new Promise<any[]>((resolve, reject) => {
                    const request = store.getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                setRecords(allRecords.sort((a,b) => (b.hijri_year || 0) - (a.hijri_year || 0)));
            } catch (error) {
                console.error("Failed to fetch judicial records:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchRecords();
    }, []);

    const uniqueCourts = useMemo(() => {
        const courts = new Set<string>();
        records.forEach(r => {
            if (r.judgment_court_name) courts.add(r.judgment_court_name);
            if (r.appeal_court_name) courts.add(r.appeal_court_name);
        });
        return Array.from(courts).sort();
    }, [records]);

     const uniqueCities = useMemo(() => {
        const cities = new Set<string>();
        records.forEach(r => {
            if (r.judgment_city_name) cities.add(r.judgment_city_name);
            if (r.appeal_city_name) cities.add(r.appeal_city_name);
        });
        return Array.from(cities).sort();
    }, [records]);

    const uniqueYears = useMemo(() => {
        const years = new Set<number>();
        records.forEach(r => {
            if (r.hijri_year && r.hijri_year > 1000) years.add(r.hijri_year);
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [records]);

    const handleFilterChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        setFilters({ keyword: '', court: '', city: '', year: '', hasAppeal: 'all' });
    };

    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const keywordLower = filters.keyword.toLowerCase();
            const textCorpus = JSON.stringify(r).toLowerCase();
            if (filters.keyword && !textCorpus.includes(keywordLower)) return false;
            
            const recordCourt = r.judgment_court_name || r.appeal_court_name;
            if (filters.court && recordCourt !== filters.court) return false;
            
            const recordCity = r.judgment_city_name || r.appeal_city_name;
            if (filters.city && recordCity !== filters.city) return false;
            
            if (filters.year && String(r.hijri_year) !== filters.year) return false;

            if (filters.hasAppeal !== 'all') {
                const hasAppeal = filters.hasAppeal === 'true';
                if (r.has_appeal !== hasAppeal) return false;
            }
            
            return true;
        });
    }, [records, filters]);
    
    const selectedRecord = useMemo(() => {
        if (!selectedRecordId) return null;
        return records.find(r => r.case_id === selectedRecordId);
    }, [records, selectedRecordId]);
    
    if (loading) {
      return <div className="loader"></div>
    }

    return (
      <div className="records-viewer-layout">
        <aside className="records-sidebar">
            <div className="filter-group">
                <input type="search" name="keyword" value={filters.keyword} onChange={handleFilterChange} placeholder={t('searchByKeyword')} />
            </div>
            <h4 className="filters-title">{t('filtersTitle')}</h4>
            <div className="filter-group">
                <label htmlFor="court-filter">{t('filterByCourt')}</label>
                <select id="court-filter" name="court" value={filters.court} onChange={handleFilterChange}>
                    <option value="">{t('allRecords')}</option>
                    {uniqueCourts.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
             <div className="filter-group">
                <label htmlFor="city-filter">{t('filterByCity')}</label>
                <select id="city-filter" name="city" value={filters.city} onChange={handleFilterChange}>
                    <option value="">{t('allRecords')}</option>
                    {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
            <div className="filter-group">
                <label htmlFor="year-filter">{t('filterByYear')}</label>
                <select id="year-filter" name="year" value={filters.year} onChange={handleFilterChange}>
                    <option value="">{t('allRecords')}</option>
                    {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
             <div className="filter-group">
                <label>{t('filterByAppeal')}</label>
                <div className="radio-group">
                    <label><input type="radio" name="hasAppeal" value="all" checked={filters.hasAppeal === 'all'} onChange={handleFilterChange} /> {t('allRecords')}</label>
                    <label><input type="radio" name="hasAppeal" value="true" checked={filters.hasAppeal === 'true'} onChange={handleFilterChange} /> {t('withAppeal')}</label>
                    <label><input type="radio" name="hasAppeal" value="false" checked={filters.hasAppeal === 'false'} onChange={handleFilterChange} /> {t('withoutAppeal')}</label>
                </div>
            </div>
            <button onClick={resetFilters} className="reset-filters-btn admin-button-secondary">{t('resetFilters')}</button>
        </aside>
        <div className="records-main-content">
            {selectedRecord ? (
                <RecordDetailView record={selectedRecord} onBack={() => setSelectedRecordId(null)} t={t} />
            ) : (
                <div className="records-list">
                    {filteredRecords.length > 0 ? (
                        filteredRecords.map(record => (
                            <div key={record.case_id} className={`record-card ${record.error ? 'error-record' : ''}`} onClick={() => setSelectedRecordId(record.case_id)}>
                                <h4>{record.title || record.case_id}</h4>
                                <div className="record-card-meta">
                                    {record.error ? (
                                        <span>{t('errorLabel')}: {record.error}</span>
                                    ) : (
                                        <>
                                            <span>{t('courtLabel')}: {record.judgment_court_name || 'N/A'}</span>
                                            <span>{t('yearLabel')}: {record.hijri_year || 'N/A'}</span>
                                            <span>{t('hasAppealLabel')}: {record.has_appeal ? '✔️' : '❌'}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="placeholder">{t('noRecordsFound')}</div>
                    )}
                </div>
            )}
        </div>
      </div>
    );
};

const AdminDashboard = ({ allCases, schema, onSchemaUpdate, onBulkDelete, onBulkUpdate, t, theme, setTheme }: { 
    allCases: CaseRecord[], 
    schema: EditableSchema,
    onSchemaUpdate: (schema: EditableSchema) => Promise<void>,
    onBulkDelete: (ids: number[]) => void,
    onBulkUpdate: (updates: Map<number, CaseRecord>) => void,
    t: TFunction,
    theme: string,
    setTheme: (theme: string) => void,
}) => {
    const [activeSection, setActiveSection] = useState('analytics');

    const renderSection = () => {
        switch(activeSection) {
            case 'analytics':
                return <AnalyticsSection allCases={allCases} t={t} />;
            case 'data':
                return <CaseDataManagementSection cases={allCases} onBulkDelete={onBulkDelete} onBulkUpdate={onBulkUpdate} t={t} />;
            case 'schema':
                return <SchemaSettingsSection schema={schema} onSchemaUpdate={onSchemaUpdate} t={t} />;
             case 'settings':
                return <ConfigurationSettingsSection t={t} theme={theme} setTheme={setTheme} />;
            case 'users':
            case 'content':
            case 'security':
            case 'audit':
            case 'status':
            case 'api':
                 return <PlaceholderSection t={t} />;
            default:
                return null;
        }
    };
    
    return (
        <div className="admin-dashboard">
            <aside className="admin-sidebar">
                <h3 className="admin-sidebar-title">{t('adminDashboardTitle')}</h3>
                <nav className="admin-sidebar-nav">
                    <button className={activeSection === 'analytics' ? 'active' : ''} onClick={() => setActiveSection('analytics')}>{t('analyticsSection')}</button>
                    <button className={activeSection === 'data' ? 'active' : ''} onClick={() => setActiveSection('data')}>{t('caseDataManagementSection')}</button>
                    <button className={activeSection === 'schema' ? 'active' : ''} onClick={() => setActiveSection('schema')}>{t('schemaSettingsSection')}</button>
                    <button className={activeSection === 'settings' ? 'active' : ''} onClick={() => setActiveSection('settings')}>{t('configurationSettingsSection')}</button>
                </nav>
            </aside>
            <main className="admin-main-content">
                {renderSection()}
            </main>
        </div>
    );
};

const PlaceholderSection = ({t}: {t: TFunction}) => (
    <div className="placeholder-content with-overlay">
        <div className="placeholder-overlay">
            <span>{t('backendRequiredNotice')}</span>
        </div>
        <div className="admin-card">
            <div className="admin-card-header"><h3>Placeholder</h3></div>
            <div className="admin-card-body"><div className="placeholder">Content unavailable</div></div>
        </div>
    </div>
);

const AnalyticsSection = ({allCases, t}: {allCases: CaseRecord[], t:TFunction}) => {
    const stats = useMemo(() => {
        const successfulCases = allCases.filter(c => !c.loading && c.analysis && !c.error);
        const casesWithAppeals = successfulCases.filter(c => c.analysis.hasAppeal).length;
        const analysisErrors = allCases.filter(c => c.error).length;
        const tags = new Set<string>();
        successfulCases.forEach(c => c.tags?.forEach(tag => tags.add(tag)));
        return {
            total: successfulCases.length,
            withAppeals: casesWithAppeals,
            errors: analysisErrors,
            uniqueTags: tags.size,
        };
    }, [allCases]);

    const casesLast30DaysData = useMemo(() => {
        const labels = Array.from({ length: 30 }).map((_, i) => format(subDays(new Date(), 29 - i), 'MMM d')).reverse();
        const data = Array(30).fill(0);
        const thirtyDaysAgo = startOfDay(subDays(new Date(), 29));
        
        allCases.forEach(c => {
            if (!c.error && c.timestamp >= thirtyDaysAgo.getTime()) {
                const dayIndex = 29- Math.floor((Date.now() - c.timestamp) / (1000 * 60 * 60 * 24));
                if (dayIndex >= 0 && dayIndex < 30) {
                    data[dayIndex]++;
                }
            }
        });

        return {
            labels: labels.reverse(),
            datasets: [{
                label: t('totalCasesAnalyzed'),
                data: data.reverse(),
                backgroundColor: 'rgba(74, 144, 226, 0.7)',
                borderColor: 'rgba(74, 144, 226, 1)',
                borderWidth: 1,
            }]
        };
    }, [allCases, t]);
    
    const appealStatusData = useMemo(() => {
        const withAppeal = stats.withAppeals;
        const withoutAppeal = stats.total - stats.withAppeals;
        return {
            labels: [t('withAppeal'), t('withoutAppeal')],
            datasets: [{
                data: [withAppeal, withoutAppeal],
                backgroundColor: ['#4CAF50', '#FFC107'],
                borderColor: [ '#4CAF50', '#FFC107'],
                borderWidth: 1,
            }]
        };
    }, [stats, t]);

    return (
        <div>
            <div className="admin-header"><h2>{t('analyticsSection')}</h2></div>
            <div className="stat-cards-grid">
                <div className="stat-card"><h4>{t('totalCasesAnalyzed')}</h4><p>{stats.total}</p></div>
                <div className="stat-card"><h4>{t('casesWithAppeals')}</h4><p>{stats.withAppeals}</p></div>
                <div className="stat-card"><h4>{t('analysisErrors')}</h4><p>{stats.errors}</p></div>
                <div className="stat-card"><h4>{t('totalUniqueTags')}</h4><p>{stats.uniqueTags}</p></div>
            </div>
            <div className="charts-grid">
                <div className="admin-card chart-container"><Bar options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: t('casesAnalyzedLast30Days') }}}} data={casesLast30DaysData} /></div>
                <div className="admin-card chart-container"><Doughnut options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, title: { display: true, text: t('casesByAppealStatus') }}}} data={appealStatusData} /></div>
            </div>
        </div>
    );
};

const CaseDataManagementSection = ({ cases, onBulkDelete, onBulkUpdate, t }: { cases: CaseRecord[], onBulkDelete: (ids: number[]) => void, onBulkUpdate: (updates: Map<number, CaseRecord>) => void, t: TFunction }) => {
    return <PlaceholderSection t={t} />
}

const SchemaSettingsSection = ({ schema, onSchemaUpdate, t }: { schema: EditableSchema, onSchemaUpdate: (schema: EditableSchema) => Promise<void>, t: TFunction }) => {
    return <PlaceholderSection t={t} />
}

const ConfigurationSettingsSection = ({ t, theme, setTheme }: { t: TFunction, theme: string, setTheme: (theme: string) => void }) => {
    return (
      <div>
        <div className="admin-header"><h2>{t('configurationSettingsSection')}</h2></div>
        <div className="admin-card">
          <div className="admin-card-header"><h3>{t('apiSettingsSection')}</h3></div>
          <div className="admin-card-body">
            <div className="form-group">
                <label>{t('geminiApiLabel')}</label>
                <input type="text" value={t('apiKeyManagedByEnv')} disabled />
            </div>
            <div className="form-group">
                <label>{t('defaultModelLabel')}</label>
                <input type="text" value="gemini-2.5-flash" disabled />
            </div>
          </div>
        </div>
      </div>
    )
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);