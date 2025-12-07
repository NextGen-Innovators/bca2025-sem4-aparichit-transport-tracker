import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { role, name, email, emergencyContact, vehicleType, vehicleNumber, licenseNumber, capacity, route } = body;

        // Update basic user info
        const updateUserStmt = db.prepare(`
            UPDATE users SET 
                name = COALESCE(?, name), 
                email = COALESCE(?, email) 
            WHERE id = ?
        `);
        updateUserStmt.run(name, email, userId);

        if (role === 'passenger') {
            // Passenger specific updates if any (e.g. emergency contact - not in schema yet but ignoring for now or adding column)
            // Schema has users table. If we want emergency contact, we need to add it or store in separate table.
            // For now, let's assume we just updated name/email.
        } else if (role === 'driver') {
            // Upsert Driver Profile
            const upsertDriverStmt = db.prepare(`
                INSERT INTO driver_profiles (user_id, vehicle_number, license_number, capacity, vehicle_type, is_approved)
                VALUES (?, ?, ?, ?, ?, 1)
                ON CONFLICT(user_id) DO UPDATE SET
                    vehicle_number = excluded.vehicle_number,
                    license_number = excluded.license_number,
                    capacity = excluded.capacity,
                    vehicle_type = excluded.vehicle_type
            `);
            upsertDriverStmt.run(userId, vehicleNumber, licenseNumber, capacity, vehicleType);

            // Upsert Bus
            // Check if bus exists for this driver
            const getBusStmt = db.prepare('SELECT id FROM buses WHERE driver_id = ?');
            const existingBus = getBusStmt.get(userId) as any;

            if (existingBus) {
                const updateBusStmt = db.prepare(`
                    UPDATE buses SET
                        bus_number = ?,
                        route = ?,
                        capacity = ?,
                        is_active = 1
                    WHERE id = ?
                 `);
                updateBusStmt.run(vehicleNumber, route, capacity, existingBus.id);
            } else {
                const busId = `bus_${userId}`; // simple deterministic ID or uuid
                const insertBusStmt = db.prepare(`
                    INSERT INTO buses (id, driver_id, bus_number, route, capacity, is_active, lat, lng, booking_status)
                    VALUES (?, ?, ?, ?, ?, 1, 27.7172, 85.3240, 'active')
                 `);
                // Note: booking_status not in schema? Schema has is_active.
                // Schema columns: id, driver_id, bus_number, route, lat, lng, headings, speed, destination_*, is_active, capacity, online_booked_seats, ...

                const insertBusCorrectStmt = db.prepare(`
                    INSERT INTO buses (id, driver_id, bus_number, route, capacity, is_active, lat, lng)
                    VALUES (?, ?, ?, ?, ?, 1, 27.7172, 85.3240)
                 `);
                insertBusCorrectStmt.run(busId, userId, vehicleNumber, route, capacity);
            }
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Profile update error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
