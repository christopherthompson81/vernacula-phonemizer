// Build Mandarin Hanzi→pinyin data from pypinyin (MIT). Emits base+tone tokens (e.g. "zhong1") matching
// syllable-ipa.tsv keys, so the runtime needs no diacritic parser. Source JSONs from the pypinyin wheel:
//   pip download pypinyin -d /tmp/pp --no-deps && unzip -o /tmp/pp/pypinyin-*.whl -d /tmp/pp/x
// Usage: node tools/build-cmn-pinyin.mjs <pinyin_dict.json> <phrases_dict.json>
import { readFileSync, writeFileSync } from "node:fs";

const TONE = { "̄": 1, "́": 2, "̌": 3, "̀": 4 }; // macron acute caron grave
/** toned pinyin syllable (diacritics) → "base+tone" (tone 5 if unmarked). ü preserved. */
function toBaseTone(syl) {
  const d = syl.normalize("NFD");
  let tone = 5, base = "";
  for (const ch of d) {
    if (TONE[ch]) { tone = TONE[ch]; continue; }        // drop the tone mark
    base += ch;
  }
  return base.normalize("NFC") + tone;
}

const [,, charPath, phrasePath] = process.argv;
const chars = JSON.parse(readFileSync(charPath, "utf8"));
const phrases = JSON.parse(readFileSync(phrasePath, "utf8"));

const charRows = [];
for (const [cp, readings] of Object.entries(chars)) {
  const ch = String.fromCodePoint(Number(cp));
  const toks = readings.split(",").map((r) => toBaseTone(r.trim())).filter(Boolean);
  if (toks.length) charRows.push(`${ch}\t${toks.join(",")}`);
}
const phraseRows = [];
for (const [phrase, perChar] of Object.entries(phrases)) {
  // perChar = [[reading], [reading], ...]; take the first candidate per character.
  const toks = perChar.map((cands) => toBaseTone((cands[0] ?? "").trim()));
  if (toks.every(Boolean)) phraseRows.push(`${phrase}\t${toks.join(" ")}`);
}
charRows.sort(); phraseRows.sort((a, b) => a.split("\t")[0].length - b.split("\t")[0].length || (a < b ? -1 : 1));
const dir = "src/languages/mandarin";
writeFileSync(`${dir}/chars.tsv`, "# Hanzi → base+tone pinyin (most-common first). From pypinyin (MIT) char dict.\n" + charRows.join("\n") + "\n");
writeFileSync(`${dir}/phrases.tsv`, "# Multi-char phrase → space-separated base+tone pinyin (polyphone disambiguation). From pypinyin (MIT) phrase dict.\n" + phraseRows.join("\n") + "\n");
console.log(`chars=${charRows.length} phrases=${phraseRows.length}`);
console.log("char samples:", charRows.filter(r => /^[中国你好行长绿女]\t/.test(r)));
console.log("phrase samples:", phraseRows.filter(r => /^(中国|银行|你好|一不小心)\t/.test(r)));
