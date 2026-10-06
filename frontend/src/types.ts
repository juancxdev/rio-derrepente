export type Prediction={prediction_date:string;estimated_visitors:number;score:number;level:string;model_version:string;temperature_max?:number;precipitation_probability?:number};

export type WeatherForecast = {
  date: string;
  temperature_max: number;
  precipitation_mm: number;
  precipitation_probability: number;
  weather_code: number;
};

export type WeatherResponse = { source: string; days: WeatherForecast[] };

export type VisitSubmission = {
  visit_date: string;
  local_visitors: number;
  national_visitors: number;
  foreign_visitors: number;
  total_visitors: number;
  notes?: string;
};
