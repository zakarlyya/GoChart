export interface Plane {
  id: number;
  tail_number: string;
  model: string;
  manufacturer: string;
  nickname?: string;
  num_engines: number;
  num_seats: number;
  isLocked?: boolean;
  modelLocked?: boolean;
  manufacturerLocked?: boolean;
  enginesLocked?: boolean;
  seatsLocked?: boolean;
}

export interface Trip {
  id: number;
  plane_id: number;
  pilot_id: number | null;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  estimated_arrival_time: string;
  actual_departure_time: string | null;
  actual_arrival_time: string | null;
  status: 'scheduled' | 'departed' | 'arrived';
  estimated_total_cost: number;
}

export interface Pilot {
  id: number;
  name: string;
  license_number: string;
  rating?: string;
  total_hours?: number;
  contact_number?: string;
  email?: string;
}

export interface Airport {
  icao: string;
  name: string;
  city: string;
  country: string;
  coordinates: [number, number];
} 