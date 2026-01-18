/**
 * Safe number utilities to prevent NaN and Infinity values.
 */

/**
 * Ensure a value is a valid number, with a default fallback.
 * @param {*} value - The value to check
 * @param {number} defaultValue - Default value if invalid (defaults to 0)
 * @returns {number} A valid number
 */
export function safeNumber(value, defaultValue = 0) {
    if (typeof value === 'number' && isFinite(value)) {
        return value;
    }
    return defaultValue;
}

/**
 * Perform a safe division, returning defaultValue if denominator is 0.
 * @param {number} numerator
 * @param {number} denominator
 * @param {number} defaultValue - Default value if division would result in NaN/Infinity
 * @returns {number}
 */
export function safeDivide(numerator, denominator, defaultValue = 0) {
    if (denominator === 0 || !isFinite(denominator)) {
        return defaultValue;
    }
    const result = numerator / denominator;
    return isFinite(result) ? result : defaultValue;
}

/**
 * Safely perform math operations that could result in NaN.
 * @param {Function} fn - The math operation to perform
 * @param {number} defaultValue - Default value if result is invalid
 * @returns {number}
 */
export function safeMath(fn, defaultValue = 0) {
    try {
        const result = fn();
        return safeNumber(result, defaultValue);
    } catch (e) {
        return defaultValue;
    }
}

/**
 * Clamp a value between min and max, ensuring valid numbers.
 * @param {number} value - The value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number}
 */
export function safeClamp(value, min, max) {
    const safeVal = safeNumber(value, min);
    const safeMin = safeNumber(min, 0);
    const safeMax = safeNumber(max, safeMin);
    return Math.max(safeMin, Math.min(safeMax, safeVal));
}

/**
 * Calculate a percentage safely.
 * @param {number} part - The part
 * @param {number} whole - The whole
 * @param {number} defaultValue - Default if whole is 0
 * @returns {number} Percentage (0-100)
 */
export function safePercent(part, whole, defaultValue = 0) {
    return safeDivide(part * 100, whole, defaultValue);
}

/**
 * Floor a number safely.
 * @param {number} value
 * @param {number} defaultValue
 * @returns {number}
 */
export function safeFloor(value, defaultValue = 0) {
    return Math.floor(safeNumber(value, defaultValue));
}

/**
 * Round a number safely.
 * @param {number} value
 * @param {number} defaultValue
 * @returns {number}
 */
export function safeRound(value, defaultValue = 0) {
    return Math.round(safeNumber(value, defaultValue));
}

/**
 * Ceil a number safely.
 * @param {number} value
 * @param {number} defaultValue
 * @returns {number}
 */
export function safeCeil(value, defaultValue = 0) {
    return Math.ceil(safeNumber(value, defaultValue));
}
