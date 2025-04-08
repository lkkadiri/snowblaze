-- Drop all existing policies and disable RLS
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "Users can view crew members in their organization" ON crew_members;
DROP POLICY IF EXISTS "Admins can insert crew members" ON crew_members;
DROP POLICY IF EXISTS "Admins can update crew members" ON crew_members;
DROP POLICY IF EXISTS "Admins can delete crew members" ON crew_members;
DROP POLICY IF EXISTS "Users can update their own record" ON crew_members;
DROP POLICY IF EXISTS "Users can view locations in their organization" ON crew_locations;

ALTER TABLE IF EXISTS organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crew_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crew_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_organizations DISABLE ROW LEVEL SECURITY;

-- Drop existing objects with CASCADE to remove all dependencies
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS fix_user_metadata_on_login ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_organization() CASCADE;
DROP FUNCTION IF EXISTS public.fix_user_metadata() CASCADE;
DROP FUNCTION IF EXISTS public.update_existing_users() CASCADE;
DROP FUNCTION IF EXISTS refresh_user_organization_roles() CASCADE;
DROP MATERIALIZED VIEW IF EXISTS user_organization_roles CASCADE;
DROP TABLE IF EXISTS crew_locations CASCADE;
DROP TABLE IF EXISTS user_organizations CASCADE;
DROP TABLE IF EXISTS crew_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Recreate organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Recreate crew_members table with organization_id to match frontend expectations
CREATE TABLE crew_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('admin', 'driver', 'crew', 'supervisor')) NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES auth.users(id) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Recreate crew_locations table
CREATE TABLE crew_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crew_member_id UUID REFERENCES crew_members(id),
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_locations ENABLE ROW LEVEL SECURITY;

-- Organizations Policy - Simple policy without recursion
CREATE POLICY "Users can view their organization" 
ON organizations FOR SELECT 
TO authenticated
USING (true);

-- Crew Members Policy - Simple policy without recursion
CREATE POLICY "Users can view crew members" 
ON crew_members FOR SELECT 
TO authenticated
USING (true);

-- Crew Members Policy - Allow insert for authenticated users
CREATE POLICY "Users can insert crew members" 
ON crew_members FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Crew Locations Policy - Simple policy without recursion
CREATE POLICY "Users can view locations"
ON crew_locations FOR SELECT 
TO authenticated
USING (true);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
    org_name TEXT;
    user_name TEXT;
    user_role TEXT;
