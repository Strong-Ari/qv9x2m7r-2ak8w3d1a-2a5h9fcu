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

async function processEmoji(emoji: string): Promise<void> {
  const inputFile = path.join('emojis', `${emoji}.gif`);
  const outputFile = path.join('emojis', `${emoji}_processed.gif`);

  const command = [
    'ffmpeg',
    '-y',
    '-i', inputFile,
    '-vf', 'scale=128:128:flags=lanczos,split[v1][v2];[v1]palettegen=reserve_transparent=true[palette];[v2][palette]paletteuse=alpha_threshold=128',
    '-gifflags', '+transdiff',
    '-c:v', 'gif',
    outputFile
  ].join(' ');

  try {
    await execAsync(command);
    console.log(`✅ Emoji traité: ${emoji}`);
  } catch (error) {
    console.error(`❌ Erreur lors du traitement de ${emoji}:`, (error as Error).message);
  }
}

async function applyEmojiToVideo(videoPath: string, emojiPath: string, timestamp: number, outputPath: string): Promise<void> {
  // Calculer les timestamps pour l'animation
  const fadeDuration = 0.5; // Durée du fade in/out
  const scaleDuration = 0.3; // Durée de l'animation de scale
  const displayDuration = 3; // Durée totale d'affichage

  const startTime = timestamp;
  const endTime = timestamp + displayDuration;
  const fadeOutStart = endTime - fadeDuration;

  const filterComplex = `[1:v]format=rgba,scale=128:128,fade=in:st=${startTime}:d=${fadeDuration}:alpha=1,fade=out:st=${fadeOutStart}:d=${fadeDuration}:alpha=1[anim];[0:v][anim]overlay=x='(W-w)/2':y='(H-h)/2':enable='between(t,${startTime},${endTime})'[v]`;

  const command = [
    'ffmpeg',
    '-y',
    '-i', videoPath,
    '-i', emojiPath,
    '-filter_complex', `"${filterComplex}"`,
    '-map', '[v]',
    '-map', '0:a',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
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

    // 2. Traiter chaque emoji
    console.log('\n🔄 Traitement des GIFs...');
    for (const { emoji } of emojiTimestamps) {
      if (checkIfFileExists(`${emoji}.gif`)) {
        await processEmoji(emoji);
      } else {
        console.log(`⚠️ Emoji manquant: ${emoji}`);
      }
    }

    // 3. Appliquer les emojis à la vidéo un par un
    console.log('\n🎥 Application des emojis à la vidéo...');
    let currentInput = 'output_final.mp4';
    let index = 0;

    for (const { emoji, start } of emojiTimestamps) {
      const processedEmojiPath = path.join('emojis', `${emoji}_processed.gif`);
      if (!fs.existsSync(processedEmojiPath)) {
        console.log(`⚠️ Emoji traité manquant: ${emoji}`);
        continue;
      }

      const outputPath = index === emojiTimestamps.length - 1
        ? 'output_with_emojis.mp4'
        : `temp_output_${index}.mp4`;

      await applyEmojiToVideo(currentInput, processedEmojiPath, start, outputPath);

      if (currentInput !== 'output_final.mp4') {
        fs.unlinkSync(currentInput); // Supprimer le fichier temporaire précédent
      }
      currentInput = outputPath;
      index++;
    }

    console.log('\n✨ Traitement terminé!');
    console.log('📦 Fichier final: output_with_emojis.mp4');

    // Nettoyer les fichiers temporaires
    console.log('\n🧹 Nettoyage des fichiers temporaires...');
    for (const { emoji } of emojiTimestamps) {
      const processedPath = path.join('emojis', `${emoji}_processed.gif`);
      if (fs.existsSync(processedPath)) {
        fs.unlinkSync(processedPath);
      }
    }

  } catch (error) {
    console.error('\n❌ Erreur:', (error as Error).message);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main().catch(console.error);
}
