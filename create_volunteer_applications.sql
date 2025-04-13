-- Create a table for volunteer applications
CREATE TABLE IF NOT EXISTS volunteer_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    position_interest TEXT DEFAULT 'general',
    source TEXT DEFAULT 'website',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    contacted_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Create an index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_volunteer_applications_email ON volunteer_applications(email);

-- Create an index on status for filtering
CREATE INDEX IF NOT EXISTS idx_volunteer_applications_status ON volunteer_applications(status);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the updated_at column
DROP TRIGGER IF EXISTS update_volunteer_applications_updated_at ON volunteer_applications;
CREATE TRIGGER update_volunteer_applications_updated_at
BEFORE UPDATE ON volunteer_applications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security) policies
ALTER TABLE volunteer_applications ENABLE ROW LEVEL SECURITY;

-- Create policy for anon users to insert data
DROP POLICY IF EXISTS anon_insert_policy ON volunteer_applications;
CREATE POLICY anon_insert_policy
ON volunteer_applications
FOR INSERT
TO anon
WITH CHECK (true);

-- Create policy for authenticated users to see all applications
DROP POLICY IF EXISTS admin_all_access ON volunteer_applications;
CREATE POLICY admin_all_access
ON volunteer_applications
FOR ALL
TO authenticated
USING (true);

-- Add a comment to the table
COMMENT ON TABLE volunteer_applications IS 'Stores volunteer applications submitted through the Join Team page';
