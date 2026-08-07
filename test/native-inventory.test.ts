/**
 * A DECLARED INVENTORY IS A CLAIM ABOUT THE G2P, so measure it instead of trusting it.
 *
 * `NATIVE_CLASS` names the letters an engine's g2p has rules for. `makeNativiser` folds everything OUTSIDE it to
 * a base the g2p can read, and leaves everything inside alone — so a class that lists a letter the g2p CANNOT
 * read produces silence: the fold declines to touch it, and the g2p then drops it.
 *
 * ⚠ A WORD-LEVEL FOLD MASKS THIS ENTIRELY. Folding the whole word when any ONE letter is foreign means an
 * over-claimed letter gets folded too, by accident, whenever it happens to share a word with something
 * genuinely foreign. Judging each character separately — the correct semantics, and the fix for Turkish
 * `İsveç` coming out *ɯsvˈed͡ʒ* — removes the accident and exposes the mismatch. Eight
 * engines were over-claiming: da, ro, kea, mt, lb, rup, ast, lg.
 *
 * ⚠ LETTERS ONLY. An apostrophe (`'`, `’`, `ʼ`), a word-joiner (`·`, `‑`) or a bare combining mark carries no
 * segment, so a g2p that ignores it is correct rather than over-claiming. The first version of this probe flagged
 * fourteen languages for exactly that and had to be narrowed — `\p{L}` minus `\p{Lm}`, since the modifier-letter
 * apostrophes are letters by Unicode category and punctuation by function.
 *
 * ⚠ AND A HOLE THAT IS DELIBERATE, STATED SO IT IS NOT MISTAKEN FOR COVERAGE: **ASCII is exempt.** Nearly every
 * class here carries `a-z`, and 43 engines claim the whole range while their g2p drops part of it — `q w x y` in
 * Serbian/Croatian/Bosnian, `c j q v x z` in Akan, thirteen of twenty-six letters in Maori. So `Cañitas` keeps its
 * `ñ` now and still loses its `C` in Maori.
 *
 * That is a REAL defect and it is NOT this issue's. Folding an accent has a universal answer — strip the mark, and
 * the base letter is right for every language. An absent ASCII consonant has no universal answer: `q`→k, `w`→v or
 * u, `x`→ks, `c`→k or s are per-language substitution choices that need sourcing, and for several of these
 * languages the better answer is to ROUTE the foreign name to a reader instead of nativising it at all. Tracked
 * separately rather than guessed at here. Some of the 43 are also correct silence, not loss — Spanish `h` IS
 * silent — which is exactly why it needs per-language judgement rather than a table.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { makeNativiser } from "../src/core/hostWord.ts";
import { dirCodes, registeredCodes } from "../tools/registry-map.ts";

/** Expand a character-class body to its literal characters (ranges only over short spans, which is all we use). */
function expand(body: string): string[] {
    const out: string[] = [];
    const cs = [...body];
    for (let i = 0; i < cs.length; i++) {
        if (cs[i + 1] === "-" && cs[i + 2] !== undefined) {
            const a = cs[i]!.codePointAt(0)!, z = cs[i + 2]!.codePointAt(0)!;
            if (z > a && z - a < 60) {
                for (let c = a; c <= z; c++) out.push(String.fromCodePoint(c));
                i += 2;
                continue;
            }
        }
        out.push(cs[i]!);
    }
    return out;
}

/**
 * The frame to test a letter in, IN ITS OWN SCRIPT.
 *
 * ⚠ A SINGLE LATIN FRAME IS INVALID FOR A BI-SCRIPT ENGINE, and the first version of this test used one. Serbian
 * and Bosnian write both Cyrillic and Latin, and their engines pick a script PER WORD — so `kaуo` is a mixed
 * word no orthography contains, and the engine drops the minority script's letter. That looked exactly like an
 * over-claim and flagged `у` and `х`, two of the most ordinary letters in the language: `ухо` reads *uxo* and
 * `хвала` *xʋala*, both perfectly. Measuring in the wrong frame produces a finding about the frame.
 */
const FRAMES: [RegExp, string, string][] = [
    [/\p{Script=Cyrillic}/u, "ка", "о"],
    [/\p{Script=Latin}/u, "ka", "o"],
];

