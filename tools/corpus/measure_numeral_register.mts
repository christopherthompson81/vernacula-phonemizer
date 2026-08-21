/**
 * SCORE A CANDIDATE NUMERAL REGISTER for one FLEURS language, against a phone recognizer.
 *
 * `numeral_register.mts` wires a register only where the audio says the readers use one, and every entry
 * there was established by exactly this measurement (investigation run 19). ⚠ THAT HARNESS DID NOT
 * SURVIVE, so the next candidate — ha_ng, which run 19 never covered — had to be scored by rebuilding it.
 * This file exists so the third one does not.
 *
 * The comparison is against BOTH recognizers now (`min` of wav2vec2 and the two allosaurus decodes), not
 * wav2vec2 alone as in run 19. ⚠ That matters here more than usual: a numeral register is a claim about
 * WHICH LANGUAGE a span is in, and wav2vec2 is espeak-labelled, so scoring an English reading against an
 * espeak-flavoured recognizer flatters English. The second recognizer removes that thumb on the scale.
 *
 *   npx tsx tools/corpus/measure_numeral_register.mts ha_ng ha
 *
 * Writes `<lang>_reg.tsv` (wav, native, en, fr) beside the corpus DB's work dir; score it with
 * `tools/corpus/asr-align/score_numeral_register.py`.
 */
import { phonemizeAsync } from "../../src/index.ts";
import { segmentsForRegister } from "./numeral_register.mts";
import { readFileSync, writeFileSync } from "node:fs";

const [lang, code, inPath, outPath] = process.argv.slice(2);
if (!lang || !code || !inPath || !outPath) {
    console.error("usage: measure_numeral_register.mts <fleurs_lang> <registry_code> <in.tsv> <out.tsv>");
    process.exit(2);
}

const rows = readFileSync(inPath, "utf8").split("\n").filter(Boolean);
const out: string[] = [];
for (const line of rows) {
    const [wav, ...rest] = line.split("\t");
    const text = rest.join("\t");
    const cells = [wav!, await phonemizeAsync(text, code)];
    for (const reg of ["en", "fr"] as const) {
        const parts: string[] = [];
        for (const s of segmentsForRegister(text, reg)) {
            parts.push(await phonemizeAsync(s.text, s.lang ?? code));
        }
        cells.push(parts.filter(Boolean).join(" "));
    }
    out.push(cells.join("\t"));
}
writeFileSync(outPath, out.join("\n"));
console.error(`${lang}: ${out.length} rows scored (native, en, fr)`);
