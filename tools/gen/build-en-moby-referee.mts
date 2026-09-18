/**
 * Build an English referee corpus from the MOBY PRONUNCIATOR II word list.
 *
 * Upstream: Project Gutenberg eBook #3205, "Moby Pronunciation List", Grady Ward.
 *   ⚠ PUBLIC DOMAIN BY EXPLICIT GRANT — the file says so in its own header: "Public Domain material by
 *   grant from the author, January, 2001." That is what makes a DERIVED, COMMITTED artifact legal here,
 *   where the wikipron referees are CC-BY-SA imports kept intact. The PG boilerplate around the content
 *   carries a trademark licence on the *Project Gutenberg* name, not on the work; it is not read and not
 *   reproduced. See data/LICENSES/PROVENANCE.md §5.3.
 *
 *   MOBY=/path/to/mobypron.unc npx tsx tools/gen/build-en-moby-referee.mts
 *
 * ⚠ WHY THIS EXISTS. The wikipron eng_us referee is 4,558 rows and 64% of them sit outside the 50k
 * frequency list — it is short AND skewed to the hard tail, so it cannot say whether the BASICS are right,
 * and it has nothing at all to say about the OOV path. Moby supplies both: 36,860 headwords we carry in
 * the dictionary (22,934 of them inside the 40k frequency list) and 57,679 we do NOT, which is the first
 * referee this repo has ever had for the OOV tier.
 *
 * ⚠ AND IT IS ONLY HALF-INDEPENDENT, WHICH IS WHY IT SHIPS AS `secondary`. #1338 SELECTED ~500 dictionary
 * corrections on the rule "gold AND Moby agree against us", so for those rows scoring against Moby is
 * partly a mirror. The parts that are genuinely independent are #1334–#1336 (driven by wikipron + gold)
 * and the entire OOV half, which no correction has ever been derived from.
 *
 * WHAT IS TRANSFORMED, AND WHAT IS DELIBERATELY NOT:
 *
 *   ⚠ NOTATION — APPLIED, because it is provably meaning-preserving. Moby SPELLS OUT what this engine
 *   writes as one phone. `general` is `dʒ ɛ n ə r ə l` where we write `ɚ`; `download` is `d æ ʊ n …` where
 *   we write the single diphthong `aʊ`. Leaving these unfolded scored 1,619 words wrong for a
 *   transcription convention — 40% of the entire residual, and none of it a claim about pronunciation.
 *
 *   ⚠ FORCE→NORTH — APPLIED, and this one needs its own argument because folding a real MERGER normally
 *   destroys a referee's ability to catch a regression. It is safe HERE and only here: CMUdict has no
 *   FORCE/NORTH distinction at all (`more` and `nor` are both AO R), so this engine has no FORCE to
 *   regress into and the fold can hide nothing. 419 words.
 *
 *   ⚠ MARRY–MERRY — NOT APPLIED, for the exact reason the one above is. 402 dictionary rows moved on that
 *   axis in #1336 and the engine writes BOTH æɹ and ɛɹ, so folding Moby's unmerged reading would blind the
 *   referee to precisely the class most recently changed. Its 165 rows stay in the residual, visible.
 *
 *   ⚠ THE CONSERVATIVE YOD — NOT APPLIED, same reasoning: `tuition` and `duplication` lost a yod in #1338
 *   and en-GB adds it back from a word list, so the distinction is live in this engine and must stay
 *   scoreable.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mobyToArpabet } from "../english/en_source_compare.mts";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MOBY = process.env["MOBY"];
if (!MOBY) throw new Error("set MOBY to a mobypron.unc path (Project Gutenberg #3205)");

/** ARPABET → BROAD IPA. ⚠ DELIBERATELY NOT `makeArpabetToIpa`: that is the ENGINE's narrow notation
 *  (aspiration ʰ, dark ɫ, flapped t̬, superscript offglides), and a referee written in the notation of the
 *  thing it judges reads as a mirror even where the folds would make it score the same. This is the plain
 *  broad transcription a human referee file looks like — the same shape as the wikipron imports. */
const IPA: Record<string, string> = {
    AA: "ɑ", AE: "æ", AH: "ʌ", AO: "ɔ", AW: "aʊ", AY: "aɪ", EH: "ɛ", ER: "ɚ", EY: "eɪ",
    IH: "ɪ", IY: "i", OW: "oʊ", OY: "ɔɪ", UH: "ʊ", UW: "u",
    B: "b", CH: "t͡ʃ", D: "d", DH: "ð", F: "f", G: "ɡ", HH: "h", JH: "d͡ʒ", K: "k", L: "l",
    M: "m", N: "n", NG: "ŋ", P: "p", R: "ɹ", S: "s", SH: "ʃ", T: "t", TH: "θ", V: "v",
    W: "w", Y: "j", Z: "z", ZH: "ʒ",
};
/** Two Moby symbols this engine writes as one. Applied on the ARPABET side, before IPA. */
const JOIN: [string, string, string][] = [
    ["AH", "R", "ER"], ["IH", "R", "ER"],          // ə/ɪ + r is our single ɚ (general, history, different)
    ["AE", "UH", "AW"], ["AA", "UH", "AW"],        // two-segment MOUTH
    ["AA", "IH", "AY"], ["AA", "AH", "AY"],        // two-segment PRICE
    ["EH", "IH", "EY"], ["AO", "IH", "OY"],        // two-segment FACE / CHOICE
];

