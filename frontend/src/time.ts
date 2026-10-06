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
