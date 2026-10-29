// <tr-calendar>: month grid for choosing a stay (BRIEF.md 4.3). No framework.
// First pick sets check-in, a later valid day sets checkout, a day on or before check-in starts again.
// Fires `change` with { checkIn, checkOut } after every pick. Arrow keys move between days, Enter picks.
import { addDays, addMonths, horizonFrom, isAvailable, isValidCheckout, minStayFor, monthStart, nightsBetween, type Availability } from './dates';

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
const price = (pence: number) => `£${Math.round(pence / 100)}`;

export class TrCalendar extends HTMLElement {
  availability: Availability | null = null;
  today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  checkIn: string | null = null;
  checkOut: string | null = null;
  /** First month on screen (YYYY-MM-01). */
  view = '';
  focusDate = '';
  private body?: HTMLElement;
  private hint?: HTMLElement;

  /** Longest stay that is booked against the PMS calendar; longer stays are quoted and ignore it. */
  get maxInstant() {
    return Number(this.getAttribute('max-instant') ?? 14);
  }
  get months() {
    return this.getAttribute('months') === '2' ? 2 : 1;
  }
  set months(n: number) {
    this.setAttribute('months', String(n));
    this.render();
  }
  /** Last day a stay can start on: a year ahead. */
  get lastCheckIn() {
    return addDays(this.today, 365);
  }
  get horizon() {
    return horizonFrom(this.today);
  }

