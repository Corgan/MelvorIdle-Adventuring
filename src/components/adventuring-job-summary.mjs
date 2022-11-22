const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringJobSummaryUIComponent extends AdventuringUIComponent {
    constructor(manager, game, refObj) {
        super(manager, game, 'adventuring-job-summary-component');
        this.refObj = refObj;

        this.styling = getElementFromFragment(this.$fragment, 'styling', 'div');

        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');
        this.name = getElementFromFragment(this.$fragment, 'name', 'span');
        this.level = getElementFromFragment(this.$fragment, 'level', 'small');

        this.styling.onclick = () => {
            if(this.selectorCharacter !== undefined && this.selectorType !== undefined) {
                if(this.selectorType == 'combatJob') {
                    this.selectorCharacter.setCombatJob(this.refObj);
                }
                if(this.selectorType == 'passiveJob') {
                    this.selectorCharacter.setPassiveJob(this.refObj);
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
}