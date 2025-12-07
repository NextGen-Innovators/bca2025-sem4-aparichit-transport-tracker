import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const users = db.prepare('SELECT id, user_name, email, role, created_at FROM users').all();
        return NextResponse.json(users);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
