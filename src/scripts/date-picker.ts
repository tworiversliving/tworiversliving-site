// Opens the date picker (BRIEF.md 4.3): a bottom sheet on phones, a modal on desktop, or a popover under
// a date pair on desktop. Two contexts:
//   book:  the stay on this page (shared `stay`), guests, live total from /api/quote and the 14 / 89 night rules.
//   field: dates for a form (enquiry, search). Hands the dates back to the form.
import './tr-calendar';
import type { TrCalendar } from './tr-calendar';
import { gbp, plural, postJson } from './booking';
import { fmtShort, loadAvailability, nightsBetween, stay } from './dates';

export interface OpenOptions {
  context: 'book' | 'field';
  /** Date pair to hang a popover from on desktop. */
  anchor?: HTMLElement;
  /** Field context: the current dates and where to send new ones. */
  checkIn?: string | null;
  checkOut?: string | null;
  apply?: (checkIn: string, checkOut: string) => void;
  labels?: [string, string];
  /** false: a plain calendar with no availability or prices (long stay enquiry). */
  live?: boolean;
}

interface Quote {
  ok: boolean;
  error?: string;
  errors: string[];
  mode: 'instant' | 'enquire' | null;
  stay: number;
}

const desktop = matchMedia('(min-width: 900px)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const sheet = document.querySelector<HTMLDialogElement>('[data-date-sheet]');
const pop = document.querySelector<HTMLElement>('[data-date-pop]');
const cfg = sheet?.dataset ?? {};
const slug = cfg.slug ?? '';
const maxInstant = Number(cfg.maxInstant ?? 14);
const maxNights = Number(cfg.maxNights ?? 89);
const maxGuests = Number(cfg.maxGuests ?? 7);

let current: OpenOptions | null = null;
let openedFrom: HTMLElement | null = null;
let quoteSeq = 0;

const query = (ci: string, co: string, guests: number) => new URLSearchParams({ checkIn: ci, checkOut: co, guests: String(guests) });

export function openDates(opts: OpenOptions) {
  if (!sheet || !pop) return;
  openedFrom = document.activeElement as HTMLElement | null;
  closePop(false);
  current = opts;
  const ci = opts.context === 'book' ? stay.get().checkIn : (opts.checkIn ?? null);
  const co = opts.context === 'book' ? stay.get().checkOut : (opts.checkOut ?? null);
  if (opts.anchor && desktop.matches) openPop(opts.anchor, ci, co);
  else openSheet(ci, co);
}

/** Closes whichever picker is open. */
export function closeDates() {
  closePop();
  closeSheet();
}

/** True while the popover hangs from this date pair. */
export const popOpenOn = (anchor: HTMLElement) => !!pop && !pop.hidden && pop.parentElement === anchor;

/* ---------- Sheet (phone) and modal (desktop) ---------- */

function openSheet(ci: string | null, co: string | null) {
  const s = sheet!;
  const cal = s.querySelector<TrCalendar>('tr-calendar')!;
  const book = current!.context === 'book';
  s.dataset.context = current!.context;
  const [inLabel, outLabel] = current!.labels ?? [`Check-in · ${cfg.checkIn}`, `Checkout · ${cfg.checkOut}`];
  s.querySelector('[data-label-in]')!.textContent = inLabel;
  s.querySelector('[data-label-out]')!.textContent = outLabel;
  s.querySelector<HTMLElement>('[data-guests-row]')!.hidden = !book;
  cal.months = desktop.matches ? 2 : 1;
  s.style.transform = '';
  s.showModal();
  document.documentElement.classList.add('sheet-open');
  cal.setup(null, ci, co);
  sheetChanged(ci, co);
  if (current!.live === false) {
    setStatus('');
    cal.focusDay();
    return;
  }
  setStatus('Loading available dates.');
  loadAvailability(slug).then((av) => {
    if (!s.open) return;
    setStatus(av ? '' : "We couldn't load prices just now. You can still choose your dates.");
    cal.setup(av, ci, co);
    cal.focusDay();
  });
}

function setStatus(text: string) {
  const el = sheet!.querySelector<HTMLElement>('[data-status]')!;
  el.textContent = text;
  el.hidden = !text;
}

/** Updates the summary pair and the footer after any change in the sheet. */
function sheetChanged(ci: string | null, co: string | null) {
  const s = sheet!;
  s.querySelector('[data-value-in]')!.textContent = ci ? fmtShort(ci) : 'Add date';
  s.querySelector('[data-value-out]')!.textContent = co ? fmtShort(co) : 'Add date';
  const guests = stay.get().guests;
  s.querySelector('[data-guests-count]')!.textContent = String(guests);
  s.querySelector<HTMLButtonElement>('[data-guests-less]')!.disabled = guests <= 1;
  s.querySelector<HTMLButtonElement>('[data-guests-more]')!.disabled = guests >= maxGuests;

  const sum = s.querySelector<HTMLElement>('[data-sum]')!;
  const total = s.querySelector<HTMLElement>('[data-total]')!;
  const note = s.querySelector<HTMLElement>('[data-note]')!;
  const go = s.querySelector<HTMLButtonElement>('[data-go]')!;
  const book = current?.context === 'book';
  const seq = ++quoteSeq;
  total.textContent = '';
  note.classList.remove('is-error');
  go.disabled = true;
  delete go.dataset.href;

  if (!ci || !co) {
    sum.textContent = ci ? 'Now choose your checkout date' : 'Choose your dates';
    note.textContent = book ? 'No booking or cleaning fees.' : '';
    go.textContent = book ? 'Continue' : 'Use these dates';
    return;
  }
  const n = nightsBetween(ci, co);
  sum.textContent = book ? `${plural(n, 'night')} · ${plural(guests, 'guest')}` : plural(n, 'night');

  if (n > maxNights) {
    note.textContent = `We can't take stays over ${maxNights} nights.`;
    note.classList.add('is-error');
    go.textContent = book ? 'Continue' : 'Use these dates';
    return;
  }
  if (!book) {
    note.textContent = n <= maxInstant ? `Up to ${maxInstant} nights can be booked straight away on the flat's page.` : '';
    go.textContent = 'Use these dates';
    go.disabled = false;
    return;
  }
  const params = query(ci, co, guests);
  if (n > maxInstant) {
    note.textContent = `Stays over ${maxInstant} nights are quoted for the whole flat.`;
    go.textContent = 'Ask for a quote';
    go.dataset.href = `/work-stays?${params}#quote`;
    go.disabled = false;
    return;
  }
  sum.textContent += ' · no fees';
  note.textContent = 'Checking the price.';
  go.textContent = 'Continue';
  postJson<Quote>('/api/quote', { slug, checkIn: ci, checkOut: co, guests }).then((q) => {
    if (seq !== quoteSeq) return;
    if (!q.ok) {
      note.textContent = q.errors?.[0] ?? q.error ?? 'Those dates are not available.';
      note.classList.add('is-error');
      return;
    }
    total.textContent = gbp(q.stay);
    note.textContent = "You won't be charged until the next step.";
    go.textContent = `Continue · ${gbp(q.stay)}`;
    go.dataset.href = `/book/${slug}?${params}`;
    go.disabled = false;
  });
}

function closeSheet() {
  if (sheet?.open) sheet.close();
}

if (sheet) {
  const cal = sheet.querySelector<TrCalendar>('tr-calendar')!;
  cal.addEventListener('change', (e) => {
    const { checkIn, checkOut } = (e as CustomEvent).detail;
    if (current?.context === 'book') stay.set({ checkIn, checkOut });
    sheetChanged(checkIn, checkOut);
  });
  const step = (by: number) => {
    const g = Math.min(maxGuests, Math.max(1, stay.get().guests + by));
    stay.set({ guests: g });
    sheetChanged(cal.checkIn, cal.checkOut);
  };
  sheet.querySelector('[data-guests-less]')!.addEventListener('click', () => step(-1));
  sheet.querySelector('[data-guests-more]')!.addEventListener('click', () => step(1));
  sheet.querySelector('[data-go]')!.addEventListener('click', (e) => {
    const go = e.currentTarget as HTMLButtonElement;
    if (go.disabled) return;
    if (current?.context === 'field') {
      if (cal.checkIn && cal.checkOut) current.apply?.(cal.checkIn, cal.checkOut);
      closeSheet();
    } else if (go.dataset.href) location.href = go.dataset.href;
  });
  sheet.querySelector('[data-sheet-close]')!.addEventListener('click', closeSheet);
  sheet.addEventListener('close', () => {
    document.documentElement.classList.remove('sheet-open');
    current = null;
  });
  // A tap on the scrim closes the sheet
  sheet.addEventListener('click', (e) => e.target === sheet && closeSheet());
  matchMedia('(min-width: 900px)').addEventListener('change', () => (cal.months = desktop.matches ? 2 : 1));

  // Drag the handle down to close (phone only)
  const handle = sheet.querySelector<HTMLElement>('[data-handle]')!;
  let startY: number | null = null;
  let dy = 0;
  handle.addEventListener('pointerdown', (e) => {
    if (desktop.matches) return;
    startY = e.clientY;
    dy = 0;
    handle.setPointerCapture(e.pointerId);
    sheet.classList.add('is-dragging');
  });
  handle.addEventListener('pointermove', (e) => {
    if (startY == null) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (startY == null) return;
    startY = null;
    sheet.classList.remove('is-dragging');
    if (dy > 90) {
      if (reduced.matches) {
        sheet.style.transform = '';
        closeSheet();
      } else {
        sheet.style.transform = 'translateY(100%)';
        setTimeout(() => {
          closeSheet();
          sheet.style.transform = '';
        }, 200);
      }
    } else sheet.style.transform = '';
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

/* ---------- Popover under a date pair (desktop) ---------- */

function openPop(anchor: HTMLElement, ci: string | null, co: string | null) {
  const p = pop!;
  const cal = p.querySelector<TrCalendar>('tr-calendar')!;
  anchor.append(p);
  const rect = anchor.getBoundingClientRect();
  const alignEnd = anchor.dataset.align === 'end';
  const room = alignEnd ? rect.right - 24 : innerWidth - rect.left - 24;
  cal.months = room >= 700 ? 2 : 1;
  p.classList.toggle('date-pop--end', alignEnd);
  p.hidden = false;
  anchor.setAttribute('aria-expanded', 'true');
  cal.setup(null, ci, co);
  if (current?.live === false) {
    cal.focusDay();
    return;
  }
  loadAvailability(slug).then((av) => {
    if (p.hidden) return;
    cal.setup(av, ci, co);
    cal.focusDay();
    p.scrollIntoView({ block: 'nearest', behavior: reduced.matches ? 'auto' : 'smooth' });
  });
}

function closePop(restoreFocus = true) {
  if (!pop || pop.hidden) return;
  pop.hidden = true;
  pop.parentElement?.setAttribute('aria-expanded', 'false');
  current = null;
  if (restoreFocus) openedFrom?.focus();
}

if (pop) {
  const cal = pop.querySelector<TrCalendar>('tr-calendar')!;
  cal.addEventListener('change', (e) => {
    const { checkIn, checkOut } = (e as CustomEvent).detail;
    if (!current) return;
    if (current.context === 'book') stay.set({ checkIn, checkOut });
    if (checkIn && checkOut) {
      if (current.context === 'field') current.apply?.(checkIn, checkOut);
      closePop();
    }
  });
  pop.querySelector('[data-pop-close]')!.addEventListener('click', () => closePop());
  pop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closePop();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as Node;
    if (!pop.hidden && !pop.contains(t) && !pop.parentElement?.contains(t)) closePop(false);
  });
}

/* ---------- "Check dates" buttons anywhere on the page ---------- */

document.addEventListener('click', (e) => {
  const trigger = (e.target as HTMLElement).closest<HTMLElement>('[data-open-dates]');
  if (!trigger || !sheet) return;
  e.preventDefault();
  // On the property page on desktop, open the booking card's own popover instead
  const pair = document.querySelector<HTMLElement>('tr-date-pair[data-context="book"]');
  if (pair && desktop.matches) {
    pair.scrollIntoView({ block: 'center', behavior: reduced.matches ? 'auto' : 'smooth' });
    openDates({ context: 'book', anchor: pair });
    return;
  }
  openDates({ context: 'book' });
});
// Start loading the calendar as soon as someone heads for a "Check dates" button
const warm = (e: Event) => (e.target as HTMLElement).closest?.('[data-open-dates], tr-date-pair') && slug && loadAvailability(slug);
document.addEventListener('pointerover', warm, { passive: true });
document.addEventListener('focusin', warm);
