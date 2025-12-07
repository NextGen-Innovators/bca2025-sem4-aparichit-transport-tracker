'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bus, User2, Phone, ShieldCheck, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Role = 'driver' | 'passenger';
type AuthMethod = 'phone' | 'email';

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setRole } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<'role' | 'auth'>('role');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [isSignUp, setIsSignUp] = useState(false);

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set('role', role);
    router.replace(`/auth?${params.toString()}`, { scroll: false });
  };

  const handleSubmit = async () => {
    if (!selectedRole) return;
    if (!password || password.length < 6) {
      toast({ variant: 'destructive', title: 'Invalid Password', description: 'Password must be at least 6 characters.' });
      return;
    }

    if (authMethod === 'email' && !email) {
      toast({ variant: 'destructive', title: 'Missing Email', description: 'Please enter your email.' });
      return;
    }
    if (authMethod === 'phone' && (!phone || phone.length < 10)) {
      toast({ variant: 'destructive', title: 'Invalid Phone', description: 'Please enter a valid phone number.' });
      return;
    }
    if (isSignUp && !name) {
      toast({ variant: 'destructive', title: 'Missing Name', description: 'Please enter your name.' });
      return;
    }

    setLoading(true);

    try {
      const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login';
      const body = {
        role: selectedRole,
        password,
        ...(authMethod === 'email' ? { email } : {}),
        ...(authMethod === 'phone' ? { phone } : {}),
        ...(isSignUp ? { name } : {})
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setRole(selectedRole);

      toast({
        title: isSignUp ? 'Account Created!' : 'Welcome Back!',
        description: `Successfully signed in as ${data.user.name || 'User'}.`,
      });

      router.push(selectedRole === 'driver' ? '/driver' : '/passenger');

    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-2xl space-y-6 relative z-10">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-400/20 backdrop-blur-sm">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-400">Secure Database Auth</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">
            Welcome to
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              Bus Tracker
            </span>
          </h1>

          <p className="text-lg text-slate-300 max-w-md mx-auto">
            {step === 'role'
              ? 'Choose your role to get started'
              : 'Sign in to continue your journey'}
          </p>
        </div>

        {step === 'role' ? (
          <div className="grid md:grid-cols-2 gap-6">
            <div
              onClick={() => handleRoleSelect('driver')}
              className="group cursor-pointer relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition-opacity"></div>
              <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 hover:border-blue-400/50 transition-all duration-300 hover:scale-105">
                <div className="mb-6 w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/50">
                  <Bus className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 text-center">
                  I'm a Driver
                </h3>
              </div>
            </div>

            <div
              onClick={() => handleRoleSelect('passenger')}
              className="group cursor-pointer relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition-opacity"></div>
              <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 hover:border-cyan-400/50 transition-all duration-300 hover:scale-105">
                <div className="mb-6 w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/50">
                  <User2 className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 text-center">
                  I'm a Passenger
                </h3>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-3xl blur-xl"></div>
            <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl">
              <button
                onClick={() => setStep('role')}
                className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <span>←</span>
                <span className="text-sm font-medium">Back</span>
              </button>

              <div className="flex gap-3 p-1.5 bg-slate-800/50 rounded-xl mb-8 border border-slate-700/50">
                <button
                  onClick={() => setAuthMethod('email')}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${authMethod === 'email'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                >
                  <Mail className="w-4 h-4" />
                  <span>Email</span>
                </button>
                <button
                  onClick={() => setAuthMethod('phone')}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${authMethod === 'phone'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                >
                  <Phone className="w-4 h-4" />
                  <span>Phone</span>
                </button>
              </div>

              <div className="flex gap-3 p-1 bg-slate-800/50 rounded-lg border border-slate-700/50 mb-6">
                <button
                  onClick={() => setIsSignUp(false)}
                  className={`flex-1 px-4 py-2.5 rounded-md font-medium transition-all ${!isSignUp
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setIsSignUp(true)}
                  className={`flex-1 px-4 py-2.5 rounded-md font-medium transition-all ${isSignUp
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Sign Up
                </button>
              </div>

              <div className="space-y-4">
                {isSignUp && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Full Name</label>
                    <Input
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                )}

                {authMethod === 'email' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        placeholder="you@example.com"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-slate-800/50 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        placeholder="98XXXXXXXX"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10 bg-slate-800/50 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 bg-slate-800/50 border-slate-700 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-6 rounded-xl shadow-lg shadow-cyan-500/20"
                >
                  {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-500">Loading...</div>}>
      <AuthContent />
    </Suspense>
  );
}
