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
            SELECT b.*, t.departure_time, t.arrival_time, r.route_name, r.start_location_name, r.end_location_name, v.plate_number
            FROM bookings b
            JOIN trips t ON b.trip_id = t.id
            JOIN routes r ON t.route_id = r.id
            JOIN vehicles v ON t.vehicle_id = v.id
        `;
        let params: any[] = [];

        if (user.role === 'passenger') {
            query += ' WHERE b.passenger_id = ?';
            params = [user.id];
        } else if (user.role === 'driver') {
            query += ' WHERE t.driver_id = ?';
            params = [user.id];
        } else if (user.role === 'admin') {
            // Admins see all
        }

        query += ' ORDER BY b.booking_date DESC';

        const bookings = db.prepare(query).all(...params);
        return NextResponse.json(bookings);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== 'passenger') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { trip_id, seat_number, pickup_location, dropoff_location } = body;

        console.log("Trip id is ", trip_id);


        if (!trip_id || !seat_number || !pickup_location || !dropoff_location) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(trip_id) as any;
        if (!trip) {
            return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
        }
        if (trip.available_seats <= 0) {
            return NextResponse.json({ error: 'No available seats' }, { status: 400 });
        }

        const existingBooking = db.prepare('SELECT * FROM bookings WHERE trip_id = ? AND seat_number = ? AND status != "cancelled"').get(trip_id, seat_number);
        if (existingBooking) {
            return NextResponse.json({ error: 'Seat already booked' }, { status: 400 });
        }

        const stmt = db.prepare(`
            INSERT INTO bookings (trip_id, passenger_id, seat_number, total_amount, pickup_location_lat, pickup_location_lng, dropoff_location_lat, dropoff_location_lng)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        console.log("pickup location is ", pickup_location);

        const result = stmt.run(trip_id, user.id, seat_number, trip.fare, pickup_location.lat, pickup_location.lng, dropoff_location.lat, dropoff_location.lng);

        db.prepare('UPDATE trips SET available_seats = available_seats - 1 WHERE id = ?').run(trip_id);

        return NextResponse.json({
            message: 'Booking confirmed successfully',
            bookingId: result.lastInsertRowid
        }, { status: 201 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
