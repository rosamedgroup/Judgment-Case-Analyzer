/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from '@google/genai';
import { useState, FormEvent, ChangeEvent, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const DB_NAME = 'JudgmentCaseDB';
const DB_VERSION = 1;
const STORE_NAME = 'cases';

interface CaseRecord {
  id?: number;
  originalText: string;
  analysis: any;
  timestamp: number;
}

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

const addCaseToDB = (record: CaseRecord): Promise<IDBDatabase> => {
  return openDB().then(db => {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const addRequest = store.add(record);
      addRequest.onsuccess = () => resolve(db);
      addRequest.onerror = () => reject(addRequest.error);
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


function App() {
  const [caseText, setCaseText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analysisResults, setAnalysisResults] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progressText, setProgressText] = useState('');

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await getAllCasesFromDB();
        setAnalysisResults(history);
      } catch (err) {
        console.error("Failed to load history from DB:", err);
        setError("Could not load analysis history.");
      }
    };
    loadHistory();
  }, []);
  
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/json') {
        setUploadedFile(file);
        setCaseText(''); // Clear textarea when a file is selected
        setError('');
      } else {
        setError('Please upload a valid JSON file.');
        e.target.value = ''; // Reset file input
      }
    }
  };
  
  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    if (!caseText.trim() && !uploadedFile) {
      setError('Please paste the case text or upload a file before analyzing.');
      return;
    }
    setLoading(true);
    setError('');
    setProgressText('');

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const analyzeAndStoreCase = async (text: string, originalIndex: number, totalCases: number): Promise<CaseRecord | { error: string, originalText: string }> => {
      setProgressText(`Analyzing case ${originalIndex + 1} of ${totalCases}...`);
      try {
        const prompt = `Analyze the following legal case text from Saudi Arabia and extract the specified information in JSON format. If a field is not present in the text, use null for its value. Here is the case text: \n\n${text}`;
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
          },
        });
        const analysis = JSON.parse(response.text);
        const record: CaseRecord = { originalText: text, analysis, timestamp: Date.now() };
        await addCaseToDB(record);
        // We'll refetch to get the ID and ensure order.
        return record; 
      } catch (err) {
        console.error(`Failed to analyze case ${originalIndex + 1}:`, err);
        return { error: `Failed to analyze case ${originalIndex + 1}.`, originalText: text };
      }
    };

    if (uploadedFile) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const fileContent = event.target?.result as string;
          const cases = JSON.parse(fileContent);
          if (!Array.isArray(cases) || !cases.every(c => typeof c === 'string')) {
            throw new Error('JSON file must contain an array of strings.');
          }

          const newResults: CaseRecord[] = [];
          for (let i = 0; i < cases.length; i++) {
            const result = await analyzeAndStoreCase(cases[i], i, cases.length);
            // This is a temporary state for UI, will be replaced by full history fetch
            setAnalysisResults(prev => 'error' in result ? prev : [result, ...prev]);
          }
          const fullHistory = await getAllCasesFromDB();
          setAnalysisResults(fullHistory);

          setProgressText('Analysis complete.');
        } catch (err) {
          console.error(err);
          setError('Failed to read or parse the JSON file. Please ensure it is a valid JSON array of strings.');
          setProgressText('');
        } finally {
          setLoading(false);
          setUploadedFile(null);
          const fileInput = document.getElementById('file-upload') as HTMLInputElement;
          if (fileInput) fileInput.value = '';
        }
      };
      reader.onerror = () => {
        setError('Failed to read the file.');
        setLoading(false);
      };
      reader.readAsText(uploadedFile);
    } else {
      try {
        await analyzeAndStoreCase(caseText, 0, 1);
        const fullHistory = await getAllCasesFromDB();
        setAnalysisResults(fullHistory);
        setCaseText('');
        setProgressText('Analysis complete.');
      } catch (err) {
        console.error(err);
        setError('Failed to analyze the case. Please check the console for more details.');
        setProgressText('');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear all analysis history? This action cannot be undone.')) {
      try {
        await clearAllCasesFromDB();
        setAnalysisResults([]);
      } catch (err) {
        console.error('Failed to clear history:', err);
        setError('Could not clear history.');
      }
    }
  };

  return (
    <main className="container">
      <header>
        <h1>Judgment Case Analyzer</h1>
        <p>Paste the text from a Saudi Arabian judgment case or upload a JSON file with multiple cases to extract structured data.</p>
      </header>

      <div className="content-wrapper">
        <div className="input-section">
          <form onSubmit={handleAnalyze}>
            <label htmlFor="case-text">Case Text</label>
            <textarea
              id="case-text"
              value={caseText}
              onChange={(e) => {
                setCaseText(e.target.value);
                if (uploadedFile) {
                  setUploadedFile(null);
                  const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                  if (fileInput) fileInput.value = '';
                }
              }}
              placeholder="Paste the full text of the judgment case here..."
              rows={15}
              disabled={loading}
              aria-label="Case Text Input"
            />
            <div className="divider">OR</div>
            <div className="file-input-wrapper">
              <label htmlFor="file-upload" className="file-label">
                Upload JSON File
              </label>
              <input id="file-upload" type="file" onChange={handleFileChange} accept=".json,.jsonl" disabled={loading} />
              {uploadedFile && <span className="file-name">{uploadedFile.name}</span>}
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Analyzing...' : 'Analyze Case'}
            </button>
          </form>
        </div>

        <div className="output-section">
          {loading && <div className="loader"></div>}
          {loading && progressText && <div className="progress-text">{progressText}</div>}
          {error && <div className="error-message">{error}</div>}
          {analysisResults.length > 0 && <ResultsDisplay results={analysisResults} onClear={handleClearHistory} />}
          {!loading && !error && analysisResults.length === 0 && <div className="placeholder">Your analysis history will appear here.</div>}
        </div>
      </div>
    </main>
  );
}

