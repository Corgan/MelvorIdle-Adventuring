const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/components/adventuring-tooltip-element.mjs');

export class AdventuringEntityDisplayElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-entity-display-template'));

        this.col = getElementFromFragment(this._content, 'col', 'div');
        this.clickable = getElementFromFragment(this._content, 'clickable', 'div');
        this.newBadge = getElementFromFragment(this._content, 'newBadge', 'span');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');
        this.level = getElementFromFragment(this._content, 'level', 'small');
        this.progressContainer = getElementFromFragment(this._content, 'progressContainer', 'div');
        this.progress = getElementFromFragment(this._content, 'progress', 'progress-bar');

        this._tooltipTarget = this.clickable;
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    setIcon(src) {
        this.icon.src = src;
    }

    setName(name) {
        this.nameText.textContent = name;
    }

    setLevel(level) {
        if (level !== null && level !== undefined) {
            this.level.textContent = ` Lv.${level}`;
        } else {
            this.level.textContent = '';
        }
    }

    setNewBadge(show) {
        this.newBadge.classList.toggle('d-none', !show);
    }

    setProgress(percent, colorClass = 'bg-info') {
        this.progress.style.width = `${percent}%`;
        this.progress.className = `progress-bar ${colorClass}`;
    }

    showProgress(show) {
        this.progressContainer.classList.toggle('d-none', !show);
    }

    setColumnClass(colClass) {
        this.col.className = colClass;
    }

    setJob({ iconSrc, name, level, masteryPercent }) {
        this.setIcon(iconSrc);
        this.setName(name);
        this.setLevel(level);
        this.setNewBadge(false);
        if (masteryPercent !== undefined) {
            this.setProgress(masteryPercent);
            this.showProgress(true);
        } else {
            this.showProgress(false);
        }
    }

    setMonster({ iconSrc, name, level, isNew = false, masteryPercent }) {
        this.setIcon(iconSrc);
        this.setName(name);
        this.setLevel(level);
        this.setNewBadge(isNew);
        if (masteryPercent !== undefined) {
            this.setProgress(masteryPercent);
            this.showProgress(true);
        } else {
            this.showProgress(false);
        }
    }

    setArea({ iconSrc, name, level, masteryPercent }) {
        this.setIcon(iconSrc);
        this.setName(name);
        this.setLevel(level);
        this.setNewBadge(false);
        if (masteryPercent !== undefined) {
            this.setProgress(masteryPercent);
            this.showProgress(true);
        } else {
            this.showProgress(false);
        }
    }

    onClick(handler) {
        this.clickable.onclick = handler;
    }
}
window.customElements.define('adventuring-entity-display', AdventuringEntityDisplayElement);
