import { BigQuery } from "@google-cloud/bigquery";
import { Storage } from "@google-cloud/storage";

import { configDotenv } from "dotenv";

configDotenv({
    path: `.env.${process.env.NODE_ENV}`
});

// BigQuery Dataset name
export const DATA_SET = process.env.BQ_DATASET;

// Table where Questions are stored
export const QUESTIONS_TABLE = process.env.BQ_QUESTIONS_TABLE;

// Table where Responses are stored
export const RESPONSES_TABLE = process.env.BQ_RESPONSES_TABLE;

// The prefix will be added before every endpoints
export const URL_PREFIX = process.env.URL_PREFIX;

export const FIREBASE_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET;

// Initialize BigQuery client instance
export const BQ_CLIENT = new BigQuery();
export const GStorage = new Storage();
