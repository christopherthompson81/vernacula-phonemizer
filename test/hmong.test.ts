import { describe, expect, test } from "vitest";

import { createHmong, phonemizeWord } from "../src/languages/hmong/hmong.ts";
import { normalizeHmong } from "../src/languages/hmong/normalize.ts";
import { phonemize } from "../src/index.ts";

// Hmong (hmn) — White Hmong / Hmoob Dawb (Hmong Daw, mww), Hmong-Mien, tonal (~8M). An RPA (Romanized Popular
// Alphabet) → IPA converter. RPA has NO codas → a final ⟨b j v s g m d⟩ is always a TONE marker.
// ⚠ Referee: wikipron mww_latn_broad (single-syllable, ~455) — and the on-referee score is MEANINGLESS,
// because the maps were fit to it and RPA is deterministic. The held-out 5-fold CV is the only honest
// generalisation figure. Single-source and thin either way.
describe("Hmong (White Hmong) canonical IPA — RPA → IPA converter", () => {
    const hmn = createHmong();

    test("the final consonant LETTER marks tone (no codas): b/j/v/s/g/m/d + none", () => {
        expect(phonemizeWord("teb")).toBe("te˥"); // ⟨-b⟩ → high 55 ("country")
        expect(phonemizeWord("caij")).toBe("cai̯˥˧"); // ⟨-j⟩ → high-falling 52 ("time/season"); ⟨c⟩=[c], ⟨ai⟩
        expect(phonemizeWord("kuv")).toBe("ku˧˦"); // ⟨-v⟩ → mid-rising 24 ("I/me")
        expect(phonemizeWord("lus")).toBe("lu˩"); // ⟨-s⟩ → low 11 ("word/language")
        expect(phonemizeWord("cag")).toBe("ca˧˩̤"); // ⟨-g⟩ → breathy low-falling
        expect(phonemizeWord("cai")).toBe("cai̯˧"); // no tone letter → mid 33
    });

    test("the rich onset system: prenasalised, voiceless sonorants, retroflex, uvular", () => {
        expect(phonemizeWord("npua")).toBe("ᵐbuə̯˧"); // ⟨np⟩ prenasalised → ᵐb, ⟨ua⟩→uə̯ ("pig")
        expect(phonemizeWord("ntxhai")).toBe("ⁿt͡sʰai̯˧"); // ⟨ntxh⟩ → ⁿt͡sʰ ("girl/daughter")
        expect(phonemizeWord("hlub")).toBe("l̥u˥"); // ⟨hl⟩ voiceless lateral → l̥ ("love")
        expect(phonemizeWord("Hmoob")).toBe("m̥ɒ̃˥"); // ⟨hm⟩→m̥, ⟨oo⟩ nasal →ɒ̃ ("Hmong")
    });

    test("⟨tx x⟩ PALATALISE to [t͡ɕ ɕ] before /i/; a vowel-initial syllable takes glottal [ʔ]", () => {
        expect(phonemizeWord("txiv")).toBe("t͡ɕi˧˦"); // ⟨tx⟩ → t͡ɕ before i ("father/fruit")
        expect(phonemizeWord("txab")).toBe("t͡sa˥"); // ⟨tx⟩ → t͡s elsewhere
        expect(phonemizeWord("ib")).toBe("ʔi˥"); // vowel-initial → glottal onset ʔ ("one")
    });

    test("clause assembly (space-separated syllables)", () => {
        expect(createHmong().text("Kuv hais lus Hmoob.").replace(/\s+/g, " ").trim())
            .toBe("ku˧˦ hai̯˩ lu˩ m̥ɒ̃˥ ."); // "I speak Hmong"
    });
});

// Cardinal numbers — decimal and analytic. 11–19 are kaum + unit; 20 is the irregular two-word nees nkaum; 30–90 are
// unit + caug (30/40/50) or caum (60–90), a real tone alternation. A magnitude ALWAYS carries its multiplier, incl.
// "one" (ib puas, ib txhiab, ib roob), and thousands group Western-style, so 10⁵ is ib puas txhiab. Source: Wikivoyage
// "Hmong phrasebook" Numbers + Wiktionary "Category:White Hmong numerals" (see numbers.ts).
describe("Hmong (hmn) cardinal numbers", () => {
    const hmn = createHmong();
    for (const [n, ipa] of [
        [0, "sɒ̃˩̰"], // xoom
        [7, "ça˧"], // xya
        [10, "kau̯˩̰"], // kaum
        [11, "kau̯˩̰ ʔi˥"], // kaum ib
        [20, "nẽ˩ ᵑɡau̯˩̰"], // nees nkaum — the irregular two-word twenty
        [21, "nẽ˩ ᵑɡau̯˩̰ ʔi˥"], // nees nkaum ib
        [42, "pˡau̯˥ cau̯˧˩̤ ʔɒ˥"], // plaub caug ob — the caug decade
        [100, "ʔi˥ puə̯˩"], // ib puas — multiplier always spoken
        [1000, "ʔi˥ t͡sʰiə̯˥"], // ib txhiab
        [12345, "kau̯˩̰ ʔɒ˥ t͡sʰiə̯˥ pe˥ puə̯˩ pˡau̯˥ cau̯˧˩̤ t͡ʂi˥"], // kaum ob txhiab peb puas plaub caug tsib
        [1000000, "ʔi˥ ʈɒ̃˥"], // ib roob
    ] as const) {
        test(`${n} → ${ipa}`, () => {
            expect(hmn.text(String(n)).trim()).toBe(ipa);
        });
    }
});

