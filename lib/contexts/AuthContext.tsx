'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, ConfirmationResult } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { getFirebaseAuth, signInWithPhone, getFirestoreDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Cookies from 'js-cookie';

type Role = 'driver' | 'passenger' | null;

interface AuthContextValue {
	currentUser: User | null;
	role: Role;
	loading: boolean;
	setRole: (role: Role) => void;
	signInWithPhone: (phone: string, role: Role) => Promise<ConfirmationResult>;
	verifyOTP: (confirmationResult: ConfirmationResult, code: string, role: Role) => Promise<void>;
	signOut: () => Promise<void>;
	userData: any | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [currentUser, setCurrentUser] = useState<User | null>(null);
	const [role, setRoleState] = useState<Role>(null);
	const [loading, setLoading] = useState(true);
	const [userData, setUserData] = useState<any | null>(null);

	useEffect(() => {
		const auth = getFirebaseAuth();

		// Get role from cookie
		const storedRole = Cookies.get('role') as Role;
		if (storedRole) {
			setRoleState(storedRole);
		}

		const unsubscribe = auth.onAuthStateChanged(async (user) => {
			setCurrentUser(user);

			if (user) {
				try {
					// Fetch user data from Firestore
					const db = getFirestoreDb();
					const userDoc = await getDoc(doc(db, 'users', user.uid));

					if (userDoc.exists()) {
						const data = userDoc.data();
						setUserData(data);
						if (data.role) {
							setRoleState(data.role);
							Cookies.set('role', data.role, { expires: 7 });
						}
					}
				} catch (err) {
					if (isFirestoreOfflineError(err)) {
						console.warn('[Auth] Initial user load skipped (offline).');
					} else {
						console.error('[Auth] Failed to load user profile', err);
					}
				}
			} else {
				setUserData(null);
				setRoleState(null);
				Cookies.remove('role');
			}

			setLoading(false);
		});

		return () => unsubscribe();
	}, []);

	const setRole = (newRole: Role) => {
		setRoleState(newRole);
		if (newRole) {
			Cookies.set('role', newRole, { expires: 7 });
		} else {
			Cookies.remove('role');
		}
	};

	const handleSignInWithPhone = async (phone: string, userRole: Role): Promise<ConfirmationResult> => {
		if (!userRole) {
			throw new Error('Role is required');
		}
		return await signInWithPhone(phone, 'recaptcha-container');
	};

	const isFirestoreOfflineError = (err: unknown): err is FirebaseError => {
		return (
			err instanceof FirebaseError &&
			(err.code === 'unavailable' ||
				err.message.toLowerCase().includes('client is offline'))
		);
	};

	const handleVerifyOTP = async (
		confirmationResult: ConfirmationResult,
		code: string,
		userRole: Role
	): Promise<void> => {
		if (!userRole) {
			throw new Error('Role is required');
		}

		const cred = await confirmationResult.confirm(code);
		const user = cred.user;
		const idToken = await user.getIdToken(true);

		// Check if user exists in Firestore first
		const db = getFirestoreDb();
		const userDocRef = doc(db, 'users', user.uid);

		let userDoc: Awaited<ReturnType<typeof getDoc>> | null = null;
		try {
			userDoc = await getDoc(userDocRef);
		} catch (err) {
			if (isFirestoreOfflineError(err)) {
				console.warn('[Auth] Firestore lookup failed (offline). Continuing login.');
			} else {
				throw err;
			}
		}

		const userDocExists = userDoc?.exists() ?? null;

		if (userDocExists === false) {
			// New user - set role temporarily for profile page, but don't create session yet
			setRole(userRole);
			Cookies.set('role', userRole, { expires: 1 }); // Temporary, expires in 1 day
			return; // Let the auth page handle redirect to profile
		}

		// Existing user - create session and set role
		const response = await fetch('/api/sessionLogin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idToken, role: userRole }),
		});

		if (!response.ok) {
			const errorPayload = await response.json().catch(() => null);
			throw new Error(errorPayload?.error || 'Failed to create session');
		}

		const userData = userDocExists ? userDoc?.data() : null;
		setRole(userData?.role || userRole);
		setUserData(userData || null);
	};

	const signOut = async () => {
		const auth = getFirebaseAuth();
		try {
			await fetch('/api/sessionLogout', { method: 'POST' });
		} catch {
			// ignore
		}
		await auth.signOut();
		setRole(null);
		setUserData(null);
		Cookies.remove('role');
	};

	return (
		<AuthContext.Provider
			value={{
				currentUser,
				role,
				loading,
				setRole,
				signInWithPhone: handleSignInWithPhone,
				verifyOTP: handleVerifyOTP,
				signOut,
				userData,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export const useAuth = () => {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return ctx;
};


