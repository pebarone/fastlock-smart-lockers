import { existsSync, readFileSync } from "node:fs";
import { resolveFromBackendRoot } from "./runtime-paths";

const DEFAULT_PORT = 3333;

loadLocalEnvFiles();

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: expected a positive integer.`);
  }

  return parsed;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function readString(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function normalizeWebAuthnRpId(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "localhost";
  }

  try {
    const withProtocol = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    return new URL(withProtocol).hostname;
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "");
  }
}

function loadLocalEnvFiles() {
  const envFiles = [
    resolveFromBackendRoot(".env.local"),
    resolveFromBackendRoot(".env")
  ];

  for (const envFilePath of envFiles) {
    loadEnvFile(envFilePath);
  }
}

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    value = value.replace(/\\n/g, "\n");

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export const env = Object.freeze({
  PORT: readNumber("PORT", DEFAULT_PORT),
  HOST: readString("HOST", "0.0.0.0"),
  DATABASE_URL: readString("DATABASE_URL", ""),
  DATABASE_SSL: readBoolean("DATABASE_SSL", false),
  CORS_ORIGIN: readString("CORS_ORIGIN", "http://localhost:5173"),
  LOG_LEVEL: readString("LOG_LEVEL", "info"),
  ADMIN_API_KEY: readString("ADMIN_API_KEY", ""),
  RATE_LIMIT_MAX: readNumber("RATE_LIMIT_MAX", 100),
  RATE_LIMIT_WINDOW: readString("RATE_LIMIT_WINDOW", "1 minute"),
  SUPABASE_URL: readString("SUPABASE_URL", ""),
  SUPABASE_PUBLISHABLE_KEY: readString("SUPABASE_PUBLISHABLE_KEY", ""),
  WEBAUTHN_RP_ID: normalizeWebAuthnRpId(readString("WEBAUTHN_RP_ID", "localhost")),
  WEBAUTHN_RP_NAME: readString("WEBAUTHN_RP_NAME", "FastLock"),
  WEBAUTHN_ALLOWED_ORIGINS: readString("WEBAUTHN_ALLOWED_ORIGINS", "")
});

export function parseCorsOrigin(): true | string[] {
  if (env.CORS_ORIGIN === "*") {
    return true;
  }

  return env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function parseWebAuthnAllowedOrigins(): string[] {
  if (env.WEBAUTHN_ALLOWED_ORIGINS) {
    return env.WEBAUTHN_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  const corsOrigins = parseCorsOrigin();
  const defaults = Array.isArray(corsOrigins) ? corsOrigins : [];
  const appOrigin = `http://localhost:${env.PORT}`;

  return [...new Set([...defaults, appOrigin])];
}
