/**
 * video-upload-automation.ts
 * Point d'entrée principal — orchestration haut niveau uniquement.
 * La logique métier est répartie dans scripts/automation/.
 */

import type { Browser } from "playwright";
import { validateEnvironmentVariables, PLANNER_URL } from "./automation/config";
import { logWithTimestamp, humanDelay, readVideoLink } from "./automation/utils";
import { launchBrowser, createBrowserContext, retryNavigation } from "./automation/services/browser.service";
import { loadCookies, saveCookies, getLoginHash } from "./automation/services/cookie.service";
import { isSessionValid, login, ensureOnPlanningTab } from "./automation/viewmodels/session.viewmodel";
import { automatePublication } from "./automation/viewmodels/publication.viewmodel";

// ─── Gestion des erreurs non capturées ────────────────────────────────────────

process.on("unhandledRejection", (reason, promise) => {
  console.log("🚨 Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.log("🚨 Uncaught Exception:", error);
  process.exit(1);
});

// ─── Orchestration principale ─────────────────────────────────────────────────

async function run(): Promise<void> {
  let browser: Browser | null = null;

  try {
    logWithTimestamp("🔄 Démarrage du script avec anti-détection avancé...");

    const config = validateEnvironmentVariables();
    const videoLink = await readVideoLink();
    const loginHash = getLoginHash(config.email, config.password);

    browser = await launchBrowser();
    const context = await createBrowserContext(browser);

    const page = await context.newPage();
    await page.setExtraHTTPHeaders({ DNT: "1", "Upgrade-Insecure-Requests": "1" });

    // Gestion de session
    const cookiesLoaded = await loadCookies(context, loginHash);
    let sessionIsValid = false;

    if (cookiesLoaded) {
      logWithTimestamp("🔍 Vérification de la session avec les cookies existants...");
      try {
        await retryNavigation(page, PLANNER_URL);
        sessionIsValid = await isSessionValid(page);
      } catch (error) {
        logWithTimestamp(`⚠️ Erreur lors de la vérification de session: ${error}`);
        sessionIsValid = false;
      }
    }

    if (!sessionIsValid) {
      logWithTimestamp("🔐 Connexion requise...");
      await login(page, config.email, config.password);
      await saveCookies(context, loginHash, config.email);
    } else {
      logWithTimestamp("✅ Session existante utilisée");
      await ensureOnPlanningTab(page);
    }

    // Automatisation avec retry
    try {
      await automatePublication(page, videoLink);
      logWithTimestamp("✨ Script terminé avec succès !");
    } catch (error) {
      logWithTimestamp(`⚠️ Erreur lors de l'automatisation: ${error}`);
      logWithTimestamp("🔄 Tentative de retry en naviguant vers PLANNER_URL...");
      await retryNavigation(page, PLANNER_URL);
      await humanDelay(3000, 5000);
      await automatePublication(page, videoLink, true); // isRetry=true → stabilisation avant tentative
      logWithTimestamp("✨ Script terminé avec succès après retry !");
    }

    await humanDelay(3000, 5000);
  } catch (error) {
    logWithTimestamp(`💥 Erreur fatale: ${error}`);
    throw error;
  } finally {
    if (browser) {
      logWithTimestamp("🔒 Fermeture du navigateur...");
      await browser.close();
    }
  }
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

async function main() {
  try {
    logWithTimestamp("🎬 Lancement du script avec anti-détection...");
    await run();
  } catch (error) {
    logWithTimestamp(`💥 Erreur fatale dans main(): ${error}`);
    process.exit(1);
  }
}

main();
