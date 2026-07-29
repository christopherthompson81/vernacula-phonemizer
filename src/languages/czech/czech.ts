/**
 * Czech (cs) phonemizer — canonical IPA, espeak-independent. Rule g2p (g2p.ts) + fixed FIRST-syllable stress
 * with secondary stress on even non-final nuclei (republika→rˈɛpublˌɪka). Syllabic r̩/l̩ count as nuclei.
 * text() tokenizes words / numbers / punctuation. See docs/investigations/cs_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer, slavicCountForm } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

// LOANWORD lexicon (loanwords.tsv, kaikki/Wiktionary-derived): pronunciations the native rules mis-derive — chiefly
// di/ti/ni NON-palatalization in loans (stadion→stadɪjon, not staɟɪjon), loanword long í, foreign names. The rules
// correctly palatalize NATIVE di/ti/ni (tisíc→cɪsiːts), so only the exceptions are dictionaried. See build-cs-kaikki-dict.mts.
let LEX: Map<string, string> | undefined;
function lexicon(): Map<string, string> {
    if (LEX === undefined)
        LEX = loadTsvMap(import.meta.url, "loanwords.tsv", undefined, {
            optional: true,
        });
    return LEX;
}

/** One Czech word → canonical IPA with first-syllable primary stress + even-non-final secondary stress. */
export function phonemizeWord(word: string): string {
    const lex = lexicon().get(word) ?? lexicon().get(word.toLowerCase());
    if (lex !== undefined) return lex;
    const segs = toSegments(word);
    const nucIdx = segs
        .map((s, i) => (s.nucleus ? i : -1))
        .filter((i) => i >= 0);
    if (nucIdx.length === 0) return segs.map((s) => s.ph).join("");
    const last = nucIdx.length - 1;
    let out = "",
        vi = -1;
    for (let i = 0; i < segs.length; i++) {
        if (segs[i]!.nucleus) {
            vi++;
            out +=
                vi === 0
                    ? "ˈ"
                    : vi >= 2 && vi % 2 === 0 && vi !== last
                      ? "ˌ"
                      : "";
        }
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([A-Za-zÁáČčĎďÉéĚěÍíŇňÓóŘřŠšŤťÚúŮůÝýŽž]+)|(\d+)|([.!?…,;:])/gu;

// #562 symbol normalization — Czech, with the Slavic three-way agreement (1 procento / 2 procenta / 5 procent).
const SYMBOLS = makeSymbolNormalizer({
    percent: ["procento", "procenta", "procent"],
    currency: { "€": ["euro", "eura", "eur"], "$": ["dolar", "dolary", "dolarů"], "£": ["libra", "libry", "liber"] },
    units: { km: ["kilometr", "kilometry", "kilometrů"], cm: ["centimetr", "centimetry", "centimetrů"],
        mm: ["milimetr", "milimetry", "milimetrů"], kg: ["kilogram", "kilogramy", "kilogramů"] },
    countForm: slavicCountForm,
});

class CzechPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(SYMBOLS(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" "))
                    sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}
export function createCzech(): Phonemizer {
    return new CzechPhonemizer();
}
