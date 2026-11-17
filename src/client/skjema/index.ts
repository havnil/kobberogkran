// Skjemaet i nettleseren (Skjema.astro). Ingenting lagres i nettleseren: ingen cookies, ingen
// localStorage eller sessionStorage. `idemNokkel` lages her (crypto.randomUUID), aldri i HTML-en.
import { sendBilderLenke } from '../../lib/skjemaSider';
import { renKilde } from '../../lib/whatsapp';
import { MAKS_BILDER } from '../../server/validering';
import { Opplaster, type Jobb } from './opplasting';
import { adresseVed, koblAdressefelt } from './sted';
import { erSynlig, samleSvar, sporsmalFor } from './sporsmal';
import { feilNokkel, lagSteg2, lesSteg1, sendSteg1, sendSteg2, sjekkSteg1, type FeltFeil } from './steg';

interface Tekster {
  feil: Record<'mangler' | 'ugyldig' | 'forLang' | 'turnstile' | 'nettverk' | 'server', string>;
  sender: string;
  posisjonHentes: string;
  posisjonFunnet: string;
  posisjonFeilet: string;
  steg2Ok: string;
  bildeLaster: string;
  bildeOk: string;
  bildeFrakoblet: string;
  bildeFeilet: string;
  bildeForMange: string;
  forslagAntall: string;
}

declare global {
  interface Window {
    turnstile?: { reset: (widget?: string | HTMLElement) => void };
  }
}

const rot = document.querySelector<HTMLElement>('[data-skjema-rot]');
if (rot) start(rot);

