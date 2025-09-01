import { Whisper } from "nodejs-whisper";
import fs from "fs";

const whisper = new Whisper({ model: "medium" });
const result = await whisper.transcribeFile("ayanokoji-voice.mp3");

// SRT → ASS conversion simple
function srtToAss(srt: string) {
  const assHeader = `[Script Info]
ScriptType: v4.00+
Collisions: Normal
PlayResX: 1080
PlayResY: 1920
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,64,&H00FFFFFF,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,2,50,0,1
[Events]
Format: Layer, Start, End, Style, Text
`;

  const lines = srt.split("\n\n");
  const events = lines.map((block) => {
    const parts = block.split("\n");
    if (parts.length >= 3) {
      const time = parts[1].replace(",", ".").replace(" --> ", ",");
      const start = time.split(",")[0];
      const end = time.split(",")[1];
      const text = parts.slice(2).join("\\N"); // saut de ligne pour ASS
      return `Dialogue: 0,${start},${end},Default,${text}`;
    }
    return "";
  });

  return assHeader + events.join("\n");
}

const assContent = srtToAss(result.srt);
fs.writeFileSync("ayanokoji-voice.ass", assContent);
