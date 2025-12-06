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
  Settings
} from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { subscribeToBuses, subscribeToBookings, updateBusLocation } from '@/lib/firebaseDb';
import { addOfflinePassenger, removeOfflinePassenger } from '@/lib/seatManagement';
import { toast } from 'sonner';

export default function DriverDashboard() {
  const router = useRouter();
  const { currentUser, role, loading, signOut, userData } = useAuth();
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
        (userData?.vehicleNumber
          ? busesData.find((b) => b.busNumber === userData.vehicleNumber)
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
        toast('Location unavailable', {
          description: 'Geolocation is not supported by this browser.',
        })
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

        toast('Location error', {
          description: message,
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
              timestamp: new Date(),
            });
          }
        },
        handleGeoError,
        { enableHighAccuracy: true, maximumAge: 5000 }
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
      toast("Failed to add offline passenger", {
        description:
          error instanceof Error ? error.message : 'Please try again or check your connection.',
      })
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
      } else if (!userData || !userData.vehicleNumber) {
        // Profile incomplete (missing vehicle details) or not loaded
        router.replace('/auth/profile');
      }
    }
  }, [currentUser, role, loading, router, userData]);

  if (loading || !currentUser || (role && role !== 'driver')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600 text-sm">Loading driver dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Bus Driver Dashboard</h1>
              <p className="text-gray-600">Real-time passenger tracking and management</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Badge variant={isOnline ? 'default' : 'secondary'}>
                  {isOnline ? 'Online' : 'Offline'}
                </Badge>
                <Switch
                  checked={isOnline}
                  onCheckedChange={setIsOnline}
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={locationEnabled ? 'default' : 'secondary'}>
                  <MapPin className="w-3 h-3 mr-1" />
                  {locationEnabled ? 'Sharing' : 'Hidden'}
                </Badge>
                <Switch
                  checked={locationEnabled}
                  onCheckedChange={handleLocationToggle}
                />
              </div>
              {process.env.NODE_ENV === 'development' && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/seed', { method: 'POST' });
                        const data = await res.json();
                        alert(data.message || 'Seeded demo data');
                      } catch (e) {
                        console.error(e);
                        alert('Failed to seed demo data');
                      }
                    }}
                  >
                    Seed Demo Data
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/seed', { method: 'DELETE' });
                        const data = await res.json();
                        alert(data.message || 'Cleared demo data');
                      } catch (e) {
                        console.error(e);
                        alert('Failed to clear demo data');
                      }
                    }}
                  >
                    Clear Demo
                  </Button>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Passengers</p>
                  <h3 className="text-2xl font-bold">{passengers.length}</h3>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Buses</p>
                  <h3 className="text-2xl font-bold">
                    {buses.filter(b => b.isActive).length}
                  </h3>
                </div>
                <Navigation className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Available Seats</p>
                  <h3 className="text-2xl font-bold">
                    {buses.reduce((acc, bus) => acc + (bus.availableSeats || 0), 0)}
                  </h3>
                </div>
                <Users className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Your Bus</p>
                  <h3 className="text-lg font-bold">{selectedBus?.busNumber || 'N/A'}</h3>
                </div>
                <Settings className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Section */}
          <div className="lg:col-span-2">
            <Card className="h-[600px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="w-5 h-5" />
                  Live Bus Tracking Map
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-[calc(600px-80px)]">
                <MapWrapper
                  role="driver"
                  buses={buses}
                  passengers={passengers}
                  selectedBus={selectedBus}
                  onBusSelect={setSelectedBus}
                  showRoute={true}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Panel */}
          <div className="space-y-6">
            {selectedBus && (
              <DriverPanel
                bus={selectedBus}
                onLocationToggle={handleLocationToggle}
                locationEnabled={locationEnabled}
                onAddOfflinePassenger={handleAddOfflinePassenger}
                onRemoveOfflinePassenger={handleRemoveOfflinePassenger}
              />
            )}

            <PassengerList
              passengers={passengers}
              selectedBus={selectedBus}
              onPassengerPickup={handlePassengerPickup}
              onPassengerDropoff={handlePassengerDropoff}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
