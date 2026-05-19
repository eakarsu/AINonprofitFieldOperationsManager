const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nonprofit_field_ops',
});

async function createTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'staff',
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS volunteers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        skills TEXT[],
        location VARCHAR(255),
        availability JSONB,
        status VARCHAR(50) DEFAULT 'active',
        geo_lat DECIMAL(10,8),
        geo_lng DECIMAL(11,8),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS programs (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        location VARCHAR(255),
        capacity INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active',
        manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS shifts (
        id SERIAL PRIMARY KEY,
        volunteer_id INTEGER REFERENCES volunteers(id) ON DELETE CASCADE,
        program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,
        location VARCHAR(255),
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        status VARCHAR(50) DEFAULT 'scheduled',
        check_in_time TIMESTAMP,
        check_out_time TIMESTAMP,
        photo_url VARCHAR(500),
        gps_breadcrumb JSONB,
        supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS cases (
        id SERIAL PRIMARY KEY,
        client_name VARCHAR(255) NOT NULL,
        contact VARCHAR(255),
        needs TEXT[],
        urgency_score INTEGER DEFAULT 5,
        status VARCHAR(50) DEFAULT 'open',
        program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,
        ai_triage TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS donations (
        id SERIAL PRIMARY KEY,
        donor_name VARCHAR(255),
        donor_email VARCHAR(255),
        type VARCHAR(100),
        item_description TEXT,
        quantity INTEGER DEFAULT 1,
        weight_lbs DECIMAL(10,2),
        location VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        item_name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        quantity INTEGER DEFAULT 0,
        unit VARCHAR(50),
        location VARCHAR(255),
        min_threshold INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS incidents (
        id SERIAL PRIMARY KEY,
        reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        location VARCHAR(255),
        incident_type VARCHAR(100),
        description TEXT,
        severity VARCHAR(50) DEFAULT 'medium',
        ai_analysis TEXT,
        status VARCHAR(50) DEFAULT 'open',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(255),
        entity_type VARCHAR(100),
        entity_id INTEGER,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ai_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        endpoint VARCHAR(100),
        input_data JSONB,
        result JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('All tables created/verified');
  } finally {
    client.release();
  }
}

module.exports = { pool, createTables };
