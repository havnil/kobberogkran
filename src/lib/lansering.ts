// Is this a build meant for launch (`LAUNCH=true`)? Read through `import.meta.env`: the static pages
// are prerendered in workerd, where Node's process environment has no LAUNCH. Only `true` counts, as in the
// launch gate (scripts/check-launch.mjs).
type Env = { LAUNCH?: unknown };

/** The raw `LAUNCH` value as a string, or undefined when it is not set. */
export function launchVerdi(env: Env = import.meta.env as Env): string | undefined {
  return env.LAUNCH == null || env.LAUNCH === '' ? undefined : String(env.LAUNCH);
}

export function erLansering(env: Env = import.meta.env as Env): boolean {
  return launchVerdi(env) === 'true';
}