/** ⚠ STRESS IS CARRIED THROUGH THE JOIN AND CONSULTED FOR `AH`, because Moby writes ONE symbol `/@/` for
 *  both the STRUT vowel and schwa and separates them by stress alone — the same convention CMUdict uses
 *  (AH1 = ʌ, AH0 = ə). Stripping stress before the IPA map wrote `general` as `dʒɛnɚʌl` and `carolina` as
 *  `kæɹʌlaɪnʌ`, turning every unstressed schwa in the corpus into STRUT. */
function fold(a: string[]): [string, string][] {
    const t = a.map((p) => [p.replace(/[0-2]$/u, ""), /[0-2]$/u.test(p) ? p.slice(-1) : ""] as [string, string]);
    const out: [string, string][] = [];
    for (let i = 0; i < t.length; i++) {
        const j = JOIN.find(([x, y]) => t[i]![0] === x && t[i + 1]?.[0] === y);
        if (j) { out.push([j[2], t[i]![1]]); i++; continue; }   // the joined nucleus keeps the FIRST stress
        // FORCE → NORTH: Moby keeps oʊɹ where GenAm merged to ɔɹ. Safe — CMUdict has no such distinction.
        if (t[i]![0] === "OW" && t[i + 1]?.[0] === "R") { out.push(["AO", t[i]![1]]); continue; }
        out.push(t[i]!);
    }
    return out;
}
const sym = ([base, stress]: [string, string]): string =>
    base === "AH" && stress === "0" ? "ə" : (IPA[base] ?? "");

const dict = new Set<string>();
for (const l of readFileSync(join(REPO, "data/languages/english/g2p-dict.tsv"), "utf8").split("\n"))
    if (l.includes("\t") && !l.startsWith("#")) dict.add(l.split("\t")[0]!.toLowerCase());

const lex: string[] = [], oov: string[] = [];
let rows = 0, declined = 0, unmapped = 0;
const seen = new Set<string>();
for (const line of readFileSync(MOBY, "latin1").split(/\r\n|\r|\n/u)) {
    const sp = line.indexOf(" ");
    if (sp < 0) continue;
    rows++;
    const w = line.slice(0, sp).toLowerCase();
    // ⚠ ONE ROW PER HEADWORD. Moby lists variants as separate lines; the eval credits ANY tab-separated
    // reading, but a duplicate KEY would be two rows scoring the same word twice. First reading wins.
    if (seen.has(w)) continue;
    if (!/^[a-z]{2,20}$/u.test(w)) continue;          // no multi-word, no digits, no punctuation headwords
    const a = mobyToArpabet(line.slice(sp + 1));
    if (!a) { declined++; continue; }                  // multi-word body / Moby's French sub-scheme
    const ipa = fold(a).map(sym).join("");
    if (ipa === "" || fold(a).some((p) => sym(p) === "")) { unmapped++; continue; }
    seen.add(w);
    (dict.has(w) ? lex : oov).push(`${w}\t${ipa}`);
}

const header = (what: string, n: number): string =>
    `# en — MOBY PRONUNCIATOR II, ${what} (${n} rows)\n` +
    `# Derived from Project Gutenberg #3205 (Grady Ward), PUBLIC DOMAIN by grant from the author, Jan 2001.\n` +
    `# Built by tools/gen/build-en-moby-referee.mts — see that file for what is folded and what is not,\n` +
    `# and data/LICENSES/PROVENANCE.md §5.3 for provenance. Broad IPA, one reading per headword.\n`;

const dir = join(REPO, "tools/referee-eval/referees");
writeFileSync(join(dir, "en.moby-lexicon.tsv"), header("words this dictionary carries", lex.length) + lex.join("\n") + "\n");
writeFileSync(join(dir, "en.moby-oov.tsv"), header("words this dictionary does NOT carry — the OOV tier", oov.length) + oov.join("\n") + "\n");
console.log(`moby rows ${rows}, declined ${declined}, unmapped ${unmapped}`);
console.log(`  en.moby-lexicon.tsv  ${lex.length}`);
console.log(`  en.moby-oov.tsv      ${oov.length}`);
