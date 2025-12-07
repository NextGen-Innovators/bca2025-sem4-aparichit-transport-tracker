
import { NextResponse } from 'next/server';
import { getUserById } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ user: null });
        }

        const user = await getUserById(userId); // Await the async function call
        if (!user) {
            return NextResponse.json({ user: null });
        }

        // Destructure password_hash and other properties.
        // Explicitly map user_name to name for the client-side representation.
        const { password_hash, user_name, ...restOfUser } = user;
        const safeUser = {
            ...restOfUser,
            name: user_name, // Return user_name as 'name'
        };

        return NextResponse.json({ user: safeUser });
    } catch (error) {
        console.error('Session error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
