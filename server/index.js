require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse');

const app = express();
const PORT = process.env.PORT || 5000;

// Store airports in memory for quick access
let airports = [];

// Load airports data
const loadAirports = () => {
  const airportsFile = path.join(__dirname, '..', 'data', 'airports.csv');
  
  if (!fs.existsSync(airportsFile)) {
    console.error('Airports data file not found:', airportsFile);
    return;
  }

  const parser = csv.parse({ columns: true, skip_empty_lines: true });
  const fileStream = fs.createReadStream(airportsFile);

  fileStream.pipe(parser)
    .on('data', (row) => {
      airports.push({
        icao: row.icao,
        iata: row.iata,
        name: row.name,
        city: row.city,
        country: row.country,
        lat: parseFloat(row.lat),
        lon: parseFloat(row.lon),
        elevation: parseInt(row.elevation_ft, 10)
      });
    })
    .on('end', () => {
      console.log(`Loaded ${airports.length} airports`);
    })
    .on('error', (err) => {
      console.error('Error loading airports:', err);
    });
};

// Load airports on startup
loadAirports();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Debug middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Auth routes
app.post('/api/register', async (req, res) => {
  console.log('Register request:', req.body);
  try {
    const { email, password, company_name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      'INSERT INTO users (email, password, company_name) VALUES (?, ?, ?)',
      [email, hashedPassword, company_name],
      function(err) {
        if (err) {
          console.error('Registration error:', err);
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email already exists' });
          }
          return res.status(500).json({ error: 'Error creating user' });
        }
        
        const token = jwt.sign(
          { id: this.lastID, email },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );
        res.json({ token });
      }
    );
  } catch (error) {
    console.error('Server error during registration:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  console.log('Login request:', req.body);
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      console.error('Database error during login:', err);
      return res.status(500).json({ error: 'Server error' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    try {
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid password' });
      }

      const token = jwt.sign(
        { id: user.id, email },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({ token });
    } catch (error) {
      console.error('Error during password comparison:', error);
      res.status(500).json({ error: 'Error during authentication' });
    }
  });
});

// Protected routes
app.get('/api/planes', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM planes WHERE user_id = ?',
    [req.user.id],
    (err, planes) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json(planes);
    }
  );
});

