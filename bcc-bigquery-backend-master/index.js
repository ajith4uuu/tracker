import express from "express";
import cors from 'cors';
// import fs from 'fs';
// import multer from "multer";

import { URL_PREFIX, DATA_SET, QUESTIONS_TABLE, RESPONSES_TABLE, GStorage, FIREBASE_STORAGE_BUCKET } from './config.js';
import { errJsonResponse, BQExecuteQuery, fetchUserResponse, jsonMiddleware, successJsonResponse } from './scripts/functions.js';
import puppeteer from "puppeteer";
// import { readFile } from "xlsx";

/* const fileUpload = multer({
    dest: '/tmp',
}); */

const app = express();

app.use(cors());

// Parse JSON request data
app.use(express.json({
    limit: '100mb',
}));

// Custom Middleware to allow only JSON requests
app.use(URL_PREFIX, jsonMiddleware);

app.get(`${URL_PREFIX}/questions`, async (req, res) => {
    try {
        const query = `SELECT * FROM ${DATA_SET}.${QUESTIONS_TABLE} ORDER BY PageNo, FieldId`

        const rows = await BQExecuteQuery(query);

        successJsonResponse(res, rows);
    } catch(error) {
        console.error('Error when fetching data from BigQuery:', error);

        errJsonResponse(res, error.message);
    }
});

/* app.post(`${URL_PREFIX}/questions`, fileUpload.single('questions'), async (req, res) => {
    try {
        const date = new Date();

        const tempFile = req.file;
        const tempFilePath = tempFile.path;

        if (tempFile.originalname.endsWith('.xlsx')) {
            // readFile()
        }

        const nldJsonFile = `/tmp/questions.json`;
        const gsFileName = `questions-${Date.now()}.json`;

        fs.writeFileSync(nldJsonFile, JSON.parse(fs.readFileSync(tempFilePath)).map(q => JSON.stringify(q)).join('\n'));

        await GStorage.bucket('tracker-dev-react-ss-temp-bucket').upload(nldJsonFile, {
            destination: gsFileName
        });

        console.log('The JSON data uploaded to Google Storage.');

        // const [ insertJob ] = await BQ_CLIENT.dataset(DATA_SET).table(QUESTIONS_TABLE).insert(req.body.questions);
        const [ insertJob ] = await BQ_CLIENT.dataset(DATA_SET).table(QUESTIONS_TABLE).load(
            GStorage.bucket('tracker-dev-react-ss-temp-bucket').file(gsFileName),
            {
                sourceFormat: 'NEWLINE_DELIMITED_JSON',
            }
        );

        await insertJob.promise();

        successJsonResponse(res, null, 'The questions have been imported successfully.');
    } catch(error) {
        console.error('Error when uploading questions to BigQuery:', error);

        if (error.errors) {
            error.errors.forEach(e => {
                if (e.row.FieldId) console.error(e.row.FieldId);
                console.error(e.errors);
            })
        }

        errJsonResponse(res, error.message);
    }
}); */

app.post(`${URL_PREFIX}/responses`, async (req, res) => {
    try {
        let isInvalid = false;

        if (req.body) {
            if ('userId' in req.body && 'lang' in req.body && 'response' in req.body) {
                // TODO: Check user exists
            } else {
                isInvalid = true;
            }
        } else {
            isInvalid = true;
        }

        if (isInvalid) {
            return errJsonResponse(res, 'Invalid request.', null, 422);
        }

        // Put the columns & values which would be sent to BQ Dataset for both Insert & Update operations
        let dataToUpdate = {
            'LanguageChosen': req.body.lang,
            'ResponseJson': JSON.stringify(req.body.response),
            'IsSurveyCompleted': req.body.isCompeted || false,
            'LastUpdatedOn': new Date().toISOString().slice(0, 23),
        };
        let prevResponse = await fetchUserResponse(req.body.userId);

        if (!prevResponse) {
            // Put data that are to be passed only on insert operation
            dataToUpdate = {
                ...dataToUpdate,
                'RespondentId': req.body.userId,
                'FormId': '2',
            };
        }

        // console.log('prevResponse:', prevResponse);

        let successMsg = 'The response has been successfully stored!';
        let columns = {};

        // Format Column names & Bind params
         Object.keys(dataToUpdate).forEach(key => {
            let paramValue = `@${key}`;

            if (key === 'ResponseJson') {
                paramValue = `PARSE_JSON(@${key})`;
            } else if (key === 'LastUpdatedOn') {
                paramValue = `CURRENT_DATETIME()`;
            }

            columns[key] = paramValue;
        });

        if (prevResponse) {
            // console.log('Updating response...', dataToUpdate);

            // Update the responses of a User
            await BQExecuteQuery(`
                UPDATE
                    ${DATA_SET}.${RESPONSES_TABLE}
                SET
                    ${Object.keys(columns).map(k => `${k} = ${columns[k]}`).join(', ')}
                WHERE
                    RespondentId = @RespondentId
            `, {
                'RespondentId': req.body.userId,
                ...dataToUpdate
            });

            successMsg = 'The response has been successfully updated!';
        } else {
            // console.log('Inserting response...');

            // Insert the responses of a User
            await BQExecuteQuery(`
                INSERT INTO ${DATA_SET}.${RESPONSES_TABLE}
                    (${Object.keys(dataToUpdate).join(', ')})
                VALUES
                    (${Object.values(columns).join(', ')})
            `, {
                ...dataToUpdate
            });
        }

        successJsonResponse(res, null, successMsg);
    } catch(error) {
        console.error('Error when fetching data from BigQuery:', error);

        if (error.name === 'PartialFailureError') {
            let message = 'Error occurred with BigQuery!';

            // console.log(error.errors[0].errors);

            // Get the BQ validation error message
            if (error.errors && error.errors[0] && error.errors[0].errors && error.errors[0].errors[0] && error.errors[0].errors[0].message) {
                message = error.errors[0].errors[0].message;
            }

            errJsonResponse(res, message);
        } else {
            errJsonResponse(res, error.message);
        }
    }
});

