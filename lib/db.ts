import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

// Ensure the data directory exists
const dbPath = path.join(process.cwd(), 'transport.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize Database Schema
export const initDb = () => {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'driver', 'passenger')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plate_number TEXT NOT NULL UNIQUE,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      capacity INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active', 'maintenance', 'inactive')) DEFAULT 'active',
      driver_id INTEGER,
      proposed_by_driver_id INTEGER,
      approved BOOLEAN DEFAULT 0, -- 0 = pending, 1 = approved
      approved_at DATETIME,
      approved_by_admin_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (driver_id) REFERENCES users(id),
      FOREIGN KEY (proposed_by_driver_id) REFERENCES users(id),
      FOREIGN KEY (approved_by_admin_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_name TEXT NOT NULL,
      start_location_name TEXT NOT NULL,
      start_location_lat REAL NOT NULL,
      start_location_lng REAL NOT NULL,
      end_location_name TEXT NOT NULL,
      end_location_lat REAL NOT NULL,
      end_location_lng REAL NOT NULL,
      distance REAL NOT NULL,
      estimated_time INTEGER NOT NULL, -- in minutes
      approved BOOLEAN DEFAULT 0, -- 0 = pending, 1 = approved
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME,
      approved_by_admin_id INTEGER,
      proposed_by_driver_id INTEGER,
      FOREIGN KEY (approved_by_admin_id) REFERENCES users(id),
      FOREIGN KEY (proposed_by_driver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      vehicle_id INTEGER NOT NULL,
      driver_id INTEGER REFERENCES users(id),
      departure_time DATETIME NOT NULL,
      arrival_time DATETIME NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('scheduled', 'on_route', 'completed', 'cancelled')) DEFAULT 'scheduled',
      fare REAL NOT NULL,
      available_seats INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    );

    CREATE TABLE IF NOT EXISTS trip_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      passenger_id INTEGER NOT NULL,
      seat_number INTEGER NOT NULL,
      booking_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL CHECK(status IN ('confirmed', 'pending', 'cancelled')) DEFAULT 'confirmed',
      total_amount REAL NOT NULL,
      pickup_location_lat REAL,
      pickup_location_lng REAL,
      dropoff_location_lat REAL,
      dropoff_location_lng REAL,
      FOREIGN KEY (trip_id) REFERENCES trips(id),
      FOREIGN KEY (passenger_id) REFERENCES users(id)
    );
  `;

  db.exec(schema);
  createDefaultAdmin();
};

function createDefaultAdmin() {
  const defaultAdmin = {
    user_name: 'Admin User',
    email: 'admin@mail.com',
    password: 'admin1', // Will be hashed below
    role: 'admin'
  };

  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ? AND role = ?').get(defaultAdmin.email, defaultAdmin.role);

  if (!existingAdmin) {
    try {
      const hashedPassword = bcrypt.hashSync(defaultAdmin.password, 10);
      const stmt = db.prepare(`
        INSERT INTO users (user_name, email, password, role)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(defaultAdmin.user_name, defaultAdmin.email, hashedPassword, defaultAdmin.role);
      console.log(`[✓] Default admin user created: ${defaultAdmin.email}`);
    } catch (err) {
      console.error(`[x] Failed to create default admin user: `, err);
    }
  }
}

// Initialize on import
initDb();

export default db;

// --- Helper Functions ---

export const createUser = (user: {
  user_name: string;
  email: string;
  password: string;
  role: string;
}) => {
  const stmt = db.prepare(`
    INSERT INTO users (user_name, email, password, role)
    VALUES (@user_name, @email, @password, @role)
  `);
  return stmt.run(user);
};

export const getUserByEmail = (email: string) => {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email) as any;
};

export const getUserById = (id: number | string) => {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as any;
};

