export function weatherLabel(code: number | undefined): string {
  if (code === undefined) return 'Sin datos climáticos';
  if (code === 0) return 'Despejado';
  if (code === 1) return 'Mayormente despejado';
  if (code === 2) return 'Parcialmente nublado';
  if (code === 3) return 'Cubierto';
  if (code === 45 || code === 48) return 'Niebla';
  if (code >= 51 && code <= 55) return 'Llovizna';
  if (code === 56 || code === 57) return 'Llovizna helada';
  if (code >= 61 && code <= 65) return 'Lluvia';
  if (code === 66 || code === 67) return 'Lluvia helada';
  if (code >= 71 && code <= 75) return 'Nevada';
  if (code === 77) return 'Granos de nieve';
  if (code >= 80 && code <= 82) return 'Chubascos';
  if (code === 85 || code === 86) return 'Chubascos de nieve';
  if (code >= 95) return 'Tormenta';
  return 'Condición variable';
}

export type WeatherScene = 'clear' | 'partly-cloudy' | 'overcast' | 'fog' | 'drizzle' | 'rain' | 'showers' | 'snow' | 'storm';

export function weatherScene(code: number): WeatherScene {
  if (code <= 1) return 'clear';
  if (code === 2) return 'partly-cloudy';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  if (code >= 95) return 'storm';
  return 'overcast';
}
