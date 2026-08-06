/** Yoruba degrees and multiplication — the two refusals with real sign frequency, re-examined. */
import { readFileSync } from "node:fs";
import { literal, matches, wordAndSubstring } from "./count.ts";

const text = readFileSync(process.argv[2]!, "utf8");
const D = "\\p{Nd}[\\p{Nd}.,]*";
const c = (p: string): number => matches(text, p).length;
const lit = (w: string): string => w.split(" ").map(literal).join("\\s+");

console.log("── the TEMPERATURE frame: which order? ──");
for (const scale of ["Celsius", "Fahrenheit", "Kelvin"]) {
    console.log(`  ${scale}`);
    console.log(`    ìwọ̀n <n> ${scale}      ${c(`${lit("ìwọ̀n")}\\s+${D}\\s+${literal(scale)}`)}`
        + `   (untoned iwọn) ${c(`${lit("iwọn")}\\s+${D}\\s+${literal(scale)}`)}`);
    console.log(`    ìwọ̀n ${scale} <numeral>  ${c(`${lit("ìwọ̀n")}\\s+${literal(scale)}\\s+[\\p{L}]`)}`
        + `   (untoned) ${c(`${lit("iwọn")}\\s+${literal(scale)}\\s+[\\p{L}]`)}`);
    console.log(`    <n> ${scale} with no ìwọ̀n  ${c(`(?<!${lit("[ìi]wọ̀?n")}\\s)${D}\\s+${literal(scale)}`)}`);
    console.log(`    ${scale} anywhere          ${wordAndSubstring(text, scale).whole}`);
}

console.log("\n── the SIGN, and whether a scale letter follows it ──");
console.log(`  °C  ${c("°\\s?C")}      °F  ${c("°\\s?F")}      ° with no scale letter  ${c("°(?![CF])")}`);
console.log(`  ° digit-flanked (coordinates: 7°30′)  ${c(`(?<=\\p{Nd})\\s?°\\s?(?=\\p{Nd})`)}`);
console.log(`  ° trailing a number  ${c(`(?<=\\p{Nd})\\s?°`)}`);

console.log("\n── the ANGULAR degree word (the 4 digiri hits, split by sense) ──");
for (const w of ["digiri", "dìgírí", "dígírí"]) {
    const ms = matches(text, `(?<![\\p{L}\\p{M}])${literal(w)}(?![\\p{L}\\p{M}])`);
    for (const m of ms) console.log(`    ${w}: …${text.slice(Math.max(0, m.index - 40), m.index + 30).replace(/\n/gu, " ")}…`);
}

console.log("\n── MULTIPLICATION: what are the 72 digit-flanked × actually doing? ──");
for (const m of matches(text, `(?<=\\p{Nd})\\s?×\\s?(?=\\p{Nd})`).slice(0, 10))
    console.log(`    …${text.slice(Math.max(0, m.index - 45), m.index + 30).replace(/\n/gu, " ")}…`);
console.log("\n  candidate readings, digit-adjacent:");
for (const w of ["ìlọ́po", "ní", "nípa", "lọ́nà", "níbùú", "ìlọ́po méjì"])
    console.log(`    ${w.padEnd(12)} whole ${String(wordAndSubstring(text, w.split(" ")[0]!).whole).padStart(6)}`
        + `   digit×digit frame: ${c(`${D}\\s+${lit(w)}\\s+${D}`)}`);
