import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { authConfiguration } from "./config.mjs";

let instance;
export function getAuth() {
  const config = authConfiguration();
  if (!config) return null;
  instance ??= createNeonAuth(config);
  return instance;
}
