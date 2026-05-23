# Fashion Pricing Demo — Permanent Website Deployment Guide

This repository has been prepared for permanent deployment as a **full-stack website**. The app is not a static-only site because it includes an Express backend, tRPC routes, AI evaluation endpoints, optional database storage, and optional external pricing APIs. Therefore, it should be deployed on a host that can run a long-lived Node.js web service or Docker container.

## Recommended Production Path

The fastest practical path is to deploy this repository through a managed web-service host that supports Docker builds from GitHub. This repository now includes a `Dockerfile`, `.dockerignore`, `render.yaml`, `/health` endpoint, `.env.example`, and runtime fixes for AI and OAuth fallback.

| Approach | Tradeoffs | Cost | Setup Complexity |
| --- | --- | --- | --- |
| Managed web-service deployment from GitHub using `render.yaml` | Best balance for this project because it runs the backend and frontend together, supports environment variables, and can auto-deploy from the GitHub repository. | Depends on the selected hosting plan. A paid always-on plan is recommended for a production demo. | Low to medium. Connect GitHub, select the blueprint, and add required secrets. |
| Container deployment on any VPS or cloud server | Most flexible and suitable if you want full server control, custom domains, logs, and future background workers. | Depends on the server provider. | Medium. You need server provisioning, Docker, reverse proxy, TLS, and monitoring. |
| Static hosting only | Not recommended for the current product because API routes and AI functions need a backend process. | Often low. | Low, but it would require disabling or rewriting backend features. |

## Files Added or Updated

| File | Purpose |
| --- | --- |
| `Dockerfile` | Builds and runs the full-stack production app in a Node 22 container. |
| `.dockerignore` | Keeps build context clean and prevents local secrets from entering the image. |
| `render.yaml` | Defines a managed web service with Docker runtime, health check, auto-deploy, and environment variables. |
| `.env.example` | Documents required and optional production environment variables. |
| `server/_core/index.ts` | Adds a `/health` endpoint for production monitoring. |
| `package.json` | Adds Node and pnpm engine constraints for predictable hosting builds. |
| `client/src/const.ts` | Keeps the demo from crashing when OAuth variables are not configured. |
| `server/_core/llm.ts` | Allows AI calls to use standard `OPENAI_API_KEY` when internal Forge credentials are unavailable. |

## Required Environment Variables

At minimum, configure the following variables on the permanent host.

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Recommended | Enables AI-assisted captions and evaluation fallback. Without it, AI features may fail or fall back depending on route logic. |
| `JWT_SECRET` | Required for production auth/session safety | Used for secure signed cookies or tokens. Use a long random value. |
| `NODE_ENV` | Required | Set to `production`. |

The following variables are optional for a richer production version.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Optional but recommended | Enables persistent data storage if the app is configured to use the database path. |
| `RETAILED_API_KEY` | Optional | Enables external retail/market pricing enrichment. |
| `ANTHROPIC_API_KEY` | Optional | Enables additional AI-provider consensus if the corresponding routes are used. |
| `GOOGLE_AI_API_KEY` | Optional | Enables additional AI-provider consensus if the corresponding routes are used. |
| `VITE_APP_ID` | Optional | Used for production OAuth/app identity flows. |
| `OAUTH_SERVER_URL` | Optional | Used for production OAuth login integration. |
| `OWNER_OPEN_ID` | Optional | Used for owner/admin identity configuration. |

## Deploy via Managed Web-Service Host

1. Push this repository to GitHub after committing the deployment files.
2. Open the hosting provider and create a new service from the GitHub repository.
3. Choose the repository `aiteammate9-rgb/fashion-pricing-demo`.
4. Use the blueprint/config file if the platform supports it; this repository includes `render.yaml`.
5. Add the environment variables from `.env.example`.
6. Deploy the service.
7. Open `/health` after deployment. A healthy response should look like:

```json
{"status":"ok","service":"fashion-pricing-demo"}
```

8. Open the root URL `/` and test the upload, pricing, and AI caption/evaluation flows.

## Deploy on Any Docker Server

If deploying manually to a server with Docker installed, use the following commands after cloning the repository.

```bash
git clone https://github.com/aiteammate9-rgb/fashion-pricing-demo.git
cd fashion-pricing-demo
cp .env.example .env
# edit .env and add production values

docker build -t fashion-pricing-demo .
docker run -d \
  --name fashion-pricing-demo \
  --restart unless-stopped \
  --env-file .env \
  -p 3000:3000 \
  fashion-pricing-demo
```

A reverse proxy such as Nginx or Caddy should then route your custom domain to `localhost:3000` and provide TLS.

## Production Notes

For a real public launch, the next improvements should be prioritized in this order. First, configure a persistent database and storage layer so scan history, wardrobe data, and future marketplace data survive redeploys. Second, configure OAuth and a production domain. Third, add rate limiting, logging, and abuse controls for image upload and AI API usage. Fourth, connect a custom domain and verify the app through an end-to-end user journey.

## References

[1]: https://render.com/docs/blueprint-spec "Render Blueprint Specification"
[2]: https://docs.docker.com/build/concepts/dockerfile/ "Dockerfile overview"
[3]: https://nodejs.org/en/about/previous-releases "Node.js previous releases"
