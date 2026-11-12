// «Send flere bilder senere» (SendBilderSide.astro) med JavaScript: samme klargjøring og kø som i
// skjemaet (HEIC → JPEG, maks 2000 px, uten metadata, 3 nye forsøk). Uten JavaScript poster siden
// ett bilde om gangen som et vanlig skjema.
import { Opplaster, type Jobb } from './opplasting';

const form = document.querySelector<HTMLFormElement>('form[data-send-bilder-skjema]');
if (form) start(form);

function start(form: HTMLFormElement) {
  const { id = '', token = '', locale = 'nb' } = form.dataset;
  const t = JSON.parse(form.dataset.tekster ?? '{}') as Record<'bildeLaster' | 'bildeOk' | 'bildeFrakoblet' | 'bildeFeilet', string>;
  const input = form.querySelector<HTMLInputElement>('input[type="file"]')!;
  const liste = form.querySelector<HTMLElement>('[data-bildeliste]')!;
  const send = form.querySelector<HTMLElement>('button[type="submit"]');
  input.multiple = true;
  input.required = false;
  if (send) send.hidden = true;

  const tekst: Record<Jobb['status'], string> = {
    venter: t.bildeLaster,
    forbereder: t.bildeLaster,
    laster: t.bildeLaster,
    frakoblet: t.bildeFrakoblet,
    ok: t.bildeOk,
    feilet: t.bildeFeilet,
  };
  const rader = new Map<number, HTMLLIElement>();
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
      li.textContent = `${jobb.fil.name}: ${tekst[jobb.status]}`;
    },
  });

  // Bildene sendes så snart de er valgt; serveren avviser over 8 med en feilkode.
  input.addEventListener('change', () => {
    for (const fil of input.files ?? []) opplaster.leggTil(fil);
    input.value = '';
  });
  form.addEventListener('submit', (e) => e.preventDefault());
}
