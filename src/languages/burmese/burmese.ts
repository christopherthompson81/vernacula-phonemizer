/**
 * Native Burmese / မြန်မာ (my) text phonemizer — canonical IPA, espeak-independent. Sino-Tibetan, the Mon-Burmese
 * abugida (Unicode U+1000–U+109F), stored in LOGICAL order (consonant-first). The g2p scans each syllable:
 * base consonant → optional MEDIALS (ျ/ြ palatalise velars ကျ→t͡ɕ + the velar nasal ငြ→ɲ, ွ adds -w- / rounds the
 * inherent rime to ʊ, ှ devoices sonorants မှ→m̥) → the RIME, whose vowel quality depends on the CODA — open, NASAL
 * (killed ŋ/ɲ/n/m or anusvara ံ → ɴ) or CHECKED (killed k/s/t/p → ʔ): -i open→i, nasal→ɪɴ, checked→ɪʔ. Then the
 * TONE (orthographic, rule-derived: low ˨ / high ˥˩ / creaky ˥ˀ, checked = the ʔ coda) is inserted after the
 * nucleus. DEFERRED: intervocalic voicing sandhi (lexical) + minor-syllable reduction. See docs/my_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { clauseSink } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { segmentByDag, loadSegWords } from "../../core/segment.ts";

interface BurmeseDef {
    consonants: Record<string, string>;
    independentVowels: Record<string, string>;
    independentTone: Record<string, string>;
    vowelSigns: Record<string, string>;
    codaClass: Record<string, string>;
    rimeChart: Record<string, Record<string, string>>;
    tones: Record<string, string>;
    voicing: Record<string, string>;
    voiceless: Record<string, string>;
    palatal: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<BurmeseDef>(import.meta.url, "burmese.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const VIRAMA = "်", // asat (kills the consonant → coda)
    ANUSVARA = "ံ",
    VISARGA = "း", // high-tone mark
    DOT_BELOW = "့", // creaky-tone mark
    MEDIAL_Y = "ျ", MEDIAL_R = "ြ", MEDIAL_W = "ွ", MEDIAL_H = "ှ",
    E_SIGN = "ေ", AA_SIGN = "ာ", AA_TALL = "ါ", II_SHORT = "ိ", II_LONG = "ီ",
    U_SHORT = "ု", U_LONG = "ူ";
const isConsonant = (c: string): boolean => DEF.consonants[c] !== undefined;

/**
 * The Burmese tone (Chao letter) for a syllable — ORTHOGRAPHIC, rule-derivable. Explicit marks win: visarga း →
 * high, dot-below ့ → creaky, an asat on the vowel (ော် ) → low. A CLOSED (nasal-coda) syllable defaults to LOW
 * (ခေါင်→kʰàʊɴ, မြန်→mjàɴ). For an OPEN syllable the default is by vowel: ◌ော/◌ဲ → high; a bare inherent vowel or
 * a SHORT ◌ိ/◌ု → creaky; everything else (long ◌ီ/◌ူ, ◌ာ, ◌ေ, ◌ို) → low. A CHECKED syllable (ʔ coda) and a
 * reduced minor syllable carry no tone letter (returns "").
 */
function toneLetter(
    vowel: string, signs: string[], coda: string, checked: boolean,
    asatOnVowel: boolean, hasVisarga: boolean, hasDot: boolean,
): string {
    if (checked) return "";
    const has = (x: string): boolean => signs.includes(x);
    let cat: string;
    if (hasVisarga) cat = "high";
    else if (hasDot) cat = "creaky";
    else if (asatOnVowel) cat = "low"; // ော် (the asat-on-au low-tone marker)
    else if (coda !== "open") cat = "low"; // all closed (nasal) syllables default low — the diphthong is low
    else if (vowel === "au" || vowel === "ai") cat = "high";
    else if (vowel === "inherent" || vowel === "wu") cat = "creaky";
    else if (has(II_SHORT) && !has(U_SHORT)) cat = "creaky"; // short ◌ိ (ို=o has both → falls through to low)
    else if (has(U_SHORT) && !has(II_SHORT)) cat = "creaky"; // short ◌ု
    else cat = "low"; // long ◌ီ/◌ူ, ◌ာ/ါ, ◌ေ, ◌ို
    return DEF.tones[cat]!;
}

