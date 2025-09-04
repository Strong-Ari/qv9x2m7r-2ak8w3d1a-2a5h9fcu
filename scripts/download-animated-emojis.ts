import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface EmojiData {
  text: string;
  start: number;
  reasoning: string;
  confidence: number;
  emoji?: string;
}

interface EmojiTimestamp {
  emoji: string;
  start: number;
}

async function loadEmojiData(): Promise<EmojiTimestamp[]> {
  const filePath = path.join('public', 'output-with-emojis.json');

  if (!fs.existsSync(filePath)) {
    throw new Error(`Le fichier ${filePath} n'existe pas`);
  }

  const jsonData = fs.readFileSync(filePath, 'utf-8');
  const emojiData: EmojiData[] = JSON.parse(jsonData);

  // Extraire seulement les entrées qui ont un emoji
  const emojiTimestamps: EmojiTimestamp[] = emojiData
    .filter(item => item.emoji)
    .map(item => ({
      emoji: item.emoji!,
      start: item.start
    }));

  console.log(`Chargé ${emojiTimestamps.length} emojis depuis ${filePath}`);
  return emojiTimestamps;
}

function checkIfFileExists(fileName: string, downloadDir: string): boolean {
  const filePath = path.join(downloadDir, fileName);
  return fs.existsSync(filePath);
}

async function waitForPageLoad(page: Page): Promise<void> {
  // Attendre que la page soit complètement chargée
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

async function searchEmoji(page: Page, emojiName: string): Promise<boolean> {
  try {
    // Attendre que la barre de recherche soit disponible et visible
    const searchInput = page.locator('input[placeholder="Find Emoji"]');
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });

    // Vider et remplir la barre de recherche en une seule opération
    await Promise.all([
      searchInput.click(),
      searchInput.fill(emojiName)
    ]);
    await page.waitForTimeout(300);

    console.log(`   🔍 Recherche pour: ${emojiName}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Erreur lors de la recherche: ${(error as Error).message}`);
    return false;
  }
}

async function selectFirstEmoji(page: Page): Promise<boolean> {
  try {
    // Attendre un court instant pour les résultats
    await page.waitForTimeout(300);

    // Utiliser un sélecteur plus précis pour le premier emoji visible et enabled
    const firstEmojiButton = page.locator('button[icon-item]:visible:not([disabled])').first();

    try {
      await firstEmojiButton.waitFor({ state: 'visible', timeout: 3000 });
      await firstEmojiButton.click();
      console.log(`   👆 Clic sur le premier emoji trouvé`);
      return true;
    } catch (error) {
      console.log(`   ⚠️ Pas d'emoji trouvé, tentative avec force click`);
      await firstEmojiButton.click({ force: true });
      return true;
    }

    // Si aucun bouton enabled trouvé, essayer avec une approche différente
    console.log(`   ⚠️  Aucun bouton enabled trouvé, tentative avec le premier visible`);
    const firstVisible = page.locator('button[icon-item]:visible').first();
    await firstVisible.waitFor({ state: 'attached', timeout: 5000 });

    // Forcer le clic même si disabled
    await firstVisible.click({ force: true });
    return true;

  } catch (error) {
    console.error(`   ❌ Erreur lors de la sélection: ${(error as Error).message}`);
    return false;
  }
}

async function waitForSidebar(page: Page): Promise<boolean> {
  try {
    const [sidebar, gifButton] = await Promise.all([
      page.locator('mat-sidenav[role="dialog"].mat-drawer-opened')
        .waitFor({ state: 'visible', timeout: 5000 }),
      page.locator('a.side-nav-links__button--gif:has-text("GIF")')
        .waitFor({ state: 'visible', timeout: 5000 })
    ]);

    console.log(`   ✅ Sidebar ouverte et bouton GIF disponible`);
    return true;
  } catch (error) {
    console.error(`   ❌ Sidebar non disponible: ${(error as Error).message}`);
    return false;
  }
}

async function downloadGif(page: Page, fileName: string, downloadDir: string): Promise<boolean> {
  try {
    // Chercher le bouton GIF dans la sidebar
    const gifButton = page.locator('a.side-nav-links__button--gif:has-text("GIF")');
    await gifButton.waitFor({ state: 'visible', timeout: 10000 });

    console.log(`   ⬇️  Démarrage du téléchargement...`);

    // Commencer le téléchargement
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      gifButton.click()
    ]);

    // Sauvegarder le fichier avec le nom de l'emoji
    const filePath = path.join(downloadDir, fileName);
    await download.saveAs(filePath);

    console.log(`   ✅ Téléchargé: ${fileName}`);
    return true;

  } catch (error) {
    console.error(`   ❌ Erreur de téléchargement: ${(error as Error).message}`);
    return false;
  }
}

