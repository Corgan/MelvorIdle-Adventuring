export class AdventuringAbilityElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-ability-template'));

        this.styling = getElementFromFragment(this._content, 'styling', 'div');
        this.nameText = getElementFromFragment(this._content, 'name', 'small');
        this.description = getElementFromFragment(this._content, 'description', 'small');
        this.newBadge = getElementFromFragment(this._content, 'new-badge', 'span');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    setAbility(ability) {
        this.ability = ability;
        this.styling.onclick = () => {
            if(this.selectorCharacter !== undefined && this.selectorType !== undefined) {
                if(this.selectorType === 'generator') {
                    this.selectorCharacter.setGenerator(this.ability);
                }
                if(this.selectorType === 'spender') {
                    this.selectorCharacter.setSpender(this.ability);
                }

                this.selectorCharacter = undefined;
                this.selectorType = undefined;
                Swal.close();
            }
        }
    }

    setSelector(character, type) {
        this.selectorCharacter = character;
        this.selectorType = type;
    }

    mount(parent) {
        parent.appendChild(this);
    }
}
window.customElements.define('adventuring-ability', AdventuringAbilityElement);