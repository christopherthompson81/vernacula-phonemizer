// Module resolve hook for the `symbols` dump: every import of src/core/normalizeSymbols.ts except the
// wrapper's own is redirected to symbols-wrap.ts, which records each makeSymbolNormalizer(d) and its calls.
const WRAP = new URL("./symbols-wrap.ts", import.meta.url).href;

export async function resolve(specifier, context, next) {
    const r = await next(specifier, context);
    if (r.url.endsWith("/src/core/normalizeSymbols.ts") && context.parentURL !== WRAP)
        return { ...r, url: WRAP, shortCircuit: true };
    return r;
}
