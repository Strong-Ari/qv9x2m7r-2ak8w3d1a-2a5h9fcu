import type { BrowserContext } from "playwright";
import { existsSync } from "fs";
import { promises as fs } from "fs";
import crypto from "crypto";
import { COOKIES_PATH, COOKIES_META_PATH, isCIEnvironment } from "../config";
import { logWithTimestamp } from "../utils";

// ─── Hash ───────────────────────────────────────────────────────────

export function getLoginHash(email: string, password: string): string {
  return crypto
    .createHash("sha256")
    .update(`${email}:${password}`)
    .digest("hex")
    .slice(0, 8);
}

// ─── Sauvegarde ─────────────────────────────────────────────────────────

export async function saveCookies(
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
    logWithTimestamp(`💾 Cookies sauvegardés avec succès (${cookies.length} cookies)`);
  } catch (error) {
    logWithTimestamp(`❌ Erreur lors de la sauvegarde des cookies: ${error}`);
    throw error;
  }
}

// ─── Chargement ─────────────────────────────────────────────────────────

export async function loadCookies(
  context: BrowserContext,
  expectedLoginHash: string,
): Promise<boolean> {
  try {
    const isCI = isCIEnvironment();

    // 🤖 En environnement CI (GitHub Actions), MetriCool rejette les sessions
    // des runners GHA. On force une authentification fraîche pour éviter
    // la redirection boucle login → /planner → login
    if (isCI) {
      logWithTimestamp(
        "🤖 Environnement CI détecté - Cookies ignorés pour forcer une authentification fraîche",
      );
      logWithTimestamp(
        "   Raison: MetriCool détecte les IP GHA et rejette les sessions mises en cache",
      );
      return false;
    }

    logWithTimestamp("🔍 Recherche du fichier de cookies...");
    if (!existsSync(COOKIES_PATH)) {
      logWithTimestamp("⚠️ Aucun fichier de cookies trouvé");
      return false;
    }

    if (!existsSync(COOKIES_META_PATH)) {
      logWithTimestamp("⚠️ Fichier meta des cookies manquant. Les cookies existants seront ignorés.");
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
      logWithTimestamp(`⚠️ Impossible de lire/valider le meta des cookies: ${e}. Ignorer ces cookies.`);
      return false;
    }

    const cookiesJSON = await fs.readFile(COOKIES_PATH, "utf8");
    const cookies = JSON.parse(cookiesJSON);
    if (!Array.isArray(cookies) || cookies.length === 0) {
      logWithTimestamp("⚠️ Fichier de cookies vide ou invalide");
      return false;
    }
    await context.addCookies(cookies);
    logWithTimestamp(`🔄 Cookies chargés avec succès (${cookies.length} cookies)`);
    return true;
  } catch (error) {
    logWithTimestamp(`❌ Erreur lors du chargement des cookies: ${error}`);
    return false;
  }
}
