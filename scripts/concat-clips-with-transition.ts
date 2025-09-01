import { readFileSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

// Fonction pour obtenir l'URL Cloudinary avec les transformations
function getCloudinaryUrl(publicId: string): string {
    return `https://res.cloudinary.com/drffwzn04/video/upload/c_fill,g_center,w_${WIDTH},h_${HEIGHT}/${publicId}.mp4`;
}

async function main() {
    // Read selected clips
    const selectedClips: SelectedClips = JSON.parse(
        readFileSync(join(process.cwd(), 'public', 'selected-clips.json'), 'utf-8')
    );

    // Prepare clips data with transformed URLs
    console.log('Preparing clips...');
    const clips = selectedClips.clips.map((clip) => ({
        url: getCloudinaryUrl(clip.public_id),
        duration: clip.duration
    }));

    // Create complex filter for ffmpeg
    const filterComplex: string[] = [];
    const overlayChain: string[] = [];

    // Initial black background
    const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
    filterComplex.push(`color=c=black:r=60:size=${WIDTH}x${HEIGHT}:d=${totalDuration}[background]`);

    // Process each video
    clips.forEach((clip, i) => {
        // Base video processing with fade transitions
        filterComplex.push(`[${i}:v]format=pix_fmts=yuva420p,` +
            `fade=t=in:st=0:d=0.5:alpha=1,` +
            `fade=t=out:st=${clip.duration - 0.5}:d=0.5:alpha=1,` +
            `setpts=PTS-STARTPTS+${i > 0 ? clips.slice(0, i).reduce((sum: number, c) => sum + c.duration, 0) : 0}/TB[v${i}]`);
    });

    // Create overlay chain
    overlayChain.push('[background]');
    clips.forEach((_, i) => {
        overlayChain.push(`[v${i}]`);
        if (i < clips.length - 1) {
            filterComplex.push(`${overlayChain.join('')}overlay[bg${i}]`);
            overlayChain.splice(0, overlayChain.length, `[bg${i}]`);
        } else {
            filterComplex.push(`${overlayChain.join('')}overlay[final]`);
        }
    });

    // Add duration trim to match audio duration exactly
    filterComplex.push(`[final]trim=0:${selectedClips.audioDuration}[trimmed]`);

    // Build ffmpeg command
    const inputFiles = clips.map(clip => `-i "${clip.url}"`).join(' ');
    const outputPath = join(process.cwd(), 'output.mp4');
    const command = `ffmpeg ${inputFiles} -filter_complex "${filterComplex.join(';')}" -map "[trimmed]" -c:v libx264 -pix_fmt yuv420p "${outputPath}"`;

    // Execute ffmpeg
    console.log('Concatenating videos with transitions...');
    console.log('FFmpeg command:', command);
    await execAsync(command);
    console.log(`Video created successfully with exact duration of ${selectedClips.audioDuration} seconds!`);
}

main().catch(console.error);
