import "./Button.css";

const Button = ({ id, onClick, label, disabled = false }) => {
    return (
        <button
            id={id}
            onClick={onClick}
            className="button"
            {...(disabled ? { disabled: true } : {})}
        >
            {label}
        </button>
    );
};

export default Button;