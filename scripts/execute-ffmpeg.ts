import fs from "fs";
import path from "path";
import { exec, spawn } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface FFmpegCommand {
  command: string;
}

interface SubtitleEntry {
  text: string;
  start: number;
  end: number;
  fontsize?: number;
  fontcolor?: string;
  borderw?: number;
}

interface ParsedFFmpegCommand {
  input: string;
  output: string;
  videoFilters: string;
  audioCodec?: string;
  otherArgs: string[];
}

class BatchFFmpegProcessor {
  private tempFiles: string[] = [];

  /**
   * Parse command line arguments handling quotes properly
   */
  private parseCommandLine(command: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes && char === ' ') {
        if (current.trim()) {
          args.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      args.push(current.trim());
    }

    return args;
  }

  /**
   * Parse FFmpeg command to extract components
   */
  parseFFmpegCommand(command: string): ParsedFFmpegCommand {
    const args = this.parseCommandLine(command.replace(/^ffmpeg\s+/, ''));

    let input = '';
    let output = '';
    let videoFilters = '';
    let audioCodec = '';
    const otherArgs: string[] = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '-i' && i + 1 < args.length) {
        input = args[i + 1];
        i++; // Skip next argument
      } else if (arg === '-vf' && i + 1 < args.length) {
        videoFilters = args[i + 1];
        i++; // Skip next argument
      } else if (arg === '-c:a' && i + 1 < args.length) {
        audioCodec = args[i + 1];
        i++; // Skip next argument
      } else if (!arg.startsWith('-') && !input && !output) {
        // Could be input or output
        if (fs.existsSync(arg)) {
          input = arg;
        } else {
          output = arg;
        }
      } else if (!arg.startsWith('-') && input && !output) {
        output = arg;
      } else {
        otherArgs.push(arg);
      }
    }

    // Try to find output in the last argument if not found
    if (!output && args.length > 0) {
      const lastArg = args[args.length - 1];
      if (!lastArg.startsWith('-') && lastArg !== input) {
        output = lastArg;
      }
    }

    return { input, output, videoFilters, audioCodec, otherArgs };
  }

  /**
   * Parse drawtext filters to extract subtitle data
   */
  parseDrawtextFilters(videoFilters: string): SubtitleEntry[] {
    const subtitles: SubtitleEntry[] = [];

    // Amélioration du parsing pour gérer les caractères spéciaux
    const drawtextRegex = /drawtext=fontfile='([^']+)':text='([^']*(?:\\.[^']*)*)':x=([^:]+):y=([^:]+):fontsize=([^:]+):fontcolor=([^:]+):enable='between\(t,([0-9.]+),([0-9.]+)\)'[^,]*(?:,|$)/g;

    let match;
    while ((match = drawtextRegex.exec(videoFilters)) !== null) {
      try {
        let text = match[2];
        // Nettoyer le texte des échappements
        text = text.replace(/\\'/g, "'")
                  .replace(/\\,/g, ",")
                  .replace(/^\s+|\s+$/g, ''); // Trim spaces

        const start = parseFloat(match[7]);
        const end = parseFloat(match[8]);
        const fontsize = parseInt(match[5]) || 68;
        const fontcolor = match[6] || 'white';

        if (!isNaN(start) && !isNaN(end) && text.trim()) {
          subtitles.push({
            text: text.trim(),
            start,
            end,
            fontsize,
            fontcolor,
            borderw: fontcolor === 'yellow' ? 5 : 3
          });
        }
      } catch (error) {
        console.warn(`⚠️ Erreur lors du parsing d'un sous-titre: ${error}`);
      }
    }

    return subtitles.sort((a, b) => a.start - b.start);
  }

  /**
   * Check if command needs batch processing (too many drawtext filters)
   */
  needsBatchProcessing(command: string): boolean {
    const drawtextCount = (command.match(/drawtext=/g) || []).length;
    const commandLength = command.length;

    // Windows command line limit is around 8191 characters
    // But we'll be conservative and batch if > 6000 chars or > 15 drawtext filters
    return commandLength > 6000 || drawtextCount > 15;
  }

  /**
   * Escape text for FFmpeg drawtext filter
   */
  private escapeTextForFFmpeg(text: string): string {
    return text
      .replace(/\\/g, '\\\\')     // Échapper les backslashes
      .replace(/:/g, '\\:')       // Échapper les deux-points
      .replace(/'/g, "\\'")       // Échapper les apostrophes
      .replace(/,/g, "\\,")       // Échapper les virgules
      .replace(/\[/g, '\\[')      // Échapper les crochets ouvrants
      .replace(/\]/g, '\\]')      // Échapper les crochets fermants
      .replace(/;/g, '\\;')       // Échapper les points-virgules
      .replace(/"/g, '\\"');      // Échapper les guillemets doubles
  }

  /**
   * Generate drawtext filter for a batch of subtitles
   */
  private generateDrawtextBatch(subtitles: SubtitleEntry[]): string {
    const filters = subtitles.map(subtitle => {
      const fontsize = subtitle.fontsize || 68;
      const fontcolor = subtitle.fontcolor || 'white';
      const borderw = subtitle.borderw || 3;

      // Nettoyer et échapper le texte
      const cleanText = subtitle.text.trim();
      if (!cleanText) return null;

      // Échapper correctement le texte pour FFmpeg
      const escapedText = cleanText
        .replace(/\\/g, "\\\\")       // Échapper les backslashes
        .replace(/'/g, "\\'")         // Échapper les apostrophes
        .replace(/:/g, "\\:")         // Échapper les deux-points
        .replace(/,/g, "\\,")         // Échapper les virgules
        .replace(/\[/g, "\\[")        // Échapper les crochets
        .replace(/\]/g, "\\]")        // Échapper les crochets
        .replace(/«/g, "'")           // Remplacer « par '
        .replace(/»/g, "'");          // Remplacer » par '

      // Construire le filtre avec le bon échappement
      return `drawtext=fontfile=/Windows/Fonts/Impact.ttf:text='${escapedText}':x=(w-text_w)/2:y=h*0.8:fontsize=${fontsize}:fontcolor=${fontcolor}:enable='between(t\\,${subtitle.start}\\,${subtitle.end})':borderw=${borderw}:bordercolor=black:box=1:boxcolor=black@0.7:boxborderw=12`;
    }).filter(filter => filter !== null);

    return filters.join(',');
  }

  /**
   * Write filter graph to a file for -filter_script
   */
  private writeFilterGraph(filters: string): string {
    // Créer le nom du fichier basé sur un hash du contenu des filtres
    const hash = require('crypto').createHash('md5').update(filters).digest('hex').substring(0, 8);
    const filterScriptPath = path.join(process.cwd(), `filter_script_${hash}.txt`);

    // Vérifier si un fichier de filtre avec le même hash existe déjà
    if (fs.existsSync(filterScriptPath)) {
      console.log(`📎 Réutilisation du fichier de filtres existant: ${path.basename(filterScriptPath)}`);
      return filterScriptPath;
    }

    // Assurer que les filtres sont correctement formatés
    const formattedFilters = filters
      .replace(/\n/g, ' ')
      .split(',')
      .map(filter => filter.trim())
      .filter(filter => filter.length > 0)
      .join(",\n");

    fs.writeFileSync(filterScriptPath, formattedFilters, 'utf8');
    this.tempFiles.push(filterScriptPath);

    // Log pour le débogage
    console.log(`📝 Contenu du fichier de filtres (${path.basename(filterScriptPath)}):`);
    console.log(formattedFilters.split('\n')[0] + '\n...');

    return filterScriptPath;
  }

  /**
   * Process command with filter script for long filter chains
   */
  async processWithFilterScript(command: string, showProgress: boolean = false): Promise<void> {
    console.log('📝 Utilisation de -filter_script pour la chaîne de filtres longue');

    const parsed = this.parseFFmpegCommand(command);
    if (!parsed.input || !parsed.output) {
      throw new Error('Impossible d\'extraire les fichiers d\'entrée et de sortie');
    }

    // Écrire les filtres dans un fichier
    const filterScriptPath = this.writeFilterGraph(parsed.videoFilters);
    console.log(`📄 Fichier de filtres créé : ${path.basename(filterScriptPath)}`);

    // Construire la nouvelle commande avec -filter_script et arguments optimisés
    const args: string[] = [];

    // Arguments d'entrée
    if (parsed.otherArgs.includes('-i')) {
      // S'il y a plusieurs entrées, les préserver dans l'ordre original
      const otherArgs = [...parsed.otherArgs];
      let idx = 0;
      while (idx < otherArgs.length) {
        if (otherArgs[idx] === '-i') {
          args.push('-i', otherArgs[idx + 1]);
          otherArgs.splice(idx, 2);
        } else {
          idx++;
        }
      }
      parsed.otherArgs = otherArgs;
    } else {
      args.push('-i', parsed.input);
    }

    // Arguments du filtre
    args.push('-filter_script', filterScriptPath);

    // Codec audio
    if (parsed.audioCodec) {
      args.push('-c:a', parsed.audioCodec);
    }

    // Autres arguments en préservant leur ordre
    const remainingArgs = parsed.otherArgs.filter(arg => !arg.startsWith('-filter'));
    if (remainingArgs.length > 0) {
      args.push(...remainingArgs);
    }

    // Force output
    args.push('-y', parsed.output);

    try {
      await this.executeFFmpegCommand(args, showProgress);
      console.log('✅ Traitement avec filter_script terminé');
    } catch (error) {
      console.error('❌ Échec du traitement avec filter_script, tentative avec le traitement par lots...');
      await this.processByBatches(command, 6, showProgress);
    }
  }

  /**
   * Execute single FFmpeg command with spawn for better control
   */
  private executeFFmpegCommand(args: string[], showProgress: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (showProgress) {
        console.log(`🎬 Exécution: ffmpeg ${args.join(' ')}`);
      }

      // Nettoyer les arguments pour éviter les problèmes d'échappement
      const cleanArgs = args.map(arg => {
        // Si l'argument contient des caractères spéciaux, s'assurer qu'il est bien formaté
        if (arg.includes('drawtext=') && arg.includes('text=')) {
          return arg;
        }
        return arg;
      });

      const ffmpeg = spawn('ffmpeg', cleanArgs, {
        stdio: showProgress ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'ignore', 'pipe']
      });

      let stderrData = '';

      if (showProgress) {
        ffmpeg.stderr?.on('data', (data) => {
          const output = data.toString();
          stderrData += output;

          if (output.includes('frame=') || output.includes('time=')) {
            process.stdout.write(`\r⏳ ${output.split('\n').pop()?.trim() || ''}`);
          }
        });
      } else {
        ffmpeg.stderr?.on('data', (data) => {
          stderrData += data.toString();
        });
      }

      ffmpeg.on('close', (code) => {
        if (showProgress) {
          process.stdout.write('\n');
        }

        if (code === 0) {
          resolve();
        } else {
          console.error(`❌ FFmpeg a échoué avec le code ${code}`);
          console.error('Détails de l\'erreur:');
          console.error(stderrData);
          reject(new Error(`FFmpeg a échoué avec le code ${code}. Erreur: ${stderrData}`));
        }
      });

      ffmpeg.on('error', (error) => {
        console.error(`❌ Erreur lors du lancement de FFmpeg:`, error.message);
        reject(error);
      });
    });
  }

  /**
   * Process command in batches
   */
  async processByBatches(command: string, batchSize: number = 8, showProgress: boolean = false): Promise<void> {
    console.log('🔄 Traitement par lots détecté nécessaire');

    const parsed = this.parseFFmpegCommand(command);
    if (!parsed.input || !parsed.output) {
      throw new Error('Impossible d\'extraire les fichiers d\'entrée et de sortie');
    }

    const subtitles = this.parseDrawtextFilters(parsed.videoFilters);
    console.log(`📝 ${subtitles.length} sous-titres détectés`);

    if (subtitles.length === 0) {
      console.log('⚠️ Aucun sous-titre trouvé, tentative d\'exécution normale...');
      // Essayer d'exécuter la commande originale
      const args = this.parseCommandLine(command.replace(/^ffmpeg\s+/, ''));
      await this.executeFFmpegCommand(args, showProgress);
      return;
    }

    let currentInput = parsed.input;
    const totalBatches = Math.ceil(subtitles.length / batchSize);

    console.log(`📦 Traitement en ${totalBatches} lots de ${batchSize} sous-titres maximum`);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * batchSize;
      const endIdx = Math.min(startIdx + batchSize, subtitles.length);
      const batch = subtitles.slice(startIdx, endIdx);

      console.log(`\n🎯 Lot ${batchIndex + 1}/${totalBatches} (${batch.length} sous-titres)`);

      const tempOutput = path.join(process.cwd(), `temp_batch_${batchIndex}_${Date.now()}.mp4`);
      this.tempFiles.push(tempOutput);

      const batchFilter = this.generateDrawtextBatch(batch);

      if (!batchFilter) {
        console.warn(`⚠️ Lot ${batchIndex + 1} ignoré (filtre vide)`);
        continue;
      }

      const args = [
        '-i', currentInput,
        '-vf', batchFilter,
        '-c:a', parsed.audioCodec || 'copy',
        '-y',
        tempOutput
      ];

      try {
        await this.executeFFmpegCommand(args, showProgress);
        currentInput = tempOutput;
      } catch (error) {
        console.error(`❌ Erreur lors du traitement du lot ${batchIndex + 1}:`, error);
        throw error;
      }
    }

    // Final copy to desired output
    if (currentInput !== parsed.output) {
      console.log('\n🎬 Finalisation...');
      await this.executeFFmpegCommand([
        '-i', currentInput,
        '-c', 'copy',
        '-y',
        parsed.output
      ], showProgress);
    }

    console.log('✅ Traitement par lots terminé');
  }

  /**
   * Cleanup temporary files
   */
  cleanup(): void {
    this.tempFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`🗑️ Fichier temporaire supprimé: ${path.basename(file)}`);
        }
      } catch (error) {
        console.warn(`⚠️ Impossible de supprimer le fichier temporaire: ${file}`);
      }
    });
    this.tempFiles = [];
  }
}

