# POC Register

This is a POC for the new BCC registration portal.

## File Structure

- `app/router.ts` - App router configurations
- `app/components/ui/` - Reusable UI components
- `app/components/data/` - Data fetching helper scripts
- `app/lib/` - Non-**NPM** libraries
- `app/views/` - Files/Folders for each pages

## Dev Environment Setup

1. Clone the project

2. Run `npm install`

3. Run `npm run dev` to start development server

4. Run `npm run build` to build for production

## References

- **React**: https://reactrouter.com/start/framework/routing
- **CSS**: https://bulma.io/documentation
- **Google Cloud Hosting**: https://blog.devops.dev/from-code-to-cloud-deploy-your-react-application-to-cloud-run-0a77d9a7bd84

## Google Cloud Deployment

### Instructions

1. Initialize **gcloud** command line utility:

    `gcloud init`

2. Ensures your local Docker can push to GCP registries (only once):

    `gcloud auth configure-docker`

3. Enable Cloud Run & Cloud Build APIs in the project (only once):

    `gcloud services enable run.googleapis.com artifactregistry.googleapis.com`

4. Create an Artifact Registry repository (only once):

    `gcloud artifacts repositories create {NAME FOR DOCKER REPO} --repository-format=docker --location={REGION} --description="Docker repo for Cloud run"`

5. Build Docker image locally:

    `docker build -t {REGION}-docker.pkg.dev/{PROJECT ID}/{DOCKER REPO NAME}/poc-register:latest .`

6. Push the Docker image to GCP:

    `docker push {REGION}-docker.pkg.dev/{PROJECT ID}/{DOCKER REPO NAME}/poc-register:latest`

7. Deploy to Cloud Run:

    `gcloud run deploy poc-register --image {REGION}-docker.pkg.dev/{PROJECT ID}/{DOCKER REPO NAME}/poc-register:latest --platform managed --region {REGION} --allow-unauthenticated --port 80`

- If facing "Reauthentication failed" error, try logging in again:

    `gcloud login`
