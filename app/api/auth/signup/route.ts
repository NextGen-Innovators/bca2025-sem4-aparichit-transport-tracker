import { NextResponse } from 'next/server';
import db, { createUser, getUserByEmail } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_name, email, password, role } = body;

    // Validate input
    if (!user_name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Name, email, password, and role are required' },
        { status: 400 }
      );
    }

    if (!['admin', 'driver', 'passenger'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    // Note: createUser now expects { user_name, email, password, role }
    // We pass the hashed password as 'password' to the helper if the helper expects 'password' column mapping
    // Let's check lib/db.ts:
    // INSERT INTO users (user_name, email, password, role) VALUES (@user_name, @email, @password, @role)
    const result = createUser({
      user_name,
      email,
      password: hashedPassword,
      role
    });

    const userId = result.lastInsertRowid;

    // Create response
    const response = NextResponse.json(
      { success: true, message: 'User registered successfully', userId },
      { status: 201 }
    );

    // Automatically log them in by setting the cookie?
    // The previous implementation did this. Let's keep it.
    response.cookies.set('session_user_id', userId.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 // 1 day
    });

    response.cookies.set('user_role', role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 // 1 day
    });

    return response;

  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
