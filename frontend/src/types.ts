export type Role = 'operator' | 'manager' | 'admin' | 'super_admin';

export type User = {
  id: string;
  email: string;
  display_name: string;
  active: boolean;
  is_super_admin?: boolean;
};

export type PlatformTenant = {
  id: string;
  name: string;
  sites: number;
  accounts: number;
};

export type PlatformAccount = {
  user_id: string;
  email: string;
  display_name: string;
  active: boolean;
  is_super_admin: boolean;
  tenant_id?: string;
  tenant_name?: string;
  role?: Exclude<Role, 'super_admin'>;
};

export type Tenant = {
  id: string;
  name: string;
  role: Role;
};

export type Site = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type SessionResponse = {
  access_token?: string;
  user: User;
  tenant: Tenant;
  sites: Site[];
  closure_hour: number;
};

export type Prediction = {
  prediction_date: string;
  estimated_visitors: number;
  score: number;
  level: string;
  model_version: string;
  temperature_max?: number;
  precipitation_probability?: number;
  precipitation_mm?: number;
  weather_code?: number;
};

export type WeatherForecast = {
  date: string;
  temperature_max: number;
  precipitation_mm: number;
  precipitation_probability: number | null;
  weather_code: number;
  observed: boolean;
};

export type WeatherResponse = { source: string; days: WeatherForecast[] };

export type ClosureStatus = {
  date: string;
  status: 'pending' | 'processing' | 'ready';
  closed: boolean;
  tickets: number;
  prediction_available: boolean;
  event_published_at: string | null;
  event_error: string | null;
  closure_hour: number;
};

export type SaleResult = {
  codes: string[];
  quantity: number;
  issued_for: string;
};

export type SaleEntry = {
  id: string;
  issuedFor: string;
  quantity: number;
  codes: string[];
  status: 'success';
  createdAt: string;
};

export type VisitSubmission = {
  visit_date: string;
  local_visitors: number;
  national_visitors: number;
  foreign_visitors: number;
  total_visitors: number;
  notes?: string;
};
