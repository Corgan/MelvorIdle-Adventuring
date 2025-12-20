export class AdventuringAbilitySmallElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-ability-small-template'));

        this.styling = getElementFromFragment(this._content, 'styling', 'div');
        this.nameText = getElementFromFragment(this._content, 'name', 'small');
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
        this.tooltip = tippy(this.styling, {
            content: '',
            allowHTML: true,
            hideOnClick: false
        });
    }

    disconnectedCallback() {
        if (this.tooltip !== undefined) {
            this.tooltip.destroy();
            this.tooltip = undefined;
        }
    }

    setSkill(skill) {
        this.skill = skill;
    }

    attachSelector(character, type) {
        this.selectorType = type;
        this.selectorCharacter = character;
        this.styling.onclick = () => this.selectorCharacter.locked ? false : this.showSelector();
    }

    showSelector() {
        Swal.fire({
            html: `<div class="row no-gutters"></div>`,
            width: '60%',
            showConfirmButton: false,
            willOpen: ($el) => {
                let abilities;
                if(this.selectorType == 'generator')
                    abilities = this.skill.generators.allObjects.filter(g => g.canEquip(this.selectorCharacter));
                if(this.selectorType == 'spender')
                    abilities = this.skill.spenders.allObjects.filter(s => s.canEquip(this.selectorCharacter));
                
                let $root = Swal.getHtmlContainer().firstElementChild;
                abilities.forEach(ability => {
                    ability.component.mount($root);

                    ability.component.setSelector(this.selectorCharacter, this.selectorType);
                    ability.setHighlight(this.selectorCharacter[this.selectorType] === ability);

                    ability.renderQueue.descriptionCharacter = this.selectorCharacter;
                    ability.renderQueue.description = true;
                    ability.renderQueue.name = true;
                    ability.render();
                });
            }
        });
    }
}
window.customElements.define('adventuring-ability-small', AdventuringAbilitySmallElement);