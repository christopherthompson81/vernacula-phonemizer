/**
 * Convert the POS model between JSON (the trainer's historical output, readable) and `pos-model.bin` (what
 * the engines load; layout in src/languages/english/posModelBinary.ts).
 *
 *   npx tsx tools/english/pos_model_pack.mts pack <model.json> <pos-model.bin>
 *   npx tsx tools/english/pos_model_pack.mts unpack <pos-model.bin>      # JSON to stdout, for reading
 *
 * `pack` refuses to write unless the binary decodes back to exactly the input.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import {
    decodePosModel,
    encodePosModel,
    packPosModel,
    unpackPosModel,
} from "../../src/languages/english/posModelBinary.ts";
import type { PosModel } from "../../src/languages/english/posTagger.ts";

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "pack" && a && b) {
    const model = JSON.parse(readFileSync(a, "utf8")) as PosModel;
    const bytes = encodePosModel(packPosModel(model));
    if (!isDeepStrictEqual(unpackPosModel(decodePosModel(bytes)), model)) {
        console.error("pack: the binary does not decode back to the input; nothing written");
        process.exit(1);
    }
    writeFileSync(b, bytes);
    console.log(`${b}: ${bytes.length} bytes (JSON ${readFileSync(a).length}), round trip exact`);
} else if (cmd === "unpack" && a) {
    process.stdout.write(JSON.stringify(unpackPosModel(decodePosModel(new Uint8Array(readFileSync(a))))) + "\n");
} else {
    console.error("usage: pos_model_pack.mts pack <model.json> <out.bin> | unpack <in.bin>");
    process.exit(2);
}
