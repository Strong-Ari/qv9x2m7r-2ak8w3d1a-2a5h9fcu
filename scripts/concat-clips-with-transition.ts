import { readFileSync, writeFileSync, unlinkSync, createWriteStream } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import cliProgress from 'cli-progress';
import readline from 'readline';
import { get } from 'https';

// Dimensions TikTok (9:16)
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

// 🎯 Construire l’URL Cloudinary
function getCloudinaryUrl(publicId: string): string {
    return `https://res.cloudinary.com/drffwzn04/video/upload/q_auto:best,f_mp4,c_fill,g_center,w_${WIDTH},h_${HEIGHT},fl_progressive/${publicId}.mp4`;
}

// 🔧 Paramètres haute qualité
function getHighQualityParams(): string[] {
    return [
        '-c:v', 'libx264',
        '-profile:v', 'high',
        '-level', '4.2',
        '-crf', '12',
        '-preset', 'veryslow',
        '-pix_fmt', 'yuv420p',
        '-maxrate', '12000k',
        '-bufsize', '24000k',
        '-keyint_min', '24',
        '-g', '48',
        '-me_method', 'umh',
        '-subq', '10',
        '-trellis', '2',
        '-flags', '+cgop+mv4',
        '-threads', '0',
        '-movflags', '+faststart'
    ];
}

// 🗂️ Génération du fichier de filtres
function createFilterFile(clips: { url: string; duration: number }[], audioDuration: number): string {
    const filterPath = join(tmpdir(), `ffmpeg_filters_${Date.now()}.txt`);
    const filterComplex: string[] = [];
    const overlayChain: string[] = [];

    const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
    filterComplex.push(
        `color=c=black:r=60:size=${WIDTH}x${HEIGHT}:d=${totalDuration}:sar=1/1[background];`
    );

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

    filterComplex.push(`[final]trim=0:${audioDuration},setpts=PTS-STARTPTS[trimmed]`);

    writeFileSync(filterPath, filterComplex.join('\n'), 'utf-8');
    return filterPath;
}

// 🌐 Télécharger un fichier en local
async function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = createWriteStream(dest);
        get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Erreur téléchargement ${url}: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => file.close(() => resolve()));
        }).on('error', reject);
    });
}

async function main() {
    console.log('🎬 Démarrage du processus de concaténation haute qualité...');

    let filterFile: string | null = null;
    const tempFiles: string[] = [];

    try {
        const selectedClips: SelectedClips = JSON.parse(
            readFileSync(join(process.cwd(), 'public', 'selected-clips.json'), 'utf-8')
        );

        const audioInfo = JSON.parse(
            readFileSync(join(process.cwd(), 'public', 'audio-info.json'), 'utf-8')
        );

        const audioDuration = audioInfo.duration;
        selectedClips.audioDuration = audioDuration;
        console.log(`🎵 Durée audio: ${audioDuration}s`);

        console.log('📹 Téléchargement des clips Cloudinary...');
        const clips = [];
        for (const clip of selectedClips.clips) {
            const url = getCloudinaryUrl(clip.public_id);
            const dest = join(tmpdir(), `${clip.public_id}_${Date.now()}.mp4`);
            await downloadFile(url, dest);
            tempFiles.push(dest);
            console.log(`   ✅ Clip téléchargé: ${clip.public_id}`);
            clips.push({ url: dest, duration: clip.duration });
        }

        console.log('📁 Création du fichier de filtres...');
        filterFile = createFilterFile(clips, audioDuration);

        const outputPath = join(process.cwd(), 'output.mp4');
        const qualityParams = getHighQualityParams();

        const args = [
            '-y',
            ...clips.flatMap(clip => ['-i', clip.url]),
            '-filter_complex_script', filterFile,
            '-map', '[trimmed]',
            ...qualityParams,
            outputPath
        ];

        console.log('🚀 Lancement de FFmpeg...');
        console.log(`   Commande: ffmpeg ${args.join(' ')}`);

        const startTime = Date.now();
        const progressBar = new cliProgress.SingleBar({
            format: '🎬 Processing |{bar}| {percentage}% | {time}/{total}s | Speed: {speed}x | ETA: {eta}s',
            hideCursor: true,
            clearOnComplete: false,
            stopOnComplete: true
        }, cliProgress.Presets.shades_classic);

        progressBar.start(audioDuration, 0);

        await new Promise<void>((resolve, reject) => {
            const ffmpegProcess = spawn('ffmpeg', args);
            let ffmpegOutput = '';

            const rl = readline.createInterface({ input: ffmpegProcess.stderr });

            rl.on('line', (line) => {
                ffmpegOutput += line + '\n';
                const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1]);
                    const minutes = parseInt(timeMatch[2]);
                    const seconds = parseFloat(timeMatch[3]);
                    const currentTime = hours * 3600 + minutes * 60 + seconds;

                    const speedMatch = line.match(/speed=\s*(\d+\.?\d*)x/);
                    const speed = speedMatch ? parseFloat(speedMatch[1]) : 0;

                    const remainingTime = audioDuration - currentTime;
                    const eta = speed > 0 ? Math.round(remainingTime / speed) : 0;

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
                    resolve();
                } else {
                    console.error(`\n❌ FFmpeg a échoué avec code: ${code}`);
                    console.error('📋 Sortie FFmpeg:', ffmpegOutput);
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });

            ffmpegProcess.on('error', reject);
        });

    } catch (error) {
        console.error('❌ Erreur lors de la création de la vidéo:', error);
        throw error;
    } finally {
        try {
            if (filterFile) unlinkSync(filterFile);
            for (const file of tempFiles) unlinkSync(file);
            console.log('🧹 Fichiers temporaires supprimés');
        } catch (cleanupError) {
            console.warn('⚠️ Erreur lors du nettoyage:', cleanupError);
        }
    }
}

main().catch(console.error);
