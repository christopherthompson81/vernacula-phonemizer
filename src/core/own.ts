/**
 * Own-key lookup on a plain-object table.
 *
 * ⚠ A BARE `table[key]` ALSO READS `Object.prototype`. When `key` comes from the text being read, an inherited
 * member counts as a hit. This shipped five times: `&constructor;` (markup), `toString/apples` (English
 * slash rule), `constructor1` (wuu and yue syllables), and the English unit tables. Each spoke the function's
 * source or invented a reading. Every text-keyed lookup on a plain object goes through this helper; tables
 * parsed by `parseJsonc` are null-prototype already.
 */
export function own<V>(table: Readonly<Record<string, V>> | undefined, key: string): V | undefined {
    return table !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;
}
