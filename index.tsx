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
    analyzeThisCase: "تحليل هذه القضية بالذكاء الاصطناعي",
    repositoryNotice: "هذه البيانات مستخرجة من السجلات العامة. للحصول على تحليل قانوني متعمق (مثل استخراج المواد النظامية وتلخيص دقيق)، استخدم زر التحليل بالذكاء الاصطناعي.",
    originalText: "النص الأصلي",
    structuredView: "التحليل المهيكل"
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
    analyzeThisCase: "Analyze this case with AI",
    repositoryNotice: "These data are from public records. For in-depth legal analysis (e.g. extracting statutes and precise summary), use the AI Analysis button.",
    originalText: "Original Text",
    structuredView: "Structured View"
  }
};

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short descriptive title for the case" },
    judgmentNumber: { type: Type.STRING, description: "Official judgment number" },
    courtName: { type: Type.STRING, description: "Name of the court" },
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
        return <li key={i} dangerouslySetInnerHTML={{ __html: content.substring(2) }} />;
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
    </div>

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

const AnalyzeSection = ({ text, setText, onAnalyze, isLoading, result, globalLawStats, t }: any) => (
  <div className="grid-analyze">
    <section className="card">
      <h2 className="card-title"><span className="material-symbols-outlined">description</span> {t('analyze')}</h2>
      
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
    </section>
    
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
  </div>
);

