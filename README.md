# Fashion Pricing Demo

Fashion Pricing Demo is a full-stack AI-assisted fashion resale pricing application. It combines a Vite/React frontend with an Express/tRPC backend and supports AI-powered product evaluation, caption generation, pricing history, and wardrobe workflows.

## Permanent Deployment

This repository has been prepared for production-style deployment as a permanent website. It includes Docker support, a managed-host blueprint, production environment documentation, and a health check endpoint.

Start here: [DEPLOYMENT.md](./DEPLOYMENT.md)

### Quick Deploy Checklist

| Step | Action |
| --- | --- |
| 1 | Connect this GitHub repository to a managed web-service host that can run Docker. |
| 2 | Use the included `render.yaml` or `Dockerfile`. |
| 3 | Add production environment variables from `.env.example`. |
| 4 | Deploy and verify `/health`. |
| 5 | Open the root URL and test image upload, pricing, and AI workflows. |

## Local Development

```bash
pnpm install
pnpm dev
```

## Production Build

```bash
pnpm check
pnpm build
pnpm start
```

## References

[1]: https://render.com/docs/blueprint-spec "Render Blueprint Specification"
[2]: https://docs.docker.com/build/concepts/dockerfile/ "Dockerfile overview"
