import fs from "fs";
import path from "path";
import os from "os";
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

interface CommandLog {
  batchNumber: number;
  timestamp: string;
  args: string[];
  fullCommand: string;
  subtitleCount: number;
  success: boolean;
  error?: string;
  fontPath?: string;
}

interface FontConfig {
  path: string;
  name: string;
  available: boolean;
}

class BatchFFmpegProcessor {
  private tempFiles: string[] = [];
  private commandLogs: CommandLog[] = [];
  private logFilePath: string;
  private fontConfig: FontConfig;

  constructor() {
    // Créer le nom du fichier de log avec timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFilePath = path.join(process.cwd(), `ffmpeg-commands-log-${timestamp}.json`);

    // Initialiser la configuration des polices
    this.fontConfig = this.detectFontConfiguration();
    console.log(`🔤 Police détectée: ${this.fontConfig.name} (${this.fontConfig.available ? 'disponible' : 'indisponible'})`);
    console.log(`📁 Chemin de la police: ${this.fontConfig.path}`);
  }

  /**
   * Détecter la configuration des polices selon l'environnement
   */
  private detectFontConfiguration(): FontConfig {
    const platform = os.platform();

    // Configuration pour Windows
    if (platform === 'win32') {
      const windowsPaths = [
        'C:/Windows/Fonts/Impact.ttf',
        'C:\\Windows\\Fonts\\Impact.ttf',
        path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'Impact.ttf')
      ];

      for (const fontPath of windowsPaths) {
        if (fs.existsSync(fontPath.replace(/\//g, path.sep))) {
          return {
            path: fontPath.replace(/\\/g, '/').replace('C:', 'C\\:'), // Format FFmpeg pour Windows
            name: 'Impact',
            available: true
          };
        }
      }

      // Fallback pour Windows avec échappement correct
      return {
        path: 'C\\:/Windows/Fonts/Impact.ttf',
        name: 'Impact (assumé)',
        available: false // On assume qu'elle existe même si on ne peut pas la vérifier
      };
    }

    // Configuration pour macOS
    if (platform === 'darwin') {
      const macPaths = [
        '/System/Library/Fonts/Impact.ttc',
        '/Library/Fonts/Impact.ttf',
        '/System/Library/Fonts/Helvetica.ttc'
      ];

      for (const fontPath of macPaths) {
        if (fs.existsSync(fontPath)) {
          return {
            path: fontPath,
            name: path.basename(fontPath, path.extname(fontPath)),
            available: true
          };
        }
      }

      return {
        path: '/System/Library/Fonts/Helvetica.ttc',
        name: 'Helvetica (fallback)',
        available: false
      };
    }

    // Configuration pour Linux
    const linuxPaths = [
      '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
      '/usr/share/fonts/truetype/ubuntu/Ubuntu-Bold.ttf'
    ];

    for (const fontPath of linuxPaths) {
      if (fs.existsSync(fontPath)) {
        return {
          path: fontPath,
          name: path.basename(fontPath, path.extname(fontPath)),
          available: true
        };
      }
    }

    return {
      path: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
      name: 'Liberation Sans (assumé)',
      available: false
    };
  }

  /**
   * Vérifier si FFmpeg peut accéder à la police
   */
  private async testFontAccess(): Promise<boolean> {
    return new Promise((resolve) => {
      const testArgs = [
        '-f', 'lavfi',
        '-i', 'color=black:size=100x100:duration=1',
        '-vf', `drawtext=fontfile='${this.fontConfig.path}':text='test':x=10:y=10:fontsize=12:fontcolor=white`,
        '-f', 'null',
        '-'
      ];

      const ffmpeg = spawn('ffmpeg', testArgs, {
        stdio: ['ignore', 'ignore', 'pipe']
      });

      let stderrData = '';
      ffmpeg.stderr?.on('data', (data) => {
        stderrData += data.toString();
      });

      ffmpeg.on('close', (code) => {
        const success = code === 0 && !stderrData.includes('No such file') && !stderrData.includes('cannot find');
        if (!success) {
          console.log(`⚠️ Test de police échoué: ${stderrData.substring(0, 200)}...`);
        }
        resolve(success);
      });

      // Timeout de 5 secondes pour le test
      setTimeout(() => {
        ffmpeg.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Log une commande exécutée
   */
  private logCommand(
    batchNumber: number,
    args: string[],
    subtitleCount: number,
    success: boolean,
    error?: string
  ): void {
    const log: CommandLog = {
      batchNumber,
      timestamp: new Date().toISOString(),
      args: [...args],
      fullCommand: `ffmpeg ${args.join(' ')}`,
      subtitleCount,
      success,
      error,
      fontPath: this.fontConfig.path
    };

    this.commandLogs.push(log);
    this.saveCommandLogs();
  }

  /**
   * Sauvegarder les logs dans un fichier JSON
   */
  private saveCommandLogs(): void {
    try {
      const logData = {
        metadata: {
          totalBatches: this.commandLogs.length,
          timestamp: new Date().toISOString(),
          logFile: path.basename(this.logFilePath),
          platform: os.platform(),
          fontConfig: this.fontConfig
        },
        commands: this.commandLogs
      };

      fs.writeFileSync(this.logFilePath, JSON.stringify(logData, null, 2), 'utf8');
    } catch (error) {
      console.warn(`⚠️ Impossible de sauvegarder les logs: ${error}`);
    }
  }

  /**
   * Créer aussi un fichier de commandes lisible
   */
  private saveReadableCommands(): void {
    try {
      const readablePath = this.logFilePath.replace('.json', '.txt');
      let content = `=== COMMANDES FFMPEG EXÉCUTÉES ===\n`;
      content += `Générées le: ${new Date().toLocaleString()}\n`;
      content += `Plateforme: ${os.platform()}\n`;
      content += `Police utilisée: ${this.fontConfig.name}\n`;
      content += `Chemin de la police: ${this.fontConfig.path}\n`;
      content += `Total de lots: ${this.commandLogs.length}\n\n`;

      this.commandLogs.forEach((log, index) => {
        content += `--- LOT ${log.batchNumber} ---\n`;
        content += `Timestamp: ${new Date(log.timestamp).toLocaleString()}\n`;
        content += `Sous-titres: ${log.subtitleCount}\n`;
        content += `Police: ${log.fontPath}\n`;
        content += `Statut: ${log.success ? '✅ SUCCÈS' : '❌ ÉCHEC'}\n`;
        if (log.error) {
          content += `Erreur: ${log.error}\n`;
        }
        content += `\nCommande complète:\n`;
        content += `${log.fullCommand}\n`;
        content += `\nArguments séparés:\n`;
        log.args.forEach((arg, argIndex) => {
          content += `  [${argIndex}]: ${arg}\n`;
        });
        content += `\n${'='.repeat(80)}\n\n`;
      });

      fs.writeFileSync(readablePath, content, 'utf8');
      console.log(`📄 Fichier lisible créé: ${path.basename(readablePath)}`);
    } catch (error) {
      console.warn(`⚠️ Impossible de créer le fichier lisible: ${error}`);
    }
  }

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
        i++;
      } else if (arg === '-vf' && i + 1 < args.length) {
        videoFilters = args[i + 1];
        i++;
      } else if (arg === '-c:a' && i + 1 < args.length) {
        audioCodec = args[i + 1];
        i++;
      } else if (!arg.startsWith('-') && !input && !output) {
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

    if (!output && args.length > 0) {
      const lastArg = args[args.length - 1];
      if (!lastArg.startsWith('-') && lastArg !== input) {
        output = lastArg;
      }
    }

    return { input, output, videoFilters, audioCodec, otherArgs };
  }

  /**
   * Parse drawtext filters to extract subtitle data et mettre à jour le chemin de police
   */
  parseDrawtextFilters(videoFilters: string): SubtitleEntry[] {
    const subtitles: SubtitleEntry[] = [];

    // Mettre à jour les chemins de police dans les filtres
    const updatedFilters = videoFilters.replace(
      /fontfile='?([^':\s]+)'?/g,
      `fontfile='${this.fontConfig.path}'`
    );

    const drawtextRegex = /drawtext=fontfile='([^']+)':text='([^']*(?:\\.[^']*)*)':x=([^:]+):y=([^:]+):fontsize=([^:]+):fontcolor=([^:]+):enable='between\(t,([0-9.]+),([0-9.]+)\)'[^,]*(?:,|$)/g;

    let match;
    while ((match = drawtextRegex.exec(updatedFilters)) !== null) {
      try {
        let text = match[2];
        text = text.replace(/\\'/g, "'")
                  .replace(/\\,/g, ",")
                  .replace(/^\s+|\s+$/g, '');

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
   * Check if command needs batch processing
   */
  needsBatchProcessing(command: string): boolean {
    const drawtextCount = (command.match(/drawtext=/g) || []).length;
    const commandLength = command.length;

    return commandLength > 6000 || drawtextCount > 10;
  }

  /**
   * Generate drawtext filter for a batch of subtitles avec le bon chemin de police
   */
  private generateDrawtextBatch(subtitles: SubtitleEntry[]): string {
    const filters = subtitles.map(subtitle => {
      const fontsize = subtitle.fontsize || 68;
      const fontcolor = subtitle.fontcolor || 'white';
      const borderw = subtitle.borderw || 3;

      const cleanText = subtitle.text.trim();
      if (!cleanText) return null;

      const escapedText = cleanText
        .replace(/[«»]/g, '')
        .replace(/"/g, '')
        .replace(/'/g, "'")
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:")
        .replace(/,/g, "\\,")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")
        .replace(/;/g, "\\;")
        .replace(/%/g, "\\%");

      // Utiliser le chemin de police détecté automatiquement
      return `drawtext=fontfile='${this.fontConfig.path}':text='${escapedText}':x=(w-text_w)/2:y=h*0.8:fontsize=${fontsize}:fontcolor=${fontcolor}:enable='between(t\\,${subtitle.start}\\,${subtitle.end})':borderw=${borderw}:bordercolor=black:box=1:boxcolor=black@0.7:boxborderw=12`;
    }).filter(filter => filter !== null);

    return filters.join(',');
  }

  /**
   * Execute single FFmpeg command with spawn for better control
   */
  private executeFFmpegCommand(
    args: string[],
    showProgress: boolean = false,
    batchNumber: number = 0,
    subtitleCount: number = 0
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (showProgress) {
        console.log(`🎬 Exécution lot ${batchNumber}: ffmpeg ${args.join(' ')}`);
      }

      const cleanArgs = args.map(arg => {
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
            process.stdout.write(`\r⏳ Lot ${batchNumber}: ${output.split('\n').pop()?.trim() || ''}`);
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

        const success = code === 0;
        const error = success ? undefined : `Code ${code}: ${stderrData}`;

        this.logCommand(batchNumber, args, subtitleCount, success, error);

        if (success) {
          resolve();
        } else {
          console.error(`❌ FFmpeg lot ${batchNumber} a échoué avec le code ${code}`);
          console.error('Détails de l\'erreur:');
          console.error(stderrData);
          reject(new Error(`FFmpeg a échoué avec le code ${code}. Erreur: ${stderrData}`));
        }
      });

      ffmpeg.on('error', (error) => {
        console.error(`❌ Erreur lors du lancement de FFmpeg lot ${batchNumber}:`, error.message);
        this.logCommand(batchNumber, args, subtitleCount, false, error.message);
        reject(error);
      });
    });
  }

  /**
   * Try to execute simple command first, fallback to batch processing
   */
  async processCommand(command: string, showProgress: boolean = false): Promise<void> {
    const parsed = this.parseFFmpegCommand(command);
    if (!parsed.input || !parsed.output) {
      throw new Error('Impossible d\'extraire les fichiers d\'entrée et de sortie');
    }

    console.log(`📝 Logs seront sauvegardés dans: ${path.basename(this.logFilePath)}`);

    // Tester l'accès à la police si possible
    if (showProgress) {
      console.log('🔍 Test d\'accès à la police...');
      const fontAccessible = await this.testFontAccess();
      console.log(`🔤 Police accessible: ${fontAccessible ? '✅ Oui' : '⚠️ Non (utilisation en mode assumé)'}`);
    }

    if (this.needsBatchProcessing(command)) {
      console.log('📦 Commande trop longue détectée, utilisation du traitement par lots automatiquement');
      await this.processByBatches(command, 8, showProgress);
      return;
    }

    try {
      console.log('🎬 Tentative d\'exécution directe...');
      const args = this.parseCommandLine(command.replace(/^ffmpeg\s+/, ''));

      // Mettre à jour les chemins de police dans les arguments
      const updatedArgs = args.map(arg => {
        if (arg.includes('fontfile=') && arg.includes('/Windows/Fonts/')) {
          return arg.replace(/fontfile='?([^':\s]+)'?/g, `fontfile='${this.fontConfig.path}'`);
        }
        return arg;
      });

      await this.executeFFmpegCommand(updatedArgs, showProgress, 1, 0);
      console.log('✅ Exécution directe réussie');
    } catch (error) {
      console.log('❌ Échec de l\'exécution directe, passage au traitement par lots...');
      await this.processByBatches(command, 8, showProgress);
    }
  }

  /**
   * Process command in batches
   */
  async processByBatches(command: string, batchSize: number = 8, showProgress: boolean = false): Promise<void> {
    console.log('🔄 Démarrage du traitement par lots');

    const parsed = this.parseFFmpegCommand(command);
    if (!parsed.input || !parsed.output) {
      throw new Error('Impossible d\'extraire les fichiers d\'entrée et de sortie');
    }

    const subtitles = this.parseDrawtextFilters(parsed.videoFilters);
    console.log(`📝 ${subtitles.length} sous-titres détectés`);

    if (subtitles.length === 0) {
      console.log('⚠️ Aucun sous-titre trouvé, tentative d\'exécution normale...');
      const args = this.parseCommandLine(command.replace(/^ffmpeg\s+/, ''));
      await this.executeFFmpegCommand(args, showProgress, 1, 0);
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
        await this.executeFFmpegCommand(args, showProgress, batchIndex + 1, batch.length);
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
      ], showProgress, totalBatches + 1, 0);
    }

    console.log('✅ Traitement par lots terminé');
    this.saveReadableCommands();
    console.log(`📄 Logs JSON sauvegardés: ${path.basename(this.logFilePath)}`);
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
    await batchProcessor.processCommand(data.command, false);

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("✅ Exécution terminée avec succès !");
    console.log(`⏱️ Temps d'exécution : ${executionTime} secondes`);

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

    batchProcessor.processCommand(data.command, true)
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
console.log("🚀 Exécuteur de commande FFmpeg avec support multi-plateforme\n");

const args = process.argv.slice(2);
if (args.includes('--progress')) {
  executeFFmpegWithProgress();
} else {
  executeFFmpegFromJSON();
}

console.log("\n💡 Options disponibles :");
console.log("  --progress : Affiche la progression en temps réel");
console.log("\n📄 Les commandes exécutées seront automatiquement loggées avec :");
console.log("  - Détection automatique de la plateforme et des polices");
console.log("  - Test d'accessibilité des polices");
console.log("  - Chemins de police corrigés automatiquement");
