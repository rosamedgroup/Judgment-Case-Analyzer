
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
const { Bar } = ReactChartJS as any;
import { formatDistance } from 'date-fns/formatDistance';
import { ar as arLocale } from 'date-fns/locale/ar';
import { enUS as enLocale } from 'date-fns/locale/en-US';
import { judicialData } from './data.ts';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// --- Database Logic ---
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

// --- Translations ---
const translations: any = {
  ar: {
    appTitle: "المحلل القضائي الذكي",
    analyze: "تحليل ذكي",
    history: "السجلات",
    repository: "المستودع",
    admin: "الإحصائيات",
    analyzeBtn: "بدء التحليل",
    analyzing: "جاري التحليل...",
    casePlaceholder: "الصق نص الحكم القضائي هنا للتحليل...",
    facts: "الوقائع",
    reasons: "الأسباب والحيثيات",
    ruling: "منطوق الحكم",
    parties: "أطراف الدعوى",
    proceduralHistory: "التاريخ الإجرائي",
    lawsCited: "الأنظمة والقوانين",
    noHistory: "لا توجد تحليلات سابقة.",
    judgmentNo: "صك رقم",
    court: "المحكمة",
    date: "التاريخ",
    status: "حالة القضية",
    back: "رجوع",
    export: "تصدير",
    delete: "حذف",
    details: "التفاصيل",
    legalAnalytics: "تحليلات قانونية",
    topCitedLaws: "الأنظمة الأكثر استشهاداً",
    frequencyCount: (count: number) => `تكرر ${count} مرّات`,
    batchMode: "تحليل بالجملة",
    singleCase: "تحليل مفرد",
    estimatedTime: "وقت تقديري",
    dragToReorder: "اسحب لإعادة الترتيب",
    pause: "إيقاف",
    resume: "استئناف",
    stop: "إيقاف الكل",
    minutesShort: "د",
    secondsShort: "ث",
    editTitle: "تعديل العنوان",
    save: "حفظ",
    cancel: "إلغاء",
    switchLanguage: "English",
    toggleTheme: "تبديل المظهر",
    addToQueue: "إضافة للقائمة",
    clearQueue: "مسح القائمة",
    analyzeQueue: "تحليل القائمة",
    analyzeThisCase: "تحليل هذه القضية",
    originalText: "النص الأصلي",
    repositoryNotice: "هذه البيانات مستخرجة من السجلات العامة. للحصول على تحليل قانوني متعمق (مثل استخراج المواد النظامية وتلخيص دقيق)، استخدم زر التحليل بالذكاء الاصطناعي.",
    itemsInQueue: (n: number) => `${n} عناصر في القائمة`,
    queueEmpty: "القائمة فارغة",
    removeFromQueue: "إزالة من القائمة"
  },
  en: {
    appTitle: "Smart Judicial",
    analyze: "Analyze",
    history: "History",
    repository: "Repository",
    admin: "Admin",
    analyzeBtn: "Run Analysis",
    analyzing: "Analyzing...",
    casePlaceholder: "Paste judgment text here...",
    facts: "Facts",
    reasons: "Legal Reasons",
    ruling: "Ruling",
    parties: "Parties",
    proceduralHistory: "Procedural History",
    lawsCited: "Cited Statutes",
    noHistory: "No history found.",
    judgmentNo: "Judgment #",
    court: "Court",
    date: "Date",
    status: "Status",
    back: "Back",
    export: "Export",
    delete: "Delete",
    details: "Details",
    legalAnalytics: "Legal Analytics",
    topCitedLaws: "Top Cited Statutes",
    frequencyCount: (count: number) => `Cited ${count} times`,
    batchMode: "Batch Analysis",
    singleCase: "Single Case",
    estimatedTime: "ETA",
    dragToReorder: "Drag to reorder",
    pause: "Pause",
    resume: "Resume",
    stop: "Stop",
    minutesShort: "m",
    secondsShort: "s",
    editTitle: "Edit Title",
    save: "Save",
    cancel: "Cancel",
    switchLanguage: "العربية",
    toggleTheme: "Toggle Theme",
    addToQueue: "Add to Queue",
    clearQueue: "Clear Queue",
    analyzeQueue: "Analyze All",
    analyzeThisCase: "Analyze This Case",
    originalText: "Original Text",
    repositoryNotice: "These records are public. Use AI Analysis for full structural extraction and legal summaries.",
    itemsInQueue: (n: number) => `${n} items in queue`,
    queueEmpty: "Queue is empty",
    removeFromQueue: "Remove from queue"
  }
};

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    judgmentNumber: { type: Type.STRING },
    courtName: { type: Type.STRING },
    courtDecisionDate: { type: Type.STRING },
    caseStatus: { type: Type.STRING },
    appellantRespondent: { type: Type.STRING },
    parties: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { name: { type: Type.STRING }, role: { type: Type.STRING } },
        required: ["name", "role"]
      }
    },
    proceduralHistory: { type: Type.STRING },
    facts: { type: Type.STRING },
    reasons: { type: Type.STRING },
    ruling: { type: Type.STRING },
    lawsCited: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["title", "judgmentNumber", "courtName", "parties", "proceduralHistory", "facts", "reasons", "ruling", "lawsCited"]
};

