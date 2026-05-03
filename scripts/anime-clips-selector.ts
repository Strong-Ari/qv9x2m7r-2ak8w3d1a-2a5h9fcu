import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getVideoDurationInSeconds } from 'get-video-duration';

// Chemins des fichiers
const audioInfoPath = path.join(process.cwd(), "public", "audio-info.json");
const selectedClipsPath = path.join(process.cwd(), "public", "selected-clips.json");

interface AudioInfo {
  duration: number;
  cloudinaryId: string;
}

interface CloudinaryResource {
  public_id: string;
  secure_url: string;
  asset_folder: string;
  media_metadata?: {
    duration?: number; // durée en secondes
  };
}

interface CloudinaryResponse {
  resources: CloudinaryResource[];
}

interface SelectedClip {
  url: string;
  duration: number;
  public_id: string;
}

async function main() {
  if (!fs.existsSync(audioInfoPath)) {
    console.error("❌ Le fichier audio-info.json n'existe pas. Générez d'abord l'audio !");
    process.exit(1);
  }

  const audioInfo: AudioInfo = JSON.parse(fs.readFileSync(audioInfoPath, "utf-8"));
  const targetDuration = audioInfo.duration;
  console.log(`🎵 Durée cible : ${targetDuration} secondes`);

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error("❌ Variables Cloudinary non configurées !");
    process.exit(1);
  }

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/video?type=upload&max_results=500&media_metadata=true`;

  console.log("📡 Récupération de la liste des clips...");
  const response = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!response.ok) {
    console.error("❌ Erreur lors de la récupération des clips:", await response.text());
    process.exit(1);
  }

  const data: CloudinaryResponse = await response.json();

  const args = process.argv.slice(2);
  console.log(`🔢 Arguments reçus dans selector : ${args.length > 0 ? args.join(", ") : "aucun"}`);

  let introPrefix: string | null = null;
  const introArg = args.find(a => a.startsWith("--intro-"));
  
  if (introArg) {
    introPrefix = introArg.replace("--", "");
  } else if (process.env.npm_config_intro_ayano) {
    introPrefix = "intro-ayano";
  } else if (process.env.npm_config_intro_default) {
    introPrefix = "intro-default";
  }

  // Le public ID exact pour intro-ayano
  if (introPrefix === "intro-ayano") {
    introPrefix = "intro-ayano_t4vq4s";
  }

  // Filtrer uniquement le dossier tiktok-anime
  const availableClipsAll = data.resources.filter((r) => r.asset_folder === "tiktok-anime");
  console.log(`🗂️ ${availableClipsAll.length} clips trouvés dans le dossier tiktok-anime`);

  // Filtrer les clips pour la sélection aléatoire (exclure les intros)
  const availableClips = availableClipsAll.filter((r) => !r.public_id.includes('intro-'));

  let selectedClips: SelectedClip[] = [];
  let totalDuration = 0;
  const usedClipIds = new Set<string>();

  if (introPrefix) {
    console.log(`🎬 Recherche de l'intro avec le préfixe : ${introPrefix}`);
    const introClip = data.resources.find((clip) => clip.public_id.includes(introPrefix));
    
    if (introClip) {
      console.log(`✅ Intro trouvée : ${introClip.public_id}`);
      
      let introDuration = introClip.media_metadata?.duration;
      if (!introDuration) {
        try {
          console.warn(`⚠️ Duration manquante pour ${introClip.public_id}, fallback avec get-video-duration`);
          introDuration = await getVideoDurationInSeconds(introClip.secure_url);
        } catch (err) {
          console.error(`❌ Impossible de récupérer la durée pour ${introClip.public_id}:`, err);
          process.exit(1);
        }
      }

      selectedClips.push({
        url: introClip.secure_url,
        duration: introDuration,
        public_id: introClip.public_id,
      });
      totalDuration += introDuration;
      usedClipIds.add(introClip.public_id);
      console.log(`✅ Clip d'intro ajouté : ${introClip.public_id} (${introDuration.toFixed(2)}s)`);
    } else {
      console.warn(`⚠️ Aucune intro trouvée commençant par "${introPrefix}" dans le dossier tiktok-anime`);
      console.log("Liste des public_ids disponibles :");
      availableClipsAll.forEach(c => console.log(`  - ${c.public_id}`));
      process.exit(1);
    }
  }

  console.log(`📺 ${availableClips.length} clips disponibles pour la sélection aléatoire`);
  console.log("🎯 Sélection des clips...");
  while (totalDuration < targetDuration) {
    const unusedClips = availableClips.filter((clip) => !usedClipIds.has(clip.public_id));
    if (unusedClips.length === 0) {
      usedClipIds.clear();
      continue;
    }

    const randomClip = unusedClips[crypto.randomInt(0, unusedClips.length)];

    let clipDuration = randomClip.media_metadata?.duration;
    if (!clipDuration) {
      try {
        console.warn(`⚠️ Duration manquante pour ${randomClip.public_id}, fallback avec get-video-duration`);
        clipDuration = await getVideoDurationInSeconds(randomClip.secure_url);
      } catch (err) {
        console.error(`❌ Impossible de récupérer la durée pour ${randomClip.public_id}:`, err);
        usedClipIds.add(randomClip.public_id);
        continue;
      }
    }

    selectedClips.push({
      url: randomClip.secure_url,
      duration: clipDuration,
      public_id: randomClip.public_id,
    });

    totalDuration += clipDuration;
    usedClipIds.add(randomClip.public_id);

    console.log(`✅ Clip ajouté : ${randomClip.public_id} (${clipDuration.toFixed(2)}s) - Total: ${totalDuration.toFixed(2)}s/${targetDuration.toFixed(2)}s`);
  }

  // Sauvegarde
  const selectionInfo = {
    audioId: audioInfo.cloudinaryId,
    audioDuration: targetDuration,
    totalClipsDuration: totalDuration,
    clipCount: selectedClips.length,
    clips: selectedClips,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(selectedClipsPath, JSON.stringify(selectionInfo, null, 2));
  console.log("\n✨ Sélection terminée !");
  console.table(selectedClips.map(c => ({ public_id: c.public_id, duration: c.duration.toFixed(2), url: c.url })));
  console.log(`💾 Sélection sauvegardée dans ${path.basename(selectedClipsPath)}`);
}

main().catch((err) => {
  console.error("💥 Erreur non gérée :", err);
  process.exit(1);
});
