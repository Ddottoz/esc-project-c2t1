import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Lock } from 'lucide-react';
import AuthLayout from '../components/AuthLayout.jsx';
import SidePanel from '../components/SidePanel.jsx';
import InputField from '../components/InputField.jsx';
import { signup, saveSession } from '../api.js';

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  function validate() {
    if (!form.name || !form.email || !form.password || !form.confirmPassword) {
      return 'All fields are required';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return 'Please enter a valid email address';
    }
    if (form.password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (form.password !== form.confirmPassword) {
      return 'Passwords do not match';
    }
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await signup(
        form.name,
        form.email,
        form.password,
        form.confirmPassword
      );
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
      heading="Have an account?"
      subtitle="Sign in to your account"
      buttonLabel="Login"
      to="/login"
    />
  );

  return (
    <AuthLayout side={side} reversed>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <h1 className="form-title">Sign Up</h1>
        <p className="form-subtitle">Enter your details below</p>

        <InputField
          icon={User}
          type="text"
          name="name"
          placeholder="Name"
          value={form.name}
          onChange={update}
          autoComplete="name"
        />
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
          autoComplete="new-password"
        />
        <InputField
          icon={Lock}
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          value={form.confirmPassword}
          onChange={update}
          autoComplete="new-password"
        />

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? 'Creating account…' : 'Sign Up'}
        </button>
      </form>
    </AuthLayout>
  );
}
