/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from '@google/genai';
import { useState, FormEvent, ChangeEvent, useEffect, useMemo, useCallback, useRef, MouseEvent } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { format, subDays, startOfDay } from 'date-fns';


ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const DB_NAME = 'JudgmentCaseDB';
const DB_VERSION = 1;
const STORE_NAME = 'cases';

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
    originalTextSection: "النص الأصلي",
    rawDataSection: "بيانات JSON الخام",
    idLabel: "المعرف",
    titleLabel: "العنوان",
    decisionTitleLabel: "عنوان القرار",
    yearLabel: "السنة",
    exportDateLabel: "تاريخ التصدير",
    judgmentNumberLabel: "رقم الحكم",
    dateLabel: "التاريخ",
    courtLabel: "المحكمة",
    appealNumberLabel: "رقم الاستئناف",
    appealDateLabel: "تاريخ الاستئناف",
    appealCourtLabel: "محكمة الاستئناف",
    factsLabel: "الوقائع",
    reasonsLabel: "الأسباب",
    rulingLabel: "المنطوق",
    textOfRulingLabel: "نص الحكم",
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
    errorInvalidJsonl: "تنسيق JSONL غير صالح. يجب أن يكون كل سطر عبارة عن كائن JSON صالح.",
    errorJsonNotArray: "يجب أن يكون ملف JSON مصفوفة من العناصر.",
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
    errorGenericSuggestion: "يمكنك إعادة محاولة التحليل، أو تعديل النص الأصلي إذا كنت تشك في أنه قد يكون سبب المشكلة.",
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
    originalTextSection: "Original Text",
    rawDataSection: "Raw JSON Data",
    idLabel: 'ID',
    titleLabel: 'Title',
    decisionTitleLabel: 'Decision Title',
    yearLabel: 'Year',
    exportDateLabel: 'Export Date',
    judgmentNumberLabel: 'Judgment Number',
    dateLabel: 'Date',
    courtLabel: 'Court',
    appealNumberLabel: 'Appeal Number',
    appealDateLabel: 'Appeal Date',
    appealCourtLabel: 'Appeal Court',
    factsLabel: "Facts",
    reasonsLabel: "Reasons",
    rulingLabel: "Ruling",
    textOfRulingLabel: "Text of Ruling",
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
    errorInvalidJsonl: 'Invalid JSONL format. Each line must be a valid JSON object.',
    errorJsonNotArray: 'JSON file must be an array of items.',
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
    errorGenericSuggestion: "You can retry the analysis, or edit the original text if you suspect it may be causing the issue.",
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
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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


