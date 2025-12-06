'use client';

import { useState, useEffect } from 'react';
import DriverPanel from '@/components/driver/DriverPanel';
import PassengerList from '@/components/driver/PassengerList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bus, Passenger } from '@/lib/types';
import MapWrapper from '@/components/map/MapWrapper';
import {
  Navigation,
  Users,
  MapPin,
  Settings,
  Bus as BusIcon
} from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { subscribeToBuses, subscribeToBookings, updateBusLocation } from '@/lib/firebaseDb';
import { addOfflinePassenger, removeOfflinePassenger } from '@/lib/seatManagement';
import { useToast } from '@/components/ui/use-toast';

export default function DriverDashboard() {
  const router = useRouter();
  const { currentUser, role, loading, signOut, userData } = useAuth();
  const { toast } = useToast();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hasGeolocationError, setHasGeolocationError] = useState(false);

  // Subscribe to buses from Realtime Database
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    unsubscribe = subscribeToBuses((busesData) => {
      setBuses(busesData);

      // Try to find the driver's specific bus
      const driverBus =
        busesData.find((b) => b.id === currentUser?.uid) ||
        (userData?.role === 'driver' && (userData as any).vehicleNumber
          ? busesData.find((b) => b.busNumber === (userData as any).vehicleNumber)
          : undefined);

      // Only update selectedBus if we found the driver's bus
      // This prevents showing "Rajesh Thapa" (demo data) to a new driver
      if (driverBus) {
        setSelectedBus(driverBus);
      } else if (!selectedBus && busesData.length > 0) {
        // If no bus selected yet and we can't find the driver's bus,
        // we might be in a state where the bus isn't created yet.
        // Do NOT default to busesData[0] for drivers.
        // Just leave selectedBus as null.
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [selectedBus, currentUser, userData]);

  // Subscribe to real passengers (bookings) for the selected bus
  useEffect(() => {
    if (!selectedBus) return;

    const unsubscribe = subscribeToBookings(selectedBus.id, 'driver', (bookings) => {
      const mapped: Passenger[] = bookings.map((b) => ({
        id: b.id,
        name: b.passengerName,
        pickupLocation: b.pickupLocation,
        dropoffLocation: b.dropoffLocation,
        status: 'waiting',
        bookingTime: b.timestamp,
      }));
      setPassengers(mapped);
    });

    return () => unsubscribe();
  }, [selectedBus]);

  // Get user's current location
  useEffect(() => {
    if (!locationEnabled) {
      return;
    }

    if (!navigator.geolocation) {
      if (!hasGeolocationError) {
        toast({
          title: 'Location unavailable',
          description: 'Geolocation is not supported by this browser.',
          variant: 'destructive',
        });
        setHasGeolocationError(true);
      }
      return;
    }

    const handleGeoError = (error: GeolocationPositionError | any) => {
      // Avoid spamming toasts; show a friendly message once
      if (!hasGeolocationError) {
        let message = 'Unable to access your location. Please check your browser permissions.';
        if (error?.code === 1) {
          message = 'Location permission was denied. Turn it on in your browser settings to share your live location.';
        }

        toast({
          title: 'Location error',
          description: message,
          variant: 'destructive',
        });
        setHasGeolocationError(true);
      }

      // Still log a concise warning for debugging
      // eslint-disable-next-line no-console
      console.warn('Geolocation error:', {
        code: error?.code,
        message: error?.message,
      });
    };

    if (locationEnabled) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(newLocation);

          // Update Firebase with driver's location if they have a selected bus
          if (selectedBus && isOnline) {
            updateBusLocation(selectedBus.id, {
              ...newLocation,
              timestamp: new Date()
            });
          }
        },
        handleGeoError,
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 10000
        }
      );


      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [locationEnabled, selectedBus, isOnline, toast, hasGeolocationError]);

  const handleLocationToggle = (enabled: boolean) => {
    setLocationEnabled(enabled);
    if (selectedBus) {
      setSelectedBus({
        ...selectedBus,
        isActive: enabled,
      });
    }
  };

  const handleAddOfflinePassenger = async () => {
    if (!selectedBus) return;
    try {
      await addOfflinePassenger(selectedBus.id);
    } catch (error) {
      console.error('Error adding offline passenger:', error);
      toast({
        title: 'Failed to add offline passenger',
        description:
          error instanceof Error ? error.message : 'Please try again or check your connection.',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveOfflinePassenger = async () => {
    if (!selectedBus) return;
    try {
      await removeOfflinePassenger(selectedBus.id);
    } catch (error) {
      console.error('Error removing offline passenger:', error);
    }
  };

  const handlePassengerPickup = (passengerId: string) => {
    setPassengers(prev =>
      prev.map(passenger =>
        passenger.id === passengerId
          ? { ...passenger, status: 'picked' }
          : passenger
      )
    );
  };

  const handlePassengerDropoff = (passengerId: string) => {
    setPassengers(prev =>
      prev.map(passenger =>
        passenger.id === passengerId
          ? { ...passenger, status: 'dropped' }
          : passenger
      )
    );
  };

  // Auth guard
  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        router.replace('/auth?redirect=/driver');
      } else if (role && role !== 'driver') {
        router.replace('/passenger');
      } else if (!userData || !(userData as any).vehicleNumber) {
        // Profile incomplete (missing vehicle details) or not loaded
        router.replace('/auth/profile');
      }
    }
  }, [currentUser, role, loading, router, userData]);

  if (loading || !currentUser || (role && role !== 'driver')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping"></div>
            <div className="relative bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl w-full h-full flex items-center justify-center shadow-2xl shadow-cyan-500/50">
              <BusIcon className="w-10 h-10 text-white animate-pulse" />
            </div>
          </div>
          <p className="text-slate-400 text-lg font-medium">Initializing Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* 1. Header (Sticky Top) */}
      <div className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 p-4">
        <div className="flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <BusIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-tight leading-none">
                Driver Console
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></span>
                <span className="text-[10px] text-slate-300 font-medium">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border transition-all ${locationEnabled
              ? 'bg-cyan-500/10 border-cyan-500/30'
              : 'bg-slate-900/50 border-slate-700/50'}`}>
              <Switch
                checked={locationEnabled}
                onCheckedChange={handleLocationToggle}
                className="scale-75 data-[state=checked]:bg-cyan-500"
              />
              <MapPin className={`w-3 h-3 ${locationEnabled ? 'text-cyan-400' : 'text-slate-400'}`} />
            </div>

            <Button
              variant="ghost"
              onClick={signOut}
              size="icon"
              className="w-9 h-9 rounded-full bg-slate-900/50 border border-slate-700/50 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <span className="sr-only">Sign Out</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Map Section (Priority View) */}
      <div className="relative w-full h-[60vh] shrink-0 border-b border-slate-800">
        <MapWrapper
          role="driver"
          buses={buses}
          passengers={passengers}
          selectedBus={selectedBus}
          onBusSelect={setSelectedBus}
          showRoute={true}
        />
      </div>

      {/* 3. Scrollable Content (Below Map) */}
      <div className="flex-1 bg-slate-950 p-4 space-y-6">
        {/* Bus Details & Controls */}
        {selectedBus && (
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-cyan-400" />
              Bus Controls
            </h2>
            <DriverPanel
              bus={selectedBus}
              onLocationToggle={handleLocationToggle}
              locationEnabled={locationEnabled}
              onAddOfflinePassenger={handleAddOfflinePassenger}
              onRemoveOfflinePassenger={handleRemoveOfflinePassenger}
            />
          </div>
        )}

        {/* Passenger List */}
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Passengers
            <Badge variant="secondary" className="ml-auto bg-slate-800 text-slate-300">
              {passengers.length}
            </Badge>
          </h2>
          <PassengerList
            passengers={passengers}
            selectedBus={selectedBus}
            onPassengerPickup={handlePassengerPickup}
            onPassengerDropoff={handlePassengerDropoff}
          />
        </div>

        {/* Bottom Padding */}
        <div className="h-8"></div>
      </div>
    </div>
  );
}
