/**
 * European Portuguese (pt-PT) grapheme→phoneme engine. Portuguese orthography is largely rule-governed, so
 * this is a left-to-right scan producing a segment list (phoneme + nucleus/accent flags + the raw vowel), then
 * a stress pass, then the EP-signature vowel-REDUCTION pass (unstressed a→ɐ, e→ɨ, o→u). Stressed mid-vowel
 * quality (open ɛ/ɔ vs close e/o on bare e/o) and grapheme x are the partly-lexical residuals.
 * No lexicon (yet).
 */

import { MANIFEST } from "./manifest.ts";
import { latinPhone } from "../../core/latinPhones.ts";

// Accent classes + letter sets are DATA (portuguese.jsonc).
const ACCENTED = MANIFEST.accents.toBase; // accented vowel → base letter
const ACUTE_GRAVE = MANIFEST.accents.acuteGrave; // open/explicit-stress accents
const CIRCUMFLEX = MANIFEST.accents.circumflex; // close-quality stressed
const TILDE = MANIFEST.accents.tilde; // nasal
const VOWELS = MANIFEST.vowelLetters;
const FRONT = MANIFEST.frontLetters; // soften c/g
const VOWEL_IPA = MANIFEST.vowelIpa; // vowel letter → stressed IPA realization

const isV = (c: string): boolean => c !== "" && VOWELS.includes(c);
const isFront = (c: string): boolean => c !== "" && FRONT.includes(c);
const base = (c: string): string => ACCENTED[c] ?? c;

export interface Seg {
    ph: string; // IPA (for a vowel: its STRESSED realization; reduction may rewrite it)
    nucleus: boolean; // is a syllable nucleus (a vowel, not a glide)
    accent: boolean; // bears a written accent (á é í ó ú â ê ô ã õ) → lexically stressed
    raw: string; // the source vowel letter (base, unaccented) — drives reduction; "" for consonants
    nasal: boolean; // nasalized nucleus
}

/** Stressed IPA realization of a vowel from its letter (VOWEL_IPA table). Bare e/o default to close e/o. */
const vowelIpa = (ch: string): string => VOWEL_IPA[ch] ?? ch;

const pushV = (segs: Seg[], ch: string, nasal: boolean): void => {
    segs.push({
        ph: vowelIpa(ch),
        nucleus: true,
        accent: ACUTE_GRAVE.includes(ch) || CIRCUMFLEX.includes(ch),
        raw: base(ch),
        nasal,
    });
};
const pushGlide = (segs: Seg[], ph: string, nasal: boolean): void => {
    segs.push({ ph, nucleus: false, accent: false, raw: "", nasal });
};
const pushC = (segs: Seg[], ph: string): void => {
    segs.push({ ph, nucleus: false, accent: false, raw: "", nasal: false });
};

/** A vowel is nasalized if it is written with a tilde, or followed by m/n that is a coda (not before a vowel).
 *  The n of an nh digraph (senhora) is NOT a coda nasal — it stays the ɲ onset of the next syllable. */
function nasalizedHere(w: string, vi: number): boolean {
    const c = w[vi]!;
    if (TILDE.includes(c)) return true;
    const nx = w[vi + 1] ?? "";
    if (nx !== "m" && nx !== "n") return false;
    const after = w[vi + 2] ?? "";
    if (nx === "n" && after === "h") return false; // nh digraph → ɲ, not a nasal coda
    return after === "" || !isV(after); // m/n before a consonant or word-end → nasal coda
}

/**
 * Every letter this scan has a rule for — Portuguese's own alphabet, its five accents, and ⟨ñ⟩ (below).
 * ⚠ ⟨ü⟩ IS IN IT because `vowelLetters` is: the trema survived in Brazilian spelling until 2009 and the corpus
 * still writes it.
 */
const KNOWN_LETTERS = new Set([...VOWELS, ..."bcçdfghjklmnñpqrstvwxz"]);

