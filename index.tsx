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
    commonReferences: "المراجع الشائعة"
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
    commonReferences: "Common References"
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

const HistorySection = ({ history, onDelete, onUpdate, globalLawStats, t, locale }: any) => {
  const [selected, setSelected] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  const handleSave = () => {
    if (onUpdate && selected) {
      onUpdate(selected.id, editTitle);
      setSelected((prev: any) => ({ ...prev, analysis: { ...prev.analysis, title: editTitle } }));
      setIsEditing(false);
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

const RepositorySection = ({ records, globalLawStats, t }: any) => {
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
        
        {globalLawStats && (
          <div style={{ marginBottom: '2rem' }}>
             <LegalAnalyticsDashboard globalLawStats={globalLawStats} t={t} />
          </div>
        )}

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
      - Extract every specific law, regulation, or royal decree mentioned.
      - STRICTLY FORMAT specific article citations as: 'المادة [رقم] من [اسم النظام]' (e.g., 'المادة 76 من نظام المرافعات الشرعية').
      - NORMALIZE all law names to their official standard Arabic titles.
      - EXCLUDE general references (e.g., "according to the system", "based on the regulation") if the specific law name is not provided.
      
      CRITICAL INSTRUCTION FOR TEXT FIELDS ('facts', 'reasons', 'ruling', 'proceduralHistory'):
      - You MUST use Markdown formatting to improve readability.
      - Use **bold** for important names, dates, amounts, and legal terms.
      - Use bullet points (- ) for listing chronological events, arguments, or evidences.
      - Ensure the text is well-structured and easy to read.
      
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

  const handleUpdate = async (id: number, newTitle: string) => {
    const record = history.find(h => h.id === id);
    if (!record) return;
    const updatedRecord = { ...record, analysis: { ...record.analysis, title: newTitle } };
    await putCaseInDB(updatedRecord);
    setHistory(prev => prev.map(h => h.id === id ? updatedRecord : h));
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
          <HistorySection history={history} onDelete={handleDelete} onUpdate={handleUpdate} globalLawStats={globalLawStats} t={t} locale={dateLocale} />
        )}
        
        {activeTab === 'records' && (
          <RepositorySection records={judicialData} globalLawStats={globalLawStats} t={t} />
        )}
        
        {activeTab === 'admin' && (
          <div className="card" style={{ textAlign: 'center', padding: '5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '5rem', color: 'var(--brand-primary)', opacity: 0.1 }}>dashboard_customize</span>
            <h2 style={{ marginTop: '1rem' }}>{t('admin')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
               <div className="card">
                 <h4>{t('topCitedLaws')}</h4>
                 <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {Object.entries(globalLawStats).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5).map(([law, count]: any, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'var(--bg-surface-alt)', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.9rem' }}>{law}</span>
                        <span className="badge badge-success">{count}</span>
                      </div>
                    ))}
                 </div>
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