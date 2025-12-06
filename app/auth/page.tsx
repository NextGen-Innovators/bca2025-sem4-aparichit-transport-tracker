/* /auth/page.tsx */
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FirebaseError } from 'firebase/app';
import { Bus, User2, Phone, ShieldCheck, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/contexts/AuthContext';
import { getFirebaseAuth, getFirestoreDb, signInWithEmail, createUserWithEmail, sendPasswordReset } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';

type Role = 'driver' | 'passenger';
type AuthMethod = 'phone' | 'email';

const mapFirebaseError = (err: unknown) => {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/configuration-not-found':
        return 'Phone authentication is not fully configured. Please enable Phone provider and reCAPTCHA in Firebase console.';
      case 'auth/invalid-phone-number':
        return 'The phone number format looks incorrect. Please double-check and try again.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment before trying again.';
      case 'auth/billing-not-enabled':
        return 'Phone authentication requires Blaze (pay-as-you-go) billing in Firebase.';
      case 'auth/invalid-verification-code':
        return 'Invalid verification code. Please try again.';
      case 'auth/code-expired':
        return 'Verification code has expired. Please request a new one.';
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please sign in instead.';
      case 'auth/invalid-email':
        return 'Invalid email address format.';
      case 'auth/user-not-found':
        return 'No account found with this email. Please sign up first.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please check your credentials.';
      default:
        return err.message;
    }
  }
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'Something went wrong. Please try again.';
};