/**
 * ⚠ ⟨y⟩ IS THE ONE ASCII LETTER THIS SCAN HAS NO CASE FOR, and it is a VOWEL letter in the words Portuguese
 * borrows it in — so it folds to ⟨i⟩, the letter Portuguese itself uses for that sound (the 1911/1943
 * orthographies replaced Greek-derived ⟨y⟩ with ⟨i⟩ throughout: *yoga* → ioga, *Yeda* → Ieda). That puts it
 * through the ordinary ⟨i⟩ machinery, including the glide rule before another vowel:
 *
 *     Vichy → viʃi     curry → kuʁi     Madhya → madjɐ      (all three were *viʃ, *kuʁ, *madɐ)
 *
 * ⚠ NOT LEFT TO THE SHARED TABLE, which says /j/ — the consonantal value, right for German and English and
 * wrong for every Portuguese reading of the letter. `curry` → *kuʁj is a worse answer than the deletion it
 * replaces, which is the Chichewa ⟨cm⟩ → "kilometres" lesson: a fallback that fires where the language does
 * have an opinion is not an improvement.
 */
const FOREIGN_LETTER: Readonly<Record<string, string>> = { y: "i" };

/**
 * ⚠ A LETTER FROM SOMEONE ELSE'S ORTHOGRAPHY IS READ AS ITS BASE, NOT DELETED.
 *
 * The scan's `default:` used to drop anything it had no case for, and a foreign vowel is exactly that: ⟨è⟩ and
 * ⟨ï⟩ are not Portuguese accents, so `naïve` came out *nˈavɨ* and `Klöcker` *kɫkkˈeɾ* — a syllable short, with
 * two consonants welded together. Folding the marks away first makes each one the vowel it sits on, and the
 * whole vowel machinery downstream (nasalization lookahead, the falling-diphthong test, reduction, stress)
 * then sees an ordinary vowel instead of a character it must skip.
 *
 * ⚠ ONE CHARACTER FOR ONE CHARACTER, so every index, lookahead and `atEnd` test below still refers to the same
 * position it did before. A letter with no decomposition (ß, æ, ð) is left alone here and handled at the
 * `default:` branch, which is also where a non-letter goes.
 *
 * ⚠ AND ⟨ñ⟩ IS EXCLUDED FROM THE FOLD ON PURPOSE — it is in `KNOWN_LETTERS` and has its own case. Portuguese
 * has /ɲ/ and writes it ⟨nh⟩, so reading the Spanish letter as /n/ would discard a sound this language makes
 * daily (`Cañitas`, `señor`, `El Niño`). Same decision as Tagalog's ⟨ñ⟩, pinned in test/latin-tokenizers.
 */
function foldForeignLetters(w: string): string {
    if ([...w].every((c) => KNOWN_LETTERS.has(c))) return w; // the overwhelmingly common case: no work
    return [...w]
        .map((c) => {
            if (KNOWN_LETTERS.has(c)) return c;
            const named = FOREIGN_LETTER[c];
            if (named !== undefined) return named;
            const b = c.normalize("NFD").replace(/\p{M}+/gu, "");
            return FOREIGN_LETTER[b] ?? (b.length === 1 && KNOWN_LETTERS.has(b) ? b : c);
        })
        .join("");
}

/** Scan a lowercased word into segments (consonants realized in place; vowels get stressed-quality IPA).
 *  `dialect` only affects the word-final -em nucleus (EP [ɐ̃j̃] vs BP [ẽj̃]); everything else is shared. */
