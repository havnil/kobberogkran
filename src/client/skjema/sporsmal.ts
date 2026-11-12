// Spørsmålene i steg 2 (spesifikasjonen, «Skjemaet»): de felles spørsmålene og spørsmålene for hver
// tjeneste. Her står bare id-er, typer og valg. Etikettene kommer fra `tekster.skjema.sporsmal[id]`
// og `tekster.skjema.valg[valgNokkel(verdi)]` (tekst skrives av mennesker, i CMS-et).
//
// Svarene sendes som `felles` og `tjenesteSvar` i PATCH /api/foresporsel/:id. Bildespørsmålene
// sendes ikke som svar: de blir bildeopplastinger med `merke`, som AI-sorteringen ser etter
// (varmtvannstank: `typeskilt` og `tank`; brønn: `pumpe`).

export type SporsmalType = 'valg' | 'tekst' | 'bilde';

export interface Sporsmal {
  /** Nøkkel i svaret og i `tekster.skjema.sporsmal`. */
  id: string;
  gruppe: 'felles' | 'tjeneste';
  type: SporsmalType;
  /** Verdiene for `valg` (radioknapper). Etiketten er `tekster.skjema.valg[valgNokkel(verdi)]`. */
  valg?: readonly string[];
  /** For `bilde`: merket bildet lastes opp med. */
  merke?: string;
  /** Vises bare når et annet spørsmål har denne verdien. */
  visNar?: { id: string; verdi: string };
}

const valg = (id: string, verdier: readonly string[], gruppe: Sporsmal['gruppe'] = 'tjeneste'): Sporsmal => ({
  id,
  gruppe,
  type: 'valg',
  valg: verdier,
});
const tekst = (id: string, gruppe: Sporsmal['gruppe'] = 'tjeneste'): Sporsmal => ({ id, gruppe, type: 'tekst' });
const bilde = (id: string, merke: string): Sporsmal => ({ id, gruppe: 'tjeneste', type: 'bilde', merke });

const JA_NEI = ['ja', 'nei'] as const;
const JA_NEI_VET_IKKE = ['ja', 'nei', 'vet-ikke'] as const;

/** Felles for alle tjenester: vann, avløp, byggeår, adkomst og om kunden vil ha SMS eller samtale. */
export const FELLES: readonly Sporsmal[] = [
  valg('vann', ['kommunalt', 'bronn', 'vet-ikke'], 'felles'),
  valg('avlop', ['kommunalt', 'privat', 'vet-ikke'], 'felles'),
  tekst('byggear', 'felles'),
  tekst('adkomst', 'felles'),
  valg('kontaktform', ['sms', 'samtale'], 'felles'),
];

/** Lekkasje: om vannet er stengt, fukt, og om saken er meldt til forsikringen. */
const LEKKASJE: readonly Sporsmal[] = [
  valg('vannStengt', JA_NEI),
  valg('fukt', JA_NEI_VET_IKKE),
  valg('forsikringMeldt', JA_NEI),
];

const medVisNar = (liste: readonly Sporsmal[], visNar: Sporsmal['visNar']) => liste.map((s) => ({ ...s, visNar }));

/**
 * Spørsmålene for hver tjeneste (tabellen i spesifikasjonen). «Lekkasje» og «Tett avløp» er ikke egne
 * tjenester i skjemaet; de hører til service og reparasjon og vises etter hva problemet er.
 */
export const TJENESTE_SPORSMAL: Readonly<Record<string, readonly Sporsmal[]>> = {
  varmtvannstank: [
    bilde('bildeTypeskilt', 'typeskilt'),
    bilde('bildeTank', 'tank'),
    tekst('rom'),
    tekst('etasje'),
    valg('tilkobling', ['stikkontakt', 'fast', 'vet-ikke']),
  ],
  'service-og-reparasjon': [
    valg('problem', ['lekkasje', 'tett-avlop', 'annet']),
    ...medVisNar(LEKKASJE, { id: 'problem', verdi: 'lekkasje' }),
    { ...valg('antallAvlop', ['ett', 'flere']), visNar: { id: 'problem', verdi: 'tett-avlop' } },
  ],
  'bronn-og-vann': [
    valg('bronntype', ['borebronn', 'gravd', 'vet-ikke']),
    bilde('bildePumpe', 'pumpe'),
    tekst('symptom'),
    valg('vannprove', JA_NEI),
  ],
  bad: [tekst('maal'), tekst('oppstart'), valg('egneHandverkere', JA_NEI), valg('styregodkjenning', ['ja', 'nei', 'ikke-borettslag'])],
  hytte: [],
  annet: [],
};

