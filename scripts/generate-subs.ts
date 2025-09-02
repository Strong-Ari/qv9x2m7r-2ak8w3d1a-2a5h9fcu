import { exec } from "child_process";
import path from "path";
import fs from "fs";

// 📂 chemins
const audioPath = `C:\\Users\\balwa\\OneDrive\\Bureau\\anime-automation\\public\\ayanokoji-voice.mp3`;
const outputDir = `C:\\Users\\balwa\\OneDrive\\Bureau\\anime-automation\\subs`;
const whisperExe = `C:\\Users\\balwa\\OneDrive\\Bureau\\anime-automation\\models\\Faster-Whisper-XXL_r245.4_windows\\Faster-Whisper-XXL\\faster-whisper-xxl.exe`;

// � Foncmtion pour nettoyer les mots dans le JSON
function cleanTranscriptionData(jsonPath: string) {
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Définir les caractères à remplacer (utilisation de codes Unicode pour éviter l'auto-formatage)
    const apostropheCourbe = '\u2019';  // '
    const apostrophePenche = '\u0027';  // '
’
    // Nettoyer chaque segment et ses mots
    data.segments.forEach((segment: any) => {
      // Nettoyer le texte du segment
      segment.text = segment.text
        .replace(new RegExp(apostropheCourbe, 'g'), apostrophePenche)  // Apostrophe courbe → apostrophe penché
        .replace(/\s+-\s+/g, "-")        // "est -elle" → "est-elle"
        .replace(new RegExp(`\\s+${apostrophePenche}`, 'g'), apostrophePenche)  // Supprimer espace avant apostrophe
        .replace(new RegExp(`${apostrophePenche}\\s+`, 'g'), apostrophePenche); // Supprimer espace après apostrophe

      // Nettoyer chaque mot individuel
      if (segment.words) {
        segment.words.forEach((word: any) => {
          word.word = word.word
            .replace(new RegExp(apostropheCourbe, 'g'), apostrophePenche)  // Apostrophe courbe → apostrophe penché
            .replace(/\s+-\s+/g, "-")    // "est -elle" → "est-elle"
            .replace(new RegExp(`\\s+${apostrophePenche}`, 'g'), apostrophePenche)  // Supprimer espace avant apostrophe
            .replace(new RegExp(`${apostrophePenche}\\s+`, 'g'), apostrophePenche); // Supprimer espace après apostrophe
        });
      }
    });

    // Nettoyer le texte global
    data.text = data.text
      .replace(new RegExp(apostropheCourbe, 'g'), apostrophePenche)
      .replace(/\s+-\s+/g, "-")
      .replace(new RegExp(`\\s+${apostrophePenche}`, 'g'), apostrophePenche)
      .replace(new RegExp(`${apostrophePenche}\\s+`, 'g'), apostrophePenche);

    // Sauvegarder le fichier nettoyé
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 4), 'utf8');
    console.log("🧹 Fichier JSON nettoyé avec succès !");

  } catch (error) {
    console.error("❌ Erreur lors du nettoyage du JSON:", error);
  }
}

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
exec(command, { cwd: path.resolve(__dirname) }, (error, stdout, stderr) => {
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
