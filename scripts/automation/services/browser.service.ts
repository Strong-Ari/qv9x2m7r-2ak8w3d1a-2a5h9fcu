import { addExtra } from "playwright-extra";
import { chromium } from "patchright";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, BrowserContext, Page } from "playwright";
import { isCIEnvironment, getEnvironmentTimeouts } from "../config";
import { logWithTimestamp, humanDelay } from "../utils";

// ─── Setup stealth ─────────────────────────────────────────────────────────────

const chromiumExtra = addExtra(chromium);
chromiumExtra.use(StealthPlugin());

// ─── Lancement du navigateur ───────────────────────────────────────────────────

export async function launchBrowser(): Promise<Browser> {
  logWithTimestamp("🌐 Lancement du navigateur avec anti-détection...");
  const isCI = isCIEnvironment();

  return chromiumExtra.launch({
    headless: isCI ? true : false,
    slowMo: isCI ? 200 : 0,
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
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-background-timer-throttling",
      "--disable-translate",
      "--disable-background-networking",
      "--hide-scrollbars",
      "--mute-audio",
      "--safebrowsing-disable-auto-update",
      "--ignore-certificate-errors",
      "--ignore-ssl-errors",
      "--ignore-certificate-errors-spki-list",
    ],
  });
}

// ─── Création du contexte ──────────────────────────────────────────────────────

export async function createBrowserContext(browser: Browser): Promise<BrowserContext> {
  const isCI = isCIEnvironment();
  const context = await browser.newContext({
    // En CI, utiliser une résolution desktop complète pour éviter que Metricool
    // ne bascule en layout mobile/hamburger qui cache le bouton "Create post"
    viewport: isCI ? { width: 1920, height: 1080 } : { width: 1366, height: 768 },
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
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    delete (window as any).navigator.webdriver;

    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5].map(() => ({})),
    });

    Object.defineProperty(navigator, "languages", {
      get: () => ["fr-FR", "fr", "en-US", "en"],
    });

    Object.defineProperty(navigator, "permissions", {
      get: () => ({
        query: () => Promise.resolve({ state: "granted" }),
      }),
    });

    if ((window as any).chrome) {
      Object.defineProperty((window as any).chrome, "runtime", {
        get: () => ({}),
      });
    }

    const originalError = Error.prepareStackTrace;
    Error.prepareStackTrace = (error, stack) => {
      if (originalError) return originalError(error, stack);
      return error.stack;
    };
  });

  return context;
}

// ─── Navigation avec retry ─────────────────────────────────────────────────────

export async function retryNavigation(
  page: Page,
  url: string,
  maxRetries: number = 3,
): Promise<void> {
  const timeouts = getEnvironmentTimeouts();
  const isCI = isCIEnvironment();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logWithTimestamp(`🔄 Tentative ${attempt}/${maxRetries} de navigation vers ${url}...`);
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: timeouts.navigation,
      });
      const delay = isCI ? 8000 : 5000;
      await humanDelay(delay, delay + 3000);
      logWithTimestamp(`✅ Navigation réussie vers ${url}`);
      return;
    } catch (error) {
      logWithTimestamp(`❌ Tentative ${attempt}/${maxRetries} échouée: ${error}`);
      if (attempt < maxRetries) {
        logWithTimestamp("⏳ Attente avant nouvelle tentative...");
        await humanDelay(5000, 8000);
      } else {
        throw new Error(`Navigation échouée après ${maxRetries} tentatives: ${error}`);
      }
    }
  }
}
