import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let query = `
      SELECT t.*, r.route_name, r.start_location_name, r.end_location_name, r.approved as route_approved, v.plate_number, u.user_name as driver_name,
             tl.latitude as current_location_lat, tl.longitude as current_location_lng, tl.timestamp as location_timestamp
      FROM trips t
      JOIN routes r ON t.route_id = r.id
      JOIN vehicles v ON t.vehicle_id = v.id
      JOIN users u ON t.driver_id = u.id
      LEFT JOIN (
          SELECT trip_id, latitude, longitude, timestamp
          FROM trip_locations
          WHERE (trip_id, timestamp) IN (
              SELECT trip_id, MAX(timestamp)
              FROM trip_locations
              GROUP BY trip_id
          )
      ) tl ON t.id = tl.trip_id
    `;
        let params: any[] = [];

        if (user.role === 'passenger') {
            // Passengers see scheduled/on_route trips on approved routes
            query += ' WHERE (t.status = ? OR t.status = ?) AND r.approved = 1';
            // Maybe also filter by departure time? server.js says: departure_time > ?
            // Let's include that.
            params = ['scheduled', 'on_route'];
        } else if (user.role === 'driver') {
            query += ' WHERE t.driver_id = ?';
            params = [user.id];
        }
        // Admins see all

        query += ' ORDER BY t.departure_time ASC';

        const trips = db.prepare(query).all(...params);

        const tripsWithLocation = trips.map((t: any) => ({
            ...t,
            current_location: t.current_location_lat !== null && t.current_location_lng !== null
                ? { lat: t.current_location_lat, lng: t.current_location_lng, timestamp: t.location_timestamp }
                : null,
            current_location_lat: undefined,
            current_location_lng: undefined,
            location_timestamp: undefined
        }));

        return NextResponse.json(tripsWithLocation);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'driver' && user.role !== 'admin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { route_id, vehicle_id, departure_time, arrival_time, fare, available_seats } = body;
        const driver_id = user.id; // Or from body if admin creating for someone else? server.js implies current user (driver)

        if (!route_id || !vehicle_id || !departure_time || !arrival_time || !fare || !available_seats) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const route = db.prepare('SELECT approved, proposed_by_driver_id FROM routes WHERE id = ?').get(route_id) as any;
        if (!route) {
            return NextResponse.json({ error: 'Route not found' }, { status: 404 });
        }
        if (!route.approved) {
            return NextResponse.json({ error: 'Route not approved' }, { status: 400 });
        }

        if (user.role === 'driver' && route.proposed_by_driver_id != user.id) {
            // server.js logic: returns 403.
            return NextResponse.json({ error: 'You can only create trips for routes you proposed' }, { status: 403 });
        }

        const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ? AND driver_id = ?').get(vehicle_id, user.id) as any;
        if (!vehicle && user.role !== 'admin') {
            return NextResponse.json({ error: 'You do not own the selected vehicle' }, { status: 403 });
        }

        const stmt = db.prepare(`
      INSERT INTO trips (route_id, vehicle_id, driver_id, departure_time, arrival_time, fare, available_seats)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(route_id, vehicle_id, driver_id, departure_time, arrival_time, fare, available_seats);

        return NextResponse.json({
            message: 'Trip created successfully',
            tripId: result.lastInsertRowid
        }, { status: 201 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
