import type { Page } from "playwright";
import { logWithTimestamp, humanDelay } from "../utils";
import { takeScreenshot } from "../services/screenshot.service";
import { safeInteraction, findCreatePublicationButton, typeUrlHumanly, closeToastIfVisible } from "../services/page.service";
import { getRandomDescription } from "../models/description.model";

const voiceData = require("../../../subs/ayanokoji-voice.json");
const { exec } = require("child_process");

// ─── Génération du titre YouTube ───────────────────────────────────────────────

function generateYoutubeTitle(): string {
  const firstSegment = voiceData.segments?.[0];
  let videoTitle = "Citations Ayanokoji | Classroom of the Elite";

  if (firstSegment && typeof firstSegment.text === "string") {
    const match = firstSegment.text.match(/question\.\s*(.*?)\?/i);
    if (match && match[1]) {
      videoTitle = `${match[1].split(",")[0].trim()}? | Classroom of the Elite`;
    } else {
      const firstQuestionMark = firstSegment.text.indexOf(" ?");
      if (firstQuestionMark !== -1) {
        const question = firstSegment.text.substring(0, firstQuestionMark + 1);
        videoTitle = `${question.split(",")[0].trim()} | Classroom of the Elite`;
      } else {
        const firstSentence = firstSegment.text.split(".")[0];
        videoTitle = `${firstSentence.split(",")[0].trim()} | Classroom of the Elite`;
      }
    }
  }
  return videoTitle;
}

// ─── Configuration TikTok ──────────────────────────────────────────────────────