/** One syllable: the ONSET (voiceable) + the BODY (glide + rime + tone), plus `start` — the code-point index in
 *  the NFC word where the syllable begins (a legal word-boundary for segmentation). Split so the voicing lexicon
 *  can target the onset without re-parsing. */
interface Syllable { onset: string; body: string; start: number }

/** Scan a Burmese word into syllables (onset + body + start). Exposed for the voicing-lexicon builder + segmenter. */
export function syllabify(word: string): Syllable[] {
    const s = [...word.normalize("NFC")];
    const n = s.length;
    const syls: Syllable[] = [];
    let i = 0;
    let pending = -1; // a skipped stacked upper member (ကမ္ဘာ's မ) belongs to the NEXT syllable → its boundary

    while (i < n) {
        const ch = s[i]!;
        if (DEF.independentVowels[ch] !== undefined) {
            // Standalone vowel (ʔ-onset): its default tone, with a trailing visarga း → high / dot-below ့ → creaky.
            // (Rare independent-vowel + killed-consonant coda, ဣန်, is left to the next-syllable scan — a known gap.)
            const start = pending >= 0 ? pending : i;
            pending = -1;
            i++;
            let cat = DEF.independentTone[ch] ?? "low";
            while (i < n && (s[i] === VISARGA || s[i] === DOT_BELOW)) {
                cat = s[i] === VISARGA ? "high" : "creaky";
                i++;
            }
            syls.push({ onset: "", body: DEF.independentVowels[ch]! + (DEF.tones[cat] ?? ""), start });
            continue;
        }
        if (!isConsonant(ch)) {
            pending = -1; // a stray sign ends any pending stacked-conjunct carry
            i++; // punctuation handled by text(); stray sign → skip
            continue;
        }
        // Stacked consonant: a consonant directly before the virama-stacker ္ (U+1039) is the silent upper member
        // of a Pali/Sanskrit conjunct (ကမ္ဘာ → the မ is silent, ဘ is the onset) — skip it and the stacker.
        if (s[i + 1] === "္") {
            if (pending < 0) pending = i;
            i += 2;
            continue;
        }
        // Onset consonant.
        const start = pending >= 0 ? pending : i;
        pending = -1;
        let onset = DEF.consonants[ch]!;
        i++;
        // Medials: ျ/ြ palatalise (velars → t͡ɕ) else add -j-; ွ labialises; ှ devoices the sonorant.
        let glide = "";
        let wMedial = false;
        while (i < n && [MEDIAL_Y, MEDIAL_R, MEDIAL_W, MEDIAL_H].includes(s[i]!)) {
            if (s[i] === MEDIAL_Y || s[i] === MEDIAL_R)
                onset = DEF.palatal[onset] ?? onset + "j";
            else if (s[i] === MEDIAL_W) wMedial = true;
            else if (s[i] === MEDIAL_H) onset = DEF.voiceless[onset] ?? onset;
            i++;
        }
        // Vowel signs → an abstract vowel KEY. Combos: ိ+ု = o, ေ+ာ = au (else the last sign, or inherent).
        const signs: string[] = [];
        while (i < n && DEF.vowelSigns[s[i]!] !== undefined) {
            signs.push(s[i]!);
            i++;
        }
        const has = (x: string): boolean => signs.includes(x);
        let vowel = "inherent";
        if (has(II_SHORT) && has(U_SHORT)) vowel = "o"; // ို
        else if (has(E_SIGN) && (has(AA_SIGN) || has(AA_TALL))) vowel = "au"; // ော / ေါ (tall-aa variant U+102B)
        else if (signs.length) vowel = DEF.vowelSigns[signs[signs.length - 1]!]!;
        // A ⟨ွ⟩ medial with a vowel sign is a plain -w- glide (ကွေ→kwe).
        if (wMedial && vowel !== "inherent") glide = "w";
        // Coda class: anusvara ံ (nasal 'anu'), a killed consonant (base + ်) → its class, else open. An asat ်
        // directly on a vowel (ော်) is a low-TONE marker, NOT a checked coda (ကျော်→t͡ɕɔ̀).
        let coda = "open";
        let asatOnVowel = false;
        if (s[i] === ANUSVARA) {
            coda = "anu";
            i++;
        } else if (isConsonant(s[i] ?? "") && (s[i + 1] === VIRAMA || s[i + 1] === DOT_BELOW && s[i + 2] === VIRAMA)) {
            // killed consonant (the dot-below creaky mark may sit between the coda letter and its asat: ကန့်).
            coda = DEF.codaClass[s[i]!] ?? "t";
            i += s[i + 1] === VIRAMA ? 2 : 1; // leave the dot for the tone-mark scan below
        } else if (s[i] === VIRAMA) {
            asatOnVowel = true;
            i++;
        }
        // ⟨ွ⟩ / a /w/ onset (ဝ) on an inherent-vowel syllable: it ROUNDS the rime to ʊ (ကွန်→kʊɴ, ဝန်→wʊɴ,
        // လွတ်→lʊʔ) — EXCEPT before the velar-nasal -ng coda (င်), where the front rime blocks rounding and ⟨ွ⟩
        // stays a -w- glide (လွင်→lwɪɴ, ဝင်→wɪɴ). Coda-specific, so decided after the coda is known.
        if (vowel === "inherent" && (wMedial || onset === "w")) {
            if (coda === "ng") { if (wMedial) glide = "w"; } // keep the glide, inherent rime → wɪɴ
            else vowel = "wu"; // round: ʊɴ / ʊʔ
        }
        // Explicit tone marks (visarga း = high, dot-below ့ = creaky) — may trail the coda, in either order — plus
        // any stray combining sign. Capture the tone marks; skip the rest.
        let hasVisarga = false, hasDot = false;
        while (i < n && !isConsonant(s[i]!) && DEF.independentVowels[s[i]!] === undefined && !CLAUSE_MARK[s[i]!]) {
            if (s[i] === VISARGA) hasVisarga = true;
            else if (s[i] === DOT_BELOW) hasDot = true;
            i++;
        }

        // A bare open syllable (inherent vowel, no coda) that is NOT word-final is a MINOR syllable → reduced [ə]
        // (toneless). Otherwise look up the rime and insert the tone letter after the nucleus, before a ɴ/ʔ coda.
        const minor =
            vowel === "inherent" && coda === "open" && i < n && isConsonant(s[i]!);
        if (minor) {
            syls.push({ onset, body: glide + "ə", start });
            continue;
        }
        const rime = DEF.rimeChart[coda]?.[vowel] ?? DEF.rimeChart["open"]![vowel] ?? "a";
        const checked = rime.endsWith("ʔ");
        const tone = toneLetter(vowel, signs, coda, checked, asatOnVowel, hasVisarga, hasDot);
        const codaChar = /[ɴʔ]$/u.test(rime) ? rime.slice(-1) : "";
        const nucleus = codaChar ? rime.slice(0, -codaChar.length) : rime;
        syls.push({ onset, body: glide + nucleus + tone + codaChar, start });
    }
    return syls;
}

