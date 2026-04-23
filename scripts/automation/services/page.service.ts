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

  await input.hover();
  await humanDelay(200, 500);
  await input.click();
  await humanDelay(300, 800);

  await page.keyboard.press("Control+a");
  await humanDelay(100, 300);
  await page.keyboard.press("Delete");
  await humanDelay(200, 500);

  for (const char of url) {
    await page.keyboard.type(char);
    await humanDelay(50, 150);
  }

  await humanDelay(500, 1000);

  await page.evaluate(
    (args: string[]) => {
      const [selector, url] = args;
      const input = document.querySelector(selector) as HTMLInputElement;
      if (input) {
        input.value = url;
        ["input", "change", "keyup", "blur", "paste"].forEach((eventType) => {
          input.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
      }
    },
    [selector, url],
  );

  await page.keyboard.press("Tab");
  await humanDelay(500, 1000);
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
