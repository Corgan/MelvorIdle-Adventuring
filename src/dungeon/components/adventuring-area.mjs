const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/components/adventuring-tooltip-element.mjs');

export class AdventuringAreaElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-area-template'));

        this.card = getElementFromFragment(this._content, 'card', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');
        this.level = getElementFromFragment(this._content, 'level', 'small');

        this.progressContainer = getElementFromFragment(this._content, 'progress-container', 'div');
        this.masteryProgress = getElementFromFragment(this._content, 'mastery-progress', 'progress-bar');

        this.controls = getElementFromFragment(this._content, 'controls', 'div');
        this.difficultyButton = getElementFromFragment(this._content, 'difficulty-button', 'button');
        this.difficultyOptions = getElementFromFragment(this._content, 'difficulty-options', 'div');
        this.adventureButton = getElementFromFragment(this._content, 'adventure-button', 'button');

        this.autoRepeatContainer = getElementFromFragment(this._content, 'auto-repeat-container', 'div');
        this.autoRepeat = getElementFromFragment(this._content, 'auto-repeat', 'input');

        this._tooltipTarget = this.card;
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }
}
window.customElements.define('adventuring-area', AdventuringAreaElement);