export function toSegments(word: string, dialect: "ep" | "bp" = "ep"): Seg[] {
    const w = foldForeignLetters(word.toLowerCase());
    const n = w.length;
    const segs: Seg[] = [];
    let i = 0;

    while (i < n) {
        const c = w[i]!;
        const nx = w[i + 1] ?? "";
        const nx2 = w[i + 2] ?? "";

        // Consonant digraphs.
        if (c === "c" && nx === "h") {
            pushC(segs, "ʃ");
            i += 2;
            continue;
        }
        if (c === "l" && nx === "h") {
            pushC(segs, "ʎ");
            i += 2;
            continue;
        }
        if (c === "n" && nx === "h") {
            pushC(segs, "ɲ");
            i += 2;
            continue;
        }
        if (c === "r" && nx === "r") {
            pushC(segs, "ʁ");
            i += 2;
            continue;
        }
        if (c === "s" && nx === "s") {
            pushC(segs, "s");
            i += 2;
            continue;
        } // massa → masɐ
        if (c === "q" && nx === "u") {
            pushC(segs, "k");
            if (!isFront(nx2)) pushGlide(segs, "w", false);
            i += 2;
            continue;
        } // que/qui→k; qua/quo→kw
        if (c === "g" && nx === "u" && isFront(nx2)) {
            pushC(segs, "ɡ");
            i += 2;
            continue;
        } // gue/gui→ɡ (u silent)

        if (isV(c)) {
            // Vowel (nucleus). Nasal diphthongs and offglides handled by look-ahead.
            const nasal = nasalizedHere(w, i);
            // Word-final -m nasal endings: -am/-em → the diphthongs ɐ̃w̃ / ɐ̃j̃ (falam, homem, também); -om/-im/-um →
            // simple nasal vowels (bom → bõ, sim → sĩ, um → ũ).
            if (
                nx === "m" &&
                nx2 === "" &&
                (c === "a" || c === "á" || c === "e" || c === "é")
            ) {
                const acc = ACUTE_GRAVE.includes(c); // á/é keep the stress; plain a/e stay unstressable
                const isE = c === "e" || c === "é";
                segs.push({
                    // -am → [ɐ̃w̃] in both; -em → EP [ɐ̃j̃] but BP [ẽj̃] (tem → tẽj̃, homem → omẽj̃, viagem → viaʒẽj̃).
                    ph: isE && dialect === "bp" ? "e" : "ɐ",
                    nucleus: true,
                    accent: acc,
                    raw: isE ? "e" : "a",
                    nasal: true,
                });
                pushGlide(segs, c === "a" || c === "á" ? "w̃" : "j̃", true);
                i += 2;
                continue;
            }
            // ou → monophthong [o] (standard EP: souto → sotu, amou → ɐmo), not a diphthong. raw="" so it does NOT
            // further reduce to u when unstressed (ouvir → oviɾ).
            if (c === "o" && nx === "u" && !nasal) {
                segs.push({
                    ph: "o",
                    nucleus: true,
                    accent: false,
                    raw: "",
                    nasal: false,
                });
                i += 2;
                continue;
            }
            // Nasal diphthongs: ão/ãe/õe (+ optional final s).
            if (c === "ã" && nx === "o") {
                pushV(segs, "ã", true);
                pushGlide(segs, "w̃", true);
                i += 2;
                continue;
            }
            if (c === "ã" && nx === "e") {
                pushV(segs, "ã", true);
                pushGlide(segs, "j̃", true);
                i += 2;
                continue;
            }
            if (c === "õ" && nx === "e") {
                pushV(segs, "õ", true);
                pushGlide(segs, "j̃", true);
                i += 2;
                continue;
            }
            pushV(segs, c, nasal);
            i++;
            // Absorb a coda nasal m/n that nasalized this vowel (it is not itself pronounced).
            if (nasal && (nx === "m" || nx === "n")) i++;
            // Oral offglide: a following unaccented i/u forms a falling diphthong (pai → paj, mau → maw, baixo → bajʃu)
            // — EXCEPT when it is a stressed hiatus nucleus, signalled by a final consonant other than s (raiz → ʁɐiʃ,
            // sair → sɐiɾ, possuir → pusuiɾ; but mais/dois keep the glide). The mais-vs-raiz split is otherwise lexical.
            const g = w[i] ?? "";
            const after = w[i + 1] ?? "";
            const hiatus =
                after !== "" &&
                after !== "s" &&
                !isV(after) &&
                (w[i + 2] ?? "") === ""; // i/u + final C(≠s)
            const accentedNext = after !== "" && "áàâãéêíóôõúü".includes(after); // guard ""; i/u before an accented vowel is hiatus (miúdo)
            // falling diphthong: i/u after a vowel, even before another (unaccented) vowel (praia → pɾajɐ, raio → ʁaju)
            if ((g === "i" || g === "u") && !hiatus && !accentedNext) {
                pushGlide(segs, g === "i" ? "j" : "w", false);
                i++;
            }
            continue;
        }

        // Single consonants (context-sensitive ones resolved downstream where they need neighbours).
        switch (c) {
            case "b":
                pushC(segs, "b");
                break;
            case "c":
                pushC(segs, isFront(nx) ? "s" : "k");
                break;
            case "ç":
                pushC(segs, "s");
                break;
            case "ñ":
                // Not a Portuguese letter, but Portuguese has the sound and spells it ⟨nh⟩ — so the Spanish
                // names its own corpus quotes (`Cañitas`) read with the palatal rather than losing it.
                pushC(segs, "ɲ");
                break;
            case "d":
                pushC(segs, "d");
                break;
            case "f":
                pushC(segs, "f");
                break;
            case "g":
                pushC(segs, isFront(nx) ? "ʒ" : "ɡ");
                break;
            case "h":
                break; // silent
            case "j":
                pushC(segs, "ʒ");
                break;
            case "k":
                pushC(segs, "k");
                break;
            case "l":
                pushC(segs, nx === "" || !isV(nx) ? "ɫ" : "l");
                break; // coda l → velarized ɫ
            case "m":
                pushC(segs, "m");
                break;
            case "n":
                pushC(segs, "n");
                break;
            case "p":
                pushC(segs, "p");
                break;
            case "q":
                pushC(segs, "k");
                break;
            case "r": {
                const prev = w[i - 1] ?? "";
                const strong =
                    i === 0 || prev === "n" || prev === "l" || prev === "s"; // initial / after n,l,s → ʁ
                pushC(segs, strong ? "ʁ" : "ɾ");
                break;
            }
            case "s":
                segs.push({
                    ph: "s",
                    nucleus: false,
                    accent: false,
                    raw: "s",
                    nasal: false,
                });
                break; // raw="s": voiceable
            case "t":
                pushC(segs, "t");
                break;
            case "v":
                pushC(segs, "v");
                break;
            case "w":
                pushC(segs, "v");
                break;
            case "x":
                segs.push({
                    ph: "ʃ",
                    nucleus: false,
                    accent: false,
                    raw: "x",
                    nasal: false,
                });
                break; // default ʃ; raw="x" so the lexicon can override to s/z/ks
            case "z":
                pushC(segs, "z");
                break; // coda → ʃ/ʒ downstream
            default: {
                // What is left has no decomposition to fold (ß, æ, ð, þ) — the shared table names the phone
                // each of those letters denotes. Non-letters return `undefined` and are still skipped.
                const ph = latinPhone(c, { initial: i === 0 });
                if (ph !== undefined) pushC(segs, ph);
                break;
            }
        }
        i++;
    }
    return segs;
}

