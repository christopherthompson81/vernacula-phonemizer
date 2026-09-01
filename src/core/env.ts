/**
 * Read an environment variable without assuming there is an environment.
 *
 * ⚠ A BARE `process.env.X` IS A ReferenceError IN A BROWSER, NOT `undefined`. Every reader here is an
 * opt-in override (`FA_ORT_EP` and friends select an ONNX execution provider; CPU is the shipping
 * default), so the browser answer is "unset" — but written bare it is a crash on the neural path instead,
 * which is the one place a fallback contract is supposed to hold.
 */
export function env(name: string): string | undefined {
    const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    return p?.env?.[name];
}
