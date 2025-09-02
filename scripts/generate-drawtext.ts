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

// 🔹 Fonction pour nettoyer et échapper le texte
function cleanAndEscapeText(text: string): string {
  return text
    // Nettoyer les caractères problématiques
    .replace(/[«»]/g, '"')           // Guillemets français → guillemets normaux
    .replace(/'/g, "'")              // Apostrophe courbe → apostrophe droite
    .replace(/…/g, "...")            // Points de suspension
    .replace(/–/g, "-")              // Tiret moyen → tiret normal
    .replace(/—/g, "-")              // Tiret long → tiret normal
    .replace(/\u00A0/g, " ")         // Espace insécable → espace normal
    .trim()
    // Échapper pour FFmpeg
    .replace(/\\/g, "\\\\")          // Backslash
    .replace(/'/g, "\\'")            // Apostrophe
    .replace(/"/g, '\\"')            // Guillemets
    .replace(/:/g, "\\:")            // Deux-points
    .replace(/,/g, "\\,")            // Virgule
    .replace(/\[/g, "\\[")           // Crochets
    .replace(/\]/g, "\\]")           // Crochets
    .replace(/\(/g, "\\(")           // Parenthèses
    .replace(/\)/g, "\\)")           // Parenthèses
    .replace(/;/g, "\\;")            // Point-virgule
    .replace(/%/g, "\\%");           // Pourcentage
}

// 🔹 Fonction pour identifier les mots clés à surligner
function isKeyword(word: string): boolean {
  const keywords = [
    'liberté', 'libres', 'illusion', 'choix', 'société', 'contraintes',
    'décisions', 'réellement', 'prisonniers', 'honnêtes', 'majorité'
  ];
  return keywords.some(keyword => word.toLowerCase().includes(keyword.toLowerCase()));
}

// 🔹 Fonction pour grouper les mots courts avec les suivants
function smartGroupWords(words: Word[], minDuration = 0.3, maxWordsPerGroup = 5): Word[][] {
  const groups: Word[][] = [];
  let currentGroup: Word[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const duration = word.end - word.start;

    // Nettoyer le mot
    word.word = word.word.trim();

    // Ignorer les mots vides
    if (!word.word) continue;

    currentGroup.push(word);

    // Conditions pour fermer le groupe :
    // 1. Le mot actuel a une durée suffisante ET le groupe n'est pas vide
    // 2. Le groupe a atteint la taille maximale
    // 3. C'est le dernier mot
    const shouldCloseGroup =
      (duration >= minDuration && currentGroup.length > 0) ||
      currentGroup.length >= maxWordsPerGroup ||
      i === words.length - 1;

    if (shouldCloseGroup) {
      if (currentGroup.length > 0) {
        groups.push([...currentGroup]);
        currentGroup = [];
      }
    }
  }

  return groups;
}

// 🔹 Lecture et parsing du JSON avec gestion d'erreurs
let transcriptionData: TranscriptionData;
try {
  const jsonContent = fs.readFileSync(jsonPath, "utf8");
  transcriptionData = JSON.parse(jsonContent);
} catch (error) {
  console.error("❌ Erreur lors de la lecture du fichier JSON :", error);
  process.exit(1);
}

const allWords: Word[] = transcriptionData.segments.flatMap(segment => segment.words);
console.log(`📖 Nombre total de mots extraits : ${allWords.length}`);

// 🔹 Grouper intelligemment les mots
const wordGroups = smartGroupWords(allWords, 0.3, 4);
console.log(`📚 Nombre de groupes créés : ${wordGroups.length}`);

// 🔹 Construction des filtres avec style moderne
const drawFilters = wordGroups.map((group, groupIndex) => {
  if (group.length === 0) return '';

  const firstWord = group[0];
  const lastWord = group[group.length - 1];
  const groupText = group.map(w => w.word).join(' ');

  const start = firstWord.start.toFixed(2);
  const end = lastWord.end.toFixed(2);

  // Nettoyer et échapper le texte
  const cleanText = cleanAndEscapeText(groupText);

  // Vérifier que le texte n'est pas vide après nettoyage
  if (!cleanText) return '';

  // Style moderne avec fond semi-transparent et police en gras
  return `drawtext=fontfile='${fontPath}':text='${cleanText}':` +
         `x=(w-text_w)/2:y=h*0.75:` +
         `fontsize=72:fontcolor=white:` +
         `enable='between(t,${start},${end})':` +
         `borderw=4:bordercolor=black:` +
         `box=1:boxcolor=black@0.6:boxborderw=10`;
}).filter(filter => filter !== ''); // Supprimer les filtres vides

// 🔹 Ajouter des mots clés surlignés en jaune (avec regroupement intelligent)
const keywordGroups = wordGroups.filter(group =>
  group.some(word => isKeyword(word.word))
);

const keywordFilters = keywordGroups.map((group, i) => {
  const firstWord = group[0];
  const lastWord = group[group.length - 1];
  const groupText = group.map(w => w.word).join(' ');

  const start = firstWord.start.toFixed(2);
  const end = lastWord.end.toFixed(2);
  const cleanText = cleanAndEscapeText(groupText);

  if (!cleanText) return '';

  return `drawtext=fontfile='${fontPath}':text='${cleanText}':` +
         `x=(w-text_w)/2:y=h*0.75:` +
         `fontsize=78:fontcolor=yellow:` +
         `enable='between(t,${start},${end})':` +
         `borderw=5:bordercolor=black:` +
         `box=1:boxcolor=black@0.8:boxborderw=12`;
}).filter(filter => filter !== '');

// 🔹 Combiner tous les filtres
const allFilters = [...drawFilters, ...keywordFilters].filter(f => f);
const filterComplex = allFilters.join(",");

// 🔹 Vérifier que nous avons des filtres
if (allFilters.length === 0) {
  console.error("❌ Aucun filtre généré ! Vérifiez vos données.");
  process.exit(1);
}

// 🔹 Commande FFmpeg avec overlay pour l'effet moderne
const ffmpegCommand = `ffmpeg -i "${videoInput}" -vf "${filterComplex}" -c:a copy "${videoOutput}"`;

console.log("🎬 Commande FFmpeg générée (style moderne) :\n");
console.log(ffmpegCommand);

console.log(`\n📊 Statistiques :`);
console.log(`- Nombre de groupes de mots : ${wordGroups.length}`);
console.log(`- Nombre de filtres texte : ${drawFilters.length}`);
console.log(`- Nombre de mots clés surlignés : ${keywordFilters.length}`);
console.log(`- Nombre total de mots : ${allWords.length}`);
console.log(`- Langue détectée : ${transcriptionData.language}`);

// 🔹 Version alternative avec effet de zoom/scale sur les mots clés
console.log("\n\n🎭 Version alternative mot par mot avec durée minimum :");
const individualWordFilters = allWords
  .filter(word => word.word.trim() !== '')
  .map((word, i) => {
    const start = word.start.toFixed(2);
    // Assurer une durée minimum de 0.5 secondes
    const minEnd = word.start + 0.5;
    const end = Math.max(word.end, minEnd).toFixed(2);

    const cleanText = cleanAndEscapeText(word.word);
    if (!cleanText) return '';

    const isKey = isKeyword(word.word);
    const fontsize = isKey ? 84 : 68;
    const fontcolor = isKey ? 'yellow' : 'white';
    const borderw = isKey ? 5 : 3;

    return `drawtext=fontfile='${fontPath}':text='${cleanText}':` +
           `x=(w-text_w)/2:y=h*0.8:` +
           `fontsize=${fontsize}:fontcolor=${fontcolor}:` +
           `enable='between(t,${start},${end})':` +
           `borderw=${borderw}:bordercolor=black:` +
           `box=1:boxcolor=black@0.7:boxborderw=12`;
  })
  .filter(filter => filter !== '');

const alternativeCommand = `ffmpeg -i "${videoInput}" -vf "${individualWordFilters.join(",")}" -c:a copy "${videoOutput.replace('.mp4', '_individual.mp4')}"`;
console.log(alternativeCommand);

// 🔹 Export des commandes
const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const exportData = {
  command: ffmpegCommand,
  // individualCommand: alternativeCommand,
  // stats: {
  //   totalWords: allWords.length,
  //   wordGroups: wordGroups.length,
  //   keywordGroups: keywordGroups.length,
  //   language: transcriptionData.language
  // },
  // createdAt: new Date().toISOString()
};

const commandPath = path.join(publicDir, 'ffmpeg-commands.json');
fs.writeFileSync(commandPath, JSON.stringify(exportData, null, 2), 'utf8');
console.log(`✅ Commandes exportées dans : ${commandPath}`);

// 🔹 Debug : afficher quelques exemples de nettoyage
console.log("\n🔍 Exemples de nettoyage de texte :");
const sampleWords = allWords.slice(0, 5);
sampleWords.forEach(word => {
  const original = word.word;
  const cleaned = cleanAndEscapeText(original);
  if (original !== cleaned) {
    console.log(`  "${original}" → "${cleaned}"`);
  }
});
