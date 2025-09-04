import "dotenv/config";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const localVideoPath = path.join(process.cwd(), "output_with_emojis.mp4");
const linkFilePath = path.join(process.cwd(), "cloudinary-link.txt");

async function uploadVideo() {
  console.log(`📤 Upload de ${localVideoPath} vers Cloudinary...`);

  if (!fsSync.existsSync(localVideoPath)) {
    console.error("❌ Fichier local introuvable:", localVideoPath);
    process.exit(1);
  }

  try {
    const result = await cloudinary.uploader.upload(localVideoPath, {
      resource_type: "video",
      public_id: "AnimeVideo",
    });

    console.log("✅ Upload réussi !");
    console.log("🌍 Résultat complet:", result);

    const url = result.secure_url || result.url;
    console.log("URL récupérée:", url, typeof url);

    if (!url) {
      console.error("❌ Aucun URL trouvé dans la réponse d’upload.");
      process.exit(1);
    }

    await fs.writeFile(linkFilePath, url, "utf-8");
    console.log("✅ URL écrite dans", linkFilePath);
    console.log("🌍 URL sécurisée:", url);
  } catch (error) {
    console.error("❌ Erreur Cloudinary:", error);
  }
}

uploadVideo();