async function configureTikTok(page: Page, videoLink: string): Promise<void> {
  logWithTimestamp("🎬 Configuration TikTok...");

  // Clic bouton créer une publication
  logWithTimestamp('▶️ Recherche du bouton "Créer une publication"...');
  let createButton = await findCreatePublicationButton(page);

  if (!createButton) {
    await takeScreenshot(page, "create_button_not_found", "Bouton Créer une publication introuvable");
    logWithTimestamp("🔄 Rafraîchissement de la page...");
    await page.reload({ waitUntil: "networkidle" });
    await humanDelay(5000, 8000);
    createButton = await findCreatePublicationButton(page);
    if (!createButton) throw new Error('Bouton "Créer une publication" introuvable même après rafraîchissement');
  }

  await safeInteraction(page, createButton, "hover", "Bouton Créer une publication");
  await humanDelay(300, 800);
  await safeInteraction(page, createButton, "click", "Bouton Créer une publication");
  await humanDelay(2000, 4000);
  await takeScreenshot(page, "clicked_create_publication", "Après clic sur Créer une publication");

  await page.locator(".fa-brands.fa-youtube.v-icon.notranslate.v-theme--black-and-white.w-7").click();
  logWithTimestamp('⏳ Recherche du bouton "Vidéo"...');
  try {
    await page.getByRole("button", { name: "Vidéo" }).waitFor({ 
      state: 'visible', 
      timeout: 8000 
    });
    await page.getByRole("button", { name: "Vidéo" }).click();
  } catch (e) {
    logWithTimestamp(`⚠️ Bouton "Vidéo" non trouvé avec le rôle, essai du sélecteur de secours...`);
    const videoBtn = await page.$('button:has-text("Vidéo")');
    if (!videoBtn) throw new Error('Bouton "Vidéo" introuvable');
    await videoBtn.click();
  }
  await page.locator("div").filter({ hasText: /^Short$/ }).click();

  // Ajout vidéo
  logWithTimestamp("📹 Recherche bouton ajout vidéo...");
  const videoButton = await page.$("button:has(i.fa-regular.fa-photo-video)");
  if (!videoButton) throw new Error("Bouton ajout vidéo introuvable");
  await safeInteraction(page, videoButton, "hover", "Bouton ajout vidéo");
  await humanDelay(300, 700);
  await safeInteraction(page, videoButton, "click", "Bouton ajout vidéo");
  await humanDelay(1000, 2000);

  const addVideoOption = await page.$('div.v-list-item:has-text("Ajouter une vidéo")');
  if (!addVideoOption) throw new Error('Option "Ajouter une vidéo" introuvable');
  await safeInteraction(page, addVideoOption, "hover", "Option Ajouter une vidéo");
  await humanDelay(200, 500);
  await safeInteraction(page, addVideoOption, "click", "Option Ajouter une vidéo");
  await humanDelay(1000, 2000);

  // Clic URL
  logWithTimestamp('▶️ Recherche bouton "URL"...');
  const urlButton = await page.$('button:has-text("URL")');
  if (!urlButton) throw new Error('Bouton "URL" introuvable');
  await safeInteraction(page, urlButton, "hover", "Bouton URL");
  await humanDelay(300, 600);
  await safeInteraction(page, urlButton, "click", "Bouton URL");
  await humanDelay(1000, 2000);

  // Saisie URL
  logWithTimestamp("📝 Saisie de l'URL vidéo...");

  // Attendre que le champ input soit visible
  await page.waitForSelector('input[name="URL"]', { 
    state: 'visible', 
    timeout: 10000 
  });

  // Vérifier que c'est vraiment un input
  const urlInput = await page.$('input[name="URL"]');
  if (!urlInput) {
    throw new Error('Champ URL introuvable après attente');
  }

  // Saisir l'URL
  await typeUrlHumanly(page, 'input[name="URL"]', videoLink);
  await humanDelay(1000, 2000);

  // Attente validation URL
  logWithTimestamp("⏳ Début attente validation URL...");
  let validationSuccess = false;
  let attempts = 0;
  const maxAttempts = 30;

  while (!validationSuccess && attempts < maxAttempts) {
    attempts++;
    try {
      const indicators = await page.evaluate(() => {
        const acceptButton = Array.from(document.querySelectorAll("button")).find(
          (btn) =>
            (btn.textContent?.includes("Accepter") || btn.textContent?.includes("Accept")) &&
            !btn.disabled &&
            !btn.hasAttribute("disabled"),
        );
        const urlInput = document.querySelector('input[name="URL"]') as HTMLInputElement;
        return {
          acceptButtonEnabled: !!acceptButton,
          urlValueString: urlInput?.value || "",
          urlValue: !!urlInput?.value,
        };
      });

      logWithTimestamp(
        `🔍 Tentative ${attempts}/${maxAttempts} - acceptButton: ${indicators.acceptButtonEnabled}, urlValue: "${indicators.urlValueString}"`,
      );

      if (indicators.acceptButtonEnabled && indicators.urlValue) {
        validationSuccess = true;
        logWithTimestamp("✅ Validation URL réussie !");
        break;
      }

      if (attempts % 5 === 0) {
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
    await takeScreenshot(page, "url_validation_failed", "Échec validation URL");
    throw new Error(`URL non validée après ${maxAttempts} tentatives`);
  }

  // Clic Accepter
  logWithTimestamp('✅ Recherche bouton "Accepter"...');
  const acceptButton = await page.$('button:has-text("Accepter"), button:has-text("Accept")');
  if (!acceptButton) throw new Error('Bouton "Accepter" introuvable au moment du clic');
  await safeInteraction(page, acceptButton, "hover", "Bouton Accepter");
  await humanDelay(300, 700);
  await safeInteraction(page, acceptButton, "click", "Bouton Accepter");
  await humanDelay(2000, 4000);
  await takeScreenshot(page, "accept_clicked", "Bouton Accepter cliqué");
  await humanDelay(3000, 5000);

  await page.getByText("Modifier par réseau").click();
  await page.locator(".font-normal.tab").first().click();
  await page.getByRole("button", { name: "Modifier le contenu" }).click();

  // Description TikTok
  logWithTimestamp("📝 Recherche du champ description...");
  await page.waitForSelector('span.placeholder.editor-box[contenteditable="true"]', { timeout: 10000 });
  const description = getRandomDescription();
  const descriptionInput = await page.$('span.placeholder.editor-box[contenteditable="true"]');
  if (!descriptionInput) throw new Error("Champ description introuvable");
  await safeInteraction(page, descriptionInput, "click", "Champ description");
  await humanDelay(500, 1000);
  await page.type('span.placeholder.editor-box[contenteditable="true"]', description, {
    delay: Math.random() * 50 + 30,
  });
  await humanDelay(1000, 2000);
  await takeScreenshot(page, "description_typed", "Description saisie");

  // Panneau Tiktok presets
  logWithTimestamp('▶️ Ouverture du panneau "Tiktok presets"...');
  try {
    let tiktokPanelButton = await page.$(
      'button.v-expansion-panel-title:has(.fa-tiktok), button.v-expansion-panel-title:has-text("Tiktok presets")',
    );
    if (!tiktokPanelButton) {
      tiktokPanelButton = await page.$('button.v-expansion-panel-title:has-text("Tiktok presets")');
    }
    if (tiktokPanelButton) {
      const expanded = await tiktokPanelButton.getAttribute("aria-expanded");
      if (expanded !== "true") {
        await safeInteraction(page, tiktokPanelButton, "hover", 'Panneau "Tiktok presets"');
        await humanDelay(150, 350);
        await safeInteraction(page, tiktokPanelButton, "click", 'Panneau "Tiktok presets"');
      }

      // Autoriser les commentaires
      logWithTimestamp('🗨️ Activation de "Autoriser les commentaires"...');
      let commentsInput = await page.$('input[aria-label="Autoriser les commentaires"]');
      if (!commentsInput) {
        const labelEl = await page.$('label:has-text("Autoriser les commentaires")');
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
            (el) => el.closest("div.v-selection-control__wrapper") as HTMLElement,
            commentsInput,
          )) as any;
          await safeInteraction(page, wrapperHandle, "click", 'Wrapper "Autoriser les commentaires"');
          await takeScreenshot(page, "comments_enabled", '"Autoriser les commentaires" activé');
        }
      }
    }
  } catch (e) {
    logWithTimestamp(`⚠️ Impossible d'ouvrir le panneau presets: ${e}`);
  }
}

