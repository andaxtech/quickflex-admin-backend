// Deployment debug - trying root route

app.get('/', (req, res) => {
  res.send('QuickFlex Admin Backend is running.');
});

app.get('/drivers/pending', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT driver_id, first_name, last_name, email, phone_number, status
       FROM drivers
       WHERE status = 'New Registered'
       ORDER BY registration_date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching drivers:', err.message);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});
