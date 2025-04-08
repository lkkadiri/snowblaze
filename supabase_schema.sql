CREATE POLICY "Admins can manage crew members" 
ON crew_members FOR ALL 
USING (
    EXISTS (
        SELECT 1 
        FROM crew_members cm 
        WHERE cm.organization_id = crew_members.organization_id 
        AND cm.user_id = auth.uid() 
        AND cm.role = 'admin'
    ) 
    OR 
    (SELECT role FROM crew_members WHERE user_id = auth.uid() AND organization_id = crew_members.organization_id) = 'admin'
);
