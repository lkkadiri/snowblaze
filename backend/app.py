import os
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client
import uuid
from functools import wraps
import jwt # PyJWT library needed: pip install PyJWT cryptography

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Import routes
from routes.users import users_bp

# Register blueprints
app.register_blueprint(users_bp, url_prefix='/api/users')

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_KEY = os.getenv('SUPABASE_KEY', '') # Public anon key
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '') # Service role key
SUPABASE_JWT_SECRET = os.getenv('JWT_SECRET_KEY', '') # JWT Secret (Using the key name from user's .env)

supabase = None # Client for general use (using anon key)
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Error initializing public Supabase client: {e}")

# Helper function to decode JWT and get user info
def get_user_from_token():
    print("--- Entering get_user_from_token ---") # DEBUG LOG
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        print("DEBUG: Missing or invalid Authorization header") # DEBUG LOG
        return None, {"error": "Missing or invalid Authorization header"}

    token = auth_header.split(' ')[1]
    print(f"DEBUG: Token received: {token[:10]}...") # DEBUG LOG (log prefix only)
    try:
        # Ensure JWT Secret is loaded
        if not SUPABASE_JWT_SECRET:
            print("DEBUG: SUPABASE_JWT_SECRET (from JWT_SECRET_KEY) is missing!") # DEBUG LOG
            raise Exception("Backend JWT secret not configured (JWT_SECRET_KEY missing in .env?)")
            
        print("DEBUG: Attempting to decode JWT...") # DEBUG LOG
        # Decode the token using the Supabase JWT secret
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET, # This variable now holds the value from JWT_SECRET_KEY
            audience='authenticated',
            algorithms=['HS256']
        )
        print(f"DEBUG: JWT decoded successfully. Payload sub: {payload.get('sub')}") # DEBUG LOG
        # Fetch user details using the service role client for reliability
        # Ensure service key is available
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
             print("DEBUG: SUPABASE_SERVICE_KEY is missing!") # DEBUG LOG
             raise Exception("Backend service key not configured")
             
        print("DEBUG: Creating admin client to fetch user details...") # DEBUG LOG
        admin_supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        user_response = admin_supabase.auth.admin.get_user_by_id(payload['sub']) # Use get_user_by_id
        print(f"DEBUG: Fetched user details: {user_response.user.id if user_response.user else 'Not Found'}") # DEBUG LOG
        return user_response.user, None
    except jwt.ExpiredSignatureError:
        print("DEBUG: JWT expired") # DEBUG LOG
        return None, {"error": "Token has expired"}
    except jwt.InvalidTokenError as e:
        print(f"DEBUG: Invalid JWT: {e}") # DEBUG LOG
        return None, {"error": "Invalid token"}
    except Exception as e:
        print(f"DEBUG: Exception in get_user_from_token: {e}") # DEBUG LOG
        # Check if it's a Supabase specific error (like user not found)
        if hasattr(e, 'status_code') and e.status_code == 404:
             return None, {"error": "User not found in authentication system"}
        return None, {"error": f"Could not validate user: {str(e)}"}

# Decorator for admin-only routes
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        print(f"--- Entering @admin_required for route {f.__name__} ---") # DEBUG LOG
        user, error = get_user_from_token()
        if error:
            print(f"DEBUG: @admin_required - Auth error: {error}") # DEBUG LOG
            return jsonify(error), 401
            
        user_role = user.user_metadata.get('role') if user and user.user_metadata else None
        print(f"DEBUG: @admin_required - User role: {user_role}") # DEBUG LOG
        
        if not user or user_role != 'admin':
            print("DEBUG: @admin_required - Admin check failed!") # DEBUG LOG
            return jsonify({"error": "Admin privileges required"}), 403
            
        # Pass user object to the route function if needed
        print("DEBUG: @admin_required - Admin check passed.") # DEBUG LOG
        kwargs['requesting_user'] = user
        return f(*args, **kwargs)
    return decorated_function

# Add a hook to log every incoming request before routing
@app.before_request
def log_request_info():
    print(f"--- BEFORE REQUEST ---")
    print(f"Path: {request.path}")
    print(f"Method: {request.method}")
    print(f"Headers: {request.headers}")


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

