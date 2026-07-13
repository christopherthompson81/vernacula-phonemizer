/**
 * Czech (cs) phonemizer — canonical IPA, espeak-independent. Rule g2p (g2p.ts) + fixed FIRST-syllable stress
 * with secondary stress on even non-final nuclei (republika→rˈɛpublˌɪka). Syllabic r̩/l̩ count as nuclei.
 * text() tokenizes words / numbers / punctuation. See docs/cs_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";

/** One Czech word → canonical IPA with first-syllable primary stress + even-non-final secondary stress. */
export function phonemizeWord(word: string): string {
  const segs = toSegments(word);
  const nucIdx = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
  if (nucIdx.length === 0) return segs.map((s) => s.ph).join("");
  const last = nucIdx.length - 1;
  let out = "", vi = -1;
  for (let i = 0; i < segs.length; i++) {
    if (segs[i]!.nucleus) {
      vi++;
      out += vi === 0 ? "ˈ" : (vi >= 2 && vi % 2 === 0 && vi !== last ? "ˌ" : "");
    }
    out += segs[i]!.ph;
  }
  return out;
}

const CLAUSE_MARK: Record<string, string> = { ".": ".", "!": "!", "?": "?", "…": ",", ",": ",", ";": ",", ":": "," };
const TOKEN = /([A-Za-zÁáČčĎďÉéĚěÍíŇňÓóŘřŠšŤťÚúŮůÝýŽž]+)|(\d+)|([.!?…,;:])/gu;

class CzechPhonemizer implements Phonemizer {
  text(input: string): string {
    let out = "", pending: string | null = null;
    const emit = (ipa: string): void => {
      if (ipa === "") return;
      if (out === "") out = ipa;
      else if (pending !== null) { out += ` ${pending} ${ipa}`; pending = null; }
      else out += ` ${ipa}`;
    };
    for (const m of input.matchAll(TOKEN)) {
      if (m[1]) emit(phonemizeWord(m[1]));
      else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) emit(phonemizeWord(wd));
      else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk && out !== "") pending = mk; }
    }
    if (pending !== null && out !== "") out += ` ${pending}`;
    return out;
  }
}
export function createCzech(): Phonemizer { return new CzechPhonemizer(); }
