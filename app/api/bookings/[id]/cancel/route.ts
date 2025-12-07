import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== 'passenger') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;

        const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND passenger_id = ?').get(id, user.id) as any;
        if (!booking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        if (booking.status === 'cancelled') {
            return NextResponse.json({ error: 'Booking already cancelled' }, { status: 400 });
        }

        db.prepare('UPDATE bookings SET status = "cancelled" WHERE id = ?').run(id);
        db.prepare('UPDATE trips SET available_seats = available_seats + 1 WHERE id = ?').run(booking.trip_id);

        return NextResponse.json({ message: 'Booking cancelled successfully' });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
