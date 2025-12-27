export class AdventuringTutorialTooltipElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-tutorial-tooltip-template'));

        this.overlay = getElementFromFragment(this._content, 'overlay', 'div');
        this.highlight = getElementFromFragment(this._content, 'highlight', 'div');
        this.clickBlocker = getElementFromFragment(this._content, 'click-blocker', 'div');
        this.tooltip = getElementFromFragment(this._content, 'tooltip', 'div');
        this.arrow = getElementFromFragment(this._content, 'arrow', 'div');
        this.message = getElementFromFragment(this._content, 'message', 'div');
        this.okayBtn = getElementFromFragment(this._content, 'okay-btn', 'button');
        this.skipBtn = getElementFromFragment(this._content, 'skip-btn', 'a');
        this.skipAllBtn = getElementFromFragment(this._content, 'skip-all-btn', 'a');

        this.manager = null;
        this._visible = false;
        this._currentTarget = null;
        this._resizeObserver = null;
        this._scrollHandler = null;
    }

    connectedCallback() {
        this.appendChild(this._content);

        // Click blocker prevents clicks but allows hover events through
        this.clickBlocker.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, true);

        // Okay button handler (for informational steps)
        this.okayBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if(this.manager) this.manager.advanceStep();
        };

        // Skip button handlers
        this.skipBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if(this.manager) this.manager.skipTutorial();
        };

        this.skipAllBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if(this.manager) this.manager.setSkipAll(true);
        };

        // Handle window resize
        this._resizeObserver = new ResizeObserver(() => {
            if(this._visible && this._currentTarget) {
                this.updatePosition();
            }
        });
        this._resizeObserver.observe(document.body);

        // Handle scroll
        this._scrollHandler = () => {
            if(this._visible && this._currentTarget) {
                this.updatePosition();
            }
        };
        window.addEventListener('scroll', this._scrollHandler, true);

        // Initially hidden
        this.overlay.classList.add('d-none');
    }

    disconnectedCallback() {
        if(this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if(this._scrollHandler) {
            window.removeEventListener('scroll', this._scrollHandler, true);
            this._scrollHandler = null;
        }
        if(this._renderWaitTimeout) {
            clearTimeout(this._renderWaitTimeout);
            this._renderWaitTimeout = null;
        }
    }

    /**
     * Show the tutorial tooltip pointing at a target element
     * @param {HTMLElement} targetElement - Element to highlight (null for informational-only)
     * @param {string} messageText - Message to display
     * @param {string} preferredPosition - 'top', 'bottom', 'left', 'right'
     * @param {boolean} isInformational - If true, show Okay button and block all clicks
     */
    show(targetElement, messageText, preferredPosition = 'bottom', isInformational = false) {
        this._currentTarget = targetElement;
        this._preferredPosition = preferredPosition;
        this._visible = true;
        this._isInformational = isInformational;

        // Set message
        this.message.textContent = messageText;

        // Show/hide Okay button based on step type
        if(isInformational) {
            this.okayBtn.classList.remove('d-none');
        } else {
            this.okayBtn.classList.add('d-none');
        }

        // Show overlay
        this.overlay.classList.remove('d-none');

        // Position everything
        this.updatePosition();

        // Scroll target into view if needed
        if(targetElement) {
            this.scrollTargetIntoView(targetElement);
        }
    }

    /**
     * Hide the tutorial tooltip
     */
    hide() {
        this._visible = false;
        this._currentTarget = null;
        this._isInformational = false;
        this.overlay.classList.add('d-none');
        this.okayBtn.classList.add('d-none');
        this.clickBlocker.classList.add('d-none');
        this.highlight.style.display = '';
        this.overlay.style.clipPath = '';
        if(this._renderWaitTimeout) {
            clearTimeout(this._renderWaitTimeout);
            this._renderWaitTimeout = null;
        }
    }

    /**
     * Update positions based on current target location
     */
    updatePosition() {
        if(!this._visible) return;

        // For informational steps with no target, center the tooltip
        if(!this._currentTarget) {
            // Block all clicks - full overlay, no hole
            this.overlay.style.clipPath = 'none';
            this.highlight.style.display = 'none';
            
            // Center tooltip on screen
            this.tooltip.style.left = '0';
            this.tooltip.style.top = '0';
            const tooltipRect = this.tooltip.getBoundingClientRect();
            this.centerOnScreen(tooltipRect);
            return;
        }

        // Show highlight
        this.highlight.style.display = '';

        // For elements with display:contents, get the first child's rect instead
        var targetForRect = this._currentTarget;
        var targetRect = targetForRect.getBoundingClientRect();
        
        // If element has no size (likely display:contents), try first child
        if(targetRect.width === 0 && targetRect.height === 0 && this._currentTarget.firstElementChild) {
            targetForRect = this._currentTarget.firstElementChild;
            targetRect = targetForRect.getBoundingClientRect();
        }
        
        // If still no size, wait for render
        if(targetRect.width === 0 && targetRect.height === 0) {
            this._waitForRender();
            return;
        }
        
        // Position highlight over target
        this.positionHighlight(targetRect);

        // Position tooltip near target with auto-adjustment
        this.positionTooltip(targetRect, this._preferredPosition);
    }

    /**
     * Wait for element to render before positioning
     */
    _waitForRender() {
        if(this._renderWaitTimeout) {
            clearTimeout(this._renderWaitTimeout);
        }
        this._renderWaitTimeout = setTimeout(() => {
            this._renderWaitTimeout = null;
            this.updatePosition();
        }, 50);
    }

    /**
     * Position the highlight box and update overlay clip-path to create clickable hole
     */
    positionHighlight(targetRect) {
        const padding = 4;
        const left = targetRect.left - padding;
        const top = targetRect.top - padding;
        const width = targetRect.width + padding * 2;
        const height = targetRect.height + padding * 2;
        
        // Position highlight (visual ring)
        this.highlight.style.left = `${left}px`;
        this.highlight.style.top = `${top}px`;
        this.highlight.style.width = `${width}px`;
        this.highlight.style.height = `${height}px`;
        
        // Update overlay clip-path to create a hole (both informational and interactive)
        // polygon draws the outer rectangle, then an inner rectangle (the hole)
        const right = left + width;
        const bottom = top + height;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        
        // Create clip-path with hole using polygon
        // Outer box (full screen), then inner box (hole) drawn in reverse
        this.overlay.style.clipPath = `polygon(
            0 0, ${vw}px 0, ${vw}px ${vh}px, 0 ${vh}px, 0 0,
            ${left}px ${top}px, ${left}px ${bottom}px, ${right}px ${bottom}px, ${right}px ${top}px, ${left}px ${top}px
        )`;
        
        // For informational steps, show click blocker over the hole to block clicks but allow hover
        if(this._isInformational) {
            this.clickBlocker.classList.remove('d-none');
            this.clickBlocker.style.left = `${left}px`;
            this.clickBlocker.style.top = `${top}px`;
            this.clickBlocker.style.width = `${width}px`;
            this.clickBlocker.style.height = `${height}px`;
        } else {
            this.clickBlocker.classList.add('d-none');
        }
    }

    /**
     * Position tooltip with auto-adjustment if it would go off-screen
     */
    positionTooltip(targetRect, preferredPosition) {
        const padding = 12;
        const arrowSize = 10;

        // Reset position to measure
        this.tooltip.style.left = '0';
        this.tooltip.style.top = '0';
        const tooltipRect = this.tooltip.getBoundingClientRect();

        // Try positions in order of preference
        const positions = this.getPositionOrder(preferredPosition);

        for(const pos of positions) {
            const coords = this.calculatePosition(targetRect, tooltipRect, pos, padding, arrowSize);
            if(this.fitsInViewport(coords, tooltipRect)) {
                this.applyPosition(coords, pos);
                return;
            }
        }

        // Fallback: position at center of viewport
        this.centerOnScreen(tooltipRect);
    }

    /**
     * Get position order starting with preferred
     */
    getPositionOrder(preferred) {
        const all = ['bottom', 'top', 'right', 'left'];
        return [preferred, ...all.filter(p => p !== preferred)];
    }

    /**
     * Calculate tooltip position for a given placement
     */
    calculatePosition(target, tooltip, position, padding, arrow) {
        let x, y;

        switch(position) {
            case 'bottom':
                x = target.left + (target.width / 2) - (tooltip.width / 2);
                y = target.bottom + padding + arrow;
                break;
            case 'top':
                x = target.left + (target.width / 2) - (tooltip.width / 2);
                y = target.top - tooltip.height - padding - arrow;
                break;
            case 'right':
                x = target.right + padding + arrow;
                y = target.top + (target.height / 2) - (tooltip.height / 2);
                break;
            case 'left':
                x = target.left - tooltip.width - padding - arrow;
                y = target.top + (target.height / 2) - (tooltip.height / 2);
                break;
        }

        return { x, y };
    }

    /**
     * Check if tooltip fits in viewport at given coordinates
     */
    fitsInViewport(coords, tooltipRect) {
        const margin = 10;
        return coords.x >= margin &&
               coords.y >= margin &&
               coords.x + tooltipRect.width <= window.innerWidth - margin &&
               coords.y + tooltipRect.height <= window.innerHeight - margin;
    }

    /**
     * Apply position and update arrow
     */
    applyPosition(coords, position) {
        this.tooltip.style.left = `${coords.x}px`;
        this.tooltip.style.top = `${coords.y}px`;

        // Update arrow direction
        this.arrow.className = `tutorial-arrow tutorial-arrow-${position}`;
    }

    /**
     * Center tooltip on screen (fallback)
     */
    centerOnScreen(tooltipRect) {
        const x = (window.innerWidth - tooltipRect.width) / 2;
        const y = (window.innerHeight - tooltipRect.height) / 2;
        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.top = `${y}px`;
        this.arrow.className = 'tutorial-arrow d-none';
    }

    /**
     * Scroll target into view if not visible
     */
    scrollTargetIntoView(element) {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.top >= 0 &&
                         rect.left >= 0 &&
                         rect.bottom <= window.innerHeight &&
                         rect.right <= window.innerWidth;

        if(!isVisible) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Re-position after scroll completes
            setTimeout(() => this.updatePosition(), 300);
        }
    }
}

window.customElements.define('adventuring-tutorial-tooltip', AdventuringTutorialTooltipElement);
