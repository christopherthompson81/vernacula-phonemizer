/**
 * Build the German loanword CONSONANT-correction lexicon — src/languages/german/consonant.tsv.
 * (Companion to the vowel quality.tsv: same per-position kaikki-alignment, for the lexical consonant splits.)
 *
 * German consonant letters are read natively but keep a FOREIGN value in loanwords: ⟨v⟩ → /f/ natively (Vater),
 * /v/ in loans (November → noˈvɛmbɐ); word-initial ⟨s⟩ → /z/ natively (Sonne), /s/ in loans (Safe → sɛɪf, pseudo);
 * plus a few (x~ç/k, k~ç in -igkeit, ŋ~n at a boundary). No rule captures the native-vs-loan split, so this
 * distils it per word, per CONSONANT position, from kaikki — recording, for each consonant where kaikki differs
 * from ours along a known loan pair, the target. applyConsonant (german.ts) applies them. Cross-source validated:
 * derived from kaikki, it lifts the INDEPENDENT wikipron agreement +1.8.
 *
 * SOURCE: the kaikki German extract (word<TAB>IPA). Regenerate with:
 *   curl -s https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.jsonl \
 *     | python3 tools/gen/extract_kaikki_de.py de-kaikki-full.tsv
 *
 * Usage: npx tsx tools/gen/build-de-consonant.mts --kaikki <de-kaikki-full.tsv>
 */
import { readFileSync, writeFileSync } from "node:fs";

import { phonemizeWord } from "../../src/languages/german/german.ts";
import { MANIFEST } from "../../src/languages/german/manifest.ts";

function arg(name: string, fb: string): string {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fb;
}
const KAIKKI = arg("kaikki", "");
const OUT = "data/languages/german/consonant.tsv";
if (!KAIKKI) throw new Error("pass --kaikki <word\\tIPA tsv> (see header to regenerate it)");

const VOWELS = MANIFEST.vowelChars;
// A "consonant" for ordinal counting: not a vowel, stress/boundary/length mark, or a combining diacritic
// (̯ offglide, ̩ syllabic, ̥ devoiced, ͡ tie) — those attach to the previous segment. Build and engine share this.
export const isConsChar = (c: string): boolean =>
    !VOWELS.includes(c) && !"ˈˌʔ()ː̯̩̥͡".includes(c);

// Allowed loanword corrections (ours → kaikki): the systematic lexical consonant splits.
const PAIRS: Record<string, Set<string>> = {
    "f": new Set(["v"]),
    "z": new Set(["s"]),
    "s": new Set(["z"]),
    "v": new Set(["f"]),
    "x": new Set(["ç", "k"]),
    "k": new Set(["ç"]),
    "ŋ": new Set(["n"]),
    "ɡ": new Set(["ʒ"]), // French -age/-ge loans: Garage, Etage, Doge, Marge → ʒ (native ⟨g⟩ → ɡ)
};

// Tokenise the consonant sequence. Expand kaikki's syllabic consonants (kʁɪstn̩ → …stən) so ⟨-en⟩ etc. align, and
// count a vocalised coda-r ɐ̯ (our reading) as ONE consonant slot — otherwise it counts 0 (ɐ is a vowel) while
// kaikki's ʁ counts 1, skewing the whole word out of the lexicon (≈half of all skew). It's never itself corrected
// (no PAIR targets/keys ɐ̯), it just holds a slot so the OTHER consonants align by ordinal. applyConsonant matches.
const consonants = (ipa: string): string[] => {
    const s = ipa.replace(/n̩/g, "ən").replace(/l̩/g, "əl").replace(/m̩/g, "əm").replace(/ŋ̩/g, "əŋ");
    const out: string[] = [];
    for (let i = 0; i < s.length; i++) {
        if (s[i] === "ɐ" && s[i + 1] === "̯") { out.push("ɐ̯"); i++; continue; }
        if (isConsChar(s[i]!)) out.push(s[i]!);
    }
    return out;
};

