import { BQ_CLIENT, DATA_SET, RESPONSES_TABLE } from "../config.js";

export function jsonMiddleware(req, res, next) {
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        return res.status(204).send('');
    }

    let isInvalid = false;
    let message = 'Invalid request.';

    // Check only needed headers for each request methods
    if (req.method === 'POST') {
        if (['/questions'].includes(req.path)) {
            if (!(req.get('Content-Type') ?? '').includes('multipart/form-data')) {
                isInvalid = true;
            }
        } else if (!(req.get('Content-Type') ?? '').includes('application/json')) {
            isInvalid = true;
        }
    }

    // TODO: Check Authentication

    if (isInvalid) {
        return errJsonResponse(res, message, null, 400);
    }

    next();
}

// Use this function to query the BigQueryDataset
export async function BQExecuteQuery(query, params = null, paramTypes = null) {
    // console.log('executing', query, params);

    const [ rows ] = await BQ_CLIENT.query({
        'query': query,
        'params': params,
        'types': paramTypes,
    });

    return rows;
}

// Use this function to return JSON response in each endpoints
export function jsonResponse(res, success, message, data, code) {
    let jsonData = {
        'success': success,
        'message': message,
        'data': data,
    };

    if (success && !message) {
        delete jsonData['message'];
    } else if (!success && !data) {
        delete jsonData['data'];
    }

    res.status(code).json(jsonData);
}

// Use this function to return failure response
export function errJsonResponse(res, message, data = null, code = 500) {
    jsonResponse(res, false, message, data, code);
}

// Use this function to return success response
export function successJsonResponse(res, data, message = null) {
    jsonResponse(res, true, message, data, 200);
}

// Use this function to get the responses of a user from BigQuery Dataset
export async function fetchUserResponse(userId) {
    let params = {
        'userId': (userId || 0),
    };
    let paramTypes = {
        'userId': 'INT64',
    };

    const query = `
        SELECT
            *
        FROM
            ${DATA_SET}.${RESPONSES_TABLE}
        WHERE
            RespondentId = @userId
    `;

    const rows = await BQExecuteQuery(query, params, paramTypes);

    return rows && rows.length > 0 ? rows[0] : null;
}