BEGIN
    -- Check if user already has organization_id in metadata
    -- This means they were added by an admin and we should skip creating a new organization
    IF NEW.raw_user_meta_data->>'organization_id' IS NOT NULL AND NEW.raw_user_meta_data->>'organization_id' != 'undefined' THEN
        -- Just ensure the metadata is properly set
        RETURN NEW;
    END IF;

    -- Set default values
    org_name := 'My Organization';
    user_name := NEW.email;
    user_role := 'admin';
    
    -- Try to get values from metadata if available
    IF NEW.raw_user_meta_data IS NOT NULL THEN
        -- Get organization name if provided
        IF NEW.raw_user_meta_data->>'org_name' IS NOT NULL AND NEW.raw_user_meta_data->>'org_name' != 'undefined' THEN
            org_name := NEW.raw_user_meta_data->>'org_name';
        END IF;
        
        -- Get user name if provided
        IF NEW.raw_user_meta_data->>'name' IS NOT NULL AND NEW.raw_user_meta_data->>'name' != 'undefined' THEN
            user_name := NEW.raw_user_meta_data->>'name';
        END IF;
        
        -- Get user role if provided
        IF NEW.raw_user_meta_data->>'role' IS NOT NULL AND NEW.raw_user_meta_data->>'role' != 'undefined' THEN
            user_role := NEW.raw_user_meta_data->>'role';
        END IF;
    END IF;

    -- Create a new organization
    INSERT INTO organizations (name)
    VALUES (org_name)
    RETURNING id INTO new_org_id;

    -- Insert into crew_members
    INSERT INTO crew_members (
        name, 
        email, 
        role,
        organization_id,
        user_id
    ) VALUES (
        user_name,
        NEW.email,
        user_role,
        new_org_id,
        NEW.id
    );

    -- Update user metadata to include organization_id for frontend compatibility
    UPDATE auth.users
    SET raw_user_meta_data = 
        jsonb_set(
            COALESCE(raw_user_meta_data, '{}'::jsonb),
            '{organization_id}',
            to_jsonb(new_org_id::text)
        )
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create a function to fix user metadata if it's missing organization_id
CREATE OR REPLACE FUNCTION public.fix_user_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- If the user doesn't have organization_id in metadata, add it
    IF (NEW.raw_user_meta_data->>'organization_id') IS NULL OR (NEW.raw_user_meta_data->>'organization_id') = 'undefined' THEN
        -- Check if user has a crew_member record
        IF EXISTS (SELECT 1 FROM crew_members WHERE user_id = NEW.id) THEN
            -- Update user metadata with organization_id from crew_members
            UPDATE auth.users
            SET raw_user_meta_data = 
                jsonb_set(
                    COALESCE(raw_user_meta_data, '{}'::jsonb),
                    '{organization_id}',
                    to_jsonb((SELECT organization_id::text FROM crew_members WHERE user_id = NEW.id))
                )
            WHERE id = NEW.id;
        ELSE
            -- Create a default organization for this user
            DECLARE
                new_org_id UUID;
                user_name TEXT := COALESCE(NEW.raw_user_meta_data->>'name', NEW.email);
                user_role TEXT := COALESCE(NEW.raw_user_meta_data->>'role', 'admin');
            BEGIN
                -- Create organization
                INSERT INTO organizations (name)
                VALUES ('Default Organization for ' || user_name)
                RETURNING id INTO new_org_id;
                
                -- Create crew_member
                INSERT INTO crew_members (
                    name,
                    email,
                    role,
                    organization_id,
                    user_id
                ) VALUES (
                    user_name,
                    NEW.email,
                    user_role,
                    new_org_id,
                    NEW.id
                );
                
                -- Update user metadata
                UPDATE auth.users
                SET raw_user_meta_data = 
                    jsonb_set(
                        COALESCE(raw_user_meta_data, '{}'::jsonb),
                        '{organization_id}',
                        to_jsonb(new_org_id::text)
                    )
                WHERE id = NEW.id;
            END;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to fix user metadata on login
CREATE TRIGGER fix_user_metadata_on_login
AFTER UPDATE OF last_sign_in_at ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE fix_user_metadata();

-- Create a function to update existing users
CREATE OR REPLACE FUNCTION public.update_existing_users()
RETURNS void AS $$
DECLARE
    user_record RECORD;
    default_org_id UUID;
BEGIN
    -- Create a default organization
    INSERT INTO organizations (name)
    VALUES ('Default Organization')
    RETURNING id INTO default_org_id;

    -- For each user in auth.users
    FOR user_record IN SELECT * FROM auth.users
    LOOP
        -- Check if user already has a crew_member record
        IF NOT EXISTS (SELECT 1 FROM crew_members WHERE user_id = user_record.id) THEN
            -- Create a crew_member record for the user
            INSERT INTO crew_members (
                name,
                email,
                role,
                organization_id,
                user_id
            ) VALUES (
                COALESCE(user_record.raw_user_meta_data->>'name', user_record.email),
                user_record.email,
                COALESCE(user_record.raw_user_meta_data->>'role', 'admin'),
                default_org_id,
                user_record.id
            );
        END IF;
        
        -- Update user metadata with organization_id
        UPDATE auth.users
        SET raw_user_meta_data = 
            jsonb_set(
                COALESCE(raw_user_meta_data, '{}'::jsonb),
                '{organization_id}',
                to_jsonb((SELECT organization_id::text FROM crew_members WHERE user_id = user_record.id))
            )
        WHERE id = user_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function to update existing users
SELECT update_existing_users();
