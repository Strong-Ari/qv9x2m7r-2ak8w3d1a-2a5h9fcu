import type { Page } from "playwright";
import { PLANNER_URL, LOGIN_URL, CREATE_POST_SELECTORS, getEnvironmentTimeouts } from "../config";
import { logWithTimestamp, humanDelay } from "../utils";
import { takeScreenshot } from "../services/screenshot.service";
import { safeInteraction, findCreatePublicationButton } from "../services/page.service";
import { retryNavigation } from "../services/browser.service";

// ─── Vérification de session ───────────────────────────────────────────────────

export async function isSessionValid(page: Page): Promise<boolean> {
  try {
    logWithTimestamp("🔍 Vérification de la validité de la session...");
    const timeouts = getEnvironmentTimeouts();

    const currentUrl = page.url();
    logWithTimestamp(`📍 URL actuelle lors de la vérification: ${currentUrl}`);

    if (currentUrl.includes("/login") || currentUrl.includes("/auth") || currentUrl === "about:blank") {
      logWithTimestamp("❌ Redirigé vers la page de connexion - session invalide");
      return false;
    }

    // Si on est sur la page planner ou une page de l'app, c'est bon signe
    if (currentUrl.includes("/planner") || currentUrl.includes("app.metricool.com")) {
      const pageTitle = await page.title().catch(() => "");
      logWithTimestamp(`📄 Titre de la page: ${pageTitle}`);
      
      // Pas sur la page de login = session probablement valide
      if (!pageTitle.toLowerCase().includes("login") && !pageTitle.toLowerCase().includes("sign in")) {
        logWithTimestamp("✅ Session valide - page app.metricool.com accessible");
        return true;
      }
    }

    const loggedInIndicators = [
      ...CREATE_POST_SELECTORS,
      ".user-menu",
      ".profile-menu",
      '[data-testid="user-menu"]',
      ".nav-planner",
      '[href*="/planner"]',
    ];

    for (const selector of loggedInIndicators) {
      try {
        const element = await page.$(selector);
        if (element && (await element.isVisible())) {
          logWithTimestamp(`✅ Session valide détectée avec: ${selector}`);
          return true;
        }
      } catch {
        continue;
      }
    }

    if (currentUrl.includes("/planner")) {
      try {
        await page.waitForSelector(
          'button[aria-label="Create post"], button[aria-label="Créer une publication"], button:has-text("Créer une publication"), button:has-text("Create"), button:has-text("Créer")',
          { timeout: timeouts.element },
        );
        logWithTimestamp("✅ Session valide - page planner chargée correctement");
        return true;
      } catch {
        logWithTimestamp("❌ Page planner chargée mais bouton de création non trouvé");
        return false;
      }
    }

    logWithTimestamp("❌ Session invalide ou expirée");
    return false;
  } catch (error) {
    logWithTimestamp(`❌ Erreur lors de la vérification de session: ${error}`);
    return false;
  }
}

// ─── Navigation vers l'onglet Planification ────────────────────────────────────

