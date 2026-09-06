import { cleanEnv } from "@/lib/env";

export type AppEnv = "production" | "staging" | "development";

export function getAppEnv(): AppEnv {
  const explicit = (cleanEnv(process.env.APP_ENV) || cleanEnv(process.env.NEXT_PUBLIC_APP_ENV) || "").toLowerCase();
  if (explicit === "staging") return "staging";
  if (explicit === "development") return "development";
  if (explicit === "production") return "production";
  if (process.env.NODE_ENV === "development") return "development";
  return "production";
}

export function isStagingApp() {
  return getAppEnv() === "staging";
}

export function isProductionApp() {
  return getAppEnv() === "production";
}