// Intervocalic voicing sandhi (LEXICAL): the per-word `voicing-lexicon.tsv` maps an undiacritized word to a
// per-syllable flag string ('1' = voice this syllable's onset, via DEF.voicing). Built from the kaikki gold
// (tools/build-my-voicing.ts); OOV words keep the careful (voiceless) reading — the pass only ADDS voicing.
// The flags are POSITIONAL (index-aligned to syllabify()), so a change to syllabify() requires REBUILDING the
// lexicon — a misalignment surfaces as a referee-eval drop (guarded by the my floor in referee-eval.test.ts).
const VOICE = DEF.voicing;
// Lazy: registry.ts imports every language eagerly; the ~1.3k-row TSV is only read on first Burmese use.
let VOICING_LEXICON: ReadonlyMap<string, string> | undefined;
function voicingLexicon(): ReadonlyMap<string, string> {
    return (VOICING_LEXICON ??= loadTsvMap(import.meta.url, "voicing-lexicon.tsv", undefined, { optional: true }));
}

/** One segmented Burmese WORD → canonical IPA (syllabify + orthographic tone + lexical voicing sandhi). */
function phonemizeSubword(word: string): string {
    const nfc = word.normalize("NFC");
    const syls = syllabify(nfc);
    const flags = voicingLexicon().get(nfc);
    if (flags) {
        for (let k = 0; k < syls.length && k < flags.length; k++) {
            if (flags[k] === "1") {
                const v = VOICE[syls[k]!.onset];
                if (v) syls[k]!.onset = v;
            }
        }
    }
    return syls.map((s) => s.onset + s.body).join("").normalize("NFC");
}