app.get(`${URL_PREFIX}/responses/:userId`, async (req, res) => {
    try {
        successJsonResponse(res, await fetchUserResponse(req.params && req.params.userId ? req.params.userId : 0));
    } catch(error) {
        console.error('Error when fetching data from BigQuery:', error);

        errJsonResponse(res, error.message);
    }
});

app.post(`${URL_PREFIX}/responses/:userId/consent-form`, async (req, res) => {
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const pdfPage = await browser.newPage();
        const userId = req.params.userId;

        const consentQuestionsPages = [1, 2];

        const query = `SELECT * FROM ${DATA_SET}.${QUESTIONS_TABLE} WHERE PageNo IN (${consentQuestionsPages.join(', ')}) ORDER BY PageNo, FieldId`

        let htmlContent = ``;
        let questions = [
            ...await BQExecuteQuery(query),
        ];
        let userName = '', dateOfBirth = '';

        // console.log('questions:', questions);

        // console.log('req.body.responses:', req.body.responses);

        const reqJson = typeof(req.body.responses) === 'string' ? JSON.parse(req.body.responses) : req.body.responses;

        // console.log('reqJson:', reqJson);

        let responses = {};

        for (const rI in reqJson) {
            responses[`q-${reqJson[rI].id}`] = reqJson[rI].value;
        }

        // console.log('responses:', responses);

        const storageBucket = GStorage.bucket(FIREBASE_STORAGE_BUCKET);

        for (const qI in questions) {
            const question = questions[qI];

            let qHtmlContent = `${question.Question_En}`;
            let value = responses[`q-${question.FieldId}`] ?? '';

            if (!qHtmlContent.startsWith('<')) {
                qHtmlContent = `<p>${qHtmlContent}</p>`;
            }

            // console.log('question.FieldId:', question.FieldId);
            // console.log('question.Question_En:', question.Question_En, '\n');
            // console.log('value:', value, '\n');

            switch(question.FieldType) {
                case 'heading':
                    qHtmlContent = `<h3>${qHtmlContent}</h3>`;
                    break;
                case 'descriptive':
                    qHtmlContent = `<p>${qHtmlContent}</p>`;
                    break;
                case 'radio':
                    if (value) {
                        // Show the selected choice for the radio fields
                        let radioSplit = question.Choices_En.split('||');
                        let radioChoiceContent;

                        for (let i in radioSplit) {
                            if (radioSplit[i].indexOf(`${value}|`) > -1) {
                                radioChoiceContent = radioSplit[i].split('|')[1].trim();

                                break
                            }
                        }

                        if (radioChoiceContent) {
                            qHtmlContent += `<p><span class="checkbox"></span> ${radioChoiceContent}</p>`;
                        } else {
                            qHtmlContent = null;
                        }
                    } else {
                        qHtmlContent = null;
                    }

                    break;
                case 'checkbox':
                    if (value) {
                        qHtmlContent = `<p><span class="checkbox"></span> ${question.Question_En}</p>`;
                    }

                    break;
                case 'file':
                case 'signature':
                case 'sign':
                    if (value) {
                        const file = storageBucket.file(value);

                        const [ buffer ] = await file.download();

                        qHtmlContent += `<p><img src="data:image/png;base64,${buffer.toString('base64')}" /></p>`;
                    }

                    break;
                default:
                    if (value) {
                        // Get user details from the respective fields' responses
                        if (question.FieldName === 'pt_firstname') {
                            userName = value;
                        } else if (question.FieldName === 'pt_lastname') {
                            if (userName) {
                                userName += ` ${value}`;
                            }
                        } else if (question.FieldName === 'pt_dob') {
                            dateOfBirth = value;
                        }

                        qHtmlContent += `<p>${value}</p>`;
                    } else {
                        qHtmlContent += `<p></p>`;
                    }
            }

            if (qHtmlContent) {
                // console.log('qHtmlContent:', qHtmlContent);
                if (!['heading', 'descriptive', 'checkbox', 'radio'].includes(question.FieldType)) {
                    qHtmlContent = `<div class="question-field-col-struct">${qHtmlContent}</div>`;
                }

                htmlContent += `${qHtmlContent}<br /><hr />`;
            }
        }

        // console.log('htmlContent:', htmlContent);

        htmlContent = `
            <html>
                <head>
                    <style type="text/css">
                        @font-face {
                            font-family: 'Montserrat';
                            src: url('/assets/fonts/Montserrat-VariableFont_wght.ttf') format('truetype');
                            font-weight: normal;
                            font-style: normal;
                        }

                        body {
                            font-family: 'Montserrat';
                        }

                        .question-field-col-struct {
                            display: flex;
                            justify-content: center;
                        }

                        .question-field-col-struct > p {
                            width: 50%;
                            float: left;
                        }

                        .checkbox {
                            width: 1em;
                            height: 1em;
                            display: inline-block;
                            position: relative;
                            border: 0.1em solid #000;
                            margin-right: 1em;
                            border-radius: 0.2em;
                        }

                        .checkbox::before {
                            content: '';
                            display: block;
                            width: 75%;
                            height: 150%;
                            border: solid #000;
                            border-width: 0 0.15em 0.15em 0;
                            transform: rotate(45deg);
                            position: absolute;
                            left: 50%;
                            top: -70%;
                            border-bottom-left-radius: 0.15em;
                            border-top-right-radius: 0.15em;
                        }
                    </style>
                </head>
                <body>${htmlContent}</body>
            </html>
        `.trim();

        console.log('htmlContent:', htmlContent);

        // console.log('Setting HTML content...');

        await pdfPage.setContent(htmlContent);

        // console.log('Creating PDF...');

        const pdfBuffer = await pdfPage.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '15mm',
                right: '10mm',
                bottom: '15mm',
                left: '10mm',
            },
            displayHeaderFooter: true,
            headerTemplate: `
                <div style="font-size: 10px; width: 100%; text-align: right; padding: 15px 10mm;">
                    <div>Page <span class="pageNumber"></span>
                </div>
            `.trim(),
            footerTemplate: `
                <div style="font-size: 10px; width: 100%; display: flex; justify-content: space-between; padding: 15px 10mm;">
                    <div>${new Date().toLocaleString()}</div>
                    <div>${[userName, dateOfBirth].join(', ')}</div>
                    <div><b>PROgress Tracker Survey</b></div>
                </div>
            `.trim(),
        });

        // console.log('Closing the browser...');

        await browser.close();

        const userConsentPath = `consent-pdfs/${userId}`;
        const consentFileName = `Consent-${Date.now()}.pdf"`;

        if (!req.body.downloadFile) {
            const [ oldConsentFiles ] = await storageBucket.getFiles({
                prefix: userConsentPath,
            });

            // Delete old files
            await Promise.all(oldConsentFiles.map(file => file.delete()));

            const consentFilePath = `${userConsentPath}/${consentFileName}`;
            const consentFileRef = storageBucket.file(consentFilePath);

            // Store the consent file of the user to Cloud Storage
            await consentFileRef.save(pdfBuffer, {
                'contentType': 'application/pdf',
                resumable: false
            });

            return successJsonResponse(res, {
                'consentFile': consentFilePath
            });
        }

        // console.log('Returning the PDF...');

        res.setHeader('Content-Type', 'application/pdf');

        res.setHeader('Content-Disposition', `inline; filename="${consentFileName}"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        return res.status(200).send(pdfBuffer);
    } catch(error) {
        console.error('Error when generating consent PDF:', error);

        errJsonResponse(res, error.message);
    }
});

export const bigQueryBackend = app;
