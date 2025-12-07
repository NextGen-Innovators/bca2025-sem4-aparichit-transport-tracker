
export interface DbUser {
    id: string;
    email: string | null;
    phone: string | null;
    password_hash: string | null;
    name: string;
    role: 'driver' | 'passenger';
    created_at: string;
}

export interface DbBus {
    id: string;
    driver_id: string;
    bus_number: string;
    route: string;
    lat: number | null;
    lng: number | null;
    is_active: number; // 0 or 1
    capacity: number;
}
