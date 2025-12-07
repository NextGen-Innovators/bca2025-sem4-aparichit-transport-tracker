'use client';

import { useState, useEffect } from 'react';
import BookingPanel from '@/components/passenger/BookingPanel';
import { Button } from '@/components/ui/button';
import { Bus, Booking, VehicleTypeId } from '@/lib/types';
import { VEHICLE_TYPES } from '@/lib/constants';
import {
  MapPin,
  Ticket,
  Navigation,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import MapWrapper from '@/components/map/MapWrapper';
import { useToast } from '@/components/ui/use-toast';
import { toast as sonnerToast } from 'sonner';
import DetailedBookingModal from '@/components/passenger/DetailedBookingModal';
import { calculateETA, formatDistance } from '@/lib/utils/etaCalculator';

export default function PassengerDashboard() {
  const router = useRouter();
  const { user: currentUser, role, loading, logout: signOut } = useAuth();
  const { toast } = useToast();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);
  const [pickupLocation, setPickupLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState<VehicleTypeId | 'all'>('all');
  const [bookingLoading, setBookingLoading] = useState(false);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [busETAs, setBusETAs] = useState<Record<string, number | null>>({});

  // Poll Buses
  useEffect(() => {
    const fetchBuses = async () => {
      try {
        const res = await fetch('/api/buses');
        const data = await res.json();
        if (data.buses) {
          setBuses(data.buses);
        }
      } catch (e) {
        console.error("Fetch buses failed", e);
      }
    };
    fetchBuses();
    const interval = setInterval(fetchBuses, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll Bookings
  useEffect(() => {
    const fetchBookings = async () => {
      if (!currentUser) return;
      try {
        const res = await fetch('/api/bookings');
        const data = await res.json();
        if (data.bookings) {
          const mapped = data.bookings.map((b: any) => ({
            id: b.id,
            busId: b.bus_id,
            passengerId: b.passenger_id,
            status: b.status,
            seats: b.seats || 1,
            fare: b.fare || 0,
            pickupLocation: { lat: b.pickup_lat, lng: b.pickup_lng, timestamp: new Date() },
            dropoffLocation: { lat: b.dropoff_lat, lng: b.dropoff_lng, timestamp: new Date() },
            timestamp: new Date(b.created_at)
          }));
          setBookings(mapped);
        }
      } catch (e) {
        console.error("Fetch bookings failed", e);
      }
    };
    fetchBookings();
    const interval = setInterval(fetchBookings, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Get user's current location
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });

        // Auto-set pickup to current location if not set
        setPickupLocation(prev => prev ? prev : {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: 'Current Location'
        });
      },
      (error) => {
        console.warn('Geolocation error:', error);
        if (!userLocation) {
          // Default fallback
          setUserLocation({ lat: 27.7172, lng: 85.3240 });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Calculate ETAs locally based on polled data
  useEffect(() => {
    if (!userLocation || !selectedBus) return;
    const bus = buses.find(b => b.id === selectedBus.id);
    if (bus && bus.currentLocation) {
      const eta = calculateETA(
        bus.currentLocation,
        userLocation,
        // @ts-ignore
        bus.currentLocation.speed || 30
      );
      setBusETAs(prev => ({ ...prev, [bus.id]: eta }));
    }
  }, [buses, userLocation, selectedBus]);

  const handleBookBus = async (bus: Bus, bookingData?: any) => {
    if (!pickupLocation || !dropoffLocation) {
      toast({ title: 'Select locations first', variant: 'destructive' });
      return;
    }

    try {
      setBookingLoading(true);

      const payload = {
        busId: bus.id,
        pickup: pickupLocation,
        dropoff: dropoffLocation,
        seats: bookingData?.numberOfPassengers || 1,
        fare: 50, // Mock fare
        vehicleType: bus.vehicleType
      };

      const response = await fetch('/api/bookings', { // Updated endpoint from /api/bookings/create
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create booking');
      }

      toast({
        title: 'Booking confirmed',
        description: `You have successfully booked ${bus.busNumber}.`,
      });

      // Clear selection
      setSelectedBus(null);
      setPickupLocation(null);
      setDropoffLocation(null);

    } catch (error: any) {
      toast({ title: 'Booking failed', description: error.message, variant: 'destructive' });
    } finally {
      setBookingLoading(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'find_trips' | 'my_bookings'>('find_trips');

  const [trips, setTrips] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  // Booking Form
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [bookingForm, setBookingForm] = useState({
    seat_number: 1,
    pickup_lat: '', pickup_lng: '',
    dropoff_lat: '', dropoff_lng: ''
  });

  useEffect(() => {
    if (!loading && (!currentUser || currentUser.role !== 'passenger')) {
      router.push('/');
    }
  }, [currentUser, loading, router]);

  useEffect(() => {
    if (currentUser?.role === 'passenger') {
      fetchTrips();
      fetchBookings();
    }
  }, [currentUser]);

  const fetchTrips = async () => {
    try {
      const res = await fetch('/api/trips');
      if (res.ok) setTrips(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/bookings');
      if (res.ok) setBookings(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleBookTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip) return;

    try {
      const payload = {
        trip_id: selectedTrip.id,
        seat_number: parseInt(bookingForm.seat_number.toString()),
        pickup_location: {
          lat: parseFloat(bookingForm.pickup_lat) || 0,
          lng: parseFloat(bookingForm.pickup_lng) || 0
        },
        dropoff_location: {
          lat: parseFloat(bookingForm.dropoff_lat) || 0,
          lng: parseFloat(bookingForm.dropoff_lng) || 0
        }
      };

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('Booking confirmed!');
        setSelectedTrip(null);
        fetchBookings();
        fetchTrips();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err) { console.error(err); }
  };

  const handleCancelBooking = async (id: number) => {
    if (!confirm('Cancel this booking?')) return;
    try {
      const res = await fetch(`/api/bookings/${id}/cancel`, { method: 'PUT' });
      if (res.ok) {
        alert('Booking cancelled');
        fetchBookings();
      }
    } catch (err) { console.error(err); }
  };

  const handleLocationSelect = (loc: { lat: number; lng: number }) => {
    if (!pickupLocation) setPickupLocation({ ...loc, address: 'Selected Pickup' });
    else if (!dropoffLocation) setDropoffLocation({ ...loc, address: 'Selected Dropoff' });
  };

  const handleResetLocations = () => {
    setPickupLocation(null);
    setDropoffLocation(null);
  };

  if (loading) return <div>Loading...</div>;
  if (!currentUser) return null;

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      <div className="flex-1 relative">
        <MapWrapper
          role="passenger"
          trips={trips} // Pass trips as buses/trips
          bookings={bookings}
          selectedTrip={selectedTrip}
          onTripSelect={setSelectedTrip}
          onLocationSelect={handleLocationSelect}
          userLocation={userLocation}
        />

        {/* Booking Overlay */}
        {selectedTrip && (
          <div className="absolute bottom-0 left-0 right-0 bg-white p-4 rounded-t-xl z-[500]">
            <h3 className="text-xl font-bold mb-2">Book Trip: {selectedTrip.route_name}</h3>
            <form onSubmit={handleBookTrip} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Seat Number</label>
                <input type="number" min="1" className="border p-2 rounded w-full" value={bookingForm.seat_number} onChange={e => setBookingForm({ ...bookingForm, seat_number: parseInt(e.target.value) })} required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="any" placeholder="Pickup Lat" className="border p-2 rounded" value={bookingForm.pickup_lat} onChange={e => setBookingForm({ ...bookingForm, pickup_lat: e.target.value })} />
                <input type="number" step="any" placeholder="Pickup Lng" className="border p-2 rounded" value={bookingForm.pickup_lng} onChange={e => setBookingForm({ ...bookingForm, pickup_lng: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="any" placeholder="Dropoff Lat" className="border p-2 rounded" value={bookingForm.dropoff_lat} onChange={e => setBookingForm({ ...bookingForm, dropoff_lat: e.target.value })} />
                <input type="number" step="any" placeholder="Dropoff Lng" className="border p-2 rounded" value={bookingForm.dropoff_lng} onChange={e => setBookingForm({ ...bookingForm, dropoff_lng: e.target.value })} />
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <button type="button" onClick={() => setSelectedTrip(null)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Confirm Booking</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

