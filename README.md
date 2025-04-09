# Snowblaze Crew Management System

A system for managing snow removal crews, tracking their locations, and organizing work assignments.

## Project Structure

- **frontend/**: React application for the user interface
- **backend/**: Flask API for server-side operations
- **supabase_schema.sql**: Database schema for Supabase

## Setup Instructions

### Frontend

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on `.env.example` with your Supabase credentials.

4. Start the development server:
   ```
   npm run dev
   ```

### Backend

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Create a `.env` file based on `.env.example` with your Supabase credentials.

5. Start the Flask server:
   ```
   flask run
   ```

### Database

1. Run the `supabase_reset_schema.sql` script in your Supabase SQL Editor to set up the database schema.

## Features

- **User Authentication**: Sign up, login, and password management
- **Organization Management**: Create and manage organizations
- **Crew Management**: Add, remove, and manage crew members
- **Location Tracking**: Track crew member locations in real-time
- **Role-Based Access Control**: Different permissions for admins, supervisors, drivers, and crew members

## Recent Updates

- Fixed infinite recursion issue in Supabase RLS policies
- Added password setup flow for new crew members
- Implemented backend API for user deletion
- Improved error handling for user management operations

## Troubleshooting

### User Deletion Issues

If you encounter issues with user deletion:

1. Make sure the backend server is running:
   ```
   cd backend
   flask run
   ```

2. Verify that the `SUPABASE_SERVICE_ROLE_KEY` is correctly set in `backend/.env`

3. Run the test script to diagnose the issue:
   ```
   cd backend
   python test_user_deletion.py
   ```
   (Remember to replace the placeholder user ID in the script with an actual user ID)

4. Check the Supabase dashboard for any restrictions on user management

Note: The frontend will still remove crew members from the organization even if the backend API fails to delete the user from Supabase Auth. This ensures that admins can still manage their organization's crew members.