// ── TEXT NORMALIZATION ────────────────────────────────────────────────────────────────────────────────
// ⚠ Every count cited here is over Wikimedia Incubator's `Wp/mww` (White Hmong / Hmong Daw), which is the
// ONLY Hmong corpus that exists — there is no Hmong Wikipedia at any code, so `attest.ts` cannot be run for
// this language and the corpus is also its own ceiling. 190 paragraphs after `filter-by-language.py --lang
// hmn`, which dropped ZERO paragraphs as English. The rules and their sourcing are argued in
// src/languages/hmong/normalize.ts; this file pins the BRANCHES (trap 13), not the corpus's instances.
describe("Hmong (hmn) text normalization", () => {
    const hmn = createHmong();
    const say = (s: string): string => hmn.text(s).replace(/\s+/gu, " ").trim();

    // ⚠ THE LAYER'S DEFINING RULE. This corpus writes BOTH separator conventions — the Anglo one in the
    // articles translated from English and the European one in those translated from Russian and German —
    // so the discriminator is the TAIL'S LENGTH and never which mark it is. Both directions are pinned in
    // both marks, which is the only way a regression in one of the four cells would be visible.
    test("the separator is decided by the TAIL LENGTH, for BOTH marks", () => {
        expect(normalizeHmong("23,822,747")).toBe("23822747"); // comma + 3 → grouping
        expect(normalizeHmong("146.270.033")).toBe("146270033"); // dot + 3 → grouping (Russia's population)
        expect(normalizeHmong("8,46 lab")).toBe("8 4 6 lab"); // comma + 2 → decimal
        expect(normalizeHmong("2.9 lab")).toBe("2 9 lab"); // dot + 1 → decimal
        // …and the reading, which is what the rule exists for: a grouped number was three numbers with two
        // SENTENCE BREAKS in it, and a decimal was a full stop in the middle of a quantity.
        expect(say("2.9 lab")).toBe("ʔɒ˥ cuə̯˥˧ la˥"); // was: ʔɒ˥ . cuə̯˥˧ la˥
    });

    // ⚠ THE VERSION-DOT GUARD, EARNED BY THE SAME TAIL RULE RATHER THAN BY A SEPARATE LOOKAHEAD — a dotted
    // designation has a LETTER after its tail, so the decimal rule refuses it (traps 28/39/46).
    test("a dotted designation is not a quantity", () => {
        expect(normalizeHmong("802.11n")).toBe("802.11n");
        expect(normalizeHmong("3.141")).toBe("3141"); // ⚠ THE STATED COST: a 3-place decimal de-groups. ×0 here.
    });

    // ⚠⚠ THE TONE-LETTER HAZARD. In RPA the final consonant letter IS the tone, so a rule that bites one
    // letter off a word produces a DIFFERENT word rather than a broken one. These pin that no rule in this
    // file reaches into an RPA word: `lab` (million, high tone `-b`), `duas` (dollar, low tone `-s`) and
    // `vam` (creaky `-m`) must survive intact, and the hyphenated proper nouns RPA uses for foreign names
    // must not be seen as ranges.
    test("no rule bites a tone letter off an RPA word", () => {
        expect(normalizeHmong("Aus-rab-lias")).toBe("Aus-rab-lias"); // ×124 letter-hyphen-letter in the corpus
        expect(normalizeHmong("ib lab duas")).toBe("ib lab duas");
        expect(normalizeHmong("2.7 vam")).toBe("2 7 vam");
        expect(say("Hmoob")).toBe("m̥ɒ̃˥"); // the language's own name still reads
    });

    // ⚠ THE SPACED DASH IS NOT A RANGE AND NOT A PAUSE. `\s-\s` ×53 in the corpus, and the counter-example
    // that forbids claiming it is `Papua - Tshiab Guinea` — ONE NAME with a spaced hyphen inside it (trap 9).
    // So the range rule takes GLUED pairs only, which is strictly narrower than the fleet's shape.
    test("ranges are GLUED and ASCENDING only", () => {
        expect(normalizeHmong("1438-1806")).toBe("1438 mus rau 1806");
        expect(normalizeHmong("1859–1917")).toBe("1859 mus rau 1917"); // the en dash is folded at step 2
        expect(normalizeHmong("Pejxeem - 146.270.033 neeg")).toBe("Pejxeem - 146270033 neeg");
        expect(normalizeHmong("Papua - Tshiab Guinea")).toBe("Papua - Tshiab Guinea");
        // A DESCENDING pair reads with a different connective, so it is left as the juxtaposition it was —
        // the branch the corpus does not exercise, pinned for that reason.
        expect(normalizeHmong("1806-1438")).toBe("1806-1438");
    });

    // `feem pua` — attested as the COLLOCATION, in the slot, ×3 in three articles, and corroborated by the
    // Minnesota Dept. of Education English–Hmong dictionary. POSTPOSED, which all three attestations fix.
    test("percent is `feem pua`, postposed", () => {
        expect(normalizeHmong("60%")).toBe("60 feem pua");
        expect(say("60%.")).toBe("ʈau̯˧ cau̯˩̰ fẽ˩̰ puə̯˧ ."); // was: the % SILENT
        // ⚠ THE ORDERING THAT MAKES `5-10%` COME OUT RIGHT: the corpus writes the span with the sign on the
        // RIGHT END ONLY, so percent must run BEFORE the range rule or the sign is stranded after `mus rau`.
        expect(normalizeHmong("5-10%")).toBe("5 mus rau 10 feem pua");
    });

    // `duas` — the corpus DEFINES it, naming the sign and the word in one sentence: "Lub cim rau duas yog
    // ib daim ntawv loj S … : $." The magnitude stays BETWEEN the number and the noun (`$10 lab` is ten
    // MILLION dollars), and is re-emitted rather than consumed (trap 10).
    test("currency is `duas`, postposed, with the magnitude kept in place", () => {
        expect(normalizeHmong("$10 lab")).toBe("10 lab duas");
        expect(normalizeHmong("US$30")).toBe("30 duas"); // ⚠ `US` consumed — a stated limit, see normalize.ts
        expect(normalizeHmong("US $ 46,330")).toBe("46330 duas");
        expect(say("$10 lab")).toBe("kau̯˩̰ la˥ duə̯˩"); // was: the $ SILENT
    });

    // ⚠ A DOWNGRADE FROM A WRONG READING TO A SILENCE, NOT A FIX — recorded in ACCEPTED_SIGN_SILENCE.hmn.
    // What it replaces is the scale letter reaching the IPA raw, and `c` is a real Hmong onset so a stray
    // `C` is not even visibly foreign. The COORDINATE `°` is deliberately NOT claimed: a compass direction
    // is contentful where a scale name beside `° C` is not.
    test("`° C` is consumed unread; the coordinate `°` is left alone", () => {
        expect(normalizeHmong("25 ° C")).toBe("25");
        expect(say("1 mus rau 25 ° C")).toBe("ʔi˥ mu˩ ʈau̯˧ nẽ˩ ᵑɡau̯˩̰ t͡ʂi˥"); // was: … t͡ʂi˥ C
        expect(normalizeHmong("ntawm 50 ° N. M.")).toBe("ntawm 50 ° N. M.");
    });

    // ⚠ THE ASCII EXPONENT, and it is a real defect rather than tidying: `357.021 km2` read the `2` as the
    // CARDINAL *ob*, which is the `za` `810km2` finding reproduced. No unit word exists for hmn (see
    // normalize.ts on why `kis lus mev` was declined), so the `²` itself stays dropped and hmn is NOT
    // recorded as an accepted silence for `exponent`.
    test("`km2` folds onto `km²` so the exponent stops reading as a cardinal", () => {
        expect(normalizeHmong("9,85 lab km2")).toBe("9 8 5 lab km²");
        expect(say("357.021 km2")).not.toContain("ʔɒ˥"); // no stray *ob*
    });

    // ⚠ ×0 IN THE CORPUS — robustness for plausible input, not a measured repair (trap 22's discipline).
    // Spaced on both sides deliberately: `A&B` deletes to `AB`, one token instead of two (traps 18/26).
    test("the ampersand is `thiab`, and it restores the token boundary", () => {
        expect(normalizeHmong("A & B")).toBe("A thiab B");
        expect(normalizeHmong("A&B")).toBe("A thiab B");
    });

    // ⚠ THE REFUSALS, PINNED SO THEY STAY REFUSALS. Omitting a plus is lossless; omitting a MINUS INVERTS,
    // and no Hmong word for a negative quantity is attested anywhere — so this stays silent AND stays out of
    // ACCEPTED_SIGN_SILENCE, i.e. `review.ts --lang hmn` stays red on it (trap 24).
    test("the minus is left silent and the refusal is deliberate", () => {
        expect(normalizeHmong("-71,2 ° C")).toBe("-71 2");
        expect(normalizeHmong("+45,4 ° C")).toBe("+45 4");
    });

    // Roman numerals are converted upstream by registry.ts (hmn is not in ROMAN_NATIVE).
    // ⚠ THIS MUST GO THROUGH `phonemize`, NOT `engine.text()`, AND THE FIRST DRAFT OF IT DID NOT — which is
    // trap 16's "verify it end-to-end, not in the layer" reproducing itself immediately. `core/roman.ts` is
    // applied in `registry.ts` WRAPPING `engine.text()`, so a test calling `text()` directly sees the roman
    // numeral untouched and would have reported a seam that works as broken.
    test("roman numerals are already digits by the time this layer runs", () => {
        expect(phonemize("II", "hmn").trim()).toBe("ʔɒ˥"); // `ob`, two — not two letters
    });
});
