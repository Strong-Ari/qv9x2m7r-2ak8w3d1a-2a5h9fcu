import { exec } from "child_process";
import path from "path";
import fs from "fs";

// 📂 chemins relatifs pour éviter les problèmes de synchronisation
const audioPath = path.join(process.cwd(), "public", "ayanokoji-voice.mp3");
const outputDir = path.join(process.cwd(), "subs");
const whisperExe = path.join(process.cwd(), "models", "Faster-Whisper-XXL_r245.4_windows", "Faster-Whisper-XXL", "faster-whisper-xxl.exe");

// 🔧 Fonction pour nettoyer les mots dans le JSON
function cleanTranscriptionData(jsonPath: string) {
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Définir les caractères à remplacer
    const apostropheDroite = String.fromCharCode(39);   // ' (apostrophe droite)
    const apostropheTypo = String.fromCharCode(8217);   // ' (apostrophe typographique \u2019)

    // Nettoyer chaque segment et ses mots
    data.segments.forEach((segment: any) => {
      // Nettoyer le texte du segment
      segment.text = segment.text
        .replace(new RegExp(apostropheDroite, 'g'), apostropheTypo)  // ' → '
        .replace(/\s+-\s+/g, "-")        // "est -elle" → "est-elle"
        .replace(new RegExp(`\\s+${apostropheTypo}`, 'g'), apostropheTypo)  // Supprimer espace avant apostrophe
        .replace(new RegExp(`${apostropheTypo}\\s+`, 'g'), apostropheTypo); // Supprimer espace après apostrophe

      // Nettoyer chaque mot individuel
      if (segment.words) {
        segment.words.forEach((word: any) => {
          word.word = word.word
            .replace(new RegExp(apostropheDroite, 'g'), apostropheTypo)  // ' → '
            .replace(/\s+-\s+/g, "-")    // "est -elle" → "est-elle"
            .replace(new RegExp(`\\s+${apostropheTypo}`, 'g'), apostropheTypo)  // Supprimer espace avant apostrophe
            .replace(new RegExp(`${apostropheTypo}\\s+`, 'g'), apostropheTypo); // Supprimer espace après apostrophe
        });
      }
    });

    // Nettoyer le texte global
    data.text = data.text
      .replace(new RegExp(apostropheDroite, 'g'), apostropheTypo)
      .replace(/\s+-\s+/g, "-")
      .replace(new RegExp(`\\s+${apostropheTypo}`, 'g'), apostropheTypo)
      .replace(new RegExp(`${apostropheTypo}\\s+`, 'g'), apostropheTypo);

    // Sauvegarder le fichier nettoyé
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 4), 'utf8');
    console.log("🧹 Fichier JSON nettoyé avec succès !");

  } catch (error) {
    console.error("❌ Erreur lors du nettoyage du JSON:", error);
  }
}

// � Vérimfier que le fichier audio existe
if (!fs.existsSync(audioPath)) {
  console.error(`❌ Fichier audio non trouvé : ${audioPath}`);
  console.log("💡 Assurez-vous d'avoir exécuté download-random-voice.ts d'abord");
  process.exit(1);
}

console.log(`🎵 Fichier audio trouvé : ${audioPath}`);

// 🖥️ commande whisper
const command = `
  "${whisperExe}" "${audioPath}"
  --model large
  --language fr
  --word_timestamps true
  --output_format json
  --output_dir "${outputDir}"
`;

console.log("⏳ Exécution de faster-whisper...");
exec(command, { cwd: path.resolve(__dirname) }, (error, _stdout, stderr) => {
  if (error) {
    console.error("❌ Erreur:", error.message);
    return;
  }
  if (stderr) {
    console.error("⚠️ Log:", stderr);
  }
  console.log("✅ Faster-Whisper terminé !");
  console.log("📂 Fichier JSON généré dans :", outputDir);

  // 🧹 Post-traitement : nettoyer le JSON généré
  const jsonFileName = path.basename(audioPath, path.extname(audioPath)) + '.json';
  const jsonPath = path.join(outputDir, jsonFileName);

  // Attendre un peu que le fichier soit complètement écrit
  setTimeout(() => {
    if (fs.existsSync(jsonPath)) {
      cleanTranscriptionData(jsonPath);
    } else {
      console.error("❌ Fichier JSON non trouvé:", jsonPath);
    }
  }, 1000);
});
