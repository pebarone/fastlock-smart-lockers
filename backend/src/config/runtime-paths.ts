import { resolve } from "node:path";

export function getBackendRoot(): string {
  return process.cwd();
}

export function resolveFromBackendRoot(...segments: string[]): string {
  return resolve(getBackendRoot(), ...segments);
}
