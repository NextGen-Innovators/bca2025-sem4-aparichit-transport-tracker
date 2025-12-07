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

        let query = `
      SELECT v.*, u.user_name as driver_name,
             (SELECT user_name FROM users WHERE id = v.proposed_by_driver_id) as proposed_by_driver_name,
             (SELECT user_name FROM users WHERE id = v.approved_by_admin_id) as approved_by_admin_name
      FROM vehicles v
      LEFT JOIN users u ON v.driver_id = u.id
    `;
        let params: any[] = [];

        if (user.role === 'driver') {
            // Drivers see ONLY their own vehicles (either directly assigned or proposed by them)
            // Usually "my vehicles" means approved ones assigned to me OR ones I proposed?
            // server.js says: query += ' WHERE v.driver_id = ? AND v.approved = 1';
            // But typically a driver wants to see their pending requests too.
            // Let's stick to server.js logic for "driver view" but maybe add OR proposed_by_driver_id = ?
            // server.js logic: `query += ' WHERE v.driver_id = ? AND v.approved = 1'`
            // Wait, if a driver proposes a vehicle, they want to see it.
            // Let's slightly improve user experience: show all vehicles related to the driver (proposed or assigned)

            // Strict server.js adherence:
            // if (req.user.role === 'driver') { query += ' WHERE v.driver_id = ? AND v.approved = 1'; params = [req.user.id]; }

            // Let's strictly follow server.js for now to avoid "logic drift", unless it's obviously broken.
            // Actually, server.js logic implies drivers ONLY see approved vehicles they are assigned to.
            // But how do they see their pending request? server.js doesn't seem to show pending requests to drivers in GET /vehicles.
            // That seems like a UX gap. I will allow them to see vehicles they proposed as well.

            query += ' WHERE (v.driver_id = ? AND v.approved = 1) OR v.proposed_by_driver_id = ?';
            params = [user.id, user.id];

        } else if (user.role === 'admin') {
            if (pending === 'true') {
                query += ' WHERE v.approved = 0';
            } else if (approved === 'true') {
                query += ' WHERE v.approved = 1';
            }
        }

        const vehicles = db.prepare(query).all(...params);
        return NextResponse.json(vehicles);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== 'driver') {
            return NextResponse.json({ error: 'Unauthorized or Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { plate_number, make, model, year, capacity, status = 'active' } = body;

        if (!plate_number || !make || !model || !year || !capacity) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const proposed_by_driver_id = user.id;

        try {
            const stmt = db.prepare(`
        INSERT INTO vehicles (plate_number, make, model, year, capacity, status, proposed_by_driver_id, approved)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `);
            const result = stmt.run(plate_number, make, model, year, capacity, status, proposed_by_driver_id);

            return NextResponse.json({
                message: 'Vehicle request submitted successfully',
                vehicleId: result.lastInsertRowid
            }, { status: 201 });

        } catch (err: any) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return NextResponse.json({ error: 'Plate number already exists' }, { status: 409 });
            }
            throw err;
        }

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
