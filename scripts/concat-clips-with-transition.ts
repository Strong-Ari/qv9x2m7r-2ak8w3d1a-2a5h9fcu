import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import cliProgress from 'cli-progress';
import readline from 'readline';

// Suppression de execAsync - utilisation de spawn pour progress tracking

// Dimensions TikTok (9:16) - Haute qualité
const WIDTH = 1080;
const HEIGHT = 1920;

interface Clip {
    url: string;
    duration: number;
    public_id: string;
}

interface SelectedClips {
    audioId: string;
    audioDuration: number;
    clips: Clip[];
}

// 🎯 Fonction pour obtenir l'URL Cloudinary avec transformations HAUTE QUALITÉ
function getCloudinaryUrl(publicId: string): string {
    return `https://res.cloudinary.com/drffwzn04/video/upload/q_auto:best,f_mp4,c_fill,g_center,w_${WIDTH},h_${HEIGHT},fl_progressive/${publicId}.mp4`;
}

// 🔧 Fonction pour construire les paramètres FFmpeg haute qualité
function getHighQualityParams(): string[] {
    return [
        '-c:v', 'libx264',
        '-profile:v', 'high',
        '-level', '4.2',
        '-crf', '16',
        '-preset', 'slow',
        '-pix_fmt', 'yuv420p',
        '-maxrate', '8000k',
        '-bufsize', '16000k',
        '-keyint_min', '24',
        '-g', '48',
        '-me_method', 'umh',
        '-subq', '8',
        '-trellis', '2',
        '-flags', '+cgop+mv4',
        '-threads', '0',
        '-movflags', '+faststart',
        '-strict', 'experimental'
    ];
}

// 🗂️ Fonction pour créer le fichier de filtres complexes
function createFilterFile(clips: { url: string; duration: number }[], audioDuration: number): string {
    const filterPath = join(tmpdir(), `ffmpeg_filters_${Date.now()}.txt`);
    const filterComplex: string[] = [];
    const overlayChain: string[] = [];

    // Initial black background
    const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
    filterComplex.push(
        `color=c=black:r=60:size=${WIDTH}x${HEIGHT}:d=${totalDuration}:sar=1/1[background];`
    );

    // Process each video with ENHANCED quality filters
    clips.forEach((clip, i) => {
        filterComplex.push(
            `[${i}:v]format=pix_fmts=yuva420p,` +
            `scale=${WIDTH}:${HEIGHT}:flags=bicubic:force_original_aspect_ratio=decrease,` +
            `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,` +
            `unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=0.25,` +
            `fade=t=in:st=0:d=0.5:alpha=1:color=black,` +
            `fade=t=out:st=${clip.duration - 0.5}:d=0.5:alpha=1:color=black,` +
            `setpts=PTS-STARTPTS+${i > 0 ? clips.slice(0, i).reduce((sum: number, c) => sum + c.duration, 0) : 0}/TB[v${i}];`
        );
    });

    // Create overlay chain
    overlayChain.push('[background]');
    clips.forEach((_, i) => {
        overlayChain.push(`[v${i}]`);
        if (i < clips.length - 1) {
            filterComplex.push(`${overlayChain.join('')}overlay=format=auto[bg${i}];`);
            overlayChain.splice(0, overlayChain.length, `[bg${i}]`);
        } else {
            filterComplex.push(`${overlayChain.join('')}overlay=format=auto[final];`);
        }
    });

    // Add duration trim
    filterComplex.push(`[final]trim=0:${audioDuration},setpts=PTS-STARTPTS[trimmed]`);

    // Write filter file
    writeFileSync(filterPath, filterComplex.join('\n'), 'utf-8');
    return filterPath;
}

// 📝 Fonction pour créer le fichier de liste des inputs
function createInputFile(clips: { url: string; duration: number }[]): string {
    const inputPath = join(tmpdir(), `ffmpeg_inputs_${Date.now()}.txt`);
    const inputs = clips.map(clip => `file '${clip.url}'`);
    writeFileSync(inputPath, inputs.join('\n'), 'utf-8');
    return inputPath;
}

