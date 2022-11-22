const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringAbilitySmallUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-ability-small-component');

        this.styling = getElementFromFragment(this.$fragment, 'styling', 'div');
        this.name = getElementFromFragment(this.$fragment, 'name', 'small');
        this.tooltip = tippy(this.styling, {
            content: '',
            allowHTML: true,
            hideOnClick: false
        });
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
                    abilities = this.manager.generators.allObjects.filter(g => g.canEquip(this.selectorCharacter));
                if(this.selectorType == 'spender')
                    abilities = this.manager.spenders.allObjects.filter(s => s.canEquip(this.selectorCharacter));
                
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