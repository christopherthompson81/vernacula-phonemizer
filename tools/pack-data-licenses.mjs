#!/usr/bin/env node
/**
 * Copy the licence set into `data/` before the data package is packed (its `prepack`).
 *
 * ⚠ THE DATA PACKAGE IS THE THING THAT CARRIES THE ATTRIBUTION OBLIGATION, NOT THE ENGINE. `NOTICE.md`
 * exists because this project "ships and distributes data derived from third-party sources", and two
 * upstreams (EDRDG's JMdict/KANJIDIC among them) require specific, named acknowledgement — "obligations,
 * not courtesies", in NOTICE.md's own words. Once `data/` is published as its own package, that package is
 * the artifact doing the distributing, so it is the one that must carry NOTICE.md, LICENSE and LICENSES/.
 * A bare tree of tables would be a licence violation, not merely an untidy package.
 *
 * Copied at pack time rather than committed, so the repo keeps ONE source of truth and the copies cannot
 * drift from it. They are gitignored; `test/data-package.test.ts` pins that `files` still names them.
 */
import { cpSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const data = join(repo, "data");

copyFileSync(join(repo, "LICENSE"), join(data, "LICENSE"));
copyFileSync(join(repo, "NOTICE.md"), join(data, "NOTICE.md"));
cpSync(join(repo, "LICENSES"), join(data, "LICENSES"), { recursive: true });
// ⚠ stderr, NOT stdout. `npm pack --json` writes its manifest to stdout and a prepack script shares it,
// so a friendly log line here lands INSIDE the JSON and every consumer of it fails to parse.
console.error("data package: copied LICENSE, NOTICE.md and LICENSES/ from the repo root");
