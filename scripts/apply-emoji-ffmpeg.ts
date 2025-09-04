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
    '-vf', [
      'scale=164:164:flags=lanczos',
      'format=rgba',
      'split[a][b]',
      '[a]palettegen=reserve_transparent=1:transparency_color=ffffff[p]',
      '[b][p]paletteuse=alpha_threshold=128'
    ].join(','),
    '-gifflags', '+transdiff',
    '-filter:v', 'fps=30',
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

  const filterComplex = [
    '[1:v]format=rgba,colorkey=0xFFFFFF:0.1:0.2[ck]',
    '[ck]scale=164:164:flags=lanczos[scaled]',
    '[scaled]fade=in:st=' + startTime + ':d=' + fadeDuration + ':alpha=1,fade=out:st=' + fadeOutStart + ':d=' + fadeDuration + ':alpha=1[withfade]',
    '[0:v][withfade]overlay=x=W-w-100:y=H-h-100:shortest=1:format=auto:enable=\'between(t,' + startTime + ',' + endTime + ')\'[v]'
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