// --- Shared Utilities ---
const getCleanHtml = (html: string) => {
  if (!html) return '';
  return html
    .replace(/ style="[^"]*"/gi, '')
    .replace(/ style='[^']*'/gi, '')
    .replace(/ class="[^"]*"/gi, '')
    .replace(/ class='[^']*'/gi, '')
    .replace(/ id="docs-internal-[^"]*"/gi, '');
};

// --- Shared Components ---

const MarkdownText = ({ text }: { text: string }) => {
  const formatted = text.split('\n').map((line, i) => {
    let content = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      return <div key={i} style={{ display: 'flex', gap: '8px' }}><span>•</span><span dangerouslySetInnerHTML={{ __html: content.substring(2) }} /></div>;
    }
    return <p key={i} dangerouslySetInnerHTML={{ __html: content }} />;
  });
  return <div className="legal-content">{formatted}</div>;
};

const RichTextEditor = ({ value, onChange, placeholder, t }: any) => {
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value; }, [value]);
  const cmd = (c: string) => { document.execCommand(c); onChange(editorRef.current?.innerHTML || ''); };
  return (
    <div className="rte-container">
      <div className="rte-toolbar">
        <button className="btn btn-secondary" style={{padding: '4px'}} onClick={() => cmd('bold')} title={t('bold')}><span className="material-symbols-outlined">format_bold</span></button>
        <button className="btn btn-secondary" style={{padding: '4px'}} onClick={() => cmd('italic')} title={t('italic')}><span className="material-symbols-outlined">format_italic</span></button>
      </div>
      <div ref={editorRef} className="rte-editor" contentEditable onInput={(e) => onChange(e.currentTarget.innerHTML)} data-placeholder={placeholder} />
    </div>
  );
};

// --- View Modules ---

const AnalysisDetails = ({ analysis, t }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
       <div className="card" style={{background: 'var(--bg-surface-alt)', border: 'none'}}><span>{t('judgmentNo')}</span><strong>{analysis.judgmentNumber}</strong></div>
       <div className="card" style={{background: 'var(--bg-surface-alt)', border: 'none'}}><span>{t('court')}</span><strong>{analysis.courtName}</strong></div>
       <div className="card" style={{background: 'var(--bg-surface-alt)', border: 'none'}}><span>{t('date')}</span><strong>{analysis.courtDecisionDate}</strong></div>
    </div>
    <section><h3>{t('facts')}</h3><MarkdownText text={analysis.facts} /></section>
    <section><h3>{t('reasons')}</h3><MarkdownText text={analysis.reasons} /></section>
    <section className="card" style={{background: 'var(--brand-primary-soft)', borderInlineStart: '4px solid var(--brand-primary)'}}><h3>{t('ruling')}</h3><MarkdownText text={analysis.ruling} /></section>
  </div>
);

