'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Bus, User2, Loader2, Upload, Camera, MapPin, Shield, Phone, Mail, CreditCard, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { VEHICLE_TYPES, DEFAULT_LOCATION } from '@/lib/constants';
import { VehicleTypeId } from '@/lib/types';

const driverSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  vehicleType: z.enum(['bus', 'others', 'taxi', 'bike']),
  vehicleNumber: z.string().min(1, 'Vehicle number is required'),
  licenseNumber: z.string().min(1, 'License number is required'),
  route: z.string().min(1, 'Route is required'),
  capacity: z.number().min(1).max(100),
  profileImage: z.string().optional(),
  vehicleImage: z.string().optional(),
});

const passengerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  emergencyContact: z.string().min(10, 'Emergency contact must be at least 10 digits').optional().or(z.literal('')),
});

type DriverFormData = z.infer<typeof driverSchema>;
type PassengerFormData = z.infer<typeof passengerSchema>;

const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [vehiclePreview, setVehiclePreview] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
      return;
    }

  }, [user, loading, router]);

  const driverForm = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      name: user?.name || '',
      vehicleType: 'bus',
      vehicleNumber: '',
      licenseNumber: '',
      route: '',
      capacity: 40,
    },
  });

  const passengerForm = useForm<PassengerFormData>({
    resolver: zodResolver(passengerSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      emergencyContact: '',
    },
  });

  // Set default values when user is loaded
  useEffect(() => {
    if (user) {
      if (role === 'driver') {
        driverForm.setValue('name', user.name);
      } else {
        passengerForm.setValue('name', user.name);
        passengerForm.setValue('email', user.email);
      }
    }
  }, [user, role, driverForm, passengerForm]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'profileImage' | 'vehicleImage') => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        if (file.size > 5 * 1024 * 1024) {
          toast({ variant: 'destructive', title: 'File too large', description: 'Image must be less than 5MB' });
          return;
        }

        const resized = await resizeImage(file);
        driverForm.setValue(field, resized);

        if (field === 'profileImage') setProfilePreview(resized);
        else setVehiclePreview(resized);
      } catch (err) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to process image.' });
      }
    }
  };

  const handleDriverSubmit = async (data: DriverFormData) => {
    if (!user || role !== 'driver') return;

    try {
      setIsSubmitting(true);
      const vehicleTypeData = VEHICLE_TYPES.find((v) => v.id === data.vehicleType);
      const capacity = vehicleTypeData?.capacity || data.capacity;

      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'driver',
          ...data,
          capacity
        }),
      });

      if (!res.ok) throw new Error('Failed to update profile');

      toast({ title: 'Profile created!', description: 'Your driver profile has been set up successfully.' });
      setHasRedirected(true);
      window.location.href = '/driver';
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save profile.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePassengerSubmit = async (data: PassengerFormData) => {
    if (!user || role !== 'passenger') return;

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'passenger',
          ...data
        }),
      });

      if (!res.ok) throw new Error('Failed to update profile');

      toast({ title: 'Profile created!', description: 'Your passenger profile has been set up successfully.' });
      setHasRedirected(true);
      window.location.href = '/passenger';
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save profile.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !user || !role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  const isDriver = role === 'driver';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500 to-blue-600 mb-6 shadow-2xl shadow-cyan-500/50">
              {isDriver ? (
                <Bus className="w-10 h-10 text-white" />
              ) : (
                <User2 className="w-10 h-10 text-white" />
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
              {currentStep === 1 ? 'Welcome!' : `${isDriver ? 'Driver' : 'Passenger'} Profile`}
            </h1>
            <p className="text-xl text-slate-400">
              {currentStep === 1
                ? 'Authentication successful! Let\'s set up your profile'
                : isDriver
                  ? 'Complete your profile to start accepting rides'
                  : 'Complete your profile to start booking rides'}
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-12">
            <div className="flex items-center justify-center gap-4 max-w-2xl mx-auto">
              {/* Step 1: Authentication Complete */}
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold transition-all ${currentStep >= 1
                  ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/50'
                  : 'bg-slate-700 text-slate-400'
                  }`}>
                  {currentStep > 1 ? <CheckCircle2 className="w-6 h-6" /> : '1'}
                </div>
                <span className={`text-sm font-medium hidden sm:inline transition-colors ${currentStep >= 1 ? 'text-white' : 'text-slate-400'
                  }`}>
                  Authentication
                </span>
              </div>

              <div className={`w-16 h-1 rounded-full transition-colors ${currentStep >= 2 ? 'bg-gradient-to-r from-cyan-500 to-blue-600' : 'bg-slate-700'
                }`}></div>

              {/* Step 2: Personal Details */}
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold transition-all ${currentStep >= 2
                  ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/50'
                  : 'bg-slate-700 text-slate-400'
                  }`}>
                  {currentStep > 2 ? <CheckCircle2 className="w-6 h-6" /> : '2'}
                </div>
                <span className={`text-sm font-medium hidden sm:inline transition-colors ${currentStep >= 2 ? 'text-white' : 'text-slate-400'
                  }`}>
                  Personal Details
                </span>
              </div>

              <div className={`w-16 h-1 rounded-full transition-colors ${currentStep >= 3 ? 'bg-gradient-to-r from-cyan-500 to-blue-600' : 'bg-slate-700'
                }`}></div>

              {/* Step 3: Go! */}
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold transition-all ${currentStep >= 3
                  ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/50'
                  : 'bg-slate-700 text-slate-400'
                  }`}>
                  3
                </div>
                <span className={`text-sm font-medium hidden sm:inline transition-colors ${currentStep >= 3 ? 'text-white' : 'text-slate-400'
                  }`}>
                  Go!
                </span>
              </div>
            </div>
          </div>

          {/* Main Card */}
          {currentStep === 1 ? (
            /* Step 1: Authentication Complete */
            <Card className="bg-slate-900/80 backdrop-blur-xl border-slate-700/50 shadow-2xl">
              <CardContent className="p-12 text-center">
                <div className="mb-8">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 mb-6 shadow-2xl shadow-green-500/50">
                    <CheckCircle2 className="w-12 h-12 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-4">
                    Authentication Complete!
                  </h2>
                  <p className="text-lg text-slate-400 max-w-md mx-auto mb-8">
                    You've successfully signed in. Now let's set up your {isDriver ? 'driver' : 'passenger'} profile to get started.
                  </p>
                </div>

                <button
                  onClick={() => setCurrentStep(2)}
                  className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold shadow-lg shadow-cyan-500/50 transition-all duration-300 hover:scale-105"
                >
                  <span>Continue to Profile Setup</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </CardContent>
            </Card>
          ) : (
            /* Step 2 & 3: Profile Form */
            <Card className="bg-slate-900/80 backdrop-blur-xl border-slate-700/50 shadow-2xl">
              <CardContent className="p-8 md:p-12">
                {isDriver ? (
                  <form onSubmit={driverForm.handleSubmit(handleDriverSubmit)} className="space-y-8">
                    {/* Personal Information */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                          <User2 className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Personal Information</h2>
                      </div>

                      {/* Profile Image */}
                      <div className="space-y-3">
                        <Label className="text-slate-300 text-sm font-medium">Profile Picture</Label>
                        <div className="flex items-center gap-6">
                          <div className="relative group">
                            <div className="w-28 h-28 rounded-3xl bg-slate-800 border-2 border-slate-700 overflow-hidden shadow-xl">
                              {profilePreview ? (
                                <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <User2 className="w-12 h-12 text-slate-600" />
                                </div>
                              )}
                            </div>
                            <label htmlFor="profileImage" className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 rounded-3xl cursor-pointer transition-opacity">
                              <Camera className="w-8 h-8 text-white" />
                            </label>
                            <input
                              id="profileImage"
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageChange(e, 'profileImage')}
                              className="hidden"
                            />
                          </div>
                          <div className="flex-1">
                            <label htmlFor="profileImage" className="block">
                              <div className="px-6 py-4 bg-slate-800 border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-2xl cursor-pointer transition-all group">
                                <div className="flex items-center gap-3">
                                  <Upload className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                                  <div>
                                    <p className="text-sm font-medium text-slate-300">Upload your photo</p>
                                    <p className="text-xs text-slate-500 mt-1">Max 5MB • JPG, PNG</p>
                                  </div>
                                </div>
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Name */}
                      <div className="space-y-3">
                        <Label htmlFor="name" className="text-slate-300 text-sm font-medium">
                          Full Name <span className="text-red-400">*</span>
                        </Label>
                        <div className="relative">
                          <User2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                          <Input
                            id="name"
                            {...driverForm.register('name')}
                            placeholder="Enter your full name"
                            className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus:border-cyan-500 focus:ring-cyan-500/20"
                          />
                        </div>
                        {driverForm.formState.errors.name && (
                          <p className="text-sm text-red-400 flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-red-400"></span>
                            {driverForm.formState.errors.name.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Vehicle Information */}
                    <div className="space-y-6 pt-8 border-t border-slate-800">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <Bus className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Vehicle Information</h2>
                      </div>

                      {/* Vehicle Type */}
                      <div className="space-y-3">
                        <Label className="text-slate-300 text-sm font-medium">
                          Vehicle Type <span className="text-red-400">*</span>
                        </Label>
                        <Select
                          value={driverForm.watch('vehicleType')}
                          onValueChange={(value) =>
                            driverForm.setValue('vehicleType', value as VehicleTypeId)
                          }
                        >
                          <SelectTrigger className="h-14 bg-slate-800 border-slate-700 text-white rounded-xl focus:border-cyan-500 focus:ring-cyan-500/20">
                            <SelectValue placeholder="Select vehicle type" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            {VEHICLE_TYPES.map((type) => (
                              <SelectItem key={type.id} value={type.id} className="text-white hover:bg-slate-700">
                                <span className="flex items-center gap-2">
                                  <span className="text-2xl">{type.icon}</span>
                                  <span>{type.name}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Vehicle Image */}
                      <div className="space-y-3">
                        <Label className="text-slate-300 text-sm font-medium">Vehicle Photo</Label>
                        <div className="flex items-center gap-6">
                          <div className="relative group">
                            <div className="w-32 h-24 rounded-2xl bg-slate-800 border-2 border-slate-700 overflow-hidden shadow-xl">
                              {vehiclePreview ? (
                                <img src={vehiclePreview} alt="Vehicle" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Bus className="w-10 h-10 text-slate-600" />
                                </div>
                              )}
                            </div>
                            <label htmlFor="vehicleImage" className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 rounded-2xl cursor-pointer transition-opacity">
                              <Camera className="w-6 h-6 text-white" />
                            </label>
                            <input
                              id="vehicleImage"
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageChange(e, 'vehicleImage')}
                              className="hidden"
                            />
                          </div>
                          <div className="flex-1">
                            <label htmlFor="vehicleImage" className="block">
                              <div className="px-6 py-4 bg-slate-800 border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl cursor-pointer transition-all group">
                                <div className="flex items-center gap-3">
                                  <Upload className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors" />
                                  <div>
                                    <p className="text-sm font-medium text-slate-300">Upload vehicle photo</p>
                                    <p className="text-xs text-slate-500 mt-1">Clear photo of your vehicle</p>
                                  </div>
                                </div>
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Two Column Grid */}
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Vehicle Number */}
                        <div className="space-y-3">
                          <Label htmlFor="vehicleNumber" className="text-slate-300 text-sm font-medium">
                            Vehicle Number <span className="text-red-400">*</span>
                          </Label>
                          <div className="relative">
                            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <Input
                              id="vehicleNumber"
                              {...driverForm.register('vehicleNumber')}
                              placeholder="e.g., Lu 1 Pa 2345"
                              className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus:border-cyan-500 focus:ring-cyan-500/20"
                            />
                          </div>
                          {driverForm.formState.errors.vehicleNumber && (
                            <p className="text-sm text-red-400">
                              {driverForm.formState.errors.vehicleNumber.message}
                            </p>
                          )}
                        </div>

                        {/* License Number */}
                        <div className="space-y-3">
                          <Label htmlFor="licenseNumber" className="text-slate-300 text-sm font-medium">
                            License Number <span className="text-red-400">*</span>
                          </Label>
                          <div className="relative">
                            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <Input
                              id="licenseNumber"
                              {...driverForm.register('licenseNumber')}
                              placeholder="Your license number"
                              className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus:border-cyan-500 focus:ring-cyan-500/20"
                            />
                          </div>
                          {driverForm.formState.errors.licenseNumber && (
                            <p className="text-sm text-red-400">
                              {driverForm.formState.errors.licenseNumber.message}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Route */}
                      <div className="space-y-3">
                        <Label htmlFor="route" className="text-slate-300 text-sm font-medium">
                          Primary Route <span className="text-red-400">*</span>
                        </Label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                          <Input
                            id="route"
                            {...driverForm.register('route')}
                            placeholder="e.g., Butwal Main Route"
                            className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus:border-cyan-500 focus:ring-cyan-500/20"
                          />
                        </div>
                        {driverForm.formState.errors.route && (
                          <p className="text-sm text-red-400">
                            {driverForm.formState.errors.route.message}
                          </p>
                        )}
                      </div>

                      {/* Capacity */}
                      <div className="space-y-3">
                        <Label htmlFor="capacity" className="text-slate-300 text-sm font-medium">
                          Vehicle Capacity <span className="text-red-400">*</span>
                        </Label>
                        <div className="relative">
                          <User2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                          <Input
                            id="capacity"
                            type="number"
                            {...driverForm.register('capacity', { valueAsNumber: true })}
                            min={1}
                            max={100}
                            className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus:border-cyan-500 focus:ring-cyan-500/20"
                          />
                        </div>
                        {driverForm.formState.errors.capacity && (
                          <p className="text-sm text-red-400">
                            {driverForm.formState.errors.capacity.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-6">
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-16 text-lg font-bold rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-2xl shadow-cyan-500/50 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                            Creating Your Profile...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-6 h-6 mr-3" />
                            Complete Driver Profile
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={passengerForm.handleSubmit(handlePassengerSubmit)} className="space-y-8">
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                          <User2 className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Your Information</h2>
                      </div>

                      {/* Name */}
                      <div className="space-y-3">
                        <Label htmlFor="name" className="text-slate-300 text-sm font-medium">
                          Full Name <span className="text-red-400">*</span>
                        </Label>
                        <div className="relative">
                          <User2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                          <Input
                            id="name"
                            {...passengerForm.register('name')}
                            placeholder="Enter your full name"
                            className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus:border-cyan-500 focus:ring-cyan-500/20"
                          />
                        </div>
                        {passengerForm.formState.errors.name && (
                          <p className="text-sm text-red-400 flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-red-400"></span>
                            {passengerForm.formState.errors.name.message}
                          </p>
                        )}
                      </div>

                      {/* Email */}
                      <div className="space-y-3">
                        <Label htmlFor="email" className="text-slate-300 text-sm font-medium">
                          Email Address <span className="text-slate-500 text-xs">(Optional)</span>
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                          <Input
                            id="email"
                            type="email"
                            {...passengerForm.register('email')}
                            placeholder="your.email@example.com"
                            className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus:border-cyan-500 focus:ring-cyan-500/20"
                          />
                        </div>
                        {passengerForm.formState.errors.email && (
                          <p className="text-sm text-red-400">
                            {passengerForm.formState.errors.email.message}
                          </p>
                        )}
                      </div>

                      {/* Emergency Contact */}
                      <div className="space-y-3">
                        <Label htmlFor="emergencyContact" className="text-slate-300 text-sm font-medium">
                          Emergency Contact <span className="text-slate-500 text-xs">(Optional)</span>
                        </Label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                          <Input
                            id="emergencyContact"
                            {...passengerForm.register('emergencyContact')}
                            placeholder="+977 98XXXXXXXX"
                            className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus:border-cyan-500 focus:ring-cyan-500/20"
                          />
                        </div>
                        {passengerForm.formState.errors.emergencyContact && (
                          <p className="text-sm text-red-400">
                            {passengerForm.formState.errors.emergencyContact.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-16 text-lg font-bold rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-2xl shadow-cyan-500/50 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-6 h-6 mr-3" />
                          Complete Profile
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}