// Small page behaviours shared by every page. No storage, no network.
//
// 1. `[data-velg="<service>"]` links pre-select that service in the request form on the same page and
//    scroll to it. Without a form on the page (or without JavaScript) the link is followed as normal;
//    it then points at a page whose form already has the service selected.
// 2. Elements with `.vis` slide in once when they scroll into view (not with reduced motion).

const rolig = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

document.addEventListener('click', (e) => {
  const lenke = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[data-velg]');
  if (!lenke || e.defaultPrevented) return;
  const verdi = lenke.dataset.velg ?? '';
  const skjema = document.getElementById('skjema');
  const radio = skjema?.querySelector<HTMLInputElement>(`input[name="tjeneste"][value="${CSS.escape(verdi)}"]`);
  if (!skjema || !radio) return;
  e.preventDefault();
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
  skjema.scrollIntoView({ behavior: rolig() ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', '#skjema');
  window.setTimeout(() => radio.focus({ preventScroll: true }), rolig() ? 0 : 500);
});

if ('IntersectionObserver' in window && !rolig()) {
  const elementer = document.querySelectorAll<HTMLElement>('.vis');
  if (elementer.length > 0) {
    const obs = new IntersectionObserver(
      (oppforinger) => {
        for (const o of oppforinger) {
          if (o.isIntersecting) {
            o.target.classList.add('inne');
            obs.unobserve(o.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    // Anything already on screen is shown at once, so nothing above the fold flickers.
    const synlig = (el: HTMLElement) => el.getBoundingClientRect().top < innerHeight;
    elementer.forEach((el) => (synlig(el) ? el.classList.add('inne') : obs.observe(el)));
    document.documentElement.classList.add('js-vis');
  }
}
