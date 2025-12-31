const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');

/**
 * Selector row element for ability picker popup
 * Properly manages tippy tooltip lifecycle
 */
export class AdventuringAbilitySelectorRowElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-ability-selector-row-template'));
        
        this.row = getElementFromFragment(this._content, 'row', 'div');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');
        
        this.ability = null;
        this.isSelected = false;
        this.onSelect = null;
        
        this._tooltipTarget = this.row;
        this._tooltipOptions = { placement: 'right' };
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.onSelect = null;
    }

    /**
     * Set up the row with ability data
     * @param {Object} ability - The ability to display
     * @param {boolean} isSelected - Whether this ability is currently selected
     * @param {string} tooltipContent - HTML content for the tooltip
     * @param {Function} onSelect - Callback when row is clicked
     */
    setAbility(ability, isSelected, tooltipContent, onSelect) {
        this.ability = ability;
        this.isSelected = isSelected;
        this.onSelect = onSelect;
        
        this.nameText.textContent = ability.name;
        
        if (isSelected) {
            this.row.classList.add('border', 'border-success');
        } else {
            this.row.classList.remove('border', 'border-success');
        }
        
        this.row.onclick = () => {
            if (this.onSelect) {
                this.onSelect(this.ability);
            }
        };
        
        this.setTooltipContent(tooltipContent);
    }
}
window.customElements.define('adventuring-ability-selector-row', AdventuringAbilitySelectorRowElement);

export class AdventuringAbilitySmallElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-ability-small-template'));

        this.styling = getElementFromFragment(this._content, 'styling', 'div');
        this.nameText = getElementFromFragment(this._content, 'name', 'small');
        
        this.selectorPopup = undefined;
        this._tooltipTarget = this.styling;
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.selectorPopup !== undefined) {
            this.selectorPopup.destroy();
            this.selectorPopup = undefined;
        }
    }

    setSkill(skill) {
        this.skill = skill;
    }

    attachSelector(character, type) {
        this.selectorType = type;
        this.selectorCharacter = character;
        this.character = character;
        
        // Create click-triggered popup for ability selection
        this.selectorPopup = tippy(this.styling, {
            content: '',
            allowHTML: true,
            interactive: true,
            trigger: 'click',
            placement: 'bottom',
            maxWidth: 350,
            onShow: (instance) => {
                if(this.selectorCharacter.locked) return false;
                instance.setContent(this.buildSelectorContent());
            }
        });
    }

    setCharacter(character) {
        this.character = character;
    }

    /**
     * Build tooltip for an ability in the selector
     */
    buildAbilityTooltip(ability, character) {
        const char = character || this.character || this.selectorCharacter;
        return TooltipBuilder.forAbility(ability, {
            character: char,
            manager: this.skill,
            showUnlockLevel: true
        }).build();
    }

    /**
     * Get unlock level for an ability
     */
    getUnlockLevel(ability) {
        if(!ability.requirements || ability.requirements.length === 0) return 0;
        const req = ability.requirements.find(r => r.type === 'job_level' || r.type === 'current_job_level');
        return req ? req.level : 0;
    }

    buildSelectorContent() {
        let abilities;
        if(this.selectorType === 'generator')
            abilities = this.skill.generators.allObjects.filter(g => g.canEquip(this.selectorCharacter));
        if(this.selectorType === 'spender')
            abilities = this.skill.spenders.allObjects.filter(s => s.canEquip(this.selectorCharacter));
        
        // Sort by unlock level
        abilities.sort((a, b) => this.getUnlockLevel(a) - this.getUnlockLevel(b));
        
        const container = document.createElement('div');
        container.className = 'p-2 adventuring-scrollbar';
        container.style.maxHeight = '300px';
        container.style.overflowY = 'auto';
        
        abilities.forEach(ability => {
            const row = new AdventuringAbilitySelectorRowElement();
            container.appendChild(row);
            
            const isSelected = this.selectorCharacter[this.selectorType] === ability;
            const tooltipContent = this.buildAbilityTooltip(ability);
            
            row.setAbility(ability, isSelected, tooltipContent, (selectedAbility) => {
                if(this.selectorType === 'generator') {
                    this.selectorCharacter.setGenerator(selectedAbility);
                }
                if(this.selectorType === 'spender') {
                    this.selectorCharacter.setSpender(selectedAbility);
                }
                
                // Mark as seen
                if(selectedAbility.unlocked) {
                    this.skill.seenAbilities.add(selectedAbility.id);
                }
                
                if(this.selectorPopup) {
                    this.selectorPopup.hide();
                }
            });
        });
        
        return container;
    }
}
window.customElements.define('adventuring-ability-small', AdventuringAbilitySmallElement);