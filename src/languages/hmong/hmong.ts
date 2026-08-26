/**
 * Hmong (hmn) — White Hmong / Hmoob Dawb (Hmong Daw, mww), Hmong-Mien, tonal (~8M, SW China / SE Asia / diaspora).
 * This phonemizer consumes the **Romanized Popular Alphabet (RPA)** — the community-standard phonemic Latin
 * orthography — and converts it to canonical IPA. RPA has NO coda consonants, so a word-final consonant letter is
 * ALWAYS a TONE marker (⟨b j v s g m d⟩; no final letter = the mid tone). The converter: strip the final tone letter
 * → tone, then [onset] (longest multigraph match) + rime → IPA + a Chao tone letter. ⟨tx x⟩ PALATALISE to [t͡ɕ ɕ]
 * before /i/; a vowel-initial syllable gets a glottal onset [ʔ]. The rich onset system — prenasalised (np→ᵐb,
 * nts→ᶯd͡ʐ), voiceless sonorants (hm→m̥, hl→l̥), retroflex (r→ʈ, ts→t͡ʂ), uvular (q) — lives in hmong.jsonc.
 * Nasal vowels ⟨ee oo⟩→[ẽ ɒ̃]. Maps derived from the wikipron mww_latn_broad referee (~470 pairs) + the documented
 * RPA tables. ⚠ SINGLE-SOURCE AND THIN: one reference, few forms, so agreement with it proves little.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses, type ClauseSink, emitUnclaimed } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToHmongWords } from "./numbers.ts";
import { normalizeHmong } from "./normalize.ts";

interface HmongDef {
    initials: Record<string, string>;
    palatalBeforeI: Record<string, string>; // ⟨tx x⟩ → [t͡ɕ ɕ] before /i/
    rimes: Record<string, string>;
    toneLetter: Record<string, string>; // RPA final tone letter → tone number
    toneChao: Record<string, string>; // tone number → Chao contour letters
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<HmongDef>(import.meta.url, "hmong.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
// Onsets tried longest-first so ⟨ntsh⟩ beats ⟨nts⟩ beats ⟨nt⟩ beats ⟨n⟩, etc.
const INITIALS = Object.keys(DEF.initials).sort((a, b) => b.length - a.length);
// Rimes tried longest-first so ⟨ee⟩ beats ⟨e⟩, ⟨ai⟩ beats ⟨a⟩, etc.
const RIMES = Object.keys(DEF.rimes).sort((a, b) => b.length - a.length);
const TONE_LETTERS = new Set(Object.keys(DEF.toneLetter));

/** One RPA syllable → IPA. Strip the final tone letter, then onset + rime; palatalise ⟨tx x⟩ before /i/; a
 *  vowel-initial syllable takes a glottal onset [ʔ]. Unknown material is left visible for the residual report. */
function syllableToIpa(syl: string): string {
    const w = syl.normalize("NFC").toLowerCase();
    if (!w) return "";
    // The tone = the final consonant LETTER (RPA has no codas); no such letter → tone 4 (mid).
    const lastIsTone = w.length > 1 && TONE_LETTERS.has(w[w.length - 1]!);
    const base = lastIsTone ? w.slice(0, -1) : w;
    const tone = lastIsTone ? DEF.toneLetter[w[w.length - 1]!]! : "4";
    const chao = DEF.toneChao[tone] ?? "";
    // Onset: longest multigraph match; none matched + vowel-initial → glottal [ʔ]; none + consonant → unknown.
    let ini = "";
    for (const k of INITIALS) if (base.startsWith(k)) { ini = k; break; }
    const rimeRpa = base.slice(ini.length);
    const rime = RIMES.find((r) => rimeRpa === r);
    if (rime === undefined) return syl; // unknown rime → NOT RPA; `readRun` routes it (see below)
    let iniIpa = ini === "" ? "ʔ" : (DEF.initials[ini] ?? "");
    if (rime[0] === "i" && DEF.palatalBeforeI[ini]) iniIpa = DEF.palatalBeforeI[ini]!; // ⟨tx x⟩ → palatal before /i/
    return iniIpa + DEF.rimes[rime] + chao;
}

/** Did the converter READ this string, or hand it back? The one test for "is this RPA" — `syllableToIpa`
 *  returns its own input on an unknown rime, so identity IS the failure signal. */
const reads = (syl: string): boolean => syl !== "" && syllableToIpa(syl) !== syl;

