import dotenv from "dotenv";

dotenv.config();

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface Config {
  email: string;
  password: string;
}

// ─── Constantes ────────────────────────────────────────────────────────────────

export const COOKIES_PATH = "cookies.json";
export const COOKIES_META_PATH = "cookies.meta.json";
export const VIDEO_LINK_PATH = "cloudinary-link.txt";
export const LOGIN_URL = "https://app.metricool.com/";
export const PLANNER_URL = "https://app.metricool.com/planner";
export const SCREENSHOTS_DIR = "screenshots";

export const CREATE_POST_SELECTORS = [
  'button[aria-label="Create post"]',
  'button[aria-label="Créer une publication"]',
  'button:has-text("Créer une publication")',
  'button:has-text("Create")',
  'button:has-text("Créer")',
  'button[data-testid="create-publication"]',
  ".create-post-btn",
  '[data-cy="create-post"]',
  "button:has(.fa-plus)",
  'button[title*="Créer"]',
  'button[aria-label*="Créer"]',
];

// ─── Environnement ─────────────────────────────────────────────────────────────

export function isCIEnvironment(): boolean {
  return process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
}

export function getEnvironmentTimeouts() {
  const isCI = isCIEnvironment();
  return {
    navigation: isCI ? 60000 : 30000,
    networkIdle: isCI ? 40000 : 15000,
    selector: isCI ? 35000 : 10000,
    element: isCI ? 20000 : 8000,
  };
}

export function validateEnvironmentVariables(): Config {
  const { logWithTimestamp } = require("./utils");
  logWithTimestamp("🔍 Validation des variables d'environnement...");
  const email = process.env.METRICOOL_EMAIL;
  const password = process.env.METRICOOL_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Variables d'environnement manquantes. Veuillez créer un fichier .env avec METRICOOL_EMAIL et METRICOOL_PASSWORD",
    );
  }

  const isCI = isCIEnvironment();
  logWithTimestamp(`🌍 Environnement détecté: ${isCI ? "CI/CD" : "Local"}`);
  logWithTimestamp(
    `✅ Configuration chargée pour l'email: ${email.replace(/(.{2}).*@/, "$1***@")}`,
  );
  return { email, password };
}
