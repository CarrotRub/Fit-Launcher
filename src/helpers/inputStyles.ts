/**
 * Utility function to get border styling classes for form inputs
 * based on their current state (dirty, saving, focused, etc.)
 * 
 * Uses the theme's --color-success CSS variable for consistency
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
        // Bright vivid success color on save (pulse effect)
        return "border-success ring-2 ring-success/40";
    }

    if (isDirty) {
        // Subtle transparent success color while editing
        return "border-success/40 ring-1 ring-success/10";
    }

    if (isFocused) {
        // Accent color when focused
        return "border-accent ring-2 ring-accent/20";
    }

    // Default state
    return "border-secondary-20";
}