# --- Route for Deleting Crew Member ---
# Prefix /api is removed by Vite proxy, so route is just /crew-members/<id>
@app.route('/crew-members/<member_id>', methods=['DELETE'])
@admin_required # Apply the admin check decorator
def remove_crew_member(member_id, requesting_user): # requesting_user is passed by decorator
    """
    Deletes a crew member record and attempts to delete the auth user.
    Requires admin privileges.
    """
    # Ensure service key is available
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return jsonify({"error": "Backend service key not configured"}), 500
        
    admin_supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    try:
        # 1. Get the crew member details, including org_id and user_id
        member_response = admin_supabase.table('crew_members').select('user_id, organization_id').eq('id', member_id).maybe_single().execute()

        if not member_response.data:
            return jsonify({"error": "Crew member not found"}), 404

        member_data = member_response.data
        target_org_id = member_data['organization_id']
        target_user_id = member_data['user_id'] # Auth user ID to delete

        # 2. Verify admin belongs to the same organization
        requesting_user_org_id = requesting_user.user_metadata.get('organization_id')
        if str(requesting_user_org_id) != str(target_org_id): # Compare as strings for safety
             print(f"Authorization failed: Admin org {requesting_user_org_id} != Target org {target_org_id}")
             return jsonify({"error": "Admin not authorized for this organization"}), 403

        # 3. Delete from crew_members table
        delete_crew_response = admin_supabase.table('crew_members').delete().eq('id', member_id).execute()
        # Check for errors if needed, though delete often doesn't error if row not found

        print(f"Deleted crew member record {member_id}")

        # 4. Attempt to delete from auth.users
        auth_deletion_error = None
        if target_user_id:
            try:
                print(f"Attempting to delete auth user {target_user_id}")
                # Use the same admin_supabase client
                auth_response = admin_supabase.auth.admin.delete_user(target_user_id)
                print(f"Auth user {target_user_id} deletion successful.")
            except Exception as auth_error:
                # Check if the error is specifically the 403 we've been seeing
                error_message = str(auth_error)
                if 'Forbidden' in error_message or (hasattr(auth_error, 'status') and auth_error.status == 403):
                     auth_deletion_error = "Forbidden by Supabase (403). Manual deletion might be required."
                else:
                    auth_deletion_error = error_message
                print(f"Failed to delete auth user {target_user_id}: {auth_deletion_error}")
                # Log this error but don't fail the request, as crew member is removed
        else:
             print(f"No associated auth user_id found for crew member {member_id}")


        response_data = {"message": "Crew member removed successfully"}
        if auth_deletion_error:
            response_data["warning"] = f"Auth user deletion failed: {auth_deletion_error}"

        return jsonify(response_data), 200

    except Exception as e:
        print(f"Error removing crew member {member_id}: {e}")
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

