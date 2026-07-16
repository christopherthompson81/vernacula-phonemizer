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

interface BurmeseDef {
    consonants: Record<string, string>;
    independentVowels: Record<string, string>;
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

/** One syllable: the ONSET (voiceable) + the BODY (glide + rime + tone). Kept split so the voicing lexicon can
 *  target the onset without re-parsing. */
interface Syllable { onset: string; body: string; }

/** Scan a Burmese word into syllables (onset + body). Exposed for the voicing-lexicon builder. */
export function syllabify(word: string): Syllable[] {
    const s = [...word.normalize("NFC")];
    const n = s.length;
    const syls: Syllable[] = [];
    let i = 0;

    while (i < n) {
        const ch = s[i]!;
        if (DEF.independentVowels[ch] !== undefined) {
            syls.push({ onset: "", body: DEF.independentVowels[ch]! });
            i++;
            continue;
        }
        if (!isConsonant(ch)) {
            i++; // punctuation handled by text(); stray sign → skip
            continue;
        }
        // Stacked consonant: a consonant directly before the virama-stacker ္ (U+1039) is the silent upper member
        // of a Pali/Sanskrit conjunct (ကမ္ဘာ → the မ is silent, ဘ is the onset) — skip it and the stacker.
        if (s[i + 1] === "္") {
            i += 2;
            continue;
        }
        // Onset consonant.
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
            syls.push({ onset, body: glide + "ə" });
            continue;
        }
        const rime = DEF.rimeChart[coda]?.[vowel] ?? DEF.rimeChart["open"]![vowel] ?? "a";
        const checked = rime.endsWith("ʔ");
        const tone = toneLetter(vowel, signs, coda, checked, asatOnVowel, hasVisarga, hasDot);
        const codaChar = /[ɴʔ]$/u.test(rime) ? rime.slice(-1) : "";
        const nucleus = codaChar ? rime.slice(0, -codaChar.length) : rime;
        syls.push({ onset, body: glide + nucleus + tone + codaChar });
    }
    return syls;
}

// Intervocalic voicing sandhi (LEXICAL): the per-word `voicing-lexicon.tsv` maps an undiacritized word to a
// per-syllable flag string ('1' = voice this syllable's onset). Built from the kaikki gold (tools/build-my-voicing
// .ts); OOV words keep the careful (voiceless) reading — the pass only ADDS voicing, never removes it.
const VOICE = DEF.voicing;
const VOICING_LEXICON = loadTsvMap(import.meta.url, "voicing-lexicon.tsv", undefined, { optional: true });

/** One Burmese word → canonical IPA (syllabify + orthographic tone + lexical voicing sandhi). */
export function phonemizeWord(word: string): string {
    const syls = syllabify(word);
    const flags = VOICING_LEXICON.get(word.normalize("NFC"));
    if (flags) {
        for (let k = 0; k < syls.length && k < flags.length; k++) {
            if (flags[k] === "1") {
                const v = VOICE[syls[k]!.onset];
                if (v) syls[k] = { onset: v, body: syls[k]!.body };
            }
        }
    }
    return syls.map((s) => s.onset + s.body).join("").normalize("NFC");
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
        void this.foreign;
        return finish();
    }
}

/** Build the Burmese phonemizer. */
export function createBurmese(foreign?: ForeignPhonemizer): Phonemizer {
    return new BurmesePhonemizer(foreign);
}
