import fs from "fs";
import path from "path";

// 🔹 Config
const jsonPath = `C:\\Users\\balwa\\OneDrive\\Bureau\\anime-automation\\subs\\ayanokoji-voice.json`;
const fontPath = `C:\\Windows\\Fonts\\Impact.ttf`;
const videoInput = `C:\\Users\\balwa\\OneDrive\\Bureau\\anime-automation\\output_video.mp4`;
const videoOutput = `C:\\Users\\balwa\\OneDrive\\Bureau\\anime-automation\\output_pre_final.mp4`;

// 🔹 Interfaces
interface Word {
  word: string;
  start: number;
  end: number;
  probability: number;
}

interface Segment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
  words: Word[];
  temperature: number;
}

interface TranscriptionData {
  segments: Segment[];
  language: string;
  text: string;
}

// 🔹 Fonction pour identifier les mots clés à surligner
function isKeyword(word: string): boolean {
  const keywords = [
    'liberté', 'libres', 'illusion', 'choix', 'société', 'contraintes',
    'décisions', 'réellement', 'prisonniers', 'honnêtes', 'majorité'
  ];
  return keywords.some(keyword => word.toLowerCase().includes(keyword.toLowerCase()));
}

// 🔹 Lecture et parsing du JSON
const transcriptionData: TranscriptionData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const allWords: Word[] = transcriptionData.segments.flatMap(segment => segment.words);

// 🔹 Grouper les mots par phrases (environ 3-5 mots par groupe)
function groupWordsIntoPhrases(words: Word[], maxWordsPerPhrase = 4): Word[][] {
  const phrases: Word[][] = [];
  for (let i = 0; i < words.length; i += maxWordsPerPhrase) {
    phrases.push(words.slice(i, i + maxWordsPerPhrase));
  }
  return phrases;
}

const phrases = groupWordsIntoPhrases(allWords, 4);

// 🔹 Construction des filtres avec style moderne
const drawFilters = phrases.map((phrase, phraseIndex) => {
  const firstWord = phrase[0];
  const lastWord = phrase[phrase.length - 1];
  const phraseText = phrase.map(w => w.word).join(' ');

  const start = firstWord.start.toFixed(2);
  const end = lastWord.end.toFixed(2);

  // Échapper les caractères spéciaux
  const escapedText = phraseText.replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/,/g, "\\,");

  // Style moderne avec fond semi-transparent et police en gras
  return `drawtext=fontfile='${fontPath}':text='${escapedText}':` +
         `x=(w-text_w)/2:y=h*0.75:` +
         `fontsize=72:fontcolor=white:` +
         `enable='between(t,${start},${end})':` +
         `borderw=4:bordercolor=black:` +
         `box=1:boxcolor=black@0.6:boxborderw=10`;
});

// 🔹 Ajouter des mots clés surlignés en jaune
const keywordFilters = allWords
  .filter(word => isKeyword(word.word))
  .map((word, i) => {
    const start = word.start.toFixed(2);
    const end = word.end.toFixed(2);
    const escapedText = word.word.replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/,/g, "\\,");

    return `drawtext=fontfile='${fontPath}':text='${escapedText}':` +
           `x=(w-text_w)/2:y=h*0.75:` +
           `fontsize=72:fontcolor=yellow:` +
           `enable='between(t,${start},${end})':` +
           `borderw=4:bordercolor=black:` +
           `box=1:boxcolor=black@0.8:boxborderw=10`;
  });

// 🔹 Combiner tous les filtres
const allFilters = [...drawFilters, ...keywordFilters];
const filterComplex = allFilters.join(",");

// 🔹 Commande FFmpeg avec overlay pour l'effet moderne
const ffmpegCommand = `ffmpeg -i "${videoInput}" -vf "${filterComplex}" -c:a copy "${videoOutput}"`;

console.log("🎬 Commande FFmpeg générée (style moderne) :\n");
console.log(ffmpegCommand);

console.log(`\n📊 Statistiques :`);
console.log(`- Nombre de phrases : ${phrases.length}`);
console.log(`- Nombre de mots clés surlignés : ${keywordFilters.length}`);
console.log(`- Nombre total de mots : ${allWords.length}`);
console.log(`- Langue détectée : ${transcriptionData.language}`);

// 🔹 Version alternative avec effet de zoom/scale sur les mots clés
console.log("\n\n🎭 Version alternative avec effet de zoom :");
const scaleFilters = allWords.map((word, i) => {
  const start = word.start.toFixed(2);
  const end = word.end.toFixed(2);
  const escapedText = word.word.replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/,/g, "\\,");

  const isKey = isKeyword(word.word);
  const fontsize = isKey ? 84 : 68;  // Plus gros pour les mots clés
  const fontcolor = isKey ? 'yellow' : 'white';
  const borderw = isKey ? 5 : 3;

  return `drawtext=fontfile='${fontPath}':text='${escapedText}':` +
         `x=(w-text_w)/2:y=h*0.8:` +
         `fontsize=${fontsize}:fontcolor=${fontcolor}:` +
         `enable='between(t,${start},${end})':` +
         `borderw=${borderw}:bordercolor=black:` +
         `box=1:boxcolor=black@0.7:boxborderw=12`;
});

const alternativeCommand = `ffmpeg -i "${videoInput}" -vf "${scaleFilters.join(",")}" -c:a copy "${videoOutput.replace('.mp4', '_zoom.mp4')}"`;
console.log(alternativeCommand);


// 🔹 Ajouter à la fin de votre script existant

// Créer le dossier public s'il n'existe pas
const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Version simplifiée si vous voulez juste la commande
const simpleExport = {
  ffmpegCommand: alternativeCommand,
  createdAt: new Date().toISOString()
};

// Exporter juste la commande
const commandOnlyPath = path.join(publicDir, 'ffmpeg-command.json');
fs.writeFileSync(commandOnlyPath, JSON.stringify({ command: alternativeCommand }, null, 2), 'utf8');
console.log(`✅ Commande exportée dans : ${commandOnlyPath}`);