  connectedCallback() {
    if (this.body) return;
    this.innerHTML = `
      <div class="cal__nav">
        <button type="button" class="cal__arrow" data-prev aria-label="Previous month"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M12 4l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>
        <button type="button" class="cal__arrow" data-next aria-label="Next month"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M8 4l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>
      </div>
      <div class="cal__body" data-body></div>
      <p class="cal__hint" data-hint aria-live="polite"></p>`;
    this.body = this.querySelector<HTMLElement>('[data-body]')!;
    this.hint = this.querySelector<HTMLElement>('[data-hint]')!;
    this.querySelector('[data-prev]')!.addEventListener('click', () => this.shift(-1));
    this.querySelector('[data-next]')!.addEventListener('click', () => this.shift(1));
    this.body.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-date]');
      if (btn && btn.getAttribute('aria-disabled') !== 'true') this.pick(btn.dataset.date!);
    });
    this.body.addEventListener('keydown', (e) => this.onKey(e));
    this.render();
  }

  /** Load data and the current choice, and show the month that matters. */
  setup(av: Availability | null, checkIn: string | null, checkOut: string | null) {
    this.availability = av;
    if (av) this.today = av.today;
    this.checkIn = checkIn;
    this.checkOut = checkOut;
    this.focusDate = checkIn ?? this.firstFree();
    this.view = monthStart(this.focusDate);
    this.render();
  }

  /** Puts keyboard focus on the current day. */
  focusDay() {
    this.body?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
  }

  private firstFree() {
    for (let d = this.today; d <= this.lastCheckIn; d = addDays(d, 1)) if (isAvailable(this.availability, d, this.today)) return d;
    return this.today;
  }

  /** Any day in the window can start a stay: a booked night still works for a long stay, which is quoted. */
  private canCheckIn(d: string) {
    return d >= this.today && d <= this.lastCheckIn;
  }
  private isFree(d: string) {
    return isAvailable(this.availability, d, this.today);
  }
  private canCheckOut(d: string) {
    return !!this.checkIn && !this.checkOut && isValidCheckout(this.availability, this.checkIn, d, this.horizon, this.maxInstant);
  }
  private get isLongStay() {
    return !!this.checkIn && !!this.checkOut && nightsBetween(this.checkIn, this.checkOut) > this.maxInstant;
  }

  private pick(d: string) {
    if (this.checkIn && !this.checkOut && this.canCheckOut(d)) this.checkOut = d;
    else if (this.canCheckIn(d)) {
      this.checkIn = d;
      this.checkOut = null;
    } else return;
    this.focusDate = d;
    this.render(true);
    this.dispatchEvent(new CustomEvent('change', { detail: { checkIn: this.checkIn, checkOut: this.checkOut }, bubbles: true }));
  }

  private shift(n: number) {
    const first = monthStart(this.today);
    const last = addMonths(first, 12 - (this.months - 1));
    const next = addMonths(this.view, n);
    if (next < first || next > last) return;
    this.view = next;
    // Keep the roving focus inside what is on screen
    const end = addMonths(this.view, this.months);
    if (this.focusDate < this.view || this.focusDate >= end) this.focusDate = this.view < this.today ? this.today : this.view;
    this.render();
  }

  private onKey(e: KeyboardEvent) {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let target: string | null = null;
    if (e.key in steps) target = addDays(this.focusDate, steps[e.key]);
    else if (e.key === 'PageUp') target = addMonths(this.focusDate, -1).slice(0, 8) + this.focusDate.slice(8);
    else if (e.key === 'PageDown') target = addMonths(this.focusDate, 1).slice(0, 8) + this.focusDate.slice(8);
    else if (e.key === 'Home') target = addDays(this.focusDate, -((parse(this.focusDate).getUTCDay() + 6) % 7));
    else if (e.key === 'End') target = addDays(this.focusDate, 6 - ((parse(this.focusDate).getUTCDay() + 6) % 7));
    if (!target) return;
    e.preventDefault();
    // PageUp/PageDown on the 31st land on a day that doesn't exist: use the month's last day
    if (Number.isNaN(Date.parse(target)) || parse(target).toISOString().slice(0, 10) !== target) target = addDays(addMonths(target, 1), -1);
    if (target < this.today) target = this.today;
    const lastDay = addDays(addMonths(monthStart(this.today), 13), -1);
    if (target > lastDay) target = lastDay;
    this.focusDate = target;
    const end = addMonths(this.view, this.months);
    if (target < this.view) this.view = monthStart(target);
    else if (target >= end) this.view = addMonths(monthStart(target), -(this.months - 1));
    this.render(true);
  }

  render(keepFocus = false) {
    if (!this.body || !this.view) return;
    const hadFocus = keepFocus || this.body.contains(document.activeElement);
    const first = monthStart(this.today);
    this.querySelector<HTMLButtonElement>('[data-prev]')!.disabled = this.view <= first;
    this.querySelector<HTMLButtonElement>('[data-next]')!.disabled = this.view >= addMonths(first, 12 - (this.months - 1));

    const choosingOut = !!this.checkIn && !this.checkOut;
    const minEnd = this.checkIn ? addDays(this.checkIn, minStayFor(this.availability, this.checkIn)) : '';
    const longStay = this.isLongStay;
    const months: string[] = [];
    for (let m = 0; m < this.months; m++) {
      const start = addMonths(this.view, m);
      const lead = (parse(start).getUTCDay() + 6) % 7; // Monday first
      const cells: string[] = Array.from({ length: lead }, () => '<span class="cal__pad"></span>');
      for (let d = start; d.slice(0, 7) === start.slice(0, 7); d = addDays(d, 1)) {
        const info = this.availability?.days.get(d);
        const asIn = this.canCheckIn(d);
        const asOut = choosingOut && this.canCheckOut(d);
        // Waiting for checkout, the nights inside the minimum stay can't be picked either way
        const tooShort = choosingOut && d > this.checkIn! && d < minEnd && !asOut;
        const selectable = asOut || (asIn && !tooShort);
        const edge = d === this.checkIn || d === this.checkOut;
        const inRange = !!this.checkIn && !!this.checkOut && d > this.checkIn && d < this.checkOut;
        // Booked nights stay marked, except inside a long stay (quoted, so the PMS calendar doesn't apply)
        const free = this.isFree(d);
        const off = !free && !asOut && !(longStay && (inRange || edge));
        const cls = ['cal__day', edge && 'is-edge', inRange && 'is-range', off && 'is-off', tooShort && 'is-short', d === this.today && 'is-today']
          .filter(Boolean)
          .join(' ');
        const status =
          d === this.checkIn ? ', check-in' : d === this.checkOut ? ', checkout' : !selectable ? ', not available' : off ? `, booked for stays up to ${this.maxInstant} nights` : '';
        const showPrice = free && !longStay && info?.price != null;
        cells.push(
          `<button type="button" class="${cls}" data-date="${d}" tabindex="${d === this.focusDate ? 0 : -1}"${selectable ? '' : ' aria-disabled="true"'} aria-pressed="${edge}" aria-label="${LONG.format(parse(d))}${status}${showPrice ? `, ${price(info!.price!)} a night` : ''}"><span class="cal__n">${Number(d.slice(8))}</span><span class="cal__p" aria-hidden="true">${showPrice ? price(info!.price!) : ''}</span></button>`,
        );
      }
      months.push(`
        <div class="cal__month" role="group" aria-label="${MONTH.format(parse(start))}">
          <p class="cal__title">${MONTH.format(parse(start))}</p>
          <div class="cal__dow" aria-hidden="true"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
          <div class="cal__grid">${cells.join('')}</div>
        </div>`);
    }
    this.body.innerHTML = months.join('');
    // The roving tab stop has to be on screen; fall back to the first day shown
    if (!this.body.querySelector('[tabindex="0"]')) {
      const firstBtn = this.body.querySelector<HTMLButtonElement>('button[data-date]');
      if (firstBtn) {
        firstBtn.tabIndex = 0;
        this.focusDate = firstBtn.dataset.date!;
      }
    }
    if (hadFocus) this.focusDay();

    if (this.hint) {
      if (!this.checkIn) this.hint.textContent = 'Choose your check-in date.';
      else if (!this.checkOut) {
        const min = minStayFor(this.availability, this.checkIn);
        const long = `Stays over ${this.maxInstant} nights can be any dates; we'll send a quote.`;
        this.hint.textContent = this.isFree(this.checkIn)
          ? `Now choose your checkout date.${min > 1 ? ` Minimum stay ${min} nights.` : ''} ${long}`
          : `That night is booked for short stays. ${long}`;
      } else this.hint.textContent = 'Choose a new check-in date to start again.';
    }
  }
}

if (!customElements.get('tr-calendar')) customElements.define('tr-calendar', TrCalendar);