/** Faste valg for «Hvor hørte du om oss?» (valgfritt). Etiketten er `tekster.skjema.hvorHorteValg[valgNokkel(v)]`. */
export const HVOR_HORTE = ['google', 'anbefaling', 'sosiale-medier', 'bilen', 'annet'] as const;

/** `vet-ikke` → `vetIkke`: nøkkelen til etiketten i `tekster`. */
export function valgNokkel(verdi: string): string {
  return verdi.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Spørsmålene for en tjeneste: tjenestens egne, så de felles. Lekker det nå, kommer lekkasje-
 * spørsmålene med uansett tjeneste (og uten vilkår).
 */
export function sporsmalFor(tjeneste: string, opts: { hast?: string } = {}): Sporsmal[] {
  let egne: Sporsmal[] = [...(TJENESTE_SPORSMAL[tjeneste] ?? [])];
  if (opts.hast === 'lekker-naa') {
    const lekkasjeIder = new Set(LEKKASJE.map((s) => s.id));
    const utenVilkar = ({ visNar: _v, ...s }: Sporsmal): Sporsmal => s;
    egne = egne.map((s) => (lekkasjeIder.has(s.id) ? utenVilkar(s) : s));
    for (const s of LEKKASJE) if (!egne.some((e) => e.id === s.id)) egne.push(s);
  }
  return [...egne, ...FELLES];
}

/** Alle spørsmål som finnes (for å rendre dem én gang), med tjenestene hvert spørsmål gjelder. */
export function alleSporsmal(): { sporsmal: Sporsmal; tjenester: string[] }[] {
  const ut = new Map<string, { sporsmal: Sporsmal; tjenester: string[] }>();
  for (const [tjeneste, liste] of Object.entries(TJENESTE_SPORSMAL)) {
    for (const s of liste) {
      const e = ut.get(s.id);
      if (e) e.tjenester.push(tjeneste);
      else ut.set(s.id, { sporsmal: s, tjenester: [tjeneste] });
    }
  }
  for (const s of LEKKASJE) if (!ut.has(s.id)) ut.set(s.id, { sporsmal: s, tjenester: [] });
  return [...ut.values()];
}

/** Navnet på skjemafeltet for et spørsmål. */
export const feltnavn = (id: string) => `sp-${id}`;

type Felter = { elements: HTMLFormControlsCollection } | HTMLFormElement;

function verdi(form: Felter, id: string): string {
  const el = form.elements.namedItem(feltnavn(id));
  if (!el) return '';
  if (el instanceof RadioNodeList) return el.value.trim();
  if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) return el.checked ? el.value.trim() : '';
  return 'value' in el ? String((el as HTMLInputElement).value).trim() : '';
}

/** Er spørsmålet aktuelt, gitt svarene i skjemaet? */
export function erSynlig(s: Sporsmal, form: Felter): boolean {
  return !s.visNar || verdi(form, s.visNar.id) === s.visNar.verdi;
}

/** Svarene fra skjemaet, fordelt på `felles` og `tjenesteSvar`. Tomme svar og skjulte spørsmål hoppes over. */
export function samleSvar(
  form: Felter,
  sporsmal: readonly Sporsmal[],
): { felles: Record<string, string>; tjenesteSvar: Record<string, string> } {
  const felles: Record<string, string> = {};
  const tjenesteSvar: Record<string, string> = {};
  for (const s of sporsmal) {
    if (s.type === 'bilde' || !erSynlig(s, form)) continue;
    const v = verdi(form, s.id);
    if (!v) continue;
    (s.gruppe === 'felles' ? felles : tjenesteSvar)[s.id] = v;
  }
  return { felles, tjenesteSvar };
}
