import { readFileSync } from "node:fs";
import { phonemize } from "./src/index.ts";
const codes = readFileSync("/tmp/all_codes.txt", "utf8").split("\n").filter(Boolean);
const lines = readFileSync("/tmp/numprobes.txt", "utf8").split("\n").filter(Boolean);
for (const c of codes) for (const l of lines) {
    let o: string; try { o = phonemize(l, c); } catch (e) { o = "THREW"; }
    console.log(`${c}\t${l}\t${o}`);
}
