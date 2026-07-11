export default function InputField({ icon: Icon, ...props }) {
  return (
    <div className="input-field">
      {Icon && <Icon className="input-icon" size={20} aria-hidden="true" />}
      <input className="input-control" {...props} />
    </div>
  );
}
