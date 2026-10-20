export const DEFAULT_TIMEZONE = 'America/Lima';
export const DEFAULT_CLOSURE_HOUR = 18;

export function dateInZone(value = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

export function hourInZone(value = new Date(), timeZone = DEFAULT_TIMEZONE): number {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(value));
}

export function isRegistrationOpen(value = new Date(), timeZone = DEFAULT_TIMEZONE, closureHour = DEFAULT_CLOSURE_HOUR): boolean {
  return hourInZone(value, timeZone) >= closureHour;
}

export function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function formatLongDate(date: string, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(new Date(`${date}T12:00:00Z`));
}

export type DailyCycle = {
  today: string;
  tomorrow: string;
  registrationOpen: boolean;
  canShowTomorrow: boolean;
  closureHour: number;
};

// The destination timezone and closure hour come from the backend session,
// so the UI never hardcodes Lima or a 18:00 window.
export function dailyCycle(value = new Date(), timeZone = DEFAULT_TIMEZONE, closureHour = DEFAULT_CLOSURE_HOUR): DailyCycle {
  const today = dateInZone(value, timeZone);
  const registrationOpen = isRegistrationOpen(value, timeZone, closureHour);
  return {
    today,
    tomorrow: addDays(today, 1),
    registrationOpen,
    // The Worker publishes tomorrow's prediction only after the closure.
    canShowTomorrow: registrationOpen,
    closureHour,
  };
}

export const limaDate = (value = new Date()) => dateInZone(value, DEFAULT_TIMEZONE);
