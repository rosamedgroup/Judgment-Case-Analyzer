/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from '@google/genai';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import * as ReactChartJS from 'react-chartjs-2';
const { Bar, Doughnut } = ReactChartJS as any;
import { formatDistance } from 'date-fns/formatDistance';
import { ar as arLocale } from 'date-fns/locale/ar';
import { enUS as enLocale } from 'date-fns/locale/en-US';
import { judicialData } from './data.ts';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// Database Logic
const DB_NAME = 'JudgmentCaseDB';
const DB_VERSION = 5;
const STORE_NAME = 'cases';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

const putCaseInDB = (record: any): Promise<number> => openDB().then(db => new Promise((resolve, reject) => {
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.put(record);
  request.onsuccess = () => resolve(request.result as number);
  request.onerror = () => reject(request.error);
}));

const getAllCasesFromDB = (): Promise<any[]> => openDB().then(db => new Promise((resolve, reject) => {
  const transaction = db.transaction(STORE_NAME, 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();
  request.onsuccess = () => resolve(request.result.sort((a,b) => b.timestamp - a.timestamp));
  request.onerror = () => reject(request.error);
}));

const deleteCaseFromDB = (id: number): Promise<void> => openDB().then(db => new Promise((resolve, reject) => {
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.delete(id);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
}));

// Localized Strings
const translations: any = {
  ar: {
    appTitle: "المحلل القضائي الذكي",
    analyze: "تحليل",
    history: "السجل",
    repository: "المستودع",
    admin: "لوحة التحكم",
    analyzeBtn: "بدء التحليل",
    analyzing: "جاري التحليل...",
    casePlaceholder: "الصق نص الحكم القضائي هنا للتحليل...",
    facts: "الوقائع",
    reasons: "الأسباب والحيثيات",
    ruling: "منطوق الحكم",
    parties: "أطراف الدعوى",
    proceduralHistory: "التاريخ الإجرائي",
    lawsCited: "الأنظمة والقوانين المستند إليها",
    noHistory: "لا توجد تحليلات سابقة.",
    judgmentNo: "صك رقم",
    court: "المحكمة",
    date: "تاريخ الحكم",
    status: "حالة القضية",
    appellantRespondent: "المستأنف والمستأنف ضده",
    back: "رجوع",
    export: "تصدير",
    delete: "حذف",
    details: "التفاصيل",
    legalAnalytics: "تحليلات قانونية",
    topCitedLaws: "الأنظمة الأكثر استشهاداً",
    frequencyCount: (count: number) => `تكرر ${count} مرّات في سجلاتك`,
    commonReferences: "المراجع الشائعة",
    select: "تحديد",
    cancel: "إلغاء",
    selectAll: "تحديد الكل",
    deselectAll: "إلغاء التحديد",
    deleteSelected: "حذف المحدد",
    exportSelected: "تصدير المحدد",
    exportAll: "تصدير الكل",
    confirmBulkDelete: "هل أنت متأكد من حذف السجلات المحددة؟ هذه العملية لا يمكن التراجع عنها.",
    selectedCount: (n: number) => `${n} محدد`,
    citationCount: "عدد مرات الاستشهاد",
    analyzeThisCase: "تحليل القضية واستخراج الوقائع",
    repositoryNotice: "هذه البيانات مستخرجة من السجلات العامة. للحصول على تحليل قانوني متعمق (مثل استخراج المواد النظامية وتلخيص دقيق)، استخدم زر التحليل بالذكاء الاصطناعي.",
    originalText: "النص الأصلي",
    structuredView: "التحليل المهيكل",
    processing: "جاري المعالجة...",
    batchMode: "تحليل بالجملة",
    singleCase: "قضية واحدة",
    caseTitleOptional: "عنوان القضية (اختياري)",
    addToQueue: "إضافة للقائمة",
    queueEmpty: "القائمة فارغة. أضف قضايا للبدء.",
    analyzeQueue: "تحليل الكل",
    queue: "قائمة الانتظار",
    itemsInQueue: (n: number) => `${n} عناصر في القائمة`,
    clearQueue: "مسح القائمة",
    statusPending: "انتظار",
    statusProcessing: "معالجة",
    statusCompleted: "مكتمل",
    statusFailed: "فشل",
    viewInHistory: "عرض في السجل",
    noContent: "لا يوجد محتوى نصي"
  },
  en: {
    appTitle: "Smart Judicial Analyzer",
    analyze: "Analyze",
    history: "History",
    repository: "Repository",
    admin: "Admin Panel",
    analyzeBtn: "Start Analysis",
    analyzing: "Analyzing...",
    casePlaceholder: "Paste judgment text here for analysis...",
    facts: "Facts",
    reasons: "Reasons & Merits",
    ruling: "Ruling",
    parties: "Parties Involved",
    proceduralHistory: "Procedural History",
    lawsCited: "Cited Laws & Statutes",
    noHistory: "No history found.",
    judgmentNo: "Judgment #",
    court: "Court",
    date: "Decision Date",
    status: "Case Status",
    appellantRespondent: "Appellant & Respondent",
    back: "Back",
    export: "Export",
    delete: "Delete",
    details: "Details",
    legalAnalytics: "Legal Analytics",
    topCitedLaws: "Most Frequently Cited Laws",
    frequencyCount: (count: number) => `Cited ${count} times in history`,
    commonReferences: "Common References",
    select: "Select",
    cancel: "Cancel",
    selectAll: "Select All",
    deselectAll: "Deselect All",
    deleteSelected: "Delete Selected",
    exportSelected: "Export Selected",
    exportAll: "Export All",
    confirmBulkDelete: "Are you sure you want to delete the selected records? This action cannot be undone.",
    selectedCount: (n: number) => `${n} selected`,
    citationCount: "Citation Count",
    analyzeThisCase: "Analyze Case & Extract Facts",
    repositoryNotice: "These data are from public records. For in-depth legal analysis (e.g. extracting statutes and precise summary), use the AI Analysis button.",
    originalText: "Original Text",
    structuredView: "Structured View",
    processing: "Processing...",
    batchMode: "Batch Analysis",
    singleCase: "Single Case",
    caseTitleOptional: "Case Title (Optional)",
    addToQueue: "Add to Queue",
    queueEmpty: "Queue is empty. Add cases to start.",
    analyzeQueue: "Analyze All",
    queue: "Queue",
    itemsInQueue: (n: number) => `${n} items in queue`,
    clearQueue: "Clear Queue",
    statusPending: "Pending",
    statusProcessing: "Processing",
    statusCompleted: "Completed",
    statusFailed: "Failed",
    viewInHistory: "View in History",
    noContent: "No text content available"
  }
};

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short descriptive title for the case" },
    judgmentNumber: { type: Type.STRING, description: "Official judgment number" },
    courtName: { type: Type.STRING, description: "Name of the court" },
    courtDecisionDate: { type: Type.STRING, description: "Date of the judgment/decision" },
    caseStatus: { type: Type.STRING, description: "Status of the ruling (e.g. Final, Appealable)" },
    appellantRespondent: { type: Type.STRING, description: "Names of Appellant and Respondent if applicable" },
    parties: {
      type: Type.ARRAY,
      description: "List of parties and their roles (Claimant, Defendant, etc.)",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          role: { type: Type.STRING }
        },
        required: ["name", "role"]
      }
    },
    proceduralHistory: { type: Type.STRING, description: "Summary of previous judicial steps and hearings" },
    facts: { type: Type.STRING, description: "Detailed facts of the case in Markdown" },
    reasons: { type: Type.STRING, description: "Detailed legal reasoning and merits in Markdown" },
    ruling: { type: Type.STRING, description: "The final dispositive ruling in Markdown" },
    lawsCited: {
      type: Type.ARRAY,
      description: "Specific laws or articles cited in the reasoning",
      items: { type: Type.STRING }
    }
  },
  required: ["title", "judgmentNumber", "courtName", "parties", "proceduralHistory", "facts", "reasons", "ruling", "lawsCited"]
};

