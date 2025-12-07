import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;

        const vehicle = db.prepare('SELECT id, proposed_by_driver_id FROM vehicles WHERE id = ? AND approved = 0').get(id) as any;
        if (!vehicle) {
            return NextResponse.json({ error: 'Vehicle request not found or already approved' }, { status: 404 });
        }

        const stmt = db.prepare(`
      UPDATE vehicles
      SET approved = 1, driver_id = ?, approved_at = CURRENT_TIMESTAMP, approved_by_admin_id = ?
      WHERE id = ?
    `);

        // Assign driver_id to proposer
        stmt.run(vehicle.proposed_by_driver_id, user.id, id);

        return NextResponse.json({ message: 'Vehicle request approved successfully' });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
