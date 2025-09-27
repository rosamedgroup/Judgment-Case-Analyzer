/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI } from 'https://esm.sh/@google/genai@^0.7.0';

const DB_NAME = 'JudgmentCaseDB';
const DB_VERSION = 3;
const STORE_NAME = 'cases';
const LOG_STORE_NAME = 'audit_logs';

// Replicating the Type enum needed by the schema converter
const Type = {
    TYPE_UNSPECIFIED: 'TYPE_UNSPECIFIED',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    INTEGER: 'INTEGER',
    BOOLEAN: 'BOOLEAN',
    ARRAY: 'ARRAY',
    OBJECT: 'OBJECT',
    NULL: 'NULL'
};

const openDB = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    // Upgrades are handled by the main thread, so onupgradeneeded is not required here.
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

const convertEditableSchemaToGemini = (editableSchema) => {
    const properties = editableSchema.reduce((acc, field) => {
        if (field.name.trim()) {
            acc[field.name.trim()] = {
                type: field.type,
                description: field.description,
                nullable: field.nullable
            };
            if (field.type === Type.ARRAY) {
                (acc[field.name.trim()]).items = { type: Type.STRING };
            }
        }
        return acc;
    }, {});
    return { type: Type.OBJECT, properties };
};

const classifyError = (err, rawResponse, errorTemplates) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    // Simplified classification for the background task as detailed info is in the main thread
    return {
        title: errorTemplates.title,
        message: errorTemplates.message(errorMessage),
        suggestion: errorTemplates.suggestion,
        raw: rawResponse || errorMessage,
    };
};

let ai;

self.onmessage = async (event) => {
    const { type, payload } = event.data;
    if (type === 'INIT_ANALYZER') {
        ai = new GoogleGenAI({ apiKey: payload.apiKey });
        console.log('Service Worker: Gemini Initialized.');
    } else if (type === 'START_ANALYSIS' && ai) {
        console.log('Service Worker: Received analysis job.');
        const { cases, schema, placeholderRecords, errorTemplates } = payload;
        const geminiSchema = convertEditableSchemaToGemini(schema);

        for (const [index, caseItem] of cases.entries()) {
            const placeholder = placeholderRecords[placeholderRecords.length - 1 - index];
            let rawResponseText;

            try {
                const prompt = `Analyze the following legal case text in its original Arabic language from Saudi Arabia and extract the specified information in JSON format according to the provided schema. For any fields that expect long-form text (like facts, reasons, rulings), use simple markdown for formatting: use '**text**' for bolding, '*text*' for italics, '~~text~~' for strikethrough, start lines with '* ' for bullet points, '1. ' for numbered lists, and use Markdown tables for tabular data. If a field is not present in the text, use null for its value. Here is the case text: \n\n${caseItem.text}`;
                
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
                const newRecord = { originalText: caseItem.text, analysis, timestamp: Date.now(), tags: [] };
                const newId = await putCaseInDB(newRecord);
                await addLogEntry('CASE_ANALYZED_BG', `Analyzed case from file ${caseItem.source}. New Case ID: ${newId}`);

                postProgress({ ...newRecord, id: newId, loading: false }, placeholder.timestamp);
            } catch (err) {
                console.error(`Service Worker: Failed to analyze case from ${caseItem.source}:`, err);
                const classifiedError = classifyError(err, rawResponseText, errorTemplates);
                const errorRecord = { ...placeholder, originalText: caseItem.text, loading: false, error: classifiedError };
                const newId = await putCaseInDB(errorRecord);

                postProgress({ ...errorRecord, id: newId }, placeholder.timestamp);
            }
        }
        postComplete();
    }
};

const postProgress = async (record, placeholderTimestamp) => {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    clients.forEach(client => client.postMessage({ type: 'ANALYSIS_PROGRESS', payload: { record, placeholderTimestamp } }));
};

const postComplete = async () => {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    clients.forEach(client => client.postMessage({ type: 'ANALYSIS_COMPLETE' }));
};

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});