// emojify-subtitles.ts
import fs from "fs";
import path from "path";
import { pipeline } from "@xenova/transformers";
import dotenv from "dotenv";

dotenv.config();

// Type du fichier JSON en entrée
interface SubtitleLine {
  text: string;
  start: number;
}

interface SubtitleWithEmoji extends SubtitleLine {
  emoji?: string;
  translatedText?: string;
  bestScore?: number;
  allScores?: { label: string; score: number }[];
}

async function main() {
  // Fichier d'entrée défini directement dans le code
  const inputPath = "public/subtitles-with-timecodes.json";

  const resolvedPath = path.resolve(inputPath);

  // Vérifier que le fichier existe
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Fichier non trouvé : ${resolvedPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(resolvedPath, "utf-8");
  const subtitles: SubtitleLine[] = JSON.parse(rawData);

  // Pipeline de traduction français -> anglais
  console.log("🌍 Chargement du modèle de traduction...");
  const translator = await pipeline(
    "translation",
    "Xenova/opus-mt-fr-en"
  );

  // Pipeline zero-shot classification avec le modèle original
  console.log("🤖 Chargement du modèle BART (peut prendre quelques minutes au premier lancement)...");

  // Configuration du token Hugging Face si disponible
  if (process.env.HUGGINGFACE_TOKEN) {
    console.log("🔑 Token Hugging Face détecté");
  } else {
    console.warn("⚠️ Aucun token Hugging Face trouvé dans .env");
  }

  const classifier = await pipeline(
    "zero-shot-classification",
    "Xenova/bart-large-mnli",
  );

  // Ta liste d'emojis pré-définie (ici juste un exemple réduit)
  const candidateEmojis = [
    "Smile",
    "Smile-with-big-eyes",
    "Grin",
    "Grinning",
    "Laughing",
    "Grin-sweat",
    "Joy",
    "Rofl",
    "Loudly-crying",
    "Wink",
    "Kissing",
    "Kissing-smiling-eyes",
    "Kissing-closed-eyes",
    "Kissing-heart",
    "Heart-face",
    "Heart-eyes",
    "Star-struck",
    "Partying-face",
    "Melting",
    "Upside-down-face",
    "Slightly-happy",
    "Happy-cry",
    "Holding-back-tears",
    "Blush",
    "Warm-smile",
    "Relieved",
    "Head-nod",
    "Head-shake",
    "Smirk",
    "Drool",
    "Yum",
    "Stuck-out-tongue",
    "Squinting-tongue",
    "Winky-tongue",
    "Zany-face",
    "Woozy",
    "Pensive",
    "Pleading",
    "Grimacing",
    "Expressionless",
    "Neutral-face",
    "Mouth-none",
    "Face-in-clouds",
    "Dotted-line-face",
    "Zipper-face",
    "Salute",
    "Thinking-face",
    "Shushing-face",
    "Hand-over-mouth",
    "Smiling-eyes-with-hand-over-mouth",
    "Yawn",
    "Hug-face",
    "Peeking",
    "Screaming",
    "Raised-eyebrow",
    "Monocle",
    "Unamused",
    "Rolling-eyes",
    "Exhale",
    "Triumph",
    "Angry",
    "Rage",
    "Cursing",
    "Sad",
    "Sweat",
    "Worried",
    "Concerned",
    "Cry",
    "Big-frown",
    "Frown",
    "Diagonal-mouth",
    "Slightly-frowning",
    "Anxious-with-sweat",
    "Scared",
    "Anguished",
    "Gasp",
    "Mouth-open",
    "Surprised",
    "Astonished",
    "Flushed",
    "Mind-blown",
    "Scrunched-mouth",
    "Scrunched-eyes",
    "Weary",
    "Distraught",
    "X-eyes",
    "Dizzy-face",
    "Shaking-face",
    "Cold-face",
    "Hot-face",
    "Sick",
    "Vomit",
    "Tired",
    "Sleep",
    "Sleepy",
    "Sneeze",
    "Thermometer-face",
    "Bandage-face",
    "Mask",
    "Liar",
    "Halo",
    "Cowboy",
    "Money-face",
    "Nerd-face",
    "Sunglasses-face",
    "Disguise",
    "Clown",
    "Poop",
    "Imp-smile",
    "Imp-frown",
    "Ghost",
    "Skull",
    "Snowman-with-snow",
    "Snowman",
    "Jack-o-lantern",
    "Robot",
    "Alien",
    "Alien-monster",
    "Sun-with-face",
    "Moon-face-first-quarter",
    "Moon-face-last-quarter",
    "Smiley-cat",
    "Smile-cat",
    "Joy-cat",
    "Heart-eyes-cat",
    "Smirk-cat",
    "Kissing-cat",
    "Scream-cat",
    "Crying-cat-face",
    "Pouting-cat",
    "See-no-evil-monkey",
    "Hear-no-evil-monkey",
    "Speak-no-evil-monkey",
    "Glowing-star",
    "Sparkles",
    "Electricity",
    "Collision",
    "Fire",
    "100",
    "Party-popper",
    "Confetti-ball",
    "Red-heart",
    "Orange-heart",
    "Yellow-heart",
    "Green-heart",
    "Light-blue-heart",
    "Blue-heart",
    "Purple-heart",
    "Brown-heart",
    "Black-heart",
    "Grey-heart",
    "White-heart",
    "Pink-heart",
    "Cupid",
    "Gift-heart",
    "Sparkling-heart",
    "Heart-grow",
    "Beating-heart",
    "Revolving-hearts",
    "Two-hearts",
    "Love-letter",
    "Heart-box",
    "Heart-exclamation-point",
    "Bandaged-heart",
    "Broken-heart",
    "Fire-heart",
    "Kiss",
    "Footprints",
    "Fingerprint",
    "Anatomical-heart",
    "Blood",
    "Microbe",
    "Eyes",
    "Eye",
    "Biting-lip",
    "Nose",
    "Ear",
    "Hearing-aid",
    "Foot",
    "Leg",
    "Leg-mechanical",
    "Arm-mechanical",
    "Muscle",
    "Clap",
    "Thumbs-up",
    "Thumbs-down",
    "Heart-hands",
    "Raising-hands",
    "Open-hands",
    "Palms-up",
    "Fist-rightwards",
    "Fist-leftwards",
    "Raised-fist",
    "Fist",
    "Palm-down",
    "Palm-up",
    "Rightwards-hand",
    "Leftwards-hand",
    "Push-rightwards",
    "Push-leftwards",
    "Wave",
    "Back-hand",
    "Palm",
    "Raised-hand",
    "Vulcan",
    "Love-you-gesture",
    "Metal",
    "Victory",
    "Crossed-fingers",
    "Hand-with-index-finger-and-thumb-crossed",
    "Call-me-hand",
    "Pinched-fingers",
    "Pinch",
    "Ok",
    "Pointing",
    "Point-right",
    "Point-left",
    "Index-finger",
    "Point-up",
    "Point-down",
    "Middle-finger",
    "Writing-hand",
    "Selfie",
    "Folded-hands",
    "Nail-care",
    "Handshake",
    "Dancer-woman",
    "Bouquet",
    "Rose",
    "Wilted-flower",
    "Fallen-leaf",
    "Plant",
    "Leaves",
    "Luck",
    "Leafless-tree",
    "Snowflake",
    "Volcano",
    "Sunrise",
    "Sunrise-over-mountains",
    "Rainbow",
    "Bubbles",
    "Ocean",
    "Wind-face",
    "Tornado",
    "Droplet",
    "Rain-cloud",
    "Cloud-with-lightning",
    "Globe-showing-europe-africa",
    "Globe-showing-americas",
    "Globe-showing-asia-australia",
    "Comet",
    "Cow-face",
    "Unicorn",
    "Lizard",
    "Dragon",
    "T-rex",
    "Dinosaur",
    "Turtle",
    "Crocodile",
    "Snake",
    "Frog",
    "Rabbit",
    "Rat",
    "Poodle",
    "Dog",
    "Guide-dog",
    "Service-dog",
    "Pig",
    "Racehorse",
    "Donkey",
    "Ox",
    "Goat",
    "Kangaroo",
    "Tiger",
    "Monkey",
    "Gorilla",
    "Orangutan",
    "Chipmunk",
    "Otter",
    "Bat",
    "Bird",
    "Black-bird",
    "Rooster",
    "Hatching-chick",
    "Baby-chick",
    "Hatched-chick",
    "Eagle",
    "Owl",
    "Peace",
    "Goose",
    "Peacock",
    "Phoenix",
    "Seal",
    "Shark",
    "Dolphin",
    "Whale",
    "Fish",
    "Blowfish",
    "Lobster",
    "Crab",
    "Octopus",
    "Jellyfish",
    "Scorpion",
    "Spider",
    "Snail",
    "Ant",
    "Mosquito",
    "Cockroach",
    "Fly",
    "Bee",
    "Lady-bug",
    "Butterfly",
    "Bug",
    "Worm",
    "Paw Prints",
    "Tomato",
    "Root-vegetable",
    "Cooking",
    "Burrito",
    "Spaghetti",
    "Steaming-bowl",
    "Popcorn",
    "Hot-beverage",
    "Clinking-beer-mugs",
    "Clinking-glasses",
    "Bottle-with-popping-cork",
    "Wine-glass",
    "Pour",
    "Tropical-drink",
    "Construction",
    "Police-car-light",
    "Bicycle",
    "Automobile",
    "Racing-car",
    "Taxi",
    "Bus",
    "Sailboat",
    "Canoe",
    "Flying-saucer",
    "Rocket",
    "Airplane-departure",
    "Airplane-arrival",
    "Roller-coaster",
    "Ferris-wheel",
    "Camping",
    "Balloon",
    "Birthday-cake",
    "Wrapped-gift",
    "Fireworks",
    "Piñata",
    "Mirror-ball",
    "Gold-medal",
    "Silver-medal",
    "Bronze-medal",
    "Trophy",
    "Soccer-ball",
    "Baseball",
    "Softball",
    "Tennis",
    "Badminton",
    "Lacrosse",
    "Cricket-game",
    "Field-hockey",
    "Ice-hockey",
    "Ice-skate",
    "Roller-skates",
    "Ballet-shoes",
    "Skateboard",
    "Flag-in-hole",
    "Direct-hit",
    "Flying-disc",
    "Boomerang",
    "Kite",
    "Fishing-pole",
    "Martial-arts-uniform",
    "8-ball",
    "Ping-pong",
    "Bowling",
    "Die",
    "Slot-machine",
    "Wand",
    "Camera-flash",
    "Splatter",
    "Saxophone",
    "Trumpet",
    "Violin",
    "Harp",
    "Drum",
    "Maracas",
    "Clapper",
    "Battery-full",
    "Battery-low",
    "Coin",
    "Money-with-wings",
    "Gem-stone",
    "Balance-scale",
    "Light-bulb",
    "Graduation-cap",
    "Ring",
    "Fan",
    "Umbrella",
    "Shovel",
    "Gear",
    "Broken-chain",
    "Pencil",
    "Alarm-clock",
    "Bellhop-bell",
    "Bell",
    "Crystal-ball",
    "Bomb",
    "Mouse-trap",
    "Locked",
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpio",
    "Sagittarius",
    "Capricorn",
    "Aquarius",
    "Pisces",
    "Ophiuchus",
    "Exclamation",
    "Question",
    "Exclamation-question-mark",
    "Exclamation-double",
    "Cross-mark",
    "Sos",
    "Phone-off",
    "Radioactive",
    "Biohazard",
    "Warning",
    "Check-mark",
    "New",
    "Free",
    "Up!",
    "Cool",
    "Litter",
    "Peace-symbol",
    "Yin-yang",
    "Infinity",
    "Musical-notes",
    "Plus-sign",
    "Chequered-flag",
    "Triangular-flag",
    "Black-flag",
    "White-flag"
];

  // Fonction pour nettoyer le texte
  function cleanText(text: string): string {
    return text
      .replace(/[«»]/g, '"')           // Guillemets français -> anglais
      .replace(/['']/g, "'")           // Apostrophes typographiques -> normales
      .replace(/[–—]/g, "-")           // Tirets longs -> tirets normaux
      .replace(/…/g, "...")            // Points de suspension
      .replace(/\u00A0/g, " ")         // Espaces insécables -> espaces normaux
      .replace(/\s+/g, " ")            // Espaces multiples -> espace simple
      .trim();
  }

  const results: SubtitleWithEmoji[] = [];
  const debugResults: any[] = [];

  console.log(`📊 Analyse de ${subtitles.length} sous-titres...`);

  for (let i = 0; i < subtitles.length; i++) {
    const line = subtitles[i];

    // Vérifier que le texte n'est pas vide
    if (!line.text || line.text.trim() === '') {
      console.warn(`⚠️ Ligne ${i+1} ignorée (texte vide): ${JSON.stringify(line)}`);
      results.push({ ...line });
      continue;
    }

    // Nettoyer le texte français
    const cleanedText = cleanText(line.text);
    console.log(`\n🔍 [${i+1}/${subtitles.length}] Analyse: "${cleanedText}"`);

    try {
      // Traduire en anglais
      // @ts-ignore
      const translationResult = await translator(cleanedText);
      // @ts-ignore
      const translatedText = translationResult[0].translation_text;
      console.log(`🌍 Traduit: "${translatedText}"`);

      // Analyser avec le modèle de classification
      const output = await classifier(translatedText, candidateEmojis);

      // @ts-ignore Xenova types pas encore complets
      const { labels, scores } = output;

      // Créer un tableau des 5 meilleurs résultats pour debug
      const topResults = labels.slice(0, 5).map((label: string, idx: number) => ({
        label,
        score: parseFloat(scores[idx].toFixed(4))
      }));

      console.log(`📈 Top 3: ${topResults.slice(0, 3).map((r: any) => `${r.label}(${r.score})`).join(', ')}`);

      // Seuil plus bas pour avoir plus d'emojis
      const threshold = 0.15;
      const bestScore = scores[0];
      const bestEmoji = labels[0];

      const resultEntry: SubtitleWithEmoji = {
        ...line,
        translatedText,
        bestScore: parseFloat(bestScore.toFixed(4)),
        allScores: topResults
      };

      if (bestScore >= threshold) {
        resultEntry.emoji = bestEmoji;
        console.log(`✅ Emoji sélectionné: ${bestEmoji} (${bestScore.toFixed(4)})`);
      } else {
        console.log(`❌ Aucun emoji (score trop bas: ${bestScore.toFixed(4)})`);
      }

      results.push(resultEntry);

      // Données de debug
      debugResults.push({
        index: i + 1,
        originalText: line.text,
        cleanedText,
        translatedText,
        selectedEmoji: resultEntry.emoji || null,
        threshold,
        topScores: topResults
      });

    } catch (error) {
      console.error(`❌ Erreur lors de l'analyse de "${cleanedText}":`, error);
      results.push({ ...line });
    }
  }

  // Sauvegarder les résultats
  const outputPath = path.join("public", "output-with-emojis.json");
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`✅ Fichier généré : ${outputPath}`);

  // Sauvegarder les données de debug
  const debugPath = path.join("public", "emoji-analysis-debug.json");
  const debugData = {
    metadata: {
      totalSubtitles: subtitles.length,
      emojisAssigned: results.filter(r => r.emoji).length,
      threshold: 0.15,
      model: "Xenova/bart-large-mnli",
      translator: "Xenova/opus-mt-fr-en",
      timestamp: new Date().toISOString()
    },
    results: debugResults
  };

  fs.writeFileSync(debugPath, JSON.stringify(debugData, null, 2), "utf-8");
  console.log(`🐛 Fichier de debug généré : ${debugPath}`);

  // Statistiques finales
  const emojisCount = results.filter(r => r.emoji).length;
  console.log(`\n📊 Statistiques finales :`);
  console.log(`- Sous-titres analysés : ${subtitles.length}`);
  console.log(`- Emojis assignés : ${emojisCount} (${((emojisCount/subtitles.length)*100).toFixed(1)}%)`);
  console.log(`- Seuil utilisé : 0.15`);

  if (emojisCount > 0) {
    console.log(`\n🎯 Exemples d'emojis assignés :`);
    results.filter(r => r.emoji).slice(0, 3).forEach((r, i) => {
      console.log(`  ${i+1}. "${r.text}" → ${r.emoji} (${r.bestScore})`);
    });
  }
}

main().catch((err) => {
  console.error("Erreur:", err);
});
