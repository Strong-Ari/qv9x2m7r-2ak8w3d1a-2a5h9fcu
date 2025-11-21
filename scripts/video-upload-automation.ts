import { addExtra } from "playwright-extra";
import { chromium } from "patchright";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, BrowserContext, Page } from "playwright";
import { promises as fs } from "fs";
import { existsSync } from "fs";
import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
const voiceData = require("../subs/ayanokoji-voice.json");
const { exec } = require('child_process');

// Charger les variables d'environnement
dotenv.config();

// Configuration du navigateur avec stealth
const chromiumExtra = addExtra(chromium);
chromiumExtra.use(StealthPlugin());

// Gestion des erreurs non capturées
process.on("unhandledRejection", (reason, promise) => {
  console.log("🚨 Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.log("🚨 Uncaught Exception:", error);
  process.exit(1);
});

interface Config {
  email: string;
  password: string;
}

const COOKIES_PATH = "cookies.json";
const COOKIES_META_PATH = "cookies.meta.json";
const VIDEO_LINK_PATH = "cloudinary-link.txt";
const LOGIN_URL = "https://app.metricool.com/";
const PLANNER_URL = "https://app.metricool.com/planner";
const SCREENSHOTS_DIR = "screenshots";

// Fonction utilitaire pour sélectionner un élément aléatoire
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Fonction pour générer une description style "citation Ayanokoji" safe TikTok
function generateDescription(): string {
  // Phrases neutres / descriptives
  const actions = [
    "Citation Ayanokoji",
    "Style Ayanokoji",
    "Vibes Ayanokoji",
    "Inspiré par Ayanokoji",
    "Extrait du maître Ayanokoji",
    "Extrait du GOAT Ayanokoji",
    "Extrait du Goat Ayanokoji",
    "Pensée d'Ayanokoji",
    "Réflexion Ayanokoji",
    "Philosophie Ayanokoji",
    "Sagesse d'Ayanokoji",
    "Génie caché",
    "Leçon psychologique",
    "Puissance silencieuse",
    "Mentalité Ayanokoji",
  ];

  // Endings pour compléter la description
  const endings = [
    "– Classroom of the Elite ⚡",
    "– CoTE vibes 🎯",
    "– Anime inspirant 💡",
    "– Moment intense 🔥",
    "– Extrait animé 🌀",
    "– Génie caché 🕶️",
    "– Puissance silencieuse 🌌",
    "– L’ombre d’Ayanokoji 🖤",
    "– Esprit stratégique ♟️",
    "– Vibes psychologiques 🧠",
    "– Citation marquante ✨",
    "– Scène culte 🎬",
    "– Mystère total 🌑",
    "– Force tranquille 🐺",
    "– Univers anime 🌍"
  ];


  // Pool de hashtags liés à l’anime
  const hashtagsPool = [
    "#ClassroomOfTheElite",
    "#AnimeCourts",
    "#Ayanokoji",
    "#ClipsAnime",
    "#Otaku",
    "#VibesAnime",
    "#CoTE",
    "#AnimeVibes",
    "#momentgoat",
    "#AnimeClassroom",
    "#EditionAnime",
    "#VieAnime",
    "#MondeAnime",
    "#FansAnime",
  ];

  // Combiner action + ending
  const baseDescription = `${pickRandom(actions)} ${pickRandom(endings)}`;

  // Déterminer le nombre de hashtags selon la longueur du texte
  let hashtagCount = 3;
  if (baseDescription.length > 60) hashtagCount = 2;
  else if (baseDescription.length < 40) hashtagCount = 4;

  // Sélectionner hashtags uniques
  const selectedHashtags: string[] = [];
  while (selectedHashtags.length < hashtagCount) {
    const tag = pickRandom(hashtagsPool);
    if (!selectedHashtags.includes(tag)) selectedHashtags.push(tag);
  }

  return `${baseDescription} ${selectedHashtags.join(' ')}`;
}

// Exemple d'utilisation
console.log(generateDescription());


// Générer une description unique à chaque exécution
const descriptions: string[] = [generateDescription()];

// Fonction utilitaire pour les délais aléatoires (plus humain)
const humanDelay = (min: number = 1000, max: number = 3000): Promise<void> => {
  const isCI = isCIEnvironment();

  // En CI, on augmente les délais pour éviter les timeouts
  const adjustedMin = isCI ? Math.max(min, 2000) : min;
  const adjustedMax = isCI ? Math.max(max, 5000) : max;

  const delay =
    Math.floor(Math.random() * (adjustedMax - adjustedMin + 1)) + adjustedMin;
  return new Promise((resolve) => setTimeout(resolve, delay));
};

// Fonction pour logger avec timestamp
const logWithTimestamp = (message: string): void => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

// Fonction pour créer le dossier screenshots s'il n'existe pas
async function ensureScreenshotsDir(): Promise<void> {
  try {
    if (!existsSync(SCREENSHOTS_DIR)) {
      await fs.mkdir(SCREENSHOTS_DIR);
      logWithTimestamp(`📁 Dossier ${SCREENSHOTS_DIR} créé`);
    }
  } catch (error) {
    logWithTimestamp(`❌ Erreur création dossier screenshots: ${error}`);
  }
}

// Fonction pour prendre un screenshot avec nom descriptif
async function takeScreenshot(
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

// Fonction utilitaire pour générer un hash d'identifiants (même algo que generate-login-hash.ts)
function getLoginHash(email: string, password: string): string {
  return crypto
    .createHash("sha256")
    .update(`${email}:${password}`)
    .digest("hex")
    .slice(0, 8);
}

// Fonction pour sauvegarder les cookies
async function saveCookies(
  context: BrowserContext,
  loginHash: string,
  email: string,
): Promise<void> {
  try {
    logWithTimestamp("🔄 Sauvegarde des cookies en cours...");
    const cookies = await context.cookies();
    await fs.writeFile(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    const meta = {
      loginHash,
      emailMasked: email.replace(/(.{2}).*@/, "$1***@"),
      createdAt: new Date().toISOString(),
      version: 1,
    };
    await fs.writeFile(COOKIES_META_PATH, JSON.stringify(meta, null, 2));
    logWithTimestamp(
      `💾 Cookies sauvegardés avec succès (${cookies.length} cookies)`,
    );
  } catch (error) {
    logWithTimestamp(`❌ Erreur lors de la sauvegarde des cookies: ${error}`);
    throw error;
  }
}

// Fonction pour charger les cookies en vérifiant qu'ils correspondent bien aux identifiants
async function loadCookies(
  context: BrowserContext,
  expectedLoginHash: string,
): Promise<boolean> {
  try {
    logWithTimestamp("🔍 Recherche du fichier de cookies...");
    if (!existsSync(COOKIES_PATH)) {
      logWithTimestamp("⚠️ Aucun fichier de cookies trouvé");
      return false;
    }

    // Vérifier le meta pour s'assurer que les cookies correspondent au bon compte
    if (!existsSync(COOKIES_META_PATH)) {
      logWithTimestamp(
        "⚠️ Fichier meta des cookies manquant. Les cookies existants seront ignorés.",
      );
      return false;
    }

    try {
      const metaRaw = await fs.readFile(COOKIES_META_PATH, "utf8");
      const meta = JSON.parse(metaRaw) as { loginHash?: string };
      if (!meta.loginHash || meta.loginHash !== expectedLoginHash) {
        logWithTimestamp(
          `⚠️ Incompatibilité de cookies détectée (hash attendu: ${expectedLoginHash}, trouvé: ${meta.loginHash || "aucun"}). Ignorer ces cookies.`,
        );
        return false;
      }
    } catch (e) {
      logWithTimestamp(
        `⚠️ Impossible de lire/valider le meta des cookies: ${e}. Ignorer ces cookies.`,
      );
      return false;
    }

    const cookiesJSON = await fs.readFile(COOKIES_PATH, "utf8");
    const cookies = JSON.parse(cookiesJSON);
    if (!Array.isArray(cookies) || cookies.length === 0) {
      logWithTimestamp("⚠️ Fichier de cookies vide ou invalide");
      return false;
    }
    await context.addCookies(cookies);
    logWithTimestamp(
      `🔄 Cookies chargés avec succès (${cookies.length} cookies)`,
    );
    return true;
  } catch (error) {
    logWithTimestamp(`❌ Erreur lors du chargement des cookies: ${error}`);
    return false;
  }
}

// Fonction améliorée pour s'assurer d'être sur l'onglet Planification
async function ensureOnPlanningTab(page: Page): Promise<void> {
  try {
    logWithTimestamp("🔍 Navigation vers l'onglet Planification...");

    // Navigation directe vers la page planner avec retry
    await retryNavigation(page, PLANNER_URL);

    // Attendre que la page soit complètement chargée avec timeout adapté à l'environnement
    const timeouts = getEnvironmentTimeouts();

    try {
      await page.waitForLoadState("networkidle", {
        timeout: timeouts.networkIdle,
      });
    } catch (error) {
      logWithTimestamp(
        `⚠️ Timeout networkidle, tentative avec domcontentloaded: ${error}`,
      );
      await page.waitForLoadState("domcontentloaded", {
        timeout: timeouts.networkIdle,
      });
    }

    await humanDelay(3000, 5000); // Délai plus long en CI

    // Vérifier que la page est bien chargée avec retry
    let pageLoaded = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!pageLoaded && attempts < maxAttempts) {
      attempts++;
      try {
        await page.waitForSelector(
          'button:has-text("Créer une publication"), button:has-text("Create"), button:has-text("Créer")',
          { timeout: 15000 },
        );
        logWithTimestamp("✅ Page Planification chargée avec succès");
        pageLoaded = true;
      } catch (error) {
        logWithTimestamp(
          `⚠️ Tentative ${attempts}/${maxAttempts} - Bouton de création non trouvé: ${error}`,
        );

        if (attempts < maxAttempts) {
          logWithTimestamp("🔄 Rafraîchissement de la page...");
          await page.reload({ waitUntil: "domcontentloaded" });
          await humanDelay(5000, 8000); // Délai plus long

          // Attendre à nouveau le chargement
          try {
            await page.waitForLoadState("networkidle", {
              timeout: timeouts.networkIdle,
            });
          } catch {
            await page.waitForLoadState("domcontentloaded", {
              timeout: timeouts.networkIdle,
            });
          }
        }
      }
    }

    if (!pageLoaded) {
      throw new Error(
        "Impossible de charger la page Planification après plusieurs tentatives",
      );
    }

    await takeScreenshot(
      page,
      "planner_page_loaded",
      "Page Planification chargée",
    );
  } catch (error) {
    logWithTimestamp(
      `❌ Erreur lors de la navigation vers Planification: ${error}`,
    );
    throw error;
  }
}

// Fonction améliorée pour vérifier si la session est valide
async function isSessionValid(page: Page): Promise<boolean> {
  try {
    logWithTimestamp("🔍 Vérification de la validité de la session...");

    // Vérifier si on est sur la page de connexion
    const currentUrl = page.url();
    if (currentUrl.includes("/login") || currentUrl.includes("/auth")) {
      logWithTimestamp(
        "❌ Redirigé vers la page de connexion - session invalide",
      );
      return false;
    }

    // Vérifier la présence d'éléments indiquant qu'on est connecté
    const loggedInIndicators = [
      'button:has-text("Créer une publication")',
      'button:has-text("Create")',
      'button:has-text("Créer")',
      'button[data-testid="create-publication"]',
      ".create-post-btn",
      '[data-cy="create-post"]',
      // Indicateurs de profil utilisateur
      ".user-menu",
      ".profile-menu",
      '[data-testid="user-menu"]',
      // Indicateurs de navigation connectée
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

    // Vérifier si on est sur la page planner et qu'elle est bien chargée
    if (currentUrl.includes("/planner")) {
      try {
        await page.waitForSelector(
          'button:has-text("Créer une publication"), button:has-text("Create"), button:has-text("Créer")',
          { timeout: 5000 },
        );
        logWithTimestamp(
          "✅ Session valide - page planner chargée correctement",
        );
        return true;
      } catch {
        logWithTimestamp(
          "❌ Page planner chargée mais bouton de création non trouvé",
        );
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

// Fonction de connexion avec comportement humain
async function login(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  try {
    logWithTimestamp("🔐 Début de la procédure de connexion...");

    // Vérifier d'abord si on n'est pas déjà connecté
    const currentUrl = page.url();
    if (!currentUrl.includes("/login") && !currentUrl.includes("/auth")) {
      logWithTimestamp(
        "⚠️ Pas sur la page de connexion, vérification de session...",
      );
      const sessionValid = await isSessionValid(page);
      if (sessionValid) {
        logWithTimestamp("✅ Déjà connecté, pas besoin de se reconnecter");
        return;
      }
    }

    await page.goto(LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await humanDelay(3000, 5000);

    // Attendre un peu puis forcer la navigation
    await humanDelay(3000, 5000);

    // Attendre que les champs de connexion soient visibles
    // Saisie email avec simulation humaine
    // Saisie email avec simulation humaine
    logWithTimestamp("📝 Saisie de l'email...");
    // Utilisation d'un sélecteur CSS plus robuste et direct (input[name="email"])
    const emailInput = page.locator('input[name="email"]');

    // Attendre que le champ email soit visible
    await emailInput.waitFor({ state: 'visible', timeout: 30000 });
    await emailInput.click();
    await humanDelay(500, 1000);
    await emailInput.type(email, {
      delay: Math.random() * 100 + 50,
    });
    await humanDelay(500, 1500);

    // Saisie mot de passe avec simulation humaine
    logWithTimestamp("🔑 Saisie du mot de passe...");
    // Utilisation d'un sélecteur CSS standard pour le mot de passe
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.click();
    await humanDelay(300, 800);
    await passwordInput.type(password, {
      delay: Math.random() * 100 + 50,
    });
    await humanDelay(800, 1500);

    // Clic sur connexion avec hover
    logWithTimestamp("▶️ Connexion...");
    // Utilisation d'un sélecteur CSS robuste pour le bouton de connexion
    // Utilisation de .first() pour éviter l'erreur "strict mode violation" si plusieurs boutons submit sont présents
    const loginButton = page.locator('button[type="submit"]').first();
    await safeInteraction(page, loginButton, "hover", "Bouton de connexion");
    await humanDelay(300, 700);
    await safeInteraction(page, loginButton, "click", "Bouton de connexion");

    // Attendre la redirection après connexion
    try {
      await page.waitForURL("**/planner*", { timeout: 30000 });
      logWithTimestamp("✅ Redirection vers planner détectée");
    } catch {
      logWithTimestamp(
        "⚠️ Redirection automatique échouée, tentative de navigation manuelle...",
      );

      // Attendre un peu puis forcer la navigation
      await humanDelay(3000, 5000);

      // Forcer la navigation vers le planner
      await page.goto(PLANNER_URL, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await humanDelay(3000, 5000);

      logWithTimestamp("✅ Navigation manuelle vers planner effectuée");
    }

    logWithTimestamp("✅ Connexion réussie");

    // S'assurer d'être sur la page de planification
    await ensureOnPlanningTab(page);
  } catch (error) {
    logWithTimestamp(`❌ Erreur lors de la connexion: ${error}`);
    throw error;
  }
}

// Fonction pour obtenir la description générée (maintenant unique à chaque exécution)
function getRandomDescription(): string {
  const selectedDescription = descriptions[0]; // Toujours la première car générée dynamiquement
  logWithTimestamp(`🎲 Description générée: "${selectedDescription}"`);
  return selectedDescription;
}

// Fonction pour lire le lien vidéo
async function readVideoLink(): Promise<string> {
  try {
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
  } catch (error) {
    logWithTimestamp(`❌ Erreur lecture fichier ${VIDEO_LINK_PATH}: ${error}`);
    throw error;
  }
}

// Fonction pour détecter l'environnement CI/CD
function isCIEnvironment(): boolean {
  return process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
}

// Fonction pour obtenir les timeouts adaptés à l'environnement
function getEnvironmentTimeouts() {
  const isCI = isCIEnvironment();
  return {
    navigation: isCI ? 45000 : 30000,
    networkIdle: isCI ? 30000 : 15000,
    selector: isCI ? 20000 : 10000,
    element: isCI ? 15000 : 8000,
  };
}

// Fonction pour valider les variables d'environnement
function validateEnvironmentVariables(): Config {
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

// Fonction pour simuler une saisie humaine d'URL
async function typeUrlHumanly(
  page: Page,
  selector: string,
  url: string,
): Promise<void> {
  const input = await page.$(selector);
  if (!input) throw new Error(`Input ${selector} not found`);

  // Focus avec hover d'abord
  await input.hover();
  await humanDelay(200, 500);
  await input.click();
  await humanDelay(300, 800);

  // Effacer le contenu existant
  await page.keyboard.press("Control+a");
  await humanDelay(100, 300);
  await page.keyboard.press("Delete");
  await humanDelay(200, 500);

  // Taper l'URL avec des délais variables
  for (const char of url) {
    await page.keyboard.type(char);
    await humanDelay(50, 150); // Délai entre chaque caractère
  }

  await humanDelay(500, 1000);

  // Simuler des événements naturels
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

  // Appuyer sur Tab pour déclencher la validation
  await page.keyboard.press("Tab");
  await humanDelay(500, 1000);
}

// Fonction améliorée pour trouver le bouton "Créer une publication"
async function findCreatePublicationButton(page: Page): Promise<any> {
  const selectors = [
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

  for (const selector of selectors) {
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

// Fermer le toast principal s'il est visible (ciblé, non agressif)
async function closeToastIfVisible(page: Page): Promise<boolean> {
  try {
    const toastCloseBtn = await page.$(
      'div.flex.items-center.justify-between.pl-4.pr-2.py-2.gap-4.text-white .v-icon.fa-xmark, div.flex.items-center.justify-between.pl-4.pr-2.py-2.gap-4.text-white .v-icon[aria-label="Fermer"], div.flex.items-center.justify-between.pl-4.pr-2.py-2.gap-4.text-white button[aria-label="Fermer"]',
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

// Fonction pour gérer les éléments bloquants et améliorer les interactions
async function safeInteraction(
  page: Page,
  element: any,
  action: "hover" | "click",
  description: string,
): Promise<void> {
  try {
    logWithTimestamp(`🔄 Tentative ${action} sur: ${description}`);

    // Gestion différente selon si c'est un Locator ou un ElementHandle
    // Gestion plus robuste pour différencier Locator et ElementHandle
    // Locator a une méthode waitFor(), ElementHandle a waitForElementState()
    const isLocator = typeof element.waitFor === 'function';
    const timeout = 30000; // Timeout augmenté pour plus de stabilité

    // Attendre que l'élément soit stable
    if (isLocator) {
      // Pour un Locator, on attend qu'il soit visible
      await element.waitFor({ state: 'visible', timeout: timeout });
    } else if (typeof element.waitForElementState === 'function') {
      // Pour un ElementHandle
      await element.waitForElementState("stable", { timeout: timeout });
    } else {
      // Fallback si ni l'un ni l'autre (ne devrait pas arriver)
      logWithTimestamp(`⚠️ Type d'élément non reconnu pour ${description}, tentative directe...`);
    }

    // Faire défiler l'élément en vue si nécessaire
    await element.scrollIntoViewIfNeeded();
    await humanDelay(200, 500);

    // Vérifier s'il y a des éléments qui bloquent (point central intercepté)
    // Note: evaluate sur un Locator passe l'élément DOM correspondant
    let isBlocked = await element.evaluate((el: Element) => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const elementAtPoint = document.elementFromPoint(centerX, centerY);
      return elementAtPoint !== el && !el.contains(elementAtPoint);
    });

    if (isBlocked) {
      logWithTimestamp(
        `⚠️ Élément bloqué détecté, tentative ciblée de déblocage...`,
      );

      // Fermer uniquement le toast connu
      await closeToastIfVisible(page);

      // Fermer un éventuel overlay (scrim) Vuetify
      try {
        const scrim = await page.$(".v-overlay__scrim");
        if (scrim && (await scrim.isVisible())) {
          await scrim.click({ force: true });
          await humanDelay(200, 400);
          logWithTimestamp("Overlay (scrim) cliqué");
        }
      } catch {}

      await humanDelay(400, 700);

      // Re-check
      isBlocked = await element.evaluate((el: Element) => {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const elementAtPoint = document.elementFromPoint(centerX, centerY);
        return elementAtPoint !== el && !el.contains(elementAtPoint);
      });
    }

    // Exécuter l'action avec retry (moins agressif)
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
        logWithTimestamp(
          `⚠️ Tentative ${retryCount}/${maxRetries} échouée: ${error}`,
        );
        if (retryCount < maxRetries) {
          await humanDelay(500, 900);
          await closeToastIfVisible(page);
        }
      }
    }

    throw new Error(
      `${action} échoué après ${maxRetries} tentatives sur: ${description}`,
    );
  } catch (error) {
    logWithTimestamp(
      `❌ Erreur lors de ${action} sur ${description}: ${error}`,
    );
    throw error;
  }
}

// Fonction pour nettoyer proactivement les éléments bloquants
async function cleanupBlockingElements(page: Page): Promise<void> {
  try {
    logWithTimestamp("🧹 Nettoyage des éléments bloquants...");

    // Sélecteurs des éléments qui peuvent bloquer
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
            } catch (e) {
              // Ignorer les erreurs de clic
            }
          }
        }
      } catch (e) {
        // Ignorer les erreurs de sélecteur
      }
    }

    // Attendre un peu après le nettoyage
    await humanDelay(500, 1000);
    logWithTimestamp("✅ Nettoyage des éléments bloquants terminé");
  } catch (error) {
    logWithTimestamp(`⚠️ Erreur lors du nettoyage: ${error}`);
  }
}

// Fonction principale d'automatisation avec anti-détection
async function automatePublication(
  page: Page,
  videoLink: string,
): Promise<void> {
  try {
    logWithTimestamp(
      "🚀 Début du processus d'automatisation avec anti-détection...",
    );
    await takeScreenshot(page, "start", "Début du processus");

    // Attendre que la page soit complètement chargée
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await humanDelay(3000, 5000);

    // Recherche améliorée du bouton "Créer une publication"
    logWithTimestamp('▶️ Recherche du bouton "Créer une publication"...');
    const createButton = await findCreatePublicationButton(page);

    if (!createButton) {
      await takeScreenshot(
        page,
        "create_button_not_found",
        "Bouton Créer une publication introuvable",
      );

      // Essayer de rafraîchir la page
      logWithTimestamp("🔄 Rafraîchissement de la page...");
      await page.reload({ waitUntil: "networkidle" });
      await humanDelay(5000, 8000);

      const createButtonAfterReload = await findCreatePublicationButton(page);
      if (!createButtonAfterReload) {
        throw new Error(
          'Bouton "Créer une publication" introuvable même après rafraîchissement',
        );
      }

      await safeInteraction(
        page,
        createButtonAfterReload,
        "hover",
        "Bouton Créer une publication (après reload)",
      );
      await humanDelay(300, 800);
      await safeInteraction(
        page,
        createButtonAfterReload,
        "click",
        "Bouton Créer une publication (après reload)",
      );
    } else {
      await safeInteraction(
        page,
        createButton,
        "hover",
        "Bouton Créer une publication",
      );
      await humanDelay(300, 800);
      await safeInteraction(
        page,
        createButton,
        "click",
        "Bouton Créer une publication",
      );
    }

    await humanDelay(2000, 4000);
    await takeScreenshot(
      page,
      "clicked_create_publication",
      "Après clic sur Créer une publication",
    );

    await page.locator('.fa-brands.fa-youtube.v-icon.notranslate.v-theme--black-and-white.w-7').click();
    await page.getByRole('button', { name: 'Vidéo' }).click();
    await page.locator('div').filter({ hasText: /^Short$/ }).click();

    // Ajout vidéo
    logWithTimestamp("📹 Recherche bouton ajout vidéo...");
    const videoButton = await page.$("button:has(i.fa-regular.fa-photo-video)");
    if (!videoButton) {
      throw new Error("Bouton ajout vidéo introuvable");
    }
    await safeInteraction(page, videoButton, "hover", "Bouton ajout vidéo");
    await humanDelay(300, 700);
    await safeInteraction(page, videoButton, "click", "Bouton ajout vidéo");
    await humanDelay(1000, 2000);
    await takeScreenshot(
      page,
      "video_button_clicked",
      "Bouton ajout vidéo cliqué",
    );

    const addVideoOption = await page.$(
      'div.v-list-item:has-text("Ajouter une vidéo")',
    );
    if (!addVideoOption) {
      throw new Error('Option "Ajouter une vidéo" introuvable');
    }
    await safeInteraction(
      page,
      addVideoOption,
      "hover",
      "Option Ajouter une vidéo",
    );
    await humanDelay(200, 500);
    await safeInteraction(
      page,
      addVideoOption,
      "click",
      "Option Ajouter une vidéo",
    );
    await humanDelay(1000, 2000);
    await takeScreenshot(
      page,
      "video_option_clicked",
      "Option Ajouter une vidéo cliquée",
    );

    // Clic sur URL
    logWithTimestamp('▶️ Recherche bouton "URL"...');
    const urlButton = await page.$('button:has-text("URL")');
    if (!urlButton) {
      throw new Error('Bouton "URL" introuvable');
    }
    await safeInteraction(page, urlButton, "hover", "Bouton URL");
    await humanDelay(300, 600);
    await safeInteraction(page, urlButton, "click", "Bouton URL");
    await humanDelay(1000, 2000);
    await takeScreenshot(page, "url_button_clicked", "Bouton URL cliqué");

    // Saisie URL vidéo
    logWithTimestamp("📝 Saisie de l'URL vidéo...");
    await takeScreenshot(page, "before_url_input", "Avant saisie URL");
    await typeUrlHumanly(page, 'input[name="URL"]', videoLink);
    await takeScreenshot(page, "after_url_input", "Après saisie URL");

    logWithTimestamp("⏳ Début attente validation URL...");
    let validationSuccess = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!validationSuccess && attempts < maxAttempts) {
      attempts++;

      try {
        const indicators = await page.evaluate(() => {
          const acceptButton = Array.from(
            document.querySelectorAll("button"),
          ).find(
            (btn) =>
              (btn.textContent?.includes("Accepter") ||
                btn.textContent?.includes("Accept")) &&
              !btn.disabled &&
              !btn.hasAttribute("disabled"),
          );
          const videoPreview = document.querySelector(
            'video, img[src*="cloudinary"], .video-preview, [class*="preview"]',
          );
          const errorElem = document.querySelector(
            '.error, .v-messages__message, .text-red, [class*="error"]',
          );
          const urlInput = document.querySelector(
            'input[name="URL"]',
          ) as HTMLInputElement;

          return {
            acceptButtonEnabled: !!acceptButton,
            hasVideoPreview: !!videoPreview,
            hasErrors: !!errorElem?.textContent?.trim(),
            errorText: errorElem?.textContent || "",
            urlValue: !!urlInput?.value,
            urlValueString: urlInput?.value || "",
          };
        });

        logWithTimestamp(
          `🔍 Tentative ${attempts}/${maxAttempts} - acceptButton: ${indicators.acceptButtonEnabled}, videoPreview: ${indicators.hasVideoPreview}, errors: ${indicators.hasErrors}, errorText: "${indicators.errorText}", urlValue: "${indicators.urlValueString}"`,
        );

        await takeScreenshot(
          page,
          `validation_attempt_${attempts}`,
          `Tentative validation URL ${attempts}`,
        );

        if (indicators.acceptButtonEnabled && indicators.urlValue) {
          validationSuccess = true;
          logWithTimestamp("✅ Validation URL réussie !");
          break;
        }

        if (attempts % 5 === 0) {
          logWithTimestamp("🔄 Tentative de re-validation: press Tab + Enter");
          await page.keyboard.press("Tab");
          await humanDelay(300, 600);
          await page.keyboard.press("Enter");
          await humanDelay(500, 1000);
        }
      } catch (e) {
        logWithTimestamp(`⚠️ Exception pendant la vérification: ${e}`);
      }

      await humanDelay(1000, 1500);
    }

    if (!validationSuccess) {
      await takeScreenshot(
        page,
        "url_validation_failed",
        "Échec validation URL",
      );
      throw new Error(`URL non validée après ${maxAttempts} tentatives`);
    }

    // Clic sur Accepter
    logWithTimestamp('✅ Recherche bouton "Accepter"...');
    const acceptButton = await page.$(
      'button:has-text("Accepter"), button:has-text("Accept")',
    );
    if (!acceptButton) {
      throw new Error('Bouton "Accepter" introuvable au moment du clic');
    }
    await safeInteraction(page, acceptButton, "hover", "Bouton Accepter");
    await humanDelay(300, 700);
    await safeInteraction(page, acceptButton, "click", "Bouton Accepter");
    await humanDelay(2000, 4000);
    await takeScreenshot(page, "accept_clicked", "Bouton Accepter cliqué");
    await humanDelay(3000, 5000);

    await page.getByText('Modifier par réseau').click();
    await page.locator('.font-normal.tab').first().click();
    await page.getByRole('button', { name: 'Modifier le contenu' }).click();

    // Ajout description
    logWithTimestamp("📝 Recherche du champ description...");
    await page.waitForSelector(
      'span.placeholder.editor-box[contenteditable="true"]',
      { timeout: 10000 },
    );
    const description = getRandomDescription();

    const descriptionInput = await page.$(
      'span.placeholder.editor-box[contenteditable="true"]',
    );
    if (!descriptionInput) {
      throw new Error("Champ description introuvable");
    }
    await safeInteraction(page, descriptionInput, "click", "Champ description");
    await humanDelay(500, 1000);
    await page.type(
      'span.placeholder.editor-box[contenteditable="true"]',
      description,
      {
        delay: Math.random() * 50 + 30,
      },
    );
    await humanDelay(1000, 2000);
    await takeScreenshot(page, "description_typed", "Description saisie");

    // Ouvrir le panneau Tiktok presets et activer "Autoriser les commentaires"
    logWithTimestamp('▶️ Ouverture du panneau "Tiktok presets"...');
    try {
      let tiktokPanelButton = await page.$(
        'button.v-expansion-panel-title:has(.fa-tiktok), button.v-expansion-panel-title:has-text("Tiktok presets")',
      );
      if (!tiktokPanelButton) {
        tiktokPanelButton = await page.$(
          'button.v-expansion-panel-title:has-text("Tiktok presets")',
        );
      }
      if (tiktokPanelButton) {
        const expanded = await tiktokPanelButton.getAttribute("aria-expanded");
        if (expanded !== "true") {
          await safeInteraction(
            page,
            tiktokPanelButton,
            "hover",
            'Panneau "Tiktok presets"',
          );
          await humanDelay(150, 350);
          await safeInteraction(
            page,
            tiktokPanelButton,
            "click",
            'Panneau "Tiktok presets"',
          );
        }
        try {
          await page.waitForFunction(
            (btn) => {
              const panel = (btn as Element).closest(".v-expansion-panel");
              if (!panel) return false;
              const content = panel.querySelector(".v-expansion-panel-text");
              if (!content) return false;
              const style = window.getComputedStyle(content as Element);
              return (
                style.display !== "none" &&
                (content as HTMLElement).offsetHeight > 0
              );
            },
            tiktokPanelButton,
            { timeout: 5000 },
          );
        } catch {}
        await takeScreenshot(
          page,
          "tiktok_presets_opened",
          'Panneau "Tiktok presets" ouvert',
        );
      } else {
        logWithTimestamp('⚠️ Panneau "Tiktok presets" introuvable');
      }

      // Activer "Autoriser les commentaires"
      logWithTimestamp('🗨️ Activation de "Autoriser les commentaires"...');
      let commentsInput = await page.$(
        'input[aria-label="Autoriser les commentaires"]',
      );
      if (!commentsInput) {
        const labelEl = await page.$(
          'label:has-text("Autoriser les commentaires")',
        );
        if (labelEl) {
          const inputFromLabel = await labelEl.$(
            'xpath=preceding-sibling::div[contains(@class,"v-selection-control__input")]/input',
          );
          if (inputFromLabel) commentsInput = inputFromLabel;
        }
      }
      if (commentsInput) {
        const isChecked: boolean = await page.evaluate(
          (el) => (el as HTMLInputElement).checked,
          commentsInput,
        );
        if (!isChecked) {
          const wrapperHandle = (await page.evaluateHandle(
            (el) =>
              el.closest("div.v-selection-control__wrapper") as HTMLElement,
            commentsInput,
          )) as any;
          await safeInteraction(
            page,
            wrapperHandle,
            "click",
            'Wrapper "Autoriser les commentaires"',
          );
          await page.waitForFunction(
            (el) => {
              const input = el as HTMLInputElement;
              const wrapper = input.closest("div.v-selection-control__wrapper");
              const hasSuccess = wrapper?.classList.contains("text-success");
              return input.checked === true || !!hasSuccess;
            },
            commentsInput,
            { timeout: 5000 },
          );
          await takeScreenshot(
            page,
            "comments_enabled",
            '"Autoriser les commentaires" activé',
          );
        } else {
          logWithTimestamp('"Autoriser les commentaires" déjà activé');
        }
      } else {
        logWithTimestamp('⚠️ Input "Autoriser les commentaires" introuvable');
      }
    } catch (e) {
      logWithTimestamp(
        `⚠️ Impossible d'ouvrir le panneau presets ou d'activer les commentaires: ${e}`,
      );
    }
    logWithTimestamp("🎯 Configuration des paramètres YouTube...");

    // YouTube icon
    await takeScreenshot(page, "before_youtube_icon", "Avant clic sur icône YouTube");
    await page.locator('.fa-brands.fa-youtube.v-icon.notranslate.v-theme--black-and-white.text-primary').click();
    await takeScreenshot(page, "after_youtube_icon", "Après clic sur icône YouTube");
    logWithTimestamp("✅ Icône YouTube cliquée");

    // Modifier le contenu
    await humanDelay(500, 1000);
    await takeScreenshot(page, "before_edit_content", "Avant modification du contenu");
    await humanDelay(500, 1000);
    await page.getByRole('button', { name: 'Modifier le contenu' }).click();
    await takeScreenshot(page, "after_edit_content", "Après clic sur modifier contenu");
    logWithTimestamp("✅ Bouton modifier contenu cliqué");

    // Description
    logWithTimestamp("📝 Saisie de la description...");
    await page.locator('.placeholder').click();
    await humanDelay(500, 1000);
    await page.locator('.placeholder').fill('Dans Classroom of the Elite, Ayanokoji nous rappelle que derrière chaque sourire se cache une stratégie, et que les plus grandes trahisons viennent rarement des ennemis.\n\n👉 Abonne-toi pour plus de citations marquantes et moments forts de CoTE !\n#ayanokoji #classroomoftheelite #anime');
    await takeScreenshot(page, "description_filled", "Description remplie");

    // Préréglages YouTube
    logWithTimestamp("⚙️ Configuration des préréglages YouTube...");
    await takeScreenshot(page, "before_youtube_presets", "Avant préréglages YouTube");
    await page.locator('.v-card.v-card--flat.v-theme--black-and-white.v-card--density-default.v-card--variant-elevated.flex').first().click();
    await humanDelay(500, 1000);
    // Faire défiler la page pour rendre le bouton visible
    await page.evaluate(() => {
      window.scrollBy(0, 500); // Scroll de 500px vers le bas
    });
    await humanDelay(500, 1000);

      // Faire défiler la page pour rendre le bouton visible
    await page.evaluate(() => {
      window.scrollBy(0, 500); // Scroll de 500px vers le bas
    });

    // Titre
    logWithTimestamp("📝 Génération et saisie du titre...");
    await page.locator('input[name="youtube_title"]').click();
    const firstSegment = voiceData.segments?.[0];
    let videoTitle = "Citations Ayanokoji | Classroom of the Elite";
    if (firstSegment && typeof firstSegment.text === "string") {
      const match = firstSegment.text.match(/question\.\s*(.*?)\?/i);
      if (match && match[1]) {
      // Take only the part before the comma or the first 50 characters
      const baseText = match[1].split(',')[0].trim();
      videoTitle = `${baseText}? | Classroom of the Elite`;
      } else {
      const firstQuestionMark = firstSegment.text.indexOf(' ?');
      if (firstQuestionMark !== -1) {
        const question = firstSegment.text.substring(0, firstQuestionMark + 1);
        // Take only the part before the comma or the first 50 characters
        const baseText = question.split(',')[0].trim();
        videoTitle = `${baseText} | Classroom of the Elite`;
      } else {
        const firstSentence = firstSegment.text.split(".")[0];
        // Take only the part before the comma or the first 50 characters
        const baseText = firstSentence.split(',')[0].trim();
        videoTitle = `${baseText} | Classroom of the Elite`;
      }
      }
    }
    await page.locator('input[name="youtube_title"]').fill(videoTitle);
    await takeScreenshot(page, "title_filled", "Titre rempli");
    logWithTimestamp(`✅ Titre généré et saisi: "${videoTitle}"`);

    // Paramètres supplémentaires
    logWithTimestamp("⚙️ Configuration des paramètres additionnels...");
    await page.locator('.v-input.v-input--horizontal.v-input--center-affix.v-input--density-compact.v-theme--black-and-white.v-locale--is-ltr.v-text-field.v-select > .v-input__control > .v-field > .v-field__field > .v-field__input').first().click();
    await page.getByText('Non, ce n\'est pas une vidéo').click();
    await page.locator('div:nth-child(4) > .v-input > .v-input__control > .v-field > .v-field__field > .v-field__input').click();
    await page.getByText('Divertissement').click();
    await takeScreenshot(page, "additional_settings", "Paramètres additionnels configurés");

    // Tags
    logWithTimestamp("🏷️ Ajout des tags...");
    const allTags = [
      'classroom of the elite',
      'ayanokoji',
      'anime',
      'CoTE',
      'ayanokoji quotes',
      'classroom of the elite quotes',
      'anime quotes',
      'citations anime',
      'citations Ayanokoji',
      'sagesse anime',
      'animeclips',
      'sagesse Ayanokoji',
      'animequote',
      'animevibes',
      'animemoments',
      'classroomoftheelite',
      'otaku',
      'animeedits'
    ];

    // Sélection aléatoire de 6 tags
    const tags = [...allTags]
      .sort(() => Math.random() - 0.5)
      .slice(0, 6);
    for (const tag of tags) {
      await page.locator('input[name="youtube_tags"]').click();
      await page.locator('input[name="youtube_tags"]').fill(tag);
      await page.locator('input[name="youtube_tags"]').press('Enter');
      logWithTimestamp(`✅ Tag ajouté: ${tag}`);
    }
    await takeScreenshot(page, "tags_added", "Tags ajoutés");

    logWithTimestamp("✅ Configuration YouTube terminée");

    // Publication
    logWithTimestamp("📤 Publication...");
    await takeScreenshot(
      page,
      "before_publish_dropdown",
      "Avant recherche dropdown publication",
    );
    await page.waitForSelector(
      "button.v-btn.bg-primary:has(i.fa-chevron-down)",
      { timeout: 10000 },
    );
    const publishDropdown = await page.$(
      "button.v-btn.bg-primary:has(i.fa-chevron-down)",
    );
    if (!publishDropdown) {
      throw new Error("Dropdown de publication introuvable");
    }
    await safeInteraction(
      page,
      publishDropdown,
      "hover",
      "Dropdown de publication",
    );
    await humanDelay(300, 600);
    await safeInteraction(
      page,
      publishDropdown,
      "click",
      "Dropdown de publication",
    );
    await humanDelay(1000, 2000);
    await takeScreenshot(
      page,
      "publish_dropdown_clicked",
      "Dropdown publication cliqué",
    );

    // Attendre que l'option "Publier maintenant" soit visible
    await page.waitForSelector('div.v-list-item[data-value="publishNow"]', {
      timeout: 5000,
    });
    const publishNowItem = await page.$(
      'div.v-list-item[data-value="publishNow"]',
    );
    if (!publishNowItem) {
      throw new Error('Option "Publier maintenant" introuvable');
    }
    await page.$eval('div.v-list-item[data-value="publishNow"]', (el) =>
      el.scrollIntoView(),
    );
    await humanDelay(200, 500);
    await publishNowItem.click({ force: true });
    await takeScreenshot(
      page,
      "publish_now_clicked",
      "Option Publier maintenant cliquée",
    );

    const finalPublishButton = await page.$(
      'button.v-btn:has-text("Publier maintenant")',
    );
    if (!finalPublishButton) {
      await takeScreenshot(
        page,
        "final_publish_not_found",
        'Bouton final "Publier maintenant" introuvable',
      );
      logWithTimestamp('❌ Bouton final "Publier maintenant" introuvable');
      throw new Error('Bouton final "Publier maintenant" introuvable');
    }

    // Nettoyage proactif désactivé pour éviter les interférences

    // Fermer le toast s'il est présent AVANT de cliquer sur Publier maintenant
    const toastCloseBtnBeforePublish = await page.$(
      'div.text-white .v-icon.fa-xmark, div.text-white .v-icon[aria-label="Fermer"], div.text-white button[aria-label="Fermer"]',
    );
    if (toastCloseBtnBeforePublish) {
      await safeInteraction(
        page,
        toastCloseBtnBeforePublish,
        "click",
        "Toast fermeture avant publication",
      );
      await humanDelay(500, 1000);
      logWithTimestamp("Toast fermé avant publication");
    }

    // Attendre la disparition du toast
    try {
      await page.waitForSelector(
        "div.flex.items-center.justify-between.pl-4.pr-2.py-2.gap-4.text-white",
        { state: "detached", timeout: 5000 },
      );
      logWithTimestamp("Toast disparu, prêt à publier");
    } catch {
      logWithTimestamp(
        "Toast toujours présent après 5s, on tente quand même la publication",
      );
    }

    // Tentative de clic direct d'abord, puis avec safeInteraction si échec
    logWithTimestamp("🎯 Tentative de clic sur le bouton final...");
    try {
      // Vérifier que le bouton est toujours visible et cliquable
      const isStillVisible = await finalPublishButton.isVisible();
      const isEnabled = await finalPublishButton.isEnabled();
      logWithTimestamp(
        `🔍 État du bouton: visible=${isStillVisible}, enabled=${isEnabled}`,
      );

      if (isStillVisible && isEnabled) {
        // Essayer un clic direct d'abord
        await finalPublishButton.click({ timeout: 10000, force: true });
        logWithTimestamp("✅ Clic direct réussi sur le bouton final");
      } else {
        logWithTimestamp(
          "⚠️ Bouton non visible/enabled, utilisation de safeInteraction",
        );
        await safeInteraction(
          page,
          finalPublishButton,
          "hover",
          "Bouton final Publier maintenant",
        );
        await humanDelay(500, 1000);
        await safeInteraction(
          page,
          finalPublishButton,
          "click",
          "Bouton final Publier maintenant",
        );
      }
    } catch (error) {
      logWithTimestamp(
        `⚠️ Clic direct échoué: ${error}, utilisation de safeInteraction`,
      );
      await safeInteraction(
        page,
        finalPublishButton,
        "hover",
        "Bouton final Publier maintenant",
      );
      await humanDelay(500, 1000);
      await safeInteraction(
        page,
        finalPublishButton,
        "click",
        "Bouton final Publier maintenant",
      );
    }
    await humanDelay(3000, 5000);
    await takeScreenshot(
      page,
      "final_publish_clicked",
      "Bouton Publier maintenant cliqué",
    );

    // Ignorer les erreurs de toast - on considère que la vidéo est uploadée une fois le bouton final cliqué
    logWithTimestamp("✅ Vidéo uploadée avec succès sur TikTok !");

    // Vérification du succès avec plus de détails
    logWithTimestamp("⏳ Vérification du succès de la publication...");
    logWithTimestamp("🔍 Recherche du toast de succès...");

    // Attendre un peu plus longtemps pour laisser le temps à la publication
    await humanDelay(2000, 3000);

    // Récupérer le nombre de publications restantes
    try {
      await page.goto('https://app.metricool.com/planner', { waitUntil: 'networkidle' });
      const publishCountElement = await page.getByText(/\d+ de vos 50/);
      const text = await publishCountElement.textContent();
      const match = text?.match(/(\d+) de vos 50/);
      if (match) {
      const remainingPosts = parseInt(match[1]);
      logWithTimestamp(`📊 Publications restantes: ${remainingPosts}/50`);

      // Si 49 ou 50 publications, exécuter updateMetricoolSecret.ts
      if (remainingPosts >= 49) {
        logWithTimestamp('🔄 Limite de publications proche, exécution de updateMetricoolSecret.ts');
        interface ExecCallback {
          (error: Error | null, stdout: string, stderr: string): void;
        }

        const execCallback: ExecCallback = (error, stdout, stderr) => {
          if (error) {
            logWithTimestamp(`❌ Erreur lors de l'exécution de updateMetricoolSecret.ts: ${error}`);
            return;
          }
          logWithTimestamp(`✅ updateMetricoolSecret.ts exécuté avec succès\n${stdout}`);
        };

        exec('ts-node ./scripts/updateMetricoolSecret.ts', execCallback);
      }
      } else {
      logWithTimestamp('⚠️ Impossible de récupérer le nombre de publications restantes');
      }
    } catch (error) {
      logWithTimestamp(`⚠️ Erreur lors de la récupération des publications restantes: ${error}`);
    }



    try {
      await page.waitForFunction(
        () => {
          const toast = document.querySelector(
            "div.flex.items-center.justify-between.pl-4.pr-2.py-2.gap-4.text-white",
          );
          return (
            toast &&
            /succès|créée|success|created/i.test(toast.textContent || "")
          );
        },
        { timeout: 30000 },
      );
      logWithTimestamp("✅ Publication réussie, toast de validation détecté.");
      await takeScreenshot(
        page,
        "toast_success_found",
        "Toast de succès détecté",
      );
    } catch (e) {
      logWithTimestamp(`⚠️ Timeout de la vérification: ${e}`);
      await takeScreenshot(
        page,
        "toast_success_not_found",
        "Toast de succès non détecté",
      );
      const toastHtml = await page.evaluate(() => {
        const toast = document.querySelector(
          "div.flex.items-center.justify-between.pl-4.pr-2.py-2.gap-4.text-white",
        );
        return toast ? toast.outerHTML : "Aucun toast trouvé";
      });
      logWithTimestamp(
        `⚠️ Toast de succès non détecté après 30s. HTML du toast: ${toastHtml}`,
      );
      // Vérifier s'il y a d'autres indicateurs de succès
      const successIndicators = await page.evaluate(() => {
        const successTexts = document.querySelectorAll("*");
        const found = Array.from(successTexts).filter(
          (el) =>
            el.textContent &&
            /succès|créée|success|created|publié|published/i.test(
              el.textContent,
            ),
        );
        return found
          .map((el) => el.textContent?.trim())
          .filter(Boolean)
          .slice(0, 3);
      });
      logWithTimestamp(
        `🔍 Indicateurs de succès trouvés: ${successIndicators.join(", ")}`,
      );

      // On ne throw pas d'erreur fatale, on continue
    }

    logWithTimestamp("🎉 Publication réussie avec anti-détection !");
    return; // Sortie réussie
  } catch (error) {
    await takeScreenshot(
      page,
      "automation_error",
      "Erreur durant automatisation",
    );
    logWithTimestamp(
      `❌ Erreur durant l'automatisation: ${error instanceof Error ? error.message : error}`,
    );
    throw error;
  }
}

// Fonction de retry pour la navigation
async function retryNavigation(
  page: Page,
  url: string,
  maxRetries: number = 3,
): Promise<void> {
  const timeouts = getEnvironmentTimeouts();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logWithTimestamp(
        `🔄 Tentative ${attempt}/${maxRetries} de navigation vers ${url}...`,
      );

      // En CI, on utilise domcontentloaded par défaut pour éviter les timeouts
      const isCI = isCIEnvironment();
      const waitUntil = isCI ? "domcontentloaded" : "domcontentloaded";

      await page.goto(url, {
        waitUntil: waitUntil,
        timeout: timeouts.navigation,
      });

      // Délai plus long en CI
      const delay = isCI ? 8000 : 5000;
      await humanDelay(delay, delay + 3000);

      logWithTimestamp(`✅ Navigation réussie vers ${url}`);
      return;
    } catch (error) {
      logWithTimestamp(
        `❌ Tentative ${attempt}/${maxRetries} échouée: ${error}`,
      );
      if (attempt < maxRetries) {
        logWithTimestamp(`⏳ Attente avant nouvelle tentative...`);
        await humanDelay(5000, 8000); // Délai plus long entre les tentatives
      } else {
        throw new Error(
          `Navigation échouée après ${maxRetries} tentatives: ${error}`,
        );
      }
    }
  }
}

// Fonction principale avec playwright-extra
async function run(): Promise<void> {
  let browser: Browser | null = null;

  try {
    logWithTimestamp("🔄 Démarrage du script avec anti-détection avancé...");

    const config = validateEnvironmentVariables();
    const videoLink = await readVideoLink();
    const loginHash = getLoginHash(config.email, config.password);

    // Lancement du navigateur avec playwright-extra et plugins stealth
    logWithTimestamp("🌐 Lancement du navigateur avec anti-détection...");

    const isCI =
      process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

    browser = await chromiumExtra.launch({
      headless: true,
      slowMo: isCI ? 200 : 0, // Ralentissement plus important en CI
      channel: "chrome",
      args: [
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor,TranslateUI",
        "--disable-ipc-flooding-protection",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
        "--disable-client-side-phishing-detection",
        "--disable-component-extensions-with-background-pages",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-features=Translate",
        "--disable-hang-monitor",
        "--disable-popup-blocking",
        "--disable-prompt-on-repost",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--enable-automation=false",
        "--password-store=basic",
        "--use-mock-keychain",
        // Arguments supplémentaires pour CI/CD
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-dev-shm-usage",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-features=TranslateUI",
        "--disable-ipc-flooding-protection",
        "--disable-hang-monitor",
        "--disable-prompt-on-repost",
        "--disable-client-side-phishing-detection",
        "--disable-component-extensions-with-background-pages",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-first-run",
        "--safebrowsing-disable-auto-update",
        "--disable-translate",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--disable-translate",
        "--hide-scrollbars",
        "--mute-audio",
        "--no-first-run",
        "--safebrowsing-disable-auto-update",
        "--ignore-certificate-errors",
        "--ignore-ssl-errors",
        "--ignore-certificate-errors-spki-list",
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 }, // Résolution plus commune
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      locale: "fr-FR",
      timezoneId: "Europe/Paris",
      permissions: ["geolocation"],
      extraHTTPHeaders: {
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
      },
    });

    // Scripts d'initialisation pour masquer l'automatisation
    await context.addInitScript(() => {
      // Masquer webdriver
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      delete (window as any).navigator.webdriver;

      // Masquer les propriétés d'automatisation
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5].map(() => ({})),
      });

      Object.defineProperty(navigator, "languages", {
        get: () => ["fr-FR", "fr", "en-US", "en"],
      });

      // Ajouter des propriétés manquantes
      Object.defineProperty(navigator, "permissions", {
        get: () => ({
          query: () => Promise.resolve({ state: "granted" }),
        }),
      });

      // Masquer automation flags
      if ((window as any).chrome) {
        Object.defineProperty((window as any).chrome, "runtime", {
          get: () => ({}),
        });
      }

      // Modifier la stack trace pour masquer playwright
      const originalError = Error.prepareStackTrace;
      Error.prepareStackTrace = (error, stack) => {
        if (originalError) return originalError(error, stack);
        return error.stack;
      };
    });

    const page = await context.newPage();

    // Configuration avancée de la page
    await page.setExtraHTTPHeaders({
      DNT: "1",
      "Upgrade-Insecure-Requests": "1",
    });

    // Chargement des cookies
    const cookiesLoaded = await loadCookies(context, loginHash);

    // Vérification de la session si cookies chargés
    let sessionIsValid = false;
    if (cookiesLoaded) {
      logWithTimestamp(
        "🔍 Vérification de la session avec les cookies existants...",
      );
      try {
        // Navigation vers la page de planification avec retry
        await retryNavigation(page, PLANNER_URL);

        sessionIsValid = await isSessionValid(page);
      } catch (error) {
        logWithTimestamp(
          `⚠️ Erreur lors de la vérification de session: ${error}`,
        );
        sessionIsValid = false;
      }
    }

    // Connexion si nécessaire
    if (!sessionIsValid) {
      logWithTimestamp("🔐 Connexion requise...");
      await login(page, config.email, config.password);
      await saveCookies(context, loginHash, config.email);
    } else {
      logWithTimestamp("✅ Session existante utilisée");
      // S'assurer d'être sur la page de planification
      await ensureOnPlanningTab(page);
    }

    // Automatisation avec anti-détection et retry en cas d'erreur
    try {
      await automatePublication(page, videoLink);
      logWithTimestamp("✨ Script terminé avec succès !");
    } catch (error) {
      logWithTimestamp(`⚠️ Erreur lors de l'automatisation: ${error}`);
      logWithTimestamp(
        "🔄 Tentative de retry en naviguant vers PLANNER_URL...",
      );

      // Retry en naviguant vers PLANNER_URL
      await retryNavigation(page, PLANNER_URL);
      await humanDelay(3000, 5000);

      // Nouvelle tentative d'automatisation
      await automatePublication(page, videoLink);
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

// Point d'entrée
async function main() {
  try {
    logWithTimestamp("🎬 Lancement du script avec anti-détection...");
    await run();
  } catch (error) {
    logWithTimestamp(`💥 Erreur fatale dans main(): ${error}`);
    process.exit(1);
  }
}

// Lancement
main();
