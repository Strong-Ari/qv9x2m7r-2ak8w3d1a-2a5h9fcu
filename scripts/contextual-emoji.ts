// contextual-emoji.ts - Approche basée sur des règles intelligentes
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Types
interface SubtitleLine {
  text: string;
  start: number;
}

interface SubtitleWithEmoji extends SubtitleLine {
  emoji?: string;
  reasoning?: string;
  confidence?: number;
}

async function main() {
  const inputPath = "public/subtitles-with-timecodes.json";
  const resolvedPath = path.resolve(inputPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Fichier non trouvé : ${resolvedPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(resolvedPath, "utf-8");
  const subtitles: SubtitleLine[] = JSON.parse(rawData);

  console.log(`🎯 Analyse contextuelle de ${subtitles.length} sous-titres...`);

  // Liste des emojis disponibles
  const availableEmojis = ["Smile","Smile-with-big-eyes","Grin","Grinning","Laughing","Grin-sweat","Joy","Rofl","Loudly-crying","Wink","Kissing","Kissing-smiling-eyes","Kissing-closed-eyes","Kissing-heart","Heart-face","Heart-eyes","Star-struck","Partying-face","Melting","Upside-down-face","Slightly-happy","Happy-cry","Holding-back-tears","Blush","Warm-smile","Relieved","Head-nod","Head-shake","Smirk","Drool","Yum","Stuck-out-tongue","Squinting-tongue","Winky-tongue","Zany-face","Woozy","Pensive","Pleading","Grimacing","Expressionless","Neutral-face","Mouth-none","Face-in-clouds","Dotted-line-face","Zipper-face","Salute","Thinking-face","Shushing-face","Hand-over-mouth","Smiling-eyes-with-hand-over-mouth","Yawn","Hug-face","Peeking","Screaming","Raised-eyebrow","Monocle","Unamused","Rolling-eyes","Exhale","Triumph","Angry","Rage","Cursing","Sad","Sweat","Worried","Concerned","Cry","Big-frown","Frown","Diagonal-mouth","Slightly-frowning","Anxious-with-sweat","Scared","Anguished","Gasp","Mouth-open","Surprised","Astonished","Flushed","Mind-blown","Scrunched-mouth","Scrunched-eyes","Weary","Distraught","X-eyes","Dizzy-face","Shaking-face","Cold-face","Hot-face","Sick","Vomit","Tired","Sleep","Sleepy","Sneeze","Thermometer-face","Bandage-face","Mask","Liar","Halo","Cowboy","Money-face","Nerd-face","Sunglasses-face","Disguise","Clown","Poop","Imp-smile","Imp-frown","Ghost","Skull","Snowman-with-snow","Snowman","Jack-o-lantern","Robot","Alien","Alien-monster","Sun-with-face","Moon-face-first-quarter","Moon-face-last-quarter","Smiley-cat","Smile-cat","Joy-cat","Heart-eyes-cat","Smirk-cat","Kissing-cat","Scream-cat","Crying-cat-face","Pouting-cat","See-no-evil-monkey","Hear-no-evil-monkey","Speak-no-evil-monkey","Glowing-star","Sparkles","Electricity","Collision","Fire","100","Party-popper","Confetti-ball","Red-heart","Orange-heart","Yellow-heart","Green-heart","Light-blue-heart","Blue-heart","Purple-heart","Brown-heart","Black-heart","Grey-heart","White-heart","Pink-heart","Cupid","Gift-heart","Sparkling-heart","Heart-grow","Beating-heart","Revolving-hearts","Two-hearts","Love-letter","Heart-box","Heart-exclamation-point","Bandaged-heart","Broken-heart","Fire-heart","Kiss","Footprints","Fingerprint","Anatomical-heart","Blood","Microbe","Eyes","Eye","Biting-lip","Nose","Ear","Hearing-aid","Foot","Leg","Leg-mechanical","Arm-mechanical","Muscle","Clap","Thumbs-up","Thumbs-down","Heart-hands","Raising-hands","Open-hands","Palms-up","Fist-rightwards","Fist-leftwards","Raised-fist","Fist","Palm-down","Palm-up","Rightwards-hand","Leftwards-hand","Push-rightwards","Push-leftwards","Wave","Back-hand","Palm","Raised-hand","Vulcan","Love-you-gesture","Metal","Victory","Crossed-fingers","Hand-with-index-finger-and-thumb-crossed","Call-me-hand","Pinched-fingers","Pinch","Ok","Pointing","Point-right","Point-left","Index-finger","Point-up","Point-down","Middle-finger","Writing-hand","Selfie","Folded-hands","Nail-care","Handshake","Dancer-woman","Bouquet","Rose","Wilted-flower","Fallen-leaf","Plant","Leaves","Luck","Leafless-tree","Snowflake","Volcano","Sunrise","Sunrise-over-mountains","Rainbow","Bubbles","Ocean","Wind-face","Tornado","Droplet","Rain-cloud","Cloud-with-lightning","Globe-showing-europe-africa","Globe-showing-americas","Globe-showing-asia-australia","Comet","Cow-face","Unicorn","Lizard","Dragon","T-rex","Dinosaur","Turtle","Crocodile","Snake","Frog","Rabbit","Rat","Poodle","Dog","Guide-dog","Service-dog","Pig","Racehorse","Donkey","Ox","Goat","Kangaroo","Tiger","Monkey","Gorilla","Orangutan","Chipmunk","Otter","Bat","Bird","Black-bird","Rooster","Hatching-chick","Baby-chick","Hatched-chick","Eagle","Owl","Peace","Goose","Peacock","Phoenix","Seal","Shark","Dolphin","Whale","Fish","Blowfish","Lobster","Crab","Octopus","Jellyfish","Scorpion","Spider","Snail","Ant","Mosquito","Cockroach","Fly","Bee","Lady-bug","Butterfly","Bug","Worm","Paw Prints","Tomato","Root-vegetable","Cooking","Burrito","Spaghetti","Steaming-bowl","Popcorn","Hot-beverage","Clinking-beer-mugs","Clinking-glasses","Bottle-with-popping-cork","Wine-glass","Pour","Tropical-drink","Construction","Police-car-light","Bicycle","Automobile","Racing-car","Taxi","Bus","Sailboat","Canoe","Flying-saucer","Rocket","Airplane-departure","Airplane-arrival","Roller-coaster","Ferris-wheel","Camping","Balloon","Birthday-cake","Wrapped-gift","Fireworks","Piñata","Mirror-ball","Gold-medal","Silver-medal","Bronze-medal","Trophy","Soccer-ball","Baseball","Softball","Tennis","Badminton","Lacrosse","Cricket-game","Field-hockey","Ice-hockey","Ice-skate","Roller-skates","Ballet-shoes","Skateboard","Flag-in-hole","Direct-hit","Flying-disc","Boomerang","Kite","Fishing-pole","Martial-arts-uniform","8-ball","Ping-pong","Bowling","Die","Slot-machine","Wand","Camera-flash","Splatter","Saxophone","Trumpet","Violin","Harp","Drum","Maracas","Clapper","Battery-full","Battery-low","Coin","Money-with-wings","Gem-stone","Balance-scale","Light-bulb","Graduation-cap","Ring","Fan","Umbrella","Shovel","Gear","Broken-chain","Pencil","Alarm-clock","Bellhop-bell","Bell","Crystal-ball","Bomb","Mouse-trap","Locked","Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces","Ophiuchus","Exclamation","Question","Exclamation-question-mark","Exclamation-double","Cross-mark","Sos","Phone-off","Radioactive","Biohazard","Warning","Check-mark","New","Free","Up!","Cool","Litter","Peace-symbol","Yin-yang","Infinity","Musical-notes","Plus-sign","Chequered-flag","Triangular-flag","Black-flag","White-flag"];

  // Système de règles intelligent utilisant ta liste d'emojis
  const emojiRules = [
    // Questions
    { pattern: /\?/, emoji: "Question", reason: "Question détectée", confidence: 0.9 },

    // Émotions positives
    { pattern: /\b(sourire|rire|joie|heureux|content|bien)\b/i, emoji: "Joy", reason: "Émotion positive", confidence: 0.8 },
    { pattern: /\b(sourire|souriant)\b/i, emoji: "Smile", reason: "Sourire", confidence: 0.8 },
    { pattern: /\b(rire|rigoler|marrant)\b/i, emoji: "Laughing", reason: "Rire", confidence: 0.8 },
    { pattern: /\b(amour|aimer|coeur|amitié)\b/i, emoji: "Red-heart", reason: "Amour/Amitié", confidence: 0.8 },
    { pattern: /\b(confiance|faire confiance|croire)\b/i, emoji: "Handshake", reason: "Confiance", confidence: 0.8 },
    { pattern: /\b(espoir|espérer|optimisme)\b/i, emoji: "Sparkles", reason: "Espoir", confidence: 0.7 },
    { pattern: /\b(soulagement|soulagé|ouf)\b/i, emoji: "Relieved", reason: "Soulagement", confidence: 0.8 },
    { pattern: /\b(chaleureux|accueillant|bienveillant)\b/i, emoji: "Warm-smile", reason: "Chaleur", confidence: 0.7 },

    // Émotions négatives
    { pattern: /\b(triste|tristesse|pleurer|larme)\b/i, emoji: "Sad", reason: "Tristesse", confidence: 0.8 },
    { pattern: /\b(pleurer|pleurs|larmes)\b/i, emoji: "Cry", reason: "Pleurs", confidence: 0.8 },
    { pattern: /\b(colère|rage|furieux|énervé)\b/i, emoji: "Angry", reason: "Colère", confidence: 0.8 },
    { pattern: /\b(rage|fureur|enragé)\b/i, emoji: "Rage", reason: "Rage intense", confidence: 0.9 },
    { pattern: /\b(peur|effrayé|anxieux|inquiet)\b/i, emoji: "Scared", reason: "Peur", confidence: 0.8 },
    { pattern: /\b(anxieux|angoissé|stressé)\b/i, emoji: "Anxious-with-sweat", reason: "Anxiété", confidence: 0.8 },
    { pattern: /\b(déçu|déception|frustré)\b/i, emoji: "Big-frown", reason: "Déception", confidence: 0.7 },
    { pattern: /\b(trahison|trahir|mensonge|mentir)\b/i, emoji: "Broken-heart", reason: "Trahison", confidence: 0.8 },
    { pattern: /\b(fragile|détruit|cassé|brisé)\b/i, emoji: "Broken-heart", reason: "Fragilité", confidence: 0.7 },
    { pattern: /\b(inquiet|soucieux|préoccupé)\b/i, emoji: "Worried", reason: "Inquiétude", confidence: 0.8 },
    { pattern: /\b(fatigué|épuisé|las)\b/i, emoji: "Weary", reason: "Fatigue", confidence: 0.7 },

    // Réflexion et pensée
    { pattern: /\b(penser|réfléchir|question|se demander)\b/i, emoji: "Thinking-face", reason: "Réflexion", confidence: 0.8 },
    { pattern: /\b(penseur|philosophie|sagesse)\b/i, emoji: "Thinking-face", reason: "Sagesse", confidence: 0.8 },
    { pattern: /\b(doute|incertain|peut-être|vraiment)\b/i, emoji: "Raised-eyebrow", reason: "Doute", confidence: 0.7 },
    { pattern: /\b(comprendre|réaliser|saisir)\b/i, emoji: "Light-bulb", reason: "Compréhension", confidence: 0.8 },
    { pattern: /\b(contempler|méditer|réfléchir)\b/i, emoji: "Pensive", reason: "Contemplation", confidence: 0.7 },
    { pattern: /\b(surpris|étonné|choqué)\b/i, emoji: "Surprised", reason: "Surprise", confidence: 0.8 },
    { pattern: /\b(stupéfait|abasourdi|sidéré)\b/i, emoji: "Mind-blown", reason: "Stupéfaction", confidence: 0.8 },

    // Actions et communication
    { pattern: /\b(dire|parler|mot|citation)\b/i, emoji: "Shushing-face", reason: "Communication", confidence: 0.6 },
    { pattern: /\b(regarder|voir|observer|yeux)\b/i, emoji: "Eyes", reason: "Observation", confidence: 0.7 },
    { pattern: /\b(permettre|demander|poser)\b/i, emoji: "Folded-hands", reason: "Demande polie", confidence: 0.6 },
    { pattern: /\b(saluer|bonjour|hello)\b/i, emoji: "Wave", reason: "Salutation", confidence: 0.7 },
    { pattern: /\b(applaudir|bravo|féliciter)\b/i, emoji: "Clap", reason: "Applaudissement", confidence: 0.8 },
    { pattern: /\b(approuver|d'accord|oui)\b/i, emoji: "Thumbs-up", reason: "Approbation", confidence: 0.7 },
    { pattern: /\b(désapprouver|non|refuser)\b/i, emoji: "Thumbs-down", reason: "Désapprobation", confidence: 0.7 },

    // Concepts abstraits et métaphores
    { pattern: /\b(société|monde|moderne)\b/i, emoji: "Globe-showing-europe-africa", reason: "Société", confidence: 0.7 },
    { pattern: /\b(temps|moment|instant)\b/i, emoji: "Alarm-clock", reason: "Temps", confidence: 0.6 },
    { pattern: /\b(liberté|libre|libérer)\b/i, emoji: "Peace", reason: "Liberté", confidence: 0.8 },
    { pattern: /\b(illusion|rêve|imaginaire)\b/i, emoji: "Face-in-clouds", reason: "Illusion", confidence: 0.7 },
    { pattern: /\b(vérité|réalité|vraiment)\b/i, emoji: "Monocle", reason: "Vérité", confidence: 0.7 },
    { pattern: /\b(promesse|promettre|engagement)\b/i, emoji: "Crossed-fingers", reason: "Promesse", confidence: 0.7 },
    { pattern: /\b(naïf|innocent|croyant)\b/i, emoji: "Halo", reason: "Naïveté", confidence: 0.7 },
    { pattern: /\b(calculer|stratégie|intérêt)\b/i, emoji: "Nerd-face", reason: "Calcul", confidence: 0.7 },
    { pattern: /\b(ombre|sombre|caché)\b/i, emoji: "Ghost", reason: "Obscurité", confidence: 0.6 },
    { pattern: /\b(pont|lien|lier)\b/i, emoji: "Handshake", reason: "Connexion", confidence: 0.6 },
    { pattern: /\b(hommes|gens|personnes)\b/i, emoji: "Raising-hands", reason: "Personnes", confidence: 0.5 },
    { pattern: /\b(feu|passion|ardeur)\b/i, emoji: "Fire", reason: "Passion", confidence: 0.7 },
    { pattern: /\b(étoile|briller|éclat)\b/i, emoji: "Glowing-star", reason: "Éclat", confidence: 0.7 },
    { pattern: /\b(masque|cacher|dissimuler)\b/i, emoji: "Mask", reason: "Dissimulation", confidence: 0.7 },

    // Ponctuation et exclamations
    { pattern: /!/, emoji: "Exclamation", reason: "Exclamation", confidence: 0.6 },
    { pattern: /\b(mais|cependant|pourtant)\b/i, emoji: "Raised-eyebrow", reason: "Contraste", confidence: 0.5 },
    { pattern: /\b(attention|danger|prudence)\b/i, emoji: "Warning", reason: "Avertissement", confidence: 0.8 },
  ];

  const results: SubtitleWithEmoji[] = [];
  const debugResults: any[] = [];

  for (let i = 0; i < subtitles.length; i++) {
    const line = subtitles[i];

    if (!line.text || line.text.trim() === '') {
      results.push({ ...line });
      continue;
    }

    console.log(`\n🔍 [${i+1}/${subtitles.length}] "${line.text}"`);

    // Chercher la meilleure correspondance
    let bestMatch: { emoji: string; reason: string; confidence: number } | null = null;

    for (const rule of emojiRules) {
      if (rule.pattern.test(line.text)) {
        if (!bestMatch || rule.confidence > bestMatch.confidence) {
          bestMatch = {
            emoji: rule.emoji,
            reason: rule.reason,
            confidence: rule.confidence
          };
        }
      }
    }

    const resultEntry: SubtitleWithEmoji = {
      ...line,
      reasoning: bestMatch?.reason || "Aucun pattern trouvé",
      confidence: bestMatch?.confidence || 0
    };

    if (bestMatch && bestMatch.confidence >= 0.5) {
      resultEntry.emoji = bestMatch.emoji;
      console.log(`✅ ${bestMatch.emoji} (${bestMatch.reason}, ${bestMatch.confidence})`);
    } else {
      console.log(`❌ Aucun emoji (confiance trop faible)`);
    }

    results.push(resultEntry);

    debugResults.push({
      index: i + 1,
      text: line.text,
      emoji: resultEntry.emoji || null,
      reasoning: resultEntry.reasoning,
      confidence: resultEntry.confidence
    });
  }

  // Sauvegarder les résultats
  const outputPath = path.join("public", "output-with-emojis.json");
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n✅ Fichier généré : ${outputPath}`);

  // Sauvegarder les données de debug
  const debugPath = path.join("public", "emoji-analysis-debug.json");
  const debugData = {
    metadata: {
      totalSubtitles: subtitles.length,
      emojisAssigned: results.filter(r => r.emoji).length,
      method: "rule-based-pattern-matching",
      timestamp: new Date().toISOString()
    },
    results: debugResults
  };

  fs.writeFileSync(debugPath, JSON.stringify(debugData, null, 2), "utf-8");
  console.log(`🐛 Debug sauvegardé : ${debugPath}`);

  // Statistiques finales
  const emojisCount = results.filter(r => r.emoji).length;
  console.log(`\n📊 Résultats :`);
  console.log(`- Sous-titres analysés : ${subtitles.length}`);
  console.log(`- Emojis assignés : ${emojisCount} (${((emojisCount/subtitles.length)*100).toFixed(1)}%)`);

  if (emojisCount > 0) {
    console.log(`\n🎯 Exemples d'emojis assignés :`);
    results.filter(r => r.emoji).slice(0, 5).forEach((r, i) => {
      console.log(`  ${i+1}. "${r.text}" → ${r.emoji} (${r.reasoning})`);
    });
  }

  // Statistiques par type d'emoji
  const emojiStats: { [key: string]: number } = {};
  results.filter(r => r.emoji).forEach(r => {
    emojiStats[r.emoji!] = (emojiStats[r.emoji!] || 0) + 1;
  });

  if (Object.keys(emojiStats).length > 0) {
    console.log(`\n📈 Emojis les plus utilisés :`);
    Object.entries(emojiStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([emoji, count]) => {
        console.log(`  ${emoji} : ${count} fois`);
      });
  }
}

main().catch((err) => {
  console.error("Erreur:", err);
});
