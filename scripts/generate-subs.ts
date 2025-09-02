import { spawn } from "child_process";
import path from "path";
import fs from "fs";

// 📂 chemins relatifs pour éviter les problèmes de synchronisation
const audioPath = path.join(process.cwd(), "public", "ayanokoji-voice.mp3");
const outputDir = path.join(process.cwd(), "subs");
const whisperExe = path.join(
  process.cwd(),
  "models",
  "Faster-Whisper-XXL_r245.4_windows",
  "Faster-Whisper-XXL",
  "faster-whisper-xxl.exe"
);

// 🔧 Fonction pour nettoyer les mots dans le JSON
function cleanTranscriptionData(jsonPath: string) {
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    // Définir les caractères à remplacer
    const apostropheDroite = String.fromCharCode(39); // '
    const apostropheTypo = String.fromCharCode(8217); // ’

    // Nettoyer chaque segment et ses mots
    data.segments.forEach((segment: any) => {
      segment.text = segment.text
        .replace(new RegExp(apostropheDroite, "g"), apostropheTypo)
        .replace(/\s+-\s+/g, "-")
        .replace(new RegExp(`\\s+${apostropheTypo}`, "g"), apostropheTypo)
        .replace(new RegExp(`${apostropheTypo}\\s+`, "g"), apostropheTypo);

      if (segment.words) {
        segment.words.forEach((word: any) => {
          word.word = word.word
            .replace(new RegExp(apostropheDroite, "g"), apostropheTypo)
            .replace(/\s+-\s+/g, "-")
            .replace(new RegExp(`\\s+${apostropheTypo}`, "g"), apostropheTypo)
            .replace(new RegExp(`${apostropheTypo}\\s+`, "g"), apostropheTypo);
        });
      }
    });

    // Nettoyer le texte global
    data.text = data.text
      .replace(new RegExp(apostropheDroite, "g"), apostropheTypo)
      .replace(/\s+-\s+/g, "-")
      .replace(new RegExp(`\\s+${apostropheTypo}`, "g"), apostropheTypo)
      .replace(new RegExp(`${apostropheTypo}\\s+`, "g"), apostropheTypo);

    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 4), "utf8");
    console.log("🧹 Fichier JSON nettoyé avec succès !");
  } catch (error) {
    console.error("❌ Erreur lors du nettoyage du JSON:", error);
  }
}

// 🔍 Vérifier que le fichier audio existe
if (!fs.existsSync(audioPath)) {
  console.error(`❌ Fichier audio non trouvé : ${audioPath}`);
  console.log("💡 Assurez-vous d'avoir exécuté download-random-voice.ts d'abord");
  process.exit(1);
}

console.log(`🎵 Fichier audio trouvé : ${audioPath}`);

// ⚡ Arguments de faster-whisper
const args = [
  audioPath,
  "--model", "large",
  "--language", "fr",
  "--word_timestamps", "true",
  "--output_format", "json",
  "--output_dir", outputDir,
];

console.log("⏳ Exécution de faster-whisper...");
const child = spawn(whisperExe, args, { cwd: process.cwd() });

child.stdout.on("data", (data) => console.log(data.toString()));
child.stderr.on("data", (data) => console.error(data.toString()));

child.on("close", (code) => {
  if (code === 0) {
    console.log("✅ Faster-Whisper terminé !");
    console.log("📂 Fichier JSON généré dans :", outputDir);

    // 🔎 Nettoyage du JSON généré
    const jsonFileName = path.basename(audioPath, path.extname(audioPath)) + ".json";
    const jsonPath = path.join(outputDir, jsonFileName);

    setTimeout(() => {
      if (fs.existsSync(jsonPath)) {
        cleanTranscriptionData(jsonPath);
      } else {
        console.error("❌ Fichier JSON non trouvé:", jsonPath);
      }
    }, 1000);
  } else {
    console.error(`❌ Process terminé avec code ${code}`);
  }
});
