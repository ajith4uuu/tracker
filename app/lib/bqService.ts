import axios from 'axios';
import type { ResponseType as AxiosResponseType } from 'axios';
import { getFirestoreBatch, getFirestoreDoc, questionsCollectionID, sanitizeObj, settingsCollectionID, settingsDocID } from './firestoreService';
import { consoleError, consoleLog } from './utils';

function bqBackendURL(path: string) {
    // Always hit server proxy; server will forward to Cloud Run using env
    const origin = '/api/bq';
    return origin.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
}

async function requestBQBackend(path: string, method: string, reqData: any, respType: AxiosResponseType = 'json') {
    const url = bqBackendURL(path);
    try {
        const maxAttempts = 2;
        let attempt = 0;
        let lastErr: any = null;

        while (attempt <= maxAttempts) {
            try {
                const response = await axios.request({
                    url,
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    data: reqData,
                    responseType: respType,
                    timeout: 10000,
                });

                consoleLog('[requestBQBackend] response URL:', url, 'status:', response.status, 'attempt:', attempt);

                if (respType !== 'json') {
                    if (respType === 'blob') {
                        let fileName;
                        const disposition = response.headers['content-disposition'];

                        if (disposition && disposition.indexOf('attachment') !== -1) {
                            const filenameMatch = disposition.match(/filename="?(.+)"?/);

                            if (filenameMatch && filenameMatch.length === 2) {
                                fileName = filenameMatch[1];
                            }
                        }

                        return [fileName, response.data];
                    }

                    return response.data;
                }

                // Flexible parsing: accept {success,data}, array payloads, or {questions:[...]}
                const body = response.data;
                let success = false, respData = null;
                if (typeof body?.success !== 'undefined') {
                    success = !!body.success;
                    respData = typeof body?.data !== 'undefined' ? body.data : body?.questions ?? null;
                } else if (Array.isArray(body)) {
                    success = true;
                    respData = body;
                } else if (Array.isArray(body?.questions)) {
                    success = true;
                    respData = body.questions;
                } else if (body && (response.status >= 200 && response.status < 300)) {
                    success = true;
                    respData = body;
                }

                return [success, respData];
            } catch (err: any) {
                lastErr = err;
                // If it's a 5xx or 502 transient error, retry after a small backoff
                const status = err?.response?.status;
                consoleError('[requestBQBackend] attempt error:', attempt, status, err?.message || err);
                if (status && status >= 500 && attempt < maxAttempts) {
                    const waitMs = 300 * Math.pow(2, attempt);
                    await new Promise(res => setTimeout(res, waitMs));
                    attempt++;
                    continue;
                }
                // otherwise break and let outer handler proceed
                break;
            }
        }

        // fallthrough to existing error handling
        throw lastErr || new Error('Unknown request error');
    } catch(error: any) {
        consoleError('[requestBQBackend] Error occurred:', error);

        // If the error has an HTTP response (non-2xx), try to extract the body
        // and return a structured result so callers can handle it instead of
        // letting Axios throw an exception to the console.
        try {
            const errResp = error?.response;
            if (errResp) {
                const body = errResp.data;
                consoleError('[requestBQBackend] upstream response body:', body);
                // normalize common shapes
                if (Array.isArray(body)) return [false, body];
                if (body && Array.isArray(body.questions)) return [false, body.questions];
                if (body && typeof body.data !== 'undefined') return [false, body.data];
                return [false, body];
            }
        } catch (e) {
            // ignore parsing errors
        }

        // try direct backend if configured (client-side fallback)
        try {
            const directBase = (import.meta as any)?.env?.VITE_BQ_BACKEND_API_ENDPOINT;
            if (directBase && String(directBase).trim()) {
                const directUrl = directBase.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
                consoleLog('[requestBQBackend] trying direct backend:', directUrl);
                const directResp = await axios.request({ url: directUrl, method, data: reqData, headers: { 'Accept': 'application/json' }, timeout: 10000 });
                const body = directResp.data;
                if (Array.isArray(body)) return [true, body];
                if (body && Array.isArray(body.questions)) return [true, body.questions];
                if (body && typeof body.success !== 'undefined') return [!!body.success, body.data ?? null];
                return [directResp.status >= 200 && directResp.status < 300, body];
            }
        } catch (e: any) {
            consoleError('[requestBQBackend] direct backend attempt failed:', e);
        }

        // return a structured empty response so callers can gracefully fallback
        return [false, null];
    }
}

export async function BQFetchQuestions() {
    let response = await requestBQBackend('/questions', 'GET', null);

    consoleLog('[BQFetchQuestions] response:', response);

    if (response) {
        let [ success, data ] = response;

        // If the backend returned an array payload even with success=false,
        // accept it so callers can use available data instead of failing.
        if (Array.isArray(data) && data.length > 0) return data;

        return success ? data : null;
    }

    return null;
}

export async function BQFetchResponseOfUser(userId: any) {
    return await requestBQBackend(`/responses/${userId}`, 'GET', null);
}

export async function BQStoreResponseOfUser(userId: any, lang: string, response: any) {
    return await requestBQBackend(`/responses`, 'POST', {
        'userId': userId,
        'lang': lang,
        'response': response,
        'updated_at': new Date().toISOString(),
    });
}

export async function BQLoadQuestionsIntoFirestore(userId: any) {
    const questions = await BQFetchQuestions();

    consoleLog('questions from BQ:', questions);

    if (!questions || (Array.isArray(questions) && questions.length === 0)) {
        throw new Error('BQ backend returned no questions');
    }

    const batch = getFirestoreBatch();
    let totalPages = 0;

    questions.forEach((q: any) => {
        let qId = `${q.FieldId}`;
        let qContent = {
            'id': q.FieldId,
            'sequence': q.Sequence,
            'page': q.PageNo,
            'name': q.FieldName,
            'label_en': q.Question_En,
            'label_fr': q.Question_Fr,
            'type': q.FieldType,
            'choices_en': q.Choices_En,
            'choices_fr': q.Choices_Fr,
            'is_required': q.IsRequired,
            'charLimit': q.CharLimit,
            'format': q.Format,
            'displayCondition': q.DisplayCondition,
        };

        consoleLog('question', qId, qContent);

        batch.set(getFirestoreDoc(questionsCollectionID(userId), qId), sanitizeObj(qContent));

        if (q.PageNo && !isNaN(q.PageNo)) {
            totalPages = Math.max(totalPages, q.PageNo);
        }
    });

    batch.set(getFirestoreDoc(settingsCollectionID(userId), 'values'), {
        totalPages
    }, {
        merge: true
    });

    await batch.commit();
}

export async function BQGenerateConsentPDFForUser(userId: any, responses: any) {
    return await requestBQBackend(`/responses/${userId}/consent-form`, 'POST', {
        'responses': responses,
    });
}
