/**
 * Native Aromanian / armãneashti (rup) text phonemizer — canonical IPA. Aromanian is an EASTERN
 * ROMANCE (Balkan Romance) language, a close sibling of Romanian, spoken across the Balkans (Greece, Albania, North
 * Macedonia, Romania, Bulgaria; ~250k). A near-phonemic Latin orthography (the Cunia/DIARO system) → a greedy
 * left-to-right scan with the shared Romance contextual phonology plus Aromanian's own digraphs.
 *
 *   ⚠ AROMANIAN DIGRAPHS (not in Romanian, which uses diacritic letters): ⟨ts⟩→[t͡s], ⟨dz⟩→[d͡z] (but [d͡ʒ] in the
 *     ⟨ndz⟩+front-vowel soft-g reflex: sãndze→[sənd͡ʒe]), ⟨sh⟩→[ʃ], ⟨nj⟩→[ɲ], ⟨lj⟩/⟨ll⟩→[ʎ] (palatals), ⟨dh⟩→[ð],
 *     ⟨th⟩→[θ] (the Greek-contact interdentals), ⟨gh⟩→[ɡ], ⟨ch⟩→[k]; ⟨y⟩ (Greek gamma)→[ɣ], NOT the glide [j].
 *   ⚠ ⟨ã⟩ is the single central-vowel letter → [ə] (also realised [ɨ]; the two are not distinguished in the
 *     orthography — folded). The shared Romance rules: ⟨c/g⟩ SOFTEN before ⟨e i⟩ (⟨ce ci⟩→t͡ʃ, ⟨ge gi⟩→d͡ʒ, silent
 *     softener i); RISING DIPHTHONGS ⟨ea⟩→[e̯a], ⟨oa⟩→[o̯a]; the ⟨i u⟩ GLIDES ([j w] next to another vowel). ⟨r⟩→[r].
 *
 * Stress is unwritten (deferred, not emitted); the word-final desyllabified ⟨-u⟩ ([ʷ]/[ŭ]) is emitted as [u].
 * Referee: wikipron rup_latn narrow (196) + kaikki Aromanian (201).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { numberToWords } from "./numbers.ts";

// Digraphs, longest-first (2 letters). ⟨ch gh⟩ are the HARD/fricative dorsals; ⟨ll⟩ = ⟨lj⟩ = [ʎ].
const DIGRAPHS: [string, string][] = [
    ["ts", "t͡s"], ["sh", "ʃ"], ["nj", "ɲ"], ["lj", "ʎ"], ["ll", "ʎ"],
    ["dh", "ð"], ["th", "θ"], ["gh", "ɡ"], ["ch", "k"], // ⟨gh⟩→[ɡ] (matches 2/3 referee vs [ɣ] 1/3; the ɣ~ɡ fold covers it)
    // ⟨dz⟩ is handled specially (the ⟨ndz⟩+front-vowel soft-g reflex → [ndʒ], else [d͡z]).
];
const VOWEL_L = new Set([..."aeiouã"]);
const VOWEL_PH = "aeiouəɨ";
const LETTER: Record<string, string> = {
    "a": "a", "e": "e", "i": "i", "o": "o", "u": "u", "ã": "ə", "â": "ɨ", "î": "ɨ",
    "b": "b", "d": "d", "f": "f", "h": "h", "j": "ʒ", "k": "k", "l": "l", "m": "m", "n": "n",
    "p": "p", "q": "k", "r": "r", "s": "s", "t": "t", "v": "v", "w": "w", "x": "ks", "y": "ɣ", "z": "z",
    "ñ": "ɲ", "ç": "t͡s", // ⟨y⟩ = the Greek-gamma letter → [ɣ] (anyedz→anɣed͡z), NOT the glide [j]
};
const isFront = (x: string | undefined): boolean => x === "e" || x === "i";
const isHigh = (x: string | undefined): boolean => x === "i" || x === "u";

/** One Aromanian word → canonical IPA. */
export function phonemizeWord(word: string): string {
    const s = [...word.normalize("NFC").toLowerCase()];
    const n = s.length;
    const out: string[] = [];
    const prevVowel = (): boolean => out.length > 0 && VOWEL_PH.includes(out[out.length - 1]!.slice(-1));
    for (let i = 0; i < n; i++) {
        const c = s[i]!;
        const nx = s[i + 1];
        const nn = s[i + 2];
        // ⟨dz⟩: [d͡ʒ] in the ⟨ndz⟩ + front-vowel soft-g reflex (sãndze→sɨndʒe, Latin *sanguine*); else [d͡z].
        if (c === "d" && nx === "z") {
            const after = s[i + 2];
            out.push(out[out.length - 1] === "n" && (after === "e" || after === "i") ? "d͡ʒ" : "d͡z");
            i++; continue;
        }
        // Digraphs (ts sh nj lj ll dh th gh ch).
        const dg = DIGRAPHS.find(([k]) => c === k[0] && nx === k[1]);
        if (dg) { out.push(dg[1]); i++; continue; }
        // ⟨c⟩: soften before ⟨e i⟩ → t͡ʃ (⟨ci⟩+V drops the silent i); else [k].
        if (c === "c") {
            if (isFront(nx)) {
                out.push("t͡ʃ");
                if (nx === "i" && nn !== undefined && VOWEL_L.has(nn)) i++; // ⟨ci⟩+V: silent softener i
            } else out.push("k");
            continue;
        }
        // ⟨g⟩: soften before ⟨e i⟩ → d͡ʒ; else [ɡ]. (⟨gh⟩ handled by the digraph table above.)
        if (c === "g") {
            if (isFront(nx)) {
                out.push("d͡ʒ");
                if (nx === "i" && nn !== undefined && VOWEL_L.has(nn)) i++;
            } else out.push("ɡ");
            continue;
        }
        // Vowels: rising diphthongs, final -u desyllabification, i/u glides, then the plain vowel.
        if (VOWEL_L.has(c)) {
            if ((c === "e" || c === "o") && nx === "a") { out.push(c === "e" ? "e̯" : "o̯"); continue; } // ea→e̯a, oa→o̯a
            // WORD-FINAL ⟨-u⟩ (the Latin short -us) DESYLLABIFIES after a SINGLE consonant → dropped ([Cʷ] in the
            // referee): cãntãtoru→[kəntətor], acatsu→[akat͡s]. After a cluster it stays syllabic (amintu→[amintu]).
            if (c === "u" && i === n - 1 && out.length >= 2 &&
                !VOWEL_PH.includes(out[out.length - 1]!.slice(-1)) && VOWEL_PH.includes(out[out.length - 2]!.slice(-1))) {
                continue; // drop the desyllabified final -u
            }
            // Word-final ⟨ie⟩ after a CONSONANT is a HIATUS [i.e] (educatsie→…tsi.e) — keep the ⟨i⟩ syllabic.
            if (c === "i" && nx === "e" && i + 2 === n && !prevVowel()) { out.push("i"); continue; }
            // ⟨i u⟩ glide next to another vowel: OFF-glide after a nucleus (ai→aj), ON-glide before a non-high FULL vowel
            // (ia→ja). NOT before ⟨ã⟩→[ə] (dzuã→[d͡zuə] is a hiatus, not a glide).
            const onglide = nx !== undefined && VOWEL_L.has(nx) && !isHigh(nx) && nx !== "ã";
            if (isHigh(c) && (prevVowel() || onglide)) { out.push(c === "i" ? "j" : "w"); continue; }
            out.push(LETTER[c] ?? c);
            continue;
        }
        const ph = LETTER[c];
        if (ph !== undefined) out.push(ph);
        // else (apostrophe, hyphen, stray marks): skip
    }
    return out.join("");
}

// Aromanian Latin + ⟨ã â î ñ ç⟩. Word / number / punctuation.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.?!,;:…])`, "gu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls.
 *
 * ⚠ NOT QUITE VERBATIM: ä Ä were REMOVED, because the g2p has no rule for them and DROPPED them outright.
 * The old token class listed them anyway, and the word-level fold hid the mismatch — a word containing one was
 * rejected whole, so everything in it got folded and the letter came out readable by accident. Judging each
 * character on its own exposes the over-claim instead of masking it: `Thérèse` in Romanian read *ˈthrese*, the é
 * gone, because the class promised a rule that did not exist. NATIVE_CLASS is a claim about the G2P, and
 * `test/native-inventory.test.ts` now measures it rather than trusting it.
 */
const NATIVE_CLASS = "[a-zãâîñçA-ZÃÂÎÑÇ]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class AromanianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input.normalize("NFC"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // A digit run reads as Aromanian number WORDS, each phonemized like any other word.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Aromanian phonemizer (Cunia-orthography scan + Romance c/g softening, diphthongs, glides). */
export function createAromanian(): Phonemizer {
    return new AromanianPhonemizer();
}