// Rich Text Editor Component
const RichTextEditor = ({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder: string }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync initial and external changes to the editor
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const execCommand = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className="rte-container">
      <div className="rte-toolbar">
        <button type="button" className="rte-tool" onClick={() => execCommand('bold')} title="Bold">
          <span className="material-symbols-outlined">format_bold</span>
        </button>
        <button type="button" className="rte-tool" onClick={() => execCommand('italic')} title="Italic">
          <span className="material-symbols-outlined">format_italic</span>
        </button>
        <button type="button" className="rte-tool" onClick={() => execCommand('insertUnorderedList')} title="Bullet Points">
          <span className="material-symbols-outlined">format_list_bulleted</span>
        </button>
        <div style={{ flex: 1 }} />
      </div>
      <div
        ref={editorRef}
        className="rte-editor"
        contentEditable
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onPaste={(e) => {
          // Optional: handle plain text paste if desired, 
          // but contentEditable handles rich paste by default.
        }}
        data-placeholder={placeholder}
      />
    </div>
  );
};

// UI Components
const Header = ({ lang, setLang, theme, toggleTheme, t }: any) => (
  <header className="main-header">
    <h1>
      <span className="material-symbols-outlined" style={{ fontSize: '2rem', color: 'var(--brand-primary)' }}>gavel</span>
      {t('appTitle')}
    </h1>
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
        {lang === 'ar' ? 'English' : 'العربية'}
      </button>
      <button className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={toggleTheme}>
        <span className="material-symbols-outlined">{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>
      </button>
    </div>
  </header>
);

const Navigation = ({ activeTab, setActiveTab, t }: any) => (
  <nav className="navigation-bar">
    <button className={`nav-link ${activeTab === 'analyze' ? 'active' : ''}`} onClick={() => setActiveTab('analyze')}>
      <span className="material-symbols-outlined">auto_awesome</span> {t('analyze')}
    </button>
    <button className={`nav-link ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
      <span className="material-symbols-outlined">history</span> {t('history')}
    </button>
    <button className={`nav-link ${activeTab === 'records' ? 'active' : ''}`} onClick={() => setActiveTab('records')}>
      <span className="material-symbols-outlined">inventory_2</span> {t('repository')}
    </button>
    <button className={`nav-link ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => setActiveTab('admin')}>
      <span className="material-symbols-outlined">dashboard</span> {t('admin')}
    </button>
  </nav>
);

const MarkdownText = ({ text }: { text: string }) => {
  const formatted = text
    .split('\n')
    .map((line, i) => {
      let content = line;
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        return (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--brand-primary)' }}>•</span>
                <span dangerouslySetInnerHTML={{ __html: content.substring(2) }} />
            </div>
        );
      }
      return <p key={i} dangerouslySetInnerHTML={{ __html: content }} />;
    });
  
  return <div className="legal-content">{formatted}</div>;
};