describe("a declared native inventory matches what the g2p can read", () => {
    test("no engine claims a letter its own g2p drops", () => {
        const overclaims: string[] = [];
        for (const [dir, codes] of dirCodes()) {
            const code = codes[0]!;
            for (const f of readdirSync(`src/languages/${dir}`).filter((x) => x.endsWith(".ts"))) {
                const src = readFileSync(`src/languages/${dir}/${f}`, "utf8");
                const m = src.match(/^const NATIVE_CLASS = "\[([^"]*)\]";$/mu);
                if (m === null) continue;
                for (const c of new Set(expand(m[1]!))) {
                    // ASCII is never in question; punctuation and modifier letters carry no segment.
                    if (/[a-zA-Z]/u.test(c) || !/\p{L}/u.test(c) || /\p{Lm}/u.test(c)) continue;
                    const frame = FRAMES.find(([re]) => re.test(c));
                    if (frame === undefined) continue; // no frame we can build safely in this letter's script
                    const [, lead, tail] = frame;
                    try {
                        if (phonemize(`${lead}${c}${tail}`, code) === phonemize(`${lead}${tail}`, code))
                            overclaims.push(`${code} claims ${c} but drops it`);
                    } catch {
                        continue;
                    }
                }
                break;
            }
        }
        expect(overclaims, "a claimed letter the g2p drops — remove it from NATIVE_CLASS so the fold reaches it")
            .toEqual([]);
    });

    test("an out-of-inventory letter is FOLDED, never dropped", () => {
        // The letters NFD cannot decompose, which is the case the mark-stripping fold alone does not reach. The
        // assertion is that the leading letter still contributes: dropping it makes the word read as if it had
        // never been typed, so the reading must differ from the reading of the word WITHOUT it.
        for (const [w, lang] of [
            ["Æthelred", "de"],   // Æ → a; read *thˈɛlʁət*, the Æ simply gone, before the fold reached it
            ["Łódź", "de"],       // Ł → l
            ["Ærø", "es"],
        ] as const)
            expect(phonemize(w, lang), `${lang} ${w} — leading letter dropped`)
                .not.toBe(phonemize(w.slice(1), lang));
        // …and a letter that IS native survives untouched, which is what makes the fold conditional.
        expect(phonemize("þing", "is")).toContain("θ");
        expect(phonemize("blåbær", "nb")).toContain("æ");
        expect(phonemize("ɛdwuma", "ak")).toContain("ɛ");
    });

    test("⚠ a combining mark with NO precomposed form survives the fold", () => {
        // Tâi-lô tone 8 is base + U+030D COMBINING VERTICAL LINE ABOVE, which composes to nothing, so NFC leaves
        // the cluster two characters long. A char test allowing exactly ONE class match rejected every such
        // cluster and the fold stripped the tone — asserted on the nativiser directly, because Min Nan's g2p has
        // no rule for U+030D either (a separate gap, present on both sides of this change).
        const nat = makeNativiser("[A-Za-zàáâāǎÀÁÂĀǍ̀-̍]", "u");
        expect(nat("ta̍k"), "tone 8 preserved").toBe("ta̍k");
        expect(nat("tāi"), "tone 7 preserved").toBe("tāi");
        // ⚠ AND NOT VIA AN NFD TEST, which is the generous-looking fix that breaks it the other way: `ñ`
        // decomposes to `n` + U+0303, and U+0303 sits inside that same tone range, so testing the decomposed form
        // judged `ñ` NATIVE. It then escaped the fold, reached a g2p with no rule for it, and came out VERBATIM.
        expect(nat("Cañitas"), "ñ is NOT in this inventory").toBe("Canitas");
    });

    test("⚠ no engine emits raw orthography into its IPA", () => {
        // The signature of an over-permissive inventory: the fold judges a letter native, declines to touch it,
        // and the g2p passes it through unread. `Cañitas` read *cañitas˥* in Min Nan and *cañitas˥˥* in Min Dong.
        //
        // ⚠ ONLY CHARACTERS THAT ARE NEVER IPA. An earlier version of this listed every accented letter in the
        // probe words and flagged nine engines, five of them wrongly: `ã õ ĩ ũ` are NASALISED VOWELS (`gn`, `ee`,
        // `umb`, `yo` all emit them correctly), and `è ì á` are this repo's tone and pitch-accent notation — `sv`
        // marks accent 2 with a grave. Testing "looks like orthography" measures the probe, not the engine.
        const ORTHO = /[ñöüäłŁźÿÆÞþÐ]/u;
        // ⚠ SCOPED TO ENGINES THAT DECLARE AN INVENTORY. `cdo` (Min Dong) leaks the same way and is NOT included,
        // because it is a DIFFERENT defect that this issue's mechanism cannot fix: its token class expresses its
        // own letters as base PLUS a combining range (`[a-zŋ\u0300-\u036f]`), and NFC composes several of them
        // into precomposed forms the class does not list — so a mechanical fold destroys `ṳ` (U+1E73, read /y/)
        // while still having no way to reject `ñ`, whose tilde sits in that same range. Narrowing the range needs
        // Bàng-uâ-cê orthographic sourcing, i.e. evidence, not a table. Fixing it blind broke two real tests.
        const declared = new Set(
            [...dirCodes()].filter(([dir]) => readdirSync(`src/languages/${dir}`)
                .some((f) => f.endsWith(".ts") && /^const NATIVE_CLASS = /mu.test(readFileSync(`src/languages/${dir}/${f}`, "utf8"))))
                .flatMap(([, codes]) => codes),
        );
        const leaks: string[] = [];
        for (const { code } of registeredCodes().filter((r) => declared.has(r.code)))
            for (const w of ["Cañitas", "Klöcker", "São", "Thérèse", "Łódź"]) {
                try {
                    const out = phonemize(w, code);
                    if (ORTHO.test(out)) leaks.push(`${code}: ${w} → ${out}`);
                } catch { /* engine cannot take a bare Latin word */ }
            }
        expect(leaks, "raw orthographic letters reaching the phoneme string").toEqual([]);
    });

    test("a CAPITALISED native word reads like its lowercase form", () => {
        // A class listing its accented letters in lower case only rejects the capital, so the fold strips the
        // diacritic off every sentence-initial word. cy was missing ten capitals, nan five.
        for (const [lang, word] of [["cy", "Ŵyl"], ["nan", "Tâi"], ["cs", "Čas"], ["nb", "Blåbær"]] as const)
            expect(phonemize(word, lang), `${lang} ${word}`).toBe(phonemize(word.toLowerCase(), lang));
    });
});
