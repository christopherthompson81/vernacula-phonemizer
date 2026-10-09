// Recording stand-in for src/core/normalizeSymbols.ts, installed by symbols-hook.mjs for the `symbols` dump:
// the real module, except that makeSymbolNormalizer records its SymbolData, its caller and every call.
import * as real from "../../../src/core/normalizeSymbols.ts";
export * from "../../../src/core/normalizeSymbols.ts";

export interface SymbolRecord {
    data: real.SymbolData;
    stack: string;
    calls: Map<string, string>;
    /** The real normalizer, unrecorded. */
    apply: (text: string) => string;
}

const g = globalThis as { __symbolRecords?: SymbolRecord[] };
export const records: SymbolRecord[] = (g.__symbolRecords ??= []);

export function makeSymbolNormalizer(d: real.SymbolData): (text: string) => string {
    const f = real.makeSymbolNormalizer(d);
    const rec: SymbolRecord = { data: d, stack: new Error().stack ?? "", calls: new Map(), apply: f };
    records.push(rec);
    return (text: string): string => {
        const out = f(text);
        if (!rec.calls.has(text)) rec.calls.set(text, out);
        return out;
    };
}
