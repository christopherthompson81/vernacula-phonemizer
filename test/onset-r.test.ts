/**
 * AN ONSET /r/ IS NEVER DELETED — the two non-rhotic English descendants, audited against the parent's own
 * output rather than against a word list.
 *
 * ⚠ THE DEFECT (#1250). Non-rhotic English drops CODA /r/ and never onset /r/. Both engines implement that
 * as a NEGATIVE test — "an /ɹ/ not before a vowel is a coda" — and both spell the vowels out as a string.
 * `ᵻ`, the reduced vowel the parent emits for unstressed `re-`/`ri-`, was in neither string, so `ɹᵻ` counted
 * as "not before a vowel" and the /r/ came off the FRONT of the word: `reports` read *ᵻpʰˈɔːts* in en-GB and
 * *ipɔts* in pcm, and 13 of 13 GenAm `ɹᵻ` verbs with it. A listener called the en-GB sentence
 * "televisi'epots", which is exactly what that IPA says.
 *
 * ⚠ AND pcm HAD A SECOND, LARGER ONE. Its NURSE/lettER rules mapped `ɚ`/`ɝ` to plain vowels BEFORE the onset
 * rule could see them, on the reasoning that "the r is absorbed" — true in coda, false before a vowel, where
 * the /r/ is the onset of the next syllable. `around` (`ɚˈaᶷnd`) read *aaund*, `correct` *kaɛkt*.
 *
 * THE INSTRUMENT IS THE PARENT. Every rhotic ONSET in the GenAm source — an `ɹ` before a vowel, or an `ɚ`/`ɝ`
 * before a vowel, which is a syllable-initial /r/ written as a diacritic — must survive into the descendant
 * as that descendant's rhotic. Coda /r/ is not counted, so the non-rhoticity the accents exist for is not
 * being asserted away. Run over all 117,479 dict words, which is what makes it an audit of the VOWEL classes
 * and not a check of the reported words: a symbol dropped from either string fails here the same day.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { createEnglish } from "../src/languages/english/english.ts";

const WORDS = readFileSync("data/languages/english/g2p-dict.tsv", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("\t")[0]!);

/**
 * GenAm's own vowels — the parent alphabet, not either descendant's.
 *
 * ⚠ `ᵻ` IS IN IT, which is the point of the sweep. ⚠ AND SO ARE `ɚ` AND `ɝ`, which is the point of the sweep
 * being an INSTRUMENT rather than a restatement: they are vowels, an `ɚ` before another `ɚ` is a /r/ before a
 * vowel, and leaving them out gave this file the same blind spot as the bug it was written to catch. 96 dict
 * words (`caterer` `kʰˈeᶦt̬ɚɚ`, `adventurer`, `acquirer`) sat inside it, reported clean.
 */
const GENAM_VOWEL = "iɪeɛæəɐɑɔʌʊuoaᵻɚɝ";
/** `ɹ` before a (possibly stress-marked) vowel, and the r-coloured vowels, which are a /r/ before one. */
const ONSET_R = new RegExp(`(?:ɹ(?=[ˈˌ]*[${GENAM_VOWEL}])|[ɚɝ](?=[ˈˌ]*[${GENAM_VOWEL}]))`, "gu");

const count = (s: string, re: RegExp): number => [...s.matchAll(re)].length;

/**
 * ⚠ ONE WORD WHERE THE TWO ENGINES READ DIFFERENT WORDS, so the instrument's premise does not hold. `dr` is
 * an ABBREVIATION and the two expand it differently — `en` says *drive* (`dɹˈaᶦv`), pcm's own table says
 * *dakta*, doctor. Nothing lost an onset; the comparison is simply between two different words. Listed here
 * rather than filtered by a heuristic, so the exception stays a fact about the abbreviation tables.
 */
const DIFFERENT_WORD: Readonly<Record<string, readonly string[]>> = { pcm: ["dr"] };

describe("a non-rhotic descendant keeps every onset /r/ the parent had (#1250)", () => {
    test.each([
        ["en-GB", /ɹ/gu],
        ["pcm", /ɾ/gu],
    ])("%s: no dict word loses one", (lang, rhotic) => {
        const en = createEnglish();
        const lost: string[] = [];
        for (const w of WORDS) {
            let src: string, out: string;
            try {
                src = en.text(w);
                out = phonemize(w, lang);
            } catch {
                continue; // a word the parent cannot read is a different test's business
            }
            const onsets = count(src, ONSET_R);
            if (onsets === 0 || DIFFERENT_WORD[lang]?.includes(w)) continue;
            if (count(out, rhotic) >= onsets) continue;
            if (lost.length < 12) lost.push(`${w}: ${src} → ${out} (${onsets} onset r, ${count(out, rhotic)} kept)`);
            else lost.push(w);
        }
        expect(lost.slice(0, 12), `${lost.length} words lost an onset /r/`).toEqual([]);
    });

    // ⚠ THE REPORTED SHAPES, PINNED BY HAND as well as by the sweep — the sweep proves the class is complete,
    // these say what the words are supposed to sound like.
    test("the reduced vowel ᵻ is a vowel to both engines", () => {
        expect(phonemize("reports", "en-GB")).toBe("ɹᵻpʰˈɔːts");
        expect(phonemize("reports", "pcm")).toBe("ɾipɔts");
        // ⚠ NOT ONLY WORD-INITIAL, which the 13 `re-` verbs understate: `alacrity` lost the /ɹ/ of `kɹ`.
        expect(phonemize("alacrity", "en-GB")).toBe("əlˈækɹᵻti");
        // …and the vowel+r remaps were misfiring on the same gap — `ɛɹ` before `ᵻ` is not SQUARE.
        expect(phonemize("asperity", "en-GB")).toBe("əspˈɛɹᵻti");
        expect(phonemize("authority", "en-GB")).toBe("əθˈɔːɹᵻti");
        // `report` was never affected, and is the tell: its first vowel resolves to `i`, not `ᵻ`.
        expect(phonemize("report", "en-GB")).toBe("ɹipʰˈɔːt");
    });

    test("a PRE-VOCALIC ɚ/ɝ is an onset /r/ in Naija too, not an absorbed one", () => {
        expect(phonemize("around", "pcm")).toBe("aɾaund");
        expect(phonemize("arrive", "pcm")).toBe("aɾaiv");
        expect(phonemize("correct", "pcm")).toBe("kaɾɛkt");
        // …and in CODA it is still absorbed, which is what makes Naija non-rhotic.
        expect(phonemize("car", "pcm")).toBe("ka");
        expect(phonemize("market", "pcm")).toBe("makat");
        expect(phonemize("remember", "pcm")).toBe("ɾimɛmba");
    });

    test("a run of stress marks does not hide the vowel from en-GB's coda test", () => {
        // The parent emits `ˌˈ` together on five dict words; one optional mark could not see past the pair
        // and the ONSET CLUSTER `ɡɹ` lost its /ɹ/.
        expect(createEnglish().text("greedier")).toBe("ɡɹˌˈiːd̬iʲɚ");
        expect(phonemize("greedier", "en-GB")).toBe("ɡɹˌˈiːdiə");
    });

    test("non-rhoticity itself still holds — a CODA /r/ is dropped in both", () => {
        for (const [lang, want] of [["en-GB", "kʰˈɑː"], ["pcm", "ka"]] as const) expect(phonemize("car", lang)).toBe(want);
        expect(phonemize("market", "en-GB")).toBe("mˈɑːkət");
        expect(phonemize("water", "en-GB")).toBe("wˈɔːtə");
    });
});
