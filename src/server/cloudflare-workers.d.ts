// `cloudflare:workers` finnes bare i Workers-runtimen. @cloudflare/workers-types deklarerer modulen
// bare i den globale varianten (index.d.ts), som prosjektet ikke bruker, så den deklareres her.
// Bindingene er ikke generert (`wrangler types`), så route-ene caster `env` til vår `Env`.
declare module 'cloudflare:workers' {
  export const env: unknown;
}
