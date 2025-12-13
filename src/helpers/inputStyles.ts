/**
 * Utility function to get border styling classes for form inputs
 * based on their current state (dirty, saving, focused, etc.)
 * 
 * @param options.savePulse - True when save animation is active
 * @param options.isDirty - True when field has unsaved changes
 * @param options.isFocused - True when field is focused
 * @returns Tailwind CSS classes for border styling
 */
export function getInputBorderClasses(options: {
    savePulse?: boolean;
    isDirty?: boolean;
    isFocused?: boolean;
}): string {
    const { savePulse, isDirty, isFocused } = options;

    if (savePulse) {
        // Bright vivid green on save (pulse effect)
        return "border-green-400 ring-2 ring-green-400/40";
    }

    if (isDirty) {
        // Subtle transparent green while editing
        return "border-green-500/40 ring-1 ring-green-500/10";
    }

    if (isFocused) {
        // Accent color when focused
        return "border-accent ring-2 ring-accent/20";
    }

    // Default state
    return "border-secondary-20";
}