/**
 * A SOLID-WRITTEN RPA POLYSYLLABLE → its syllables, or `undefined` if the run is not one.
 *
 * ⚠ THE TONE LETTER IS THE ONLY BOUNDARY SIGNAL RPA GIVES, and that is why every syllable here must carry
 * one. RPA writes syllables space-separated, but the corpus writes compounds solid as well — `tebchaws`
 * ×16 beside `teb` ×178 and `chaws` ×75, `haujlwm`, `lossis`, `xovtooj`, `qhovntsej`, plus the nativised
 * country names `Fabkis`, `Lavxias`, `Asmeskas`, `Suavteb`, `Nyablaj`, `Lostsuas`, `Thaibteb`. The engine
 * read exactly ONE syllable per Latin run, so all of them fell through to the raw passthrough. This is the
 * item the bringup run deferred as "the polysyllabic loan proper-nouns".
 *
 * ⚠⚠ REQUIRING A TONE LETTER ON EVERY SYLLABLE IS A PRECISION GATE, NOT A RULE OF RPA — the mid tone is
 * unmarked, so a genuine compound may contain an unmarked syllable and this will refuse it. It is here
 * because a segmenter over bare syllable legality READS ENGLISH AS HMONG: the corpus is Wikimedia
 * Incubator `Wp/mww`, translated FROM English with word-level residue, and legality alone splits
 * `Cantonese` (ca·nto·ne·se), `Wikipedia`, `Canada`, `Monaco`, `coronavirus`, `Papua`, `Paris`. Measured
 * over the mined artifact's 978 unread tokens:
 *
 *   | segmenter                          | genuine Hmong kept | FOREIGN read as Hmong | genuine Hmong missed |
 *   |------------------------------------|--------------------|-----------------------|----------------------|
 *   | syllable legality alone            | 33 types / 107 tok | **52 types / 102 tok**| 2 types / 3 tok      |
 *   | + first syllable tone-marked       | 31 / 98            | 6 / 15                | 4 / 12               |
 *   | **+ EVERY syllable tone-marked**   | 28 / 95            | **1 / 1** (`Assam`)   | 7 / 15               |
 *
 * The cost is named rather than hidden: `kevcai`, `tebchaw`, `Yexus`, `Yelemees`, `Amelikas`, `Asmesliska`,
 * `Ntauwd` (7 types / 15 tokens) each contain an unmarked syllable, are refused here, and go to the foreign
 * reader instead. That is a WRONG READING, not a leak — and the alternative buys those 15 tokens at the
 * price of 102 tokens of English pronounced as pseudo-Hmong, which is the failure mode the `ak` run warns
 * about (a defect that hides as plausible-sounding output). Recovering them needs a Hmong DICTIONARY; the
 * only lexicon available is this corpus itself, and gating the fix on the corpus it is measured against
 * would be circular.
 *
 * Fewest syllables first, longest-match on ties — so a run the direct path already reads can never be
 * re-cut, which is why the 455-word single-syllable referee is byte-identical across this change.
 */
function splitRpaSyllables(run: string): string[] | undefined {
    const w = run.normalize("NFC").toLowerCase();
    const n = w.length;
    // `cuts[i]` = fewest syllables covering w[i..n); Infinity if unreachable.
    const cuts = new Array<number>(n + 1).fill(Infinity);
    cuts[n] = 0;
    for (let i = n - 1; i >= 0; i--) {
        for (let k = i + 2; k <= n; k++) {
            // Every syllable ends in a tone LETTER — see the gate above.
            if (!TONE_LETTERS.has(w[k - 1]!)) continue;
            if (cuts[k] === Infinity) continue;
            // `reads` and not a private onset+rime walk: the pieces are handed straight back to
            // `syllableToIpa`, so the acceptance test has to be that same parse or a piece could be
            // accepted here and passed through raw there.
            if (!reads(w.slice(i, k))) continue;
            cuts[i] = Math.min(cuts[i]!, 1 + cuts[k]!);
        }
    }
    if (cuts[0] === Infinity || cuts[0]! < 2) return undefined; // not RPA, or a single syllable (already read)
    const out: string[] = [];
    for (let i = 0; i < n;) {
        // Longest arc that still achieves the minimum — maximal munch, deterministic.
        let best = -1;
        for (let k = n; k >= i + 2; k--) {
            if (!TONE_LETTERS.has(w[k - 1]!) || cuts[k] === Infinity) continue;
            if (cuts[k]! + 1 !== cuts[i]! || !reads(w.slice(i, k))) continue;
            best = k;
            break;
        }
        if (best < 0) return undefined; // unreachable given cuts[0] < Infinity, but never guess a syllable
        out.push(w.slice(i, best));
        i = best;
    }
    return out;
}