export async function ensureOnPlanningTab(page: Page): Promise<void> {
  try {
    logWithTimestamp("🔍 Navigation vers l'onglet Planification...");

    logWithTimestamp("🔧 Configuration du script d'initialisation localStorage...");
    try {
      const context = page.context();
      await context.addInitScript(() => {
        localStorage.setItem("brand.5222086:free.limits.change.modal.showed.v1", "true");
        localStorage.setItem("brand:free.limits.change.modal.showed.v1", "true");
        localStorage.setItem("free.limits.change.modal.showed", "true");

        const setAllLimitKeys = () => {
          const allKeys = Object.keys(localStorage);
          const limitKeys = allKeys.filter((k) => k.includes("free.limits.change.modal"));
          for (const key of limitKeys) {
            localStorage.setItem(key, "true");
          }
        };

        setAllLimitKeys();
        window.addEventListener("storage", setAllLimitKeys);
      });
      logWithTimestamp("✅ Script d'initialisation ajouté au contexte");
    } catch (error) {
      logWithTimestamp(`⚠️ Erreur lors de l'ajout du script d'initialisation: ${error}`);
    }

    await retryNavigation(page, PLANNER_URL);

    const timeouts = getEnvironmentTimeouts();

    try {
      await page.waitForLoadState("networkidle", { timeout: timeouts.networkIdle });
    } catch (error) {
      logWithTimestamp(`⚠️ Timeout networkidle, tentative avec domcontentloaded: ${error}`);
      await page.waitForLoadState("domcontentloaded", { timeout: timeouts.networkIdle });
    }

    logWithTimestamp("🔧 Configuration du localStorage après navigation...");
    try {
      await page.evaluate(() => {
        const allKeys = Object.keys(localStorage);
        const limitKeys = allKeys.filter((k) => k.includes("free.limits.change.modal"));
        for (const key of limitKeys) {
          localStorage.setItem(key, "true");
        }
      });
      logWithTimestamp("✅ localStorage configuré après navigation");
    } catch (error) {
      logWithTimestamp(`⚠️ Erreur lors de la configuration du localStorage: ${error}`);
    }

    logWithTimestamp("🔍 Recherche et fermeture du modal s'il apparaît...");
    await humanDelay(2000, 3000);

    try {
      const closed = await page.evaluate(() => {
        const closeButtons = document.querySelectorAll("button");
        for (const btn of closeButtons) {
          const icon = btn.querySelector("i.fa-xmark, i.fa-regular.fa-xmark");
          if (icon && btn.offsetParent !== null) {
            const dialog = btn.closest('div[role="dialog"], .v-dialog, .modal');
            if (dialog) {
              (btn as HTMLButtonElement).click();
              return true;
            }
          }
        }
        return false;
      });

      if (closed) {
        logWithTimestamp("✅ Modal fermé avec succès");
        await humanDelay(1000, 2000);
      }
    } catch (error) {
      logWithTimestamp(`⚠️ Erreur lors de la fermeture du modal: ${error}`);
    }

    await humanDelay(2000, 3000);

    let pageLoaded = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!pageLoaded && attempts < maxAttempts) {
      attempts++;
      try {
        // Fermer tout modal résiduel avant de chercher le bouton
        await page.evaluate(() => {
          const closeButtons = Array.from(document.querySelectorAll("button"));
          for (const btn of closeButtons) {
            const icon = btn.querySelector("i.fa-xmark, i.fa-regular.fa-xmark, i.fa-times");
            if (icon && (btn as HTMLElement).offsetParent !== null) {
              const dialog = btn.closest('div[role="dialog"], .v-dialog, .modal, .v-overlay__content');
              if (dialog) (btn as HTMLButtonElement).click();
            }
          }
          // Fermer aussi les scrim overlay
          const scrim = document.querySelector('.v-overlay__scrim') as HTMLElement | null;
          if (scrim && scrim.offsetParent !== null) scrim.click();
        }).catch(() => {});

        await humanDelay(1500, 2500);

        // Cherche le bouton via le sélecteur CSS d'abord
        const selectorString = 'button[aria-label="Create post"], button[aria-label="Créer une publication"], button:has-text("Créer une publication"), button:has-text("Create"), button:has-text("Créer")';
        
        try {
          await page.waitForSelector(selectorString, { timeout: timeouts.selector });
          logWithTimestamp("✅ Page Planification chargée avec succès");
          pageLoaded = true;
          continue;
        } catch {
          // Fallback: recherche JS dans tout le DOM
          logWithTimestamp("🔍 Fallback JS - recherche du bouton dans le DOM...");
          const foundByJs = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll("button"));
            const keywords = ["create post", "créer une publication", "create", "créer", "publish"];
            for (const btn of buttons) {
              const label = (btn.getAttribute("aria-label") || btn.textContent || "").toLowerCase().trim();
              if (keywords.some(k => label.includes(k)) && (btn as HTMLElement).offsetParent !== null) {
                return true;
              }
            }
            return false;
          });

          if (foundByJs) {
            logWithTimestamp("✅ Page Planification chargée avec succès (via fallback JS)");
            pageLoaded = true;
            continue;
          }

          throw new Error("Bouton introuvable même via fallback JS");
        }
      } catch (error) {
        logWithTimestamp(
          `⚠️ Tentative ${attempts}/${maxAttempts} - Bouton de création non trouvé: ${error}`,
        );

        // Screenshot de débogage pour voir l'état de la page en CI
        await takeScreenshot(page, `planner_attempt_${attempts}`, `État page planification - tentative ${attempts}`);

        // Log de l'URL et du titre pour comprendre où on est
        logWithTimestamp(`📍 URL actuelle: ${page.url()}`);
        const pageTitle = await page.title().catch(() => "N/A");
        logWithTimestamp(`📄 Titre de la page: ${pageTitle}`);

        if (attempts < maxAttempts) {
          logWithTimestamp("🔄 Rafraîchissement de la page...");
          await page.reload({ waitUntil: "domcontentloaded" });
          // Plus de temps en CI pour que l'app Vue.js se monte
          await humanDelay(8000, 12000);

          // Reconfigurer localStorage après reload
          try {
            await page.evaluate(() => {
              const limitKeys = Object.keys(localStorage).filter(k => k.includes("free.limits.change.modal"));
              for (const key of limitKeys) localStorage.setItem(key, "true");
              localStorage.setItem("brand.5222086:free.limits.change.modal.showed.v1", "true");
              localStorage.setItem("brand:free.limits.change.modal.showed.v1", "true");
              localStorage.setItem("free.limits.change.modal.showed", "true");
            });
          } catch {}

          try {
            await page.waitForLoadState("networkidle", { timeout: timeouts.networkIdle });
          } catch {
            await page.waitForLoadState("domcontentloaded", { timeout: timeouts.networkIdle });
          }
        }
      }
    }

    if (!pageLoaded) {
      await takeScreenshot(page, "planner_load_failed", "Échec chargement page planification");
      logWithTimestamp(`📍 URL finale: ${page.url()}`);
      throw new Error("Impossible de charger la page Planification après plusieurs tentatives");
    }

    await takeScreenshot(page, "planner_page_loaded", "Page Planification chargée");
  } catch (error) {
    logWithTimestamp(`❌ Erreur lors de la navigation vers Planification: ${error}`);
    throw error;
  }
}

