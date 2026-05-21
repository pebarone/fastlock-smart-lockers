import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env";
import { resolveFromBackendRoot } from "../config/runtime-paths";

const frontendRoots = [
  resolveFromBackendRoot("public"),
  resolveFromBackendRoot("../frontend/dist")
];

function shouldServeSpa(pathname: string): boolean {
  if (!pathname || pathname === "/") {
    return true;
  }

  return !pathname.startsWith("/api") &&
    !pathname.startsWith("/api-docs") &&
    !pathname.startsWith("/assets/") &&
    !path.extname(pathname);
}

export async function registerFrontend(app: FastifyInstance) {
  let frontendDistRoot: string | null = null;

  for (const candidateRoot of frontendRoots) {
    const candidateIndexPath = path.join(candidateRoot, "index.html");
    const candidateAssetsRoot = path.join(candidateRoot, "assets");

    try {
      await Promise.all([access(candidateIndexPath), access(candidateAssetsRoot)]);
      frontendDistRoot = candidateRoot;
      break;
    } catch {
      continue;
    }
  }

  if (!frontendDistRoot) {
    app.log.info({ frontendRoots }, "Frontend bundle not found; skipping static hosting");
    return;
  }

  const assetsRoot = path.join(frontendDistRoot, "assets");
  const indexPath = path.join(frontendDistRoot, "index.html");
  const appConfigScript = `window.__APP_CONFIG__ = ${JSON.stringify({
    apiBaseUrl: "/api",
    supabaseUrl: env.SUPABASE_URL,
    supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY,
    supabaseOAuthProvider: process.env.SUPABASE_OAUTH_PROVIDER?.trim() || "google"
  })};`;
  const readIndexHtml = async () => readFile(indexPath, "utf8");

  await app.register(fastifyStatic, {
    root: assetsRoot,
    prefix: "/assets/",
    decorateReply: false,
    cacheControl: true,
    immutable: true,
    maxAge: "30d"
  });

  app.get("/app-config.js", async (_request, reply) => {
    reply.header("Cache-Control", "no-cache, no-store, must-revalidate");
    return reply.type("application/javascript; charset=utf-8").send(appConfigScript);
  });

  app.get("/", async (_request, reply) => {
    reply.header("Cache-Control", "no-cache");
    return reply.type("text/html; charset=utf-8").send(await readIndexHtml());
  });

  app.setNotFoundHandler(async (request, reply) => {
    const pathname = request.url.split("?")[0] || "/";

    if (request.method === "GET" && shouldServeSpa(pathname)) {
      reply.header("Cache-Control", "no-cache");
      return reply.type("text/html; charset=utf-8").send(await readIndexHtml());
    }

    return reply.code(404).send({
      message: "Route not found"
    });
  });

  app.log.info({ frontendDistRoot }, "Frontend static hosting enabled");
}
