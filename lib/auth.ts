import { cookies } from 'next/headers';
import { getUserById } from '@/lib/db';
import { User } from '@/lib/types';

export async function getCurrentUser(): Promise<User | null> {
    const cookieStore = await cookies();
    const userId = cookieStore.get('session_user_id')?.value;

    if (!userId) {
        return null;
    }

    const user = getUserById(userId);
    return user || null;
}
