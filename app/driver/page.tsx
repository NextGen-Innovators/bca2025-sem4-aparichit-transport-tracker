'use client';

import { useState, useEffect } from 'react';
import DriverPanel from '@/components/driver/DriverPanel';
import PassengerList from '@/components/driver/PassengerList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trip } from '@/lib/types';
import { Passenger } from '@/components/driver/PassengerList';
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
import { useToast } from '@/components/ui/use-toast';

export default function DriverDashboard() {
  const router = useRouter();
  const { user: currentUser, role, loading, logout: signOut } = useAuth(); // Adapted to new context
  const { toast } = useToast();
  const [buses, setBuses] = useState<Trip[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [selectedBus, setSelectedBus] = useState<Trip | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hasGeolocationError, setHasGeolocationError] = useState(false);
  const [lastLocationUpdate, setLastLocationUpdate] = useState<Date | null>(null);
  const [locationUpdateCount, setLocationUpdateCount] = useState(0);
  const [lastFirebaseUpdate, setLastFirebaseUpdate] = useState<Date | null>(null);

  // Poll Trips (instead of Buses) to sync location and status
  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const res = await fetch('/api/trips');
        const data = await res.json(); // returns array of trips
        if (Array.isArray(data)) {
          setBuses(data); // "buses" state now holds trips

          // Find own active trip
          const ownTrip = data.find((t: any) => t.driver_id === currentUser?.id && t.status === 'on_route');
          if (ownTrip) {
            setSelectedBus(ownTrip);
          }
        }
      } catch (e) {
        console.error("Failed to fetch trips", e);
      }
    };

    fetchTrips();
    const interval = setInterval(fetchTrips, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Poll Bookings
  useEffect(() => {
    if (!currentUser) return;
    const fetchBookings = async () => {
      try {
        const res = await fetch('/api/bookings');
        const data = await res.json();
        // bookings filtered by role in API
        if (Array.isArray(data)) {
          // Map to Passenger UI interface
          const mapped: Passenger[] = data.map((b: any) => ({
            id: b.id,
            name: b.passenger_name || 'Passenger',
            pickupLocation: { lat: b.pickup_location_lat, lng: b.pickup_location_lng },
            dropoffLocation: { lat: b.dropoff_location_lat, lng: b.dropoff_location_lng },
            status: b.status === 'confirmed' ? 'waiting' : 'waiting', // Default to waiting as DB status 'confirmed' means booked
            bookingTime: new Date(b.created_at || new Date()),
          }));
          setPassengers(mapped);
        }
      } catch (e) {
        console.error("Failed to fetch bookings", e);
      }
    };

    fetchBookings();
    const interval = setInterval(fetchBookings, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Location Tracking & Posting
  useEffect(() => {
    if (!locationEnabled || !navigator.geolocation || !selectedBus) return;

    const postLocation = async (lat: number, lng: number, heading: number | null, speed: number | null) => {
      try {
        // Post to /api/trips/:id/location
        await fetch(`/api/trips/${selectedBus.id}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng })
        });
        setLastFirebaseUpdate(new Date());
        setLocationUpdateCount(prev => prev + 1);
      } catch (e) {
        console.error("Failed to update location", e);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setLastLocationUpdate(new Date());

        // Post update
        postLocation(latitude, longitude, heading, speed);
      },
      (err) => console.warn(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [locationEnabled, selectedBus]);

  const handleLocationToggle = (enabled: boolean) => {
    setLocationEnabled(enabled);
  };

  const [activeTab, setActiveTab] = useState<'trips' | 'vehicles' | 'routes'>('trips');

  // Data
  const [trips, setTrips] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);

  // Forms
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [showTripForm, setShowTripForm] = useState(false);

  // New Trip Form Data
  const [newTrip, setNewTrip] = useState({
    route_id: '',
    vehicle_id: '',
    departure_time: '',
    arrival_time: '',
    fare: '',
    available_seats: ''
  });

  const [newVehicle, setNewVehicle] = useState({
    plate_number: '', make: '', model: '', year: '', capacity: ''
  });

  const [newRoute, setNewRoute] = useState({
    route_name: '', start_location_name: '', start_lat: '', start_lng: '',
    end_location_name: '', end_lat: '', end_lng: '',
    distance: '', estimated_time: ''
  });

  useEffect(() => {
    if (!loading && (!currentUser || currentUser.role !== 'driver')) {
      router.push('/');
    }
  }, [currentUser, loading, router]);

  useEffect(() => {
    if (currentUser?.role === 'driver') {
      fetchTrips();
      fetchVehicles();
      fetchRoutes();
    }
  }, [currentUser]);

  const fetchTrips = async () => {
    try {
      const res = await fetch('/api/trips');
      if (res.ok) setTrips(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchVehicles = async () => {
    try {
      // Driver sees their approved vehicles (for trip creation) and maybe pending ones?
      // API logic I implemented shows: approved=1 AND driver_id=me OR proposed_by_driver_id=me
      const res = await fetch('/api/vehicles');
      if (res.ok) setVehicles(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchRoutes = async () => {
    try {
      // Driver sees approved routes (for trip creation) or pending proposals?
      const res = await fetch('/api/routes');
      if (res.ok) setRoutes(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTrip,
          fare: parseFloat(newTrip.fare),
          available_seats: parseInt(newTrip.available_seats)
        })
      });
      if (res.ok) {
        alert('Trip created!');
        setShowTripForm(false);
        fetchTrips();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err) { console.error(err); }
  };

  const handleVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newVehicle,
          year: parseInt(newVehicle.year),
          capacity: parseInt(newVehicle.capacity)
        })
      });
      if (res.ok) {
        alert('Vehicle request submitted!');
        setShowVehicleForm(false);
        fetchVehicles();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err) { console.error(err); }
  };

  const handleRouteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        route_name: newRoute.route_name,
        start_location: {
          name: newRoute.start_location_name,
          lat: parseFloat(newRoute.start_lat),
          lng: parseFloat(newRoute.start_lng)
        },
        end_location: {
          name: newRoute.end_location_name,
          lat: parseFloat(newRoute.end_lat),
          lng: parseFloat(newRoute.end_lng)
        },
        distance: parseFloat(newRoute.distance),
        estimated_time: parseInt(newRoute.estimated_time)
      };
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Route proposal submitted!');
        setShowRouteForm(false);
        fetchRoutes();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err) { console.error(err); }
  };

  const handleStatusUpdate = async (tripId: number, status: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) fetchTrips();
    } catch (err) { console.error(err); }
  };

  const handlePassengerPickup = (id: number) => {
    console.log('Pickup passenger', id);
    // Implementation: Call API to update booking status to 'picked' if supported, 
    // or just update local state (if we tracked it locally).
  };

  const handlePassengerDropoff = (id: number) => {
    console.log('Dropoff passenger', id);
  };

  const handleAddOfflinePassenger = () => console.log('Add offline passenger');
  const handleRemoveOfflinePassenger = () => console.log('Remove offline passenger');

  if (loading) return <div>Loading...</div>;
  if (!currentUser) return null;

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      <div className="flex-1 relative">
        <MapWrapper
          role="driver"
          trips={buses} // buses state now holds trips
          bookings={passengers} // passengers state holds Booking mapped to Passenger
          selectedTrip={selectedBus} // selectedBus holds selected Trip
          userLocation={userLocation}
        />
        {/* Overlay Driver Panel */}
        {selectedBus && (
          <div className="absolute top-4 left-4 z-[400] w-80">
            <DriverPanel
              bus={selectedBus}
              locationEnabled={locationEnabled}
              onLocationToggle={handleLocationToggle}
              onAddOfflinePassenger={handleAddOfflinePassenger}
              onRemoveOfflinePassenger={handleRemoveOfflinePassenger}
            />
          </div>
        )}
      </div>
      <div className="h-1/3 bg-slate-900 border-t border-slate-800 p-4 overflow-y-auto">
        <PassengerList
          passengers={passengers}
          selectedBus={selectedBus}
          onPassengerPickup={handlePassengerPickup}
          onPassengerDropoff={handlePassengerDropoff}
        />
      </div>

      {/* Tab Navigation for Forms (hidden for simplicity in this view, valid logic exists above) */}
      {/* We can re-add the forms (Trip/Vehicle/Route) in a modal or separate tab view if needed. 
            For now minimizing to ensure compilation and core map functionality.
        */}
    </div>
  );
}