// Word SEGMENTATION: Burmese is spaceless, so a text run is one token that must be split into words before the
// per-word voicing lexicon can fire. DAG maximal-match over seg-words.txt (multi-σ headwords), with word
// boundaries constrained to SYLLABLE starts (syllabify().start). Lazy-loaded. A single word segments to itself
// (so the per-word referee eval is unaffected); an unknown run coalesces into one token and still phonemizes.
let SEG: { set: Set<string>; maxLen: number } | undefined;
function segWords(): { set: Set<string>; maxLen: number } {
    return (SEG ??= loadSegWords(import.meta.url));
}
/**
 * Segment a spaceless Burmese run into words. Word boundaries are constrained to syllable starts (so the DAG never
 * splits mid-syllable). A FULL dictionary cover (every part is a known word) is trusted and split — the per-word
 * voicing lexicon then applies (like Thai). A PARTIAL cover (a dict word next to an OOV remainder) is the risky
 * case: peeling the OOV fragment and re-syllabifying it standalone can make a would-be word-internal MINOR syllable
 * word-final and lose its [ə] (ကစကား → the leading က must stay reduced kə, not become full ka). For those we accept
 * the split ONLY if it preserves every syllable BODY (whole-run vs concatenated per-part), else keep the run WHOLE.
 * So segmentation only ever IMPROVES the segmental output, never regresses it.
 */
export function segment(token: string): string[] {
    const { set, maxLen } = segWords();
    const cs = [...token.normalize("NFC")];
    if (set.size === 0 || cs.length === 0) return [token];
    const sylls = syllabify(cs.join("")); // whole-run pass, reused for both the boundaries and the safety check
    const bound = new Set<number>([cs.length]);
    for (const syl of sylls) bound.add(syl.start);
    const parts = segmentByDag(cs, set, maxLen, bound);
    if (parts.length <= 1 || parts.every((w) => set.has(w))) return parts; // single word, or a full dictionary cover
    const whole = sylls.map((s) => s.body).join("");
    const split = parts.flatMap((p) => syllabify(p).map((s) => s.body)).join("");
    return whole === split ? parts : [token]; // split changes a syllable body (lost minor-ə) → keep whole
}

/** One Burmese TOKEN → IPA: segment the spaceless run into words, phonemize each (voicing per word), space-join. */
export function phonemizeWord(token: string): string {
    return segment(token).map(phonemizeSubword).filter((w) => w !== "").join(" ");
}

const TOKEN = /([က-႟꧰-꧹]+)|(\d+)|([။၊.?!,])/gu;

export type ForeignPhonemizer = (latin: string) => string;

class BurmesePhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        const { sink, finish } = clauseSink();
        let m: RegExpExecArray | null;
        const tok = new RegExp(TOKEN.source, "gu");
        while ((m = tok.exec(input))) {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(this.foreign ? this.foreign(m[2]) : m[2]);
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        }
        return finish();
    }
}

/** Build the Burmese phonemizer. */
export function createBurmese(foreign?: ForeignPhonemizer): Phonemizer {
    return new BurmesePhonemizer(foreign);
}
