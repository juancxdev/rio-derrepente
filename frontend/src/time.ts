export function limaDate(value = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(value);
}

export function isRegistrationOpen(value = new Date()): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(value));
  return hour >= 18;
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
