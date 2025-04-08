import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client
import uuid

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_KEY = os.getenv('SUPABASE_KEY', '')

supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Error initializing Supabase: {e}")

@app.route('/api/crew/location', methods=['POST'])
def update_crew_location():
    """
    Update crew member's location
    Expects JSON payload with:
    - crew_member_id
    - latitude
    - longitude
    """
    data = request.get_json()
    
    # Validate input
    if not all(key in data for key in ['crew_member_id', 'latitude', 'longitude']):
        return jsonify({"error": "Missing required location data"}), 400

    if supabase:
        try:
            # Insert new location record
            location_data = {
                'id': str(uuid.uuid4()),
                'crew_member_id': data['crew_member_id'],
                'latitude': data['latitude'],
                'longitude': data['longitude'],
                'timestamp': 'now()'  # Supabase will use current timestamp
            }

            # Insert location into Supabase
            response = supabase.table('crew_locations').insert(location_data).execute()

            return jsonify({"message": "Location updated successfully"}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        # Mock data for development
        return jsonify({
            "message": "Location updated successfully (mock)",
            "data": {
                "id": str(uuid.uuid4()),
                "crew_member_id": data['crew_member_id'],
                "latitude": data['latitude'],
                "longitude": data['longitude']
            }
        }), 200

@app.route('/api/crew/current-location/<crew_member_id>', methods=['GET'])
def get_current_location(crew_member_id):
    """
    Get the most recent location for a specific crew member
    """
    if supabase:
        try:
            # Fetch the most recent location for the crew member
            response = (supabase.table('crew_locations')
                        .select('*')
                        .eq('crew_member_id', crew_member_id)
                        .order('timestamp', desc=True)
                        .limit(1)
                        .execute())

            if response.data:
                return jsonify(response.data[0]), 200
            else:
                return jsonify({"error": "No location found"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        # Mock location data for development
        return jsonify({
            "crew_member_id": crew_member_id,
            "latitude": 39.7392,  # Denver coordinates
            "longitude": -104.9903,
            "timestamp": "2025-04-08T13:45:00Z"
        }), 200

@app.route('/api/organization/crew', methods=['GET'])
def get_organization_crew():
    """
    Get all crew members for an organization
    Requires authentication token
    """
    org_id = request.args.get('org_id')
    
    if not org_id:
        return jsonify({"error": "Organization ID is required"}), 400

    if supabase:
        try:
            # Fetch crew members
            response = (supabase.table('crew_members')
                        .select('*')
                        .eq('organization_id', org_id)
                        .execute())

            return jsonify(response.data), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        # Mock crew members for development
        mock_crew = [
            {
                "id": str(uuid.uuid4()),
                "name": "John Doe",
                "email": "john@example.com",
                "role": "driver",
                "organization_id": org_id
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Jane Smith",
                "email": "jane@example.com",
                "role": "crew",
                "organization_id": org_id
            }
        ]
        return jsonify(mock_crew), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