const schema = {
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

type TFunction = (key: TranslationKey, ...args: any[]) => string;

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
  const [loading, setLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [language, setLanguage] = useState(localStorage.getItem('judgment-analyzer-lang') || 'ar');
  const [activeTab, setActiveTab] = useState('input');
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
  }>({ isOpen: false, title: '', message: '', onConfirm: null });
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [view, setView] = useState<'app' | 'admin'>('app');

  useEffect(() => {
    // Apply theme on initial load
    const savedTheme = localStorage.getItem('judgment-analyzer-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  useEffect(() => {
    localStorage.setItem('judgment-analyzer-lang', language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const t = useCallback((key: TranslationKey, ...args: any[]) => {
    const lang = language as 'ar' | 'en';
    const entry = translations[lang][key] || translations.en[key];
    if (typeof entry === 'function') {
      return (entry as any)(...args);
    }
    return entry;
  }, [language]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await getAllCasesFromDB();
        setAnalysisResults(history);
      } catch (err) {
        console.error("Failed to load history from DB:", err);
        setError(t('errorLoadHistory'));
      } finally {
        setDbLoading(false);
      }
    };
    loadHistory();
  }, [t]);
  
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = e.target.files;
      const allowedExtensions = ['.json', '.jsonl', '.txt', '.md'];
      const allValid = Array.from(files).every(file => 
        allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
      );
  
      if (allValid) {
        setUploadedFiles(files);
        setCaseText(''); // Clear textarea when files are selected
        setError('');
      } else {
        setError(t('errorInvalidFile'));
        e.target.value = ''; // Reset file input
        setUploadedFiles(null);
      }
    }
  };

  const resetUploadState = () => {
    setLoading(false);
    setUploadedFiles(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  const classifyError = (err: any, rawResponse?: string): CaseError => {
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
    
    if (errorMessage.includes('[400') || err.name === 'GoogleGenerativeAIError') {
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
    setLoading(true);
    setError('');

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const analyzeSingleCase = async (text: string) => {
      const placeholder: CaseRecord = {
        originalText: text,
        timestamp: Date.now(),
        loading: true,
      };

      setAnalysisResults(prev => [placeholder, ...prev]);
      setActiveTab('history');
      setCaseText('');
      
      let rawResponseText: string | undefined;
      try {
        const prompt = `Analyze the following legal case text from Saudi Arabia and extract the specified information in JSON format. For the 'judgmentFacts', 'judgmentReasons', 'judgmentRuling', 'appealFacts', 'appealReasons', and 'appealRuling' fields, use simple markdown for formatting: use '**text**' for bolding, '~~text~~' for strikethrough, '\`code\`' for inline code, start lines with '* ' for bullet points, start lines with '1. ' for numbered lists, '[link text](url)' for hyperlinks, and enclose multi-line code snippets in triple backticks (\`\`\`). For tabular data, use Markdown table format. If a field is not present in the text, use null for its value. Here is the case text: \n\n${text}`;
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
          },
        });
        rawResponseText = response.text;
        const analysis = JSON.parse(rawResponseText);
        const newRecord: CaseRecord = { originalText: text, analysis, timestamp: Date.now(), tags: [] };
        const newId = await putCaseInDB(newRecord);
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
        setAnalysisResults(prev =>
            prev.map(r => r.timestamp === placeholder.timestamp ? errorRecord : r)
        );
      } finally {
        setLoading(false);
      }
    };

    if (uploadedFiles) {
        const getCasesFromFiles = async (files: FileList): Promise<string[]> => {
            const fileReadPromises = Array.from(files).map(file => {
                return new Promise<string[]>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try {
                            const content = event.target?.result as string;
                            if (!content || !content.trim()) {
                                resolve([]);
                                return;
                            }
                            const fileName = file.name.toLowerCase();

                            const extractText = (item: any): string | null => {
                                if (typeof item === 'string' && item.trim()) {
                                    return item.trim();
                                }
                                if (typeof item === 'object' && item !== null) {
                                    if (typeof item.originalText === 'string' && item.originalText.trim()) return item.originalText.trim();
                                    if (typeof item.text === 'string' && item.text.trim()) return item.text.trim();
                                    if (typeof item.content === 'string' && item.content.trim()) return item.content.trim();
                                    // Fallback for objects without a clear text field
                                    return JSON.stringify(item);
                                }
                                return null;
                            };

                            if (fileName.endsWith('.jsonl')) {
                                const cases = content.trim().split('\n')
                                    .filter(line => line.trim() !== '')
                                    .map(line => {
                                        try {
                                            const parsed = JSON.parse(line);
                                            return extractText(parsed);
                                        } catch {
                                            return null; // Ignore malformed JSON lines
                                        }
                                    })
                                    .filter((c): c is string => !!c);
                                resolve(cases);
                            } else if (fileName.endsWith('.json')) {
                                const parsedContent = JSON.parse(content);
                                if (Array.isArray(parsedContent)) {
                                    const cases = parsedContent
                                        .map(extractText)
                                        .filter((c): c is string => !!c);
                                    resolve(cases);
                                } else {
                                    // Handle single JSON object file or other JSON value
                                    const caseText = extractText(parsedContent);
                                    resolve(caseText ? [caseText] : []);
                                }
                            } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
                                resolve([content]);
                            } else {
                                resolve([]);
                            }
                        } catch (err) {
                            if (err instanceof SyntaxError) {
                                reject(new Error(t('errorInvalidJson')));
                            } else {
                                reject(err);
                            }
                        }
                    };
                    reader.onerror = () => reject(new Error(t('errorReadFile')));
                    reader.readAsText(file);
                });
            });

            const nestedCases = await Promise.all(fileReadPromises);
            return nestedCases.flat();
        };

      try {
        const cases = await getCasesFromFiles(uploadedFiles);
        if (cases.length === 0) {
          setError(t('errorFileNoCases'));
          resetUploadState();
          return;
        }

        setUploadProgress({ current: 0, total: cases.length });

        const placeholderRecords: CaseRecord[] = cases.map((text: string, index: number) => ({
          originalText: text,
          timestamp: Date.now() + index, // Unique temporary key
          loading: true,
        }));

        setAnalysisResults(prev => [...placeholderRecords.reverse(), ...prev]);
        setActiveTab('history');

        for (const [index, placeholder] of placeholderRecords.entries()) {
          let rawResponseText: string | undefined;
          try {
            const prompt = `Analyze the following legal case text from Saudi Arabia and extract the specified information in JSON format. For the 'judgmentFacts', 'judgmentReasons', 'judgmentRuling', 'appealFacts', 'appealReasons', and 'appealRuling' fields, use simple markdown for formatting: use '**text**' for bolding, '~~text~~' for strikethrough, '\`code\`' for inline code, start lines with '* ' for bullet points, start lines with '1. ' for numbered lists, '[link text](url)' for hyperlinks, and enclose multi-line code snippets in triple backticks (\`\`\`). For tabular data, use Markdown table format. If a field is not present in the text, use null for its value. Here is the case text: \n\n${placeholder.originalText}`;
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
              },
            });
            rawResponseText = response.text;
            const analysis = JSON.parse(rawResponseText);
            const newRecord: CaseRecord = {
              originalText: placeholder.originalText,
              analysis,
              timestamp: Date.now(),
              tags: []
            };
            const newId = await putCaseInDB(newRecord);

            setAnalysisResults(prev =>
              prev.map(r => r.timestamp === placeholder.timestamp ? { ...newRecord, id: newId, loading: false } : r)
            );
          } catch (err) {
            console.error(`Failed to analyze case:`, err);
            const classifiedError = classifyError(err, rawResponseText);
            const errorRecord = {
              ...placeholder,
              loading: false,
              error: classifiedError,
            };
            setAnalysisResults(prev =>
              prev.map(r => r.timestamp === placeholder.timestamp ? errorRecord : r)
            );
          } finally {
            setUploadProgress(prev => prev ? { ...prev, current: index + 1 } : null);
          }
        }
      } catch (err) {
        console.error(err);
         setError(err instanceof Error ? err.message : 'An unexpected error occurred during file processing.');
      } finally {
        resetUploadState();
        setUploadProgress(null);
      }
    } else {
      await analyzeSingleCase(caseText);
    }
  };
  
  const handleRetry = async (caseToRetry: CaseRecord, newText?: string) => {
    const textToAnalyze = newText ?? caseToRetry.originalText;
    
    setAnalysisResults(prev => prev.map(r =>
      r.timestamp === caseToRetry.timestamp ? { ...caseToRetry, originalText: textToAnalyze, loading: true, error: undefined } : r
    ));

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    let rawResponseText: string | undefined;
    try {
      const prompt = `Analyze the following legal case text from Saudi Arabia and extract the specified information in JSON format. For the 'judgmentFacts', 'judgmentReasons', 'judgmentRuling', 'appealFacts', 'appealReasons', and 'appealRuling' fields, use simple markdown for formatting: use '**text**' for bolding, '~~text~~' for strikethrough, '\`code\`' for inline code, start lines with '* ' for bullet points, start lines with '1. ' for numbered lists, '[link text](url)' for hyperlinks, and enclose multi-line code snippets in triple backticks (\`\`\`). For tabular data, use Markdown table format. If a field is not present in the text, use null for its value. Here is the case text: \n\n${textToAnalyze}`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });
      rawResponseText = response.text;
      const analysis = JSON.parse(rawResponseText);
      const updatedRecord: CaseRecord = { ...caseToRetry, originalText: textToAnalyze, analysis, timestamp: Date.now(), loading: false, error: undefined, tags: caseToRetry.tags || [] };
      const newId = await putCaseInDB(updatedRecord);
      setAnalysisResults(prev =>
        prev.map(r => r.timestamp === caseToRetry.timestamp ? { ...updatedRecord, id: newId } : r)
      );
    } catch (err) {
      console.error("Retry failed:", err);
      const classifiedError = classifyError(err, rawResponseText);
      const errorRecord = {
        ...caseToRetry,
        originalText: textToAnalyze,
        loading: false,
        error: classifiedError,
      };
      setAnalysisResults(prev =>
        prev.map(r => r.timestamp === caseToRetry.timestamp ? errorRecord : r)
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
                await clearAllCasesFromDB();
                setAnalysisResults([]);
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
        await putCaseInDB(updatedRecord); // Re-using put for update
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
            </div>
            <div className="tab-content">
            {activeTab === 'input' && (
                <div id="input-panel" className="input-section" role="tabpanel" aria-labelledby="input-tab">
                    {error && <div className="error-message">{error}</div>}
                    {loading && uploadProgress ? (
                    <div className="progress-indicator">
                        <p>{t('analyzingCasesProgress', uploadProgress.current, uploadProgress.total)}</p>
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
                            disabled={loading}
                            aria-label="Case Text Input"
                        />
                        <div className="divider">{t('orDivider')}</div>
                        <div className="file-input-wrapper">
                        <label htmlFor="file-upload" className="file-label">
                            {t('uploadFileLabel')}
                        </label>
                        <input id="file-upload" type="file" onChange={handleFileChange} accept=".json,.jsonl,.txt,.md" disabled={loading} multiple />
                        {uploadedFiles && <span className="file-name">{t('filesSelected', uploadedFiles.length)}</span>}
                        </div>
                        <button type="submit" disabled={loading}>
                        {loading ? t('analyzingButton') : t('analyzeButton')}
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
            </div>
        </>
      ) : (
        <AdminDashboard allCases={analysisResults} t={t} />
      )}
    </main>
  );
}

const ResultsDisplay = ({ results, allTags, onClear, onExport, onUpdateCase, onDeleteCase, onRetry, searchTerm, setSearchTerm, t }: { 
  results: CaseRecord[], 
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
        const key = result.id ?? result.timestamp;
        return (
          <ResultCard 
            key={key} 
            record={result}
            isExpanded={expandedId === key}
            onToggle={() => setExpandedId(currentId => currentId === key ? null : key)}
            onUpdate={onUpdateCase}
            onDelete={onDeleteCase}
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
    const regex = /(\[([^\]]*)\]\(([^)]*)\))|(\*\*(.*?)\*\*)|(~~(.*?)~~)|(`(.*?)`)/;
    
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
      } else if (match[6]) { // Strikethrough: ~~content~~
        const content = match[7];
        parts.push(<del key={`${key}-del`}>{processInlineMarkdown(content)}</del>);
      } else if (match[8]) { // Inline code: `content`
        const content = match[9];
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
      elements.push(<ol key={`ol-${elements.length}`}>{currentOrderedList}</ol>);
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


const LongTextField = ({ label, text, className }: { label: string, text: string | null | undefined, className?: string }) => {
  if (!text) {
    return null;
  }
  return (
    <div className={`long-text-field ${className || ''}`}>
      <h5 className="long-text-field-label">{label}</h5>
      <div className="long-text-field-content">
        <MarkdownRenderer text={text} />
      </div>
    </div>
  );
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

type MarkdownToolType = 'bold' | 'strikethrough' | 'code' | 'ul' | 'ol' | 'link';

const MarkdownToolbar = ({ onApply }: { onApply: (type: MarkdownToolType) => void }) => {
    return (
        <div className="markdown-toolbar">
            <button type="button" onClick={() => onApply('bold')} title="Bold"><b>B</b></button>
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

const JsonEditor = ({ value, onChange, disabled, t, id }: { value: string, onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void, disabled?: boolean, t: TFunction, id?: string }) => {
  const [error, setError] = useState('');
  const preRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!value.trim()) {
      setError('');
      return;
    }
    try {
      JSON.parse(value);
      setError('');
    } catch (e) {
      setError(t('errorInvalidJsonFormat'));
    }
  }, [value, t]);

  const handleScroll = () => {
    if (preRef.current && textareaRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const highlightedValue = highlightJsonString(value);

  return (
    <div className="json-editor-container">
      <pre ref={preRef} aria-hidden="true">
        <code dangerouslySetInnerHTML={{ __html: highlightedValue + '\n' }} />
      </pre>
      <textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={onChange}
        disabled={disabled}
        onScroll={handleScroll}
        spellCheck="false"
        aria-invalid={!!error}
        aria-describedby={error ? `json-error-desc` : undefined}
      />
      {error && <p id="json-error-desc" className="json-error" role="alert">{error}</p>}
    </div>
  );
};


const ResultCard = ({ record, isExpanded, onToggle, onUpdate, onDelete, onRetry, onSetSearchTerm, t }: { record: CaseRecord; isExpanded: boolean; onToggle: () => void; onUpdate: (record: CaseRecord) => Promise<void>; onDelete: (id: number) => void; onRetry: (record: CaseRecord, newText?: string) => void; onSetSearchTerm: (term: string) => void; t: TFunction; }) => {
  const { loading, error, analysis, originalText, id } = record;
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingFromError, setIsEditingFromError] = useState(false);
  const [editedOriginalText, setEditedOriginalText] = useState(originalText);
  const [editedAnalysis, setEditedAnalysis] = useState(JSON.stringify(analysis || {}, null, 2));
  const [jsonError, setJsonError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copyStatus, setCopyStatus] = useState(t('copyButtonLabel'));
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    // Reset copy button text if language changes
    setCopyStatus(t('copyButtonLabel'));
  }, [t, isExpanded]);

  const handleCopyJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!analysis) return;
    const jsonString = JSON.stringify(analysis, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopyStatus(t('copiedButtonLabel'));
      setTimeout(() => setCopyStatus(t('copyButtonLabel')), 2000);
    }).catch(err => {
      console.error('Failed to copy JSON:', err);
    });
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedOriginalText(originalText);
    setEditedAnalysis(JSON.stringify(analysis || {}, null, 2));
    setJsonError('');
    setIsEditing(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (id !== undefined) {
        onDelete(id);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsEditingFromError(false);
  };
  
  const handleSave = async () => {
    setJsonError('');
    let parsedAnalysis;
    try {
        parsedAnalysis = JSON.parse(editedAnalysis);
    } catch (error) {
        setJsonError(t('errorInvalidJsonFormat'));
        return;
    }

    if (id === undefined) {
        setJsonError('Cannot save record without an ID.');
        return;
    }

    setIsSaving(true);
    try {
      const updatedRecord: CaseRecord = {
          ...record,
          id,
          originalText: editedOriginalText,
          analysis: parsedAnalysis,
      };
      await onUpdate(updatedRecord);
      setIsEditing(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setJsonError(t('errorUpdateCase', errorMessage));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim() || id === undefined) return;

    const currentTags = record.tags || [];
    const trimmedTag = newTag.trim();
    if (currentTags.map(t => t.toLowerCase()).includes(trimmedTag.toLowerCase())) {
        setNewTag('');
        return;
    }

    const updatedRecord: CaseRecord = {
        ...record,
        id,
        tags: [...currentTags, trimmedTag],
    };

    try {
        await onUpdate(updatedRecord);
        setNewTag('');
    } catch (err) {
        console.error("Failed to add tag", err);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (id === undefined) return;
    
    const updatedTags = (record.tags || []).filter(tag => tag !== tagToRemove);
    const updatedRecord: CaseRecord = { ...record, id, tags: updatedTags };

    try {
        await onUpdate(updatedRecord);
    } catch (err) {
        console.error("Failed to remove tag", err);
    }
  };

  if (loading) {
    return (
        <div className="result-card">
            <div className="summary-loading">
                <span>{t('loadingAnalysis')}</span>
                <div className="small-loader"></div>
            </div>
        </div>
    )
  }

  if (error) {
    if (isEditingFromError) {
        return (
            <div className="result-card editing error-card">
                <div className="result-card-edit-body">
                    <h4>{t('editAndRetryButtonLabel')}</h4>
                    <div className="edit-form-field">
                        <label htmlFor={`edit-original-text-error-${record.timestamp}`}>{t('originalTextSection')}</label>
                        <MarkdownEditor
                            id={`edit-original-text-error-${record.timestamp}`}
                            value={editedOriginalText}
                            onChange={(e) => setEditedOriginalText(e.target.value)}
                            rows={15}
                        />
                    </div>
                    <div className="edit-form-controls">
                        <button className="cancel-btn" onClick={handleCancel}>{t('cancelButtonLabel')}</button>
                        <button onClick={() => { onRetry(record, editedOriginalText); setIsEditingFromError(false); }}>
                            {t('saveAndRetryButtonLabel')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
      <div className="result-card error-card">
        <div className="error-card-content">
          <h3>{error.title}</h3>
          <p className="error-card-message">{error.message}</p>
          {error.suggestion && <p className="error-suggestion">{error.suggestion}</p>}
          {error.raw && (
            <details>
              <summary>{t('viewErrorDetails')}</summary>
              <pre>{error.raw}</pre>
            </details>
          )}
        </div>
        <div className="error-card-actions">
          <button className="action-btn" onClick={() => onRetry(record)}>
            {t('retryButtonLabel')}
          </button>
          <button className="action-btn" onClick={() => { setIsEditingFromError(true); setEditedOriginalText(originalText); }}>
            {t('editAndRetryButtonLabel')}
          </button>
        </div>
      </div>
    );
  }
  
  if (!analysis) return null;

  if (isEditing) {
    return (
      <div className="result-card editing">
        <div className="result-card-edit-body">
          <h4>{t('editingAnalysisTitle')}</h4>
          <div className="edit-form-field">
            <label htmlFor={`edit-original-text-${id}`}>{t('originalTextSection')}</label>
            <MarkdownEditor
              id={`edit-original-text-${id}`}
              value={editedOriginalText}
              onChange={(e) => setEditedOriginalText(e.target.value)}
              rows={10}
              disabled={isSaving}
            />
          </div>
          <div className="edit-form-field">
            <label htmlFor={`edit-analysis-json-${id}`}>{t('rawDataSection')}</label>
            <JsonEditor
              id={`edit-analysis-json-${id}`}
              value={editedAnalysis}
              onChange={(e) => setEditedAnalysis(e.target.value)}
              disabled={isSaving}
              t={t}
            />
            {jsonError && <p className="json-error" role="alert">{jsonError}</p>}
          </div>
          <div className="edit-form-controls">
            <button className="cancel-btn" onClick={handleCancel} disabled={isSaving}>{t('cancelButtonLabel')}</button>
            <button onClick={handleSave} disabled={isSaving}>
              {isSaving ? t('savingButtonLabel') : t('saveButtonLabel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderField = (label: string, value: any) => {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      return null;
    }
    return (
      <div className="field">
        <strong>{label}:</strong> <span>{typeof value === 'boolean' ? String(value) : value}</span>
      </div>
    );
  };
  
  return (
    <div className={`result-card ${isExpanded ? 'expanded' : ''}`}>
      <div
        className="result-card-header"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
        aria-expanded={isExpanded}
      >
        <div className="summary-info">
          <h3>{analysis.title || analysis.decisionTitle || t('caseAnalysisTitle')}</h3>
          <p>{analysis.judgmentNumber ? `${t('judgmentNumberPrefix')}${analysis.judgmentNumber}` : (analysis.id ? `${t('caseIdPrefix')}${analysis.id}`: t('clickViewDetails'))}</p>
        </div>
        <div className="result-card-header-controls">
           {id !== undefined && <button className="edit-btn" onClick={handleEdit}>{t('editButtonLabel')}</button>}
           {id !== undefined && <button className="delete-btn" onClick={handleDelete}>{t('deleteButtonLabel')}</button>}
           <div className="expand-indicator" />
        </div>
      </div>

      {isExpanded && (
        <div className="result-card-body">
            <div className="result-section">
              <h4 className="result-section-title">{t('caseInfoSection')}</h4>
              <div className="section-content section-grid">
                {renderField(t('idLabel'), analysis.id)}
                {renderField(t('titleLabel'), analysis.title)}
                {renderField(t('decisionTitleLabel'), analysis.decisionTitle)}
                {renderField(t('yearLabel'), analysis.year && analysis.hijriYear ? `${analysis.year} / ${analysis.hijriYear}H` : analysis.year || analysis.hijriYear)}
                {renderField(t('exportDateLabel'), analysis.exportDate)}
              </div>
            </div>

            {analysis.hasJudgment && (
              <div className="result-section">
                <h4 className="result-section-title">{t('judgmentDetailsSection')}</h4>
                <div className="section-content">
                  <div className="section-grid">
                    {renderField(t('judgmentNumberLabel'), analysis.judgmentNumber)}
                    {renderField(t('dateLabel'), analysis.judgmentDate && analysis.judgmentHijriDate ? `${analysis.judgmentDate} / ${analysis.judgmentHijriDate}H` : analysis.judgmentDate || analysis.judgmentHijriDate)}
                    {renderField(t('courtLabel'), analysis.judgmentCourtName && analysis.judgmentCityName ? `${analysis.judgmentCourtName}, ${analysis.judgmentCityName}`: analysis.judgmentCourtName || analysis.judgmentCityName)}
                  </div>
                  <LongTextField label={t('factsLabel')} text={analysis.judgmentFacts} className="field-facts" />
                  <LongTextField label={t('reasonsLabel')} text={analysis.judgmentReasons} className="field-reasons" />
                  <LongTextField label={t('rulingLabel')} text={analysis.judgmentRuling} className="field-ruling" />
                  <LongTextField label={t('textOfRulingLabel')} text={analysis.judgmentTextOfRuling} />
                </div>
              </div>
            )}

            {analysis.hasAppeal && (
               <div className="result-section">
                <h4 className="result-section-title">{t('appealDetailsSection')}</h4>
                <div className="section-content">
                  <div className="section-grid">
                    {renderField(t('appealNumberLabel'), analysis.appealNumber)}
                    {renderField(t('appealDateLabel'), analysis.appealDate && analysis.appealHijriDate ? `${analysis.appealDate} / ${analysis.appealHijriDate}H` : analysis.appealDate || analysis.appealHijriDate)}
                    {renderField(t('appealCourtLabel'), analysis.appealCourtName && analysis.appealCityName ? `${analysis.appealCourtName}, ${analysis.appealCityName}`: analysis.appealCourtName || analysis.appealCityName)}
                  </div>
                  <LongTextField label={t('appealFactsLabel')} text={analysis.appealFacts} className="field-facts" />
                  <LongTextField label={t('appealReasonsLabel')} text={analysis.appealReasons} className="field-reasons" />
                  <LongTextField label={t('appealRulingLabel')} text={analysis.appealRuling} className="field-ruling" />
                  <LongTextField label={t('appealTextOfRulingLabel')} text={analysis.appealTextOfRuling} />
                </div>
              </div>
            )}

            {analysis.judgmentNarrationList && analysis.judgmentNarrationList.length > 0 && (
              <div className="result-section">
                <h4 className="result-section-title">{t('judgmentNarrationsSection')}</h4>
                <div className="section-content">
                  <ul>
                    {analysis.judgmentNarrationList.map((narration: string, index: number) => (
                      <li key={index}>{narration}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            
            <div className="result-section">
                <h4 className="result-section-title">{t('tagsLabel')}</h4>
                <div className="section-content">
                    <div className="tags-container">
                        {(record.tags && record.tags.length > 0) ? (
                            record.tags.map(tag => (
                                <span
                                    key={tag}
                                    className="tag-item"
                                    onClick={(e) => { e.stopPropagation(); onSetSearchTerm(tag); }}
                                    title={t('filterByTagTooltip')}
                                >
                                    {tag}
                                    <button
                                        className="remove-tag-btn"
                                        onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }}
                                        aria-label={`Remove tag ${tag}`}
                                    >
                                        &times;
                                    </button>
                                </span>
                            ))
                        ) : (
                            <p className="no-tags-placeholder">{t('noTagsPlaceholder')}</p>
                        )}
                    </div>
                    <form className="add-tag-form" onSubmit={handleAddTag}>
                        <input
                            type="text"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            placeholder={t('addTagPlaceholder')}
                            className="add-tag-input"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button type="submit" className="add-tag-btn" onClick={(e) => e.stopPropagation()}>
                            {t('addTagButtonLabel')}
                        </button>
                    </form>
                </div>
            </div>

            <div className="result-section">
              <h4 className="result-section-title">{t('originalTextSection')}</h4>
              <div className="section-content">
                <p className="original-text">{originalText}</p>
              </div>
            </div>

            <div className="result-section">
              <div className="result-section-header">
                <h4 className="result-section-title">{t('rawDataSection')}</h4>
                <button className="copy-btn" onClick={handleCopyJson}>{copyStatus}</button>
              </div>
              <div className="section-content">
                <JsonSyntaxHighlighter json={analysis} />
              </div>
            </div>
        </div>
      )}
    </div>
  );
};

// --- ADMIN DASHBOARD COMPONENTS ---

const AdminDashboard = ({ allCases, t }: { allCases: CaseRecord[], t: TFunction }) => {
    const [activeSection, setActiveSection] = useState('analytics');

    const sections = {
        analytics: <AnalyticsSection allCases={allCases} t={t} />,
        users: <UserManagementSection t={t} />,
        content: <ContentManagementSection t={t} />,
        security: <SecurityMonitoringSection t={t} />,
        settings: <ConfigurationSettingsSection t={t} />,
    };

    return (
        <div className="admin-dashboard">
            <aside className="admin-sidebar">
                <h3>{t('adminDashboardTitle')}</h3>
                <nav>
                    <button className={activeSection === 'analytics' ? 'active' : ''} onClick={() => setActiveSection('analytics')}>{t('analyticsSection')}</button>
                    <button className={activeSection === 'users' ? 'active' : ''} onClick={() => setActiveSection('users')}>{t('userManagementSection')}</button>
                    <button className={activeSection === 'content' ? 'active' : ''} onClick={() => setActiveSection('content')}>{t('contentManagementSection')}</button>
                    <button className={activeSection === 'security' ? 'active' : ''} onClick={() => setActiveSection('security')}>{t('securityMonitoringSection')}</button>
                    <button className={activeSection === 'settings' ? 'active' : ''} onClick={() => setActiveSection('settings')}>{t('configurationSettingsSection')}</button>
                </nav>
            </aside>
            <main className="admin-content">
                {sections[activeSection as keyof typeof sections]}
            </main>
        </div>
    );
};

const AnalyticsSection = ({ allCases, t }: { allCases: CaseRecord[], t: TFunction }) => {
    const { totalCases, casesWithAppeal, analysisErrors, uniqueTags } = useMemo(() => {
        const successfulCases = allCases.filter(c => !c.loading && !c.error && c.analysis);
        const tags = new Set<string>();
        successfulCases.forEach(c => c.tags?.forEach(tag => tags.add(tag)));
        
        return {
            totalCases: successfulCases.length,
            casesWithAppeal: successfulCases.filter(c => c.analysis?.hasAppeal).length,
            analysisErrors: allCases.filter(c => !!c.error).length,
            uniqueTags: tags.size
        };
    }, [allCases]);

    const barChartData = useMemo(() => {
        const successfulCases = allCases.filter(c => !c.loading && !c.error && c.analysis);
        const labels: string[] = [];
        const data: number[] = [];
        const dateMap = new Map<string, number>();

        for (let i = 29; i >= 0; i--) {
            const date = subDays(new Date(), i);
            const formattedDate = format(date, 'MMM d');
            labels.push(formattedDate);
            dateMap.set(format(startOfDay(date), 'yyyy-MM-dd'), 0);
        }

        successfulCases.forEach(c => {
            const caseDate = format(startOfDay(new Date(c.timestamp)), 'yyyy-MM-dd');
            if (dateMap.has(caseDate)) {
                dateMap.set(caseDate, (dateMap.get(caseDate) || 0) + 1);
            }
        });
        
        labels.forEach(label => {
            // Re-create the key from the label to look up in the map
            const dateKey = format(startOfDay(new Date(label + ' ' + new Date().getFullYear())), 'yyyy-MM-dd');
             if(dateMap.has(dateKey)) {
                data.push(dateMap.get(dateKey)!);
             }
        });

        return {
            labels,
            datasets: [{
                label: t('totalCasesAnalyzed'),
                data,
                backgroundColor: 'rgba(74, 144, 226, 0.6)',
                borderColor: 'rgba(74, 144, 226, 1)',
                borderWidth: 1,
            }]
        };
    }, [allCases, t]);

    const doughnutChartData = useMemo(() => {
        return {
            labels: [t('withAppeal'), t('withoutAppeal')],
            datasets: [{
                data: [casesWithAppeal, totalCases - casesWithAppeal],
                backgroundColor: ['#4A90E2', '#d9e7f8'],
                borderColor: ['#ffffff', '#ffffff'],
                borderWidth: 2,
            }]
        };
    }, [casesWithAppeal, totalCases, t]);

    return (
        <div className="analytics-section">
            <div className="stat-cards-grid">
                <div className="stat-card"><h4>{t('totalCasesAnalyzed')}</h4><p>{totalCases}</p></div>
                <div className="stat-card"><h4>{t('casesWithAppeals')}</h4><p>{casesWithAppeal}</p></div>
                <div className="stat-card"><h4>{t('analysisErrors')}</h4><p>{analysisErrors}</p></div>
                <div className="stat-card"><h4>{t('totalUniqueTags')}</h4><p>{uniqueTags}</p></div>
            </div>
            <div className="charts-grid">
                <div className="chart-container">
                    <h3>{t('casesAnalyzedLast30Days')}</h3>
                    <Bar data={barChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                </div>
                <div className="chart-container">
                    <h3>{t('casesByAppealStatus')}</h3>
                    <Doughnut data={doughnutChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }} }}/>
                </div>
            </div>
        </div>
    );
};

const PlaceholderOverlay = ({ t }: { t: TFunction }) => (
    <div className="placeholder-overlay" title={t('backendRequiredNotice')}>
        <span>{t('backendRequiredNotice')}</span>
    </div>
);

const UserManagementSection = ({ t }: { t: TFunction }) => {
    return (
        <div className="admin-placeholder-section">
            <h2>{t('userManagementSection')}</h2>
            <div className="placeholder-content">
                <PlaceholderOverlay t={t} />
                <div className="placeholder-header">
                    <h3>Users</h3>
                    <button disabled>Add New User</button>
                </div>
                <table className="placeholder-table">
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
                    <tbody>
                        <tr><td>Admin User</td><td>admin@example.com</td><td>Admin</td><td><button disabled>Edit</button> <button disabled>Delete</button></td></tr>
                        <tr><td>Analyst User</td><td>analyst@example.com</td><td>Analyst</td><td><button disabled>Edit</button> <button disabled>Delete</button></td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ContentManagementSection = ({ t }: { t: TFunction }) => {
    return (
        <div className="admin-placeholder-section">
            <h2>{t('contentManagementSection')}</h2>
            <div className="placeholder-content">
                <PlaceholderOverlay t={t} />
                <div className="placeholder-header">
                    <h3>Manage Content</h3>
                    <button disabled>Add New Article</button>
                </div>
                <p>A section for managing articles, guides, or other centralized content would appear here.</p>
            </div>
        </div>
    );
};

const SecurityMonitoringSection = ({ t }: { t: TFunction }) => {
    return (
        <div className="admin-placeholder-section">
            <h2>{t('securityMonitoringSection')}</h2>
            <div className="placeholder-content">
                <PlaceholderOverlay t={t} />
                <div className="placeholder-header">
                    <h3>Activity Log</h3>
                </div>
                <table className="placeholder-table">
                    <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
                    <tbody>
                        <tr><td>2024-07-28 10:30 AM</td><td>admin@example.com</td><td>LOGIN_SUCCESS</td><td>IP: 192.168.1.1</td></tr>
                        <tr><td>2024-07-28 10:32 AM</td><td>analyst@example.com</td><td>CASE_ANALYZED</td><td>Case ID: 4521</td></tr>
                        <tr><td>2024-07-28 10:35 AM</td><td>admin@example.com</td><td>USER_DELETED</td><td>User: olduser@example.com</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ConfigurationSettingsSection = ({ t }: { t: TFunction }) => {
    const [theme, setTheme] = useState(localStorage.getItem('judgment-analyzer-theme') || 'light');

    const handleThemeChange = (e: ChangeEvent<HTMLInputElement>) => {
        const newTheme = e.target.checked ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('judgment-analyzer-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };
    
    return (
        <div className="admin-settings-section">
            <h2>{t('configurationSettingsSection')}</h2>
            <div className="setting-item">
                <label htmlFor="theme-switcher">{t('themeLabel')}</label>
                <div className="theme-switcher">
                    <span>{t('lightTheme')}</span>
                    <label className="switch">
                        <input id="theme-switcher" type="checkbox" checked={theme === 'dark'} onChange={handleThemeChange} />
                        <span className="slider round"></span>
                    </label>
                    <span>{t('darkTheme')}</span>
                </div>
            </div>
            <div className="admin-placeholder-section" style={{marginTop: '2rem'}}>
                 <div className="placeholder-content">
                    <PlaceholderOverlay t={t} />
                    <h3>Integrations</h3>
                    <p>Configuration for third-party services and API keys would appear here.</p>
                </div>
            </div>
        </div>
    );
};


const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);