require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse');
const { authenticateToken } = require('./auth');

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
      // After loading airports, initialize the trips router
      const { router: tripsRouter, setAirports } = require('./routes/trips');
      setAirports(airports);
      app.use('/api/trips', tripsRouter);
    })
    .on('error', (err) => {
      console.error('Error loading airports:', err);
    });
};

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Load airports and initialize routes
loadAirports();

// Auth routes
app.post('/api/register', async (req, res) => {
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
        
        res.status(201).json({ token });
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      res.json({ token, company_name: user.company_name });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Planes routes
app.post('/api/planes', authenticateToken, (req, res) => {
  const { tail_number, model, manufacturer, nickname, num_engines, num_seats } = req.body;
  
  if (!tail_number || !model || !manufacturer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  db.run(
    'INSERT INTO planes (user_id, tail_number, model, manufacturer, nickname, num_engines, num_seats) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, tail_number, model, manufacturer, nickname || '', num_engines || 1, num_seats || 1],
    function(err) {
      if (err) {
        console.error('Error adding plane:', err);
        return res.status(500).json({ error: 'Error adding plane' });
      }
      
      db.get('SELECT * FROM planes WHERE id = ?', [this.lastID], (err, plane) => {
        if (err) {
          console.error('Error retrieving added plane:', err);
          return res.status(500).json({ error: 'Error retrieving added plane' });
        }
        
        res.status(201).json(plane);
      });
    }
  );
});

app.put('/api/planes/:id', authenticateToken, (req, res) => {
  const planeId = req.params.id;
  const { tail_number, model, manufacturer, nickname, num_engines, num_seats } = req.body;
  
  // Validate that the plane belongs to the user
  db.get('SELECT * FROM planes WHERE id = ? AND user_id = ?', [planeId, req.user.id], (err, plane) => {
    if (err) {
      console.error('Error retrieving plane:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!plane) {
      return res.status(404).json({ error: 'Plane not found' });
    }
    
    // Build update query dynamically based on provided fields
    const updates = [];
    const params = [];
    
    if (tail_number !== undefined) {
      updates.push('tail_number = ?');
      params.push(tail_number);
    }
    
    if (model !== undefined) {
      updates.push('model = ?');
      params.push(model);
    }
    
    if (manufacturer !== undefined) {
      updates.push('manufacturer = ?');
      params.push(manufacturer);
    }
    
    if (nickname !== undefined) {
      updates.push('nickname = ?');
      params.push(nickname);
    }
    
    if (num_engines !== undefined) {
      updates.push('num_engines = ?');
      params.push(num_engines);
    }
    
    if (num_seats !== undefined) {
      updates.push('num_seats = ?');
      params.push(num_seats);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    // Add the WHERE clause parameters
    params.push(planeId);
    params.push(req.user.id);
    
    const updateQuery = `UPDATE planes SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;
    
    db.run(updateQuery, params, function(err) {
      if (err) {
        console.error('Error updating plane:', err);
        return res.status(500).json({ error: 'Error updating plane' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Plane not found or not updated' });
      }
      
      db.get('SELECT * FROM planes WHERE id = ?', [planeId], (err, updatedPlane) => {
        if (err) {
          console.error('Error retrieving updated plane:', err);
          return res.status(500).json({ error: 'Error retrieving updated plane' });
        }
        
        res.json(updatedPlane);
      });
    });
  });
});

app.get('/api/planes', authenticateToken, (req, res) => {
  db.all('SELECT * FROM planes WHERE user_id = ? ORDER BY id DESC', [req.user.id], (err, planes) => {
    if (err) {
      console.error('Error retrieving planes:', err);
      return res.status(500).json({ error: 'Error retrieving planes' });
    }
    
    res.json(planes);
  });
});

app.get('/api/planes/:id', authenticateToken, (req, res) => {
  const planeId = req.params.id;
  
  db.get('SELECT * FROM planes WHERE id = ? AND user_id = ?', [planeId, req.user.id], (err, plane) => {
    if (err) {
      console.error('Error retrieving plane:', err);
      return res.status(500).json({ error: 'Error retrieving plane' });
    }
    
    if (!plane) {
      return res.status(404).json({ error: 'Plane not found' });
    }
    
    res.json(plane);
  });
});

app.delete('/api/planes/:id', authenticateToken, (req, res) => {
  const planeId = req.params.id;
  
  // First check if there are any trips associated with this plane
  db.all('SELECT * FROM trips WHERE plane_id = ?', [planeId], (err, trips) => {
    if (err) {
      console.error('Error checking trips for plane:', err);
      return res.status(500).json({ error: 'Error checking trips for plane' });
    }
    
    if (trips.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete plane with associated trips',
        trips: trips
      });
    }
    
    // If no trips, proceed with deletion
    db.run('DELETE FROM planes WHERE id = ? AND user_id = ?', [planeId, req.user.id], function(err) {
      if (err) {
        console.error('Error deleting plane:', err);
        return res.status(500).json({ error: 'Error deleting plane' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Plane not found or not deleted' });
      }
      
      res.json({ message: 'Plane deleted successfully' });
    });
  });
});

// Pilots routes
app.post('/api/pilots', authenticateToken, (req, res) => {
  const { name, license_number, rating, total_hours, contact_number, email } = req.body;
  
  if (!name || !license_number) {
    return res.status(400).json({ error: 'Name and license number are required' });
  }
  
  db.run(
    'INSERT INTO pilots (user_id, name, license_number, rating, total_hours, contact_number, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, name, license_number, rating || '', total_hours || 0, contact_number || '', email || ''],
    function(err) {
      if (err) {
        console.error('Error adding pilot:', err);
        return res.status(500).json({ error: 'Error adding pilot' });
      }
      
      db.get('SELECT * FROM pilots WHERE id = ?', [this.lastID], (err, pilot) => {
        if (err) {
          console.error('Error retrieving added pilot:', err);
          return res.status(500).json({ error: 'Error retrieving added pilot' });
        }
        
        res.status(201).json(pilot);
      });
    }
  );
});

app.get('/api/pilots', authenticateToken, (req, res) => {
  db.all('SELECT * FROM pilots WHERE user_id = ? ORDER BY name', [req.user.id], (err, pilots) => {
    if (err) {
      console.error('Error retrieving pilots:', err);
      return res.status(500).json({ error: 'Error retrieving pilots' });
    }
    
    res.json(pilots);
  });
});

app.put('/api/pilots/:id', authenticateToken, (req, res) => {
  const pilotId = req.params.id;
  const { name, license_number, rating, total_hours, contact_number, email } = req.body;
  
  // Validate that the pilot belongs to the user
  db.get('SELECT * FROM pilots WHERE id = ? AND user_id = ?', [pilotId, req.user.id], (err, pilot) => {
    if (err) {
      console.error('Error retrieving pilot:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!pilot) {
      return res.status(404).json({ error: 'Pilot not found' });
    }
    
    // Build update query dynamically based on provided fields
    const updates = [];
    const params = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    
    if (license_number !== undefined) {
      updates.push('license_number = ?');
      params.push(license_number);
    }
    
    if (rating !== undefined) {
      updates.push('rating = ?');
      params.push(rating);
    }
    
    if (total_hours !== undefined) {
      updates.push('total_hours = ?');
      params.push(total_hours);
    }
    
    if (contact_number !== undefined) {
      updates.push('contact_number = ?');
      params.push(contact_number);
    }
    
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    // Add the WHERE clause parameters
    params.push(pilotId);
    params.push(req.user.id);
    
    const updateQuery = `UPDATE pilots SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;
    
    db.run(updateQuery, params, function(err) {
      if (err) {
        console.error('Error updating pilot:', err);
        return res.status(500).json({ error: 'Error updating pilot' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Pilot not found or not updated' });
      }
      
      db.get('SELECT * FROM pilots WHERE id = ?', [pilotId], (err, updatedPilot) => {
        if (err) {
          console.error('Error retrieving updated pilot:', err);
          return res.status(500).json({ error: 'Error retrieving updated pilot' });
        }
        
        res.json(updatedPilot);
      });
    });
  });
});

app.delete('/api/pilots/:id', authenticateToken, (req, res) => {
  const pilotId = req.params.id;
  
  // First check if there are any trips associated with this pilot
  db.all('SELECT * FROM trips WHERE pilot_id = ?', [pilotId], (err, trips) => {
    if (err) {
      console.error('Error checking trips for pilot:', err);
      return res.status(500).json({ error: 'Error checking trips for pilot' });
    }
    
    if (trips.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete pilot with associated trips',
        trips: trips
      });
    }
    
    // If no trips, proceed with deletion
    db.run('DELETE FROM pilots WHERE id = ? AND user_id = ?', [pilotId, req.user.id], function(err) {
      if (err) {
        console.error('Error deleting pilot:', err);
        return res.status(500).json({ error: 'Error deleting pilot' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Pilot not found or not deleted' });
      }
      
      res.json({ message: 'Pilot deleted successfully' });
    });
  });
});

// Airport search endpoint
app.get('/api/airports/search', authenticateToken, (req, res) => {
  const query = req.query.query?.toUpperCase() || '';
  
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }
  
  // Search by ICAO, IATA, name, or city
  const results = airports.filter(airport => 
    (airport.icao && airport.icao.includes(query)) ||
    (airport.iata && airport.iata.includes(query)) ||
    (airport.name && airport.name.toUpperCase().includes(query)) ||
    (airport.city && airport.city.toUpperCase().includes(query))
  ).slice(0, 10).map(airport => ({
    icao: airport.icao,
    iata: airport.iata,
    name: airport.name,
    city: airport.city,
    country: airport.country,
    coordinates: [airport.lon, airport.lat]
  }));
  
  res.json(results);
});

// Start the server
app.listen(PORT, () => {
}); 