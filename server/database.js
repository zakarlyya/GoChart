const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'gochart.db'));

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    company_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Planes table
  db.run(`CREATE TABLE IF NOT EXISTS planes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    tail_number TEXT UNIQUE NOT NULL,
    model TEXT NOT NULL,
    manufacturer TEXT,
    range_nm FLOAT,
    cruise_speed_kts FLOAT,
    fuel_capacity_gal FLOAT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Pilots table
  db.run(`CREATE TABLE IF NOT EXISTS pilots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    license_number TEXT NOT NULL,
    rating TEXT,
    total_hours FLOAT,
    contact_number TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Create trips table if it doesn't exist
  db.run(`CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    plane_id INTEGER,
    pilot_id INTEGER,
    departure_airport TEXT NOT NULL,
    arrival_airport TEXT NOT NULL,
    departure_time DATETIME,
    estimated_arrival_time DATETIME,
    actual_departure_time DATETIME,
    actual_arrival_time DATETIME,
    status TEXT DEFAULT 'scheduled',
    estimated_fuel_cost FLOAT,
    estimated_total_cost FLOAT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(plane_id) REFERENCES planes(id),
    FOREIGN KEY(pilot_id) REFERENCES pilots(id)
  )`);

  // Check if pilot_id column exists in trips table
  db.all("PRAGMA table_info(trips)", (err, rows) => {
    if (err) {
      console.error('Error checking trips table schema:', err);
      return;
    }
    
    // Check if pilot_id column exists in the returned rows
    const hasPilotId = rows.some(row => row.name === 'pilot_id');
    
    if (!hasPilotId) {
      db.run(`ALTER TABLE trips ADD COLUMN pilot_id INTEGER REFERENCES pilots(id)`, (err) => {
        if (err) {
          console.error('Error adding pilot_id column:', err);
        } else {
          console.log('Successfully added pilot_id column to trips table');
        }
      });
    }
  });
});

module.exports = db; 