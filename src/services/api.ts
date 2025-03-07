import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: '/',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized - redirect to login
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Types
export interface Plane {
  id: number;
  tail_number: string;
  model: string;
  manufacturer: string;
  nickname?: string;
  num_engines: number;
  num_seats: number;
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

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/api/login', { email, password });
    return response.data;
  },
  
  register: async (email: string, password: string, company_name: string) => {
    const response = await api.post('/api/register', { email, password, company_name });
    return response.data;
  }
};

// Planes API
export const planesAPI = {
  getAll: async () => {
    const response = await api.get<Plane[]>('/api/planes');
    return response.data;
  },
  
  getById: async (id: number) => {
    const response = await api.get<Plane>(`/api/planes/${id}`);
    return response.data;
  },
  
  create: async (plane: Omit<Plane, 'id'>) => {
    const response = await api.post<Plane>('/api/planes', plane);
    return response.data;
  },
  
  update: async (id: number, plane: Partial<Plane>) => {
    const response = await api.put<Plane>(`/api/planes/${id}`, plane);
    return response.data;
  },
  
  delete: async (id: number) => {
    const response = await api.delete(`/api/planes/${id}`);
    return response.data;
  }
};

// Trips API
export const tripsAPI = {
  getAll: async () => {
    const response = await api.get<Trip[]>('/api/trips');
    return response.data;
  },
  
  getById: async (id: number) => {
    const response = await api.get<Trip>(`/api/trips/${id}`);
    return response.data;
  },
  
  create: async (trip: Omit<Trip, 'id' | 'estimated_total_cost'>) => {
    const response = await api.post<Trip>('/api/trips', trip);
    return response.data;
  },
  
  update: async (id: number, trip: Partial<Trip>) => {
    const response = await api.put<Trip>(`/api/trips/${id}`, trip);
    return response.data;
  },
  
  delete: async (id: number) => {
    const response = await api.delete(`/api/trips/${id}`);
    return response.data;
  }
};

// Pilots API
export const pilotsAPI = {
  getAll: async () => {
    const response = await api.get<Pilot[]>('/api/pilots');
    return response.data;
  },
  
  getById: async (id: number) => {
    const response = await api.get<Pilot>(`/api/pilots/${id}`);
    return response.data;
  },
  
  create: async (pilot: Omit<Pilot, 'id'>) => {
    const response = await api.post<Pilot>('/api/pilots', pilot);
    return response.data;
  },
  
  update: async (id: number, pilot: Partial<Pilot>) => {
    const response = await api.put<Pilot>(`/api/pilots/${id}`, pilot);
    return response.data;
  },
  
  delete: async (id: number) => {
    const response = await api.delete(`/api/pilots/${id}`);
    return response.data;
  }
};

// Airports API
export const airportsAPI = {
  search: async (query: string) => {
    const response = await api.get<Airport[]>(`/api/airports/search?query=${query}`);
    return response.data;
  }
};

export default {
  auth: authAPI,
  planes: planesAPI,
  trips: tripsAPI,
  pilots: pilotsAPI,
  airports: airportsAPI
}; 