// ─── Configuration YouTube ─────────────────────────────────────────────────────

async function configureYoutube(page: Page): Promise<void> {
  logWithTimestamp("🎯 Configuration des paramètres YouTube...");

  await takeScreenshot(page, "before_youtube_icon", "Avant clic sur icône YouTube");
  await page.locator(".fa-brands.fa-youtube.v-icon.notranslate.v-theme--black-and-white.text-primary").click();
  logWithTimestamp("✅ Icône YouTube cliquée");

  await humanDelay(500, 1000);
  await page.getByRole("button", { name: "Modifier le contenu" }).click();
  logWithTimestamp("✅ Bouton modifier contenu cliqué");

  // Description YouTube
  await page.locator(".placeholder").click();
  await humanDelay(500, 1000);
  await page.locator(".placeholder").fill(
    "Dans Classroom of the Elite, Ayanokoji nous rappelle que derrière chaque sourire se cache une stratégie, et que les plus grandes trahisons viennent rarement des ennemis.\n\n👉 Abonne-toi pour plus de citations marquantes et moments forts de CoTE !\n#ayanokoji #classroomoftheelite #anime",
  );
  await takeScreenshot(page, "description_filled", "Description remplie");

  // Préréglages YouTube
  await page
    .locator(
      ".v-card.v-card--flat.v-theme--black-and-white.v-card--density-default.v-card--variant-elevated.flex",
    )
    .first()
    .click();
  await humanDelay(500, 1000);
  await page.evaluate(() => window.scrollBy(0, 500));
  await humanDelay(500, 1000);
  await page.evaluate(() => window.scrollBy(0, 500));

  // Titre
  const videoTitle = generateYoutubeTitle();
  await page.locator('input[name="youtube_title"]').click();
  await page.locator('input[name="youtube_title"]').fill(videoTitle);
  await takeScreenshot(page, "title_filled", "Titre rempli");
  logWithTimestamp(`✅ Titre généré et saisi: "${videoTitle}"`);

  // Paramètres additionnels
  await page
    .locator(
      ".v-input.v-input--horizontal.v-input--center-affix.v-input--density-compact.v-theme--black-and-white.v-locale--is-ltr.v-text-field.v-select > .v-input__control > .v-field > .v-field__field > .v-field__input",
    )
    .first()
    .click();
  await page.getByText("Non, ce n'est pas une vidéo").click();
  await page.locator("div:nth-child(4) > .v-input > .v-input__control > .v-field > .v-field__field > .v-field__input").click();
  await page.getByText("Divertissement").click();
  await takeScreenshot(page, "additional_settings", "Paramètres additionnels configurés");

  // Tags
  logWithTimestamp("🏷️ Ajout des tags...");
  const allTags = [
    "classroom of the elite", "ayanokoji", "anime", "CoTE",
    "ayanokoji quotes", "classroom of the elite quotes", "anime quotes",
    "citations anime", "citations Ayanokoji", "sagesse anime",
    "animeclips", "sagesse Ayanokoji", "animequote", "animevibes",
    "animemoments", "classroomoftheelite", "otaku", "animeedits",
  ];

  const tags = [...allTags].sort(() => Math.random() - 0.5).slice(0, 6);
  for (const tag of tags) {
    await humanDelay(300, 600);
    const tagsInput = page.locator('input[name="youtube_tags"]');
    
    try {
      await tagsInput.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      await tagsInput.fill(tag, { timeout: 5000 });
      await tagsInput.press("Enter", { timeout: 5000 });
      logWithTimestamp(`✅ Tag ajouté: ${tag}`);
    } catch (e) {
      logWithTimestamp(`⚠️ Retentative pour le tag "${tag}"...`);
      await humanDelay(500, 1000);
      try {
        await tagsInput.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
        await tagsInput.click({ timeout: 5000, force: true }).catch(() => {});
        await tagsInput.fill(tag, { timeout: 5000 });
        await tagsInput.press("Enter", { timeout: 5000 });
        logWithTimestamp(`✅ Tag ajouté: ${tag}`);
      } catch (err) {
        logWithTimestamp(`❌ Impossible d'ajouter le tag "${tag}", on passe au suivant.`);
      }
    }
  }
  await takeScreenshot(page, "tags_added", "Tags ajoutés");
  logWithTimestamp("✅ Configuration YouTube terminée");
}

