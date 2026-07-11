import { Link } from 'react-router-dom';

// The red panel: heading, subtitle, and an outline pill button that
// navigates to the other auth page.
export default function SidePanel({ heading, subtitle, buttonLabel, to }) {
  return (
    <div className="side-panel">
      <h2 className="side-heading">{heading}</h2>
      <p className="side-subtitle">{subtitle}</p>
      <Link to={to} className="side-button">{buttonLabel}</Link>
    </div>
  );
}
