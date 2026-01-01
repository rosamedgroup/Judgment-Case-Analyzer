
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
    pause: "إيقاف مؤقت",
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
    repositoryNotice: "هذه البيانات مستخرجة من السجلات العامة. للحصول على تحليل قانوني متعمق، استخدم زر التحليل بالذكاء الاصطناعي.",
    itemsInQueue: (n: number) => `${n} عناصر في القائمة`,
    queueEmpty: "القائمة فارغة",
    removeFromQueue: "إزالة من القائمة",
    customization: "خيارات التخصيص",
    outputFormat: "تنسيق المخرجات",
    selectSections: "اختر الأقسام المطلوبة",
    formatMarkdown: "تنسيق Markdown",
    formatPlain: "نص عادي",
    judgmentNumber: "رقم الحكم",
    courtName: "اسم المحكمة",
    courtDecisionDate: "تاريخ الحكم",
    caseStatus: "حالة القضية",
    citationCount: "عدد الاستشهادات",
    caseTitleOptional: "عنوان القضية (اختياري)",
    statusPending: "في الانتظار",
    statusProcessing: "جاري التحليل",
    statusPaused: "موقوف مؤقتاً",
    statusCompleted: "اكتمل",
    statusFailed: "فشل",
    bold: "عريض",
    italic: "مائل",
    queue: "قائمة الانتظار"
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
    removeFromQueue: "Remove from queue",
    customization: "Customization Options",
    outputFormat: "Output Format",
    selectSections: "Select Required Sections",
    formatMarkdown: "Markdown",
    formatPlain: "Plain Text",
    judgmentNumber: "Judgment Number",
    courtName: "Court Name",
    courtDecisionDate: "Decision Date",
    caseStatus: "Case Status",
    citationCount: "Citation Count",
    caseTitleOptional: "Case Title (Optional)",
    statusPending: "Queued",
    statusProcessing: "Processing",
    statusPaused: "Paused",
    statusCompleted: "Completed",
    statusFailed: "Failed",
    bold: "Bold",
    italic: "Italic",
    queue: "Queue"
  }
};

const FULL_SCHEMA_PROPERTIES: any = {
  judgmentNumber: { type: Type.STRING },
  courtName: { type: Type.STRING },
  courtDecisionDate: { type: Type.STRING },
  caseStatus: { type: Type.STRING },
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

const MarkdownText = ({ text, format, lang }: { text: string, format: 'markdown' | 'plain', lang: string }) => {
  if (format === 'plain') {
    return <p style={{ whiteSpace: 'pre-wrap', textAlign: 'inherit' }}>{text}</p>;
  }
  const formatted = text.split('\n').map((line, i) => {
    let content = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      return (
        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--brand-primary)', fontWeight: 'bold' }}>•</span>
          <span dangerouslySetInnerHTML={{ __html: content.replace(/^[-*]\s+/, '') }} />
        </div>
      );
    }
    return <p key={i} dangerouslySetInnerHTML={{ __html: content }} style={{ marginBottom: '1rem' }} />;
  });
  return <div className="legal-content">{formatted}</div>;
};

const RichTextEditor = ({ value, onChange, placeholder, t }: any) => {
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { 
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);
  
  const cmd = (c: string) => { 
    document.execCommand(c); 
    onChange(editorRef.current?.innerHTML || ''); 
  };

  return (
    <div className="rte-container">
      <div className="rte-toolbar" dir="ltr">
        <button className="btn btn-secondary" style={{padding: '6px', minWidth: 'auto'}} onClick={() => cmd('bold')} title={t('bold')}>
          <span className="material-symbols-outlined">format_bold</span>
        </button>
        <button className="btn btn-secondary" style={{padding: '6px', minWidth: 'auto'}} onClick={() => cmd('italic')} title={t('italic')}>
          <span className="material-symbols-outlined">format_italic</span>
        </button>
      </div>
      <div 
        ref={editorRef} 
        className="rte-editor" 
        contentEditable 
        onInput={(e) => onChange(e.currentTarget.innerHTML)} 
        data-placeholder={placeholder} 
        style={{ direction: 'auto' }}
      />
    </div>
  );
};

