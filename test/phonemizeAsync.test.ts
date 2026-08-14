import { describe, expect, test } from "vitest";

import { phonemize, phonemizeAsync } from "../src/index.ts";

// phonemizeAsync — the unified best-output entry. Routes the unpointed abjads (Arabic + dialects, Hebrew) through
// their neural restorers and the neural-upgrade languages (en BiLSTM OOV, bn/da/nb/fr taggers, ur/ps/pnb riders)
// through their ONNX models; every other language resolves synchronously (identical to `phonemize`). onnxruntime-node
// is a shipped dependency, so the neural paths are exercised here.
describe("phonemizeAsync — unified async best-output entry", () => {
    test("non-neural languages pass through byte-identical to the sync phonemize", async () => {
        for (const [w, l] of [["भारत", "hi"], ["Türkçe", "tr"], ["Україна", "uk"], ["ਪੰਜਾਬੀ", "pa"], ["世界", "cmn"]] as [string, string][]) {
            expect(await phonemizeAsync(w, l)).toBe(phonemize(w, l));
        }
    });

    test("the unpointed ABJADS restore unwritten vowels from BARE input (not the sync skeleton)", async () => {
        expect(await phonemizeAsync("עברית", "he")).toBe("ʔivʁit"); // Hebrew NAKDAN; sync would give the skeleton ʔvʁjt
        expect(await phonemizeAsync("العربية", "ar")).toBe("alʕarabˈijːa"); // Arabic diacritizer
        // the async abjad output is genuinely richer than the bare-text sync skeleton
        expect(await phonemizeAsync("עברית", "he")).not.toBe(phonemize("עברית", "he"));
    });

    test("English OOV routes through the BiLSTM tagger (a genuinely out-of-dictionary word resolves)", async () => {
        const out = await phonemizeAsync("computerization", "en");
        expect(out.length).toBeGreaterThan(0);
        expect(out).toContain("kəmpj"); // the BiLSTM reading of the OOV onset
    });

    test("the Perso-Arabic RIDERS route without throwing (incl. pnb→the rider's `pa` key)", async () => {
        // Regression: pnb (Shahmukhi Punjabi) must map to the rider's Punjabi key `pa`, not the invalid "pnb".
        for (const [w, l] of [["اردو", "ur"], ["پښتو", "ps"], ["پنجابی", "pnb"]] as [string, string][]) {
            const out = await phonemizeAsync(w, l);
            expect(out.length).toBeGreaterThan(0); // resolves (does not throw)
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// THE REGISTRY PRE-PASSES ON THE ASYNC PATH.
//
// `phonemize` reaches them through `getPhonemizer`, which wraps every engine's `text`. `phonemizeAsync` goes
// through `neuralRegistry.ts`, whose entries build their engine directly — so for a long time it reached NONE
// of them, and the failure was SILENT: the number simply vanished (`phonemizeAsync("سال ۲۰۲۴ ۾", "sd")` was
// *sˈaːlʊ mˈẽ*, losing the language's OWN script's digits), `<i>` was spoken aloud, `XIV` was read as a word,
// and an embedded foreign run was dropped for want of a host. Two entries had already been written the right
// way; the other ten were copies made before that pattern existed. These tests exist so the eleventh copy
// cannot be.
//
// The invariant is stated so it holds for EVERY async language, including the abjads whose async output is
// legitimately different from their sync output: the payload has to CONTRIBUTE something. Comparing to the
// same sentence with the payload deleted catches a silent drop without pinning a reading.
const PRE_PASS_PROBES: ReadonlyArray<{ pass: string; payload: string }> = [
    { pass: "native digits (foldNativeDigits)", payload: "۲۰۲۴" },
    { pass: "Devanagari digits (foldNativeDigits)", payload: "२०२४" },
    { pass: "fullwidth digits (foldFullwidthLatin)", payload: "２０２４" },
    { pass: "vulgar fractions (foldVulgarFractions)", payload: "¾" },
    { pass: "Roman numerals (normalizeRomans)", payload: "XIV" },
    { pass: "℃ (foldSquaredDegrees)", payload: "20℃" },
];

/** A native-script frame per async language, so each probe is real text for that engine. `@` is the payload. */
const FRAMES: Readonly<Record<string, string>> = {
    en: "Year @ end", sd: "سال @ ۾", af: "Jaar @ einde", bn: "বছর @ শেষ", da: "År @ slut",
    nb: "År @ slutt", fr: "Année @ fin", fa: "سال @ پایان", he: "שנת @ סוף", km: "ឆ្នាំ @ ចប់",
    ur: "سال @ ختم", ps: "کال @ پای", pnb: "سال @ ختم",
    ar: "سنة @ نهاية", arz: "سنة @ نهاية", apc: "سنة @ نهاية", ajp: "سنة @ نهاية", apd: "سنة @ نهاية",
    acm: "سنة @ نهاية", afb: "سنة @ نهاية", acw: "سنة @ نهاية", ary: "سنة @ نهاية", ayl: "سنة @ نهاية",
};

describe("phonemizeAsync — the shared registry pre-passes reach the neural path too", () => {
    // The languages where sync and async are supposed to agree EXCEPT on the neural upgrade — i.e. everything
    // but the abjads (Arabic family, Hebrew), whose async path restores vowels the script does not write, and
    // the three whose upgrade legitimately moves the reading of the frame itself (see the per-case notes).
    test.each(["sd", "af", "bn", "da", "nb", "fr", "ur", "ps", "pnb"])(
        "%s — sync and async agree on every pre-pass probe",
        async (lang) => {
            for (const { pass, payload } of PRE_PASS_PROBES) {
                const input = FRAMES[lang]!.replace("@", payload);
                expect(await phonemizeAsync(input, lang), `${lang}: ${pass}`).toBe(phonemize(input, lang));
            }
        },
    );

    // Stated as "the payload must CONTRIBUTE", which is the form that survives a legitimately different async
    // reading: en's BiLSTM reads the frame's OOV words differently, km re-segments it, and the abjads vocalize
    // it — none of which licenses the number disappearing.
    test.each(Object.keys(FRAMES))("%s — no pre-pass payload is silently dropped on the async path", async (lang) => {
        const bare = await phonemizeAsync(FRAMES[lang]!.replace("@", "").replace(/\s+/gu, " ").trim(), lang);
        for (const { pass, payload } of PRE_PASS_PROBES) {
            const withPayload = await phonemizeAsync(FRAMES[lang]!.replace("@", payload), lang);
            expect(withPayload, `${lang}: ${pass} vanished`).not.toBe(bare);
        }
    });

    test("MARKUP is stripped on the async path, not spoken", async () => {
        // `<i>` used to reach the phoneme stream: en said *aᶦ*, Arabic said *ʔˈasˤɣar mˈin* ("less than").
        expect(await phonemizeAsync("Year <i>2024</i> end", "en")).toBe(phonemize("Year <i>2024</i> end", "en"));
        expect(await phonemizeAsync("Year <i>2024</i> end", "en")).toBe(await phonemizeAsync("Year 2024 end", "en"));
    });

    test("a FOREIGN run keeps its host on the async path (it used to be dropped outright)", async () => {
        // `pushHost` lives in the registry wrapper, so the neural entries ran with an empty host stack;
        // `readForeignRun` then declined and the run left no gap for `assembleClauses` to fill.
        for (const lang of ["en", "sd", "bn", "af", "da", "nb", "fr", "km", "ur"]) {
            const input = FRAMES[lang]!.replace("@", "Владимир");
            expect(await phonemizeAsync(input, lang), lang).toBe(phonemize(input, lang));
        }
    });

    test("the pre-passes are applied ONCE, not twice (stripMarkup is not idempotent)", async () => {
        // `&amp;lt;i&amp;gt;` is an author writing ABOUT a tag: one pass decodes it to the literal text `&lt;i&gt;`,
        // a second would decode that to `<i>` and strip it as markup. The rider/Persian entries render through
        // `renderInHost` rather than `getPhonemizer` for exactly this reason.
        for (const lang of ["ur", "ps", "pnb", "fa"]) {
            const input = FRAMES[lang]!.replace("@", "&amp;lt;i&amp;gt;");
            expect(await phonemizeAsync(input, lang), lang).toBe(phonemize(input, lang));
        }
    });

    test("te's digit-fold OPT-OUT is not re-implemented by the async path", async () => {
        // Telugu ౦ is a homoglyph for the anusvara ం; the registry must NOT fold it and Telugu folds itself.
        // te has no async entry, so `phonemizeAsync` falls through to `phonemize` — this pins that it stays so,
        // since a future async entry for te would otherwise inherit the fleet-wide fold and pre-empt it.
        const input = "సంవత్సరం ౨౦౨౪ ముగింపు";
        expect(await phonemizeAsync(input, "te")).toBe(phonemize(input, "te"));
    });
});
