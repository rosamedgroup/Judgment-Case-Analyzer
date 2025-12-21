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
    details: "التفاصيل"
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
    details: "Details"
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
  // Simple markdown renderer for bold and lists since we can't import heavy libs easily
  const formatted = text
    .split('\n')
    .map((line, i) => {
      let content = line;
      // Bold
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Lists
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        return <li key={i} dangerouslySetInnerHTML={{ __html: content.substring(2) }} />;
      }
      return <p key={i} dangerouslySetInnerHTML={{ __html: content }} />;
    });
  
  return <div className="legal-content">{formatted}</div>;
};

const AnalysisDetails = ({ analysis, t }: any) => (
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
        <ul style={{ paddingInlineStart: '1.25rem', color: 'var(--text-secondary)' }}>
          {analysis.lawsCited.map((law: string, idx: number) => (
            <li key={idx}>{law}</li>
          ))}
        </ul>
      </section>
    )}
  </div>
);

const AnalyzeSection = ({ text, setText, onAnalyze, isLoading, result, t }: any) => (
  <div className="grid-analyze">
    <section className="card">
      <h2 className="card-title"><span className="material-symbols-outlined">description</span> {t('analyze')}</h2>
      <textarea 
        className="input-field" 
        rows={15} 
        value={text} 
        onChange={(e) => setText(e.target.value)} 
        placeholder={t('casePlaceholder')}
        style={{ marginBottom: '1.5rem' }}
      />
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={isLoading || !text.trim()} onClick={onAnalyze}>
        {isLoading ? <span className="spinner"></span> : <><span className="material-symbols-outlined">bolt</span> {t('analyzeBtn')}</>}
      </button>

      {result && (
        <div style={{ marginTop: '2.5rem', borderTop: '2px solid var(--border-subtle)', paddingTop: '2rem' }}>
          <h2 className="card-title">{result.analysis.title}</h2>
          <AnalysisDetails analysis={result.analysis} t={t} />
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

const HistorySection = ({ history, onDelete, t, locale }: any) => {
  const [selected, setSelected] = useState<any>(null);

  if (selected) {
    return (
      <div className="container">
        <button className="btn btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={() => setSelected(null)}>
          <span className="material-symbols-outlined">arrow_back</span> {t('back')}
        </button>
        <div className="card">
          <h2 className="card-title">{selected.analysis.title}</h2>
          <AnalysisDetails analysis={selected.analysis} t={t} />
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>{t('history')}</h2>
        <button className="btn btn-secondary"><span className="material-symbols-outlined">download</span> {t('export')}</button>
      </div>
      
      {history.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '4rem', opacity: 0.2 }}>history_toggle_off</span>
          <p style={{ marginTop: '1rem' }}>{t('noHistory')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {history.map((rec: any) => (
            <div key={rec.id} className="card card-clickable" onClick={() => setSelected(rec)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ marginBottom: '0.5rem' }}>{rec.analysis?.title || rec.originalText.substring(0, 50) + '...'}</h3>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                     <span className="badge">{rec.analysis?.courtName}</span>
                     <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDistance(new Date(rec.timestamp), new Date(), { locale, addSuffix: true })}</p>
                  </div>
                </div>
                <button className="btn btn-secondary" style={{ color: 'var(--status-error)', padding: '0.5rem' }} onClick={(e) => { e.stopPropagation(); onDelete(rec.id); }}>
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const RepositorySection = ({ records, t }: any) => {
  const [selected, setSelected] = useState<any>(null);
  
  if (selected) return (
    <div className="container">
      <button className="btn btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={() => setSelected(null)}>
        <span className="material-symbols-outlined">arrow_back</span> {t('back')}
      </button>
      <div className="card">
        <h2 style={{ color: 'var(--brand-primary)', marginBottom: '1rem' }}>{selected.title}</h2>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <span className="badge">{selected.judgment_court_name}</span>
          <span className="badge">{selected.judgment_hijri_date}</span>
        </div>
        <div className="legal-content" dangerouslySetInnerHTML={{ __html: selected.judgment_text }}></div>
      </div>
    </div>
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
      For text fields like 'facts', 'reasons', 'ruling', and 'proceduralHistory', use professional legal Markdown (e.g., **bold** for emphasis, bullet points for lists).
      Identify all parties, procedural history sessions, and specifically cited laws/articles.
      
      Legal Judgment Text:
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
            t={t} 
          />
        )}
        
        {activeTab === 'history' && (
          <HistorySection history={history} onDelete={handleDelete} t={t} locale={dateLocale} />
        )}
        
        {activeTab === 'records' && (
          <RepositorySection records={judicialData} t={t} />
        )}
        
        {activeTab === 'admin' && (
          <div className="card" style={{ textAlign: 'center', padding: '5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '5rem', color: 'var(--brand-primary)', opacity: 0.1 }}>dashboard_customize</span>
            <h2 style={{ marginTop: '1rem' }}>لوحة التحكم قيد التطوير</h2>
            <p style={{ color: 'var(--text-muted)' }}>ستتمكن قريباً من عرض إحصائيات متقدمة حول القضايا المحللة.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<React.StrictMode><App /></React.StrictMode>);
