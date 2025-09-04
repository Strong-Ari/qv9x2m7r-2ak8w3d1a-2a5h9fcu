import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

  return emojiData
    .filter(item => item.emoji)
    .map(item => ({
      emoji: item.emoji!,
      start: item.start
    }));
}

function checkIfFileExists(fileName: string): boolean {
  return fs.existsSync(path.join(process.cwd(), 'emojis', fileName));
}

// Fonction supprimée car les GIFs sont déjà bien préparés

async function applyEmojiToVideo(videoPath: string, emojiPath: string, timestamp: number, outputPath: string, index: number): Promise<void> {
  // Calculer les timestamps pour l'animation
  const fadeDuration = 0.5; // Durée du fade in/out
  const displayDuration = 1.9; // Durée totale d'affichage

  const startTime = timestamp;
  const endTime = timestamp + displayDuration;
  const fadeOutStart = endTime - fadeDuration;

  // Variation aléatoire de ±30 pixels
  const randomOffset = () => Math.floor(Math.random() * 61) - 30; // -30 à +30

  // Alterner entre les trois zones focales et ajouter une variation aléatoire
  const zone = index % 3; // 0, 1 ou 2
  let baseX: string, baseY: string;

  // Position par défaut (à droite)
  baseX = 'W-w-100';
  baseY = 'H-h-200';

  if (zone === 0) { // Gauche
    baseX = '90';
    baseY = 'H-h-320';
  } else if (zone === 1) { // Centre
    baseX = 'W/2-w/2';
    baseY = 'H-h-420';
  }

  const position = `x=${baseX}+${randomOffset()}:y=${baseY}+${randomOffset()}`;

  // Taille différente selon la position
  const emojiSize = zone === 1 ? '300:300' : '145:145';

  const filterComplex = [
    '[1:v]format=rgba[fmt]',
    `[fmt]scale=${emojiSize}[scaled]`,
    '[scaled]fade=in:st=' + startTime + ':d=' + fadeDuration + ':alpha=1,fade=out:st=' + fadeOutStart + ':d=' + fadeDuration + ':alpha=1[withfade]',
    '[0:v][withfade]overlay=' + position + ':shortest=1:enable=\'between(t,' + startTime + ',' + endTime + ')\'[v]'
  ].join(';');

  const command = [
    'ffmpeg',
    '-y',
    '-i', videoPath,
    '-ignore_loop', '0',
    '-i', emojiPath,
    '-filter_complex', `"${filterComplex}"`,
    '-map', '[v]',
    '-map', '0:a',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'copy',
    outputPath
  ].join(' ');

  try {
    await execAsync(command);
    console.log(`✅ Emoji appliqué au timestamp ${timestamp}`);
  } catch (error) {
    console.error(`❌ Erreur lors de l'application de l'emoji:`, (error as Error).message);
  }
}

async function main() {
  try {
    console.log('🎬 Démarrage du processus...');

    // 1. Charger les données des emojis
    const emojiTimestamps = await loadEmojiData();
    console.log(`📄 ${emojiTimestamps.length} emojis trouvés dans le fichier JSON`);

    // Appliquer les emojis à la vidéo un par un
    console.log('\n🎥 Application des emojis à la vidéo...');
    let currentInput = 'output_final.mp4';
    let index = 0;

    for (const { emoji, start } of emojiTimestamps) {
      const emojiPath = path.join('emojis', `${emoji}.gif`);
      if (!fs.existsSync(emojiPath)) {
        console.log(`⚠️ Emoji manquant: ${emoji}`);
        continue;
      }

      const outputPath = index === emojiTimestamps.length - 1
        ? 'output_with_emojis.mp4'
        : `temp_output_${index}.mp4`;

      await applyEmojiToVideo(currentInput, emojiPath, start, outputPath, index);

      if (currentInput !== 'output_final.mp4') {
        fs.unlinkSync(currentInput); // Supprimer le fichier temporaire précédent
      }
      currentInput = outputPath;
      index++;
    }

    console.log('\n✨ Traitement terminé!');
    console.log('📦 Fichier final: output_with_emojis.mp4');

    console.log('\n✨ Vidéo générée avec succès!');

  } catch (error) {
    console.error('\n❌ Erreur:', (error as Error).message);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main().catch(console.error);
}
