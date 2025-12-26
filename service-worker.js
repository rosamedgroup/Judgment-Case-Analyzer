/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI } from 'https://esm.sh/@google/genai@^0.7.0';

const DB_NAME = 'JudgmentCaseDB';
const DB_VERSION = 5;
const STORE_NAME = 'cases';
const LOG_STORE_NAME = 'audit_logs';

const openDB = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(LOG_STORE_NAME)) {
            db.createObjectStore(LOG_STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

const addLogEntry = (action, details) => openDB().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(LOG_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(LOG_STORE_NAME);
    const log = { action, details, timestamp: Date.now() };
    const request = store.add(log);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
}));

const putCaseInDB = (record) => openDB().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
}));

const ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    judgmentNumber: { type: 'STRING' },
    courtName: { type: 'STRING' },
    parties: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          role: { type: 'STRING' }
        },
        required: ["name", "role"]
      }
    },
    proceduralHistory: { type: 'STRING' },
    facts: { type: 'STRING' },
    reasons: { type: 'STRING' },
    ruling: { type: 'STRING' },
    lawsCited: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    }
  },
  required: ["title", "judgmentNumber", "courtName", "parties", "proceduralHistory", "facts", "reasons", "ruling", "lawsCited"]
};

let ai;

self.onmessage = async (event) => {
    const { type, payload } = event.data;
    if (type === 'INIT_ANALYZER') {
        ai = new GoogleGenAI({ apiKey: payload.apiKey });
    } else if (type === 'START_ANALYSIS' && ai) {
        const { cases } = payload;

        for (const caseItem of cases) {
            try {
                const prompt = `You are a Senior Saudi Legal Analyst. Analyze the following legal case text in its original Arabic language from Saudi Arabia. 
                Extract the specified information in JSON format.
                
                CRITICAL INSTRUCTION FOR TEXT FIELDS ('facts', 'reasons', 'ruling', 'proceduralHistory'):
                - You MUST use Markdown formatting to improve readability.
                - Use **bold** for key details: Party names, Dates (e.g., 1445/02/20), Monetary amounts (e.g., 50,000 SAR), and Court names.
                - Use bullet points (- ) for listing chronological events, arguments, or evidences.
                - Ensure the text is well-structured and easy to read.
                
                Case text: \n\n${caseItem.text}`;
                
                const response = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: prompt,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: ANALYSIS_SCHEMA,
                    },
                });
                
                const analysis = JSON.parse(response.text);
                const newRecord = { originalText: caseItem.text, analysis, timestamp: Date.now() };
                const newId = await putCaseInDB(newRecord);
                await addLogEntry('CASE_ANALYZED_BG', `Analyzed case from file ${caseItem.source}. New Case ID: ${newId}`);

                postProgress({ ...newRecord, id: newId });
            } catch (err) {
                console.error(`Service Worker: Failed to analyze case`, err);
            }
        }
    }
};

const postProgress = async (record) => {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    clients.forEach(client => client.postMessage({ type: 'ANALYSIS_PROGRESS', payload: { record } }));
};

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});