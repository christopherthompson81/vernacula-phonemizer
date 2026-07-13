/**
 * Japanese (Tokyo) lexical pitch accent — Phase 3, ported from espeak-ng-portable. Accent is lexical and
 * contrastive (箸 haꜜɕi "chopsticks" vs 端 haɕi "edge"); the accent NUCLEUS is marked with the IPA downstep
 * ꜜ (U+A71C) placed AFTER the nucleus mora. Heiban (accentless, nucleus 0) words carry no mark.
 *
 * The nucleus is looked up per bunsetsu: the SURFACE (kanji) first, so homographs the reading collapses are
 * disambiguated (はし→箸=1), then the READING (kana). A bunsetsu is a content word + trailing case/topic
 * particles or copula (橋を, 天気です); the accent sits on the content stem, so we strip those to recover it and
 * apply the nucleus to the full reading. Data: pitch-accent.tsv (merged consensus > inflected > base).
 * See docs/ja_native_bringup_investigation.md.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let LEX: Map<string, number> | undefined;
function lex(): Map<string, number> {
  if (LEX === undefined) {
    LEX = new Map();
    const path = join(dirname(fileURLToPath(import.meta.url)), "pitch-accent.tsv");
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (line === "" || line.startsWith("#")) continue;
      const tab = line.indexOf("\t");
      if (tab < 0) continue;
      const n = Number.parseInt(line.slice(tab + 1), 10);
      if (Number.isInteger(n) && n >= 0) LEX.set(line.slice(0, tab), n);
    }
  }
  return LEX;
}

// Raw key, then a katakana→hiragana FOLDED fallback (UniDic/OpenJTalk layers are hiragana-keyed; the NHK
// consensus layer stores katakana surfaces UNFOLDED, so the raw lookup hits those first).
function get(k: string): number | undefined {
  const m = lex();
  return m.get(k) ?? m.get(k.replace(/[ァ-ヶ]/gu, (c) => String.fromCodePoint(c.codePointAt(0)! - 0x60)));
}

const HAN_END = /\p{Script=Han}$/u;
// Trailing affixes to strip to recover a noun bunsetsu's content word (whose accent governs the phrase):
// case/topic particles (橋を→橋), and the copula + optional sentence-final particle (天気です→天気).
const STRIPS = [/[はがをにへとでものや]+$/u, /(?:だ|です|でした|だった|でしょう|だろう)(?:ね|よ|か|な|わ)?$/u];

/** Resolve the accent nucleus (mora index, 0 = heiban) for a bunsetsu: surface first, then reading. */
export function accentNucleus(surface: string, reading: string): number {
  let n = get(surface); // 1. exact surface (disambiguates homographs the reading collapses)
  if (n === undefined) {
    for (const re of STRIPS) {
      const m = surface.match(re);
      if (!m) continue;
      const ks = surface.slice(0, -m[0].length); // 2. surface content-kanji stem (橋 / 天気), noun bunsetsu only
      if (ks === "" || !HAN_END.test(ks)) continue;
      n = get(ks);
      if (n === undefined && reading.endsWith(m[0])) {
        const rs = reading.slice(0, -m[0].length); // 3. reading content stem, same suffix (はしを→はし)
        if (rs !== "") n = get(rs);
      }
      if (n !== undefined) break;
    }
  }
  if (n === undefined) n = get(reading); // 4. exact reading (はし)
  return n ?? 0;
}

/** Place ꜜ after the nucleus-th mora of a pre-segmented mora list (1-based; ≤0 = heiban, no mark). */
export function placeDownstep(morae: readonly string[], nucleus: number): string {
  if (nucleus <= 0 || morae.length === 0) return morae.join("");
  const n = Math.min(nucleus, morae.length);
  return morae.slice(0, n).join("") + "ꜜ" + morae.slice(n).join("");
}
