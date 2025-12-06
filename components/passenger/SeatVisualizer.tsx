'use client';

import React from 'react';
import { Bus } from '@/lib/types';
import { formatTimeAgo } from '@/lib/seatManagement';

interface SeatVisualizerProps {
	bus: Bus;
	compact?: boolean;
}

export default function SeatVisualizer({ bus, compact = false }: SeatVisualizerProps) {
	// Generate seat grid representation
	const generateSeatGrid = () => {
		const seats = [];
		const total = bus.capacity;
		const onlineBooked = bus.onlineBookedSeats || 0;
		const offlineOccupied = bus.offlineOccupiedSeats || 0;
		const available = bus.availableSeats || 0;

		// Add online booked seats (blue)
		for (let i = 0; i < onlineBooked; i++) {
			seats.push({ type: 'online', emoji: '🟦' });
		}

		// Add offline occupied seats (yellow)
		for (let i = 0; i < offlineOccupied; i++) {
			seats.push({ type: 'offline', emoji: '🟨' });
		}

		// Add available seats (white/empty)
		for (let i = 0; i < available; i++) {
			seats.push({ type: 'available', emoji: '⚪' });
		}

		return seats;
	};

	const seats = generateSeatGrid();
	const lastUpdate = bus.lastSeatUpdate ? formatTimeAgo(bus.lastSeatUpdate) : 'Just now';

	if (compact) {
		return (
			<div className="flex items-center gap-2">
				<div className="flex flex-wrap gap-0.5">
					{seats.map((seat, idx) => (
						<span key={idx} className="text-xs sm:text-sm">
							{seat.emoji}
						</span>
					))}
				</div>
				<span className="text-xs text-gray-500">
					{bus.availableSeats}/{bus.capacity}
				</span>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{/* Seat Grid */}
			<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
				<div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1 justify-center">
					{seats.map((seat, idx) => (
						<div
							key={idx}
							className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center text-base sm:text-lg"
							title={
								seat.type === 'online'
									? 'Online Booked'
									: seat.type === 'offline'
										? 'Offline Occupied'
										: 'Available'
							}
						>
							{seat.emoji}
						</div>
					))}
				</div>
			</div>

			{/* Seat Statistics */}
			<div className="grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
				<div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
					<div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
						{bus.onlineBookedSeats || 0}
					</div>
					<div className="text-xs text-gray-600 dark:text-gray-400">Online 🟦</div>
				</div>
				<div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2">
					<div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
						{bus.offlineOccupiedSeats || 0}
					</div>
					<div className="text-xs text-gray-600 dark:text-gray-400">Offline 🟨</div>
				</div>
				<div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
					<div className="text-2xl font-bold text-green-600 dark:text-green-400">
						{bus.availableSeats || 0}
					</div>
					<div className="text-xs text-gray-600 dark:text-gray-400">Available ⚪</div>
				</div>
			</div>

			{/* Last Update */}
			<div className="flex items-center justify-between text-xs text-gray-500">
				<p>Updated {lastUpdate}</p>
			</div>

			{/* Legend */}
			<div className="border-t pt-3 space-y-1">
				<div className="flex items-center gap-2 text-sm">
					<span>🟦</span>
					<span className="text-gray-700 dark:text-gray-300">Online Booked</span>
				</div>
				<div className="flex items-center gap-2 text-sm">
					<span>🟨</span>
					<span className="text-gray-700 dark:text-gray-300">Offline Occupied</span>
				</div>
				<div className="flex items-center gap-2 text-sm">
					<span>⚪</span>
					<span className="text-gray-700 dark:text-gray-300">Available</span>
				</div>
			</div>
		</div>
	);
}
