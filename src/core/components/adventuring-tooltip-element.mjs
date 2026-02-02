

export function createTooltip(target, content = '', options = {}) {
    const isTriggerClick = options.trigger === 'click';
    return tippy(target, {
        content,
        allowHTML: true,
        hideOnClick: isTriggerClick ? true : false,
        ...options
    });
}

export class AdventuringTooltipElement extends HTMLElement {
    constructor() {
        super();
        this._tooltipTarget = null;
        this._tooltipOptions = {};
        this._pendingTooltipContent = null;
    }

    connectedCallback() {
        if (this._tooltipTarget) {
            this.tooltip = createTooltip(this._tooltipTarget, '', this._tooltipOptions);

            if (this._pendingTooltipContent !== null) {
                this.tooltip.setContent(this._pendingTooltipContent);
                this._pendingTooltipContent = null;
            }
        }
    }

    disconnectedCallback() {
        if (this.tooltip !== undefined) {
            this.tooltip.destroy();
            this.tooltip = undefined;
        }
    }

    setTooltipContent(content) {
        if (this.tooltip) {
            this.tooltip.setContent(content);
        } else {

            this._pendingTooltipContent = content;
        }
    }

    clearTooltip() {
        if (this.tooltip) {
            this.tooltip.setContent('');
        }
        this._pendingTooltipContent = null;
    }

    mount(parent) {
        parent.appendChild(this);
    }
}
