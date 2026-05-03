import { execSync } from "child_process";

async function main() {
  const args = process.argv.slice(2);
  const argsString = args.length > 0 ? ` -- ${args.join(" ")}` : "";

  console.log(`🚀 Démarrage du processus complet`);
  console.log(`📂 Répertoire courant : ${process.cwd()}`);
  console.log(`🔢 Arguments reçus : ${args.length > 0 ? args.join(", ") : "aucun"}`);

  const steps = [
    { name: "Génération de la voix", command: `npm run start${argsString}` },
    { name: "Sélection des clips", command: `npm run select-clips${argsString}` },
    { name: "Concaténation des clips", command: `npm run concat-clips${argsString}` },
    { name: "Application des effets TikTok", command: `npm run ffmpeg-tiktok-effects${argsString}` },
    { name: "Téléchargement de l'OST", command: `npm run download-random-ost${argsString}` },
    { name: "Génération des sous-titres", command: `npm run generate-subs${argsString}` },
    { name: "Nettoyage des sous-titres", command: `npm run clean-subs${argsString}` },
    { name: "Génération des filtres drawtext", command: `npm run generate-drawtext${argsString}` },
    { name: "Incrustation des sous-titres", command: `npm run add-subtitles${argsString}` },
    { name: "Mixage audio final", command: `npm run mix-audio${argsString}` },
    { name: "Analyse des emojis contextuels", command: `npm run contextual-emoji${argsString}` },
    { name: "Téléchargement des emojis animés", command: `npm run download-animated-emojis${argsString}` },
    { name: "Application finale des emojis", command: `npm run apply-emoji-ffmpeg${argsString}` },
    { name: "Uploade vers Cloudinary", command: `npm run upload-to-cloudinary${argsString}` },
    { name: "Post sur TikTok", command: `npm run put-to-tiktok${argsString}` },
  ];

  for (const step of steps) {
    console.log(`\n--- 📦 Étape : ${step.name} ---`);
    console.log(`Exécution : ${step.command}`);
    try {
      execSync(step.command, { stdio: "inherit" });
    } catch (error) {
      console.error(`\n❌ L'étape "${step.name}" a échoué.`);
      process.exit(1);
    }
  }

  console.log("\n✅ Processus complet terminé avec succès !");
}

main().catch((err) => {
  console.error("💥 Erreur critique :", err);
  process.exit(1);
});