const rows = readFileSync(KAIKKI, "utf8").trim().split("\n").map((l) => l.split("\t"));
writeFileSync(OUT, ""); // empty first → phonemizeWord's lazy load sees no corrections (compare vs the RAW engine)

const out: [string, string][] = [];
let skewed = 0;
for (const [w, kipa] of rows) {
    if (!w || !kipa) continue;
    if (!/^[a-zäöüß]+$/.test(w)) continue;
    if (!/[aeiouäöüy]/.test(w)) continue; // skip vowelless acronyms (lkw, pkw) — kaikki letter-spells them, so
    // the consonant alignment against our word-reading is spurious

    const kc = consonants(kipa), oc = consonants(phonemizeWord(w));
    if (oc.length !== kc.length) { skewed++; continue; }
    const cs: string[] = [];
    for (let i = 0; i < kc.length; i++) {
        if (oc[i] !== kc[i] && PAIRS[oc[i]!]?.has(kc[i]!)) cs.push(`${i}${kc[i]}`);
    }
    if (cs.length) out.push([w, cs.join(",")]);
}
// ⚠ MERGE THE CURATED ⟨c⟩→/t͡s/ LIST. Those words cannot be learned by the alignment above at all: kaikki's
// affricate counts as two consonants against our one, so Celsius is 4 slots against 5 and falls out on the
// length check before PAIRS is consulted. Collapsing the affricate here fixes them and REGRESSES the table
// overall (independent wikipron deu 2313 → 2305), so the collapse lives in build-de-c-affricate.mts, which
// only has to align that one class. Curated wins on a conflict — it is the hand-checked side.
const CURATED = "tools/gen/de-consonant-curated.tsv";
let curated = 0;
try {
    const byWord = new Map(out);
    for (const line of readFileSync(CURATED, "utf8").split("\n")) {
        if (!line || line.startsWith("#")) continue;
        const [w, spec] = line.split("\t");
        if (!w || !spec) continue;
        // Merge per ORDINAL, so a word that also carries a learned v/s correction keeps it.
        const merged = new Map<string, string>();
        for (const c of (byWord.get(w) ?? "").split(",")) {
            const m = /^(\d+)(.+)$/u.exec(c);
            if (m) merged.set(m[1]!, m[2]!);
        }
        for (const c of spec.split(",")) {
            const m = /^(\d+)(.+)$/u.exec(c);
            if (m) merged.set(m[1]!, m[2]!);
        }
        byWord.set(w, [...merged.entries()].sort((x, y) => Number(x[0]) - Number(y[0]))
            .map(([o, t]) => `${o}${t}`).join(","));
        curated++;
    }
    out.length = 0;
    out.push(...byWord.entries());
} catch {
    console.warn(`(no ${CURATED} — building without the curated c→t͡s list)`);
}

out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

const hdr =
    "# German loanword consonant corrections — word<TAB>consonant-ordinal+target,… (0-based CONSONANT index →\n" +
    "# target). Generated by tools/gen/build-de-consonant.mts from the kaikki German extract, ONLY for consonants\n" +
    "# where kaikki differs from ours along a known loan pair (v→f/f→v, s→z/z→s, x→ç/k, k→ç, ŋ→n) — the lexical\n" +
    "# native-vs-loanword split (November → …v…, Safe → s…) no rule captures.\n" +
    "# Plus the curated ⟨c⟩→/t͡s/ list (tools/gen/de-consonant-curated.tsv), which the ordinal\n" +
    "# alignment above cannot learn — kaikki's affricate counts as two consonants against our one.\n";
writeFileSync(OUT, hdr + out.map(([w, o]) => w + "\t" + o).join("\n") + "\n");
console.log(`wrote ${OUT}: ${out.length} consonant-correction entries (of ${rows.length} kaikki words; ${skewed} skipped for consonant-count skew)`);
