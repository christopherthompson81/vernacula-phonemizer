/**
 * Acronyms read letter-by-letter although their lowercase form is a word (#1422).
 *
 * ⚠ THE DICTIONARY CANNOT EXPRESS THIS CLASS, which is the whole reason the list exists. CMUdict is
 * keyed lowercase, so `tso` is General Tso and `ado` is the word — and `isRecorded` then hands the
 * ALL-CAPS token to the dictionary and it reads as that word. The list is consulted BEFORE `isRecorded`
 * and only for all-caps runs, so it separates the pair the dictionary conflates.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { MANIFEST } from "../src/languages/english/manifest.ts";

/**
 * What the pass EMITS when it spells a token out: the letters, with the manifest's
 * `letterNameExceptions` applied.
 *
 * ⚠ AND IT READS THE MANIFEST, NOT A COPY OF IT. A hand-typed `{ a: "ay", i: "eye" }` here would make
 * the word "derived" false in the only way that matters: adding a third exception to english.jsonc
 * would fail every case containing that letter while the engine was in fact correct, and removing one
 * would leave the test asserting a string the pass can never emit.
 *
 * ⚠ THE OBVIOUS HELPER IS CONTAMINATED BY #1423 and gives a wrong expectation. Phonemizing the bare
 * letters (`"I O S"`) reads ⟨A⟩ as the indefinite article and drops ⟨I⟩'s stress, so the "expected"
 * column would be wrong rather than the engine — which is exactly how the first measurement of this
 * class reported 91 failures instead of 50.
 */
const letters = (w: string): string =>
    phonemize([...w.toLowerCase()]
        .map((l) => MANIFEST.letterNameExceptions[l] ?? l).join(" "), "en");

describe("an all-caps run that is letters, not a word", () => {
    // ⚠ THE REPORTED CASE, and the pair the dictionary cannot hold: the capitalised form is the dish.
    test("TSO is letters and Tso is the dish", () => {
        expect(phonemize("TSO", "en")).toBe("tʰˈiː ˈɛs ˈoᶷ");
        expect(phonemize("The TSO issued a notice.", "en")).toContain("tʰˈiː ˈɛs ˈoᶷ");
        expect(phonemize("General Tso's chicken", "en")).toContain("tsˈoᶷz");
    });

    // ⚠ EVERY ROW HAS TWO SIGNALS: espeak-ng's curated `$abbrev` list names it, AND the engine's own
    // reading was an invented word rather than a letter sequence. Asserted against the spelled form
    // rather than a typed string, so the expectation is derived.
    test.each(["EXE", "IOS", "IPA", "OS", "LA", "EST", "GI", "AE", "UUID", "NYSE", "SAE", "XY",
        "ADO", "EG", "DIY", "IMO", "OTOH", "ISP", "IRC", "UEFI"])("%s spells out", (w) => {
        expect(phonemize(w, "en")).toBe(letters(w));
    });

    /**
     * ⚠ THE LIST IS CASE-GATED, AND THAT IS THE POINT. Only an all-caps run reaches the pass, so every
     * lowercase word here is untouched — which is what makes adding `ado`, `la`, `os`, `est` and `gi`
     * safe at all. espeak marks those same rows `$allcaps`, the same gate reached independently.
     */
    test.each([
        ["ado", "ədˈuː"], ["la", "lˈɑː"], ["os", "ˈɑːs"], ["est", "ˈɛst"], ["gi", "ɡˈɪ"],
    ])("the lowercase %s is still the word", (w, ipa) => expect(phonemize(w, "en")).toBe(ipa));

    test("in running prose the words survive", () => {
        expect(phonemize("much ado about nothing", "en")).toContain("ədˈuː");
        expect(phonemize("he lives in la", "en")).toContain("lˈɑː");
    });

    /**
     * ⚠ FOUR ESPEAK ROWS ARE DELIBERATELY ABSENT, because the reading here is ALREADY right. `AAA` is
     * "triple-A", which is what people say; `ESPN` and `LAPD` are FUSED letter readings — one token,
     * one stress — which `initialisms.ts` explicitly prefers over spelling out; and `dr` has its own
     * considered rule in normalize.ts (drive vs doctor) that runs before this pass.
     */
    test("the exclusions keep their existing reading", () => {
        expect(phonemize("AAA", "en")).toBe("tɹˌɪpəlˈeᶦ");
        expect(phonemize("ESPN", "en")).toBe("ˌiːʲˌɛspˌiːʲˈɛn");
        expect(phonemize("LAPD", "en")).toBe("ˌɛlˌeᶦpʰˌiːdˈiː");
        expect(phonemize("DR", "en")).toBe("dɹˈaᶦv");
    });

    /**
     * ⚠ A SHOUTING DOCUMENT STILL WINS, and the ordering is deliberate rather than an oversight: the
     * pass returns early when the text has no lowercase at all, BEFORE this list is consulted, because
     * capitals carry no signal there. The cost is that an all-caps heading does not get the benefit —
     * pinned here so it reads as the documented trade and not as a gap.
     */
    test("an all-caps document is still exempt", () => {
        expect(phonemize("TSO NOTICE BOARD LIST", "en")).toContain("tsˈoᶷ");
        expect(phonemize("The TSO notice board", "en")).toContain("tʰˈiː ˈɛs ˈoᶷ");
    });
});
