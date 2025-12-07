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

        const route = db.prepare('SELECT id FROM routes WHERE id = ? AND approved = 0').get(id);
        if (!route) {
            return NextResponse.json({ error: 'Route not found or already approved' }, { status: 404 });
        }

        const stmt = db.prepare(`
      UPDATE routes
      SET approved = 1, approved_at = CURRENT_TIMESTAMP, approved_by_admin_id = ?
      WHERE id = ?
    `);

        stmt.run(user.id, id);

        return NextResponse.json({ message: 'Route approved successfully' });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
