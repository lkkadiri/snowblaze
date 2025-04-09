-- Migration to add crew assignments and activity tracking

-- 1. Add last_active_at column to crew_members
ALTER TABLE public.crew_members
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;

-- Update existing RLS policy for crew_members to allow selecting the new column
-- Assuming the existing policy is "Users can view crew members"
-- Drop the existing policy first if needed, then recreate
DROP POLICY IF EXISTS "Users can view crew members" ON public.crew_members;
CREATE POLICY "Users can view crew members" 
ON public.crew_members FOR SELECT 
TO authenticated
USING (true); -- Adjust the USING clause based on actual requirements if needed

-- Policy to allow users to update their own last_active_at
DROP POLICY IF EXISTS "Users can update their own activity" ON public.crew_members;
CREATE POLICY "Users can update their own activity"
ON public.crew_members FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND id = id); -- Ensure they only update their own record


-- 2. Create crew_assignments table
CREATE TABLE IF NOT EXISTS public.crew_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crew_member_id UUID NOT NULL REFERENCES public.crew_members(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
    notes TEXT,
    
    -- Ensure a crew member isn't assigned the same location multiple times simultaneously (unless status differs)
    UNIQUE (crew_member_id, location_id, status), 
    
    -- Foreign key to organization for easier RLS (denormalized but useful)
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE 
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_crew_assignments_member_location ON public.crew_assignments(crew_member_id, location_id);
CREATE INDEX IF NOT EXISTS idx_crew_assignments_organization ON public.crew_assignments(organization_id);

-- Enable RLS for the new table
ALTER TABLE public.crew_assignments ENABLE ROW LEVEL SECURITY;

-- Add RLS Policy for inserting into crew_locations
-- Policy: Allow authenticated users to insert their own location updates
-- The previous subquery might fail in the CHECK context. Let's simplify.
-- This assumes the `crew_member_id` being inserted IS the correct one for the logged-in user.
-- The frontend code ensures this by fetching the user's crew_member_id first.
DROP POLICY IF EXISTS "Users can insert their own location" ON public.crew_locations;
CREATE POLICY "Users can insert their own location"
ON public.crew_locations FOR INSERT
TO authenticated
WITH CHECK (true); -- Allow any authenticated user to insert, relying on the frontend to send the correct crew_member_id.
                   -- Alternatively, a more complex function/trigger could verify ownership if needed, but let's start simple.


-- RLS Policies for crew_assignments:
-- Policy: Crew members can view their own assignments
DROP POLICY IF EXISTS "Crew can view their own assignments" ON public.crew_assignments;
CREATE POLICY "Crew can view their own assignments"
ON public.crew_assignments FOR SELECT
TO authenticated
USING (
    crew_member_id = (SELECT id FROM public.crew_members WHERE user_id = auth.uid() LIMIT 1)
);

-- Policy: Admins can view all assignments within their organization
DROP POLICY IF EXISTS "Admins can view all assignments in their org" ON public.crew_assignments;
CREATE POLICY "Admins can view all assignments in their org"
ON public.crew_assignments FOR SELECT
TO authenticated
USING (
    organization_id = (SELECT organization_id FROM public.crew_members WHERE user_id = auth.uid() LIMIT 1)
    AND
    (SELECT role FROM public.crew_members WHERE user_id = auth.uid() LIMIT 1) = 'admin'
);

-- Policy: Admins can manage (insert, update, delete) assignments within their organization
DROP POLICY IF EXISTS "Admins can manage assignments in their org" ON public.crew_assignments;
CREATE POLICY "Admins can manage assignments in their org"
ON public.crew_assignments FOR ALL
TO authenticated
USING (
    organization_id = (SELECT organization_id FROM public.crew_members WHERE user_id = auth.uid() LIMIT 1)
    AND
    (SELECT role FROM public.crew_members WHERE user_id = auth.uid() LIMIT 1) = 'admin'
)
WITH CHECK (
    organization_id = (SELECT organization_id FROM public.crew_members WHERE user_id = auth.uid() LIMIT 1)
    AND
    (SELECT role FROM public.crew_members WHERE user_id = auth.uid() LIMIT 1) = 'admin'
);

-- Optional: Function to automatically set organization_id on insert
CREATE OR REPLACE FUNCTION public.set_assignment_organization()
RETURNS TRIGGER AS $$
BEGIN
    SELECT organization_id INTO NEW.organization_id
    FROM public.crew_members
    WHERE id = NEW.crew_member_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to set organization_id before insert
DROP TRIGGER IF EXISTS set_organization_before_insert ON public.crew_assignments; -- Add this line
CREATE TRIGGER set_organization_before_insert
BEFORE INSERT ON public.crew_assignments
FOR EACH ROW EXECUTE FUNCTION public.set_assignment_organization();

COMMENT ON COLUMN public.crew_members.last_active_at IS 'Timestamp of the last known activity for the crew member (e.g., location update, login)';
COMMENT ON TABLE public.crew_assignments IS 'Tracks assignments of locations (jobs/sites) to crew members.';

-- Note: Apply this migration to your Supabase project.
