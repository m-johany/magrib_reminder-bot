import { NOTO_NASKH_ARABIC_B64 } from "./font";
import type { HadithText, Language } from "./messages";

const WIDTH = 1080;
const HEIGHT = 1080;

const COLORS = {
  bgTop: "#23483F",
  bgBottom: "#1B362F",
  gold: "#D4B36A",
  cream: "#F7F1E3",
  creamSoft: "#E8DECB",
} as const;

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Greedy word-wrap by character budget; long words are hard-broken. */
export function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (let word of words) {
    while (word.length > maxChars) {
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
    }
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function textLines(
  lines: string[],
  x: number,
  startY: number,
  lineHeight: number,
  fontSize: number,
  opts: { rtl?: boolean; fill?: string; opacity?: number } = {}
): string {
  const { rtl = false, fill = COLORS.cream, opacity } = opts;
  return lines
    .map((line, i) => {
      const attrs = [
        `x="${x}"`,
        `y="${startY + i * lineHeight}"`,
        'text-anchor="middle"',
        `fill="${fill}"`,
        `font-family="Noto Naskh Arabic"`,
        `font-size="${fontSize}"`,
        ...(rtl ? ['direction="rtl"'] : []),
        ...(opacity !== undefined ? [`opacity="${opacity}"`] : []),
      ].join(" ");
      return `<text ${attrs}>${escapeXml(line)}</text>`;
    })
    .join("\n");
}

/** Builds the 1080x1080 hadith card SVG. Arabic matn prominent, translation + source below. */
export function buildCardSvg(hadith: HadithText, lang: Language): string {
  const arLines = wrapText(hadith.textAr, 26);
  // Shrink the matn when it is long so everything fits the card.
  const matnSize = Math.min(42, Math.floor(340 / Math.max(arLines.length, 3)));
  const matnLineHeight = Math.round(matnSize * 1.7);

  const enLines = lang === "en" ? wrapText(hadith.textEn, 52) : [];
  const sourceLines = wrapText(lang === "ar" ? hadith.sourceAr : hadith.sourceEn, 60);

  const titleY = 150;
  const matnStartY = 320;
  const matnEndY = matnStartY + (arLines.length - 1) * matnLineHeight;
  const enStartY = matnEndY + 90;
  const enEndY = enStartY + (enLines.length - 1) * 40;
  const sourceY = enLines.length > 0 ? enEndY + 110 : matnEndY + 110;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${COLORS.bgTop}"/>
      <stop offset="100%" stop-color="${COLORS.bgBottom}"/>
    </linearGradient>
    <pattern id="star" width="120" height="120" patternUnits="userSpaceOnUse">
      <g fill="none" stroke="${COLORS.gold}" stroke-opacity="0.07" stroke-width="1.5">
        <rect x="36" y="36" width="48" height="48"/>
        <rect x="36" y="36" width="48" height="48" transform="rotate(45 60 60)"/>
      </g>
    </pattern>
    <style>
      @font-face {
        font-family: "Noto Naskh Arabic";
        src: url(data:font/ttf;base64,${NOTO_NASKH_ARABIC_B64}) format("truetype");
      }
    </style>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#star)"/>
  <rect x="40" y="40" width="${WIDTH - 80}" height="${HEIGHT - 80}" rx="24"
        fill="none" stroke="${COLORS.gold}" stroke-opacity="0.5" stroke-width="2"/>
  <rect x="56" y="56" width="${WIDTH - 112}" height="${HEIGHT - 112}" rx="16"
        fill="none" stroke="${COLORS.gold}" stroke-opacity="0.2" stroke-width="1"/>

  ${textLines(["سُورَةُ الْكَهْفِ"], WIDTH / 2, titleY, 0, 34, { fill: COLORS.gold })}
  ${textLines(["Surah al-Kahf"], WIDTH / 2, titleY + 48, 0, 22, { fill: COLORS.creamSoft, opacity: 0.9 })}
  <line x1="${WIDTH / 2 - 140}" y1="${titleY + 86}" x2="${WIDTH / 2 + 140}" y2="${titleY + 86}"
        stroke="${COLORS.gold}" stroke-opacity="0.6" stroke-width="1.5"/>
  <circle cx="${WIDTH / 2}" cy="${titleY + 86}" r="5" fill="${COLORS.gold}" stroke="${COLORS.bgTop}" stroke-width="2"/>

  ${textLines(arLines, WIDTH / 2, matnStartY + matnSize, matnLineHeight, matnSize, { rtl: true })}
  ${enLines.length > 0 ? textLines(enLines, WIDTH / 2, enStartY + 26, 40, 26, { fill: COLORS.creamSoft }) : ""}

  <line x1="${WIDTH / 2 - 100}" y1="${sourceY - 40}" x2="${WIDTH / 2 + 100}" y2="${sourceY - 40}"
        stroke="${COLORS.gold}" stroke-opacity="0.4" stroke-width="1"/>
  ${textLines(sourceLines, WIDTH / 2, sourceY + 4, 32, 20, { fill: COLORS.gold, opacity: 0.95 })}
</svg>`;
}
