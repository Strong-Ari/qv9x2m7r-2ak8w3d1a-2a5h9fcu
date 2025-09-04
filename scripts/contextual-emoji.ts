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

  // Système de règles intelligent pour les emojis
  const emojiRules = [
    // Questions
    { pattern: /\?/, emoji: "❓", reason: "Question", confidence: 0.9 },

    // Émotions positives
    { pattern: /\b(sourire|rire|joie|heureux|content|bien)\b/i, emoji: "😊", reason: "Émotion positive", confidence: 0.8 },
    { pattern: /\b(amour|aimer|coeur|amitié)\b/i, emoji: "❤️", reason: "Amour/Amitié", confidence: 0.8 },
    { pattern: /\b(confiance|faire confiance|croire)\b/i, emoji: "🤝", reason: "Confiance", confidence: 0.8 },
    { pattern: /\b(espoir|espérer|optimisme)\b/i, emoji: "✨", reason: "Espoir", confidence: 0.7 },

    // Émotions négatives
    { pattern: /\b(triste|tristesse|pleurer|larme)\b/i, emoji: "😢", reason: "Tristesse", confidence: 0.8 },
    { pattern: /\b(colère|rage|furieux|énervé)\b/i, emoji: "😠", reason: "Colère", confidence: 0.8 },
    { pattern: /\b(peur|effrayé|anxieux|inquiet)\b/i, emoji: "😰", reason: "Peur/Anxiété", confidence: 0.8 },
    { pattern: /\b(déçu|déception|frustré)\b/i, emoji: "😞", reason: "Déception", confidence: 0.7 },
    { pattern: /\b(trahison|trahir|mensonge|mentir)\b/i, emoji: "💔", reason: "Trahison", confidence: 0.8 },
    { pattern: /\b(fragile|détruit|cassé|brisé)\b/i, emoji: "💔", reason: "Fragilité", confidence: 0.7 },

    // Réflexion et pensée
    { pattern: /\b(penser|réfléchir|question|se demander)\b/i, emoji: "🤔", reason: "Réflexion", confidence: 0.8 },
    { pattern: /\b(doute|incertain|peut-être|vraiment)\b/i, emoji: "🤷", reason: "Doute", confidence: 0.7 },
    { pattern: /\b(comprendre|réaliser|saisir)\b/i, emoji: "💡", reason: "Compréhension", confidence: 0.8 },
    { pattern: /\b(penseur|philosophie|sagesse)\b/i, emoji: "🧠", reason: "Sagesse", confidence: 0.8 },

    // Actions et communication
    { pattern: /\b(dire|parler|mot|citation)\b/i, emoji: "💬", reason: "Communication", confidence: 0.7 },
    { pattern: /\b(regarder|voir|observer|yeux)\b/i, emoji: "👀", reason: "Observation", confidence: 0.7 },
    { pattern: /\b(permettre|demander|poser)\b/i, emoji: "🙏", reason: "Demande polie", confidence: 0.6 },

    // Concepts abstraits
    { pattern: /\b(société|monde|moderne)\b/i, emoji: "🌍", reason: "Société", confidence: 0.7 },
    { pattern: /\b(temps|moment|instant)\b/i, emoji: "⏰", reason: "Temps", confidence: 0.6 },
    { pattern: /\b(liberté|libre|libérer)\b/i, emoji: "🕊️", reason: "Liberté", confidence: 0.8 },
    { pattern: /\b(illusion|rêve|imaginaire)\b/i, emoji: "🌙", reason: "Illusion", confidence: 0.7 },
    { pattern: /\b(vérité|réalité|vraiment)\b/i, emoji: "🔍", reason: "Vérité", confidence: 0.7 },
    { pattern: /\b(promesse|promettre|engagement)\b/i, emoji: "🤞", reason: "Promesse", confidence: 0.7 },
    { pattern: /\b(naïf|innocent|croyant)\b/i, emoji: "😇", reason: "Naïveté", confidence: 0.7 },
    { pattern: /\b(calculer|stratégie|intérêt)\b/i, emoji: "🎯", reason: "Calcul", confidence: 0.7 },
    { pattern: /\b(ombre|sombre|caché)\b/i, emoji: "🌑", reason: "Obscurité", confidence: 0.6 },
    { pattern: /\b(pont|lien|lier)\b/i, emoji: "🌉", reason: "Connexion", confidence: 0.6 },
    { pattern: /\b(hommes|gens|personnes)\b/i, emoji: "👥", reason: "Personnes", confidence: 0.5 },

    // Ponctuation et exclamations
    { pattern: /!/, emoji: "❗", reason: "Exclamation", confidence: 0.6 },
    { pattern: /\b(mais|cependant|pourtant)\b/i, emoji: "🔄", reason: "Contraste", confidence: 0.5 },
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
