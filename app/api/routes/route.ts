import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(req.url);
        const pending = url.searchParams.get('pending');
        const approved = url.searchParams.get('approved');

        let query = `SELECT *, (SELECT user_name FROM users WHERE id = routes.proposed_by_driver_id) as proposed_by_driver_name FROM routes`;
        let params: any[] = [];

        if (user.role === 'admin') {
            if (pending === 'true') {
                query += ' WHERE approved = 0';
            } else if (approved === 'true') {
                query += ' WHERE approved = 1';
            }
        } else {
            // Non-admins see approved routes
            // Drivers might want to see their own proposed routes?
            // server.js logic:
            // if (user.role !== 'admin') { query += ' WHERE approved = 1'; }
            // But let's allow drivers to see their own proposals too.
            // query += ' WHERE approved = 1 OR proposed_by_driver_id = ?';

            // Strict server.js adherence for now for general list:
            query += ' WHERE approved = 1';

            // If we want to support showing own proposals, we'd need to adjust.
            // But let's stick to the core requirement first.
        }

        const routes = db.prepare(query).all(...params);
        return NextResponse.json(routes);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== 'driver') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { route_name, start_location, end_location, distance, estimated_time } = body;

        if (!route_name || !start_location || !end_location || !distance || !estimated_time) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Extract location details
        const { name: start_name, lat: start_lat, lng: start_lng } = start_location;
        const { name: end_name, lat: end_lat, lng: end_lng } = end_location;

        const stmt = db.prepare(`
      INSERT INTO routes (route_name, start_location_name, start_location_lat, start_location_lng, end_location_name, end_location_lat, end_location_lng, distance, estimated_time, proposed_by_driver_id, approved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

        const result = stmt.run(route_name, start_name || 'Start', start_lat, start_lng, end_name || 'End', end_lat, end_lng, distance, estimated_time, user.id);

        return NextResponse.json({
            message: 'Route proposal submitted successfully',
            routeId: result.lastInsertRowid
        }, { status: 201 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