app.post('/api/planes', authenticateToken, (req, res) => {
  console.log('Adding new plane:', req.body);
  const { tail_number, model, manufacturer, nickname, range_nm, cruise_speed_kts, fuel_capacity_gal } = req.body;
  
  if (!tail_number || !model || !manufacturer) {
    console.error('Missing required fields');
    return res.status(400).json({ error: 'Tail number, model, and manufacturer are required' });
  }

  db.run(
    `INSERT INTO planes (
      user_id, tail_number, model, manufacturer, nickname,
      range_nm, cruise_speed_kts, fuel_capacity_gal
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, tail_number, model, manufacturer, nickname || null, range_nm || null, cruise_speed_kts || null, fuel_capacity_gal || null],
    function(err) {
      if (err) {
        console.error('Error adding plane:', err);
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Tail number already exists' });
        }
        return res.status(500).json({ error: 'Error adding plane: ' + err.message });
      }

      // Fetch and return the newly created plane
      db.get('SELECT * FROM planes WHERE id = ?', [this.lastID], (err, plane) => {
        if (err) {
          console.error('Error fetching new plane:', err);
          return res.status(500).json({ error: 'Error fetching new plane' });
        }
        res.status(201).json(plane);
      });
    }
  );
});

app.get('/api/trips', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM trips WHERE user_id = ? ORDER BY departure_time',
    [req.user.id],
    (err, trips) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json(trips);
    }
  );
});

app.post('/api/trips', authenticateToken, (req, res) => {
  console.log('Creating new trip:', req.body);

  const { 
    departure_airport, 
    arrival_airport, 
    plane_id, 
    pilot_id,
    departure_time 
  } = req.body;
  
  if (!departure_airport || !arrival_airport || !plane_id || !departure_time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Convert plane_id and pilot_id to numbers
  const parsedPlaneId = Number(plane_id);
  const parsedPilotId = pilot_id ? Number(pilot_id) : null;

  // Validate the date format
  let departureDate;
  try {
    departureDate = new Date(departure_time);
    if (isNaN(departureDate.getTime())) {
      throw new Error('Invalid date');
    }
  } catch (error) {
    console.error('Invalid departure time:', departure_time);
    return res.status(400).json({ error: 'Invalid departure time format' });
  }

  // Estimate arrival time (2 hours after departure)
  const estimatedArrival = new Date(departureDate.getTime() + (2 * 60 * 60 * 1000));

  console.log('Inserting trip with values:', {
    userId: req.user.id,
    parsedPlaneId,
    parsedPilotId,
    departure_airport,
    arrival_airport,
    departure_time,
    estimatedArrival: estimatedArrival.toISOString()
  });

  db.run(
    `INSERT INTO trips (
      user_id, plane_id, pilot_id, departure_airport, arrival_airport, 
      departure_time, estimated_arrival_time, status, estimated_total_cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', 1000)`,
    [
      req.user.id,
      parsedPlaneId,
      parsedPilotId,
      departure_airport,
      arrival_airport,
      departureDate.toISOString(),
      estimatedArrival.toISOString()
    ],
    function(err) {
      if (err) {
        console.error('Error adding trip:', err);
        return res.status(500).json({ error: `Error adding trip: ${err.message}` });
      }
      
      db.get('SELECT * FROM trips WHERE id = ?', [this.lastID], (err, row) => {
        if (err) {
          console.error('Error fetching new trip:', err);
          return res.status(500).json({ error: `Error fetching new trip: ${err.message}` });
        }
        console.log('Trip created successfully:', row);
        res.status(201).json(row);
      });
    }
  );
});

// Update plane
app.put('/api/planes/:id', authenticateToken, (req, res) => {
  const { tail_number, model, manufacturer, nickname } = req.body;
  const planeId = req.params.id;

  console.log('Updating plane:', {
    planeId,
    updates: { tail_number, model, manufacturer, nickname }
  });

  if (!tail_number || !model || !manufacturer) {
    console.error('Missing required fields');
    return res.status(400).json({ error: 'Tail number, model, and manufacturer are required' });
  }

  // First check if the plane belongs to the user
  db.get(
    'SELECT * FROM planes WHERE id = ? AND user_id = ?',
    [planeId, req.user.id],
    (err, plane) => {
      if (err) {
        console.error('Database error checking plane:', err);
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
      if (!plane) {
        console.error('Plane not found:', { planeId, userId: req.user.id });
        return res.status(404).json({ error: 'Plane not found' });
      }

      // Update the plane
      db.run(
        `UPDATE planes 
         SET tail_number = ?, model = ?, manufacturer = ?, nickname = ?
         WHERE id = ? AND user_id = ?`,
        [tail_number, model, manufacturer, nickname || null, planeId, req.user.id],
        function(err) {
          if (err) {
            console.error('Error updating plane:', err);
            if (err.message.includes('UNIQUE constraint failed')) {
              return res.status(400).json({ error: 'Tail number already exists' });
            }
            return res.status(500).json({ error: 'Error updating plane: ' + err.message });
          }

          // Fetch and return the updated plane
          db.get(
            'SELECT * FROM planes WHERE id = ?',
            [planeId],
            (err, updatedPlane) => {
              if (err) {
                console.error('Error fetching updated plane:', err);
                return res.status(500).json({ error: 'Error fetching updated plane: ' + err.message });
              }
              if (!updatedPlane) {
                return res.status(404).json({ error: 'Updated plane not found' });
              }
              res.json(updatedPlane);
            }
          );
        }
      );
    }
  );
});

// Delete plane
app.delete('/api/planes/:id', authenticateToken, (req, res) => {
  const planeId = req.params.id;

  // First check if the plane belongs to the user
  db.get(
    'SELECT * FROM planes WHERE id = ? AND user_id = ?',
    [planeId, req.user.id],
    (err, plane) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!plane) return res.status(404).json({ error: 'Plane not found' });

      // Delete the plane
      db.run(
        'DELETE FROM planes WHERE id = ? AND user_id = ?',
        [planeId, req.user.id],
        (err) => {
          if (err) return res.status(500).json({ error: 'Error deleting plane' });
          res.json({ message: 'Plane deleted successfully' });
        }
      );
    }
  );
});

// Update trip
app.put('/api/trips/:id', authenticateToken, (req, res) => {
  console.log('Updating trip:', {
    tripId: req.params.id,
    body: req.body,
    userId: req.user.id
  });

  const { 
    status, 
    pilot_id,
    departure_time, 
    estimated_arrival_time,
    actual_departure_time,
    actual_arrival_time 
  } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  // Convert pilot_id to number or null
  const parsedPilotId = pilot_id ? Number(pilot_id) : null;

  // Validate and format dates
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }
      return date.toISOString();
    } catch (error) {
      console.error('Invalid date:', dateStr);
      return null;
    }
  };

  const formattedDates = {
    departure_time: formatDate(departure_time),
    estimated_arrival_time: formatDate(estimated_arrival_time),
    actual_departure_time: formatDate(actual_departure_time),
    actual_arrival_time: formatDate(actual_arrival_time)
  };

  // Log the values being used in the update
  console.log('Update values:', {
    status,
    parsedPilotId,
    ...formattedDates
  });

  db.run(
    `UPDATE trips 
     SET status = ?, pilot_id = ?, plane_id = ?, departure_time = ?, estimated_arrival_time = ?,
         actual_departure_time = ?, actual_arrival_time = ?
     WHERE id = ? AND user_id = ?`,
    [
      status, 
      parsedPilotId,
      req.body.plane_id,
      formattedDates.departure_time,
      formattedDates.estimated_arrival_time,
      formattedDates.actual_departure_time,
      formattedDates.actual_arrival_time,
      req.params.id, 
      req.user.id
    ],
    (err) => {
      if (err) {
        console.error('Error updating trip:', err);
        return res.status(500).json({ error: `Error updating trip: ${err.message}` });
      }
      
      db.get('SELECT * FROM trips WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, row) => {
        if (err) {
          console.error('Error fetching updated trip:', err);
          return res.status(500).json({ error: `Error fetching updated trip: ${err.message}` });
        }
        if (!row) {
          return res.status(404).json({ error: 'Trip not found' });
        }
        console.log('Trip updated successfully:', row);
        res.json(row);
      });
    }
  );
});

