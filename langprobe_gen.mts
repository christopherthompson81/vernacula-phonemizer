import { readFileSync, writeFileSync } from "node:fs";
import { phonemize, phonemizeAsync } from "./src/index.ts";
const lines = readFileSync(process.argv[2]!, "utf8").split("\n").filter((l) => l.length > 0);
const lang = process.argv[3]!, mode = process.argv[4]!;
const out: string[] = [];
for (const t of lines) out.push(((mode === "async" ? await phonemizeAsync(t, lang) : phonemize(t, lang)) as string).replace(/\n/gu, "\\n"));
writeFileSync(process.argv[5]!, out.join("\n") + "\n");
