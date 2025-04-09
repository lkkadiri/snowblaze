-- Create locations table
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    geofence_details JSONB,
    last_serviced_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    
    -- Optional additional metadata
    notes TEXT,
    status TEXT CHECK (status IN ('active', 'inactive', 'maintenance')) DEFAULT 'active'
);

-- Create Row Level Security Policies for locations
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view locations in their organization
CREATE POLICY "Users can view locations in their organization"
ON locations FOR SELECT
TO authenticated
USING (
    auth.uid() IN (
        SELECT user_id 
        FROM crew_members 
        WHERE organization_id = locations.organization_id
    )
);

-- Policy to allow admins to manage locations in their organization
CREATE POLICY "Admins can manage locations in their organization"
ON locations FOR ALL
TO authenticated
USING (
    auth.uid() IN (
        SELECT user_id 
        FROM crew_members 
        WHERE organization_id = locations.organization_id AND role = 'admin'
    )
);

-- Create an index for faster organization-based queries
CREATE INDEX idx_locations_organization ON locations(organization_id);

-- Add a trigger to update last_serviced_date when a location is serviced
CREATE OR REPLACE FUNCTION update_last_serviced_date()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE locations
    SET last_serviced_date = CURRENT_TIMESTAMP
    WHERE id = NEW.location_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger would be connected to a service_logs table 
-- which you would create to track each service event
