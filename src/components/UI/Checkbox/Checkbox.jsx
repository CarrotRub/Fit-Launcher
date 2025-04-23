import "./Checkbox.css";

const Checkbox = ({ label, checked, onChange }) => {
    return (
        <li className="popup-item-options">
            <label className="custom-checkbox">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <span className="checkbox-mark"></span>
                {label}
            </label>
        </li>
    );
};

export default Checkbox;