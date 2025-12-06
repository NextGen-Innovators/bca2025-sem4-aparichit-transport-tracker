import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bus } from '@/lib/types';
import { MapPin, Ticket, X, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { getDistance, haversineDistance } from '@/lib/utils/geofencing';

interface BookingPanelProps {
	pickupLocation: { lat: number; lng: number; address?: string } | null;
	dropoffLocation: { lat: number; lng: number; address?: string } | null;
	selectedBus: Bus | null;
	onBook: (bus: Bus, bookingData: any) => void;
	onReset: () => void;
	loading?: boolean;
}

export default function BookingPanel({
	pickupLocation,
	dropoffLocation,
	selectedBus,
	onBook,
	onReset,
	loading = false,
}: BookingPanelProps) {
	const [passengerName, setPassengerName] = useState('');
	const [phoneNumber, setPhoneNumber] = useState('');
	const [numberOfPassengers, setNumberOfPassengers] = useState(1);
	const [farePreview, setFarePreview] = useState<number | null>(null);
	const [distanceKm, setDistanceKm] = useState<number | null>(null);
	const [busToPickupDistance, setBusToPickupDistance] = useState<number | null>(null);
	const [validationErrors, setValidationErrors] = useState<{
		name?: string;
		phone?: string;
		passengers?: string;
	}>({});

	const seatsUnavailable =
		!!selectedBus && (selectedBus.availableSeats ?? 0) <= 0;

	const requestedTooManySeats =
		!!selectedBus && numberOfPassengers > (selectedBus.availableSeats ?? 0);

	// Distance estimate between pickup and dropoff (km)
	useEffect(() => {
		if (!pickupLocation || !dropoffLocation) {
			setDistanceKm(null);
			return;
		}
		const km = getDistance(pickupLocation, dropoffLocation);
		setDistanceKm(km);
	}, [pickupLocation, dropoffLocation]);

	// Simple fare preview (approximate UI hint only)
	useEffect(() => {
		if (!selectedBus || !distanceKm) {
			setFarePreview(null);
			return;
		}
		const base = 30;
		const perKm = 10;
		const vehicleMultiplier =
			selectedBus.vehicleType === 'taxi'
				? 2.5
				: selectedBus.vehicleType === 'bike'
					? 0.8
					: selectedBus.vehicleType === 'others'
						? 1.2
						: 1;

		const estimated =
			(base + distanceKm * perKm * vehicleMultiplier) * numberOfPassengers;
		setFarePreview(Math.round(estimated));
	}, [selectedBus, distanceKm, numberOfPassengers]);

	// Calculate distance from bus to pickup location (real-time)
	useEffect(() => {
		if (!selectedBus || !pickupLocation) {
			setBusToPickupDistance(null);
			return;
		}

		const distanceMeters = haversineDistance(
			selectedBus.currentLocation.lat,
			selectedBus.currentLocation.lng,
			pickupLocation.lat,
			pickupLocation.lng
		);

		setBusToPickupDistance(distanceMeters);
	}, [selectedBus, pickupLocation]);

	const handlePassengerCountClick = (value: number) => {
		setNumberOfPassengers(value);
		if (selectedBus && value > (selectedBus.availableSeats ?? 0)) {
			setValidationErrors(prev => ({
				...prev,
				passengers: `Only ${selectedBus.availableSeats} seats available`,
			}));
		} else {
			setValidationErrors(prev => ({ ...prev, passengers: undefined }));
		}
	};

	const handleBooking = () => {
		const errors: typeof validationErrors = {};

		if (!selectedBus) {
			toast('Select a bus first', {
				description: 'Tap on a bus icon on the map to choose your bus.',
			});
			errors.passengers = 'Select a bus first';
		}

		if (!pickupLocation || !dropoffLocation) {
			toast('Select locations first', {
				description: 'Please select pickup and dropoff locations on the map.',
			});
			errors.passengers = 'Select pickup and dropoff locations first';
		}

		if (!passengerName || !phoneNumber) {
			if (!passengerName) {
				errors.name = 'Name is required';
			}
			if (!phoneNumber) {
				errors.phone = 'Phone number is required';
			}
		}

		if (requestedTooManySeats) {
			toast('Not enough seats available', {
				description: `You requested ${numberOfPassengers}, but only ${selectedBus?.availableSeats} seats are available.`,
			});
			errors.passengers = `Only ${selectedBus?.availableSeats} seats are available`;
		}

		setValidationErrors(errors);

		if (Object.keys(errors).length > 0 || !selectedBus || !pickupLocation || !dropoffLocation) {
			return;
		}

		onBook(selectedBus, {
			passengerName,
			phoneNumber,
			numberOfPassengers,
			paymentMethod: 'cash',
		});

		// Reset form
		setPassengerName('');
		setPhoneNumber('');
		setNumberOfPassengers(1);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Ticket className="w-5 h-5" />
					Book Your Ride
				</CardTitle>
				<CardDescription>
					Select locations on the map and choose a bus
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Location Info */}
				<div className="space-y-2">
					<div className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
						<MapPin className="w-4 h-4 text-blue-600 mt-0.5" />
						<div className="flex-1 min-w-0">
							<p className="text-xs font-medium text-blue-900">Pickup</p>
							<p className="text-xs text-blue-700 truncate">
								{pickupLocation?.address || 'Click map to select'}
							</p>
						</div>
						{pickupLocation && (
							<Button
								variant="ghost"
								size="sm"
								className="h-6 w-6 p-0"
								onClick={onReset}
							>
								<X className="w-3 h-3" />
							</Button>
						)}
					</div>

					<div className="flex items-start gap-2 p-2 bg-green-50 rounded-lg">
						<MapPin className="w-4 h-4 text-green-600 mt-0.5" />
						<div className="flex-1 min-w-0">
							<p className="text-xs font-medium text-green-900">Dropoff</p>
							<p className="text-xs text-green-700 truncate">
								{dropoffLocation?.address || 'Click map to select'}
							</p>
						</div>
					</div>
				</div>

				{/* Selected Bus */}
				{selectedBus && (
					<div className="p-3 bg-gray-50 rounded-lg border-2 border-blue-200">
						<p className="text-sm font-medium text-gray-700">Selected Bus</p>
						<p className="text-lg font-bold text-blue-600">{selectedBus.busNumber}</p>
						<p className="text-xs text-gray-600">{selectedBus.driverName}</p>
						<div className="mt-2 flex items-center gap-2">
							<span className="text-xs text-gray-500">Available Seats:</span>
							<span className="text-sm font-bold text-green-600">
								{selectedBus.availableSeats}/{selectedBus.capacity}
							</span>
						</div>

						{/* Bus to Pickup Distance */}
						{busToPickupDistance !== null && pickupLocation && (
							<div className={`mt-3 p-3 rounded-lg border-2 ${busToPickupDistance < 100
								? 'bg-green-50 border-green-300'
								: busToPickupDistance < 500
									? 'bg-yellow-50 border-yellow-300'
									: 'bg-blue-50 border-blue-300'
								}`}>
								<div className="flex items-center gap-2 mb-1">
									<Navigation className={`w-4 h-4 ${busToPickupDistance < 100
										? 'text-green-600'
										: busToPickupDistance < 500
											? 'text-yellow-600'
											: 'text-blue-600'
										}`} />
									<p className={`text-xs font-semibold ${busToPickupDistance < 100
										? 'text-green-900'
										: busToPickupDistance < 500
											? 'text-yellow-900'
											: 'text-blue-900'
										}`}>
										Bus Distance to Pickup
									</p>
								</div>
								<p className={`text-2xl font-bold ${busToPickupDistance < 100
									? 'text-green-600'
									: busToPickupDistance < 500
										? 'text-yellow-600'
										: 'text-blue-600'
									}`}>
									{busToPickupDistance < 1000
										? `${Math.round(busToPickupDistance)} m`
										: `${(busToPickupDistance / 1000).toFixed(1)} km`}
								</p>
								<p className={`text-xs mt-1 ${busToPickupDistance < 100
									? 'text-green-700'
									: busToPickupDistance < 500
										? 'text-yellow-700'
										: 'text-blue-700'
									}`}>
									{busToPickupDistance < 100
										? '🎉 Bus arriving now!'
										: busToPickupDistance < 500
											? `⏱️ Arriving in ~${Math.round(busToPickupDistance / 250)} min`
											: `⏱️ ETA: ~${Math.round(busToPickupDistance / 250)} min`}
								</p>
							</div>
						)}

						{/* Distance & fare preview */}
						{distanceKm !== null && (
							<div className="mt-2 text-xs text-gray-600 flex flex-col gap-0.5">
								<span>
									Approx. distance:{' '}
									<span className="font-semibold">
										{distanceKm < 1
											? `${Math.round(distanceKm * 1000)} m`
											: `${distanceKm.toFixed(1)} km`}
									</span>
								</span>
								{farePreview !== null && (
									<span>
										Estimated fare for {numberOfPassengers} passenger
										{numberOfPassengers > 1 ? 's' : ''}:{' '}
										<span className="font-semibold">रु {farePreview}</span>
									</span>
								)}
							</div>
						)}
					</div>
				)}

				{/* Booking Form - Shows when bus is selected */}
				{selectedBus && (
					<div className="space-y-3 pt-2 border-t">
						<div className="space-y-1.5">
							<Label htmlFor="name" className="text-sm">Your Name</Label>
							<Input
								id="name"
								placeholder="Enter your name"
								value={passengerName}
								onChange={(e) => setPassengerName(e.target.value)}
							/>
							{validationErrors.name && (
								<p className="text-xs text-red-600">{validationErrors.name}</p>
							)}
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="phone" className="text-sm">Phone Number</Label>
							<Input
								id="phone"
								type="tel"
								placeholder="+977 98XXXXXXXX"
								value={phoneNumber}
								onChange={(e) => setPhoneNumber(e.target.value)}
							/>
							{validationErrors.phone && (
								<p className="text-xs text-red-600">{validationErrors.phone}</p>
							)}
						</div>

						<div className="space-y-1.5">
							<Label className="text-sm">Number of Passengers</Label>
							<div className="flex flex-wrap gap-1">
								{Array.from({ length: 10 }).map((_, idx) => {
									const value = idx + 1;
									const disabled =
										value > (selectedBus.availableSeats ?? 0);
									return (
										<Button
											key={value}
											type="button"
											size="sm"
											variant={
												value === numberOfPassengers ? 'default' : 'outline'
											}
											className="min-h-9 min-w-9 px-0 text-xs"
											disabled={disabled}
											onClick={() => handlePassengerCountClick(value)}
										>
											{value}
										</Button>
									);
								})}
							</div>
							{validationErrors.passengers && (
								<p className="text-xs text-red-600">{validationErrors.passengers}</p>
							)}
						</div>

						<Button
							className="w-full"
							onClick={handleBooking}
							disabled={
								loading ||
								!passengerName ||
								!phoneNumber ||
								!pickupLocation ||
								!dropoffLocation ||
								seatsUnavailable ||
								requestedTooManySeats
							}
						>
							{loading
								? 'Booking...'
								: !pickupLocation || !dropoffLocation
									? 'Select locations first'
									: seatsUnavailable
										? 'No seats available'
										: requestedTooManySeats
											? 'Reduce passenger count'
											: 'Book Now'}
						</Button>
					</div>
				)}

				{/* Instructions */}
				{!selectedBus && (
					<div className="text-center py-4 text-sm text-gray-500 space-y-1">
						<p className="font-medium text-gray-700">How to book:</p>
						<p>1. Click on the map to select pickup location</p>
						<p>2. Click again to select dropoff location</p>
						<p>3. <span className="font-semibold text-blue-600">Click on a bus icon</span> to select it</p>
						<p>4. Fill in your details and book!</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
