from flask import Blueprint, request, jsonify
import os
from supabase import create_client, Client

# Initialize Supabase client with admin privileges
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")  # Use service role key for admin operations
supabase: Client = create_client(url, key)

users_bp = Blueprint('users', __name__)

# Create an empty __init__.py file in the routes directory to make it a proper package
with open(os.path.join(os.path.dirname(__file__), '__init__.py'), 'w') as f:
    pass

# Removed the unused check_user_email endpoint

@users_bp.route('/delete/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    """
    Delete a user from Supabase Auth
    This requires admin privileges and can only be done from the backend
    """
    try:
        # Log the request for debugging
        print(f"Attempting to delete user with ID: {user_id}")
        
        # Check if the user exists first
        try:
            user_data = supabase.auth.admin.get_user(user_id)
            print(f"User found: {user_data}")
        except Exception as user_error:
            print(f"Error getting user: {user_error}")
            return jsonify({
                'success': False,
                'message': f"User not found: {str(user_error)}"
            }), 404
        
        # Try to delete the user from Supabase Auth using the Python client library
        try:
            # Explicitly create a new client instance with the service role key for this operation
            admin_supabase: Client = create_client(url, key)
            response = admin_supabase.auth.admin.delete_user(user_id)
            # The delete_user function doesn't return much on success, 
            # but will raise an exception on failure.
            print(f"User {user_id} deletion attempted via client library.")
            
            # Assuming no exception means success
            return jsonify({
                'success': True,
                'message': f'User {user_id} deleted successfully'
            }), 200
        except Exception as delete_error:
            print(f"Error deleting user via client library: {delete_error}")
            # Re-raise the error to be caught by the outer try-except block
            raise delete_error

    except Exception as e:
        # Handle potential exceptions from get_user or delete_user
        print(f"Error during user deletion process for {user_id}: {e}")
        return jsonify({
            'success': False,
            'message': f"Unexpected error: {str(e)}"
        }), 500
