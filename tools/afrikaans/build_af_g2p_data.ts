/**
 * Build the Afrikaans g2p TRAINING SET for the OOV tagger — the union of both open pronunciation
 * dictionaries, normalized to this engine's inventory and vetted the same way the shipped lexicon is.
 *
 *   RCRL Afrikaans Pronunciation Dictionary  27,428  (CC BY-SA 2.5 ZA)   — also the af secondary referee
 *   NCHLT-inlang Afrikaans                   15,094  (CC BY 3.0)          — +5,160 headwords RCRL lacks
 *   ────────────────────────────────────────────────
 *   union                                   ~32,600
 *
 * ⚠ THAT IS THE CEILING FOR THIS LANGUAGE. The third open dictionary, Lwazi Afrikaans (4,998, CC BY 2.5 ZA),
 * adds ZERO headwords — every one is already in RCRL. There is no nb/da-scale (199k NST) Afrikaans resource.
 * For context, the repo's own starvation line is ~10k pairs (measured in da-g2p-tagger.PROVENANCE.md) and the
 * shipped Sindhi tagger trains on 9,274, so ~32.6k is mid-fleet: above sd, below bn's ~60k.
 *
 * ⚠ THE TWO SOURCES ARE NOT INDEPENDENT — 96.6% identical on their 9,871-word overlap, same NWU/CSIR lineage.
 * That is fine for TRAINING (more coverage) and disqualifying for REFEREEING, which is why NCHLT is not wired
 * as one. See tools/afrikaans/nchlt_afr.PROVENANCE.md.
 *
 * ⚠ NO STRESS MARKS. Unlike the Norwegian tagger, which keeps ˈ in the tag alphabet, af emits no stress by
 * convention — the stress information is carried in the VOWEL QUALITY (reduction and open/closed length),
 * which is exactly what the model has to learn. NCHLT has no stress marks at all, so keeping them would also
 * have meant training on RCRL only.
 *
 * Run: `npx tsx tools/afrikaans/build_af_g2p_data.ts`   (no network; writes tools/afrikaans/af-g2p-data.tsv)
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { phonemizeWordRules } from "../../src/languages/afrikaans/afrikaans.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const WORD_OK = /^[a-zêôûîëïéèáàóúüöäòç'’-]+$/u;

/** RCRL/NCHLT notation → this engine's inventory (the shipped lexicon's map, plus the X-SAMPA tokens). */
const NORMALIZE: readonly (readonly [RegExp, string])[] = [
    [/əu/gu, "œu"], [/x/gu, "χ"], [/æ/gu, "ɛ"], [/ʊ/gu, "u"], [/ɡ/gu, "χ"], [/[ˈˌ.]/gu, ""],
];
const XSAMPA: Record<string, string> = {
    "A:": "ɑː", "2:": "øː", "i@": "iə", "u@": "uə", "9y": "œy", "@i": "əi", "@u": "əu", "A:r": "ɑːr",
    "@": "ə", "E": "ɛ", "O": "ɔ", "N": "ŋ", "S": "ʃ", "Z": "ʒ", "9": "œ", "h\\": "ɦ", "{": "æ", "g": "ɡ",
};

const norm = (ipa: string): string => {
    let v = ipa.normalize("NFC");
    for (const [re, rep] of NORMALIZE) v = v.replace(re, rep);
    return v;
};

/** The long vowels our engine emits that NEITHER source can write — derived, not typed out. */
const LONG = ["ɑː", "iː", "uː", "yː", "øː", "ɛː", "œː", "ɔː", "əː", "eː", "oː"] as const;

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

// ── load both dictionaries ────────────────────────────────────────────────────────────────────────────
const rcrlRows = readFileSync(join(REPO, "tools/referee-eval/referees/af.rcrl-apd.tsv"), "utf8")
    .split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t"));
const nchltRows = readFileSync(join(HERE, "nchlt_afr.dict"), "utf8")
    .split("\n").filter((l) => l.trim()).map((l) => l.split("\t"));

const MISSING_LONG = LONG.filter((v) =>
    !rcrlRows.some(([, i]) => i?.includes(v)) && !nchltRows.some(([, p]) => p && norm(p.split(/\s+/u).map((t) => XSAMPA[t] ?? t).join("")).includes(v)));

