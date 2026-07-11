import { useNavigate } from 'react-router-dom';
import { getUser, clearSession } from '../api.js';

// Minimal placeholder landing after auth succeeds — proves the flow works.
// Replace with a real dashboard in a later phase.
export default function Welcome() {
  const navigate = useNavigate();
  const user = getUser();

  function handleLogout() {
    clearSession();
    navigate('/login');
  }

  return (
    <div className="auth-page">
      <div className="welcome-card">
        <h1 className="form-title">Welcome{user ? `, ${user.name}` : ''}</h1>
        <p className="form-subtitle">
          {user ? `Signed in as ${user.email} (${user.role})` : 'You are signed in.'}
        </p>
        <button className="submit-button" onClick={handleLogout}>Log out</button>
      </div>
    </div>
  );
}
