// `cloudflare:email` finnes bare i Workers-runtimen. @cloudflare/workers-types deklarerer modulen
// bare i den globale varianten (index.d.ts), som prosjektet ikke bruker, så den deklareres her.
declare module 'cloudflare:email' {
  import type { EmailMessage as EmailMessageType } from '@cloudflare/workers-types';
  export const EmailMessage: {
    prototype: EmailMessageType;
    new (from: string, to: string, raw: ReadableStream | string): EmailMessageType;
  };
}