# --- Route for Adding Crew Member ---
# Prefix /api is removed by Vite proxy, so route is just /crew-members
@app.route('/crew-members', methods=['POST'])
@admin_required
def add_crew_member(requesting_user):
    """
    Adds a new crew member: creates auth user via invitation and adds to crew_members table.
    Requires admin privileges.
    Expects JSON payload: {"name": "...", "email": "...", "role": "..."}
    """
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    role = data.get('role')

    if not all([name, email, role]):
        return jsonify({"error": "Missing required fields (name, email, role)"}), 400

    admin_org_id = requesting_user.user_metadata.get('organization_id')
    if not admin_org_id:
         return jsonify({"error": "Admin user is missing organization ID in metadata"}), 400

    # Ensure service key is available and initialize client *before* try block
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("CRITICAL: Backend service key not configured in environment.")
        return jsonify({"error": "Backend service key not configured"}), 500
        
    try:
        print("DEBUG: Initializing admin_supabase client...")
        admin_supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("DEBUG: admin_supabase client initialized.")
    except Exception as client_init_error:
        print(f"CRITICAL: Failed to initialize admin_supabase client: {client_init_error}")
        return jsonify({"error": "Failed to initialize backend Supabase client"}), 500

    authUserId = None # Initialize authUserId

    try:
        # 1. Check if email already exists in crew_members for this org
        print("DEBUG: Checking crew_members table...")
        # Removed .maybe_single() - expecting a list response now
        existing_crew_response = admin_supabase.table('crew_members').select('id', count='exact').eq('email', email).eq('organization_id', admin_org_id).limit(1).execute()
        print(f"DEBUG: existing_crew_response type: {type(existing_crew_response)}") # Log type first
        if existing_crew_response is None:
             raise Exception("Supabase client returned None when checking crew_members.")
        # Now log data access attempt
        print(f"DEBUG: Accessing existing_crew_response.data...")
        # Check if the data list is not empty
        if existing_crew_response.data: 
            print(f"DEBUG: Found existing crew member data: {existing_crew_response.data}")
            return jsonify({"error": f"Email {email} already exists in this organization's crew list"}), 409 # Conflict
        else:
             print(f"DEBUG: No existing crew member data found (list is empty).")

        # 2. Check if email exists globally in auth.users (using admin list_users)
        # Note: This prevents adding someone who might exist in another org or as an orphaned user.
        # Adjust this logic if you want different behavior (e.g., linking existing auth users).
        try:
            print("DEBUG: Checking auth.users table (fetching all users)...")
            # Fetch all users and filter manually as 'filter' argument is not supported in this version
            list_users_response = admin_supabase.auth.admin.list_users()
            print(f"DEBUG: list_users_response type: {type(list_users_response)}, users: {'Yes' if getattr(list_users_response, 'users', None) else 'No'}")
            if list_users_response is None:
                 raise Exception("Supabase client returned None when listing auth users.")
            if list_users_response.users:
                 found_global_user = False
                 for user in list_users_response.users:
                      if user.email == email:
                           print(f"DEBUG: Found global user with matching email: {user.id}")
                           found_global_user = True
                           break
                 if found_global_user:
                      return jsonify({"error": f"User with email {email} already exists in the authentication system"}), 409 # Conflict
            print("DEBUG: No global user found with that email.")
        except Exception as list_err:
             # Handle potential errors from list_users itself
             print(f"Warning: Could not definitively check global auth users for {email}: {list_err}")
             # If checking fails, maybe proceed cautiously? Or return error? Let's proceed for now.

        # 3. Invite user via email (creates auth user and sends invite)
        print(f"DEBUG: Inviting user {email}...")
        invite_response = admin_supabase.auth.admin.invite_user_by_email(
            email,
            options={
                'data': {
                    'role': role,
                    'organization_id': admin_org_id,
                    'name': name
                },
                # Changed default port to 5173
                'redirect_to': f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/set-password" 
            }
        )
        print(f"DEBUG: invite_response type: {type(invite_response)}, user: {'Yes' if getattr(invite_response, 'user', None) else 'No'}")
        # Add explicit check for None response
        if invite_response is None:
             raise Exception("Supabase client returned None when inviting user.")
        if not invite_response.user:
             # Attempt to parse potential error from the response if possible
             error_detail = "Unknown error during invitation"
             if hasattr(invite_response, 'error') and invite_response.error:
                 error_detail = str(invite_response.error)
             elif hasattr(invite_response, 'message'):
                 error_detail = invite_response.message
             raise Exception(f"Failed to invite user: {error_detail}")

        new_auth_user = invite_response.user
        authUserId = new_auth_user.id # Assign authUserId here
        print(f"Auth user created/invited with ID: {authUserId}")

        # 4. Insert into crew_members table
        print(f"DEBUG: Inserting into crew_members table for user {authUserId}...")
        # Correct syntax: execute insert, then optionally select the inserted row
        insert_payload = {
            'name': name,
            'email': email,
            'role': role,
            'organization_id': admin_org_id,
            'user_id': authUserId # Link to the newly created auth user
        }
        # Execute the insert operation. By default, it returns the inserted data with 'return=representation'
        insert_response = admin_supabase.table('crew_members').insert(insert_payload).execute() 
        
        print(f"DEBUG: insert_response type: {type(insert_response)}") # Log type
        if insert_response is None:
             raise Exception("Supabase client returned None when inserting into crew_members.")
             
        print(f"DEBUG: Accessing insert_response.data...")
        if not insert_response.data:
             print(f"CRITICAL ERROR: Auth user {authUserId} created but failed to insert into crew_members. Response: {insert_response}")
             # Consider attempting to delete the auth user here if insert fails
             # admin_supabase.auth.admin.delete_user(new_auth_user.id) # Be cautious with auto-cleanup
             raise Exception("Failed to insert crew member record after user invitation (no data returned).")

        # Assuming insert_response.data contains the inserted row (list with one dict)
        inserted_data = insert_response.data[0] 
        print(f"Successfully added {email} to crew_members for org {admin_org_id}")
        return jsonify(inserted_data), 201 # Return the created crew member record

    except Exception as e:
        # Log the detailed error
        print(f"Error adding crew member {email}: {e}")
        # Provide a generic error to the client
        error_message = str(e)
        status_code = 500
        # Check for specific Supabase error structures if available
        if "409" in error_message or "duplicate key value violates unique constraint" in error_message.lower():
            status_code = 409 # Conflict
            error_message = "A conflict occurred. The email might already exist."
        elif "403" in error_message or "Forbidden" in error_message:
             status_code = 403
             error_message = "Operation forbidden. Check backend permissions or Supabase configuration."

        return jsonify({"error": f"Failed to add crew member: {error_message}"}), status_code


if __name__ == '__main__':
    # Bind to 0.0.0.0 to listen on all interfaces (including localhost and 127.0.0.1)
    app.run(host='0.0.0.0', debug=True, port=8080) # Changed port to 8080
