import { pickRandom, logWithTimestamp } from "../utils";

// ─── Pools de données ──────────────────────────────────────────────────────────

const ACTIONS = [
  "Citation Ayanokoji",
  "Style Ayanokoji",
  "Vibes Ayanokoji",
  "Inspiré par Ayanokoji",
  "Extrait du maître Ayanokoji",
  "Extrait du GOAT Ayanokoji",
  "Extrait du Goat Ayanokoji",
  "Pensée d'Ayanokoji",
  "Réflexion Ayanokoji",
  "Philosophie Ayanokoji",
  "Sagesse d'Ayanokoji",
  "Génie caché",
  "Leçon psychologique",
  "Puissance silencieuse",
  "Mentalité Ayanokoji",
];

const ENDINGS = [
  "– Classroom of the Elite ⚡",
  "– CoTE vibes 🎯",
  "– Anime inspirant 💡",
  "– Moment intense 🔥",
  "– Extrait animé 🌀",
  "– Génie caché 🕶️",
  "– Puissance silencieuse 🌌",
  "– L'ombre d'Ayanokoji 🖤",
  "– Esprit stratégique ♟️",
  "– Vibes psychologiques 🧠",
  "– Citation marquante ✨",
  "– Scène culte 🎬",
  "– Mystère total 🌑",
  "– Force tranquille 🐺",
  "– Univers anime 🌍",
];

const HASHTAGS_POOL = [
  "#ClassroomOfTheElite",
  "#AnimeCourts",
  "#Ayanokoji",
  "#ClipsAnime",
  "#Otaku",
  "#VibesAnime",
  "#CoTE",
  "#AnimeVibes",
  "#momentgoat",
  "#AnimeClassroom",
  "#EditionAnime",
  "#VieAnime",
  "#MondeAnime",
  "#FansAnime",
];

// ─── Génération ────────────────────────────────────────────────────────────────

export function generateDescription(): string {
  const baseDescription = `${pickRandom(ACTIONS)} ${pickRandom(ENDINGS)}`;

  let hashtagCount = 3;
  if (baseDescription.length > 60) hashtagCount = 2;
  else if (baseDescription.length < 40) hashtagCount = 4;

  const selectedHashtags: string[] = [];
  while (selectedHashtags.length < hashtagCount) {
    const tag = pickRandom(HASHTAGS_POOL);
    if (!selectedHashtags.includes(tag)) selectedHashtags.push(tag);
  }

  return `${baseDescription} ${selectedHashtags.join(" ")}`;
}

// Généré une seule fois par exécution
const _generatedDescription = generateDescription();
console.log(_generatedDescription);

export function getRandomDescription(): string {
  logWithTimestamp(`🎲 Description générée: "${_generatedDescription}"`);
  return _generatedDescription;
}
