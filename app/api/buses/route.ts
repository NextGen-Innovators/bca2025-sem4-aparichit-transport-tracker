
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { cookies } from 'next/headers';

// Helper to get all buses
function getAllBuses() {
    const stmt = db.prepare('SELECT * FROM buses WHERE is_active = 1');
    return stmt.all();
}

// Helper to update bus location
function updateBus(driverId: string, data: any) {
    // First check if bus exists for driver
    let bus = db.prepare('SELECT * FROM buses WHERE driver_id = ?').get(driverId) as any;

    const now = new Date().toISOString();

    if (!bus) {
        // Create bus entry if not exists (lazy creation for demo)
        const busId = `bus_${driverId}`;
        db.prepare(`
      INSERT INTO buses (id, driver_id, bus_number, route, lat, lng, is_active, last_location_update)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(busId, driverId, 'BUS-001', 'City Loop', data.lat || 0, data.lng || 0, now);
        bus = { id: busId }; // minimal
    }

    // Update
    const updateFields = [];
    const updateValues = [];

    if (data.lat !== undefined) { updateFields.push('lat = ?'); updateValues.push(data.lat); }
    if (data.lng !== undefined) { updateFields.push('lng = ?'); updateValues.push(data.lng); }
    if (data.heading !== undefined) { updateFields.push('heading = ?'); updateValues.push(data.heading); }
    if (data.speed !== undefined) { updateFields.push('speed = ?'); updateValues.push(data.speed); }

    updateFields.push('last_location_update = ?');
    updateValues.push(now);

    // Ensure active
    updateFields.push('is_active = 1');

    updateValues.push(bus.id); // for WHERE clause

    db.prepare(`UPDATE buses SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues);

    return { success: true };
}

export async function GET(req: Request) {
    try {
        const buses = getAllBuses();

        // Transform for frontend if needed (e.g. nested currentLocation object or stick to flat)
        // The frontend likely expects: { id, currentLocation: { lat, lng }, ... } 
        // based on previous firebase types.
        // Let's adapt response to match `Bus` type in types.ts roughly.

        const formattedBuses = buses.map((b: any) => ({
            id: b.id,
            driverName: 'Driver', // Join with users table if needed
            busNumber: b.bus_number,
            route: b.route,
            currentLocation: {
                lat: b.lat,
                lng: b.lng,
                timestamp: b.last_location_update
            },
            capacity: b.capacity || 40,
            isActive: !!b.is_active,
            vehicleType: 'bus' // default
        }));

        return NextResponse.json({ buses: formattedBuses });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch buses' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        updateBus(userId, body);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update bus' }, { status: 500 });
    }
}
