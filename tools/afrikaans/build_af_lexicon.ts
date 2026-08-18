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
import { phonemizeWordRules } from "../../src/languages/afrikaans/afrikaans.ts";
import { CONFIG } from "../referee-eval/config.ts";
import { makeFold, expandOptional } from "../referee-eval/eval.ts";
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
    // ⚠ SYLLABLE DOTS ARE STRIPPED; PRIMARY STRESS IS KEPT AND RE-ANCHORED.
    //
    // This previously dropped `ˈ` as well, on the reasoning that "the engine emits neither, and a
    // lexicon that carried them would make shipped output inconsistent with every word the rules
    // produce". That reasoning was sound and the conclusion followed from it — but the premise was the
    // thing to fix. The engine ALREADY COMPUTES stress placement (`stressedNucleus`: first syllable,
    // past an unstressed prefix, with derived loan-suffix overrides) and used it only to pick vowel
    // quality. It now emits the mark, so keeping the lexicon's is the consistent choice, not the
    // inconsistent one.
    //
    // Measured: the rule alone places stress on the same syllable as RCRL for 75.3% of 25,550 words;
    // the lexicon covers 37.2% of af_za corpus tokens outright. Effective accuracy on the corpus is
    // ~84.5%, against 0% when no mark is emitted at all.
    //
    // ⚠ AND THE TWO CONVENTIONS DIFFER. RCRL marks before the syllable ONSET (`a.fri.ˈkɑːns`), this
    // repo before the NUCLEUS (`nˈaða`, `kˈaða` — see spanish.ts). Un-stripping without re-anchoring
    // would ship a second convention inside one lexicon. `reanchorStress` below moves the mark across
    // the onset to sit immediately before its vowel.
    [/[ˌ.]/gu, ""],
];

/**
 * Move a primary-stress mark from before the syllable ONSET to before its NUCLEUS — the convention this
 * repo's engines emit (`nˈaða`, not `ˈnaða`). Applied AFTER the dots are gone, so the onset is simply
 * the consonant run between the mark and the next vowel.
 */
const IPA_VOWEL = /[aeiouyøœəɛɔɑæɪʊ]/u;
function reanchorStress(v: string): string {
    const i = v.indexOf("\u02c8");
    if (i < 0) return v;
    const rest = v.slice(i + 1);
    let k = 0;
    while (k < rest.length && !IPA_VOWEL.test(rest[k]!)) k += 1;
    if (k === 0 || k >= rest.length) return v;           // already at a vowel, or no vowel follows
    return v.slice(0, i) + rest.slice(0, k) + "\u02c8" + rest.slice(k);
}

const rows = readFileSync(join(REPO, "tools/referee-eval/referees/af.rcrl-apd.tsv"), "utf8")
    .split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t"));

/** The long vowels our engine emits that this source NEVER writes — i.e. the ones it cannot express.
 *  Derived by scanning the source, so it stays true if the source is ever updated. */
const ALL_LONG = ["ɑː", "iː", "uː", "yː", "øː", "ɛː", "œː", "ɔː", "əː", "eː", "oː"] as const;
const MISSING_LONG = ALL_LONG.filter((v) => !rows.some(([, ipa]) => ipa?.includes(v)));
console.log(`long vowels absent from the source (dropped rather than flattened): ${MISSING_LONG.join(" ") || "(none)"}`);

/**
 * ⚠ THE INDEPENDENT PRIMARY REFEREE OVERRULES THIS DICTIONARY. Where en.wiktionary has the word and already
 * agrees with the rule engine, the lexicon may not override it: two of this language's sources conflict there
 * and the one that is NOT the lexicon's own source is the tiebreaker. It is only 2,220 words, but they are
 * exactly the adjudicated ones — môre (primary ˈmɔː.rə vs RCRL ˈmɔ.rə, and the manifest documents ⟨ô⟩ = long),
 * Afrika, polisie, subsidie, telefoon. Without this guard those shipped the RCRL reading and showed up as
 * REGRESSIONS against the primary; with it they cannot.
 */
const afCfg = CONFIG.af!;
const primaryFold = makeFold(afCfg, afCfg.referees[0]!.folds);
const PRIMARY = new Map<string, string[]>();
for (const line of readFileSync(join(REPO, "tools/referee-eval/referees", afCfg.referees[0]!.file), "utf8").split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const f = line.split("\t");
    if (f.length < 2 || !f[0] || !f[1]) continue;
    PRIMARY.set(f[0].toLowerCase(), f.slice(1)
        .flatMap((ri) => (/[()]/u.test(ri) ? expandOptional(ri) : [ri])).map(primaryFold));
}

/** Levenshtein, for the plausibility guard below. */
function editDistance(a: string, b: string): number {
    const x = [...a], y = [...b];
    const d = Array.from({ length: y.length + 1 }, (_, j) => j);
    for (let i = 1; i <= x.length; i++) {
        let prev = d[0]!;
        d[0] = i;
        for (let j = 1; j <= y.length; j++) {
            const t = d[j]!;
            d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (x[i - 1] === y[j - 1] ? 0 : 1));
            prev = t;
        }
    }
    return d[y.length]!;
}

