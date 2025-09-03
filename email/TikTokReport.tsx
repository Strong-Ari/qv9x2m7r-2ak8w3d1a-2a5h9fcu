import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Tailwind,
} from "@react-email/components";

export default function TikTokReport({
  status,
  statusEmoji,
  workflow,
  repo,
  actor,
  sha,
  runUrl,
}: {
  status?: string;
  statusEmoji?: string;
  workflow?: string;
  repo?: string;
  actor?: string;
  sha?: string;
  runUrl?: string;
}) {
  return (
    <Html>
      <Head>
        {/* Forcer thème clair sur certains clients */}
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Tailwind>
        <Body
          style={{
            backgroundColor: "#0f0f0f !important",
            fontFamily: "'Montserrat', sans-serif",
            color: "white",
            minHeight: "100vh",
            padding: "1rem",
            WebkitFontSmoothing: "antialiased",
          }}
          className="bg-[#0f0f0f]"
        >
          <Container
            style={{ backgroundColor: "#0f0f0f !important" }}
            className="max-w-lg mx-auto p-8 rounded-3xl bg-gradient-to-br from-[#fe2c55] via-[#bd02ff] to-[#30d8f6] shadow-lg border border-transparent"
          >
            {/* Header with TikTok logo next to text */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src="https://cdn.builder.io/api/v1/image/assets%2F6919925ab0e94b19aeb2c6b719a48223%2F15e77b658b044c28a1549fae365efbb1"
                alt="TikTok Logo"
                width={36}
                height={36}
                style={{ borderRadius: 6, marginRight: 12 }}
              />
              <Heading
                className="text-4xl font-extrabold tracking-tight drop-shadow-lg"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                TikTok Bot {statusEmoji}
              </Heading>
            </div>

            <Text className="mt-2 text-center text-xl font-semibold tracking-wide drop-shadow-md">
              {status ?? "No status"}
            </Text>

            {/* Info Box */}
            <div className="mt-8 bg-[#121212] rounded-2xl p-6 shadow-inner shadow-pink-600/40 ring-1 ring-pink-500/30">
              <InfoLine label="🚀 Workflow:" value={workflow ?? "-"} />
              <InfoLine label="📦 Repository:" value={repo ?? "-"} />
              <InfoLine label="👤 Actor:" value={actor ?? "-"} />
              <InfoLine label="🔍 Commit:" value={sha ?? "-"} isCode />
            </div>

            {/* Button */}
            <div className="mt-10 text-center">
              <Button
                href={runUrl}
                className="bg-gradient-to-r from-[#fe2c55] via-[#bd02ff] to-[#30d8f6] text-white font-bold py-3 px-10 rounded-full shadow-lg select-none"
                target="_blank"
                rel="noopener noreferrer"
              >
                🔗 View Details
              </Button>
            </div>

            {/* Footer */}
            <Text className="mt-10 text-center text-sm text-pink-400 opacity-80 select-none font-medium">
              🎬 Powered by TikTok Bot • {new Date().toLocaleString()}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

function InfoLine({
  label,
  value,
  isCode = false,
}: {
  label: string;
  value?: string;
  isCode?: boolean;
}) {
  return (
    <p className="flex justify-between text-white/90 font-medium text-base select-text">
      <span>{label}</span>
      {isCode ? (
        <code className="bg-[#1a1a1a] px-2 py-0.5 rounded font-mono tracking-wide text-pink-400 select-all">
          {value}
        </code>
      ) : (
        <span>{value}</span>
      )}
    </p>
  );
}
