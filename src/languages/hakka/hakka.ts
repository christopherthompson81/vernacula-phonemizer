/**
 * Hakka Chinese / 客家话 (hak), Meixian 梅县 (Moiyen) dialect — canonical IPA. The sixth Sinitic language (after
 * Mandarin, Cantonese, Wu, Min Nan, and Jin). Hakka is a distinct primary branch of Sinitic; Meixian is its
 * traditional prestige/representative variety. Its signature is the retention of ALL THREE Middle Chinese stop
 * codas -p̚ -t̚ -k̚ (十→səp̚⁵, 月→ŋiat̚⁵, 六→liʊk̚¹, 客→hak̚¹) — where Jin merged them to a glottal -ʔ and Mandarin
 * lost them entirely. Six citation tones: 陰平 ˦˦ (44), 陽平 ˩˩ (11), 上 ˧˩ (31), 去 ˥˧ (53), 陰入 ˩ (1, checked),
 * 陽入 ˥ (5, checked).
 *
 * Written in Han characters. The reading dict (dict.tsv) already carries the Sinological IPA per syllable
 * (segmental IPA + a superscript pitch-number tone), so the front-end is the shared Han-dict engine
 * (hanDictIpa.ts): greedy longest-match segmentation, superscript-tone → Chao contour letters (SURFACE tone after
 * a sandhi arrow ⁻), Han numerals. SINGLE authoritative source (Wiktionary/kaikki Meixian Sinological-IPA), no
 * independent referee. ⚠ SINGLE-SOURCE: nothing here is cross-checked against a second transcription.
 */
import type { Phonemizer } from "../../registry.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { createHanDictPhonemizer, type ForeignPhonemizer, type HanDictDef, phonemizeHanWord, readingToIpa } from "../../core/hanDictIpa.ts";
import { hostWordRun } from "../../core/hostWord.ts";
import { normalizeHakka } from "./normalize.ts";
import { type PfsDef, pfsTable, readPfs } from "./pfs.ts";

const DEF = loadManifest<HanDictDef & PfsDef>(import.meta.url, "hakka.jsonc");

/**
 * ⚠ THE HYPHEN IS PART OF A PHA̍K-FA-SṲ WORD, and that is why this language overrides the Latin run.
 * PFS joins the syllables of a word with hyphens (`Hak-kâ-ngìn`), so the default `LATIN_RUN` — which stops
 * at one — delivered three fragments and the reader could never see the WORD. The word is the unit that
 * carries tone sandhi, exactly as a multi-character key does on the Han side.
 */
// ⚠ `medialOnly`, NOT `extra` — the parameter exists for exactly this. `extra` puts the character in the
// run's FIRST class too, so a run could BEGIN with a hyphen and swallow the dash of `1947年 -1998年` into a
// Latin word. Medial-only keeps `Hak-kâ-ngìn` whole and leaves a leading dash where it was.
const PFS_RUN = hostWordRun(["Latin"], "", "-");

let DICT: Map<string, string> | undefined;
function dict(): Map<string, string> {
    return (DICT ??= loadTsvMap(import.meta.url, "dict.tsv"));
}

/**
 * Build the Hakka Chinese phonemizer. `foreign` handles embedded Latin runs.
 *
 * ⚠ THE NORMALIZER WRAPS the shared engine rather than being wired inside it, for the reason `jin.ts` gives:
 * `core/hanDictIpa.ts` also serves gan and hsn, which have no normalization layer, so a hook there would
 * either apply Hakka's rules to them or need a per-language branch in shared code.
 */
export function createHakka(foreign?: ForeignPhonemizer): Phonemizer {
    // ⚠ THE LATIN ARM IS PHA̍K-FA-SṲ FIRST AND `foreign` SECOND, which is the whole bring-up: 93.5% of
    // hak.wikipedia is romanized Hakka, and all of it used to route to English. `readPfs` returns undefined
    // for a run that does not parse as PFS — a foreign name, quoted English — and only then does the
    // injected reader see it. See pfs.ts for the measurement behind that split (7.5% is genuinely foreign).
    const latin = (run: string): string => {
        const segs = readPfs(DEF, pfsTable(import.meta.url), run);
        if (segs === undefined) return foreign ? foreign(run) : "";
        return segs
            .map((s) => ("reading" in s ? readingToIpa(s.reading, DEF.chao) : foreign ? foreign(s.foreign) : ""))
            .filter(Boolean)
            .join(" ");
    };
    const engine = createHanDictPhonemizer(dict, DEF, latin, PFS_RUN);
    return { text: (input: string): string => engine.text(normalizeHakka(input)) };
}

/** Bare Pha̍k-fa-sṳ word → IPA (tests / eval), or "" when the run is not PFS at all. */
export function phonemizePfs(run: string): string {
    const segs = readPfs(DEF, pfsTable(import.meta.url), run);
    if (segs === undefined) return "";
    // ⚠ The bare probe reports ONLY the Hakka part — a mixed run's foreign fragment has no reading without
    // the injected reader, and silently emitting its spelling would be playbook trap 6.
    return segs.filter((s) => "reading" in s).map((s) => readingToIpa((s as { reading: string }).reading, DEF.chao)).join(" ");
}

/** Bare word→IPA (tests / eval): a Han run → IPA. */
export function phonemizeWord(word: string): string {
    return phonemizeHanWord(dict, DEF, word);
}