const AnalyzeView = ({ t, processAnalysis, globalLawStats, externalText, clearExternal }: any) => {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [text, setText] = useState('');
  const [batchTitle, setBatchTitle] = useState('');
  const [queue, setQueue] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    if (externalText) {
      setText(externalText);
      clearExternal();
    }
  }, [externalText, clearExternal]);

  const EST_SEC = 5;
  const eta = useMemo(() => {
    const pend = queue.filter(i => i.status === 'pending').length;
    const s = pend * EST_SEC;
    return `${Math.floor(s/60)}${t('minutesShort')} ${s%60}${t('secondsShort')}`;
  }, [queue, t]);

  useEffect(() => {
    if (!isProcessing || isPaused) return;

    const runNext = async () => {
      const isAnyProcessing = queue.some(i => i.status === 'processing');
      if (isAnyProcessing) return;

      const nextIdx = queue.findIndex(i => i.status === 'pending');
      if (nextIdx === -1) { setIsProcessing(false); return; }

      const item = queue[nextIdx];
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q));
      
      try {
        const res = await processAnalysis(item.text, item.title);
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'completed', result: res } : q));
      } catch (e) {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'failed' } : q));
      }
    };
    runNext();
  }, [isProcessing, isPaused, queue, processAnalysis]);

  const addToQueue = () => {
    if (!text.trim()) return;
    setQueue([...queue, { id: Date.now(), title: batchTitle || `${t('singleCase')} #${queue.length + 1}`, text, status: 'pending' }]);
    setText(''); setBatchTitle('');
  };

  const handleDragStart = (idx: number) => { dragItem.current = idx; };
  const handleDragEnter = (idx: number) => { dragOverItem.current = idx; };
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
        const _q = [...queue];
        const dragged = _q[dragItem.current];
        _q.splice(dragItem.current, 1);
        _q.splice(dragOverItem.current, 0, dragged);
        setQueue(_q);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  return (
    <div className="view-analyze">
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button className={`btn ${mode === 'single' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('single')}>{t('singleCase')}</button>
          <button className={`btn ${mode === 'batch' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('batch')}>{t('batchMode')}</button>
        </div>

        {mode === 'batch' && <input className="input-field" style={{marginBottom: '1rem'}} placeholder={t('caseTitleOptional')} value={batchTitle} onChange={e => setBatchTitle(e.target.value)} />}
        
        <RichTextEditor value={text} onChange={setText} placeholder={t('casePlaceholder')} t={t} />
        
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          {mode === 'single' ? (
            <button className="btn btn-primary" style={{flex: 1}} disabled={!text.trim() || isProcessing} onClick={async () => { setIsProcessing(true); const r = await processAnalysis(text); setResult(r); setIsProcessing(false); setText(''); }}>
              {isProcessing ? <span className="spinner" /> : t('analyzeBtn')}
            </button>
          ) : (
            <button className="btn btn-secondary" style={{flex: 1, border: '1px dashed var(--brand-primary)'}} onClick={addToQueue} disabled={!text.trim()}>{t('addToQueue')}</button>
          )}
        </div>
      </div>

      {mode === 'batch' && queue.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
             <h3>{t('queue')} ({queue.length})</h3>
             {queue.some(i => i.status === 'pending') && <span style={{fontSize: '0.8rem', color: 'var(--brand-primary)'}}>{t('estimatedTime')}: {eta}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
            {queue.map((item, idx) => (
              <div 
                key={item.id} 
                className="card" 
                draggable={item.status === 'pending' && !isProcessing}
                onDragStart={() => handleDragStart(idx)}
                onDragEnter={() => handleDragEnter(idx)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                style={{ 
                    padding: '0.75rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    cursor: (item.status === 'pending' && !isProcessing) ? 'move' : 'default',
                    opacity: item.status === 'pending' ? 1 : 0.8
                }}
              >
                 <span className="material-symbols-outlined" style={{color: 'var(--text-muted)'}}>drag_indicator</span>
                 <div style={{flex: 1}}><strong>{item.title}</strong></div>
                 <div style={{display:'flex', alignItems:'center', gap: '1rem'}}>
                    {item.status === 'pending' && !isProcessing && (
                        <button className="btn btn-secondary" style={{padding: '4px'}} onClick={() => setQueue(queue.filter(q => q.id !== item.id))} title={t('removeFromQueue')}>
                            <span className="material-symbols-outlined" style={{fontSize: '1.2rem', color: 'var(--status-error)'}}>close</span>
                        </button>
                    )}
                    <span className="badge" style={{color: item.status === 'completed' ? 'var(--status-success)' : 'inherit'}}>{t(`status${item.status.charAt(0).toUpperCase() + item.status.slice(1)}`)}</span>
                 </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            {!isProcessing ? (
               <button className="btn btn-primary" onClick={() => setIsProcessing(true)} disabled={!queue.some(i => i.status === 'pending')}>{t('analyzeQueue')}</button>
            ) : (
               <>
                 <button className="btn btn-secondary" onClick={() => setIsPaused(!isPaused)}>{isPaused ? t('resume') : t('pause')}</button>
                 <button className="btn btn-secondary" style={{color: 'var(--status-error)'}} onClick={() => setIsProcessing(false)}>{t('stop')}</button>
               </>
            )}
            <button className="btn btn-secondary" onClick={() => { setQueue([]); setIsProcessing(false); setIsPaused(false); }} disabled={isProcessing && !isPaused}>{t('clearQueue')}</button>
          </div>
        </div>
      )}

      {result && <div className="card" style={{marginTop: '2rem'}}><h2>{result.analysis.title}</h2><AnalysisDetails analysis={result.analysis} t={t} /></div>}
    </div>
  );
};

const RepositoryDetailView = ({ record, onBack, onUseCase, t }: any) => {
  const htmlContent = useMemo(() => getCleanHtml(record.judgment_text), [record.judgment_text]);
  return (
    <div className="container" style={{maxWidth: '1000px', margin: '0 auto'}}>
      <button className="btn btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={onBack} title={t('back')}>
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
           <button className="btn btn-primary" onClick={() => onUseCase(record.judgment_text)}>
              <span className="material-symbols-outlined">bolt</span> {t('analyzeThisCase')}
           </button>
        </div>
        
        <div 
            className="judgment-text-content"
            style={{ 
                background: 'var(--bg-surface-alt)', 
                padding: '1.5rem', 
                borderRadius: 'var(--radius-sm)', 
                lineHeight: '1.8', 
                fontFamily: 'var(--font-ar)',
                border: '1px solid var(--border-subtle)',
                maxHeight: '70vh',
                overflowY: 'auto',
                overflowWrap: 'break-word',
                fontSize: '1rem'
            }}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
        
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

// --- Main Shell ---

const App = () => {
  const [lang, setLang] = useState('ar');
  const [theme, setTheme] = useState('light');
  const [activeTab, setActiveTab] = useState('analyze');
  const [history, setHistory] = useState<any[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string | null>(null);
  const [externalText, setExternalText] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }, [theme, lang]);

  useEffect(() => { getAllCasesFromDB().then(setHistory); }, []);

  const globalLawStats = useMemo(() => {
    const counts: Record<string, number> = {};
    history.forEach(rec => {
      rec.analysis?.lawsCited?.forEach((law: string) => { counts[law] = (counts[law] || 0) + 1; });
    });
    return counts;
  }, [history]);

  const t = (k: string) => translations[lang][k] || k;

  const processAnalysis = async (text: string, title?: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze this Saudi legal judgment in Arabic. Return JSON following schema. Use Markdown for text fields. Text:\n${text}`,
      config: { responseMimeType: 'application/json', responseSchema: ANALYSIS_SCHEMA }
    });
    const analysis = JSON.parse(response.text);
    if (title) analysis.title = title;
    const rec = { originalText: text, analysis, timestamp: Date.now() };
    const id = await putCaseInDB(rec);
    const saved = { ...rec, id };
    setHistory(prev => [saved, ...prev]);
    return saved;
  };

  const navItems = [
    { id: 'analyze', icon: 'auto_awesome', label: t('analyze') },
    { id: 'history', icon: 'history', label: t('history') },
    { id: 'records', icon: 'inventory_2', label: t('repository') },
    { id: 'admin', icon: 'analytics', label: t('admin') }
  ];

  const repositoryRecords = useMemo(() => {
    const historyMapped = history.map(h => ({
        id: `h-${h.id}`,
        title: h.analysis?.title,
        judgment_number: h.analysis?.judgmentNumber,
        judgment_court_name: h.analysis?.courtName,
        judgment_hijri_date: h.analysis?.courtDecisionDate,
        judgment_text: h.originalText,
    }));
    return [...historyMapped, ...judicialData.map(j => ({ ...j, id: `s-${j.id || j.case_id}` }))];
  }, [history]);

  const selectedRepoRecord = useMemo(() => 
    repositoryRecords.find(r => r.id === selectedRepositoryId), [repositoryRecords, selectedRepositoryId]
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <span className="material-symbols-outlined">gavel</span>
          <span>{t('appTitle')}</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button key={item.id} className={`sidebar-link ${activeTab === item.id ? 'active' : ''}`} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); setSelectedHistory(null); setSelectedRepositoryId(null); }}>
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="content-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn btn-secondary mobile-only" style={{padding: '0.5rem'}} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h2 style={{fontSize: '1.1rem'}}>{navItems.find(i => i.id === activeTab)?.label}</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} title={t('switchLanguage')}>{t('switchLanguage')}</button>
            <button className="btn btn-secondary" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title={t('toggleTheme')}>
              <span className="material-symbols-outlined">{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>
            </button>
          </div>
        </header>

        <div className="content-body">
          {activeTab === 'analyze' && <AnalyzeView t={t} processAnalysis={processAnalysis} externalText={externalText} clearExternal={() => setExternalText('')} />}
          
          {activeTab === 'history' && (
             <div className="view-history">
               {selectedHistory ? (
                 <>
                   <button className="btn btn-secondary" style={{marginBottom: '1.5rem'}} onClick={() => setSelectedHistory(null)}><span className="material-symbols-outlined">arrow_back</span> {t('back')}</button>
                   <div className="card"><h2>{selectedHistory.analysis.title}</h2><AnalysisDetails analysis={selectedHistory.analysis} t={t} /></div>
                 </>
               ) : (
                 history.length === 0 ? <p>{t('noHistory')}</p> : history.map(h => (
                   <div key={h.id} className="card" style={{marginBottom: '1rem', cursor: 'pointer'}} onClick={() => setSelectedHistory(h)}>
                     <div style={{display:'flex', justifyContent:'space-between'}}>
                      <strong>{h.analysis.title}</strong>
                      <button className="btn btn-secondary" style={{color: 'var(--status-error)'}} onClick={(e) => { e.stopPropagation(); deleteCaseFromDB(h.id).then(() => setHistory(history.filter(i => i.id !== h.id))); }}><span className="material-symbols-outlined">delete</span></button>
                     </div>
                     <p style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{h.analysis.courtName} - {new Date(h.timestamp).toLocaleDateString()}</p>
                   </div>
                 ))
               )}
             </div>
          )}

          {activeTab === 'records' && (
            selectedRepoRecord ? (
                <RepositoryDetailView 
                    record={selectedRepoRecord} 
                    onBack={() => setSelectedRepositoryId(null)} 
                    onUseCase={(txt: string) => { setExternalText(txt); setActiveTab('analyze'); setSelectedRepositoryId(null); }} 
                    t={t} 
                />
            ) : (
                <div className="view-repository" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'1rem'}}>
                    {repositoryRecords.map(item => (
                        <div key={item.id} className="card card-clickable" style={{cursor: 'pointer'}} onClick={() => setSelectedRepositoryId(item.id)}>
                            <div style={{marginBottom: '0.5rem'}}><span className="badge">{item.judgment_court_name}</span></div>
                            <h4 style={{marginBottom: '0.5rem'}}>{item.title || `${t('judgmentNo')} ${item.judgment_number}`}</h4>
                            <p style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{item.judgment_hijri_date}</p>
                            <button className="btn btn-primary" style={{marginTop: '1rem', width: '100%'}} onClick={() => setSelectedRepositoryId(item.id)}>{t('details')}</button>
                        </div>
                    ))}
                </div>
            )
          )}

          {activeTab === 'admin' && (
            <div className="card" style={{height: '500px'}}>
               <h3 style={{marginBottom: '1.5rem'}}>{t('topCitedLaws')}</h3>
               {Object.keys(globalLawStats).length > 0 ? (
                  <Bar 
                    data={{ 
                        labels: Object.entries(globalLawStats).sort((a:any,b:any) => b[1]-a[1]).slice(0,8).map(e => e[0].length > 25 ? e[0].substring(0,25)+'...' : e[0]), 
                        datasets: [{ label: t('citationCount'), data: Object.entries(globalLawStats).sort((a:any,b:any) => b[1]-a[1]).slice(0,8).map(e => e[1]), backgroundColor: '#1e3a8a' }] 
                    }} 
                    options={{ 
                        maintainAspectRatio: false,
                        indexAxis: 'y',
                        plugins: { legend: { display: false } }
                    }} 
                  />
               ) : (
                   <p>{t('noHistory')}</p>
               )}
            </div>
          )}
        </div>
      </main>

      <nav className="mobile-bottom-nav">
        {navItems.map(item => (
          <button key={item.id} className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => { setActiveTab(item.id); setSelectedHistory(null); setSelectedRepositoryId(null); }}>
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