const isVowelPh = (ph: string): boolean => /[aɐɛeiɔouɨ]/.test(ph);

/** s/z realization by position: a single intervocalic s → z; any coda s/z → the coda sibilant (before voiceless /
 *  word-final) or its voiced pair (before a voiced consonant). ç, ss, soft-c and x are fixed /s/ or /ʃ/ (raw≠"s")
 *  and do not voice. The coda sibilant is postalveolar ʃ/ʒ in EP but ALVEOLAR s/z in (standard/paulistano) BP
 *  (luz → EP luʃ / BP lus; mesmo → EP meʒmu / BP mezmu) — the `dialect` selects the pair. */
const VOICED = new Set(MANIFEST.voicedConsonants);
export function sibilants(segs: Seg[], dialect: "ep" | "bp" = "ep"): void {
    const [coda, codaVoiced] = dialect === "bp" ? ["s", "z"] : ["ʃ", "ʒ"];
    for (let i = 0; i < segs.length; i++) {
        const s = segs[i]!;
        if (s.ph !== "s" && s.ph !== "z") continue;
        const prev = segs[i - 1];
        const next = segs[i + 1];
        const prevV = prev && (prev.nucleus || isVowelPh(prev.ph));
        const nextV = next && (next.nucleus || isVowelPh(next.ph));
        if (nextV) {
            // onset / intervocalic
            if (prevV && !prev!.nasal && s.raw === "s") s.ph = "z"; // single s voices (casa → kazɐ); NOT after a
            continue; // nasal vowel (sansão → sɐ̃sɐ̃w̃) — an absorbed
        } // coda n precedes it. ç/ss/initial s stay s.
        s.ph = !next ? coda : VOICED.has(next.ph) ? codaVoiced : coda; // coda → ʃ/ʒ (EP) or s/z (BP)
    }
}