// --- View Modules ---

const AnalysisDetails = ({ analysis, t, format, lang }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
       {analysis.judgmentNumber && <div className="card info-card"><span className="info-label">{t('judgmentNo')}</span><strong className="info-value">{analysis.judgmentNumber}</strong></div>}
       {analysis.courtName && <div className="card info-card"><span className="info-label">{t('court')}</span><strong className="info-value">{analysis.courtName}</strong></div>}
       {analysis.courtDecisionDate && <div className="card info-card"><span className="info-label">{t('date')}</span><strong className="info-value">{analysis.courtDecisionDate}</strong></div>}
    </div>
    {analysis.facts && <section><h3 className="section-title">{t('facts')}</h3><MarkdownText text={analysis.facts} format={format} lang={lang} /></section>}
    {analysis.reasons && <section><h3 className="section-title">{t('reasons')}</h3><MarkdownText text={analysis.reasons} format={format} lang={lang} /></section>}
    {analysis.ruling && (
      <section className="card" style={{background: 'var(--brand-primary-soft)', borderInlineStart: '4px solid var(--brand-primary)', padding: '1.5rem'}}>
        <h3 className="section-title" style={{color: 'var(--brand-primary)', border: 'none', padding: 0, marginBottom: '0.75rem'}}>{t('ruling')}</h3>
        <MarkdownText text={analysis.ruling} format={format} lang={lang} />
      </section>
    )}
    {analysis.lawsCited && analysis.lawsCited.length > 0 && (
      <section>
        <h3 className="section-title">{t('lawsCited')}</h3>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
          {analysis.lawsCited.map((law: string, idx: number) => (
            <span key={idx} className="badge badge-brand">{law}</span>
          ))}
        </div>
      </section>
    )}
  </div>
);

