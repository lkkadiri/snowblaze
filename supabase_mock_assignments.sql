-- Mock Crew Assignments
-- Assigns a few mock locations to a specific crew member.

-- The crew member ID to assign locations to.
-- Replace 'c20977f8-6979-4e7b-a13c-7053f0423614' if your test crew member ID is different.
-- The organization_id will be set automatically by the trigger based on the crew member.

-- Ensure the locations exist before trying to assign them.
-- Using subqueries to find location IDs by name.

INSERT INTO public.crew_assignments (crew_member_id, location_id, status, notes)
SELECT
    'c20977f8-6979-4e7b-a13c-7053f0423614'::UUID, -- The Crew Member ID
    id,                                          -- The Location ID found by name
    'pending',                                   -- Initial status
    'Standard service check required.'           -- Example note
FROM public.locations
WHERE name = 'Mountain States Toyota'
LIMIT 1; -- Ensure only one assignment per location name match

INSERT INTO public.crew_assignments (crew_member_id, location_id, status, notes)
SELECT
    'c20977f8-6979-4e7b-a13c-7053f0423614'::UUID,
    id,
    'pending',
    'Check inventory levels.'
FROM public.locations
WHERE name = 'Schomp Honda'
LIMIT 1;

INSERT INTO public.crew_assignments (crew_member_id, location_id, status, notes)
SELECT
    'c20977f8-6979-4e7b-a13c-7053f0423614'::UUID,
    id,
    'in_progress',                               -- Example of a different status
    'Currently performing maintenance.'
FROM public.locations
WHERE name = 'Emich Chevrolet'
LIMIT 1;

INSERT INTO public.crew_assignments (crew_member_id, location_id, status, notes)
SELECT
    'c20977f8-6979-4e7b-a13c-7053f0423614'::UUID,
    id,
    'pending',
    'Follow up on customer inquiry.'
FROM public.locations
WHERE name = 'Groove Subaru'
LIMIT 1;

-- Add more assignments as needed following the pattern above.
-- Remember to run this script in your Supabase SQL editor AFTER the migrations and mock locations scripts.