const LegalAnalyticsDashboard = ({ lawsCited, globalLawStats, t }: any) => {
  const topCitedInApp = Object.entries(globalLawStats)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="card" style={{ background: 'var(--bg-surface-alt)', border: 'none', marginTop: '1rem', borderRight: '4px solid var(--brand-accent)' }}>
      <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--brand-primary)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>analytics</span>
        {t('legalAnalytics')}
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t('commonReferences')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {topCitedInApp.map(([law, count]: any, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{law}</span>
              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>{count}x</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AnalysisDetails = ({ analysis, globalLawStats, t }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
      <div className="card" style={{ background: 'var(--bg-surface-alt)', border: 'none' }}>
        <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('judgmentNo')}</h4>
        <p style={{ fontWeight: '700' }}>{analysis.judgmentNumber}</p>
      </div>
      <div className="card" style={{ background: 'var(--bg-surface-alt)', border: 'none' }}>
        <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('court')}</h4>
        <p style={{ fontWeight: '700' }}>{analysis.courtName}</p>
      </div>
      {analysis.courtDecisionDate && (
        <div className="card" style={{ background: 'var(--bg-surface-alt)', border: 'none' }}>
            <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('date')}</h4>
            <p style={{ fontWeight: '700' }}>{analysis.courtDecisionDate}</p>
        </div>
      )}
      {analysis.caseStatus && (
        <div className="card" style={{ background: 'var(--bg-surface-alt)', border: 'none' }}>
            <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('status')}</h4>
            <p style={{ fontWeight: '700' }}>{analysis.caseStatus}</p>
        </div>
      )}
    </div>

    {analysis.appellantRespondent && (
        <div className="card" style={{ background: 'var(--bg-surface-alt)', border: 'none' }}>
             <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('appellantRespondent')}</h4>
             <p style={{ fontWeight: '700' }}>{analysis.appellantRespondent}</p>
        </div>
    )}

    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
      <section>
        <h3 className="card-title" style={{ fontSize: '1rem' }}>{t('parties')}</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {analysis.parties.map((p: any, idx: number) => (
            <span key={idx} className="badge" style={{ textTransform: 'none', padding: '0.5rem 1rem' }}>
              <strong>{p.role}:</strong> {p.name}
            </span>
          ))}
        </div>
      </section>

      {globalLawStats && <LegalAnalyticsDashboard lawsCited={analysis.lawsCited} globalLawStats={globalLawStats} t={t} />}
    </div>

    <section>
      <h3 className="card-title" style={{ fontSize: '1rem' }}>{t('proceduralHistory')}</h3>
      <MarkdownText text={analysis.proceduralHistory} />
    </section>

    <section>
      <h3 className="card-title" style={{ fontSize: '1rem' }}>{t('facts')}</h3>
      <MarkdownText text={analysis.facts} />
    </section>

    <section>
      <h3 className="card-title" style={{ fontSize: '1rem' }}>{t('reasons')}</h3>
      <MarkdownText text={analysis.reasons} />
    </section>

    <section style={{ padding: '1.5rem', background: 'var(--brand-primary-soft)', borderRadius: 'var(--radius-md)', borderRight: '4px solid var(--brand-primary)' }}>
      <h3 className="card-title" style={{ fontSize: '1rem', color: 'var(--brand-primary)' }}>{t('ruling')}</h3>
      <MarkdownText text={analysis.ruling} />
    </section>

    {analysis.lawsCited && analysis.lawsCited.length > 0 && (
      <section>
        <h3 className="card-title" style={{ fontSize: '1rem' }}>{t('lawsCited')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {analysis.lawsCited.map((law: string, idx: number) => {
            const freq = globalLawStats?.[law] || 0;
            return (
              <div key={idx} style={{ padding: '0.75rem', background: 'var(--bg-surface-alt)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem' }}>{law}</span>
                {freq > 1 && (
                  <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', verticalAlign: 'middle', marginRight: '4px' }}>trending_up</span>
                    {t('frequencyCount')(freq)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    )}
  </div>
);

type AnalyzeSectionProps = {
    text: string;
    setText: (t: string) => void;
    onAnalyze: () => void;
    isLoading: boolean;
    result: any;
    globalLawStats: any;
    t: (k: string) => any;
    processAnalysis: (text: string, title?: string) => Promise<any>;
};

const AnalyzeSection = ({ text, setText, onAnalyze, isLoading, result, globalLawStats, t, processAnalysis }: AnalyzeSectionProps) => {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [queue, setQueue] = useState<any[]>([]);
  const [batchTitle, setBatchTitle] = useState('');
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const addToQueue = () => {
    if (!text.trim()) return;
    const newItem = {
        id: Date.now(),
        title: batchTitle.trim() || `${t('singleCase')} #${queue.length + 1}`,
        text: text,
        status: 'pending', // pending, processing, completed, failed
        result: null
    };
    setQueue(prev => [...prev, newItem]);
    setText('');
    setBatchTitle('');
  };

  const removeFromQueue = (id: number) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const runBatch = async () => {
    setIsBatchProcessing(true);
    const newQueue = [...queue];
    
    for (let i = 0; i < newQueue.length; i++) {
        if (newQueue[i].status === 'completed') continue;
        
        // Update status to processing
        newQueue[i].status = 'processing';
        setQueue([...newQueue]);

        try {
            const res = await processAnalysis(newQueue[i].text, newQueue[i].title);
            newQueue[i].status = 'completed';
            newQueue[i].result = res;
        } catch (e) {
            console.error(e);
            newQueue[i].status = 'failed';
        }
        setQueue([...newQueue]);
        // Small delay to prevent rate limits
        await new Promise(r => setTimeout(r, 1000));
    }
    setIsBatchProcessing(false);
  };

  const getStatusIcon = (status: string) => {
     switch(status) {
         case 'pending': return 'hourglass_empty';
         case 'processing': return 'sync';
         case 'completed': return 'check_circle';
         case 'failed': return 'error';
         default: return 'circle';
     }
  };

  const getStatusColor = (status: string) => {
     switch(status) {
         case 'pending': return 'var(--text-muted)';
         case 'processing': return 'var(--brand-primary)';
         case 'completed': return 'var(--status-success)';
         case 'failed': return 'var(--status-error)';
         default: return 'var(--text-muted)';
     }
  };

  return (
    <div className="grid-analyze">
      <section className="card" style={{ gridColumn: mode === 'batch' ? 'span 2' : undefined }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 className="card-title" style={{ marginBottom: 0 }}><span className="material-symbols-outlined">description</span> {t('analyze')}</h2>
            
            <div style={{ background: 'var(--bg-surface-alt)', padding: '0.25rem', borderRadius: '2rem', display: 'flex' }}>
                <button 
                  className={`btn ${mode === 'single' ? 'btn-primary' : ''}`}
                  style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', borderRadius: '1.5rem', background: mode === 'single' ? 'var(--brand-primary)' : 'transparent', color: mode === 'single' ? '#fff' : 'var(--text-secondary)' }}
                  onClick={() => setMode('single')}
                >
                    {t('singleCase')}
                </button>
                <button 
                  className={`btn ${mode === 'batch' ? 'btn-primary' : ''}`}
                  style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', borderRadius: '1.5rem', background: mode === 'batch' ? 'var(--brand-primary)' : 'transparent', color: mode === 'batch' ? '#fff' : 'var(--text-secondary)' }}
                  onClick={() => setMode('batch')}
                >
                    {t('batchMode')}
                </button>
            </div>
        </div>

        {mode === 'single' ? (
            <>
                <RichTextEditor
                    value={text}
                    onChange={setText}
                    placeholder={t('casePlaceholder')}
                />

                <button className="btn btn-primary" style={{ width: '100%' }} disabled={isLoading || !text.trim()} onClick={onAnalyze}>
                    {isLoading ? <span className="spinner"></span> : <><span className="material-symbols-outlined">bolt</span> {t('analyzeBtn')}</>}
                </button>

                {result && (
                    <div style={{ marginTop: '2.5rem', borderTop: '2px solid var(--border-subtle)', paddingTop: '2rem' }}>
                        <h2 className="card-title">{result.analysis.title}</h2>
                        <AnalysisDetails analysis={result.analysis} globalLawStats={globalLawStats} t={t} />
                    </div>
                )}
            </>
        ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                {/* Input Side */}
                <div>
                     <input 
                       className="input-field" 
                       placeholder={t('caseTitleOptional')} 
                       style={{ marginBottom: '1rem' }}
                       value={batchTitle}
                       onChange={(e) => setBatchTitle(e.target.value)}
                       disabled={isBatchProcessing}
                     />
                     <RichTextEditor
                        value={text}
                        onChange={setText}
                        placeholder={t('casePlaceholder')}
                     />
                     <button 
                        className="btn btn-secondary" 
                        style={{ width: '100%', marginTop: '1rem', border: '1px dashed var(--brand-primary)', color: 'var(--brand-primary)' }}
                        disabled={!text.trim() || isBatchProcessing}
                        onClick={addToQueue}
                     >
                        <span className="material-symbols-outlined">add</span> {t('addToQueue')}
                     </button>
                </div>

                {/* Queue Side */}
                <div style={{ background: 'var(--bg-surface-alt)', borderRadius: 'var(--radius-md)', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{t('queue')}</h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('itemsInQueue')(queue.length)}</span>
                     </div>
                     
                     <div style={{ flex: 1, minHeight: '300px', maxHeight: '500px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {queue.length === 0 ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)', opacity: 0.6 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '3rem' }}>queue</span>
                                <p style={{ marginTop: '0.5rem' }}>{t('queueEmpty')}</p>
                            </div>
                        ) : (
                            queue.map((item, idx) => (
                                <div key={item.id} style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ color: getStatusColor(item.status) }}>
                                        {item.status === 'processing' ? <span className="spinner" style={{ width: '1.2rem', height: '1.2rem', borderTopColor: 'var(--brand-primary)', borderColor: 'var(--border-strong)' }}></span> : <span className="material-symbols-outlined">{getStatusIcon(item.status)}</span>}
                                    </div>
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <p style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t(`status${item.status.charAt(0).toUpperCase() + item.status.slice(1)}`)}</p>
                                    </div>
                                    {item.status === 'pending' && (
                                        <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => removeFromQueue(item.id)}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--status-error)' }}>close</span>
                                        </button>
                                    )}
                                    {item.status === 'completed' && (
                                        <span className="material-symbols-outlined" style={{ color: 'var(--status-success)', fontSize: '1.2rem' }}>check</span>
                                    )}
                                </div>
                            ))
                        )}
                     </div>

                     <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                         <button 
                            className="btn btn-primary" 
                            style={{ flex: 1 }}
                            disabled={queue.length === 0 || isBatchProcessing || !queue.some(i => i.status === 'pending')}
                            onClick={runBatch}
                         >
                            {isBatchProcessing ? <span className="spinner"></span> : <><span className="material-symbols-outlined">play_arrow</span> {t('analyzeQueue')}</>}
                         </button>
                         <button 
                            className="btn btn-secondary"
                            disabled={queue.length === 0 || isBatchProcessing}
                            onClick={() => setQueue([])}
                         >
                            {t('clearQueue')}
                         </button>
                     </div>
                </div>
            </div>
        )}
      </section>
      
      {mode === 'single' && (
        <section>
          <div className="card" style={{ background: 'var(--brand-primary-soft)', border: 'none', marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--brand-primary)' }}>نصيحة قانونية ذكية</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>قم بنسخ الحكم القضائي كاملاً لضمان دقة استخراج الوقائع والحيثيات. النظام يدعم الأحكام الصادرة من المحاكم التجارية والعامة والإدارية.</p>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>كيف يعمل المحلل؟</h3>
            <ul style={{ paddingInlineStart: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <li style={{ marginBottom: '0.5rem' }}>استخراج البيانات الهيكلية (الرقم، التاريخ، المحكمة).</li>
              <li style={{ marginBottom: '0.5rem' }}>تحليل الأطراف المشاركة وأدوارهم القانونية.</li>
              <li style={{ marginBottom: '0.5rem' }}>تتبع التاريخ الإجرائي للدعوى وجلساتها.</li>
              <li style={{ marginBottom: '0.5rem' }}>تلخيص وقائع الدعوى بشكل منطقي باستخدام تنسيق غني.</li>
              <li>استنباط الأسباب الشرعية والنظامية والقوانين المستشهد بها.</li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
};

const HistorySection = ({ history, onDelete, onUpdate, onBulkDelete, globalLawStats, t, locale, lang }: any) => {
  const [selected, setSelected] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Bulk Action State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const handleSave = () => {
    if (onUpdate && selected) {
      onUpdate(selected.id, editTitle);
      setSelected((prev: any) => ({ ...prev, analysis: { ...prev.analysis, title: editTitle } }));
      setIsEditing(false);
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set());
  };

  const toggleSelectId = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === history.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(history.map((h: any) => h.id)));
    }
  };

  const handleBulkExport = async () => {
     setIsProcessing(true);
     await new Promise(resolve => setTimeout(resolve, 50)); // UI Refresh
     try {
         const items = isSelectionMode 
             ? history.filter((h: any) => selectedIds.has(h.id))
             : history;
         
         if (items.length === 0) return;

         const dataStr = JSON.stringify(items, null, 2);
         const blob = new Blob([dataStr], { type: "application/json" });
         const url = URL.createObjectURL(blob);
         const link = document.createElement("a");
         link.href = url;
         link.download = `judgment_analysis_export_${new Date().toISOString().slice(0,10)}.json`;
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         
         if (isSelectionMode) {
             setIsSelectionMode(false);
             setSelectedIds(new Set());
         }
     } finally {
         setIsProcessing(false);
     }
  };
  
  const handleBulkDeleteClick = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    
    if (window.confirm(t('confirmBulkDelete'))) {
        setIsProcessing(true);
        try {
            await onBulkDelete(ids);
            setIsSelectionMode(false);
            setSelectedIds(new Set());
        } finally {
            setIsProcessing(false);
        }
    }
  };

  if (selected) {
    return (
      <div className="container">
        <button className="btn btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={() => { setSelected(null); setIsEditing(false); }}>
          <span className="material-symbols-outlined">arrow_back</span> {t('back')}
        </button>
        <div className="card">
          {isEditing ? (
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <input 
                  className="input-field" 
                  value={editTitle} 
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
                <button className="btn btn-primary" onClick={handleSave}>
                  <span className="material-symbols-outlined">check</span>
                </button>
                <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
             </div>
          ) : (
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
               <h2 className="card-title" style={{ marginBottom: 0 }}>{selected.analysis.title}</h2>
               <button 
                  className="btn btn-secondary" 
                  style={{ padding: '0.4rem', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                  onClick={() => { setEditTitle(selected.analysis.title); setIsEditing(true); }}
                  title="Edit Title"
               >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>edit</span>
               </button>
             </div>
          )}
          <AnalysisDetails analysis={selected.analysis} globalLawStats={globalLawStats} t={t} />
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{margin: 0}}>
            {t('history')} 
            {isProcessing && <span style={{ fontSize: '0.8rem', fontWeight: 'normal', marginInlineStart: '0.8rem', color: 'var(--text-muted)' }}>{t('processing')}</span>}
        </h2>
        
        {history.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {isSelectionMode ? (
              <>
                <button className="btn btn-secondary" onClick={handleSelectAll} disabled={isProcessing}>
                  {selectedIds.size === history.length ? t('deselectAll') : t('selectAll')}
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleBulkDeleteClick}
                  disabled={selectedIds.size === 0 || isProcessing}
                  style={{ color: 'var(--status-error)' }}
                >
                  <span className="material-symbols-outlined">delete</span> {t('deleteSelected')}
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={handleBulkExport}
                  disabled={selectedIds.size === 0 || isProcessing}
                >
                  <span className="material-symbols-outlined">download</span> {t('exportSelected')}
                </button>
                <button className="btn btn-secondary" onClick={toggleSelectionMode} disabled={isProcessing}>
                  {t('cancel')}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={toggleSelectionMode} disabled={isProcessing}>
                  <span className="material-symbols-outlined">check_box</span> {t('select')}
                </button>
                <button className="btn btn-secondary" onClick={handleBulkExport} disabled={isProcessing}>
                  <span className="material-symbols-outlined">download</span> {t('exportAll')}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      
      {history.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '4rem', opacity: 0.2 }}>history_toggle_off</span>
          <p style={{ marginTop: '1rem' }}>{t('noHistory')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {history.map((rec: any) => {
            const isSelected = selectedIds.has(rec.id);
            return (
              <div 
                key={rec.id} 
                className={`card card-clickable ${isSelected ? 'selected-card' : ''}`}
                style={{ 
                   cursor: 'pointer', 
                   border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                   background: isSelected ? 'var(--brand-primary-soft)' : 'var(--bg-surface)',
                   position: 'relative',
                   transition: 'all 0.2s ease',
                   transform: isSelected ? 'scale(1.005)' : 'none',
                   boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)'
                }}
                onClick={() => isSelectionMode ? toggleSelectId(rec.id) : setSelected(rec)}
              >
                {isSelected && (
                    <div style={{
                        position: 'absolute',
                        top: '-10px',
                        left: lang === 'ar' ? 'auto' : '-10px',
                        right: lang === 'ar' ? '-10px' : 'auto',
                        background: 'var(--brand-primary)',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        zIndex: 10
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                    </div>
                )}
                
                {isProcessing && isSelected && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(255,255,255,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 5,
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <div className="spinner" style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent', width: '2rem', height: '2rem' }}></div>
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  {isSelectionMode && (
                    <div style={{ paddingTop: '0.25rem' }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => toggleSelectId(rec.id)}
                          style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                          disabled={isProcessing}
                        />
                    </div>
                  )}
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ marginBottom: '0.5rem' }}>{rec.analysis?.title || rec.originalText.substring(0, 50) + '...'}</h3>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                         <span className="badge">{rec.analysis?.courtName}</span>
                         <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDistance(new Date(rec.timestamp), new Date(), { locale, addSuffix: true })}</p>
                      </div>
                    </div>
                    {!isSelectionMode && (
                      <button className="btn btn-secondary" style={{ color: 'var(--status-error)', padding: '0.5rem' }} onClick={(e) => { e.stopPropagation(); onDelete(rec.id); }}>
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const RepositoryDetailView = ({ record, onBack, onUseCase, t }: any) => {
  const textContent = record.judgment_text ? record.judgment_text.replace(/<br \/>/g, '\n') : '';
  
  return (
    <div className="container">
      <button className="btn btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={onBack}>
        <span className="material-symbols-outlined">arrow_back</span> {t('back')}
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
         <div className="card" style={{ background: 'var(--bg-surface-alt)', border: 'none' }}>
            <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('judgmentNo')}</h4>
            <p style={{ fontWeight: '700' }}>{record.judgment_number || '-'}</p>
         </div>
         <div className="card" style={{ background: 'var(--bg-surface-alt)', border: 'none' }}>
            <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('court')}</h4>
            <p style={{ fontWeight: '700' }}>{record.judgment_court_name || '-'}</p>
         </div>
         <div className="card" style={{ background: 'var(--bg-surface-alt)', border: 'none' }}>
            <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('date')}</h4>
            <p style={{ fontWeight: '700' }}>{record.judgment_hijri_date || '-'}</p>
         </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
           <h2 className="card-title" style={{ margin: 0 }}>{record.title || t('originalText')}</h2>
           <button className="btn btn-primary" onClick={() => onUseCase(textContent)}>
              <span className="material-symbols-outlined">bolt</span> {t('analyzeThisCase')}
           </button>
        </div>
        
        <div style={{ 
            background: 'var(--bg-surface-alt)', 
            padding: '1.5rem', 
            borderRadius: 'var(--radius-sm)', 
            lineHeight: '1.8', 
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-ar)',
            border: '1px solid var(--border-subtle)',
            maxHeight: '70vh',
            overflowY: 'auto'
        }}>
           {textContent}
        </div>
        
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--brand-primary-soft)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem' }}>
           <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>info</span>
           <div>
              <p style={{ fontWeight: '600', color: 'var(--brand-primary)', marginBottom: '0.25rem' }}>{t('legalAnalytics')}</p>
              <p>{t('repositoryNotice')}</p>
           </div>
        </div>
      </div>
    </div>
  );
};

const RepositorySection = ({ records, globalLawStats, t, onUseCase }: any) => {
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const selectedRecord = useMemo(() => records.find((r: any) => r.id === selectedId), [records, selectedId]);

  const getSnippet = (text: string) => {
    if (!text) return t('noContent');
    const clean = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    return clean.length > 200 ? clean.substring(0, 200) + '...' : clean;
  };

  if (selectedRecord) {
     return <RepositoryDetailView record={selectedRecord} onBack={() => setSelectedId(null)} onUseCase={onUseCase} t={t} />;
  }

  return (
    <div className="container">
      <h2 style={{ marginBottom: '2rem' }}>{t('repository')}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
         {records.map((rec: any) => (
           <div 
             key={rec.id} 
             className="card card-clickable" 
             onClick={() => setSelectedId(rec.id)}
             style={{ cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}
           >
             <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                   <span className="badge" style={{background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)'}}>
                      {rec.judgment_court_name || t('court')}
                   </span>
                   {rec.judgment_hijri_date && (
                       <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>calendar_today</span>
                          {rec.judgment_hijri_date}
                       </span>
                   )}
                </div>
                <h3 style={{ fontSize: '1.1rem', lineHeight: '1.4', color: 'var(--text-primary)', fontWeight: '700', minHeight: '3rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {rec.title || `${t('judgmentNo')} ${rec.judgment_number}`}
                </h3>
             </div>
             
             <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6', flex: 1, marginBottom: '1.5rem', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {getSnippet(rec.judgment_text)}
             </p>
             
             <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{rec.judgment_number ? `#${rec.judgment_number}` : ''}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--brand-primary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {t('details')} <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_forward</span>
                </span>
             </div>
           </div>
         ))}
      </div>
    </div>
  );
};

// Main Application
const App = () => {
  const [lang, setLang] = useState('ar');
  const [theme, setTheme] = useState('light');
  const [activeTab, setActiveTab] = useState('analyze');
  const [caseText, setCaseText] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<any>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }, [theme, lang]);

  useEffect(() => {
    getAllCasesFromDB().then(setHistory);
  }, []);

  const globalLawStats = useMemo(() => {
    const counts: Record<string, number> = {};
    history.forEach(rec => {
      rec.analysis?.lawsCited?.forEach((law: string) => {
        counts[law] = (counts[law] || 0) + 1;
      });
    });
    return counts;
  }, [history]);

  // Merge history cases with static judicial data for repository view
  const repositoryRecords = useMemo(() => {
    const historyRecords = history.map(h => ({
        id: h.id,
        title: h.analysis?.title,
        judgment_number: h.analysis?.judgmentNumber,
        judgment_court_name: h.analysis?.courtName,
        judgment_hijri_date: h.analysis?.courtDecisionDate,
        judgment_text: h.originalText,
        case_id: `user-analyzed-${h.id}`
    }));
    // Newest user cases first, then static data
    return [...historyRecords, ...judicialData];
  }, [history]);

  const t = (key: string) => translations[lang][key] || key;
  const dateLocale = lang === 'ar' ? arLocale : enLocale;

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Core analysis logic refactored for reuse in single and batch modes
  const processAnalysis = async (text: string, titleOverride?: string) => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      const prompt = `You are a Senior Saudi Legal Analyst. Analyze the provided Saudi legal judgment in its original Arabic.
      Extract detailed structured data following the requested schema.
      
      CRITICAL INSTRUCTION FOR 'lawsCited':
      - Extract every specific law, regulation, circular, or royal decree mentioned in the text.
      - CITATION FORMATTING: You MUST follow this exact format for article citations: 'المادة [رقم] من [اسم النظام]' (e.g., 'المادة 76 من نظام المرافعات الشرعية').
      - Do NOT use formats like 'Article [Num] of [Law]' or '[Law], Article [Num]'.
      - NORMALIZE all law names to their official standard Arabic titles.
      - EXCLUDE general references (e.g., "according to the system") if the specific law name is not provided.

      EXTRACT ADDITIONAL METADATA:
      - 'courtDecisionDate': Extract the date of the decision (Hijri preferred, or Gregorian).
      - 'caseStatus': infer the status (e.g., Final/Executive, Preliminary, Under Appeal).
      - 'appellantRespondent': Identify the Appellant and Respondent if it is an appellate judgment.
      
      FORMATTING RULES FOR TEXT FIELDS ('facts', 'reasons', 'ruling', 'proceduralHistory'):
      1. These fields MUST be valid Markdown.
      2. Use **bold** for all:
         - Party names (e.g., **Claimant X**)
         - Dates (e.g., **1445/01/01**)
         - Monetary amounts (e.g., **50,000 SAR**)
         - Court names (e.g., **Commercial Court**)
      3. Use bullet points (- ) for lists of events, arguments, or evidences.
      4. Ensure the text is well-structured and easy to read.
      
      Legal Judgment Text (Formatted):
      ${text}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { 
          responseMimeType: 'application/json',
          responseSchema: ANALYSIS_SCHEMA
        }
      });
      
      const analysis = JSON.parse(response.text);
      if (titleOverride) {
          analysis.title = titleOverride;
      }
      
      const newRec = { originalText: text, analysis, timestamp: Date.now() };
      const id = await putCaseInDB(newRec);
      const savedRec = { ...newRec, id };
      setHistory(prev => [savedRec, ...prev]);
      return savedRec;
  };

  const handleAnalyze = async () => {
    if (!caseText.trim()) return;
    setIsLoading(true);
    setCurrentResult(null);
    try {
      const savedRec = await processAnalysis(caseText);
      setCurrentResult(savedRec);
      setCaseText('');
    } catch (e) {
      console.error(e);
      // Ideally handle error UI here
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteCaseFromDB(id);
    setHistory(prev => prev.filter(h => h.id !== id));
  };
  
  const handleBulkDelete = async (ids: number[]) => {
    for (const id of ids) {
        await deleteCaseFromDB(id);
    }
    setHistory(prev => prev.filter(h => !ids.includes(h.id)));
  };

  const handleUpdate = async (id: number, newTitle: string) => {
    const record = history.find(h => h.id === id);
    if (!record) return;
    const updatedRecord = { ...record, analysis: { ...record.analysis, title: newTitle } };
    await putCaseInDB(updatedRecord);
    setHistory(prev => prev.map(h => h.id === id ? updatedRecord : h));
  };
  
  const handleUseCase = (text: string) => {
    setCaseText(text);
    setActiveTab('analyze');
  };

  return (
    <div className="layout-root">
      <Header lang={lang} setLang={setLang} theme={theme} toggleTheme={toggleTheme} t={t} />
      <div className="container">
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} t={t} />
        
        {activeTab === 'analyze' && (
          <AnalyzeSection 
            text={caseText} 
            setText={setCaseText} 
            onAnalyze={handleAnalyze} 
            isLoading={isLoading} 
            result={currentResult}
            globalLawStats={globalLawStats}
            t={t} 
            processAnalysis={processAnalysis}
          />
        )}
        
        {activeTab === 'history' && (
          <HistorySection 
            history={history} 
            onDelete={handleDelete} 
            onUpdate={handleUpdate} 
            onBulkDelete={handleBulkDelete}
            globalLawStats={globalLawStats} 
            t={t} 
            locale={dateLocale} 
            lang={lang} 
          />
        )}
        
        {activeTab === 'records' && (
          <RepositorySection 
             records={repositoryRecords} 
             globalLawStats={globalLawStats} 
             t={t} 
             onUseCase={handleUseCase}
          />
        )}
        
        {activeTab === 'admin' && (
          <div className="card" style={{ textAlign: 'center', padding: '5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '5rem', color: 'var(--brand-primary)', opacity: 0.1 }}>dashboard_customize</span>
            <h2 style={{ marginTop: '1rem' }}>{t('admin')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
               <div className="card">
                 <h4 style={{marginBottom: '1.5rem'}}>{t('topCitedLaws')}</h4>
                 {Object.keys(globalLawStats).length > 0 ? (
                    <div style={{ height: '300px', position: 'relative' }}>
                      <Bar 
                        data={{
                          labels: Object.entries(globalLawStats)
                            .sort((a: any, b: any) => b[1] - a[1])
                            .slice(0, 10)
                            .map(([law]) => law.length > 30 ? law.substring(0, 30) + '...' : law),
                          datasets: [{
                            label: t('citationCount'),
                            data: Object.entries(globalLawStats)
                                  .sort((a: any, b: any) => b[1] - a[1])
                                  .slice(0, 10)
                                  .map(([, count]) => count),
                            backgroundColor: 'rgba(30, 64, 175, 0.6)',
                            borderColor: 'rgba(30, 64, 175, 1)',
                            borderWidth: 1,
                            borderRadius: 4
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          indexAxis: 'y',
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              callbacks: {
                                title: (items: any) => {
                                   const idx = items[0].dataIndex;
                                   const laws = Object.entries(globalLawStats)
                                      .sort((a: any, b: any) => b[1] - a[1])
                                      .slice(0, 10);
                                   return laws[idx][0];
                                }
                              }
                            }
                          },
                          scales: {
                            x: { beginAtZero: true, grid: { color: 'var(--border-subtle)' }, ticks: { stepSize: 1 } },
                            y: { grid: { display: false } }
                          }
                        }}
                      />
                    </div>
                 ) : (
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '3rem', opacity: 0.3 }}>bar_chart</span>
                      <p style={{ marginTop: '1rem' }}>{t('noHistory')}</p>
                   </div>
                 )}
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<React.StrictMode><App /></React.StrictMode>);