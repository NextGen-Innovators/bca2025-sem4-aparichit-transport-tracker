import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'driver' && user.role !== 'admin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();
        const { status } = body;

        if (!['scheduled', 'on_route', 'completed', 'cancelled'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        if (user.role === 'driver') {
            const trip = db.prepare('SELECT driver_id FROM trips WHERE id = ?').get(id) as any;
            if (!trip || trip.driver_id != user.id) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
            }
        }

        const stmt = db.prepare('UPDATE trips SET status = ? WHERE id = ?');
        const result = stmt.run(status, id);

        if (result.changes === 0) {
            return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
        }

        return NextResponse.json({ message: `Trip status updated to ${status}` });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
