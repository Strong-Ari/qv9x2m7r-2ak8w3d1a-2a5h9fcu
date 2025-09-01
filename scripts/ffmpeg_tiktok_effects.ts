import { spawnSync, spawn } from "child_process";
import cliProgress from "cli-progress";
import readline from "readline";

// Fichiers
const inputVideo = "output.mp4";
const scratchesVideo = "public/scratches.mp4";
const whooshAudio = "public/whoosh.mp3";
const outputVideo = "output_video.mp4";

// 1️⃣ Récupérer la durée de la vidéo en secondes
const ffprobe = spawnSync("ffprobe", [
  "-v", "error",
  "-select_streams", "v:0",
  "-show_entries", "format=duration",
  "-of", "default=noprint_wrappers=1:nokey=1",
  inputVideo
]);
const duration = parseFloat(ffprobe.stdout.toString());
console.log(`Durée totale vidéo: ${duration.toFixed(2)}s`);

// 2️⃣ Lancer FFmpeg avec filtres corrigés
const ffmpegArgs = [
  "-i", inputVideo,
  "-i", scratchesVideo,
  "-i", whooshAudio,
  "-filter_complex",
  // 🔧 CORRECTIONS APPLIQUÉES :
  // - Suppression de tblend (causait le filtre rouge)
  // - Réduction du blur pour préserver la netteté
  // - Amélioration des paramètres de zoom
  `[0:v]split[v1][v2];` +
  // Première seconde avec effet zoom
  `[v1]trim=start=0:end=1,setpts=PTS-STARTPTS,scale=1080:1920,zoompan=z='1.5-0.025*on':x='iw/2-(iw/zoom/2)+sin(on*1.5)*40':y='ih/2-(ih/zoom/2)+cos(on*1.5)*40':d=1:s=1080x1920:fps=50,dblur=angle=90:radius=1,format=yuv420p[firstsec];` +
  // Reste de la vidéo sans modification de durée
  `[v2]trim=start=1:end=${duration},setpts=PTS-STARTPTS,scale=1080:1920,format=yuv420p[rest];` +
  `[firstsec][rest]concat=n=2:v=1:a=0[vout_base];` +
  `[1:v]scale=1080:1920,trim=0:${duration}[scratch_scaled];` +
  // 🔧 Réduction de l'opacité des scratches pour un effet plus subtil
  `[vout_base][scratch_scaled]blend=all_mode=overlay:all_opacity=0.3[vout];` +
  `[2:a]atrim=0:1,afade=t=in:st=0:d=0.2[aout]`,
  "-map", "[vout]",
  "-map", "[aout]",
  "-c:v", "libx264",
  // 🔧 AMÉLIORATION DE LA QUALITÉ :
  "-preset", "slow",          // Meilleure qualité (était "medium")
  "-crf", "18",               // Qualité supérieure (était "23")
  "-pix_fmt", "yuv420p",      // Format de pixel explicite
  "-profile:v", "high",       // Profil H.264 haute qualité
  "-level", "4.1",            // Niveau de compatibilité
  "-c:a", "aac",
  "-b:a", "256k",             // Bitrate audio plus élevé (était "192k")
  "-y",
  outputVideo
];

const ffmpeg = spawn("ffmpeg", ffmpegArgs);

// Barre de progression basée sur la durée
const progressBar = new cliProgress.SingleBar({
  format: 'Processing |{bar}| {percentage}% | Time: {time}s | Quality: High',
  hideCursor: true
}, cliProgress.Presets.shades_classic);

progressBar.start(duration, 0, { time: 0 });

const rl = readline.createInterface({ input: ffmpeg.stderr });
rl.on("line", (line) => {
  // Extraction du timestamp 'time=XX:XX:XX.XX'
  const match = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
  if (match) {
    const seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
    progressBar.update(Math.min(seconds, duration), { time: seconds.toFixed(2) });
  }
});

ffmpeg.on("close", (code) => {
  progressBar.stop();
  if (code === 0) {
    console.log(`✅ Video created successfully: ${outputVideo}`);
    console.log(`📊 Qualité améliorée: CRF 18, Preset slow`);
    console.log(`🎨 Filtre rouge supprimé: tblend retiré`);
  } else {
    console.error(`❌ FFmpeg exited with code ${code}`);
  }
});
