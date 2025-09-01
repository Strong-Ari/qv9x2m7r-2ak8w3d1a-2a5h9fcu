import { exec } from "child_process";
import path from "path";

// 📂 chemins
const audioPath = `C:\\Users\\balwa\\OneDrive\\Bureau\\anime-automation\\public\\ayanokoji-voice.mp3`;
const outputDir = `C:\\Users\\balwa\\OneDrive\\Bureau\\anime-automation\\subs`;
const whisperExe = `C:\\Users\\balwa\\OneDrive\\Bureau\\anime-automation\\models\\Faster-Whisper-XXL_r245.4_windows\\Faster-Whisper-XXL\\faster-whisper-xxl.exe`;


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
  console.log("✅ Terminé !");
  console.log("📂 Fichier JSON généré dans :", outputDir);
});
