'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface Vehicle {
    id: number;
    plate_number: string;
    make: string;
    model: string;
    year: number;
    capacity: number;
    status: string;
    approved: number;
    proposed_by_driver_name?: string;
}

interface Route {
    id: number;
    route_name: string;
    start_location_name: string;
    end_location_name: string;
    distance: number;
    approved: number;
    proposed_by_driver_name?: string;
}

export default function AdminDashboard() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [tab, setTab] = useState<'pending_vehicles' | 'pending_routes' | 'all_vehicles' | 'all_routes'>('pending_vehicles');

    useEffect(() => {
        if (!loading && (!user || user.role !== 'admin')) {
            router.push('/');
        }
    }, [user, loading, router]);

    const fetchVehicles = async (pending: boolean) => {
        try {
            const res = await fetch(`/api/vehicles?${pending ? 'pending=true' : 'approved=true'}`);
            if (res.ok) {
                const data = await res.json();
                setVehicles(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchRoutes = async (pending: boolean) => {
        try {
            const res = await fetch(`/api/routes?${pending ? 'pending=true' : 'approved=true'}`);
            if (res.ok) {
                const data = await res.json();
                setRoutes(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (!user) return;
        if (tab === 'pending_vehicles') fetchVehicles(true);
        if (tab === 'all_vehicles') fetchVehicles(false);
        if (tab === 'pending_routes') fetchRoutes(true);
        if (tab === 'all_routes') fetchRoutes(false);
    }, [tab, user]);

    const handleApproveVehicle = async (id: number) => {
        try {
            const res = await fetch(`/api/vehicles/${id}/approve`, { method: 'PUT' });
            if (res.ok) {
                alert('Vehicle approved!');
                fetchVehicles(true);
            } else {
                alert('Failed to approve');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteVehicle = async (id: number) => {
        if (!confirm('Are you sure?')) return;
        try {
            const res = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchVehicles(tab === 'pending_vehicles');
            }
        } catch (err) { console.error(err); }
    };

    const handleApproveRoute = async (id: number) => {
        try {
            const res = await fetch(`/api/routes/${id}/approve`, { method: 'PUT' });
            if (res.ok) {
                alert('Route approved!');
                fetchRoutes(true);
            } else {
                alert('Failed to approve');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteRoute = async (id: number) => {
        if (!confirm('Are you sure?')) return;
        try {
            const res = await fetch(`/api/routes/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchRoutes(tab === 'pending_routes');
            }
        } catch (err) { console.error(err); }
    };

    if (loading) return <div>Loading...</div>;
    if (!user || user.role !== 'admin') return <div>Access Denied</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

            <div className="flex space-x-4 mb-6">
                <button onClick={() => setTab('pending_vehicles')} className={`px-4 py-2 rounded ${tab === 'pending_vehicles' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Pending Vehicles</button>
                <button onClick={() => setTab('pending_routes')} className={`px-4 py-2 rounded ${tab === 'pending_routes' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Pending Routes</button>
                <button onClick={() => setTab('all_vehicles')} className={`px-4 py-2 rounded ${tab === 'all_vehicles' ? 'bg-blue-600 text-white' : 'bg-white'}`}>All Vehicles</button>
                <button onClick={() => setTab('all_routes')} className={`px-4 py-2 rounded ${tab === 'all_routes' ? 'bg-blue-600 text-white' : 'bg-white'}`}>All Routes</button>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                {(tab === 'pending_vehicles' || tab === 'all_vehicles') && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left p-2">Plate</th>
                                    <th className="text-left p-2">Make/Model</th>
                                    <th className="text-left p-2">Year</th>
                                    <th className="text-left p-2">Capacity</th>
                                    <th className="text-left p-2">Proposed By</th>
                                    <th className="text-left p-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vehicles.map(v => (
                                    <tr key={v.id} className="border-b hover:bg-gray-50">
                                        <td className="p-2">{v.plate_number}</td>
                                        <td className="p-2">{v.make} {v.model}</td>
                                        <td className="p-2">{v.year}</td>
                                        <td className="p-2">{v.capacity}</td>
                                        <td className="p-2">{v.proposed_by_driver_name || 'N/A'}</td>
                                        <td className="p-2">
                                            {v.approved === 0 && (
                                                <button onClick={() => handleApproveVehicle(v.id)} className="bg-green-500 text-white px-3 py-1 rounded mr-2">Approve</button>
                                            )}
                                            <button onClick={() => handleDeleteVehicle(v.id)} className="bg-red-500 text-white px-3 py-1 rounded">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {vehicles.length === 0 && <p className="text-center py-4">No vehicles found.</p>}
                    </div>
                )}

                {(tab === 'pending_routes' || tab === 'all_routes') && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left p-2">Name</th>
                                    <th className="text-left p-2">Start</th>
                                    <th className="text-left p-2">End</th>
                                    <th className="text-left p-2">Distance</th>
                                    <th className="text-left p-2">Proposed By</th>
                                    <th className="text-left p-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {routes.map(r => (
                                    <tr key={r.id} className="border-b hover:bg-gray-50">
                                        <td className="p-2">{r.route_name}</td>
                                        <td className="p-2">{r.start_location_name}</td>
                                        <td className="p-2">{r.end_location_name}</td>
                                        <td className="p-2">{r.distance} km</td>
                                        <td className="p-2">{r.proposed_by_driver_name || 'N/A'}</td>
                                        <td className="p-2">
                                            {r.approved === 0 && (
                                                <button onClick={() => handleApproveRoute(r.id)} className="bg-green-500 text-white px-3 py-1 rounded mr-2">Approve</button>
                                            )}
                                            <button onClick={() => handleDeleteRoute(r.id)} className="bg-red-500 text-white px-3 py-1 rounded">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {routes.length === 0 && <p className="text-center py-4">No routes found.</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