async function closeSidebar(page: Page): Promise<void> {
  try {
    // Fermer la sidebar avec le bouton close
    const closeButton = page.locator('button[aria-label="close side panel"]');
    if (await closeButton.isVisible()) {
      await closeButton.click();
      await page.waitForTimeout(1000);
      console.log(`   🚪 Sidebar fermée`);
    }
  } catch (error) {
    console.log(`   ⚠️  Impossible de fermer la sidebar: ${(error as Error).message}`);
  }
}

async function downloadEmojis(): Promise<void> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: false,
      slowMo: 100 // Légère temporisation pour la stabilité
    });

    // Créer le dossier de téléchargement s'il n'existe pas
    const downloadDir = path.join(process.cwd(), 'emojis');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir);
    }

    // Configurer le contexte avec téléchargements
    const context: BrowserContext = await browser.newContext({
      acceptDownloads: true
    });

    const page: Page = await context.newPage();
    // Augmenter le timeout par défaut
    page.setDefaultTimeout(30000);

    console.log('🚀 Démarrage du téléchargement des emojis...');

    // Charger les données d'emojis depuis le fichier JSON
    const emojiTimestamps = await loadEmojiData();
    const uniqueEmojis = Array.from(new Set(emojiTimestamps.map(item => item.emoji)));
    console.log(`📦 ${uniqueEmojis.length} emojis uniques à télécharger`);

    // Aller sur la page principale une seule fois
    console.log('🌐 Chargement de la page principale...');
    await page.goto('https://googlefonts.github.io/noto-emoji-animation/', {
      waitUntil: 'networkidle'
    });
    await waitForPageLoad(page);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < uniqueEmojis.length; i++) {
      const emojiName = uniqueEmojis[i];
      const fileName = `${emojiName}.gif`;

      console.log(`\n📋 Traitement ${i + 1}/${uniqueEmojis.length}: ${emojiName}`);

      // Vérifier si le fichier existe déjà
      if (checkIfFileExists(fileName, downloadDir)) {
        console.log(`   ⏭️  Déjà téléchargé, passage au suivant`);
        skipCount++;
        continue;
      }

      let success = false;

      try {
        // 1. Rechercher l'emoji
        if (!await searchEmoji(page, emojiName)) {
          throw new Error('Échec de la recherche');
        }

        // 2. Sélectionner le premier emoji
        if (!await selectFirstEmoji(page)) {
          throw new Error('Échec de la sélection');
        }

        // 3. Attendre la sidebar
        if (!await waitForSidebar(page)) {
          throw new Error('Sidebar non disponible');
        }

        // 4. Télécharger le GIF
        if (!await downloadGif(page, fileName, downloadDir)) {
          throw new Error('Échec du téléchargement');
        }

        success = true;
        successCount++;

      } catch (error) {
        console.error(`   ❌ Erreur: ${(error as Error).message}`);
        errorCount++;
      } finally {
        // Toujours essayer de fermer la sidebar
        await closeSidebar(page);
      }

      // Petite pause entre les téléchargements
      await page.waitForTimeout(1000);
    }

    console.log('\n🎉 Téléchargement terminé!');
    console.log(`📊 Statistiques:`);
    console.log(`   ✅ Succès: ${successCount}`);
    console.log(`   ⏭️  Ignorés: ${skipCount}`);
    console.log(`   ❌ Erreurs: ${errorCount}`);

  } catch (error) {
    console.error('💥 Erreur fatale:', (error as Error).message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}


// Point d'entrée principal
async function main(): Promise<void> {
  try {
    console.log('🚀 Démarrage du script de téléchargement d\'emojis');
    console.log('📁 Dossier de destination: ./emojis/');
    console.log('📄 Fichier source: public/output-with-emojis.json');
    console.log('-'.repeat(50));

    await downloadEmojis();

  } catch (error) {
    console.error('💥 Erreur fatale:', (error as Error).message);
    process.exit(1);
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

export { downloadEmojis, generateFFmpegCommand, loadEmojiData };
