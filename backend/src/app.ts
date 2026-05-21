import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { env, parseCorsOrigin } from "./config/env";
import { getBackendRoot } from "./config/runtime-paths";
import { handleFastifyError } from "./errors";
import { registerFrontend } from "./http/register-frontend";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { lockersRoutes } from "./modules/lockers/lockers.routes";
import { locationsRoutes } from "./modules/locations/locations.routes";
import { organizationsRoutes } from "./modules/organizations/organizations.routes";
import { rentalsRoutes } from "./modules/rentals/rentals.routes";
import { unlockRoutes } from "./modules/unlock/unlock.routes";

type HelmetDirectiveValue =
  ReturnType<typeof helmet.contentSecurityPolicy.getDefaultDirectives>[string] extends Iterable<infer T> ? T : never;

function resolveOrigin(url: string): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function asDirectiveArray(
  value: Iterable<HelmetDirectiveValue> | null | undefined
): HelmetDirectiveValue[] {
  return value ? Array.from(value) : [];
}

export async function buildApp() {
  const supabaseOrigin = resolveOrigin(env.SUPABASE_URL);
  const supabaseWssOrigin = supabaseOrigin?.startsWith("https://")
    ? `wss://${new URL(supabaseOrigin).host}`
    : null;
  const cspSources = ["'self'", supabaseOrigin, supabaseWssOrigin, "https://nominatim.openstreetmap.org"].filter(isDefined);
  const defaultDirectives = helmet.contentSecurityPolicy.getDefaultDirectives();
  const defaultConnectSrc = asDirectiveArray(defaultDirectives["connect-src"]);
  const defaultImgSrc = asDirectiveArray(defaultDirectives["img-src"]);

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL
    }
  });

  app.setErrorHandler(handleFastifyError);

  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Request-ID", request.id);
  });

  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        ...defaultDirectives,
        "connect-src": [...defaultConnectSrc, ...cspSources],
        "img-src": [...defaultImgSrc, "blob:", "https:"]
      }
    }
  });

  app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW
  });

  app.register(cors, {
    origin: parseCorsOrigin()
  });

  app.register(swagger, {
    mode: "static",
    specification: {
      path: "openapi.yaml",
      baseDir: getBackendRoot()
    }
  });

  app.register(swaggerUi, {
    routePrefix: "/api-docs"
  });

  app.get(
    "/api/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            required: ["status"],
            properties: {
              status: { type: "string", const: "ok" }
            }
          }
        }
      }
    },
    async () => ({ status: "ok" })
  );

  app.register(lockersRoutes, { prefix: "/api" });
  app.register(locationsRoutes, { prefix: "/api" });
  app.register(rentalsRoutes, { prefix: "/api" });
  app.register(unlockRoutes, { prefix: "/api" });
  app.register(dashboardRoutes, { prefix: "/api" });
  app.register(organizationsRoutes, { prefix: "/api" });
  await registerFrontend(app);

  return app;
}
