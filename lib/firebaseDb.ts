import { getDatabase, ref, set, update, onValue, push, get } from 'firebase/database';
import { getFirebaseApp } from './firebase';
import { Bus, Booking, Location } from './types';

const getDb = () => getDatabase(getFirebaseApp());

// --- Bus Functions ---

export const subscribeToBuses = (callback: (buses: Bus[]) => void) => {
  const db = getDb();
  const busesRef = ref(db, 'buses');

  const unsubscribe = onValue(busesRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const busesList = Object.values(data) as Bus[];
      callback(busesList);
    } else {
      callback([]);
    }
  });

  return unsubscribe;
};

export const updateBusLocation = async (busId: string, location: Location) => {
  const db = getDb();
  const busRef = ref(db, `buses/${busId}`);
  await update(busRef, {
    currentLocation: location
  });
};

export const updateBusSeatStatus = async (busId: string, online: number, offline: number) => {
  const db = getDb();
  const busRef = ref(db, `buses/${busId}`);

  // Get capacity first to calculate available
  const snapshot = await get(busRef);
  const bus = snapshot.val() as Bus;

  if (bus) {
    const available = Math.max(0, bus.capacity - online - offline);
    await update(busRef, {
      onlineBookedSeats: online,
      offlineOccupiedSeats: offline,
      availableSeats: available,
      lastSeatUpdate: new Date().toISOString()
    });
  }
};

// --- Booking Functions ---

export const createBooking = async (booking: Omit<Booking, 'id'>) => {
  const db = getDb();
  const bookingsRef = ref(db, 'bookings');
  const newBookingRef = push(bookingsRef);

  const newBooking = {
    ...booking,
    id: newBookingRef.key,
    timestamp: new Date().toISOString()
  };

  await set(newBookingRef, newBooking);
  return newBooking;
};

export const subscribeToBookings = (
  id: string,
  role: 'driver' | 'passenger',
  callback: (bookings: Booking[]) => void
) => {
  const db = getDb();
  const bookingsRef = ref(db, 'bookings');

  const unsubscribe = onValue(bookingsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const allBookings = Object.values(data) as Booking[];
      // Filter based on role
      const filtered = allBookings.filter((b) => {
        if (role === 'passenger') {
          // id = passengerId
          return b.passengerId === id;
        }
        // role === 'driver' -> id = busId
        return b.busId === id;
      });
      callback(filtered);
    } else {
      callback([]);
    }
  });

  return unsubscribe;
};

// --- Seed Data (for demo) ---
export const seedInitialData = async (buses: Bus[]) => {
  const db = getDb();
  const busesRef = ref(db, 'buses');

  // Check if data exists
  const snapshot = await get(busesRef);
  if (!snapshot.exists()) {
    const updates: Record<string, any> = {};
    buses.forEach(bus => {
      updates[bus.id] = bus;
    });
    await update(busesRef, updates);
    console.log('Seeded initial bus data');
  }
};