const HistorySection = ({ history, onDelete, onUpdate, onBulkDelete, globalLawStats, t, locale }: any) => {
  const [selected, setSelected] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  
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

  const handleBulkExport = () => {
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
  };
  
  const handleBulkDeleteClick = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    
    // UI logic: confirm here to prevent clearing selection if cancelled
    if (window.confirm(t('confirmBulkDelete'))) {
        onBulkDelete(ids);
        setIsSelectionMode(false);
        setSelectedIds(new Set());
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
        <h2 style={{margin: 0}}>{t('history')}</h2>
        
        {history.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {isSelectionMode ? (
              <>
                <button className="btn btn-secondary" onClick={handleSelectAll}>
                  {selectedIds.size === history.length ? t('deselectAll') : t('selectAll')}
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleBulkDeleteClick}
                  disabled={selectedIds.size === 0}
                  style={{ color: 'var(--status-error)' }}
                >
                  <span className="material-symbols-outlined">delete</span> {t('deleteSelected')}
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={handleBulkExport}
                  disabled={selectedIds.size === 0}
                >
                  <span className="material-symbols-outlined">download</span> {t('exportSelected')}
                </button>
                <button className="btn btn-secondary" onClick={toggleSelectionMode}>
                  {t('cancel')}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={toggleSelectionMode}>
                  <span className="material-symbols-outlined">check_box</span> {t('select')}
                </button>
                <button className="btn btn-secondary" onClick={handleBulkExport}>
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
                   background: isSelected ? 'var(--brand-primary-soft)' : 'var(--bg-surface)'
                }}
                onClick={() => isSelectionMode ? toggleSelectId(rec.id) : setSelected(rec)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  {isSelectionMode && (
                    <div style={{ paddingTop: '0.25rem' }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => toggleSelectId(rec.id)}
                          style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
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

// Helper function to parse legacy judgment text
const parseLegacyCase = (record: any) => {
    let text = record.judgment_text || "";
    // Clean HTML tags and entities
    text = text.replace(/<br\s*\/?>/gi, '\n')
               .replace(/&nbsp;/g, ' ')
               .replace(/<[^>]+>/g, '')
               // Normalize newlines and ensure unified spacing
               .replace(/\r\n/g, '\n')
               .replace(/\n{2,}/g, '\n');

    if (!text.trim() && record.judgment_ruling) {
        text = `نص الحكم:\n${record.judgment_ruling}`;
    }

    const findHeaderIndex = (text: string, patterns: RegExp[]) => {
        let bestMatch = null;
        for (const p of patterns) {
            const match = text.match(p);
            if (match && match.index !== undefined) {
                 if (!bestMatch || match.index < bestMatch.index) {
                     bestMatch = { index: match.index, length: match[0].length };
                 }
            }
        }
        return bestMatch;
    };

    const factsPatterns = [
        /(?:^|\n)\s*(?:الوقائع|وقائع الدعوى|ملخص الوقائع|واقعات الدعوى|موجز الوقائع|بيان الدعوى|تتحصل وقائع هذه الدعوى|تتلخص وقائع هذه الدعوى)\s*[:\-\.]?/i
    ];
    const reasonsPatterns = [
        /(?:^|\n)\s*(?:الأسباب|أسباب الحكم|تسبيب الحكم|الأسباب والحيثيات|حيثيات الحكم|الموضوع|بناء على ما تقدم|تأسيس الحكم|وعليه)\s*[:\-\.]?/i
    ];
    const rulingPatterns = [
        /(?:^|\n)\s*(?:نص الحكم|منطوق الحكم|المنطوق|الحكم|حكمت الدائرة|منطوق|قررت الدائرة|وبه تقضي)\s*[:\-\.]?/i
    ];

    const factsMatch = findHeaderIndex(text, factsPatterns);
    const reasonsMatch = findHeaderIndex(text, reasonsPatterns);
    const rulingMatch = findHeaderIndex(text, rulingPatterns);

    const sections = [
        { type: 'facts', match: factsMatch },
        { type: 'reasons', match: reasonsMatch },
        { type: 'ruling', match: rulingMatch }
    ].filter(s => s.match !== null).sort((a, b) => a.match!.index - b.match!.index);

    const extractContent = (currentType: string) => {
        const currentSection = sections.find(s => s.type === currentType);
        if (!currentSection) {
            if (currentType === 'facts' && sections.length > 0 && sections[0].type !== 'facts') {
                 // Fallback can be implemented here if needed
                 return "";
            }
            return "";
        }

        const start = currentSection.match!.index + currentSection.match!.length;
        const currentIndex = sections.indexOf(currentSection);
        const nextSection = sections[currentIndex + 1];
        const end = nextSection ? nextSection.match!.index : text.length;
        return text.substring(start, end).trim();
    };

    let factsText = extractContent('facts');
    let reasonsText = extractContent('reasons');
    let rulingText = extractContent('ruling');
    
    // Fallback: If no headers found at all, put everything in facts
    if (sections.length === 0) {
        factsText = text;
    }

    const parties = [];
    const claimantMatch = text.match(/(?:^|\n)\s*(?:المدعي|المدعية|المتظلم|المدمي|صاحب الدعوى)\s*[:\-\.]([\s\S]*?)(?=(?:^|\n)\s*(?:المدعى عليه|المدعى عليها|الوقائع))/i);
    if (claimantMatch) parties.push({ role: 'المدعي', name: claimantMatch[1].trim().split('\n')[0] });

    const defendantMatch = text.match(/(?:^|\n)\s*(?:المدعى عليه|المدعى عليها|ضد|في مواجهة)\s*[:\-\.]([\s\S]*?)(?=(?:^|\n)\s*(?:الوقائع|أسباب))/i);
    if (defendantMatch) parties.push({ role: 'المدعى عليه', name: defendantMatch[1].trim().split('\n')[0] });

    return {
      title: record.title,
      judgmentNumber: record.judgment_number || "N/A",
      courtName: record.judgment_court_name || "N/A",
      parties: parties.length ? parties : [{ role: "أطراف", name: "غير محدد" }],
      proceduralHistory: "", 
      facts: factsText || (sections.length === 0 ? text : "لم يتم استخلاص الوقائع تلقائياً."),
      reasons: reasonsText || "لا توجد أسباب مستخلصة.",
      ruling: rulingText || record.judgment_ruling || "لا يوجد منطوق حكم مستخلص.",
      lawsCited: [] 
    };
};

const RepositoryDetailView = ({ selected, parsedAnalysis, globalLawStats, t, onUseCase, onBack }: any) => {
  const [viewMode, setViewMode] = useState<'analysis' | 'original'>('analysis');

  const displayOriginalText = useMemo(() => {
    return (selected.judgment_text || selected.judgment_ruling || "")
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]+>/g, '');
  }, [selected]);

  return (
    <div className="container">
      <button className="btn btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={onBack}>
        <span className="material-symbols-outlined">arrow_back</span> {t('back')}
      </button>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ color: 'var(--brand-primary)', margin: 0 }}>{selected.title}</h2>
          <button 
             className="btn btn-primary" 
             onClick={() => onUseCase(displayOriginalText)}
          >
             <span className="material-symbols-outlined">auto_awesome</span> {t('analyzeThisCase')}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
           <button 
             className={`btn ${viewMode === 'analysis' ? 'btn-primary' : 'btn-secondary'}`}
             onClick={() => setViewMode('analysis')}
             style={{ borderRadius: '2rem', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
           >
              <span className="material-symbols-outlined">segment</span> {t('structuredView')}
           </button>
           <button 
             className={`btn ${viewMode === 'original' ? 'btn-primary' : 'btn-secondary'}`}
             onClick={() => setViewMode('original')}
             style={{ borderRadius: '2rem', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
           >
              <span className="material-symbols-outlined">description</span> {t('originalText')}
           </button>
        </div>
        
        {viewMode === 'analysis' ? (
           <>
              <div className="card" style={{ background: 'var(--brand-primary-soft)', border: 'none', marginBottom: '2rem' }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2rem', marginInlineEnd: '0.5rem' }}>info</span>
                      {t('repositoryNotice')}
                  </p>
              </div>
              <AnalysisDetails analysis={parsedAnalysis} globalLawStats={globalLawStats} t={t} />
           </>
        ) : (
           <div style={{ background: 'var(--bg-surface-alt)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-ar)', fontSize: '1rem', lineHeight: '1.8', color: 'var(--text-primary)' }}>
                {displayOriginalText}
              </pre>
           </div>
        )}
      </div>
    </div>
  );
};

const RepositorySection = ({ records, globalLawStats, t, onUseCase }: any) => {
  const [selected, setSelected] = useState<any>(null);
  const parsedAnalysis = useMemo(() => selected ? parseLegacyCase(selected) : null, [selected]);
  
  if (selected && parsedAnalysis) return (
    <RepositoryDetailView 
      selected={selected}
      parsedAnalysis={parsedAnalysis}
      globalLawStats={globalLawStats}
      t={t}
      onUseCase={onUseCase}
      onBack={() => setSelected(null)}
    />
  );

  return (
    <div className="grid-repository">
      <aside className="card" style={{ height: 'fit-content' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>أدوات التصفية</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input className="input-field" placeholder="بحث بالكلمات المفتاحية..." />
          <select className="input-field">
            <option>جميع المحاكم</option>
            <option>المحكمة التجارية</option>
            <option>المحكمة العامة</option>
          </select>
          <button className="btn btn-primary" style={{ marginTop: '0.5rem' }}>بحث</button>
        </div>
      </aside>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {records.map((rec: any) => (
          <div key={rec.case_id} className="card card-clickable" style={{ cursor: 'pointer' }} onClick={() => setSelected(rec)}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h4 style={{ color: 'var(--brand-primary)' }}>{rec.title}</h4>
              <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)' }}>chevron_right</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{rec.judgment_court_name} • {rec.judgment_hijri_date}</p>
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

  const t = (key: string) => translations[lang][key] || key;
  const dateLocale = lang === 'ar' ? arLocale : enLocale;

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleAnalyze = async () => {
    if (!caseText.trim()) return;
    setIsLoading(true);
    setCurrentResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      const prompt = `You are a Senior Saudi Legal Analyst. Analyze the provided Saudi legal judgment in its original Arabic.
      Extract detailed structured data following the requested schema.
      
      CRITICAL INSTRUCTION FOR 'lawsCited':
      - Extract every specific law, regulation, circular, or royal decree mentioned in the text.
      - CITATION FORMATTING: You MUST follow this exact format for article citations: 'المادة [رقم] من [اسم النظام]' (e.g., 'المادة 76 من نظام المرافعات الشرعية').
      - Do NOT use formats like 'Article [Num] of [Law]' or '[Law], Article [Num]'.
      - NORMALIZE all law names to their official standard Arabic titles.
      - EXCLUDE general references (e.g., "according to the system") if the specific law name is not provided.
      
      CRITICAL INSTRUCTION FOR TEXT FIELDS ('facts', 'reasons', 'ruling', 'proceduralHistory'):
      - You MUST use Markdown formatting to improve readability.
      - Use **bold** for important names, dates, amounts, and legal terms.
      - Use bullet points (- ) for listing chronological events, arguments, or evidences.
      - Ensure the text is well-structured and easy to read.
      
      Legal Judgment Text (Formatted):
      ${caseText}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { 
          responseMimeType: 'application/json',
          responseSchema: ANALYSIS_SCHEMA
        }
      });
      
      const analysis = JSON.parse(response.text);
      const newRec = { originalText: caseText, analysis, timestamp: Date.now() };
      const id = await putCaseInDB(newRec);
      const savedRec = { ...newRec, id };
      setHistory(prev => [savedRec, ...prev]);
      setCurrentResult(savedRec);
      setCaseText('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteCaseFromDB(id);
    setHistory(prev => prev.filter(h => h.id !== id));
  };
  
  const handleBulkDelete = async (ids: number[]) => {
    // Confirmation is now handled in the UI (HistorySection) before calling this
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
          />
        )}
        
        {activeTab === 'records' && (
          <RepositorySection 
             records={judicialData} 
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