import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerLineRoutes } from "./lineAuth";
import { registerStorageProxy } from "./storageProxy";
import { registerEvaluateStream } from "../routes/evaluate-stream";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  const defaultAllowedOrigins = [
    "https://aiteammate9-rgb.github.io",
    "https://aiteammate9-rgb.github.io/fashion-pricing-demo",
    "http://localhost:5173",
    "http://localhost:3000",
  ];
  const configuredOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredOrigins]);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.has(origin) || process.env.CORS_ORIGINS === "*")) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "86400");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "fashion-pricing-demo",
      capabilities: {
        openaiCompatible: Boolean(ENV.openaiApiKey || ENV.forgeApiKey),
        googleVision: Boolean(ENV.googleAiApiKey),
        anthropicVision: Boolean(ENV.anthropicApiKey),
        retailedMarket: Boolean(ENV.retailedApiKey),
        multiAgentReady: Boolean((ENV.openaiApiKey || ENV.forgeApiKey) && ENV.googleAiApiKey && ENV.anthropicApiKey),
        marketReady: Boolean(ENV.retailedApiKey),
      },
    });
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerLineRoutes(app);
  registerEvaluateStream(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
