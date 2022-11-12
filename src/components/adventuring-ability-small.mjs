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

    /*

                    let html = '' +
                        '<div class="corruption-mods">' +
                        ('<div class="corruption-mod-selector"></div>'.repeat(corruptionRollerSettings[slot].length)) +
                        '</div>' +
                        '<div class="corruption-mods-add">Add New</div>';
                    Swal.fire({
                        html: html,
                        width: 700,
                        onBeforeOpen: () => {
                            mods = [...$('.corruption-mod-selector')].map((el, i) => new AutoComplete(el, Object.keys(activeModifiers), corruptionRollerSettings[slot][i]));
                            $('.corruption-mods-add')[0].addEventListener('click', (e) => {
                                let el = document.createElement('div');
                                el.className = 'corruption-mod-selector';
                                $('.corruption-mods')[0].appendChild(el);
 
                                mods.push(new AutoComplete(el, Object.keys(activeModifiers)))
                            });
                        },
                        preConfirm: () => {
                            if (mods)
                                return mods;
                        }
                    }).then(data => {
                        if (data.isConfirmed) {
                            corruptionRollerSettings[slot] = data.value.map(value => value.getConfig()).filter(v => v != null)
                        }
                    });


    */
}