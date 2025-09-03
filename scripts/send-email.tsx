import React from "react";
import ReactDOMServer from "react-dom/server";
import "dotenv/config";
import { Resend } from "resend";
import TikTokReport from "../email/TikTokReport";

async function main() {
  const resend = new Resend(process.env.RESEND_API_KEY!);

  // Générer le HTML en string
  const html = ReactDOMServer.renderToStaticMarkup(
    <TikTokReport
      status={process.env.STATUS || "No status"}
      statusEmoji={process.env.STATUS_EMOJI || "ℹ️"}
      workflow={process.env.GITHUB_WORKFLOW || "Unknown"}
      repo={process.env.GITHUB_REPOSITORY || "Unknown"}
      actor={process.env.GITHUB_ACTOR || "Unknown"}
      sha={process.env.GITHUB_SHA || "Unknown"}
      runUrl={`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`}
    />,
  );

  // envoyer le mail
  await resend.emails.send({
    from: "TikTok Bot <onboarding@resend.dev>",
    to: process.env.RESEND_TO!,
    subject: `${process.env.STATUS_EMOJI || "ℹ️"} TikTok Automation - ${process.env.STATUS || "No status"}`,
    html,
  });

  console.log("📧 Email envoyé !");
}

main().catch((err) => {
  console.error("❌ Erreur lors de l'envoi de l'email:", err);
  process.exit(1);
});
