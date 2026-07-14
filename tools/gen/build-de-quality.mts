/**
 * Build the German unstressed-vowel QUALITY-correction lexicon — src/languages/german/quality.tsv.
 * (Generalises the earlier reduction lexicon: same per-position kaikki-alignment, now with several target vowels.)
 *
 * German unstressed vowel quality is LEXICAL: native words reduce ⟨e⟩ to [ə] (schiebedach → ʃiːbədaχ) and keep
 * lax [ɛ ɪ ɔ ʊ]; loanwords keep a TENSE unstressed vowel [ə e i o u] (november → noˈvɛmbɐ, digital → diɡiˈtaːl).
 * No rule captures the native-vs-loan split, so this distils it per word, per NUCLEUS, from kaikki (the same
 * independent source as the length lexicon) — recording, for each UNSTRESSED nucleus where kaikki's quality
 * differs from ours along a known lax→tense / e→ə pair, the target vowel. applyQuality (german.ts) applies them.
 * Validated cross-source: derived from kaikki, it lifts the INDEPENDENT wikipron agreement 58→66%.
 *
 * SOURCE: the kaikki German extract (word<TAB>IPA). Regenerate the intermediate with:
 *   curl -s https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.jsonl \
 *     | python3 tools/gen/extract_kaikki_de.py de-kaikki-full.tsv
 *
 * Usage: npx tsx tools/gen/build-de-quality.mts --kaikki <de-kaikki-full.tsv>
 */
import { readFileSync, writeFileSync } from "node:fs";

import { phonemizeWord } from "../../src/languages/german/german.ts";
import { MANIFEST } from "../../src/languages/german/manifest.ts";

function arg(name: string, fb: string): string {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fb;
}
const KAIKKI = arg("kaikki", "");
const OUT = "src/languages/german/quality.tsv";
if (!KAIKKI) throw new Error("pass --kaikki <word\\tIPA tsv> (see header to regenerate it)");

const VOWELS = MANIFEST.vowelChars; // the ENGINE's vowel inventory — must match or ordinals misalign
// Allowed corrections: our lax/short vowel → kaikki's tense/reduced target. Only these pairs (a real quality
// alternation, not referee noise) are recorded.
const PAIRS: Record<string, Set<string>> = {
    "ɛ": new Set(["ə", "e"]),
    "ɪ": new Set(["i"]),
    "ɔ": new Set(["o"]),
    "ʊ": new Set(["u"]),
    "e": new Set(["ə"]),
    "ʏ": new Set(["y"]),
    "œ": new Set(["ø"]),
    // reverse of the loanword tensing: an unstressed tense vowel our rule over-lengthened but kaikki keeps LAX
    // (the -igen -ig- vowel: würdigen → our iːɡ, kaikki ɪɡ) — and the parallel high/mid cases (the Latinate -ium
    // ending: Aluminium → our …niːuːm, kaikki …ni̯ʊm; and unstressed -o- Doktor → our …oːɐ̯, kaikki …ɔʁ).
    "i": new Set(["ɪ"]),
    "y": new Set(["ʏ"]),
    "u": new Set(["ʊ"]),
    "o": new Set(["ɔ"]),
};

/** Each nucleus of an IPA string as {vowel, stressed}: a VOWEL char not followed by a non-syllabic glide ̯; a
 *  nucleus is stressed when a ˈ/ˌ immediately precedes it. Mirrors the engine's nucleus counting. */
function nuclei(ipa: string): { v: string; str: boolean }[] {
    // Expand kaikki's syllabic consonants (christen → kʁɪstn̩, not …stən) to schwa+C so the nucleus count matches
    // our ⟨-en⟩/⟨-el⟩/⟨-em⟩ rendering — otherwise these (mostly compound) words skew out of the lexicon.
    const s = ipa
        .replace(/n̩/g, "ən").replace(/l̩/g, "əl").replace(/m̩/g, "əm").replace(/ŋ̩/g, "əŋ")
        .replace(/[()]/g, ""); // drop kaikki's optional-length parens
    const out: { v: string; str: boolean }[] = [];
    let pendingStress = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i]!;
        if (c === "ˈ" || c === "ˌ") { pendingStress = true; continue; }
        if (c === "ʔ") continue; // glottal onset
        if (!VOWELS.includes(c)) continue;
        if ((s[i + 1] ?? "") === "̯") continue; // offglide, not a nucleus
        out.push({ v: c, str: pendingStress });
        pendingStress = false;
    }
    return out;
}

const rows = readFileSync(KAIKKI, "utf8").trim().split("\n").map((l) => l.split("\t"));
// Truncate first so phonemizeWord's lazy qualityDict() sees an EMPTY lexicon → this build always compares kaikki
// against the RAW engine (else a re-run would compare against already-corrected output). After the kaikki read.
writeFileSync(OUT, "");

const out: [string, string][] = [];
let skewed = 0;
for (const [w, kipa] of rows) {
    if (!w || !kipa) continue;
    if (!/^[a-zäöüß]+$/.test(w)) continue; // pure single German word only
    const kn = nuclei(kipa);
    const on = nuclei(phonemizeWord(w));
    if (on.length !== kn.length) { skewed++; continue; } // unequal syllabification → can't align
    const cs: string[] = [];
    for (let i = 0; i < kn.length; i++) {
        if (kn[i]!.str || on[i]!.str) continue; // UNSTRESSED nuclei only (stressed quality is length.tsv's job)
        const ov = on[i]!.v, kv = kn[i]!.v;
        if (ov !== kv && PAIRS[ov]?.has(kv)) cs.push(`${i}${kv}`);
    }
    if (cs.length) out.push([w, cs.join(",")]);
}
out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

const hdr =
    "# German unstressed-vowel quality corrections — word<TAB>ordinal+target,… (0-based nucleus → target vowel).\n" +
    "# Generated by tools/gen/build-de-quality.mts from the kaikki German extract, per-position, ONLY for the\n" +
    "# UNSTRESSED nuclei where kaikki's quality differs from ours along a lax→tense / e→ə pair (november → …o…,\n" +
    "# digital → …i…, schiebedach → …ə…) — the lexical native-vs-loanword split no rule captures.\n";
writeFileSync(OUT, hdr + out.map(([w, o]) => w + "\t" + o).join("\n") + "\n");
console.log(`wrote ${OUT}: ${out.length} quality-correction entries (of ${rows.length} kaikki words; ${skewed} skipped for nucleus-count skew)`);
