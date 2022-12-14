const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringAbilityUIComponent extends AdventuringUIComponent {
    constructor(manager, game, refObj) {
        super(manager, game, 'adventuring-ability-component');

        this.refObj = refObj;

        this.styling = getElementFromFragment(this.$fragment, 'styling', 'div');
        this.name = getElementFromFragment(this.$fragment, 'name', 'small');
        this.description = getElementFromFragment(this.$fragment, 'description', 'small');

        this.styling.onclick = () => {
            if(this.selectorCharacter !== undefined && this.selectorType !== undefined) {
                if(this.selectorType == 'generator') {
                    this.selectorCharacter.setGenerator(this.refObj);
                }
                if(this.selectorType == 'spender') {
                    this.selectorCharacter.setSpender(this.refObj);
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
}