// ─── Publication ───────────────────────────────────────────────────────────────

async function publish(page: Page): Promise<void> {
  logWithTimestamp("📤 Publication...");

  await page.waitForSelector("button.v-btn.bg-primary:has(i.fa-chevron-down)", { timeout: 10000 });
  let publishDropdown = await page.$("button.v-btn.bg-primary:has(i.fa-chevron-down)");
  if (!publishDropdown) throw new Error("Dropdown de publication introuvable");

  await safeInteraction(page, publishDropdown, "hover", "Dropdown de publication");
  await humanDelay(300, 600);
  
  // Re-requêtage pour éviter l'erreur 'Element is not attached to the DOM' après un éventuel re-render
  publishDropdown = await page.$("button.v-btn.bg-primary:has(i.fa-chevron-down)");
  if (publishDropdown) {
    await safeInteraction(page, publishDropdown, "click", "Dropdown de publication");
  }
  await humanDelay(1000, 2000);

  await page.waitForSelector('div.v-list-item[data-value="publishNow"]', { timeout: 5000 });
  let publishNowItem = await page.$('div.v-list-item[data-value="publishNow"]');
  if (!publishNowItem) throw new Error('Option "Publier maintenant" introuvable');

  await page.$eval('div.v-list-item[data-value="publishNow"]', (el) => el.scrollIntoView());
  await humanDelay(200, 500);
  
  publishNowItem = await page.$('div.v-list-item[data-value="publishNow"]');
  if (publishNowItem) await publishNowItem.click({ force: true });

  let finalPublishButton = await page.$('button.v-btn:has-text("Publier maintenant")');
  if (!finalPublishButton) throw new Error('Bouton final "Publier maintenant" introuvable');

  // Fermer le toast avant publication
  const toastCloseBtn = await page.$(
    'div.text-white .v-icon.fa-xmark, div.text-white .v-icon[aria-label="Fermer"], div.text-white button[aria-label="Fermer"]',
  );
  if (toastCloseBtn) {
    await safeInteraction(page, toastCloseBtn, "click", "Toast fermeture avant publication");
    await humanDelay(500, 1000);
  }

  try {
    await page.waitForSelector("div.flex.items-center.justify-between.pl-4.pr-2.py-2.gap-4.text-white", {
      state: "detached",
      timeout: 5000,
    });
  } catch {}

  try {
    const isVisible = await finalPublishButton.isVisible();
    const isEnabled = await finalPublishButton.isEnabled();
    if (isVisible && isEnabled) {
      await finalPublishButton.click({ timeout: 10000, force: true });
      logWithTimestamp("✅ Clic direct réussi sur le bouton final");
    } else {
      await safeInteraction(page, finalPublishButton, "hover", "Bouton final Publier maintenant");
      await humanDelay(500, 1000);
      
      finalPublishButton = await page.$('button.v-btn:has-text("Publier maintenant")');
      if (finalPublishButton) {
        await safeInteraction(page, finalPublishButton, "click", "Bouton final Publier maintenant");
      }
    }
  } catch (error) {
    logWithTimestamp(`⚠️ Clic direct échoué: ${error}, utilisation de safeInteraction`);
    finalPublishButton = await page.$('button.v-btn:has-text("Publier maintenant")');
    if (finalPublishButton) {
      await safeInteraction(page, finalPublishButton, "hover", "Bouton final Publier maintenant");
      await humanDelay(500, 1000);
      finalPublishButton = await page.$('button.v-btn:has-text("Publier maintenant")');
      if (finalPublishButton) {
        await safeInteraction(page, finalPublishButton, "click", "Bouton final Publier maintenant");
      }
    }
  }

  await humanDelay(3000, 5000);
  await takeScreenshot(page, "final_publish_clicked", "Bouton Publier maintenant cliqué");
  logWithTimestamp("✅ Vidéo uploadée avec succès !");
}

