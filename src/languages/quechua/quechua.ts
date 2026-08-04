/**
 * Quechua (qu) phonemizer — Southern Quechua / Runasimi (Qhichwa; Cusco-Collao + Ayacucho), Latin script, canonical
 * IPA, espeak-independent. The fleet's first Quechuan language. Near-phonemic: a 3-vowel system ⟨a i u⟩ and a
 * THREE-WAY stop series written overtly — plain ⟨p t k q ch⟩, aspirated with ⟨h⟩ (⟨ph th kh qh chh⟩), ejective with
 * an apostrophe (⟨p' t' k' q' ch'⟩); uvular ⟨q⟩→[q]. A longest-match scan (tri/digraphs before single graphemes)
 * suffices, then regular PENULTIMATE stress (the onset of the penult syllable). Apostrophes (ʼ ' ') are normalised
 * to U+0027 before the scan. See docs/investigations/qu_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

interface QuechuaDef {
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<QuechuaDef>(import.meta.url, "quechua.jsonc");
const DIGRAPHS = DEF.digraphs;
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
const ORDER = Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length);
const VOWEL = new Set(["a", "e", "i", "o", "u"]);

/** Phonemize one Quechua word → canonical IPA: longest-match scan + penultimate stress. */
export function phonemizeWord(word: string): string {
    // Normalise the three apostrophe glyphs (modifier ʼ / curly ’ / ASCII ') so the ejective digraphs match.
    const w = word.normalize("NFC").toLowerCase().replace(/[ʼ’‘]/gu, "'");
    const segs: string[] = [];
    let i = 0;
    outer: while (i < w.length) {
        for (const key of ORDER) {
            if (w.startsWith(key, i)) { segs.push(DIGRAPHS[key]!); i += key.length; continue outer; }
        }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
        // Consulted AFTER every digraph and single-letter rule, so it cannot override this language (#663).
        const ph = G[w[i]!] ?? latinPhone(w[i]!, { initial: i === 0 });
        if (ph !== undefined) segs.push(ph);
        i += 1;
    }
    // Regular penultimate stress: ˈ before the onset of the penultimate syllable (the second-to-last vowel, or the
    // sole vowel of a monosyllable). Quechua onsets are a single consonant, so back up at most one segment.
    const vidx = segs.map((s, idx) => (VOWEL.has(s) ? idx : -1)).filter((x) => x >= 0);
    if (vidx.length) {
        const nucleus = vidx.length >= 2 ? vidx[vidx.length - 2]! : vidx[0]!;
        const at = nucleus > 0 && !VOWEL.has(segs[nucleus - 1]!) ? nucleus - 1 : nucleus;
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("").normalize("NFC");
}

// A word (Quechua Latin letters incl. ñ + the apostrophe glyphs for ejectives) / number / punctuation.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'’ʼ‘-")})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-zñşA-ZÑŞ'’ʼ‘-]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class QuechuaPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Quechua phonemizer (direct 3-vowel phonemic g2p + the aspirate/ejective series + penultimate stress). */
export function createQuechua(): Phonemizer {
    return new QuechuaPhonemizer();
}
