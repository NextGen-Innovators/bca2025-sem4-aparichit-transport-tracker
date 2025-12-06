/* /app/passenger/page.tsx  */
'use client';

import { useState, useEffect } from 'react';
import BookingPanel from '@/components/passenger/BookingPanel';
import SeatVisualizer from '@/components/passenger/SeatVisualizer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bus, Booking, VehicleTypeId } from '@/lib/types';
import { VEHICLE_TYPES } from '@/lib/constants';
import {
  MapPin,
  Ticket,
  Navigation,
  User,
  Smartphone,
  Clock
} from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import MapWrapper from '@/components/map/MapWrapper';
import { subscribeToBuses, subscribeToBookings, updateBusLocation } from '@/lib/firebaseDb';
import { canAccommodateBooking } from '@/lib/seatManagement';
import { toast } from 'sonner';
import { checkProximity, haversineDistance, ProximityLevel } from '@/lib/utils/geofencing';
import { toast as sonnerToast } from 'sonner';
import { NotificationToast } from '@/components/shared/NotificationToast';

export default function PassengerDashboard() {
  const router = useRouter();
  const { currentUser, role, loading, signOut } = useAuth();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);
  const [pickupLocation, setPickupLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState<VehicleTypeId | 'all'>('all');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [pickupProximityLevel, setPickupProximityLevel] = useState<ProximityLevel | null>(null);
  const [lastNotificationByBooking, setLastNotificationByBooking] = useState<
    Record<string, ProximityLevel | null>
  >({});
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('notificationsEnabled');
    return stored ? stored === 'true' : true;
  });
  const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('vibrationEnabled');
    return stored ? stored === 'true' : true;
  });
  const [hasRequestedNotificationPermission, setHasRequestedNotificationPermission] =
    useState(false);

  // Subscribe to real-time bus updates
  useEffect(() => {
    const unsubscribe = subscribeToBuses((busesData) => {
      setBuses(busesData);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to this passenger's bookings in real-time
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = subscribeToBookings(currentUser.uid, 'passenger', (list) => {
      const mapped = list.map((b) => ({
        ...b,
        timestamp: new Date(b.timestamp),
        pickupLocation: {
          ...b.pickupLocation,
          timestamp: new Date(b.pickupLocation.timestamp),
        },
        dropoffLocation: {
          ...b.dropoffLocation,
          timestamp: new Date(b.dropoffLocation.timestamp),
        },
        reservationExpiresAt: b.reservationExpiresAt
          ? new Date(b.reservationExpiresAt)
          : undefined,
      })) as Booking[];

      setBookings(mapped);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Request browser notification permission once when notifications are enabled
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!notificationsEnabled) return;
    if (hasRequestedNotificationPermission) return;
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission().finally(() => {
        setHasRequestedNotificationPermission(true);
      });
    } else {
      setHasRequestedNotificationPermission(true);
    }
  }, [notificationsEnabled, hasRequestedNotificationPermission]);

  // Persist notification settings
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('notificationsEnabled', String(notificationsEnabled));
  }, [notificationsEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('vibrationEnabled', String(vibrationEnabled));
  }, [vibrationEnabled]);

  // Proximity detection every 10 seconds for active bookings
  useEffect(() => {
    if (!notificationsEnabled) return;
    if (bookings.length === 0) return;

    const intervalId = window.setInterval(() => {
      // Focus on bookings that are pending or confirmed
      const activeBookings = bookings.filter((b) =>
        ['pending', 'confirmed'].includes(b.status)
      );
      if (activeBookings.length === 0) return;

      let highestLevel: ProximityLevel | null = null;

      activeBookings.forEach((booking) => {
        const bus = buses.find((b) => b.id === booking.busId && b.isActive);
        if (!bus || !booking.pickupLocation) return;

        const level = checkProximity(
          bus.currentLocation,
          booking.pickupLocation
        );
        if (!level) return;

        const distanceMeters = haversineDistance(
          bus.currentLocation.lat,
          bus.currentLocation.lng,
          booking.pickupLocation.lat,
          booking.pickupLocation.lng
        );

        // Track highest proximity level for map highlighting
        const levelPriority: Record<ProximityLevel, number> = {
          far: 0,
          approaching: 1,
          nearby: 2,
          arrived: 3,
        };

        if (!highestLevel || levelPriority[level] > levelPriority[highestLevel]) {
          highestLevel = level;
        }

        const lastLevel = lastNotificationByBooking[booking.id] ?? null;
        if (lastLevel === level) {
          return; // avoid duplicate notifications for same level
        }

        // Prepare vibration pattern (guarded)
        const vibrate = (pattern: number | number[]) => {
          if (!vibrationEnabled) return;
          if (typeof window === 'undefined') return;
          if (!('vibrate' in window.navigator)) return;
          try {
            window.navigator.vibrate(pattern);
          } catch {
            // ignore vibration errors
          }
        };

        // Show proximity notification using sonner
        if (level === 'approaching') {
          sonnerToast.custom(
            (id) => (
              <NotificationToast
                title="Bus approaching your area 🚌"
                message="Your bus is getting closer to your pickup point."
                distanceMeters={distanceMeters}
                onViewMap={() => {
                  setSelectedBus(bus);
                  sonnerToast.dismiss(id);
                }}
              />
            ),
            { duration: 5000 }
          );
        } else if (level === 'nearby') {
          vibrate(200);
          sonnerToast.custom(
            (id) => (
              <NotificationToast
                title="Bus is nearby! 🔔"
                message="Get ready to board, your bus is very close."
                distanceMeters={distanceMeters}
                onViewMap={() => {
                  setSelectedBus(bus);
                  sonnerToast.dismiss(id);
                }}
              />
            ),
            { duration: 5000 }
          );
        } else if (level === 'arrived') {
          vibrate([200, 100, 200, 100, 200]);
          sonnerToast.custom(
            (id) => (
              <NotificationToast
                title="Bus arriving NOW! 🎉"
                message="Your bus has reached your pickup location."
                distanceMeters={distanceMeters}
                onViewMap={() => {
                  setSelectedBus(bus);
                  sonnerToast.dismiss(id);
                }}
              />
            ),
            { duration: 5000 }
          );
        }

        setLastNotificationByBooking((prev) => ({
          ...prev,
          [booking.id]: level,
        }));
      });

      setPickupProximityLevel(highestLevel);
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    bookings,
    buses,
    notificationsEnabled,
    vibrationEnabled,
    lastNotificationByBooking,
  ]);

  const handleBookBus = async (bus: Bus, bookingData?: any) => {
    if (!pickupLocation || !dropoffLocation) {
      toast('Select locations first', {
        description: 'Please select pickup and dropoff locations on the map.',
      });
      return;
    }

    // Check if bus can accommodate the booking
    const numberOfPassengers = bookingData?.numberOfPassengers || 1;
    if (!canAccommodateBooking(bus, numberOfPassengers)) {
      toast('Not enough seats available', {
        description: `This bus only has ${bus.availableSeats} seats available. You requested ${numberOfPassengers}.`,
      });
      return;
    }

    try {
      setBookingLoading(true);

      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingData: {
            busId: bus.id,
            passengerName: bookingData?.passengerName || 'Passenger',
            phoneNumber: bookingData?.phoneNumber || 'N/A',
            email: bookingData?.email || '',
            pickupLocation: {
              ...pickupLocation,
              address: pickupLocation.address || 'Pickup Location',
            },
            dropoffLocation: {
              ...dropoffLocation,
              address: dropoffLocation.address || 'Dropoff Location',
            },
            numberOfPassengers,
            notes: bookingData?.notes || '',
            paymentMethod: bookingData?.paymentMethod || 'cash',
            vehicleType: bus.vehicleType,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create booking');
      }

      const created = data.booking as Booking;

      const bookingWithDate: Booking = {
        ...created,
        timestamp: new Date(created.timestamp),
        pickupLocation: {
          ...created.pickupLocation,
          timestamp: new Date(created.pickupLocation.timestamp),
        },
        dropoffLocation: {
          ...created.dropoffLocation,
          timestamp: new Date(created.dropoffLocation.timestamp),
        },
        reservationExpiresAt: created.reservationExpiresAt
          ? new Date(created.reservationExpiresAt)
          : undefined,
      } as Booking;

      setBookings((prev) => [...prev, bookingWithDate]);
      setSelectedBus(null);
      setPickupLocation(null);
      setDropoffLocation(null);

      toast('Booking confirmed', {
        description: `You have successfully booked ${bus.busNumber}.`,
      });
    } catch (error) {
      console.error('Booking error:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to create booking. Please try again.';
      toast('Booking failed', {
        description: message,
      });
    } finally {
      setBookingLoading(false);
    }
  };

  const handleLocationSelect = (location: { lat: number; lng: number }) => {
    // Simple address generation for demo
    const address = `Location (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`;

    if (!pickupLocation) {
      setPickupLocation({ ...location, address });
    } else if (!dropoffLocation) {
      setDropoffLocation({ ...location, address });
    } else {
      setPickupLocation({ ...location, address });
      setDropoffLocation(null);
    }
  };

  const handleResetLocations = () => {
    setPickupLocation(null);
    setDropoffLocation(null);
  };

  const filteredBuses = buses.filter((bus) =>
    vehicleFilter === 'all' ? bus.isActive : (bus.isActive && bus.vehicleType === vehicleFilter)
  );

  // Auth guard
  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        router.replace('/auth?redirect=/passenger');
      } else if (role && role !== 'passenger') {
        router.replace('/driver');
      }
    }
  }, [currentUser, role, loading, router]);

  if (loading || !currentUser || (role && role !== 'passenger')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <p className="text-gray-600 text-sm">Loading passenger dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Passenger Bus Tracker</h1>
              <p className="text-gray-600">Book buses in real-time and track their routes</p>
            </div>
            <div className="flex flex-col items-stretch md:items-end gap-3">
              <div className="flex items-center gap-4">
                {process.env.NODE_ENV === 'development' && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
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
                      size="sm"
                      variant="outline"
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

              {/* Notification settings */}
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span className="font-medium">Notifications:</span>
                <Button
                  variant={notificationsEnabled ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-3"
                  onClick={() => setNotificationsEnabled((v) => !v)}
                >
                  {notificationsEnabled ? 'Enabled' : 'Disabled'}
                </Button>
                <Button
                  variant={vibrationEnabled ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-3"
                  onClick={() => setVibrationEnabled((v) => !v)}
                >
                  Vibration
                </Button>
                {process.env.NODE_ENV === 'development' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-3"
                    onClick={async () => {
                      // Simple simulation: move selected bus closer to pickup in 5 steps
                      if (!selectedBus || !pickupLocation) return;
                      const steps = 5;
                      const start = selectedBus.currentLocation;
                      const end = pickupLocation;
                      for (let i = 1; i <= steps; i++) {
                        const factor = i / steps;
                        const lat = start.lat + (end.lat - start.lat) * factor;
                        const lng = start.lng + (end.lng - start.lng) * factor;
                        await updateBusLocation(selectedBus.id, {
                          lat,
                          lng,
                          timestamp: new Date(),
                        });
                        await new Promise((resolve) => setTimeout(resolve, 2000));
                      }
                    }}
                  >
                    Simulate Bus Approach
                  </Button>
                )}
              </div>

              {/* Vehicle type filter */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={vehicleFilter === 'all' ? 'default' : 'outline'}
                  className="h-7 px-3 text-xs"
                  onClick={() => setVehicleFilter('all')}
                >
                  All ({buses.filter(b => b.isActive).length})
                </Button>
                {VEHICLE_TYPES.map(type => (
                  <Button
                    key={type.id}
                    size="sm"
                    variant={vehicleFilter === type.id ? 'default' : 'outline'}
                    className="h-7 px-3 text-xs flex items-center gap-1"
                    onClick={() => setVehicleFilter(type.id)}
                  >
                    <span>{type.icon}</span>
                    <span>{type.name}</span>
                    <span className="opacity-70">
                      ({buses.filter(b => b.isActive && b.vehicleType === type.id).length})
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel */}
          <div className="space-y-6">
            <BookingPanel
              pickupLocation={pickupLocation}
              dropoffLocation={dropoffLocation}
              selectedBus={selectedBus}
              onBook={handleBookBus}
              onReset={handleResetLocations}
              loading={bookingLoading}
            />

            {/* Seat Visualizer */}
            {selectedBus && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Seat Availability</CardTitle>
                </CardHeader>
                <CardContent>
                  <SeatVisualizer bus={selectedBus} />
                </CardContent>
              </Card>
            )}

            {/* Bookings */}
            {bookings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="w-5 h-5" />
                    Your Bookings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {bookings.map(booking => {
                      const bus = buses.find(b => b.id === booking.busId);
                      const distanceToPickup = bus && booking.pickupLocation ? haversineDistance(
                        bus.currentLocation.lat,
                        bus.currentLocation.lng,
                        booking.pickupLocation.lat,
                        booking.pickupLocation.lng
                      ) : null;

                      return (
                        <div
                          key={booking.id}
                          className="p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Booking #{booking.id?.slice(-6)}</p>
                              <p className="text-sm text-gray-600">
                                Bus: {bus?.busNumber || 'N/A'}
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(booking.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="default">Confirmed</Badge>
                              <span className="text-sm font-medium">रु {booking.fare}</span>
                            </div>
                          </div>

                          {/* Distance to pickup */}
                          {distanceToPickup !== null && (booking.status === 'confirmed' || booking.status === 'pending') && (
                            <div className={`mt-2 flex items-center gap-2 p-2 rounded ${distanceToPickup < 100
                              ? 'bg-green-100'
                              : distanceToPickup < 500
                                ? 'bg-yellow-100'
                                : 'bg-blue-100'
                              }`}>
                              <Navigation className={`w-4 h-4 ${distanceToPickup < 100
                                ? 'text-green-600'
                                : distanceToPickup < 500
                                  ? 'text-yellow-600'
                                  : 'text-blue-600'
                                }`} />
                              <span className={`text-xs font-semibold ${distanceToPickup < 100
                                ? 'text-green-700'
                                : distanceToPickup < 500
                                  ? 'text-yellow-700'
                                  : 'text-blue-700'
                                }`}>
                                🚌 {distanceToPickup < 1000
                                  ? `${Math.round(distanceToPickup)} m away`
                                  : `${(distanceToPickup / 1000).toFixed(1)} km away`}
                                {distanceToPickup < 100 && ' - Arriving now!'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Map Section */}
          <div className="lg:col-span-2">
            <Card className="h-[700px]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Navigation className="w-5 h-5" />
                    Available Buses
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-sm">
                      {buses.filter(b => b.isActive).length} Buses Active
                    </Badge>
                    {(pickupLocation || dropoffLocation) && (
                      <Badge variant="secondary" className="text-sm">
                        <MapPin className="w-3 h-3 mr-1" />
                        {(pickupLocation ? 1 : 0) + (dropoffLocation ? 1 : 0)}/2 Locations
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 h-[calc(700px-80px)]">
                <MapWrapper
                  role="passenger"
                  buses={filteredBuses}
                  selectedBus={selectedBus}
                  onBusSelect={setSelectedBus}
                  onLocationSelect={handleLocationSelect}
                  showRoute={!!selectedBus}
                  pickupLocation={pickupLocation}
                  dropoffLocation={dropoffLocation}
                  pickupProximityLevel={pickupProximityLevel}
                />
              </CardContent>
            </Card>

            {/* Instructions */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Select Locations</h4>
                      <p className="text-sm text-gray-600">Click map for pickup & dropoff</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Click Bus Icons</h4>
                      <p className="text-sm text-gray-600">Select bus to view seats</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Real-time Tracking</h4>
                      <p className="text-sm text-gray-600">Live bus locations</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
