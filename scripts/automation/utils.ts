import { isCIEnvironment } from "./config";
import { promises as fs } from "fs";
import { existsSync } from "fs";
import { VIDEO_LINK_PATH } from "./config";

// ─── Logs ──────────────────────────────────────────────────────────────────────

export const logWithTimestamp = (message: string): void => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

// ─── Délais ────────────────────────────────────────────────────────────────────

export const humanDelay = (min: number = 1000, max: number = 3000): Promise<void> => {
  const isCI = isCIEnvironment();
  const adjustedMin = isCI ? Math.max(min, 2000) : min;
  const adjustedMax = isCI ? Math.max(max, 5000) : max;
  const delay = Math.floor(Math.random() * (adjustedMax - adjustedMin + 1)) + adjustedMin;
  return new Promise((resolve) => setTimeout(resolve, delay));
};

// ─── Helpers génériques ────────────────────────────────────────────────────────

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Lecture fichier vidéo ─────────────────────────────────────────────────────

export async function readVideoLink(): Promise<string> {
  logWithTimestamp(`📂 Lecture du fichier ${VIDEO_LINK_PATH}...`);
  if (!existsSync(VIDEO_LINK_PATH)) {
    throw new Error(`Le fichier ${VIDEO_LINK_PATH} n'existe pas`);
  }
  const videoLink = await fs.readFile(VIDEO_LINK_PATH, "utf8");
  const trimmedLink = videoLink.trim();
  if (!trimmedLink) {
    throw new Error(`Le fichier ${VIDEO_LINK_PATH} est vide`);
  }
  logWithTimestamp(`✅ Lien Cloudinary récupéré: ${trimmedLink}`);
  return trimmedLink;
}
