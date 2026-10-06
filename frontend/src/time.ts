export function limaDate(value = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(value);
}

export function isRegistrationOpen(value = new Date()): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(value));
  // Excepción de demostración: solo el 06/10/2026 el cierre se adelanta a las 14:00.
  // Desde el día siguiente, la regla operativa vuelve automáticamente a las 18:00.
  const openingHour = limaDate(value) === '2026-10-06' ? 14 : 18;
  return hour >= openingHour;
}

export type DailyCycle = {
  today: string;
  tomorrow: string;
  registrationOpen: boolean;
  canShowTomorrow: boolean;
};

export function dailyCycle(value = new Date(), registeredVisitDate: string | null = null): DailyCycle {
  const today = limaDate(value);
  const tomorrowValue = new Date(value);
  tomorrowValue.setDate(tomorrowValue.getDate() + 1);
  const registrationOpen = isRegistrationOpen(value);
  return {
    today,
    tomorrow: limaDate(tomorrowValue),
    registrationOpen,
    canShowTomorrow: registrationOpen && registeredVisitDate === today,
  };
}
