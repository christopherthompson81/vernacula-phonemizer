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
 * The consequence is a version floor. `getBuiltinModule` landed in Node 20.16 and 22.3, so the API floor is
 * the earlier of those — but package.json declares `>=22.3`, because 22 is the only line CI runs and a
 * declared floor should be one that is tested rather than one that is merely believed.
 *
 * ⚠ AND IT AUTO-INSTALLS, because the alternative was 96 tools and 290 test files each remembering an
 * import. `getDefaultDataSource()` returns undefined off Node, so a browser reaches `setDataSource()` or a
 * clear error — never a silent wrong answer.
 *
 * Root resolution — the env override, then the checkout, then the `vernacula-phonemizer-data` package —
 * lives here rather than in dataPath.ts because it answers "where on THIS filesystem", which is what a
 * data source owns; dataPath.ts only ever produces the key.
 */
import type { DataSource } from "./dataSource.ts";
import { env } from "./env.ts";

/** The `fs` surface this module uses — two calls, and `readFileSync` is the one the engine runs on. */
interface NodeFs {
    readFileSync(path: string): Uint8Array;
    existsSync(path: string): boolean;
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

/** A `file:` URL → a filesystem path, by hand: `fileURLToPath` would be a `node:url` import and this file
 *  is deliberately free of them (see the header). */
function urlToPath(url: string): string {
    let p = decodeURIComponent(url.replace(/\\/gu, "/"));
    if (p.startsWith("file://")) p = p.slice("file://".length);
    // `file:///C:/…` → `/C:/…`; drop the leading slash so the drive letter starts the path.
    return /^\/[A-Za-z]:/u.test(p) ? p.slice(1) : p;
}

/**
 * Where the data tree is, in priority order:
 *
 *   1. `VERNACULA_DATA_DIR` — an explicit answer always wins, for deployments that ship assets elsewhere.
 *   2. `<repo>/data`, from this module's own location. THE CHECKOUT COMES BEFORE THE DEPENDENCY: 96 tools,
 *      290 test files and the C# parity harness all read the live tree, and a stale installed copy
 *      shadowing it would make them measure a different corpus than the one under edit — silently, since
 *      every file would still resolve.
 *   3. the `vernacula-phonemizer-data` package. `data/` is published as its own package (the tree IS the
 *      artifact — it is owned by no engine, and the C# port consumes the same one), so an installed
 *      consumer finds it there and `<pkg>/data` does not exist for them at all.
 *
 * ⚠ `import.meta.resolve` IS SYNCHRONOUS AND IS NOT A `node:` IMPORT, which is the only reason step 3 fits
 * a synchronous seam written to keep the module graph free of Node. It throws when the package is absent —
 * hence the try — and resolution is relative to THIS module, so an installed engine finds the data package
 * hoisted beside it.
 */
export interface DataRootProbes {
    /** read an environment variable (`core/env.ts` in production) */
    env: (name: string) => string | undefined;
    /** does this directory exist? */
    exists: (path: string) => boolean;
    /** resolve a package specifier to a URL; THROWS when the package is absent */
    resolve: (specifier: string) => string;
    /** the module URL the checkout is derived from */
    moduleUrl: string;
}

/**
 * The resolution itself, with its three inputs injected — this is the entire behavioural payload of the
 * data-package split, and every branch of it is otherwise reachable only from an installed tarball.
 * `test/data-package.test.ts` drives all four cases through here; `dataRoot` below is the production wiring.
 */
export function resolveDataRoot(p: DataRootProbes): string {
    const override = p.env("VERNACULA_DATA_DIR");
    if (override !== undefined) return override;

    const url = p.moduleUrl.replace(/\\/gu, "/");
    // ⚠ GUARD THE `/src/` SPLIT. A bundler that rewrites `import.meta.url` to a chunk URL leaves no
    //   `/src/` segment, and `slice(0, -1)` would then silently chop the URL's LAST CHARACTER — the
    //   eventual ENOENT would name `…/index.j/data/…`, a directory that never existed. Fall back to the
    //   module's own directory so the path in the error is at least a real place to look.
    const cut = url.lastIndexOf("/src/");
    const repo = `${urlToPath(url.slice(0, cut < 0 ? url.lastIndexOf("/") : cut))}/data`;
    if (p.exists(repo)) return repo;

    try {
        const pkg = p.resolve("vernacula-phonemizer-data/package.json");
        return urlToPath(pkg.slice(0, pkg.lastIndexOf("/")));
    } catch {
        // Fall through to the checkout path so the error names a real directory rather than a resolution
        // failure — `readFileSync` then reports the missing key, which is the actionable message.
        return repo;
    }
}

/** Production wiring for {@link resolveDataRoot}. `resolve` is wrapped rather than passed by reference:
 *  `import.meta.resolve` is bound to this module, which is what makes step 3 find the data package hoisted
 *  beside an installed engine. */
function dataRoot(fs: NodeFs): string {
    return resolveDataRoot({
        env,
        exists: (path) => fs.existsSync(path),
        resolve: (specifier) => import.meta.resolve(specifier),
        moduleUrl: import.meta.url,
    });
}

/** A DataSource over the local filesystem, rooted at `root` (default: whatever `dataRoot` resolves — the
 *  env override, the checkout, then the data package), or `undefined` when this runtime has no `fs`.
 *  Keys are `/`-joined onto the root — Node accepts `/` on every platform. */
export function nodeDataSource(root?: string): DataSource | undefined {
    const fs = builtinFs();
    if (fs === undefined) return undefined;
    const base = root ?? dataRoot(fs);
    return { read: (key: string): Uint8Array => fs.readFileSync(`${base}/${key}`) };
}
