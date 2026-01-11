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
        this.nextBtn = getElementFromFragment(this._content, 'next-btn', 'button');
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
        this.clickBlocker.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, true);
        this.nextBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if(this.manager) this.manager.advanceStep();
        };
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
        this._resizeObserver = new ResizeObserver(() => {
            if(this._visible && this._currentTarget) {
                this.updatePosition();
            }
        });
        this._resizeObserver.observe(document.body);
        this._scrollHandler = () => {
            if(this._visible && this._currentTarget) {
                this.updatePosition();
            }
        };
        window.addEventListener('scroll', this._scrollHandler, true);
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

    show(targetElement, messageText, preferredPosition = 'bottom') {
        this._currentTarget = targetElement;
        this._preferredPosition = preferredPosition;
        this._visible = true;
        this.message.textContent = messageText;
        this.overlay.classList.remove('d-none');
        this.updatePosition();
        if(targetElement) {
            this.scrollTargetIntoView(targetElement);
        }
    }

    hide() {
        this._visible = false;
        this._currentTarget = null;
        this.overlay.classList.add('d-none');
        this.highlight.style.display = '';
        this.overlay.style.clipPath = '';
        if(this._renderWaitTimeout) {
            clearTimeout(this._renderWaitTimeout);
            this._renderWaitTimeout = null;
        }
    }

    updatePosition() {
        if(!this._visible) return;
        if(!this._currentTarget) {
            this.overlay.style.clipPath = 'none';
            this.highlight.style.display = 'none';
            this.tooltip.style.left = '0';
            this.tooltip.style.top = '0';
            const tooltipRect = this.tooltip.getBoundingClientRect();
            this.centerOnScreen(tooltipRect);
            return;
        }
        this.highlight.style.display = '';
        var targetForRect = this._currentTarget;
        var targetRect = targetForRect.getBoundingClientRect();
        if(targetRect.width === 0 && targetRect.height === 0 && this._currentTarget.firstElementChild) {
            targetForRect = this._currentTarget.firstElementChild;
            targetRect = targetForRect.getBoundingClientRect();
        }
        if(targetRect.width === 0 && targetRect.height === 0) {
            this._waitForRender();
            return;
        }
        this.positionHighlight(targetRect);
        this.positionTooltip(targetRect, this._preferredPosition);
    }

    _waitForRender() {
        if(this._renderWaitTimeout) {
            clearTimeout(this._renderWaitTimeout);
        }
        this._renderWaitTimeout = setTimeout(() => {
            this._renderWaitTimeout = null;
            this.updatePosition();
        }, 50);
    }

    positionHighlight(targetRect) {
        const padding = 4;
        const left = targetRect.left - padding;
        const top = targetRect.top - padding;
        const width = targetRect.width + padding * 2;
        const height = targetRect.height + padding * 2;
        this.highlight.style.left = `${left}px`;
        this.highlight.style.top = `${top}px`;
        this.highlight.style.width = `${width}px`;
        this.highlight.style.height = `${height}px`;
        const right = left + width;
        const bottom = top + height;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        this.overlay.style.clipPath = `polygon(
            0 0, ${vw}px 0, ${vw}px ${vh}px, 0 ${vh}px, 0 0,
            ${left}px ${top}px, ${left}px ${bottom}px, ${right}px ${bottom}px, ${right}px ${top}px, ${left}px ${top}px
        )`;
        this.clickBlocker.classList.remove('d-none');
        this.clickBlocker.style.left = `${left}px`;
        this.clickBlocker.style.top = `${top}px`;
        this.clickBlocker.style.width = `${width}px`;
        this.clickBlocker.style.height = `${height}px`;
    }

    positionTooltip(targetRect, preferredPosition) {
        const padding = 12;
        const arrowSize = 10;
        this.tooltip.style.left = '0';
        this.tooltip.style.top = '0';
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const positions = this.getPositionOrder(preferredPosition);

        for(const pos of positions) {
            const coords = this.calculatePosition(targetRect, tooltipRect, pos, padding, arrowSize);
            if(this.fitsInViewport(coords, tooltipRect)) {
                this.applyPosition(coords, pos);
                return;
            }
        }
        this.centerOnScreen(tooltipRect);
    }

    getPositionOrder(preferred) {
        const all = ['bottom', 'top', 'right', 'left'];
        return [preferred, ...all.filter(p => p !== preferred)];
    }

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

    fitsInViewport(coords, tooltipRect) {
        const margin = 10;
        return coords.x >= margin &&
               coords.y >= margin &&
               coords.x + tooltipRect.width <= window.innerWidth - margin &&
               coords.y + tooltipRect.height <= window.innerHeight - margin;
    }

    applyPosition(coords, position) {
        this.tooltip.style.left = `${coords.x}px`;
        this.tooltip.style.top = `${coords.y}px`;
        this.arrow.className = `tutorial-arrow tutorial-arrow-${position}`;
    }

    centerOnScreen(tooltipRect) {
        const x = (window.innerWidth - tooltipRect.width) / 2;
        const y = (window.innerHeight - tooltipRect.height) / 2;
        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.top = `${y}px`;
        this.arrow.className = 'tutorial-arrow d-none';
    }

    scrollTargetIntoView(element) {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.top >= 0 &&
                         rect.left >= 0 &&
                         rect.bottom <= window.innerHeight &&
                         rect.right <= window.innerWidth;

        if(!isVisible) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => this.updatePosition(), 300);
        }
    }
}

window.customElements.define('adventuring-tutorial-tooltip', AdventuringTutorialTooltipElement);
