const { loadModule } = mod.getContext(import.meta);

const { TooltipBuilder } = await loadModule('src/adventuring-tooltip.mjs');

export class AdventuringAbilitySmallElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-ability-small-template'));

        this.styling = getElementFromFragment(this._content, 'styling', 'div');
        this.nameText = getElementFromFragment(this._content, 'name', 'small');
        
        this.selectorPopup = undefined;
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
        const tooltip = new TooltipBuilder();
        
        tooltip.header(ability.name);
        
        // Description with stats - pass character object (which has .stats) for proper scaling
        const desc = ability.getDescription ? ability.getDescription(char, true) : ability.description;
        tooltip.separator();
        tooltip.info(desc);
        
        // Energy cost/generation
        tooltip.separator();
        if(ability.energy !== undefined) {
            tooltip.bonus(`+${ability.energy} Energy`);
        } else if(ability.cost !== undefined) {
            tooltip.penalty(`-${ability.cost} Energy`);
        }
        
        // Usable by section - show which job(s) can use this ability
        const req = ability.requirements?.find(r => r.type === 'job_level' || r.type === 'current_job_level');
        if(req) {
            const job = this.skill.jobs.getObjectByID(req.job);
            if(job) {
                tooltip.separator();
                if(req.type === 'current_job_level') {
                    // Restricted to specific job
                    tooltip.hint(`Usable by: <img class="skill-icon-xxs mr-1" src="${job.media}">${job.name}`);
                } else {
                    // Learned from job but usable by all
                    tooltip.hint(`Usable by: All Jobs`);
                }
                tooltip.text(`<img class="skill-icon-xxs mr-1" src="${job.media}">Learned from ${job.name} Lv.${req.level}`, 'text-muted text-center');
            }
        } else {
            tooltip.separator();
            tooltip.hint(`Usable by: All Jobs`);
        }
        
        return tooltip.build();
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
            const row = document.createElement('div');
            row.className = 'd-flex align-items-center p-2 mb-1 bg-combat-inner-dark rounded pointer-enabled';
            
            const isSelected = this.selectorCharacter[this.selectorType] === ability;
            if(isSelected) {
                row.classList.add('border', 'border-success');
            }
            
            // Name
            const name = document.createElement('span');
            name.className = 'font-w600 flex-grow-1';
            name.textContent = ability.name;
            row.appendChild(name);
            
            // Click to select
            row.onclick = () => {
                if(this.selectorType === 'generator') {
                    this.selectorCharacter.setGenerator(ability);
                }
                if(this.selectorType === 'spender') {
                    this.selectorCharacter.setSpender(ability);
                }
                
                // Mark as seen
                if(ability.unlocked) {
                    this.skill.seenAbilities.add(ability.id);
                }
                
                if(this.selectorPopup) {
                    this.selectorPopup.hide();
                }
            };
            
            // Add tooltip to row
            tippy(row, {
                content: this.buildAbilityTooltip(ability),
                allowHTML: true,
                placement: 'right'
            });
            
            container.appendChild(row);
        });
        
        return container;
    }
}
window.customElements.define('adventuring-ability-small', AdventuringAbilitySmallElement);