// ─── Vérification du succès ────────────────────────────────────────────────────

async function verifyPublicationSuccess(page: Page): Promise<void> {
  logWithTimestamp("⏳ Vérification du succès de la publication...");
  await humanDelay(2000, 3000);

  // Vérifier les publications restantes et rafraîchir le secret si nécessaire
  try {
    await page.goto("https://app.metricool.com/planner", { waitUntil: "networkidle" });
    const publishCountElement = await page.getByText(/\d+ de vos 50/);
    const text = await publishCountElement.textContent();
    const match = text?.match(/(\d+) de vos 50/);
    if (match) {
      const remainingPosts = parseInt(match[1]);
      logWithTimestamp(`📊 Publications restantes: ${remainingPosts}/50`);
      if (remainingPosts >= 19) {
        logWithTimestamp("🔄 Limite de publications proche, exécution de updateMetricoolSecret.ts");
        exec("ts-node ./scripts/updateMetricoolSecret.ts", (error: Error | null, stdout: string) => {
          if (error) {
            logWithTimestamp(`❌ Erreur lors de l'exécution de updateMetricoolSecret.ts: ${error}`);
            return;
          }
          logWithTimestamp(`✅ updateMetricoolSecret.ts exécuté avec succès\n${stdout}`);
        });
      }
    }
  } catch (error) {
    logWithTimestamp(`⚠️ Erreur lors de la récupération des publications restantes: ${error}`);
  }

  // Toast de succès
  try {
    await page.waitForFunction(
      () => {
        const toast = document.querySelector(
          "div.flex.items-center.justify-between.pl-4.pr-2.py-2.gap-4.text-white",
        );
        return toast && /succès|créée|success|created/i.test(toast.textContent || "");
      },
      { timeout: 30000 },
    );
    logWithTimestamp("✅ Publication réussie, toast de validation détecté.");
    await takeScreenshot(page, "toast_success_found", "Toast de succès détecté");
  } catch (e) {
    logWithTimestamp(`⚠️ Toast de succès non détecté: ${e}`);
    await takeScreenshot(page, "toast_success_not_found", "Toast de succès non détecté");
  }
}

// ─── Point d'entrée du ViewModel ──────────────────────────────────────────────

export async function automatePublication(page: Page, videoLink: string): Promise<void> {
  try {
    logWithTimestamp("🚀 Début du processus d'automatisation avec anti-détection...");
    await takeScreenshot(page, "start", "Début du processus");

    // Attente networkidle (soft — ne bloque pas si timeout)
    try {
      await page.waitForLoadState("networkidle", { timeout: 15000 });
    } catch {
      logWithTimestamp("⚠️ Timeout networkidle lors de l'automatisation, on continue quand même...");
    }
    await humanDelay(3000, 5000);

    await configureTikTok(page, videoLink);
    await configureYoutube(page);
    await publish(page);
    await verifyPublicationSuccess(page);

    logWithTimestamp("🎉 Publication réussie avec anti-détection !");
  } catch (error) {
    await takeScreenshot(page, "automation_error", "Erreur durant automatisation");
    logWithTimestamp(`❌ Erreur durant l'automatisation: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}
