import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get Supabase credentials
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# User ID to delete (replace with an actual user ID to test)
user_id = "REPLACE_WITH_USER_ID"

print(f"Testing user deletion for user ID: {user_id}")
print(f"Using Supabase URL: {url}")
print(f"Using service role key: {key[:10]}...")  # Only show the first 10 characters for security

# Method 1: Using the REST API directly
try:
    print("\nMethod 1: Using REST API directly")
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}'
    }
    
    # First, try to get the user to verify they exist
    get_response = requests.get(
        f"{url}/auth/admin/users/{user_id}",
        headers=headers
    )
    
    print(f"Get user response: {get_response.status_code}")
    if get_response.status_code == 200:
        print("User exists, proceeding with deletion")
    else:
        print(f"User not found: {get_response.text}")
    
    # Try to delete the user
    delete_response = requests.delete(
        f"{url}/auth/admin/users/{user_id}",
        headers=headers
    )
    
    print(f"Delete user response: {delete_response.status_code}")
    print(f"Response body: {delete_response.text}")
except Exception as e:
    print(f"Error with REST API method: {e}")

# Method 2: Using the Flask API
try:
    print("\nMethod 2: Using Flask API")
    flask_response = requests.delete(
        f"http://localhost:5000/api/users/delete/{user_id}",
        headers={
            'Content-Type': 'application/json'
        }
    )
    
    print(f"Flask API response: {flask_response.status_code}")
    print(f"Response body: {flask_response.text}")
except Exception as e:
    print(f"Error with Flask API method: {e}")

print("\nTest complete")