function nyNokkel(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function start(rot: HTMLElement) {
  const t = JSON.parse(rot.dataset.tekster ?? '{}') as Tekster;
  const telefon = rot.dataset.telefon ?? '';
  const telefonHref = rot.dataset.telefonHref ?? '';
  const maksBilder = Number(rot.dataset.maksBilder) || MAKS_BILDER;
  const steg1 = rot.querySelector<HTMLFormElement>('form[data-steg1]')!;
  const steg2 = rot.querySelector<HTMLFormElement>('form[data-steg2]')!;
  const status = steg1.querySelector<HTMLElement>('[data-status]')!;
  const send = steg1.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const felt = (navn: string) => steg1.elements.namedItem(navn) as HTMLInputElement | null;
  const radio = (navn: string) => (steg1.elements.namedItem(navn) as RadioNodeList | null)?.value ?? '';

  // Nettleseren sjekker ikke selv; feilene vises ved feltet med telefonnummeret.
  steg1.noValidate = true;

  // Kilde fra ?kilde= (egne lenker og QR-koder), bare i skjemaet.
  const kilde = renKilde(new URLSearchParams(location.search).get('kilde'));
  if (kilde) felt('kilde')!.value = kilde;

  // --- Feilvisning ---

  /** Feiltekst (godkjent tekst fra tekster) etterfulgt av telefonnummeret som lenke. */
  const fyllFeil = (el: HTMLElement, kode: string) => {
    const a = document.createElement('a');
    a.href = telefonHref;
    a.textContent = telefon;
    el.replaceChildren(`${t.feil[feilNokkel(kode)]} `, a);
    el.hidden = false;
  };

  const kontroller = (feltnavn: string, form: HTMLFormElement = steg1): HTMLElement[] => {
    if (feltnavn === 'turnstileToken') return [];
    const el = form.elements.namedItem(feltnavn);
    if (!el) return [];
    if (el instanceof RadioNodeList) return [...el].filter((x): x is HTMLInputElement => x instanceof HTMLInputElement);
    return el instanceof HTMLElement ? [el] : [];
  };

  const settBeskrevet = (el: HTMLElement, id: string, paa: boolean) => {
    const ider = new Set((el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
    if (paa) ider.add(id);
    else ider.delete(id);
    if (ider.size) el.setAttribute('aria-describedby', [...ider].join(' '));
    else el.removeAttribute('aria-describedby');
  };

  const fjernFeil = () => {
    steg1.querySelectorAll<HTMLElement>('.feil').forEach((p) => {
      p.hidden = true;
      p.replaceChildren();
    });
    steg1.querySelectorAll<HTMLElement>('[aria-invalid]').forEach((el) => {
      el.removeAttribute('aria-invalid');
      const ider = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id.startsWith('feil-'));
      ider.forEach((id) => settBeskrevet(el, id, false));
    });
  };

  /** Feilen ved et felt forsvinner når kunden endrer feltet. */
  const fjernFeltFeil = (navn: string) => {
    const p = steg1.querySelector<HTMLElement>(`#feil-${CSS.escape(navn)}`);
    if (!p || p.hidden) return;
    p.hidden = true;
    p.replaceChildren();
    for (const el of kontroller(navn)) {
      el.removeAttribute('aria-invalid');
      settBeskrevet(el, p.id, false);
    }
  };
  for (const type of ['input', 'change']) {
    steg1.addEventListener(type, (e) => {
      const navn = (e.target as HTMLInputElement | null)?.name;
      if (navn) fjernFeltFeil(navn === 'gnr' || navn === 'bnr' ? 'sted' : navn);
    });
  }

  /** Viser feilene ved feltene og flytter fokus til den første. */
  const visFeil = (feil: FeltFeil[]) => {
    let forste: HTMLElement | null = null;
    for (const f of feil) {
      const p = steg1.querySelector<HTMLElement>(`#feil-${CSS.escape(f.felt)}`);
      const kode = f.felt === 'turnstileToken' ? 'turnstile' : f.feil;
      if (!p) {
        const samlet = steg1.querySelector<HTMLElement>('#feil-skjema')!;
        fyllFeil(samlet, kode);
        forste ??= samlet;
        continue;
      }
      fyllFeil(p, kode);
      const els = kontroller(f.felt);
      for (const el of els) {
        el.setAttribute('aria-invalid', 'true');
        settBeskrevet(el, p.id, true);
      }
      forste ??= els[0] ?? steg1.querySelector<HTMLElement>(`#felt-${CSS.escape(f.felt)}`) ?? p;
    }
    if (forste) {
      if (forste.classList.contains('feil') && !forste.hasAttribute('tabindex')) forste.tabIndex = -1;
      forste.focus();
    }
  };

  // --- Sted ---

  const lat = felt('lat')!;
  const lon = felt('lon')!;
  const stedInput = felt('sted')!;
  const forslagStatus = steg1.querySelector<HTMLElement>('[data-forslag-status]');
  koblAdressefelt({
    input: stedInput,
    liste: steg1.querySelector<HTMLElement>('#skjema-sted-forslag')!,
    lat,
    lon,
    onAntall: (n) => {
      if (forslagStatus) forslagStatus.textContent = n > 0 ? t.forslagAntall.replace('{antall}', String(n)) : '';
    },
  });

  const posKnapp = steg1.querySelector<HTMLButtonElement>('[data-posisjon]');
  const posStatus = steg1.querySelector<HTMLElement>('[data-posisjon-status]');
  if (posKnapp && posStatus && 'geolocation' in navigator) {
    posKnapp.hidden = false;
    posKnapp.addEventListener('click', () => {
      posStatus.textContent = t.posisjonHentes;
      navigator.geolocation.getCurrentPosition(
        async (p) => {
          const { latitude, longitude } = p.coords;
          const adr = await adresseVed(latitude, longitude);
          if (adr && !stedInput.value.trim()) stedInput.value = adr.tekst;
          // Etter tekstendringen: koordinatene settes sist, så de ikke tømmes.
          lat.value = String(Math.round(latitude * 1e6) / 1e6);
          lon.value = String(Math.round(longitude * 1e6) / 1e6);
          posStatus.textContent = t.posisjonFunnet;
        },
        () => {
          posStatus.textContent = t.posisjonFeilet;
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      );
    });
  }

  // --- Privat eller bedrift ---

  const bedrift = steg1.querySelector<HTMLElement>('[data-bedrift]')!;
  const oppdaterKundetype = () => {
    bedrift.hidden = radio('kundetype') !== 'bedrift';
  };
  steg1.querySelectorAll('input[name="kundetype"]').forEach((r) => r.addEventListener('change', oppdaterKundetype));
  oppdaterKundetype();

  // --- «Det lekker nå»: boksen og ringeknappen over send-knappen ---

  const lekker = steg1.querySelector<HTMLElement>('[data-lekker-plass]')!;
  const hast = () => radio('hast');
  steg1.querySelectorAll('input[name="hast"]').forEach((r) =>
    r.addEventListener('change', () => {
      lekker.hidden = hast() !== 'lekker-naa';
    }),
  );

  // --- Steg 1 ---

  let idemNokkel: string | null = null;
  let sender = false;

  steg1.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sender) return;
    fjernFeil();
    // Samme nøkkel for alle forsøk på denne utfyllingen (dobbeltklikk, nytt forsøk etter feil).
    idemNokkel ??= nyNokkel();
    const data = lesSteg1(steg1, idemNokkel);
    const feil = sjekkSteg1(data);
    if (feil.length) {
      visFeil(feil);
      return;
    }
    if (!data.turnstileToken) {
      visFeil([{ felt: 'turnstileToken', feil: 'turnstile' }]);
      return;
    }

    sender = true;
    send.setAttribute('aria-disabled', 'true');
    status.textContent = t.sender;
    const svar = await sendSteg1(data);
    sender = false;
    send.removeAttribute('aria-disabled');
    status.textContent = '';

    if (!svar.ok) {
      if (svar.feil === 'turnstile') window.turnstile?.reset();
      visFeil([{ felt: svar.felt && svar.felt !== 'idemNokkel' ? svar.felt : 'skjema', feil: svar.feil }]);
      return;
    }
    visSteg2(svar.id, svar.token, String(data.tjeneste), String(data.hast), String(data.locale), felt('samtykkeWhatsapp')?.checked === true);
  });

  // --- Steg 2 ---

  function visSteg2(id: string, token: string, tjeneste: string, hastVerdi: string, locale: string, whatsapp: boolean) {
    steg1.hidden = true;
    const kvittering = rot!.querySelector<HTMLElement>('[data-kvittering]')!;
    // Lekker det, står boksen med ringeknappen igjen i kvitteringen.
    if (hastVerdi === 'lekker-naa') {
      kvittering.querySelector('[data-lekker-kvittering]')?.append(lekker);
      lekker.hidden = false;
    }
    // Lenken for å sende flere bilder senere (samme lenke som i kvitteringen på melding). Den står
    // her fordi kunden kanskje ikke får noen melding (ingen kanal satt opp, eller sendingen feilet).
    const lenke = sendBilderLenke(location.origin, locale === 'en' ? 'en' : 'nb', id, token);
    kvittering.querySelectorAll<HTMLAnchorElement>('[data-send-bilder-lenke]').forEach((a) => {
      a.href = lenke;
      a.textContent = lenke;
    });
    kvittering.hidden = false;
    steg2.hidden = false;
    kvittering.focus();

    const sporsmal = sporsmalFor(tjeneste, { hast: hastVerdi });
    const aktuelle = new Map(sporsmal.map((s) => [s.id, s]));
    const oppdater = () => {
      steg2.querySelectorAll<HTMLElement>('[data-sporsmal]').forEach((el) => {
        const s = aktuelle.get(el.dataset.sporsmal!);
        el.hidden = !s || !erSynlig(s, steg2);
      });
    };
    steg2.addEventListener('change', oppdater);
    oppdater();

    // WhatsApp-samtykket fra steg 1 lagres straks (API-et tar samtykker i steg 2). Feiler det, sendes
    // det på nytt med steg 2.
    let whatsappIgjen = whatsapp;
    if (whatsapp) {
      void sendSteg2(id, token, { samtykker: { whatsapp: true } }).then((r) => {
        if (r.ok) whatsappIgjen = false;
      });
    }

    // Bildene lastes opp i bakgrunnen; innsendingen av steg 2 venter aldri på dem.
    const liste = steg2.querySelector<HTMLElement>('[data-bildeliste]')!;
    const bildeStatus = steg2.querySelector<HTMLElement>('[data-bilde-status]');
    const rader = new Map<number, HTMLLIElement>();
    const statusTekst: Record<Jobb['status'], string> = {
      venter: t.bildeLaster,
      forbereder: t.bildeLaster,
      laster: t.bildeLaster,
      frakoblet: t.bildeFrakoblet,
      ok: t.bildeOk,
      feilet: t.bildeFeilet,
    };
    const opplaster = new Opplaster({
      id,
      token,
      locale,
      onStatus: (jobb) => {
        let li = rader.get(jobb.nr);
        if (!li) {
          li = document.createElement('li');
          rader.set(jobb.nr, li);
          liste.append(li);
        }
        li.textContent = `${jobb.fil.name}: ${statusTekst[jobb.status]}`;
        li.dataset.status = jobb.status;
        // Skjermlesere får bare ferdig og feilet, ikke hvert mellomsteg.
        if (bildeStatus && (jobb.status === 'ok' || jobb.status === 'feilet')) bildeStatus.textContent = li.textContent;
      },
    });
    let antall = 0;
    steg2.querySelectorAll<HTMLInputElement>('input[data-bildefelt]').forEach((input) =>
      input.addEventListener('change', () => {
        for (const fil of input.files ?? []) {
          if (antall >= maksBilder) {
            const li = document.createElement('li');
            li.textContent = `${fil.name}: ${t.bildeForMange}`;
            liste.append(li);
            continue;
          }
          antall++;
          opplaster.leggTil(fil, input.dataset.merke || undefined);
        }
        input.value = '';
      }),
    );

    const status2 = steg2.querySelector<HTMLElement>('[data-status2]')!;
    const feil2 = steg2.querySelector<HTMLElement>('#feil-steg2')!;
    let sender2 = false;
    steg2.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (sender2) return;
      feil2.hidden = true;
      const fd = new FormData(steg2);
      const data = lagSteg2({
        beskrivelse: String(fd.get('beskrivelse') ?? ''),
        hvorHorte: String(fd.get('hvorHorte') ?? ''),
        ...samleSvar(steg2, sporsmal),
        paaminnelser: fd.get('paaminnelser') === 'on',
        whatsapp: whatsappIgjen,
      });
      // Ingenting å sende (bildene går for seg): ikke noe kall.
      if (!data) {
        status2.textContent = t.steg2Ok;
        return;
      }
      sender2 = true;
      status2.textContent = t.sender;
      const svar = await sendSteg2(id, token, data);
      sender2 = false;
      if (svar.ok) {
        whatsappIgjen = false;
        status2.textContent = t.steg2Ok;
      } else {
        status2.textContent = '';
        fyllFeil(feil2, svar.feil);
        feil2.tabIndex = -1;
        feil2.focus();
      }
    });
  }
}
