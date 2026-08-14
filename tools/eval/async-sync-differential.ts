/**
 * SYNC-vs-ASYNC DIFFERENTIAL over every neural language (neuralRegistry.ts).
 *
 * `phonemizeAsync` routes through `getNeuralPhonemizer`, `phonemize` through `getPhonemizer`. Only the
 * latter installs the registry's shared pre-passes (markup, native digits, fullwidth, vulgar fractions,
 * Roman numerals, the foreign-run host). This probe renders the SAME probe strings through both entries
 * and prints where they disagree, so a change to that routing can be measured rather than assumed.
 *
 * Each probe exercises one pre-pass. `usage: npx tsx tools/eval/async-sync-differential.ts [--full]`
 */
import { phonemize, phonemizeAsync } from "../../src/index.ts";
import { getNeuralPhonemizer } from "../../src/neuralRegistry.ts";

/** Every code with an async entry, in registry order. */
const LANGS = [
    "en", "sd", "af", "bn", "da", "nb", "fr", "fa", "he", "km", "ur", "ps", "pnb",
    "ar", "arz", "apc", "ajp", "apd", "acm", "afb", "acw", "ary", "ayl",
];

/** A native word per language, so the probe is real text for the engine rather than a bare fragment. */
const HOST: Record<string, string> = {
    en: "Year @ end", sd: "سال @ ۾", af: "Jaar @ einde", bn: "বছর @ শেষ", da: "År @ slut",
    nb: "År @ slutt", fr: "Année @ fin", fa: "سال @ پایان", he: "שנת @ סוף", km: "ឆ្នាំ @ ចប់",
    ur: "سال @ ختم", ps: "کال @ پای", pnb: "سال @ ختم",
};
const ARABIC_HOST = "سنة @ نهاية";

/** The pre-pass each probe fires, and the payload substituted for `@`. */
const PROBES: ReadonlyArray<{ pass: string; payload: string }> = [
    { pass: "native-digits", payload: "۲۰۲۴" },
    { pass: "markup", payload: "<i>2024</i>" },
    { pass: "entity", payload: "km&sup2;" },
    { pass: "fullwidth", payload: "２０２４" },
    { pass: "vulgar-fraction", payload: "¾" },
    { pass: "roman", payload: "XIV" },
    { pass: "squared-degrees", payload: "20℃" },
    { pass: "devanagari-digits", payload: "२०२४" },
];

function hostFor(lang: string): string {
    return HOST[lang] ?? ARABIC_HOST;
}

async function main(): Promise<void> {
    const rows: string[][] = [];
    let diffs = 0;
    for (const lang of LANGS) {
        if (!getNeuralPhonemizer(lang)) {
            rows.push([lang, "-", "NO ASYNC ENTRY", "", ""]);
            continue;
        }
        for (const { pass, payload } of PROBES) {
            const input = hostFor(lang).replace("@", payload);
            let s: string, a: string;
            try { s = phonemize(input, lang); } catch (e) { s = `THROW ${(e as Error).message}`; }
            try { a = await phonemizeAsync(input, lang); } catch (e) { a = `THROW ${(e as Error).message}`; }
            if (s === a) continue;
            diffs++;
            rows.push([lang, pass, input, s, a]);
        }
    }
    console.log(`| lang | pre-pass | input | sync | async |`);
    console.log(`| --- | --- | --- | --- | --- |`);
    for (const r of rows) console.log(`| ${r.join(" | ")} |`);
    console.log(`\n${diffs} disagreement(s) over ${LANGS.length} languages x ${PROBES.length} probes.`);
}

await main();
