const tails = new Map<string, Promise<void>>();

/**
 * Serializes async operations that share the same key so they can never
 * interleave. Used with a `ReportMode` as the key: batch generation,
 * regeneration and batch/document deletion all read-modify-write the same
 * mode's `Gerados` folder and `batches`/`documents` rows, and running two of
 * them concurrently for the same mode can otherwise race (one evacuating
 * files the other just wrote but hasn't persisted yet, or one deleting a
 * batch row while another is mid-regeneration of it).
 */
export function withModeLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previousTail = tails.get(key) ?? Promise.resolve();
  const run = previousTail.then(fn, fn);
  tails.set(
    key,
    run.then(
      () => undefined,
      () => undefined
    )
  );
  return run;
}
