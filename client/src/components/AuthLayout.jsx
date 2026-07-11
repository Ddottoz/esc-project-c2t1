import Logo from './Logo.jsx';

// Two-panel auth card. `reversed` mirrors the layout (form on the left,
// red panel on the right) for the Sign Up page.
export default function AuthLayout({ side, children, reversed = false }) {
  return (
    <div className="auth-page">
      <div className={`auth-card${reversed ? ' reversed' : ''}`}>
        <div className="logo-corner">
          <Logo />
        </div>
        {side}
        <div className="form-panel">{children}</div>
      </div>
    </div>
  );
}
