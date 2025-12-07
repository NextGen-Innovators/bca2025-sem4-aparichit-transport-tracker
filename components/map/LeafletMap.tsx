'use client';

import React, { Component, ReactNode, useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Trip, Booking } from '@/lib/types'; // Updated imports

// Fix for default Leaflet marker icons
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

interface LeafletMapProps {
    role: 'driver' | 'passenger' | 'admin';
    trips: Trip[];
    bookings?: Booking[];
    selectedTrip?: Trip | null;
    onTripSelect?: (trip: Trip) => void;
    onLocationSelect?: (location: { lat: number; lng: number }) => void;
    userLocation?: { lat: number; lng: number } | null;
    // ... other props if needed
}

function MapUpdater({ center, selectedTripId }: { center: { lat: number; lng: number }, selectedTripId?: number }) {
    const map = useMap();
    const [lastTripId, setLastTripId] = useState<number | undefined>(undefined);

    useEffect(() => {
        if (selectedTripId && selectedTripId !== lastTripId) {
            map.flyTo([center.lat, center.lng], 16);
            setLastTripId(selectedTripId);
        }
    }, [center, selectedTripId, lastTripId, map]);

    return null;
}

const createBusIcon = (isActive: boolean = true) => {
    return L.divIcon({
        className: 'custom-bus-icon cursor-pointer',
        html: `<div style="
      background-color: ${isActive ? '#3b82f6' : '#9ca3af'};
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      pointer-events: auto;
    ">🚌</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20],
    });
};

const createLocationIcon = (color: string) => {
    return L.divIcon({
        className: 'custom-location-icon',
        html: `<div style="
      background-color: ${color};
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
    });
};

function MapEvents({ onLocationSelect, role }: { onLocationSelect?: (loc: { lat: number; lng: number }) => void; role: string; }) {
    useMapEvents({
        click(e) {
            if (onLocationSelect && role === 'passenger') {
                onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
            }
        },
    });
    return null;
}

// Error boundary
interface MapErrorBoundaryProps { children: ReactNode; onRetry?: () => void; }
class MapErrorBoundary extends Component<MapErrorBoundaryProps, { hasError: boolean }> {
    state = { hasError: false };
    static getDerivedStateFromError() { return { hasError: true }; }
    render() {
        if (this.state.hasError) return <div className="text-red-500 text-center p-4">Map error. <button onClick={this.props.onRetry} className="underline">Retry</button></div>;
        return this.props.children;
    }
}

function LeafletMapInner({ role, trips, bookings = [], selectedTrip, onTripSelect, onLocationSelect, userLocation }: LeafletMapProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const previousDefaultIcon = (L.Marker.prototype as any).options.icon;
        (L.Marker.prototype as any).options.icon = DefaultIcon;
        setMounted(true);
        return () => { (L.Marker.prototype as any).options.icon = previousDefaultIcon; };
    }, []);

    if (!mounted) return <div className="w-full h-[400px] bg-gray-100 flex items-center justify-center">Loading Map...</div>;

    // Determine center
    const center = userLocation || (selectedTrip?.current_location && { lat: selectedTrip.current_location.lat, lng: selectedTrip.current_location.lng }) || { lat: 27.7172, lng: 85.3240 }; // Kathmandu default

    return (
        <div className="relative w-full h-full min-h-[400px]">
            <MapContainer center={[center.lat, center.lng]} zoom={13} className="w-full h-full" zoomControl={true}>
                <MapEvents onLocationSelect={onLocationSelect} role={role} />
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                <MapUpdater center={center} selectedTripId={selectedTrip?.id} />

                {/* User Location */}
                {userLocation && (
                    <Marker position={[userLocation.lat, userLocation.lng]} icon={createLocationIcon('#3b82f6')} zIndexOffset={1100}>
                        <Popup>You</Popup>
                    </Marker>
                )}

                {/* Trips (Vehicles) */}
                {trips.map(trip => trip.current_location && (
                    <Marker
                        key={trip.id}
                        position={[trip.current_location.lat, trip.current_location.lng]}
                        icon={createBusIcon(trip.status === 'on_route')}
                        eventHandlers={{ click: () => onTripSelect?.(trip) }}
                    >
                        <Popup>
                            <strong>{trip.route_name}</strong><br />
                            Vehicle: {trip.plate_number}<br />
                            Status: {trip.status}
                        </Popup>
                    </Marker>
                ))}

                {/* Bookings (Driver View: show pickups) */}
                {role === 'driver' && bookings.map(b => (
                    <Marker
                        key={b.id}
                        position={[b.pickup_location_lat, b.pickup_location_lng]}
                        icon={createLocationIcon('#f59e0b')}
                    >
                        <Popup>Pickup: {b.passenger_name} ({b.seat_number})</Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}

export default function LeafletMap(props: LeafletMapProps) {
    const [retryKey, setRetryKey] = useState(0);
    return (
        <MapErrorBoundary onRetry={() => setRetryKey(k => k + 1)}>
            <LeafletMapInner key={retryKey} {...props} />
        </MapErrorBoundary>
    );
}
