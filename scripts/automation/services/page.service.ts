import type { Page } from "playwright";
import { CREATE_POST_SELECTORS } from "../config";
import { logWithTimestamp, humanDelay } from "../utils";
import { takeScreenshot } from "./screenshot.service";

// ─── Fermeture du toast ────────────────────────────────────────────────────────

export async function closeToastIfVisible(page: Page): Promise<boolean> {
  try {
    const toastCloseBtn = await page.$(
      "div.flex.items-center.justify-between.pl-4.pr-2.py-2.gap-4.text-white .v-icon.fa-xmark, div.flex.items-center.justify-between.pl-4.pr-2.py-2.gap-4.text-white .v-icon[aria-label=\"Fermer\"], div.flex.items-center.justify-between.pl-4.pr-2.py-2.gap-4.text-white button[aria-label=\"Fermer\"]",
    );
    if (toastCloseBtn && (await toastCloseBtn.isVisible())) {
      await toastCloseBtn.click({ force: true });
      await humanDelay(200, 400);
      logWithTimestamp("Toast fermé (icone croix)");
      return true;
    }
  } catch {}
  return false;
}

// ─── Interaction sécurisée ─────────────────────────────────────────────────────

export async function safeInteraction(
  page: Page,
  element: any,
  action: "hover" | "click",
  description: string,
): Promise<void> {
  try {
    logWithTimestamp(`🔄 Tentative ${action} sur: ${description}`);

    const isLocator = typeof element.waitFor === "function";
    const timeout = 30000;

    if (isLocator) {
      await element.waitFor({ state: "visible", timeout });
    } else if (typeof element.waitForElementState === "function") {
      await element.waitForElementState("stable", { timeout });
    } else {
      logWithTimestamp(`⚠️ Type d'élément non reconnu pour ${description}, tentative directe...`);
    }

    await element.scrollIntoViewIfNeeded();
    await humanDelay(200, 500);

    let isBlocked = await element.evaluate((el: Element) => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const elementAtPoint = document.elementFromPoint(centerX, centerY);
      return elementAtPoint !== el && !el.contains(elementAtPoint);
    });

    if (isBlocked) {
      logWithTimestamp("⚠️ Élément bloqué détecté, tentative ciblée de déblocage...");
      await closeToastIfVisible(page);

      try {
        const scrim = await page.$(".v-overlay__scrim");
        if (scrim && (await scrim.isVisible())) {
          await scrim.click({ force: true });
          await humanDelay(200, 400);
          logWithTimestamp("Overlay (scrim) cliqué");
        }
      } catch {}

      await humanDelay(400, 700);

      isBlocked = await element.evaluate((el: Element) => {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const elementAtPoint = document.elementFromPoint(centerX, centerY);
        return elementAtPoint !== el && !el.contains(elementAtPoint);
      });
    }

    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount < maxRetries) {
      try {
        if (action === "hover") {
          await element.hover({ timeout: 20000 });
        } else {
          await element.click({ timeout: 20000, force: true });
        }
        logWithTimestamp(`✅ ${action} réussi sur: ${description}`);
        return;
      } catch (error) {
        retryCount++;
        logWithTimestamp(`⚠️ Tentative ${retryCount}/${maxRetries} échouée: ${error}`);
        if (retryCount < maxRetries) {
          await humanDelay(500, 900);
          await closeToastIfVisible(page);
        }
      }
    }

    throw new Error(`${action} échoué après ${maxRetries} tentatives sur: ${description}`);
  } catch (error) {
    logWithTimestamp(`❌ Erreur lors de ${action} sur ${description}: ${error}`);
    throw error;
  }
}

// ─── Recherche du bouton "Créer une publication" ───────────────────────────────

export async function findCreatePublicationButton(page: Page): Promise<any> {
  for (const selector of CREATE_POST_SELECTORS) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          logWithTimestamp(`✅ Bouton trouvé avec le sélecteur: ${selector}`);
          return element;
        }
      }
    } catch (error) {
      logWithTimestamp(`⚠️ Sélecteur ${selector} non trouvé: ${error}`);
    }
  }
  return null;
}

// ─── Saisie humaine d'URL ──────────────────────────────────────────────────────

export async function typeUrlHumanly(
  page: Page,
  selector: string,
  url: string,
): Promise<void> {
  const input = await page.$(selector);
  if (!input) throw new Error(`Input ${selector} not found`);

  logWithTimestamp(`📝 Remplissage URL: ${url.substring(0, 60)}...`);

  await input.scrollIntoViewIfNeeded();
  await humanDelay(300, 600);
  await input.click();
  await humanDelay(200, 400);

  // ✅ fill() est bien plus fiable que keyboard.type() en prod
  await input.fill(url);
  await humanDelay(500, 1000);

  // Triple vérification
  const finalValue = await input.inputValue();
  if (!finalValue) {
    logWithTimestamp(`❌ ERREUR: URL vide après fill()`);
    throw new Error(`URL input is empty: ${url}`);
  }

  logWithTimestamp(`✅ URL définie: ${finalValue.substring(0, 50)}...`);
}

// ─── Nettoyage des éléments bloquants ─────────────────────────────────────────

export async function cleanupBlockingElements(page: Page): Promise<void> {
  try {
    logWithTimestamp("🧹 Nettoyage des éléments bloquants...");

    const blockingSelectors = [
      "div.text-white .v-icon.fa-xmark",
      'div.text-white .v-icon[aria-label="Fermer"]',
      'div.text-white button[aria-label="Fermer"]',
      ".toast",
      ".modal",
      ".overlay",
      ".notification",
      ".alert",
      '[class*="toast"]',
      '[class*="modal"]',
      '[class*="overlay"]',
      '[class*="notification"]',
      '[class*="alert"]',
    ];

    for (const selector of blockingSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          if (await element.isVisible()) {
            try {
              await element.click({ timeout: 5000, force: true });
              await humanDelay(200, 400);
              logWithTimestamp(`Élément bloquant fermé: ${selector}`);
            } catch {}
          }
        }
      } catch {}
    }

    await humanDelay(500, 1000);
    logWithTimestamp("✅ Nettoyage des éléments bloquants terminé");
  } catch (error) {
    logWithTimestamp(`⚠️ Erreur lors du nettoyage: ${error}`);
  }
}