async function main() {
    console.log('🎬 Démarrage du processus de concaténation haute qualité...');

    let filterFile: string | null = null;
    let inputFile: string | null = null;

    try {
        // Read selected clips
        const selectedClips: SelectedClips = JSON.parse(
            readFileSync(join(process.cwd(), 'public', 'selected-clips.json'), 'utf-8')
        );

        // Read audio info for correct duration
        const audioInfo = JSON.parse(
            readFileSync(join(process.cwd(), 'public', 'audio-info.json'), 'utf-8')
        );

        // Use audio duration from audio-info.json instead of selected-clips.json
        const audioDuration = audioInfo.duration;
        console.log(`🎵 Durée audio depuis audio-info.json: ${audioDuration}s`);
        console.log(`📊 Durée dans selected-clips.json: ${selectedClips.audioDuration}s (ignorée)`);

        // Override the duration
        selectedClips.audioDuration = audioDuration;

        // Prepare clips data with HIGH QUALITY transformed URLs
        console.log('📹 Préparation des clips avec URLs haute qualité...');
        const clips = selectedClips.clips.map((clip, index) => {
            const url = getCloudinaryUrl(clip.public_id);
            console.log(`   Clip ${index + 1}: ${clip.public_id} (${clip.duration}s)`);
            return {
                url,
                duration: clip.duration
            };
        });

        // 🗂️ Créer les fichiers temporaires pour éviter "ligne de commande trop longue"
        console.log('📁 Création des fichiers de configuration temporaires...');
        filterFile = createFilterFile(clips, audioDuration);
        console.log(`   Filtres: ${filterFile}`);

        // 🚀 Build ffmpeg command with files instead of long command line
        const outputPath = join(process.cwd(), 'output.mp4');
        const qualityParams = getHighQualityParams();

        // Construire la commande avec fichiers séparés
        const args = [
            '-y', // Overwrite output
            // Inputs individuels (plus court que concat)
            ...clips.flatMap(clip => ['-i', `"${clip.url}"`]),
            // Filter complex depuis fichier
            '-filter_complex_script', `"${filterFile}"`,
            '-map', '[trimmed]',
            ...qualityParams,
            `"${outputPath}"`
        ];

        const command = `ffmpeg ${args.join(' ')}`;

        // Execute ffmpeg with REAL-TIME progress tracking
        console.log('🎵 Concaténation des vidéos avec transitions haute qualité...');
        console.log('⚙️ Paramètres de qualité: CRF 16, Preset slow, Profil high');
        console.log(`📊 Durée totale: ${audioDuration}s`);
        console.log('🔧 Utilisation de fichiers temporaires pour éviter les limitations de ligne de commande');

        const startTime = Date.now();

        // 📊 Configuration de la barre de progression
        const progressBar = new cliProgress.SingleBar({
            format: '🎬 Processing |{bar}| {percentage}% | {time}/{total}s | Speed: {speed}x | ETA: {eta}s',
            hideCursor: true,
            clearOnComplete: false,
            stopOnComplete: true
        }, cliProgress.Presets.shades_classic);

        // Démarrer la barre de progression
        progressBar.start(audioDuration, 0, {
            time: '0.0',
            total: audioDuration.toFixed(1),
            speed: '0.0',
            eta: '...'
        });

        // 🚀 Lancer FFmpeg avec spawn pour tracking en temps réel
        await new Promise<void>((resolve, reject) => {
            const args = [
                '-y', // Overwrite output
                // Inputs individuels
                ...clips.flatMap(clip => ['-i', clip.url]),
                // Filter complex depuis fichier
                '-filter_complex_script', filterFile!,
                '-map', '[trimmed]',
                ...qualityParams,
                outputPath
            ];

            const ffmpegProcess = spawn('ffmpeg', args);
            let ffmpegOutput = '';

            // 📈 Parser la sortie FFmpeg pour progression
            const rl = readline.createInterface({
                input: ffmpegProcess.stderr
            });

            rl.on('line', (line) => {
                ffmpegOutput += line + '\n';

                // Extraction du timestamp 'time=XX:XX:XX.XX'
                const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1]);
                    const minutes = parseInt(timeMatch[2]);
                    const seconds = parseFloat(timeMatch[3]);
                    const currentTime = hours * 3600 + minutes * 60 + seconds;

                    // Extraction de la vitesse 'speed=X.XXx'
                    const speedMatch = line.match(/speed=\s*(\d+\.?\d*)x/);
                    const speed = speedMatch ? parseFloat(speedMatch[1]) : 0;

                    // Calcul ETA
                    const remainingTime = audioDuration - currentTime;
                    const eta = speed > 0 ? Math.round(remainingTime / speed) : 0;

                    // Mise à jour de la barre
                    const clampedTime = Math.min(currentTime, audioDuration);
                    progressBar.update(clampedTime, {
                        time: clampedTime.toFixed(1),
                        total: audioDuration.toFixed(1),
                        speed: speed.toFixed(2),
                        eta: eta > 0 ? eta.toString() : '...'
                    });
                }
            });

            ffmpegProcess.on('close', (code) => {
                rl.close();
                progressBar.stop();

                const processingTime = Math.round((Date.now() - startTime) / 1000);

                if (code === 0) {
                    console.log(`\n✅ Vidéo créée avec succès en ${processingTime}s !`);
                    console.log(`📁 Fichier de sortie: ${outputPath}`);
                    console.log(`🎯 Qualité: CRF 16 (Très haute qualité)`);
                    console.log(`📏 Résolution: ${WIDTH}x${HEIGHT} (TikTok optimisé)`);
                    console.log(`⏱️ Durée exacte: ${audioDuration}s`);
                    resolve();
                } else {
                    console.error(`\n❌ FFmpeg a échoué avec le code: ${code}`);
                    console.error('📋 Sortie FFmpeg:', ffmpegOutput);
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });

            ffmpegProcess.on('error', (error) => {
                rl.close();
                progressBar.stop();
                console.error('\n❌ Erreur lors du lancement de FFmpeg:', error);
                reject(error);
            });
        });

    } catch (error) {
        console.error('❌ Erreur lors de la création de la vidéo:', error);

        // Debug info
        if (error instanceof Error && 'stdout' in error) {
            console.error('FFmpeg stdout:', (error as any).stdout);
            console.error('FFmpeg stderr:', (error as any).stderr);
        }

        throw error;

    } finally {
        // 🧹 Nettoyage des fichiers temporaires
        try {
            if (filterFile) {
                unlinkSync(filterFile);
                console.log('🗑️ Fichier de filtres temporaire supprimé');
            }
            if (inputFile) {
                unlinkSync(inputFile);
                console.log('🗑️ Fichier d\'inputs temporaire supprimé');
            }
        } catch (cleanupError) {
            console.warn('⚠️ Erreur lors du nettoyage:', cleanupError);
        }
    }
}

main().catch(console.error);
