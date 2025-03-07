const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database path
const dbPath = path.resolve(__dirname, 'gochart.db');

/**
 * Create and initialize the database connection
 */
const initializeDatabase = () => {
  // Create tables and schema
  createTables();
  
  // Check and update schema if needed
  updateSchemaIfNeeded();
};

/**
 * Create database tables if they don't exist
 */
const createTables = () => {
  db.serialize(() => {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');
    
    // Create users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        company_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create planes table
    db.run(`
      CREATE TABLE IF NOT EXISTS planes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        tail_number TEXT NOT NULL,
        model TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        nickname TEXT,
        num_engines INTEGER DEFAULT 2,
        num_seats INTEGER DEFAULT 20,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Create pilots table
    db.run(`
      CREATE TABLE IF NOT EXISTS pilots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        license_number TEXT NOT NULL,
        rating TEXT,
        total_hours INTEGER,
        contact_number TEXT,
        email TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Create trips table
    db.run(`
      CREATE TABLE IF NOT EXISTS trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        plane_id INTEGER NOT NULL,
        pilot_id INTEGER,
        departure_airport TEXT NOT NULL,
        arrival_airport TEXT NOT NULL,
        departure_time TEXT NOT NULL,
        estimated_arrival_time TEXT NOT NULL,
        actual_departure_time TEXT,
        actual_arrival_time TEXT,
        status TEXT DEFAULT 'scheduled',
        estimated_fuel_cost INTEGER,
        estimated_total_cost INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (plane_id) REFERENCES planes(id) ON DELETE RESTRICT,
        FOREIGN KEY (pilot_id) REFERENCES pilots(id) ON DELETE SET NULL
      )
    `);
  });
};

/**
 * Check if columns exist and add them if they don't
 */
const updateSchemaIfNeeded = () => {
  // Check planes table schema
  updatePlanesSchema();
  
  // Check trips table schema
  updateTripsSchema();
};

/**
 * Update planes table schema if needed
 */
const updatePlanesSchema = () => {
  db.all("PRAGMA table_info(planes)", (err, rows) => {
    if (err) {
      console.error('Error checking planes table schema:', err);
      return;
    }
    
    if (!rows || !Array.isArray(rows)) {
      console.error('Invalid response when checking planes table schema');
      return;
    }
    
    // Add num_engines column if it doesn't exist
    if (!rows.some(row => row.name === 'num_engines')) {
      addColumnToPlanes('num_engines', 'INTEGER DEFAULT 2');
    }
    
    // Add num_seats column if it doesn't exist
    if (!rows.some(row => row.name === 'num_seats')) {
      addColumnToPlanes('num_seats', 'INTEGER DEFAULT 20');
    }
    
    // Add nickname column if it doesn't exist
    if (!rows.some(row => row.name === 'nickname')) {
      addColumnToPlanes('nickname', 'TEXT');
    }
  });
};

/**
 * Add a column to the planes table
 * @param {string} columnName - Name of the column to add
 * @param {string} columnType - SQL type definition for the column
 */
const addColumnToPlanes = (columnName, columnType) => {
  db.run(`ALTER TABLE planes ADD COLUMN ${columnName} ${columnType}`, (err) => {
    if (err) {
      console.error(`Error adding ${columnName} column:`, err);
    }
  });
};

/**
 * Update trips table schema if needed
 */
const updateTripsSchema = () => {
  db.all("PRAGMA table_info(trips)", (err, rows) => {
    if (err) {
      console.error('Error checking trips table schema:', err);
      return;
    }
    
    if (!rows || !Array.isArray(rows)) {
      console.error('Invalid response when checking trips table schema');
      return;
    }
    
    // Add pilot_id column if it doesn't exist
    if (!rows.some(row => row.name === 'pilot_id')) {
      db.run("ALTER TABLE trips ADD COLUMN pilot_id INTEGER REFERENCES pilots(id) ON DELETE SET NULL", (err) => {
        if (err) {
          console.error('Error adding pilot_id column:', err);
        }
      });
    }
  });
};

// Connect to database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  
  // Initialize database schema
  initializeDatabase();
});

module.exports = db; 