/**
 * The Node implementation of the data seam — read a key from the repo-root `data/` tree, synchronously.
 *
 * ⚠ IT REACHES `fs` THROUGH `process.getBuiltinModule`, NOT THROUGH `import "node:fs"`, AND THAT IS THE
 * WHOLE TRICK. The seam has to be SYNCHRONOUS (see dataSource.ts), so a lazy `await import("node:fs")` is
 * not available; a static one would put `node:fs` in the module graph of every language module, which is
 * exactly the coupling this change exists to remove — a browser bundler resolves the graph whether or not
 * the branch runs. `process.getBuiltinModule` is a plain synchronous property access on an object that
 * simply does not exist in a browser, so the file has no bundler-visible Node dependency at all and no
 * `browser` field / alias config is imposed on a consumer.
 *
 * The consequence is the version floor in package.json `engines`: `getBuiltinModule` is Node ≥20.16/≥22.3.
 *
 * ⚠ AND IT AUTO-INSTALLS, because the alternative was 96 tools and 290 test files each remembering an
 * import. `getDefaultDataSource()` returns undefined off Node, so a browser reaches `setDataSource()` or a
 * clear error — never a silent wrong answer.
 *
 * `VERNACULA_DATA_DIR` overrides the root, for deployments that ship the assets elsewhere. It lives here
 * rather than in dataPath.ts because it answers "where on THIS filesystem", which is what a source owns.
 */
import type { DataSource } from "./dataSource.ts";
import { env } from "./env.ts";

/** The `fs` surface this module uses — one call, which is the finding that made the browser port tractable. */
interface NodeFs {
    readFileSync(path: string): Uint8Array;
}

/** Node's `fs`, or undefined when there is no Node under us (a browser, a worker, Deno without the shim). */
function builtinFs(): NodeFs | undefined {
    const p = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process;
    try {
        return p?.getBuiltinModule?.("fs") as NodeFs | undefined;
    } catch {
        return undefined; // a runtime that exposes `process` but not the builtin registry
    }
}

/** `<repo>/data`, from this module's own location (`<repo>/src/core/`) — decoded by hand, since
 *  `fileURLToPath` would be a `node:url` import and this file is deliberately free of them. */
function dataRoot(): string {
    const override = env("VERNACULA_DATA_DIR");
    if (override !== undefined) return override;
    const url = import.meta.url.replace(/\\/gu, "/");
    let base = decodeURIComponent(url.slice(0, url.lastIndexOf("/src/")));
    if (base.startsWith("file://")) base = base.slice("file://".length);
    // `file:///C:/…` → `/C:/…`; drop the leading slash so the drive letter starts the path.
    if (/^\/[A-Za-z]:/u.test(base)) base = base.slice(1);
    return `${base}/data`;
}

/** A DataSource over the local filesystem, rooted at `root` (default: the repo's `data/`), or `undefined`
 *  when this runtime has no `fs`. Keys are `/`-joined onto the root — Node accepts `/` on every platform. */
export function nodeDataSource(root = dataRoot()): DataSource | undefined {
    const fs = builtinFs();
    if (fs === undefined) return undefined;
    return { read: (key: string): Uint8Array => fs.readFileSync(`${root}/${key}`) };
}
