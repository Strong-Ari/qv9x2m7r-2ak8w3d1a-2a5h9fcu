import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface AudioMixConfig {
  inputVideo: string;
  voiceTrack: string;
  musicTrack: string;
  outputVideo: string;
  voiceVolume?: number;
  musicVolume?: number;
  originalAudioWeight?: number;
  mixedAudioWeight?: number;
}

class FFmpegAudioMixer {
  private config: Required<AudioMixConfig>;

  constructor(config: AudioMixConfig) {
    this.config = {
      voiceVolume: 1.5,
      musicVolume: 0.9,
      originalAudioWeight: 0.9,
      mixedAudioWeight: 1.2,
      ...config
    };
  }

  private validateFiles(): void {
    const filesToCheck = [
      this.config.inputVideo,
      this.config.voiceTrack,
      this.config.musicTrack
    ];

    for (const file of filesToCheck) {
      if (!fs.existsSync(file)) {
        throw new Error(`Fichier non trouvé: ${file}`);
      }
    }
  }

  private buildFFmpegCommand(): string {
    const {
      inputVideo,
      voiceTrack,
      musicTrack,
      outputVideo,
      voiceVolume,
      musicVolume,
      originalAudioWeight,
      mixedAudioWeight
    } = this.config;

    return `ffmpeg -y -i "${inputVideo}" -i "${voiceTrack}" -i "${musicTrack}" ` +
           `-filter_complex "[1:a]volume=${voiceVolume}[voice];` +
           `[2:a]volume=${musicVolume}[music];` +
           `[voice][music]amix=inputs=2:duration=first[audio_mix];` +
           `[0:a][audio_mix]amix=inputs=2:weights=${originalAudioWeight} ${mixedAudioWeight}[final_audio]" ` +
           `-map 0:v -map "[final_audio]" -c:v copy "${outputVideo}"`;
  }

  async mixAudio(): Promise<void> {
    try {
      console.log('🎬 Validation des fichiers d\'entrée...');
      this.validateFiles();

      const command = this.buildFFmpegCommand();
      console.log('🔧 Commande FFmpeg:', command);

      console.log('🎵 Démarrage du mixage audio...');
      const startTime = Date.now();

      const { stdout, stderr } = await execAsync(command);

      const duration = Math.round((Date.now() - startTime) / 1000);

      if (stderr && !stderr.includes('frame=')) {
        console.warn('⚠️  Avertissements FFmpeg:', stderr);
      }

      if (fs.existsSync(this.config.outputVideo)) {
        console.log(`✅ Mixage terminé avec succès en ${duration}s`);
        console.log(`📁 Fichier de sortie: ${this.config.outputVideo}`);
      } else {
        throw new Error('Le fichier de sortie n\'a pas été créé');
      }

    } catch (error) {
      console.error('❌ Erreur lors du mixage:', error);
      throw error;
    }
  }
}

// Fonction utilitaire pour un usage simple
export async function mixVideoAudio(
  inputVideo: string,
  voiceTrack: string,
  musicTrack: string,
  outputVideo: string,
  options?: Partial<AudioMixConfig>
): Promise<void> {
  const mixer = new FFmpegAudioMixer({
    inputVideo,
    voiceTrack,
    musicTrack,
    outputVideo,
    ...options
  });

  await mixer.mixAudio();
}

// Script principal si exécuté directement
async function main() {
  try {
    const mixer = new FFmpegAudioMixer({
      inputVideo: 'output_pre_final.mp4',
      voiceTrack: 'public/ayanokoji-voice.mp3',
      musicTrack: 'public/ost.mp3',
      outputVideo: 'output_final.mp4'
    });

    await mixer.mixAudio();

  } catch (error) {
    console.error('💥 Échec du processus:', error);
    process.exit(1);
  }
}

// Exécuter si c'est le fichier principal
if (require.main === module) {
  main();
}

export { FFmpegAudioMixer };  export type { AudioMixConfig };

