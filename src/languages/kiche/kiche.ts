/**
 * K'iche' (quc) phonemizer — a longest-match grapheme scan over the ALMG orthography, canonical IPA.
 * This file owns the apostrophe-glyph normalisation (so the glottalized units match), multi-word
 * splitting, and FINAL (oxytone) stress placement. The unit/letter tables (the ejective/aspirated
 * series) and the encyclopedic record live in kiche.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

interface KicheDef {
    units: Record<string, string>;
    letters: Record<string, string>;
}
const DEF = loadManifest<KicheDef>(import.meta.url, "kiche.jsonc");
// Grapheme tables (kiche.jsonc): the glottalized/aspirated units (longest-match) and the single letters.
const UNIT = DEF.units;
const G = DEF.letters;
const ORDER = Object.keys(UNIT).sort((a, b) => b.length - a.length);
const VOWEL = new Set(["a", "e", "i", "o", "u", "ə"]);

/** Phonemize a K'iche' word → canonical IPA: longest-match scan + glottal onset + final stress (length not emitted).
 *  A multi-word phrase (some referee headwords) is split so each word gets its own glottal onset + stress. */
export function phonemizeWord(word: string): string {
    if (/\s/u.test(word.trim())) return word.trim().split(/\s+/u).map(phonemizeWord).join(" ");
    // Normalise the apostrophe glyphs (ASCII ' / curly ’ / modifier ʼ) so the glottalized units + glottal stop match.
    const w = word.normalize("NFC").toLowerCase().replace(/['’`]/gu, "ʼ");
    const segs: string[] = [];
    let i = 0;
    outer: while (i < w.length) {
        for (const key of ORDER) {
            if (w.startsWith(key, i)) { segs.push(UNIT[key]!); i += key.length; continue outer; }
        }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
        // Consulted AFTER every digraph and single-letter rule, so it cannot override this language.
        const ph = G[w[i]!] ?? latinPhone(w[i]!, { initial: i === 0 });
        if (ph !== undefined) segs.push(ph);
        i += 1;
    }
    // FINAL (oxytone) stress — the K'iche' default: ˈ before the onset of the last syllable (folded in eval).
    const vidx = segs.map((s, idx) => (VOWEL.has(s) ? idx : -1)).filter((x) => x >= 0);
    if (vidx.length) {
        const nucleus = vidx[vidx.length - 1]!;
        const at = nucleus > 0 && !VOWEL.has(segs[nucleus - 1]!) ? nucleus - 1 : nucleus;
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("").normalize("NFC");
}

// A K'iche' word (Latin + ä + the apostrophe glyphs) / number / punctuation.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'’ʼ`-")})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zäöëïüáéíóúÄÖËÏÜÁÉÍÓÚA-Z'’ʼ`-]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class KicheePhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the K'iche' phonemizer (ALMG grapheme scan + ejective series + aspirated plain stops + final stress). */
export function createKichee(): Phonemizer {
    return new KicheePhonemizer();
}
