/**
 * Minimal but conformant JSONC parser: standard JSON plus `//` line comments, `/* *​/` block comments, and
 * trailing commas. It is STRING-AWARE — comments and commas that occur inside a string value (e.g. a
 * "https://…" URL, or a comma before a brace inside prose) are preserved verbatim — so it is safe on the
 * hand-authored .jsonc manifests where the old line-anchored regex was both under- (missed inline comments and
 * trailing commas) and potentially over-eager. Shared by every manifest/data loader.
 */

/** Strip JSONC comments and trailing commas, returning parseable JSON. String contents are preserved verbatim. */
export function stripJsonc(src: string): string {
    let out = "";
    const n = src.length;
    let i = 0;
    while (i < n) {
        const c = src[i]!;
        if (c === '"') {
            // string literal — copy verbatim, respecting \ escapes
            out += c;
            i++;
            while (i < n) {
                const d = src[i]!;
                out += d;
                if (d === "\\") {
                    out += src[i + 1] ?? "";
                    i += 2;
                    continue;
                }
                i++;
                if (d === '"') break;
            }
            continue;
        }
        if (c === "/" && src[i + 1] === "/") {
            // line comment → skip to end of line
            i += 2;
            while (i < n && src[i] !== "\n") i++;
            continue;
        }
        if (c === "/" && src[i + 1] === "*") {
            // block comment → skip to */
            i += 2;
            while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
            i += 2;
            continue;
        }
        if (c === ",") {
            // trailing comma → drop if only ws/comments precede a } or ]
            let j = i + 1;
            for (;;) {
                while (j < n && " \t\r\n".includes(src[j]!)) j++;
                if (src[j] === "/" && src[j + 1] === "/") {
                    j += 2;
                    while (j < n && src[j] !== "\n") j++;
                    continue;
                }
                if (src[j] === "/" && src[j + 1] === "*") {
                    j += 2;
                    while (j < n && !(src[j] === "*" && src[j + 1] === "/"))
                        j++;
                    j += 2;
                    continue;
                }
                break;
            }
            if (src[j] === "}" || src[j] === "]") {
                i++;
                continue;
            }
            out += c;
            i++;
            continue;
        }
        out += c;
        i++;
    }
    return out;
}

/** Parse JSONC (JSON + comments + trailing commas) to a typed value. */
export function parseJsonc<T = unknown>(src: string): T {
    return JSON.parse(stripJsonc(src)) as T;
}