// Modified functions using the batch processor
async function executeFFmpegFromJSON() {
  const batchProcessor = new BatchFFmpegProcessor();

  try {
    const jsonPath = path.join(process.cwd(), 'public', 'ffmpeg-command.json');

    if (!fs.existsSync(jsonPath)) {
      console.error(`❌ Fichier non trouvé : ${jsonPath}`);
      console.log("💡 Assurez-vous d'avoir généré le fichier JSON d'abord");
      return;
    }

    console.log("📖 Lecture du fichier de commande...");
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    const data: FFmpegCommand = JSON.parse(jsonContent);

    if (!data.command) {
      console.error("❌ Aucune commande trouvée dans le fichier JSON");
      return;
    }

    console.log("🎬 Commande FFmpeg à exécuter :");
    console.log(data.command.substring(0, 200) + '...');
    console.log("\n⏳ Début de l'exécution...\n");

    const startTime = Date.now();

    // D'abord essayer avec filter_script
    try {
      await batchProcessor.processWithFilterScript(data.command, false);
    } catch (error) {
      console.log("❌ Échec avec filter_script, tentative de traitement par lots...");

      // Si le traitement par lots est nécessaire
      if (batchProcessor.needsBatchProcessing(data.command)) {
        await batchProcessor.processByBatches(data.command, 6, false);
      } else {
        // Pour les commandes simples, essayer la méthode directe
        try {
          const { stdout, stderr } = await execAsync(data.command);
          if (stdout) console.log("📤 Sortie standard :", stdout);
          if (stderr) console.log("⚠️ Informations FFmpeg :", stderr);
        } catch (execError: any) {
          console.error("❌ Erreur d'exécution directe, tentative avec le traitement par lots...");
          await batchProcessor.processByBatches(data.command, 6, false);
        }
      }
    }

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("✅ Exécution terminée avec succès !");
    console.log(`⏱️ Temps d'exécution : ${executionTime} secondes`);

    // Check output file
    const outputMatch = data.command.match(/["\']([^"']*\.mp4)["\'](?:\s|$)/);
    if (outputMatch) {
      const outputPath = outputMatch[1];
      if (fs.existsSync(outputPath)) {
        const fileSize = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
        console.log(`\n🎥 Fichier créé : ${outputPath}`);
        console.log(`📁 Taille : ${fileSize} MB`);
      }
    }

  } catch (error: any) {
    console.error("❌ Erreur lors de l'exécution :");
    console.error("Message d'erreur :", error.message);

    if (error.code === 'ENAMETOOLONG') {
      console.log("💡 Conseil : La commande est trop longue. Le traitement par lots devrait résoudre ce problème.");
    }
  } finally {
    batchProcessor.cleanup();
  }
}

function executeFFmpegWithProgress() {
  const batchProcessor = new BatchFFmpegProcessor();

  try {
    const jsonPath = path.join(process.cwd(), 'public', 'ffmpeg-command.json');

    if (!fs.existsSync(jsonPath)) {
      console.error(`❌ Fichier non trouvé : ${jsonPath}`);
      return;
    }

    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    const data: FFmpegCommand = JSON.parse(jsonContent);

    console.log("🎬 Exécution avec affichage de la progression...");
    console.log(data.command.substring(0, 200) + '...');
    console.log("\n⏳ Début de l'exécution...\n");

    // Essayer d'abord avec filter_script
    batchProcessor.processWithFilterScript(data.command, true)
      .catch((error) => {
        console.error('\n❌ Échec avec filter_script, tentative de traitement par lots...');
        // Si le traitement par lots est nécessaire
        if (batchProcessor.needsBatchProcessing(data.command)) {
          return batchProcessor.processByBatches(data.command, 6, true);
        } else {
          // Pour les commandes simples, utiliser la méthode directe
          const child = exec(data.command);

          child.stdout?.on('data', (data) => {
            process.stdout.write(`📤 ${data}`);
          });

          child.stderr?.on('data', (data) => {
            process.stderr.write(`ℹ️ ${data}`);
          });

          return new Promise<void>((resolve, reject) => {
            child.on('close', (code) => {
              if (code === 0) {
                resolve();
              } else {
                reject(new Error(`Processus terminé avec le code : ${code}`));
              }
            });
          });
        }
      })
      .then(() => {
        console.log('\n✅ Exécution terminée avec succès !');
      })
      .catch((error) => {
        console.error('\n❌ Erreur :', error.message);
      })
      .finally(() => {
        batchProcessor.cleanup();
      });

  } catch (error) {
    console.error("❌ Erreur :", error);
    batchProcessor.cleanup();
  }
}

// Main execution
console.log("🚀 Exécuteur de commande FFmpeg\n");

const args = process.argv.slice(2);
if (args.includes('--progress')) {
  executeFFmpegWithProgress();
} else {
  executeFFmpegFromJSON();
}

console.log("\n💡 Utilisez --progress pour voir la progression en temps réel");
