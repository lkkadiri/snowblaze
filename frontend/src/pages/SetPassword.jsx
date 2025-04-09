import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

function SetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  // const location = useLocation(); // No longer needed for manual parsing

  // Use onAuthStateChange to detect the session after redirect
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      // This listener triggers when the component mounts and Supabase detects
      // session info in the URL fragment (#access_token=...)
      if (event === 'SIGNED_IN') {
        // Session is automatically handled by the Supabase client library
        console.log('Session established via onAuthStateChange');
        setError(''); // Clear any potential initial error
      } else if (event === 'PASSWORD_RECOVERY') {
        // This event might also be triggered depending on the flow
        console.log('Password recovery event detected');
        setError(''); 
      } else if (event === 'SIGNED_OUT') {
        // If somehow signed out, redirect
        navigate('/login');
      }
      // We don't necessarily need to check for !session here, 
      // as the updateUser call later will fail if not authenticated.
      // If no SIGNED_IN event occurs after redirect, updateUser will likely fail.
    });

    // Check initial session state in case the listener doesn't fire immediately
    // or if the user navigates directly to the page with an existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // If there's no session shortly after load, and onAuthStateChange didn't sign in,
        // it implies the token was invalid or missing from the URL fragment.
        // We might set an error here, but let's rely on the updateUser failure for now.
        console.log('No initial session found.');
      }
    });

    // Cleanup listener on unmount
    return () => {
      // The unsubscribe function is nested in the returned data object
      authListener?.data?.subscription?.unsubscribe();
    };
  }, [navigate]);

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate passwords
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      // The onAuthStateChange listener should have established the session.
      // If not, this updateUser call will fail with an auth error.
      const { data: { user }, error: sessionError } = await supabase.auth.getUser();

      if (sessionError || !user) {
        throw new Error('Authentication error. Please try the link again or request a new one.');
      }

      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Set Your Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Create a secure password for your Snowblaze account
          </p>
        </div>

        {success ? (
          <div className="bg-green-100 p-4 rounded-md">
            <p className="text-green-700 text-center">
              Password set successfully! Redirecting to login page...
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSetPassword}>
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label htmlFor="password" className="sr-only">
                  New Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="New Password (min 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength="8"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="sr-only">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {loading ? 'Setting Password...' : 'Set Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default SetPassword;
