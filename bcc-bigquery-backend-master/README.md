# BCC Backend

Connector for BigQuery and React BCC front-end

## Dev Setup

- `npm install`

- `node scripts/localRun.js`

- `gcloud auth login`

- Authenticate the Cloud Function Node.js App to use GCP services:

    `gcloud auth application-default login`

## Deploy

1. Login to your Progress tracker Google account:

    `gcloud auth login`

2. Ensures your local Docker can push to GCP registries (only once):

    `gcloud auth configure-docker`

3. Enable Cloud Run & Cloud Build APIs in the project (only once):

    `gcloud services enable run.googleapis.com artifactregistry.googleapis.com`

4. Create an Artifact Registry repository (only once):

    `gcloud artifacts repositories create bq-backend-repo --repository-format=docker --location={REGION} --description="Docker repo for Cloud run"`

5. Build Docker image locally:

    `docker build -t {REGION}-docker.pkg.dev/{PROJECT ID}/bq-backend-repo/bq-backend:latest .`

6. Push the Docker image to GCP:

    `docker push {REGION}-docker.pkg.dev/{PROJECT ID}/bq-backend-repo/bq-backend:latest`

7. Deploy to Cloud Run:

    `gcloud run deploy bq-backend --image {REGION}-docker.pkg.dev/{PROJECT ID}/bq-backend-repo/bq-backend:latest --platform managed --region {REGION} --allow-unauthenticated --set-env-vars NODE_ENV=production`
