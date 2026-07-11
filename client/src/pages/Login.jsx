import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import AuthLayout from '../components/AuthLayout.jsx';
import SidePanel from '../components/SidePanel.jsx';
import InputField from '../components/InputField.jsx';
import { login, saveSession } from '../api.js';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) {
      setError('Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const data = await login(form.email, form.password);
      saveSession(data);
      navigate('/welcome');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const side = (
    <SidePanel
      heading="New Here?"
      subtitle="Register to create an account"
      buttonLabel="Sign Up"
      to="/signup"
    />
  );

  return (
    <AuthLayout side={side}>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <h1 className="form-title">Login</h1>
        <p className="form-subtitle">Enter your details below</p>

        <InputField
          icon={Mail}
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={update}
          autoComplete="email"
        />
        <InputField
          icon={Lock}
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={update}
          autoComplete="current-password"
        />

        <Link to="/login" className="forgot-link">Forgot Password?</Link>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </AuthLayout>
  );
}
