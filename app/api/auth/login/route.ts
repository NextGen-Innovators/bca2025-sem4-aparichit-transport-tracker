import { NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
        }

        const user = getUserByEmail(email);

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        const cookieStore = await cookies();
        cookieStore.set('session_user_id', user.id.toString(), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 7, // 1 week
            path: '/',
        });
        // Also set a visible cookie for client-side role checking if needed, or rely on /api/auth/me
        cookieStore.set('user_role', user.role, { path: '/' });

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                name: user.user_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
