router.post('/', authenticateToken, (req, res) => {
  const { tail_number, model, manufacturer, nickname, num_engines, num_seats } = req.body;
  const user_id = req.user.id;

  if (!tail_number || !model || !manufacturer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const sql = `INSERT INTO planes (user_id, tail_number, model, manufacturer, nickname, num_engines, num_seats) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [user_id, tail_number, model, manufacturer, nickname, num_engines || 2, num_seats || 20], function(err) {
    if (err) {
      console.error('Error creating plane:', err);
      return res.status(500).json({ error: 'Error creating plane' });
    }

    const sql = `SELECT * FROM planes WHERE id = ?`;
    db.get(sql, [this.lastID], (err, plane) => {
      if (err) {
        console.error('Error fetching created plane:', err);
        return res.status(500).json({ error: 'Error fetching created plane' });
      }
      res.json(plane);
    });
  });
});

router.put('/:id', authenticateToken, (req, res) => {
  const { tail_number, model, manufacturer, nickname, num_engines, num_seats } = req.body;
  const user_id = req.user.id;
  const plane_id = req.params.id;

  if (!tail_number || !model || !manufacturer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const sql = `UPDATE planes 
               SET tail_number = ?, model = ?, manufacturer = ?, nickname = ?, num_engines = ?, num_seats = ?
               WHERE id = ? AND user_id = ?`;
  
  db.run(sql, [tail_number, model, manufacturer, nickname, num_engines || 2, num_seats || 20, plane_id, user_id], function(err) {
    if (err) {
      console.error('Error updating plane:', err);
      return res.status(500).json({ error: 'Error updating plane' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Plane not found or unauthorized' });
    }

    const sql = `SELECT * FROM planes WHERE id = ? AND user_id = ?`;
    db.get(sql, [plane_id, user_id], (err, plane) => {
      if (err) {
        console.error('Error fetching updated plane:', err);
        return res.status(500).json({ error: 'Error fetching updated plane' });
      }
      res.json(plane);
    });
  });
}); 