/** Vet an entry against the rule output — dictionary wins on lexical knowledge, rules on systematic
 *  phonology. Mirrors build_af_lexicon.ts, MINUS its primary-referee guard: that guard exists to stop the
 *  lexicon overriding adjudicated words at SERVING time, but those rows are correct and belong in training. */
function vet(w: string, entry: string): string | undefined {
    const r = phonemizeWordRules(w);
    // ⚠ SUBSTITUTE THE RULE, DO NOT DROP THE WORD. The shipped LEXICON drops this class (neither source can
    // write ɛː/œː/yː, so their entries would flatten a length the engine marks). Dropping it from TRAINING too
    // was a mistake: it removed ⟨ê û î⟩ from the character vocabulary entirely — the tagger declines on them,
    // which is safe but inert — and, worse, left ⟨uu⟩ half-learned, since ⟨u⟩ IS in vocab so the model does not
    // decline and instead emits natuurlik → *natœœrlək for natyːrlək. The rules derive this length
    // DETERMINISTICALLY from the spelling, so for exactly this class they are the authority: teach it to the
    // model rather than hiding the grapheme from it. Found by the af frequency list — natuurlik is common.
    for (const long of MISSING_LONG) if (r.includes(long) && !entry.includes(long)) return r;
    let ipa = entry;
    const voiced: Record<string, string> = { b: "p", d: "t", z: "s", v: "f", ɡ: "χ" };
    const last = [...ipa].at(-1)!;
    if (voiced[last] && [...r].at(-1) === voiced[last]) ipa = ipa.slice(0, -1) + voiced[last];
    if (ipa !== r && ipa.length === r.length + 1) {
        for (let i = 0; i < ipa.length; i++)
            if (ipa[i] === "ə" && ipa.slice(0, i) + ipa.slice(i + 1) === r) return r;
    }
    if (ipa !== r && r.slice(1) === ipa) return r;
    if (editDistance(ipa, r) > Math.max(3, Math.ceil(r.length * 0.5))) return undefined;
    return ipa;
}

const pairs = new Map<string, string>();
const stats = { rcrl: 0, nchlt: 0, rejected: 0 };
// RCRL first — it is the larger and better-specified source, so it wins any headword collision.
for (const [word, ipa] of rcrlRows) {
    if (!word || !ipa) continue;
    const w = word.toLowerCase();
    if ([...w].length === 1 || !WORD_OK.test(w) || pairs.has(w)) continue;
    const v = vet(w, norm(ipa));
    if (v === undefined) { stats.rejected++; continue; }
    pairs.set(w, v);
    stats.rcrl++;
}
for (const [word, phones] of nchltRows) {
    if (!word || !phones) continue;
    const w = word.toLowerCase();
    if ([...w].length === 1 || !WORD_OK.test(w) || pairs.has(w)) continue;
    const v = vet(w, norm(phones.trim().split(/\s+/u).map((t) => XSAMPA[t] ?? t).join("")));
    if (v === undefined) { stats.rejected++; continue; }
    pairs.set(w, v);
    stats.nchlt++;
}

// ── 90/10 held-out, by md5 of the WORD — the house policy (nb/da/fr), so the split is stable across runs
// and independent of insertion order. English's frequency-tail policy needs a frequency list, which af lacks.
const rows = [...pairs].map(([w, ipa]) => {
    const held = createHash("md5").update(w).digest("hex").charCodeAt(0) % 10 === 0;
    return `${w}\t${ipa}\t${held ? "test" : "train"}`;
});
writeFileSync(join(HERE, "af-g2p-data.tsv"), `# word\tIPA\tsplit — built by tools/afrikaans/build_af_g2p_data.ts\n${rows.join("\n")}\n`);
const test = rows.filter((r) => r.endsWith("test")).length;
console.log(`long vowels neither source can write: ${MISSING_LONG.join(" ") || "(none)"}`);
console.log(`wrote ${rows.length} pairs (RCRL ${stats.rcrl} + NCHLT ${stats.nchlt}; ${stats.rejected} rejected by vetting)`);
console.log(`  train ${rows.length - test}   held-out ${test}`);
