const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
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

app.listen(port, () => {
  console.log(`Admin backend running on port ${port}`);
});
