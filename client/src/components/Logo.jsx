import logoUrl from '../assets/das-logo.png';

// Official DAS (Dyslexia Association of Singapore) logo.
export default function Logo({ size = 56 }) {
  return (
    <img
      className="das-logo"
      src={logoUrl}
      width={size}
      style={{ height: 'auto' }}
      alt="DAS — Dyslexia Association of Singapore"
    />
  );
}
