/**
 * Resolve a module's data file to its KEY in the shared asset store — e.g. `languages/thai/syllables.tsv`.
 *
 * ⚠ DATA IS OWNED BY NO ENGINE. The TypeScript engine and the C# port (csharp/) load the same files by the
 * same keys: a module at `src/languages/thai/` asking for `syllables.tsv` gets the key
 * `languages/thai/syllables.tsv`, and the C# `DataPath.Resolve` resolves that identical string. Assets
 * living beside the TS modules made the TS engine their implicit owner and every other consumer a
 * path-guesser into someone else's source tree.
 *
 * ⚠ A KEY, NOT A PATH — AND NOT A `node:path` JOIN. These used to return absolute filesystem paths, which
 * made every one of the 15 loaders a Node module. A key is a plain `/`-joined string that the installed
 * DataSource interprets: the Node source joins it onto `data/`, a browser consumer looks it up in a Map.
 * Nothing here touches a filesystem, so this file has no Node imports and works unchanged in a browser.
 *
 * The mapping is mechanical: the module's directory under `src/` is mirrored under `data/`. Call sites keep
 * passing `import.meta.url` exactly as before — this is the single choke point that translates them.
 */

/** `import.meta.url` → the caller's directory key (`languages/thai`), by pure string surgery on the URL.
 *  Accepts `/` and `\` so a Windows `file:` URL resolves to the same key as a POSIX one. */
function moduleKey(metaUrl: string): string {
    const url = metaUrl.replace(/\\/gu, "/");
    const i = url.lastIndexOf("/src/");
    // ⚠ LOUD, NOT A GUESS. Before this file produced keys, a caller outside `src/` fell back to
    //   module-relative resolution — harmless when the answer was a path. As a key it would be a WRONG key
    //   that the data source then misses, or worse, hits: the failure would surface as a missing lexicon,
    //   i.e. a plausible wrong reading, which is the defect class the goldens are least able to see. The
    //   real cause of a miss here is a bundler that rewrote `import.meta.url` to a chunk URL; say so.
    if (i < 0) {
        throw new Error(
            `Cannot derive a data key from "${metaUrl}": no "/src/" segment. Engine modules must keep their source path in \`import.meta.url\` — a bundler that rewrites it to a chunk URL erases the only thing that names the data.`,
        );
    }
    return url.slice(i + "/src/".length, url.lastIndexOf("/"));
}

/** The key for `filename` in the calling module's data directory. */
export function dataFile(metaUrl: string, filename: string): string {
    const dir = moduleKey(metaUrl);
    // A module sitting directly in `src/` has an EMPTY directory key; `${dir}/${filename}` would then
    // produce a leading-slash key ("/x.jsonc") that Node's join happens to forgive and a Map lookup — or
    // the C# resolver — does not. Same string on both engines or the key is not a key.
    return dir === "" ? filename : `${dir}/${filename}`;
}

/** The calling module's data DIRECTORY key — for the loaders that read several files from one place.
 *  Join onto it with a plain `` `${dir}/${name}` ``; keys are `/`-separated on every platform. */
export function dataDir(metaUrl: string): string {
    return moduleKey(metaUrl);
}
