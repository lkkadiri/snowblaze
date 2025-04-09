-- Mock Location Data for Denver Car Dealerships
-- Replace '7b6a017c-43c5-498f-be11-dc12a9026bf9' if your organization_id is different.

INSERT INTO public.locations (name, address, latitude, longitude, organization_id, status, notes) VALUES
('Larry H. Miller Toyota Boulder', '2465 48th Ct, Boulder, CO 80301', 40.0213, -105.2412, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Large dealership, service center available.'),
('Groove Toyota', '5460 S Broadway, Englewood, CO 80113', 39.6175, -104.9876, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Focus on new and used Toyota vehicles.'),
('Mountain States Toyota', '201 W 70th Ave, Denver, CO 80221', 39.8234, -104.9915, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Known for large inventory.'),
('Stevinson Toyota East', '444 S Havana St, Aurora, CO 80012', 39.7091, -104.8648, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Serves the Aurora area.'),
('Stevinson Toyota West', '780 Denver West Colorado Mills Pkwy, Lakewood, CO 80401', 39.7400, -105.1790, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Located near Colorado Mills.'),
('AutoNation Honda Arapahoe', '10750 E Arapahoe Rd, Centennial, CO 80112', 39.5968, -104.8655, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Honda dealership in Centennial.'),
('Planet Honda', '15701 W Colfax Ave, Golden, CO 80401', 39.7405, -105.1730, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Honda dealership near Golden.'),
('Schomp Honda', '1003 Plum Valley Ln, Highlands Ranch, CO 80129', 39.5495, -104.9778, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Serves Highlands Ranch and south Denver.'),
('Mike Maroone Ford Longmont', '240 Alpine St, Longmont, CO 80501', 40.1675, -105.1019, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Ford dealership in Longmont.'),
('Larry H. Miller Ford Lakewood', '11595 W 6th Ave, Lakewood, CO 80215', 39.7275, -105.1270, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Ford sales and service.'),
('AutoNation Ford Littleton', '8252 S Broadway, Littleton, CO 80122', 39.5668, -104.9877, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Ford dealership serving Littleton.'),
('Emich Chevrolet', '2033 S Wadsworth Blvd, Lakewood, CO 80227', 39.6800, -105.0810, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Chevrolet dealership in Lakewood.'),
('Foundation Chevrolet', '11001 W Interstate 70 Frontage Rd N, Wheat Ridge, CO 80033', 39.7880, -105.1190, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Chevy dealer in Wheat Ridge.'),
('AutoNation Chevrolet North', '7300 N Broadway, Denver, CO 80221', 39.8285, -104.9870, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'North Denver Chevy dealer.'),
('Schomp Subaru', '580 S Havana St, Aurora, CO 80012', 39.7065, -104.8648, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Subaru dealership in Aurora.'),
('AutoNation Subaru West', '16351 W Colfax Ave, Golden, CO 80401', 39.7408, -105.1815, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Subaru dealer near Golden.'),
('Groove Subaru', '5300 S Broadway, Englewood, CO 80113', 39.6195, -104.9876, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Subaru sales in Englewood.'),
('Tynans Nissan Aurora', '780 S Havana St, Aurora, CO 80012', 39.7025, -104.8648, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Nissan dealership.'),
('Empire Lakewood Nissan', '10301 W 6th Ave, Lakewood, CO 80215', 39.7270, -105.1100, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Nissan sales and service in Lakewood.'),
('Arapahoe Hyundai', '9899 E Arapahoe Rd, Centennial, CO 80112', 39.5970, -104.8780, '7b6a017c-43c5-498f-be11-dc12a9026bf9', 'active', 'Hyundai dealership.');

-- You can add more locations following the same pattern.
-- Remember to run this script in your Supabase SQL editor.
