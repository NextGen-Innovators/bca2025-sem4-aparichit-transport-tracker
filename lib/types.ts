// Basic Location interface from frontend components
export interface Location {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
  timestamp?: Date | string;
}

export type UserRole = 'admin' | 'driver' | 'passenger';

export interface User {
  id: number;
  user_name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Vehicle {
  id: number;
  plate_number: string;
  make: string;
  model: string;
  year: number;
  capacity: number;
  status: 'active' | 'maintenance' | 'inactive';
  driver_id?: number | null;
  proposed_by_driver_id?: number;
  approved: number; // 0 or 1
  approved_at?: string;
  approved_by_admin_id?: number;
  created_at: string;
  // Joins
  driver_name?: string;
  proposed_by_driver_name?: string;
  approved_by_admin_name?: string;
}

export interface Route {
  id: number;
  route_name: string;
  start_location_name: string;
  start_location_lat: number;
  start_location_lng: number;
  end_location_name: string;
  end_location_lat: number;
  end_location_lng: number;
  distance: number;
  estimated_time: number;
  approved: number; // 0 or 1
  created_at: string;
  approved_at?: string;
  approved_by_admin_id?: number;
  proposed_by_driver_id?: number;
  // Joins
  proposed_by_driver_name?: string;
}

export interface Trip {
  id: number;
  route_id: number;
  vehicle_id: number;
  driver_id: number;
  departure_time: string;
  arrival_time: string;
  status: 'scheduled' | 'on_route' | 'completed' | 'cancelled';
  fare: number;
  available_seats: number;
  created_at: string;
  // Joins
  route_name?: string;
  start_location_name?: string;
  end_location_name?: string;
  route_approved?: number;
  plate_number?: string;
  driver_name?: string;
  current_location?: Location;
}

export interface Booking {
  id: number;
  trip_id: number;
  passenger_id: number;
  seat_number: number;
  booking_date: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  total_amount: number;
  pickup_location_lat: number;
  pickup_location_lng: number;
  dropoff_location_lat: number;
  dropoff_location_lng: number;
  // Joins
  passenger_name?: string;
  departure_time?: string;
  arrival_time?: string;
  route_name?: string;
  start_location_name?: string;
  end_location_name?: string;
  plate_number?: string;
}
