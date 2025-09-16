import axios from 'axios';
import type { ResponseType as AxiosResponseType } from 'axios';
import { getFirestoreBatch, getFirestoreDoc, questionsCollectionID, sanitizeObj, settingsCollectionID, settingsDocID } from './firestoreService';
import { consoleError, consoleLog } from './utils';

function bqBackendURL(path: string) {
    return import.meta.env.VITE_BQ_BACKEND_API_ENDPOINT.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
}

async function requestBQBackend(path: string, method: string, reqData: any, respType: AxiosResponseType = 'json') {
    try {
        const response = await axios.request({
            url: bqBackendURL(path),
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            data: reqData,
            responseType: respType,
        });

        consoleLog('[requestBQBackend] response:', response);

        let success = false, respData = null;

        if (response) {
            consoleLog('[requestBQBackend] response:', response);

            if (respType !== 'json') {

                if (respType === 'blob') {
                    let fileName;
                    const disposition = response.headers['content-disposition'];

                    if (disposition && disposition.indexOf('attachment') !== -1) {
                        const filenameMatch = disposition.match(/filename="?(.+)"?/);

                        if (filenameMatch.length === 2) {
                            fileName = filenameMatch[1];
                        }
                    }

                    return [fileName, response.data];
                }

                return response.data;
            }

            if (response.data) {
                success = response.data.success;
                respData = response.data.data;
            }
        }

        return [success, respData];
    } catch(error) {
        consoleError('[requestBQBackend] Error occurred:', error);

        return null;
    }
}

export async function BQFetchQuestions() {
    let response = await requestBQBackend('/questions', 'GET', null);

    consoleLog('[BQFetchQuestions] response:', response);

    if (response) {
        let [ success, data ] = response;

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

    if (questions) {
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
}

export async function BQGenerateConsentPDFForUser(userId: any, responses: any) {
    return await requestBQBackend(`/responses/${userId}/consent-form`, 'POST', {
        'responses': responses,
    });
}
