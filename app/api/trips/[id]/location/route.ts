import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getCurrentUser();
        // Only drivers can update location (server.js logic)
        if (!user || user.role !== 'driver') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();
        const { lat, lng } = body;

        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
        }

        const trip = db.prepare('SELECT driver_id, status FROM trips WHERE id = ?').get(id) as any;
        if (!trip) {
            return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
        }
        if (trip.driver_id != user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        if (trip.status !== 'on_route') {
            return NextResponse.json({ error: 'Trip strictly not on route' }, { status: 400 });
        }

        const stmt = db.prepare('INSERT INTO trip_locations (trip_id, latitude, longitude) VALUES (?, ?, ?)');
        stmt.run(id, lat, lng);

        return NextResponse.json({ message: 'Location updated', tripId: id, location: { lat, lng } });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