// Delete trip
app.delete('/api/trips/:id', authenticateToken, (req, res) => {
  const tripId = req.params.id;
  
  // First check if the trip belongs to the user and is scheduled
  db.get(
    'SELECT * FROM trips WHERE id = ? AND user_id = ? AND status = "scheduled"',
    [tripId, req.user.id],
    (err, trip) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!trip) return res.status(404).json({ error: 'Trip not found or cannot be deleted' });

      // Delete the trip
      db.run(
        'DELETE FROM trips WHERE id = ? AND user_id = ?',
        [tripId, req.user.id],
        (err) => {
          if (err) return res.status(500).json({ error: 'Error deleting trip' });
          res.json({ message: 'Trip deleted successfully' });
        }
      );
    }
  );
});

// Get all pilots for a user
app.get('/api/pilots', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM pilots WHERE user_id = ? ORDER BY name',
    [req.user.id],
    (err, rows) => {
      if (err) {
        console.error('Error fetching pilots:', err);
        return res.status(500).json({ error: 'Error fetching pilots' });
      }
      res.json(rows);
    }
  );
});

// Add a new pilot
app.post('/api/pilots', authenticateToken, (req, res) => {
  const { name, license_number, rating, total_hours, contact_number, email } = req.body;
  
  if (!name || !license_number) {
    return res.status(400).json({ error: 'Name and license number are required' });
  }

  db.run(
    `INSERT INTO pilots (user_id, name, license_number, rating, total_hours, contact_number, email)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, name, license_number, rating, total_hours, contact_number, email],
    function(err) {
      if (err) {
        console.error('Error adding pilot:', err);
        return res.status(500).json({ error: 'Error adding pilot' });
      }
      
      db.get('SELECT * FROM pilots WHERE id = ?', [this.lastID], (err, row) => {
        if (err) {
          console.error('Error fetching new pilot:', err);
          return res.status(500).json({ error: 'Error fetching new pilot' });
        }
        res.status(201).json(row);
      });
    }
  );
});

// Update a pilot
app.put('/api/pilots/:id', authenticateToken, (req, res) => {
  const { name, license_number, rating, total_hours, contact_number, email } = req.body;
  
  if (!name || !license_number) {
    return res.status(400).json({ error: 'Name and license number are required' });
  }

  db.run(
    `UPDATE pilots 
     SET name = ?, license_number = ?, rating = ?, total_hours = ?, contact_number = ?, email = ?
     WHERE id = ? AND user_id = ?`,
    [name, license_number, rating, total_hours, contact_number, email, req.params.id, req.user.id],
    (err) => {
      if (err) {
        console.error('Error updating pilot:', err);
        return res.status(500).json({ error: 'Error updating pilot' });
      }
      
      db.get('SELECT * FROM pilots WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, row) => {
        if (err) {
          console.error('Error fetching updated pilot:', err);
          return res.status(500).json({ error: 'Error fetching updated pilot' });
        }
        if (!row) {
          return res.status(404).json({ error: 'Pilot not found' });
        }
        res.json(row);
      });
    }
  );
});

// Delete a pilot
app.delete('/api/pilots/:id', authenticateToken, (req, res) => {
  db.run(
    'DELETE FROM pilots WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    (err) => {
      if (err) {
        console.error('Error deleting pilot:', err);
        return res.status(500).json({ error: 'Error deleting pilot' });
      }
      res.status(204).send();
    }
  );
});

// Airport search endpoint
app.get('/api/airports/search', authenticateToken, (req, res) => {
  const { query } = req.query;
  if (!query || query.length < 2) {
    return res.json([]);
  }

  const searchTerm = query.toLowerCase();
  const results = airports
    .filter(airport => 
      airport.icao.toLowerCase().includes(searchTerm) ||
      airport.name.toLowerCase().includes(searchTerm) ||
      (airport.iata && airport.iata.toLowerCase().includes(searchTerm)) ||
      airport.city.toLowerCase().includes(searchTerm)
    )
    .slice(0, 10) // Limit to 10 results
    .map(airport => ({
      icao: airport.icao,
      name: airport.name,
      city: airport.city,
      country: airport.country,
      coordinates: [airport.lon, airport.lat]
    }));

  res.json(results);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 