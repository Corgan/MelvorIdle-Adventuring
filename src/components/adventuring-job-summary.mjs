const { loadModule } = mod.getContext(import.meta);

export class AdventuringJobSummaryElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-job-summary-template'));

        this.styling = getElementFromFragment(this._content, 'styling', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');
        this.level = getElementFromFragment(this._content, 'level', 'small');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    setJob(job) {
        this.job = job;
        this.styling.onclick = () => {
            if(this.selectorCharacter !== undefined && this.selectorType !== undefined) {
                if(this.selectorType == 'combatJob') {
                    this.selectorCharacter.setCombatJob(this.job);
                }
                if(this.selectorType == 'passiveJob') {
                    this.selectorCharacter.setPassiveJob(this.job);
                }

                this.selectorCharacter = undefined;
                this.selectorType = undefined;
                Swal.close();
            }
        }
    }

    setHighlight(toggle) {
        this.styling.classList.toggle('bg-combat-menu-selected', toggle);
    }

    setSelector(character, type) {
        this.selectorCharacter = character;
        this.selectorType = type;
    }

    mount(parent) {
        parent.appendChild(this);
    }
}
window.customElements.define('adventuring-job-summary', AdventuringJobSummaryElement);