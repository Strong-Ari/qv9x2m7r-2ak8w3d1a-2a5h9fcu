import fs from "fs";
import path from "path";

// 📂 Chemin du fichier JSON à nettoyer
const jsonPath = path.join(__dirname, "..", "subs", "ayanokoji-voice.json");

// 🔧 Fonction pour nettoyer le JSON
function cleanJsonFile() {
  try {
    console.log("🔍 Lecture du fichier JSON...");
    const rawData = fs.readFileSync(jsonPath, 'utf8');

    // Remplacer directement dans le texte brut avant de parser
    const apostropheDroite = String.fromCharCode(39);   // ' (apostrophe droite)
    const apostropheTypo = String.fromCharCode(8217);   // ' (apostrophe typographique \u2019)

    const cleanedRawData = rawData
      .replace(new RegExp(apostropheDroite, 'g'), apostropheTypo)  // ' → '
      .replace(/\s+-\s+/g, "-");       // "est -elle" → "est-elle"

    console.log("🧹 Nettoyage des apostrophes et tirets...");

    // Parser et re-formater pour s'assurer que la structure JSON est correcte
    const data = JSON.parse(cleanedRawData);

    // Sauvegarder le fichier nettoyé
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 4), 'utf8');

    console.log("✅ Fichier JSON nettoyé avec succès !");
    console.log("📂 Fichier mis à jour :", jsonPath);

    // Afficher quelques exemples de mots nettoyés
    console.log("\n🔍 Exemples de mots après nettoyage :");
    const sampleWords = data.segments[0]?.words?.slice(0, 10) || [];
    sampleWords.forEach((word: any, index: number) => {
      console.log(`  ${index + 1}. "${word.word}"`);
    });

  } catch (error) {
    console.error("❌ Erreur lors du nettoyage du JSON:", error);
  }
}

// Exécuter le nettoyage
cleanJsonFile();
