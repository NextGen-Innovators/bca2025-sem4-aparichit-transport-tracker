import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFirebaseAdminAuth } from '@/lib/firebaseAdmin';
import { getDatabase } from 'firebase-admin/database';
import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { calculateFareFromLocations } from '@/lib/utils/fareCalculator';
import { Booking, VehicleTypeId } from '@/lib/types';

// Initialize Firebase Admin for database access
function getAdminApp() {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase admin configuration');
    }

    // Use regional database URL if provided, otherwise default to asia-southeast1
    const databaseURL = process.env.FIREBASE_DATABASE_URL ||
      `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`;

    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey } as ServiceAccount),
      databaseURL,
    });
  }
  return getApps()[0]!;
}

export async function POST(request: Request) {
  try {
    const { bookingData } = await request.json();

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value || null;

    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Missing session cookie' },
        { status: 401 }
      );
    }

    // Verify session
    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifySessionCookie(sessionCookie);
    const passengerId = decoded.uid;

    // Validate booking data
    const {
      busId,
      passengerName,
      phoneNumber,
      email,
      pickupLocation,
      dropoffLocation,
      numberOfPassengers = 1,
      notes,
      paymentMethod = 'cash',
      vehicleType: requestedVehicleType,
    } = bookingData;

    if (!busId || !passengerName || !phoneNumber || !pickupLocation || !dropoffLocation) {
      return NextResponse.json(
        {
          error: 'Missing required fields: busId, passengerName, phoneNumber, pickupLocation, dropoffLocation',
        },
        { status: 400 }
      );
    }

    // Initialize Firebase Admin
    const adminApp = getAdminApp();
    const db = getDatabase(adminApp);

    // Fetch bus details first to validate and get vehicleType if missing
    const busRef = db.ref(`buses/${busId}`);
    const busSnapshot = await busRef.once('value');
    const bus = busSnapshot.val();

    if (!bus) {
      return NextResponse.json(
        { error: 'Bus not found' },
        { status: 404 }
      );
    }

    if (bus.isActive === false) {
      return NextResponse.json(
        { error: 'Bus is currently offline. Please choose another bus.' },
        { status: 409 }
      );
    }

    // Determine vehicle type: prefer request, fallback to bus data, fallback to 'bus'
    const vehicleType = requestedVehicleType || bus.vehicleType || 'bus';

    // Calculate fare
    let fare = 0;
    try {
      fare = calculateFareFromLocations(
        pickupLocation,
        dropoffLocation,
        vehicleType as VehicleTypeId,
        numberOfPassengers
      );
    } catch (err) {
      console.warn('Error calculating fare:', err);
      // Fallback fare if calculation fails (e.g. invalid vehicle type)
      fare = 0;
    }

    const capacity = bus.capacity || 0;
    const currentOnline = bus.onlineBookedSeats || 0;
    const currentOffline = bus.offlineOccupiedSeats || 0;
    const availableSeats = Math.max(0, capacity - currentOnline - currentOffline);

    if (numberOfPassengers > availableSeats) {
      return NextResponse.json(
        {
          error: `Not enough seats available. Requested ${numberOfPassengers}, only ${availableSeats} left.`,
        },
        { status: 409 }
      );
    }

    const bookingsRef = db.ref('bookings');
    const newBookingRef = bookingsRef.push();

    const reservationExpiresAt = new Date();
    reservationExpiresAt.setMinutes(reservationExpiresAt.getMinutes() + 10); // 10-minute timeout

    const booking: Omit<Booking, 'id'> = {
      passengerId,
      busId,
      passengerName,
      phoneNumber,
      email: email || null,
      numberOfPassengers,
      pickupLocation: {
        ...pickupLocation,
        timestamp: new Date(),
      },
      dropoffLocation: {
        ...dropoffLocation,
        timestamp: new Date(),
      },
      fare,
      status: 'pending',
      timestamp: new Date(),
      notes: notes || null,
      paymentMethod: paymentMethod as 'cash' | 'digital',
      reservationExpiresAt,
      isExpired: false,
    };

    const bookingWithId = {
      ...booking,
      id: newBookingRef.key!,
    };

    await newBookingRef.set(bookingWithId);

    // Update bus online booked seats & available seats
    const newOnline = currentOnline + numberOfPassengers;
    const newAvailable = Math.max(0, capacity - newOnline - currentOffline);

    await busRef.update({
      onlineBookedSeats: newOnline,
      availableSeats: newAvailable,
      lastSeatUpdate: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      booking: bookingWithId,
    });
  } catch (error) {
    console.error('[create-booking] error', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create booking';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

