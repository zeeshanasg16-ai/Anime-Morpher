import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In production the API also serves the built React frontend so a single
// service answers both `/api/*` and the SPA. `__dirname` (provided at runtime
// by the esbuild banner) points at artifacts/api-server/dist, so the client
// build lives two levels up under anime-morph/dist/public.
if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(
    __dirname,
    "..",
    "..",
    "anime-morph",
    "dist",
    "public",
  );

  if (fs.existsSync(path.join(clientDist, "index.html"))) {
    app.use(
      express.static(clientDist, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html")) {
            // Never cache the app shell so a deploy's new asset hashes are picked up.
            res.setHeader("Cache-Control", "no-cache");
          } else {
            // Vite emits content-hashed asset filenames, safe to cache forever.
            res.setHeader(
              "Cache-Control",
              "public, max-age=31536000, immutable",
            );
          }
        },
      }),
    );

    // SPA fallback: any non-API GET/HEAD returns index.html so client-side
    // routing works on the root, deep links, and refreshes. A middleware (not a
    // wildcard route) is used because Express 5's `/*splat` does not match the
    // bare root path `/`.
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      if (req.path === "/api" || req.path.startsWith("/api/")) {
        next();
        return;
      }
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(clientDist, "index.html"));
    });

    logger.info({ clientDist }, "Serving frontend static build");
  } else {
    logger.warn(
      { clientDist },
      "Frontend build not found; serving API only",
    );
  }
}

export default app;