const ResultsDisplay = ({ results, onClear }: { results: CaseRecord[], onClear: () => void }) => {
  return (
    <div className="results-container">
      <div className="results-header">
        <h2>Analysis History ({results.length})</h2>
        <button className="clear-history-btn" onClick={onClear}>Clear History</button>
      </div>
      {results.map((result) => (
        <ResultCard key={result.id} data={result.analysis} />
      ))}
    </div>
  );
};


const ResultCard = ({ data }: { data: any }) => {
  if (data.error) {
    return (
      <div className="result-card error-card">
        <h3>Analysis Failed</h3>
        <p>{data.error}</p>
        <details>
          <summary>Original Text</summary>
          <pre>{data.originalText}</pre>
        </details>
      </div>
    );
  }

  const renderField = (label: string, value: any) => {
    if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
      return null;
    }
    return (
      <div className="field">
        <strong>{label}:</strong> <span>{typeof value === 'boolean' ? String(value) : value}</span>
      </div>
    );
  };
  
  return (
    <div className="result-card">
      <details open>
        <summary>Case Information</summary>
        <div className="result-section">
          {renderField('ID', data.id)}
          {renderField('Title', data.title)}
          {renderField('Decision Title', data.decisionTitle)}
          {renderField('Year', `${data.year} / ${data.hijriYear}H`)}
          {renderField('Export Date', data.exportDate)}
        </div>
      </details>

      {data.hasJudgment && (
        <details open>
          <summary>Judgment Details</summary>
          <div className="result-section">
            {renderField('Judgment Number', data.judgmentNumber)}
            {renderField('Date', `${data.judgmentDate} / ${data.judgmentHijriDate}H`)}
            {renderField('Court', `${data.judgmentCourtName}, ${data.judgmentCityName}`)}
            <div className="field-long"><strong>Facts:</strong> <p>{data.judgmentFacts}</p></div>
            <div className="field-long"><strong>Reasons:</strong> <p>{data.judgmentReasons}</p></div>
            <div className="field-long"><strong>Ruling:</strong> <p>{data.judgmentRuling}</p></div>
            <div className="field-long"><strong>Text of Ruling:</strong> <p>{data.judgmentTextOfRuling}</p></div>
          </div>
        </details>
      )}

      {data.hasAppeal && (
        <details>
          <summary>Appeal Details</summary>
          <div className="result-section">
            {renderField('Appeal Number', data.appealNumber)}
            {renderField('Appeal Date', `${data.appealDate} / ${data.appealHijriDate}H`)}
            {renderField('Appeal Court', `${data.appealCourtName}, ${data.appealCityName}`)}
            <div className="field-long"><strong>Appeal Facts:</strong> <p>{data.appealFacts}</p></div>
            <div className="field-long"><strong>Appeal Reasons:</strong> <p>{data.appealReasons}</p></div>
            <div className="field-long"><strong>Appeal Ruling:</strong> <p>{data.appealRuling}</p></div>
            <div className="field-long"><strong>Appeal Text of Ruling:</strong> <p>{data.appealTextOfRuling}</p></div>
          </div>
        </details>
      )}

      {data.judgmentNarrationList && data.judgmentNarrationList.length > 0 && (
         <details>
          <summary>Judgment Narrations</summary>
          <div className="result-section">
            <ul>
              {data.judgmentNarrationList.map((narration: string, index: number) => (
                <li key={index}>{narration}</li>
              ))}
            </ul>
          </div>
         </details>
      )}

      <details>
        <summary>Raw JSON Data</summary>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
};


const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);