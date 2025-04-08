# Snowblaze - Snow Ploughing Route Management System

## Overview
Snowblaze is a comprehensive crew and route management application for snow ploughing organizations, providing real-time crew tracking and organizational management.

## Technologies
- Frontend: React, Vite, Tailwind CSS
- Backend: Python, Flask
- Database: Supabase
- Maps: Google Maps React

## Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- Supabase Account
- Google Maps API Key

## Setup

### Frontend Setup
1. Navigate to frontend directory
2. Install dependencies:
   ```
   npm install
   ```
3. Create `.env` file with:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```
4. Run development server:
   ```
   npm run dev
   ```

### Backend Setup
1. Navigate to backend directory
2. Create virtual environment:
   ```
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Create `.env` file with:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_service_role_key
   ```
5. Run Flask server:
   ```
   python app.py
   ```

## Supabase Database Schema

### Tables
1. `organizations`
   - `id`: UUID (Primary Key)
   - `name`: Text
   - `created_at`: Timestamp

2. `crew_members`
   - `id`: UUID (Primary Key)
   - `name`: Text
   - `email`: Text
   - `role`: Text (crew, driver, supervisor)
   - `organization_id`: UUID (Foreign Key to organizations)
   - `user_id`: UUID (Supabase Auth User ID)

3. `crew_locations`
   - `id`: UUID (Primary Key)
   - `crew_member_id`: UUID (Foreign Key to crew_members)
   - `latitude`: Numeric
   - `longitude`: Numeric
   - `timestamp`: Timestamp

## Features
- User Authentication
- Organization Management
- Crew Member Management
- Real-time Crew Location Tracking
- Role-based Access Control

## Deployment
- Frontend: Vercel/Netlify
- Backend: Heroku/Railway
- Database: Supabase

## License
MIT License