const AnalyzeView = ({ t, processAnalysis, externalText, clearExternal, lang }: any) => {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [text, setText] = useState('');
  const [batchTitle, setBatchTitle] = useState('');
  const [queue, setQueue] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showCustomization, setShowCustomization] = useState(false);
  
  const [analysisConfig, setAnalysisConfig] = useState({
    format: 'markdown' as 'markdown' | 'plain',
    sections: {
      facts: true,
      reasons: true,
      ruling: true,
      parties: true,
      proceduralHistory: true,
      lawsCited: true,
      judgmentNumber: true,
      courtName: true,
      courtDecisionDate: true
    }
  });

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
        const res = await processAnalysis(item.text, analysisConfig, item.title);
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'completed', result: res } : q));
      } catch (e) {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'failed' } : q));
      }
    };
    runNext();
  }, [isProcessing, isPaused, queue, processAnalysis, analysisConfig]);

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

  const toggleSection = (key: string) => {
    setAnalysisConfig(prev => ({
      ...prev,
      sections: { ...prev.sections, [key]: !(prev.sections as any)[key] }
    }));
  };

  const getStatusDisplay = (item: any) => {
    if (item.status === 'completed') {
      return { 
        label: t('statusCompleted'), 
        color: 'var(--status-success)', 
        icon: 'check_circle', 
        bg: 'rgba(16, 185, 129, 0.1)' 
      };
    }
    if (item.status === 'failed') {
      return { 
        label: t('statusFailed'), 
        color: 'var(--status-error)', 
        icon: 'error', 
        bg: 'rgba(239, 68, 68, 0.1)' 
      };
    }
    if (item.status === 'processing') {
      return { 
        label: t('statusProcessing'), 
        color: 'var(--brand-primary)', 
        icon: 'sync', 
        bg: 'var(--brand-primary-soft)', 
        spin: true 
      };
    }
    if (isPaused && item.status === 'pending' && isProcessing) {
      return { 
        label: t('statusPaused'), 
        color: 'var(--status-warning)', 
        icon: 'pause_circle', 
        bg: 'rgba(245, 158, 11, 0.1)' 
      };
    }
    return { 
      label: t('statusPending'), 
      color: 'var(--text-muted)', 
      icon: 'schedule', 
      bg: 'var(--bg-surface-alt)' 
    };
  };

  return (
    <div className="view-analyze">
      <div className="card animate-fade-in" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button className={`btn ${mode === 'single' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('single')}>{t('singleCase')}</button>
          <button className={`btn ${mode === 'batch' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('batch')}>{t('batchMode')}</button>
        </div>

        {mode === 'batch' && <input className="input-field" style={{marginBottom: '1rem'}} placeholder={t('caseTitleOptional')} value={batchTitle} onChange={e => setBatchTitle(e.target.value)} />}
        
        <RichTextEditor value={text} onChange={setText} placeholder={t('casePlaceholder')} t={t} />

        <div style={{ marginTop: '1rem' }}>
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setShowCustomization(!showCustomization)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="material-symbols-outlined">settings</span>
              <span>{t('customization')}</span>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>{showCustomization ? 'expand_less' : 'expand_more'}</span>
          </button>

          {showCustomization && (
            <div className="card" style={{ marginTop: '0.75rem', background: 'var(--bg-surface-alt)', borderStyle: 'dashed', padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontWeight: '800', display: 'block', marginBottom: '0.75rem' }}>{t('outputFormat')}</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className={`btn ${analysisConfig.format === 'markdown' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setAnalysisConfig({...analysisConfig, format: 'markdown'})}>{t('formatMarkdown')}</button>
                  <button className={`btn ${analysisConfig.format === 'plain' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setAnalysisConfig({...analysisConfig, format: 'plain'})}>{t('formatPlain')}</button>
                </div>
              </div>

              <div>
                <label style={{ fontWeight: '800', display: 'block', marginBottom: '0.75rem' }}>{t('selectSections')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
                  {Object.entries(analysisConfig.sections).map(([key, val]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                      <input type="checkbox" checked={val} onChange={() => toggleSection(key)} style={{width: '20px', height: '20px', cursor: 'pointer'}} />
                      <span style={{ fontWeight: 500 }}>{t(key)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          {mode === 'single' ? (
            <button className="btn btn-primary" style={{flex: 1}} disabled={!text.trim() || isProcessing} onClick={async () => { setIsProcessing(true); try { const r = await processAnalysis(text, analysisConfig); setResult(r); } finally { setIsProcessing(false); setText(''); } }}>
              {isProcessing ? <span className="spinner" /> : (
                <><span className="material-symbols-outlined">auto_fix_high</span> {t('analyzeBtn')}</>
              )}
            </button>
          ) : (
            <button className="btn btn-secondary" style={{flex: 1, border: '1px dashed var(--brand-primary)', background: 'var(--brand-primary-soft)'}} onClick={addToQueue} disabled={!text.trim()}>
              <span className="material-symbols-outlined">add_task</span> {t('addToQueue')}
            </button>
          )}
        </div>
      </div>

      {mode === 'batch' && queue.length > 0 && (
        <div className="card animate-fade-in" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
             <h3 className="section-title" style={{ margin: 0 }}>{t('queue')} ({queue.length})</h3>
             {queue.some(i => i.status === 'pending') && <span style={{fontSize: '0.85rem', color: 'var(--brand-primary)', fontWeight: '700', background: 'var(--brand-primary-soft)', padding: '0.2rem 0.6rem', borderRadius: '4px'}}>{t('estimatedTime')}: {eta}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '450px', overflowY: 'auto', paddingInlineEnd: '0.5rem' }}>
            {queue.map((item, idx) => {
              const statusInfo = getStatusDisplay(item);
              return (
                <div 
                  key={item.id} 
                  className="card queue-item-card" 
                  draggable={item.status === 'pending' && !isProcessing}
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  style={{ 
                      padding: '1rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '1rem', 
                      cursor: (item.status === 'pending' && !isProcessing) ? 'move' : 'default',
                      opacity: item.status === 'pending' && isPaused && isProcessing ? 0.85 : 1,
                      borderInlineStart: `4px solid ${statusInfo.color}`,
                      background: item.status === 'processing' ? 'var(--brand-primary-soft)' : 'var(--bg-surface)'
                  }}
                >
                   <span className="material-symbols-outlined drag-handle-icon" style={{color: 'var(--text-muted)', fontSize: '1.2rem'}}>drag_indicator</span>
                   <div style={{flex: 1, minWidth: 0}}><strong style={{display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '1rem'}}>{item.title}</strong></div>
                   <div style={{display:'flex', alignItems:'center', gap: '0.75rem'}}>
                      <div className="status-badge" style={{
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.4rem', 
                        padding: '0.35rem 0.75rem', 
                        borderRadius: '2rem', 
                        backgroundColor: statusInfo.bg, 
                        color: statusInfo.color,
                        fontSize: '0.8rem',
                        fontWeight: '800'
                      }}>
                        <span className={`material-symbols-outlined ${statusInfo.spin ? 'rotating' : ''}`} style={{fontSize: '1.1rem'}}>
                          {statusInfo.icon}
                        </span>
                        <span>{statusInfo.label}</span>
                      </div>
                      {item.status === 'pending' && !isProcessing && (
                          <button className="btn btn-secondary delete-queue-btn" style={{padding: '6px', minWidth: 'auto', border: 'none', background: 'transparent'}} onClick={() => setQueue(queue.filter(q => q.id !== item.id))} title={t('removeFromQueue')}>
                              <span className="material-symbols-outlined" style={{fontSize: '1.3rem', color: 'var(--status-error)'}}>delete</span>
                          </button>
                      )}
                   </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '2rem' }}>
            {!isProcessing ? (
               <button 
                  className="btn btn-primary" 
                  onClick={() => { setIsProcessing(true); setIsPaused(false); }} 
                  disabled={!queue.some(i => i.status === 'pending')}
                  style={{flex: '1 0 auto'}}
               >
                 <span className="material-symbols-outlined">play_arrow</span> {t('analyzeQueue')}
               </button>
            ) : (
               <>
                 <button className="btn btn-secondary" style={{flex: '1 0 auto'}} onClick={() => setIsPaused(!isPaused)}>
                    <span className="material-symbols-outlined">{isPaused ? 'play_arrow' : 'pause'}</span>
                    {isPaused ? t('resume') : t('pause')}
                 </button>
                 <button 
                    className="btn btn-secondary" 
                    style={{color: 'var(--status-error)', flex: '1 0 auto'}} 
                    onClick={() => { setIsProcessing(false); setIsPaused(false); }}
                 >
                    <span className="material-symbols-outlined">stop</span> {t('stop')}
                 </button>
               </>
            )}
            <button 
              className="btn btn-secondary" 
              onClick={() => { setQueue([]); setIsProcessing(false); setIsPaused(false); }} 
              disabled={isProcessing && !isPaused}
              style={{flex: '1 0 auto'}}
            >
              <span className="material-symbols-outlined">delete_sweep</span> {t('clearQueue')}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="card animate-fade-in" style={{marginTop: '2rem'}}>
          <h2 className="card-title">{result.analysis.title}</h2>
          <AnalysisDetails analysis={result.analysis} t={t} format={result.format} lang={lang} />
        </div>
      )}
    </div>
  );
};

const RepositoryDetailView = ({ record, onBack, onUseCase, t }: any) => {
  const htmlContent = useMemo(() => getCleanHtml(record.judgment_text), [record.judgment_text]);
  return (
    <div className="container" style={{maxWidth: '1000px', margin: '0 auto'}}>
      <button className="btn btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={onBack} title={t('back')}>
        <span className="material-symbols-outlined flip-rtl">arrow_back</span> {t('back')}
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
         <div className="card info-card">
            <h4 className="info-label">{t('judgmentNo')}</h4>
            <p className="info-value">{record.judgment_number || '-'}</p>
         </div>
         <div className="card info-card">
            <h4 className="info-label">{t('court')}</h4>
            <p className="info-value">{record.judgment_court_name || '-'}</p>
         </div>
         <div className="card info-card">
            <h4 className="info-label">{t('date')}</h4>
            <p className="info-value">{record.judgment_hijri_date || '-'}</p>
         </div>
      </div>

      <div className="card animate-fade-in">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
           <h2 className="card-title" style={{ margin: 0 }}>{record.title || t('originalText')}</h2>
           <button className="btn btn-primary" onClick={() => onUseCase(record.judgment_text)}>
              <span className="material-symbols-outlined">auto_fix_high</span> {t('analyzeThisCase')}
           </button>
        </div>
        
        <div 
            className="judgment-text-content"
            style={{ 
                background: 'var(--bg-surface-alt)', 
                padding: '2rem', 
                borderRadius: 'var(--radius-md)', 
                lineHeight: '2', 
                border: '1px solid var(--border-subtle)',
                maxHeight: '70vh',
                overflowY: 'auto',
                fontSize: '1.1rem'
            }}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
        
        <div className="notice-banner">
           <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)', fontSize: '1.5rem' }}>info</span>
           <div>
              <p style={{ fontWeight: '800', color: 'var(--brand-primary)', marginBottom: '0.25rem', fontSize: '1.05rem' }}>{t('legalAnalytics')}</p>
              <p style={{ fontSize: '0.9rem' }}>{t('repositoryNotice')}</p>
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

  const processAnalysis = async (text: string, config: any, title?: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const properties: any = { title: { type: Type.STRING } };
    Object.entries(config.sections).forEach(([key, enabled]) => {
      if (enabled && FULL_SCHEMA_PROPERTIES[key]) {
        properties[key] = FULL_SCHEMA_PROPERTIES[key];
      }
    });

    const responseSchema = {
      type: Type.OBJECT,
      properties,
      required: ["title"]
    };

    const prompt = `Analyze this Saudi legal judgment in Arabic. Return ONLY the JSON response.
    Format all long text fields (facts, reasons, ruling, etc.) using ${config.format === 'markdown' ? 'Markdown (bold keys, bullet points)' : 'Plain Text'}.
    Extract ONLY these requested sections: ${Object.entries(config.sections).filter(([k,v]) => v).map(([k,v]) => k).join(', ')}.
    Text to analyze:\n\n${text}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        responseMimeType: 'application/json', 
        responseSchema 
      }
    });

    const analysis = JSON.parse(response.text);
    if (title) analysis.title = title;
    
    const rec = { 
      originalText: text, 
      analysis, 
      timestamp: Date.now(),
      format: config.format
    };
    
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
          <span className="material-symbols-outlined" style={{fontSize: '2rem'}}>gavel</span>
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
            <button className="btn btn-secondary mobile-only" style={{padding: '0.6rem', minWidth: 'auto', border: 'none', background: 'transparent'}} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h2 className="header-title">{navItems.find(i => i.id === activeTab)?.label}</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary lang-btn" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} title={t('switchLanguage')}>{t('switchLanguage')}</button>
            <button className="btn btn-secondary theme-btn" style={{ minWidth: 'auto', paddingInline: '0.75rem' }} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title={t('toggleTheme')}>
              <span className="material-symbols-outlined" style={{fontSize: '20px'}}>{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>
            </button>
          </div>
        </header>

        <div className="content-body">
          {activeTab === 'analyze' && <AnalyzeView t={t} processAnalysis={processAnalysis} externalText={externalText} clearExternal={() => setExternalText('')} lang={lang} />}
          
          {activeTab === 'history' && (
             <div className="view-history">
               {selectedHistory ? (
                 <div className="animate-fade-in">
                   <button className="btn btn-secondary" style={{marginBottom: '1.5rem'}} onClick={() => setSelectedHistory(null)}><span className="material-symbols-outlined flip-rtl">arrow_back</span> {t('back')}</button>
                   <div className="card">
                     <h2 className="card-title">{selectedHistory.analysis.title}</h2>
                     <AnalysisDetails analysis={selectedHistory.analysis} t={t} format={selectedHistory.format || 'markdown'} lang={lang} />
                   </div>
                 </div>
               ) : (
                 <div className="history-list">
                  {history.length === 0 ? (
                    <div className="empty-state">
                      <span className="material-symbols-outlined">history_off</span>
                      <p>{t('noHistory')}</p>
                    </div>
                  ) : history.map(h => (
                    <div key={h.id} className="card card-clickable animate-fade-in" style={{marginBottom: '1rem'}} onClick={() => setSelectedHistory(h)}>
                      <div style={{display:'flex', justifyContent:'space-between', gap: '1.5rem'}}>
                        <div style={{flex: 1, minWidth: 0}}>
                          <strong style={{display: 'block', fontSize: '1.15rem', marginBottom: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{h.analysis.title}</strong>
                          <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center'}}>
                            <span className="badge badge-brand" style={{fontSize: '0.75rem'}}>{h.analysis.courtName}</span>
                            <span style={{fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem'}}>
                              <span className="material-symbols-outlined" style={{fontSize: '1rem'}}>calendar_today</span>
                              {new Date(h.timestamp).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}
                            </span>
                          </div>
                        </div>
                        <button className="btn btn-secondary" style={{color: 'var(--status-error)', padding: '0.5rem', minWidth: 'auto', background: 'transparent', border: 'none'}} onClick={(e) => { e.stopPropagation(); deleteCaseFromDB(h.id).then(() => setHistory(history.filter(i => i.id !== h.id))); }}>
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                 </div>
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
                <div className="view-repository">
                    {repositoryRecords.map(item => (
                        <div key={item.id} className="card card-clickable animate-fade-in" onClick={() => setSelectedRepositoryId(item.id)}>
                            <div style={{marginBottom: '0.85rem'}}><span className="badge badge-brand">{item.judgment_court_name}</span></div>
                            <h4 style={{marginBottom: '0.85rem', fontSize: '1.15rem', fontWeight: '800', lineHeight: 1.4}}>{item.title || `${t('judgmentNo')} ${item.judgment_number}`}</h4>
                            <p style={{fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
                              <span className="material-symbols-outlined" style={{fontSize: '1rem'}}>event_note</span>
                              {item.judgment_hijri_date}
                            </p>
                            <button className="btn btn-primary" style={{marginTop: '1.5rem', width: '100%'}} onClick={(e) => { e.stopPropagation(); setSelectedRepositoryId(item.id); }}>{t('details')}</button>
                        </div>
                    ))}
                </div>
            )
          )}

          {activeTab === 'admin' && (
            <div className="card admin-card animate-fade-in">
               <h3 className="section-title" style={{marginBottom: '2rem'}}>{t('topCitedLaws')}</h3>
               <div style={{height: '400px', width: '100%'}}>
                 {Object.keys(globalLawStats).length > 0 ? (
                    <Bar 
                      data={{ 
                          labels: Object.entries(globalLawStats).sort((a:any,b:any) => b[1]-a[1]).slice(0,8).map(e => e[0].length > 25 ? e[0].substring(0,25)+'...' : e[0]), 
                          datasets: [{ label: t('citationCount'), data: Object.entries(globalLawStats).sort((a:any,b:any) => b[1]-a[1]).slice(0,8).map(e => e[1]), backgroundColor: '#1e3a8a', borderRadius: 8 }] 
                      }} 
                      options={{ 
                          maintainAspectRatio: false,
                          indexAxis: 'y',
                          plugins: { legend: { display: false } },
                          scales: {
                            x: { grid: { display: false }, ticks: { font: { family: lang === 'ar' ? 'Tajawal' : 'Inter', weight: 'bold' } } },
                            y: { grid: { display: false }, ticks: { font: { family: lang === 'ar' ? 'Tajawal' : 'Inter', weight: 'bold' } } }
                          }
                      }} 
                    />
                 ) : (
                    <div className="empty-state">
                      <span className="material-symbols-outlined">query_stats</span>
                      <p>{t('noHistory')}</p>
                    </div>
                 )}
               </div>
            </div>
          )}
        </div>
      </main>

      <nav className="mobile-bottom-nav">
        {navItems.map(item => (
          <button 
            key={item.id} 
            className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`} 
            onClick={() => { setActiveTab(item.id); setSelectedHistory(null); setSelectedRepositoryId(null); setIsMobileMenuOpen(false); }}
            aria-label={item.label}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
