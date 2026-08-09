/**
 * Build the shipped Afrikaans PRONUNCIATION LEXICON from the RCRL Afrikaans Pronunciation Dictionary.
 *
 * The rule engine is 79.5% word-exact on the primary referee and 65.2% on RCRL, but ~87% on RUNNING TEXT —
 * a dictionary-shaped referee over-samples rare long words. A lexicon closes the gap where it matters: RCRL
 * covers ~86% of running-text tokens, of which the rules get ~87% exact, so the lexicon fixes ≈11pp of ALL
 * tokens. That is the largest single lever left for shipped output.
 *
 * ⚠ SHIPPED PATH ONLY. `phonemizeWordRules` — what the eval scores — never consults it, exactly as for
 * `af-lexicon.tsv`: RCRL is a REFEREE, so scoring a lexicon built from it would be scoring the answer key
 * (the house pattern, mirroring en-GB / tl / ilo / km). The eval numbers must not move when this lands.
 *
 * ⚠ NORMALIZED TO THE ENGINE'S INVENTORY, not copied raw. Review of #770 caught af-lexicon.tsv shipping
 * referee-narrow symbols the eval's own folds hide, so they reached users unmeasured. The deltas here are the
 * four symbols the referee uses and this engine never emits, plus the one diphthong notation difference.
 *
 * Run: `npx tsx tools/afrikaans/build_af_lexicon.ts`   (reads the in-repo referee; no network)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");

/** RCRL notation → this engine's inventory. Verified exhaustive: these are the only symbols RCRL uses that the
 *  engine never emits (x æ ɡ ʊ), plus ⟨ou⟩, where the two sources are each internally unanimous and differ. */
const NORMALIZE: readonly (readonly [RegExp, string])[] = [
    [/əu/gu, "œu"], // ⟨ou⟩/⟨au⟩: RCRL 325:0 for [əu], en.wiktionary 34:0 for [œu] — notation, not disagreement
    [/x/gu, "χ"], // the ⟨g⟩ fricative: we write the uvular symbol throughout
    [/æ/gu, "ɛ"], // ⟨e⟩ before /r l/: RCRL narrow-transcribes the lowered allophone; we do not
    [/ʊ/gu, "u"], // the ⟨oo⟩ centering-diphthong onset [ʊə]~[uə]
    [/ɡ/gu, "χ"], // ⟨g⟩ in the few rows RCRL writes as a stop; the engine has no /ɡ/
    [/[ˈˌ.]/gu, ""], // ⚠ STRESS AND SYLLABLE DOTS ARE STRIPPED — the engine emits neither, and a lexicon that
    // carried them would make shipped output inconsistent with every word the rules produce.
];

const rows = readFileSync(join(REPO, "tools/referee-eval/referees/af.rcrl-apd.tsv"), "utf8")
    .split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t"));

/**
 * Entries this dictionary must NOT serve, because taking its value would LOSE something the engine and the
 * primary referee both express. Two classes, both found by existing goldens failing when the lexicon landed:
 *
 * 1. SINGLE LETTERS. RCRL has `n` → ə, `a` → a, `o` → œu. A bare letter in Afrikaans text is SPELLED, not
 *    sounded (⟨C⟩ is "see" [siə], #761), and a lexicon hit would shadow that rule. ⚠ THIS IS THE SECOND TIME:
 *    review of #770 caught exactly this in af-lexicon.tsv, where stray `j`/`q` rows made ⟨J⟩ read [jɛ].
 * 2. THE LONG-VOWEL INVENTORY GAP. RCRL has **no ɛː, no œː and no yː at all** — it writes aangelê ɑːnxəlɛ and
 *    aangestuur ɑːnxəstyr — so every ⟨ê⟩, ⟨û⟩ and ⟨uu⟩ word would come back with its length silently deleted.
 *    The primary corroborates the length (ɛː ×16, yː ×3) and the manifest documents circumflex = long, so this
 *    is an inventory gap in the source, not a disagreement about the language. ⟨ô⟩ joins them on the same
 *    evidence: RCRL *has* ɔː (150 rows) yet writes môre short against the primary's ˈmɔː.rə.
 *
 * The rules already get all of these right from the spelling, so dropping the entry is strictly better than
 * importing a flattened one. Cost: ~2% of coverage.
 */
const LOSES_A_CONTRAST = /ê|û|ô|uu/u;

const out: string[] = [];
const seen = new Set<string>();
let droppedLetter = 0, droppedLength = 0;
for (const [word, ipa] of rows) {
    if (!word || !ipa) continue;
    const w = word.toLowerCase();
    if (seen.has(w)) continue; // RCRL is single-pronunciation, but be explicit rather than trust it
    seen.add(w);
    if ([...w].length === 1) { droppedLetter++; continue; }
    if (LOSES_A_CONTRAST.test(w)) { droppedLength++; continue; }
    let v = ipa.normalize("NFC");
    for (const [re, rep] of NORMALIZE) v = v.replace(re, rep);
    // ⚠ WORD-INITIAL ⟨v⟩ IS [f], and the 2.8% of rows that write [v] are transcription noise we must not ship.
    // Both sources agree overwhelmingly — RCRL 2363:69, en.wiktionary 184:13 — and Run 6 established that the
    // f→v miss class is noise rather than a rule. A dictionary's per-word value normally beats a majority rule,
    // which is the whole point of a lexicon; the exception is where the majority is 97% ACROSS INDEPENDENT
    // SOURCES and the minority has no environment of its own. Leaving them in would put vitamien → [v]itamin in
    // users' output on the strength of one row.
    if (w.startsWith("v") && v.startsWith("v")) v = `f${v.slice(1)}`;
    out.push(`${w}\t${v}`);
}

const header = [
    "# af-rcrl-lexicon.tsv — shipped Afrikaans pronunciation lexicon (word -> canonical IPA).",
    "# RCRL Afrikaans Pronunciation Dictionary v1.4.1 (CTexT / North-West University) via ttslab/za_lex.",
    "# CC BY-SA 2.5 ZA. Built by tools/afrikaans/build_af_lexicon.ts. Sidecar: af-rcrl-lexicon.PROVENANCE.md",
    "# SHIPPED PATH ONLY — phonemizeWordRules (what the eval scores) does not consult this.",
    `# ${out.length} entries.`,
].join("\n");
writeFileSync(join(REPO, "src/languages/afrikaans/af-rcrl-lexicon.tsv"), `${header}\n${out.join("\n")}\n`);
console.log(
    `wrote ${out.length} entries; dropped ${droppedLetter} single letters (letter-name rule) and ` +
    `${droppedLength} ê/û/ô/uu words (RCRL cannot express the length)`,
);