const isFirestoreOfflineError = (err: unknown): err is FirebaseError => {
  return (
    err instanceof FirebaseError &&
    (err.code === 'unavailable' || err.message.toLowerCase().includes('client is offline'))
  );
};

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithPhone, verifyOTP, setRole } = useAuth();

  const [step, setStep] = useState<'role' | 'auth'>('role');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');
  const [isSignUp, setIsSignUp] = useState(false);

  // Phone auth state
  const [phone, setPhone] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Email auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const fullPhone = `+977${phone.replace(/\D/g, '')}`;

  // Auto-select role from URL parameter
  useEffect(() => {
    const roleParam = searchParams.get('role') as Role | null;
    if (roleParam && (roleParam === 'driver' || roleParam === 'passenger')) {
      setSelectedRole(roleParam);
      setStep('auth');
    }
  }, [searchParams]);

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setStep('auth');

    // Keep URL in sync with the selected role so links/tabs behave correctly
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set('role', role);
    const query = params.toString();
    router.replace(`/auth${query ? `?${query}` : ''}`, { scroll: false });
  };

  const handleSendOtp = async () => {
    if (isSending || confirmationResult || !selectedRole) {
      return;
    }

    if (!phone || phone.replace(/\D/g, '').length < 8) {
      toast('Invalid phone number', {
        description: 'Please enter a valid 10-digit Nepali phone number.',
      });
      return;
    }

    try {
      setIsSending(true);
      const result = await signInWithPhone(fullPhone, selectedRole);
      setConfirmationResult(result);
      setOtpOpen(true);
      toast('OTP sent', {
        description: `Verification code sent to ${fullPhone}`,
      });
    } catch (err: unknown) {
      console.error(err);
      toast('Failed to send OTP', {
        description: mapFirebaseError(err),
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async (codeOverride?: string) => {
    if (!confirmationResult || !selectedRole || isVerifying) return;

    const codeToVerify = (codeOverride ?? otp).replace(/\D/g, '').slice(0, 6);
    if (codeOverride && codeOverride !== otp) {
      setOtp(codeToVerify);
    }

    if (!codeToVerify || codeToVerify.length < 6) {
      toast('Invalid code', {
        description: 'Please enter the 6-digit verification code.',
      });
      return;
    }

    let shouldCompleteProfile = false;

    try {
      setIsVerifying(true);
      await verifyOTP(confirmationResult, codeToVerify, selectedRole);

      try {
        // Check if user needs to complete profile (skip if offline)
        const db = getFirestoreDb();
        const user = getFirebaseAuth().currentUser;
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          shouldCompleteProfile = !userDoc.exists();
        }
      } catch (firestoreErr) {
        if (isFirestoreOfflineError(firestoreErr)) {
          console.warn('[Auth] Skipping Firestore profile check (offline).');
          toast('Signed in offline', {
            description: 'We will sync your profile once the connection is back.',
          });
        } else {
          throw firestoreErr;
        }
      }

      if (shouldCompleteProfile) {
        router.push('/auth/profile');
        return;
      }

      // Existing user - redirect to dashboard
      const target = selectedRole === 'driver' ? '/driver' : '/passenger';
      router.replace(target);
      toast('Welcome back!', {
        description: 'Successfully signed in.',
      });
    } catch (err: unknown) {
      console.error(err);
      toast('Verification failed', {
        description: mapFirebaseError(err),
      });
      setOtp('');
    } finally {
      setIsVerifying(false);
    }
  };

  // Auto-submit OTP when 6 digits are entered
  const handleOtpChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setOtp(digits);
    if (digits.length === 6 && confirmationResult) {
      handleVerifyOtp(digits);
    }
  };

  // Email/Password Authentication
  const handleEmailAuth = async () => {
    if (!selectedRole || isAuthenticating) return;

    if (!email || !password) {
      toast('Missing fields', {
        description: 'Please enter both email and password.',
      });
      return;
    }

    if (password.length < 6) {
      toast('Weak password', {
        description: 'Password must be at least 6 characters.',
      });
      return;
    }

    try {
      setIsAuthenticating(true);

      let userCredential;
      if (isSignUp) {
        // Sign up
        userCredential = await createUserWithEmail(email, password);

        // Create user record in Firestore client-side first
        // This ensures the user exists even if the server-side registration fails (e.g. missing Admin SDK)
        const db = getFirestoreDb();
        const userRef = doc(db, 'users', userCredential.user.uid);

        await setDoc(userRef, {
          id: userCredential.user.uid,
          email: email,
          phone: '',
          name: email.split('@')[0],
          role: selectedRole,
          createdAt: new Date().toISOString(),
          ...(selectedRole === 'driver' && {
            isApproved: false,
            rating: null,
          }),
        }, { merge: true });

        // Register user in backend (for custom claims) - Non-blocking
        const idToken = await userCredential.user.getIdToken();
        try {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idToken,
              role: selectedRole,
              userData: {
                email,
                phone: '',
                name: email.split('@')[0],
              },
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.warn('Server registration warning (Dev Mode?):', errorData);
            // Do not throw here, as we already created the profile client-side
          }
        } catch (err) {
          console.warn('Failed to call register API (Dev Mode?):', err);
        }

        // Create session
        await fetch('/api/sessionLogin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, role: selectedRole }),
        });

        // Explicitly set role in context to avoid race condition
        setRole(selectedRole);

        toast('Account created!', {
          description: 'Welcome to Bus Tracker.',
        });

        // Redirect to profile completion
        router.push('/auth/profile');
      } else {
        // Sign in
        userCredential = await signInWithEmail(email, password);

        // Create session
        const idToken = await userCredential.user.getIdToken();
        await fetch('/api/sessionLogin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, role: selectedRole }),
        });

        // Check if profile exists (skip if offline)
        let shouldCompleteProfile = false;
        try {
          const db = getFirestoreDb();
          const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
          shouldCompleteProfile = !userDoc.exists();
        } catch (firestoreErr) {
          if (isFirestoreOfflineError(firestoreErr)) {
            console.warn('[Auth] Skipping Firestore profile check (offline).');
            toast('Signed in offline', {
              description: 'We will sync your profile once the connection is back.',
            });
          } else {
            throw firestoreErr;
          }
        }

        if (shouldCompleteProfile) {
          router.push('/auth/profile');
          return;
        }

        // Redirect to dashboard
        const target = selectedRole === 'driver' ? '/driver' : '/passenger';
        router.replace(target);

        toast('Welcome back!', {
          description: 'Successfully signed in.',
        });
      }
    } catch (err: unknown) {
      console.error(err);
      toast(isSignUp ? 'Sign up failed' : 'Sign in failed', {
        description: mapFirebaseError(err),
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast('Email required', {
        description: 'Please enter your email address.',
      });
      return;
    }

    try {
      await sendPasswordReset(email);
      toast('Password reset email sent', {
        description: 'Check your inbox for instructions to reset your password.',
      });
    } catch (err: unknown) {
      console.error(err);
      toast('Failed to send reset email', {
        description: mapFirebaseError(err),
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm">
            <ShieldCheck className="w-4 h-4" />
            Secure authentication
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Welcome to Bus Tracker
          </h1>
          <p className="text-sm text-gray-600">
            Choose your role and sign in with phone or email
          </p>
        </div>

        {step === 'role' ? (
          <div className="grid md:grid-cols-2 gap-4">
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-500"
              onClick={() => handleRoleSelect('driver')}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                  <Bus className="w-8 h-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl">I&apos;m a Driver</CardTitle>
                <CardDescription>
                  Manage your bus, track passengers, and update location
                </CardDescription>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-green-500"
              onClick={() => handleRoleSelect('passenger')}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <User2 className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-xl">I&apos;m a Passenger</CardTitle>
                <CardDescription>
                  Find nearby buses, book seats, and track your ride
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <Card className="backdrop-blur bg-white/90 border-gray-200 shadow-lg">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStep('role');
                    setPhone('');
                    setEmail('');
                    setPassword('');
                    setOtp('');
                    setConfirmationResult(null);
                  }}
                >
                  ← Back
                </Button>
              </div>
              <CardTitle className="text-xl">
                {selectedRole === 'driver' ? '🚌 Driver' : '👤 Passenger'} Authentication
              </CardTitle>
              <CardDescription>
                Choose your preferred sign-in method
              </CardDescription>

              {/* Auth Method Tabs */}
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                <Button
                  variant={authMethod === 'phone' ? 'default' : 'ghost'}
                  className="flex-1"
                  onClick={() => setAuthMethod('phone')}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Phone
                </Button>
                <Button
                  variant={authMethod === 'email' ? 'default' : 'ghost'}
                  className="flex-1"
                  onClick={() => setAuthMethod('email')}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {authMethod === 'phone' ? (
                <>
                  {/* Phone Authentication */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Phone Number (Nepal)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="px-4 py-2.5 rounded-md border bg-gray-50 text-sm font-medium text-gray-700 whitespace-nowrap">
                        +977
                      </div>
                      <Input
                        type="tel"
                        placeholder="98XXXXXXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="flex-1 text-lg"
                        maxLength={10}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      We&apos;ll send a 6-digit verification code via SMS
                    </p>
                  </div>

                  <Button
                    className="w-full h-11 text-base"
                    onClick={handleSendOtp}
                    disabled={isSending || !!confirmationResult || phone.length < 8}
                  >
                    {isSending ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Sending OTP...
                      </>
                    ) : (
                      <>
                        <Phone className="w-4 h-4 mr-2" />
                        Send Verification Code
                      </>
                    )}
                  </Button>

                  {/* reCAPTCHA container (invisible) */}
                  <div id="recaptcha-container" className="h-0 w-0 overflow-hidden" />
                </>
              ) : (
                <>
                  {/* Email Authentication */}
                  {/* Sign In / Sign Up Toggle */}
                  <div className="flex gap-2 p-1 bg-gray-50 rounded-lg">
                    <Button
                      variant={!isSignUp ? 'default' : 'ghost'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setIsSignUp(false)}
                    >
                      Sign In
                    </Button>
                    <Button
                      variant={isSignUp ? 'default' : 'ghost'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setIsSignUp(true)}
                    >
                      Sign Up
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      {isSignUp ? 'Minimum 6 characters' : ''}
                    </p>
                  </div>

                  <Button
                    className="w-full h-11 text-base"
                    onClick={handleEmailAuth}
                    disabled={isAuthenticating || !email || !password}
                  >
                    {isAuthenticating ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        {isSignUp ? 'Creating Account...' : 'Signing In...'}
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        {isSignUp ? 'Create Account' : 'Sign In'}
                      </>
                    )}
                  </Button>

                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="w-full text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Forgot Password?
                    </button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-center text-gray-500 max-w-md mx-auto">
          {authMethod === 'phone'
            ? 'By continuing, you agree to receive an SMS for verification. Standard SMS charges may apply.'
            : 'By continuing, you agree to our Terms of Service and Privacy Policy.'}
        </p>
      </div>

      {/* OTP Dialog */}
      <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enter verification code</DialogTitle>
            <DialogDescription>
              We&apos;ve sent a 6-digit code to{' '}
              <span className="font-medium text-gray-900">{fullPhone}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => handleOtpChange(e.target.value)}
              className="text-center tracking-[0.5em] text-2xl font-mono h-14"
              autoFocus
            />
            <Button
              className="w-full h-11"
              onClick={() => handleVerifyOtp()}
              disabled={isVerifying || otp.length !== 6}
            >
              {isVerifying ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Verifying...
                </>
              ) : (
                'Verify & Continue'
              )}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setOtpOpen(false);
                setOtp('');
                setConfirmationResult(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