// ─── Connexion ─────────────────────────────────────────────────────────────────

export async function login(page: Page, email: string, password: string): Promise<void> {
  try {
    logWithTimestamp("🔐 Début de la procédure de connexion...");

    const currentUrl = page.url();
    if (!currentUrl.includes("/login") && !currentUrl.includes("/auth")) {
      logWithTimestamp("⚠️ Pas sur la page de connexion, vérification de session...");
      const sessionValid = await isSessionValid(page);
      if (sessionValid) {
        logWithTimestamp("✅ Déjà connecté, pas besoin de se reconnecter");
        return;
      }
    }

    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await humanDelay(3000, 5000);
    await humanDelay(3000, 5000);

    logWithTimestamp("📝 Saisie de l'email...");
    const emailInput = page.locator('input[name="email"]');
    await emailInput.waitFor({ state: "visible", timeout: 30000 });
    await emailInput.click();
    await humanDelay(500, 1000);
    await emailInput.type(email, { delay: Math.random() * 100 + 50 });
    await humanDelay(500, 1500);

    logWithTimestamp("🔑 Saisie du mot de passe...");
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.click();
    await humanDelay(300, 800);
    await passwordInput.type(password, { delay: Math.random() * 100 + 50 });
    await humanDelay(800, 1500);

    logWithTimestamp("▶️ Connexion...");
    const loginButton = page.locator('button[aria-label="Submit login form"]');
    await safeInteraction(page, loginButton, "hover", "Bouton de connexion");
    await humanDelay(300, 700);
    await safeInteraction(page, loginButton, "click", "Bouton de connexion");

    try {
      await page.waitForURL("**/planner*", { timeout: 30000 });
      logWithTimestamp("✅ Redirection vers planner détectée");
    } catch {
      logWithTimestamp("⚠️ Redirection automatique échouée, tentative de navigation manuelle...");
      await humanDelay(3000, 5000);
      await page.goto(PLANNER_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
      await humanDelay(3000, 5000);
      logWithTimestamp("✅ Navigation manuelle vers planner effectuée");
    }

    logWithTimestamp("✅ Connexion réussie");
    await ensureOnPlanningTab(page);
  } catch (error) {
    logWithTimestamp(`❌ Erreur lors de la connexion: ${error}`);
    throw error;
  }
}
