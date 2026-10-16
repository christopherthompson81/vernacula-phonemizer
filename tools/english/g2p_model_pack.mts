/**
 * Convert the English OOV G2P model between JSON (what `tools/english/en_g2p_ngram.ts --emit` writes, readable) and
 * `g2p-model.bin` (what the engines load; layout in src/languages/english/g2pModelBinary.ts).
 *
 *   npx tsx tools/english/g2p_model_pack.mts pack <g2p-model.json> <g2p-model.bin>
 *   npx tsx tools/english/g2p_model_pack.mts unpack <g2p-model.bin>      # JSON to stdout, for reading
 *
 * `pack` refuses to write unless the binary decodes back to exactly the input.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import {
    decodeG2pModel,
    encodeG2pModel,
    packG2pModel,
    unpackG2pModel,
} from "../../src/languages/english/g2pModelBinary.ts";

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "pack" && a && b) {
    const model = JSON.parse(readFileSync(a, "utf8"));
    const bytes = encodeG2pModel(packG2pModel(model));
    if (!isDeepStrictEqual(unpackG2pModel(decodeG2pModel(bytes)), { minCount: 0, ...model })) {
        console.error("pack: the binary does not decode back to the input; nothing written");
        process.exit(1);
    }
    writeFileSync(b, bytes);
    console.log(`${b}: ${bytes.length} bytes (JSON ${readFileSync(a).length}), round trip exact`);
} else if (cmd === "unpack" && a) {
    process.stdout.write(JSON.stringify(unpackG2pModel(decodeG2pModel(new Uint8Array(readFileSync(a))))) + "\n");
} else {
    console.error("usage: g2p_model_pack.mts pack <model.json> <out.bin> | unpack <in.bin>");
    process.exit(2);
}
