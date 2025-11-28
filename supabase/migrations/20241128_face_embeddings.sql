-- Create face_embeddings table for face recognition
CREATE TABLE IF NOT EXISTS face_embeddings (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL UNIQUE,
  employee_name TEXT NOT NULL,
  embedding DOUBLE PRECISION[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on employee_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_face_embeddings_employee_id ON face_embeddings(employee_id);

-- Enable Row Level Security
ALTER TABLE face_embeddings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (internal use only)
CREATE POLICY "Allow all operations" ON face_embeddings
  FOR ALL
  USING (true)
  WITH CHECK (true);
