import type { Page } from "playwright";
import { existsSync } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { SCREENSHOTS_DIR } from "../config";
import { logWithTimestamp } from "../utils";

// ─── Initialisation ────────────────────────────────────────────────────────────

export async function ensureScreenshotsDir(): Promise<void> {
  try {
    if (!existsSync(SCREENSHOTS_DIR)) {
      await fs.mkdir(SCREENSHOTS_DIR);
      logWithTimestamp(`📁 Dossier ${SCREENSHOTS_DIR} créé`);
    }
  } catch (error) {
    logWithTimestamp(`❌ Erreur création dossier screenshots: ${error}`);
  }
}

// ─── Screenshot ────────────────────────────────────────────────────────────────

export async function takeScreenshot(
  page: Page,
  stepName: string,
  description?: string,
): Promise<void> {
  try {
    await ensureScreenshotsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${timestamp}_${stepName}.png`;
    const filePath = path.join(SCREENSHOTS_DIR, fileName);
    await page.screenshot({ path: filePath, fullPage: true });
    const logMessage = description
      ? `📸 Screenshot: ${fileName} - ${description}`
      : `📸 Screenshot: ${fileName}`;
    logWithTimestamp(logMessage);
  } catch (error) {
    logWithTimestamp(`❌ Erreur screenshot ${stepName}: ${error}`);
  }
}
