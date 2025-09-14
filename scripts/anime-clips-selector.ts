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

  // Filtrer uniquement le dossier tiktok-anime
  const availableClips = data.resources.filter((r) => r.asset_folder === "tiktok-anime");
  console.log(`🗂️ Clips trouvés dans tiktok-anime (${availableClips.length}) :`);
  availableClips.forEach((clip, idx) => {
    console.log(`  [${idx}] public_id: ${clip.public_id}`);
  });

  // Sélectionner le clip d'intro (public_id commence par 'intro-ayano')
  const introClip = availableClips.find((clip) => clip.public_id.startsWith("intro-ayano"));
  console.log("🔍 Résultat recherche intro-ayano:", introClip ? `TROUVÉ (${introClip.public_id})` : "NON TROUVÉ");
  if (!introClip) {
    console.error("❌ Le clip d'intro 'intro-ayano' est introuvable dans tiktok-anime");
    process.exit(1);
  }

  if (availableClips.length === 0) {
    console.error("❌ Aucun clip trouvé dans le dossier tiktok-anime");
    process.exit(1);
  }

  console.log(`📺 ${availableClips.length} clips disponibles`);

  const selectedClips: SelectedClip[] = [];
  let totalDuration = 0;
  const usedClipIds = new Set<string>();

  // Ajouter le clip d'intro en premier
  let introDuration = introClip.media_metadata?.duration;
  if (!introDuration) {
    try {
      console.warn(`⚠️ Duration manquante pour intro-ayano, fallback avec get-video-duration`);
      introDuration = await getVideoDurationInSeconds(introClip.secure_url);
    } catch (err) {
      console.error(`❌ Impossible de récupérer la durée pour intro-ayano:`, err);
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
  console.log(`✅ Clip d'intro ajouté : intro-ayano (${introDuration.toFixed(2)}s)`);

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
