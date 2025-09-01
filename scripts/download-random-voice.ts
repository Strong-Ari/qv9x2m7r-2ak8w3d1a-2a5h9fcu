import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

const localAudioWavPath = path.join(process.cwd(), "public", "ayanokoji-voice.wav");
const localAudioMp3Path = path.join(process.cwd(), "public", "ayanokoji-voice.mp3");

async function main() {
  // Vérifier si les variables Cloudinary sont configurées
  if (!cloudName || !apiKey || !apiSecret) {
    console.log(
      "⚠️ Variables Cloudinary non configurées, utilisation d'un fichier audio local...",
    );

    // Chercher les fichiers audio locaux (wav ou mp3)
    const soundsDir = path.join(process.cwd(), "public", "sounds");
    let soundFiles: string[] = [];
    if (fs.existsSync(soundsDir)) {
      soundFiles = fs
        .readdirSync(soundsDir)
        .filter((file) => file.endsWith(".wav") || file.endsWith(".mp3"));
    }

    if (soundFiles.length > 0) {
      const randomSound = soundFiles[crypto.randomInt(0, soundFiles.length)];
      const sourcePath = path.join(soundsDir, randomSound);
      const ext = path.extname(randomSound);
      const destPath = ext === ".mp3" ? localAudioMp3Path : localAudioWavPath;
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ Copié ${randomSound} vers ${path.basename(destPath)}`);
      return;
    }

    // Aucun fichier trouvé, créer un fichier vide wav ET mp3
    console.log("⚠️ Aucun fichier audio trouvé, création de fichiers vides");
    fs.writeFileSync(localAudioWavPath, new Uint8Array(0));
    fs.writeFileSync(localAudioMp3Path, new Uint8Array(0));
    return;
  }

  console.log("🎵 Récupération de la liste des musiques sur Cloudinary...");

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  // URL de l'API - d'abord récupérer tous les fichiers pour voir la structure
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/video?type=upload&max_results=500`;
  console.log("📡 URL appelée :", url);

  // 1. Récupérer la liste des fichiers
  const listResponse = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  if (!listResponse.ok) {
    const errorText = await listResponse.text();
    console.error(
      "❌ Erreur lors de la récupération des fichiers :",
      errorText,
    );
    console.log("⚠️ Utilisation d'un fichier audio local par défaut...");

    // Utiliser un fichier local en cas d'erreur
    const soundsDir = path.join(process.cwd(), "public", "sounds");
    let soundFiles: string[] = [];
    if (fs.existsSync(soundsDir)) {
      soundFiles = fs
        .readdirSync(soundsDir)
        .filter((file) => file.endsWith(".wav") || file.endsWith(".mp3"));
    }
    if (soundFiles.length > 0) {
      const randomSound = soundFiles[crypto.randomInt(0, soundFiles.length)];
      const sourcePath = path.join(soundsDir, randomSound);
      const ext = path.extname(randomSound);
      const destPath = ext === ".mp3" ? localAudioMp3Path : localAudioWavPath;
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ Copié ${randomSound} vers ${path.basename(destPath)}`);
      return;
    }
    fs.writeFileSync(localAudioWavPath, new Uint8Array(0));
    fs.writeFileSync(localAudioMp3Path, new Uint8Array(0));
    return;
  }

  interface CloudinaryResource {
    asset_folder: string;
    is_audio?: boolean;
    format: string;
    public_id: string;
    secure_url: string;
  }

  interface CloudinaryResponse {
    resources: CloudinaryResource[];
  }

  const listData = await listResponse.json() as CloudinaryResponse;

  console.log("📋 Données reçues :", JSON.stringify(listData, null, 2));

  // Filtrer pour ne garder que les fichiers du dossier "music" et audio
  const audios = listData.resources.filter(
    (resource: any) =>
      resource.asset_folder === "ayanokoji-voice" &&
      (resource.is_audio === true ||
        resource.format === "mp3" ||
        resource.format === "wav"),
  );

  if (!audios || audios.length === 0) {
    console.error("❌ Aucune musique trouvée dans le dossier 'ayanokoji-voice'.");
    process.exit(1);
  }

  console.log(`🎵 ${audios.length} musiques trouvées dans le dossier 'ayanokoji-voice'`);

  // 2. Choisir un fichier audio au hasard
  const randomAudio = audios[crypto.randomInt(0, audios.length)];
  console.log(`🎯 Musique choisie : ${randomAudio.public_id}`);
  console.log(`🔗 URL de la musique : ${randomAudio.secure_url}`);

  // 3. Télécharger la musique
  const audioResponse = await fetch(randomAudio.secure_url);
  if (!audioResponse.ok) {
    const errorText = await audioResponse.text();
    console.error(
      "❌ Erreur lors du téléchargement de la musique :",
      errorText,
    );
    process.exit(1);
  }

  const arrayBuffer = await audioResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 4. Écrire le fichier local sous le bon format
  const ext = randomAudio.format === "mp3" ? ".mp3" : ".wav";
  const destPath = ext === ".mp3" ? localAudioMp3Path : localAudioWavPath;
  fs.writeFileSync(destPath, new Uint8Array(buffer));
  console.log(`✅ Musique téléchargée → ${path.basename(destPath)}`);
}

main().catch((err) => {
  console.error("💥 Erreur non gérée :", err);
  process.exit(1);
});
