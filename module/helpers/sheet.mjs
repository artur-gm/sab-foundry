/**
 * Clamps a value between a minimum and maximum.
 *
 * @param {number} value The value to clamp.
 * @param {number} [min=0] The minimum value (default is 0).
 * @param {number} [limit=18] The maximum value (default is 18).
 * @returns {number} The clamped value.
 */
export function clampValue(value, min = 0, limit = 18) {
  return Math.clamp(value, min, limit);
}

/**
 * Clamps both value and max for an attribute.
 *
 * @param {number} value The current value of the attribute.
 * @param {number} max The maximum value of the attribute.
 * @param {number} [min=0] The minimum value (default is 0).
 * @param {number} [limit=18] The upper limit (default is 18).
 * @returns {object} An object containing the clamped value and max.
 */
export function clampAttribute(value, max, min = 0, limit = 18) {
  return {
    value: clampValue(value, min, limit),
    max: clampValue(max, min, limit)
  };
}