/**
 * ⚠ VET EVERY ENTRY AGAINST THE RULE OUTPUT — which is the right relationship between the two: the dictionary
 * wins on LEXICAL knowledge (which vowel this particular loan takes, where its stress falls), the rules win on
 * SYSTEMATIC phonology (devoicing, length, what the inventory contains). The first draft vetted at the SYMBOL
 * level only ("these four symbols map to those four"), which structurally cannot see a narrow transcription
 * that differs as a SEQUENCE or as a RULE. Review of #776 found three classes it missed, all shipping:
 *
 *   · LENGTH — 324 entries shipped a short vowel where the rules have a long one (kubieke kyːbikə → kybikə),
 *     plus ⟨eeu⟩ ×24 and ⟨eu⟩ ×17. The old guard was a SPELLING list (ê û ô uu) and so also missed ⟨î⟩
 *     outright. The gap is in RCRL's INVENTORY — it has no ɛː, œː or yː at all — so the check has to be on
 *     the inventory, not on which letters happen to expose it.
 *   · FINAL DEVOICING — 22 of 24 spelling-final ⟨b⟩ words shipped voiced (klub → klœb for klœp). `rob` is a
 *     native word and the INDEPENDENT primary writes rɔp, so this is a defect, not a source disagreement.
 *   · SCHWA EPENTHESIS in /rm, lm/ — 219 entries (arm → arəm, film → fələm, storm → stɔrəm). Narrow
 *     transcription of a real phonetic detail this engine does not model; the primary writes fəlm, stɔrm, fɔrm.
 *     Left in, a lexicon word epenthesizes and an OOV compound of the same shape does not.
 *
 * Repair where the rule is authoritative and the entry's lexical content survives; DROP where it does not.
 */
function vet(w: string, entry: string): { ipa?: string; why?: string } {
    const r = phonemizeWordRules(w);
    const prim = PRIMARY.get(w);
    if (prim && prim.includes(primaryFold(r))) return { why: "primary corroborates the rules" };
    // 1. LENGTH, and ONLY for the long vowels this source CANNOT WRITE. ⚠ "rules have ː and the entry does
    //    not" is the wrong test: it also drops every entry that correctly says SHORT where our rules
    //    over-apply length (kanon — RCRL ka.ˈnɔn against our kɑːnɔn — is exactly the kind of row a lexicon
    //    exists to fix). The source HAS ɑː, øː and ɔː, so a short value there is a real lexical claim; it has
    //    no ɛː, œː or yː at all, so a short value there is an inventory gap. MISSING_LONG is derived from the
    //    file rather than typed out, so it cannot drift from the data it describes.
    for (const long of MISSING_LONG) if (r.includes(long) && !entry.includes(long)) return { why: "length" };
    // 2. FINAL DEVOICING: keep the entry, take the engine's coda. Both referees and the rule agree.
    let ipa = entry;
    const voiced: Record<string, string> = { b: "p", d: "t", z: "s", v: "f", ɡ: "χ" };
    const last = [...ipa].at(-1)!;
    if (voiced[last] && [...r].at(-1) === voiced[last]) ipa = ipa.slice(0, -last.length) + voiced[last];
    // 3. EPENTHESIS: if deleting ONE schwa yields the rule output, the entry is the narrow reading. Take ours.
    if (ipa !== r && ipa.length === r.length + 1) {
        for (let i = 0; i < ipa.length; i++)
            if (ipa[i] === "ə" && ipa.slice(0, i) + ipa.slice(i + 1) === r) return { ipa: r };
    }
    // 3b. A DROPPED ONSET is a source error, not a lexical fact, and it is too small for the distance guard
    //     below to see: RCRL writes tsaar sɑːr, i.e. the rule output minus its first phone (ours tsɑːr, the
    //     primary t͡sɑːr). One deleted leading consonant is edit-distance 1.
    if (ipa !== r && r.slice(1) === ipa) return { ipa: r };
    // 4. PLAUSIBILITY: a row too far from the rules is a source error, not lexical knowledge — RCRL has
    //    tsaar → sɑːr (the /t/ of ⟨ts⟩ simply absent) and abe → əib, which no analysis of that spelling yields.
    if (editDistance(ipa, r) > Math.max(3, Math.ceil(r.length * 0.5))) return { why: "implausible" };
    return { ipa };
}

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
const out: string[] = [];
const seen = new Set<string>();
let droppedLetter = 0;
const dropped: Record<string, number> = {};
for (const [word, ipa] of rows) {
    if (!word || !ipa) continue;
    const w = word.toLowerCase();
    if (seen.has(w)) continue; // RCRL is single-pronunciation, but be explicit rather than trust it
    seen.add(w);
    if ([...w].length === 1) { droppedLetter++; continue; }
    let v = ipa.normalize("NFC");
    for (const [re, rep] of NORMALIZE) v = v.replace(re, rep);
    v = reanchorStress(v);
    // ⚠ WORD-INITIAL ⟨v⟩ IS [f], and the 2.8% of rows that write [v] are transcription noise we must not ship.
    // Both sources agree overwhelmingly — RCRL 2363:69, en.wiktionary 184:13 — and Run 6 established that the
    // f→v miss class is noise rather than a rule. A dictionary's per-word value normally beats a majority rule,
    // which is the whole point of a lexicon; the exception is where the majority is 97% ACROSS INDEPENDENT
    // SOURCES and the minority has no environment of its own. Leaving them in would put vitamien → [v]itamin in
    // users' output on the strength of one row.
    if (w.startsWith("v") && v.startsWith("v")) v = `f${v.slice(1)}`;
    const checked = vet(w, v);
    if (checked.ipa === undefined) { dropped[checked.why!] = (dropped[checked.why!] ?? 0) + 1; continue; }
    v = checked.ipa;
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
    `wrote ${out.length} entries; dropped ${droppedLetter} single letters (letter-name rule), ` +
    Object.entries(dropped).map(([k, n]) => `${n} ${k}`).join(", "),
);
