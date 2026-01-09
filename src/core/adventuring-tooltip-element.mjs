/**
 * AdventuringTooltipElement - Base class for Adventuring custom elements with tooltips
 * 
 * Provides:
 * - Automatic tooltip lifecycle management
 * - Common mount() method
 * - Standardized tooltip content setting
 * 
 * Subclasses should:
 * 1. Call super() in constructor
 * 2. Set this._tooltipTarget to the element that should have the tooltip
 * 3. Call super.connectedCallback() after appending content
 * 4. Call super.disconnectedCallback() to clean up tooltip
 */

/**
 * Factory function to create a tippy tooltip with common defaults
 * @param {HTMLElement} target - Element to attach tooltip to
 * @param {string} [content=''] - Initial tooltip content
 * @param {Object} [options={}] - Additional tippy options
 * @returns {Object} Tippy instance
 */
export function createTooltip(target, content = '', options = {}) {
    return tippy(target, {
        content,
        allowHTML: true,
        hideOnClick: false,
        ...options
    });
}

/**
 * Base class for Adventuring custom elements with tooltip support
 */
export class AdventuringTooltipElement extends HTMLElement {
    constructor() {
        super();
        this._tooltipTarget = null;
        this._tooltipOptions = {};
        this._pendingTooltipContent = null;
    }

    /**
     * Called when element is added to DOM
     * Creates tooltip if _tooltipTarget is set
     * Subclasses should call super.connectedCallback() after appending content
     */
    connectedCallback() {
        if (this._tooltipTarget) {
            this.tooltip = createTooltip(this._tooltipTarget, '', this._tooltipOptions);
            // Apply any pending content that was set before connection
            if (this._pendingTooltipContent !== null) {
                this.tooltip.setContent(this._pendingTooltipContent);
                this._pendingTooltipContent = null;
            }
        }
    }

    /**
     * Called when element is removed from DOM
     * Destroys tooltip to prevent memory leaks
     * Subclasses should call super.disconnectedCallback()
     */
    disconnectedCallback() {
        if (this.tooltip !== undefined) {
            this.tooltip.destroy();
            this.tooltip = undefined;
        }
    }

    /**
     * Update the tooltip content
     * @param {string} content - HTML content for tooltip
     */
    setTooltipContent(content) {
        if (this.tooltip) {
            this.tooltip.setContent(content);
        } else {
            // Store for when tooltip is created in connectedCallback
            this._pendingTooltipContent = content;
        }
    }

    /**
     * Clear the tooltip content (for pooling)
     */
    clearTooltip() {
        if (this.tooltip) {
            this.tooltip.setContent('');
        }
        this._pendingTooltipContent = null;
    }

    /**
     * Mount element to a parent
     * @param {HTMLElement} parent - Parent element to append to
     */
    mount(parent) {
        parent.appendChild(this);
    }
}