/**
 * ONE LATIN RUN → the sink, in three steps: read it as ONE RPA syllable; else as a solid-written RPA
 * POLYSYLLABLE; else hand it to the shared FOREIGN reader.
 *
 * ⚠⚠ THE THIRD STEP IS THE DEFECT THIS FUNCTION EXISTS FOR. `syllableToIpa` returns ITS OWN INPUT when the
 * rime lookup fails, and the caller emitted that return value — so a word the converter cannot read reached
 * the IPA VERBATIM, capitals and all: `Crocodile Dundee`, `United Nations`, `BBC`, `COVID`. Measured on the
 * mined artifact: `LEAK RAW-CAPS` fired on **100 of 113 lines**, and across all 161 mined artifacts it fired
 * in THIS LANGUAGE AND NOWHERE ELSE. 503 distinct unread types / 978 tokens.
 *
 * ⚠ AND IT WAS INVISIBLE BEHIND A PERFECT REFEREE. `referee-eval hmn` is 455/455, 100.0%, and stayed there
 * across this change — its referee is 455 single-syllable RPA words with no foreign material in it, so
 * nothing about foreign-word handling can move it. It is a TRIPWIRE (a rule that mis-cut an RPA word or bit
 * off a tone letter would show up there instantly), not a meter.
 *
 * ⚠ WHY ENGLISH IS THE RIGHT FOREIGN READER HERE, stated because it cuts both ways. `emitUnclaimed` is the
 * fleet's shared path: the script router first, then Latin→English. Hmong writes RPA in the LATIN script, so
 * no script boundary exists for the router to see and every one of these runs takes the English branch. Three
 * pieces of evidence for accepting that: the corpus is `Wp/mww`, translated FROM English, so the residue IS
 * English (`filter-by-language.py` drops 0 paragraphs — the contamination is word-level, which no paragraph
 * filter can see); the speech community is largely US-based; and RPA is a tight phonemic orthography, which
 * gives hmn a native/foreign test most Latin-script engines do not have — a run that does not parse as RPA is
 * not a Hmong word. The cost, which the `ak` run names: a future defect can now hide as a plausible ENGLISH
 * word instead of as raw ASCII. That is still strictly better than emitting the spelling as if it were IPA.
 *
 * ⚠ INITIALISMS GET ENGLISH LETTER NAMES, AND NO HMONG LETTER-NAME TABLE IS INVENTED TO AVOID IT. `BBC` →
 * *bˌiːbisˈiː*, `GDP` → *ɡˈiːdˈiːpʰˈiː*, `TV`, `UK`, `NSW`, `NT`, `BC`, `pH`, and `L. L. Zamenhof` → the
 * English names of the letters. There is NO attested Hmong letter-name table: the corpus names letters by
 * WRITING THE LATIN LETTER — `ib daim ntawv loj S` ("a large letter S", the sentence that sources `duas`),
 * `J-puab`, `G8`, `K-pop` — and no source in this tree glosses a Hmong name for a letter. So the letter names
 * arrive as a CONSEQUENCE of the foreign route, not from a table this file made up.
 */
function readRun(word: string, original: string, sink: ClauseSink): void {
    const one = syllableToIpa(word);
    if (one !== word) { sink.emit(one); return; } // ordinary single RPA syllable — the overwhelmingly common case
    const parts = splitRpaSyllables(word);
    if (parts !== undefined) { for (const p of parts) sink.emit(syllableToIpa(p)); return; }
    // NOT RPA. `original` and not the nativised form: the foreign reader wants the spelling as typed, and
    // `nat` exists to fold an accent INTO this engine's inventory, which is the wrong direction for a run
    // that is about to leave it.
    emitUnclaimed(original, sink);
}

class HmongPhonemizer implements Phonemizer {
    text(input: string): string {
        // `assembleClauses` rather than a private exec loop: this loop was already that shape and only
        // predated the shared helper, so it never got the GAP PASS and a run in a script it does not claim
        // was dropped outright. Routed by core/scripts.ts.
                // RPA syllables are space/hyphen-separated Latin letter-runs.
        const tok = new RegExp(`(${LATIN_RUN})|(\\d+)|([。，、？！；：.,?!;:])`, "gu");
        
        return assembleClauses(normalizeHmong(input), tok, (m, sink) => {
            if (m[1]) readRun(nat(m[1]), m[1], sink);
            else if (m[2]) for (const wd of numberToHmongWords(Number(m[2]), m[2])) sink.emit(syllableToIpa(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Hmong (White Hmong / RPA) phonemizer — RPA → IPA (segmental + citation tone). */
export function createHmong(): Phonemizer {
    return new HmongPhonemizer();
}

/** Bare RPA word → IPA (tests / referee eval). */
export function phonemizeWord(word: string): string {
    return syllableToIpa(word);
}

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where the
 * SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A token
 * this class REJECTS carries a letter the language does not use — i.e. a foreign name. See core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zA-Z]";
const nat = makeNativiser(NATIVE_CLASS, "u");