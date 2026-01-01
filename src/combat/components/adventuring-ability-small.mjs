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
        this.grimoireSelectedArea = null; // Track drill-down state
        this.character = character;
        
        // Create click-triggered popup for ability selection
        this.selectorPopup = tippy(this.styling, {
            content: '',
            allowHTML: true,
            interactive: true,
            trigger: 'click',
            placement: 'bottom',
            maxWidth: 400,
            onShow: (instance) => {
                if(this.selectorCharacter.locked) return false;
                this.grimoireSelectedArea = null; // Reset drill-down on open
                
                // Check if this hero has Slayer as combat job - show Grimoire picker
                if(this.isSlayerActive()) {
                    instance.setContent(this.buildGrimoireSelectorContent());
                } else {
                    instance.setContent(this.buildSelectorContent());
                }
            }
        });
    }

    /**
     * Check if the hero has Slayer as their combat job.
     */
    isSlayerActive() {
        return this.selectorCharacter?.combatJob?.id === 'adventuring:slayer';
    }

    /**
     * Build the Grimoire selector content for Slayer job.
     * Shows job abilities + area drill-down for learned/discoverable abilities.
     */
    buildGrimoireSelectorContent() {
        const grimoire = this.skill?.grimoire;
        if(!grimoire) return this.buildSelectorContent();
        
        // If an area is selected, show detail view
        if(this.grimoireSelectedArea) {
            return this.buildGrimoireDetailView(this.grimoireSelectedArea);
        }
        
        // Otherwise show area list view
        return this.buildGrimoireAreaListView();
    }

    /**
     * Build the area list view for the Grimoire.
     */
    buildGrimoireAreaListView() {
        const grimoire = this.skill?.grimoire;
        const container = document.createElement('div');
        container.className = 'p-2 adventuring-scrollbar';
        container.style.maxHeight = '400px';
        container.style.overflowY = 'auto';
        container.style.minWidth = '280px';
        
        // Header
        const header = document.createElement('h6');
        header.className = 'font-w600 text-center mb-2 text-info';
        header.textContent = this.selectorType === 'generator' ? 'Grimoire: Generators' : 'Grimoire: Spenders';
        container.appendChild(header);
        
        // Job's own abilities (non-enemy)
        const jobAbilities = this.selectorType === 'generator'
            ? this.skill.generators.allObjects.filter(g => g.canEquip(this.selectorCharacter) && !g.isEnemy)
            : this.skill.spenders.allObjects.filter(s => s.canEquip(this.selectorCharacter) && !s.isEnemy);
        
        if(jobAbilities.length > 0) {
            const jobLabel = document.createElement('div');
            jobLabel.className = 'font-size-sm text-muted mb-1';
            jobLabel.textContent = 'Slayer Abilities:';
            container.appendChild(jobLabel);
            
            jobAbilities.forEach(ability => {
                const row = this.buildAbilityRow(ability);
                container.appendChild(row);
            });
            
            const divider = document.createElement('hr');
            divider.className = 'my-2';
            container.appendChild(divider);
        }
        
        // Area list - use crossroads.areas which is already sorted
        const areaLabel = document.createElement('div');
        areaLabel.className = 'font-size-sm text-muted mb-1';
        areaLabel.textContent = 'Learned by Area:';
        container.appendChild(areaLabel);
        
        const unlockedAreas = this.skill.crossroads.areas.filter(a => a.unlocked);
        
        if(unlockedAreas.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'text-center text-muted p-2';
            emptyMsg.textContent = 'No areas discovered yet.';
            container.appendChild(emptyMsg);
        } else {
            unlockedAreas.forEach(area => {
                const row = this.buildAreaRow(area);
                container.appendChild(row);
            });
        }
        
        return container;
    }

    /**
     * Build an area row for the area list view.
     */
    buildAreaRow(area) {
        const grimoire = this.skill.grimoire;
        const learnedCount = grimoire.getLearnedForArea(area, this.selectorType).length;
        
        const row = document.createElement('div');
        row.className = 'd-flex align-items-center p-2 bg-combat-inner-dark rounded mb-1 pointer-enabled';
        row.style.cursor = 'pointer';
        row.innerHTML = `
            <img class="skill-icon-xs mr-2" src="${area.media}">
            <span class="font-size-sm font-w600">${area.name}</span>
            <span class="ml-auto badge ${learnedCount > 0 ? 'badge-success' : 'badge-secondary'} font-size-xs">${learnedCount}</span>
            <i class="fa fa-chevron-right ml-2 text-muted"></i>
        `;
        
        row.onclick = () => {
            this.grimoireSelectedArea = area;
            if(this.selectorPopup) {
                this.selectorPopup.setContent(this.buildGrimoireSelectorContent());
            }
        };
        
        return row;
    }

    /**
     * Build the detail view for a selected area.
     * Shows monsters and their abilities, with visibility based on bestiary.
     */
    buildGrimoireDetailView(area) {
        const grimoire = this.skill.grimoire;
        const bestiary = this.skill.bestiary;
        
        const container = document.createElement('div');
        container.className = 'p-2 adventuring-scrollbar';
        container.style.maxHeight = '400px';
        container.style.overflowY = 'auto';
        container.style.minWidth = '280px';
        
        // Back button + header
        const headerRow = document.createElement('div');
        headerRow.className = 'd-flex align-items-center mb-2';
        
        const backBtn = document.createElement('button');
        backBtn.className = 'btn btn-sm btn-outline-secondary mr-2';
        backBtn.innerHTML = '<i class="fa fa-arrow-left"></i>';
        backBtn.onclick = () => {
            this.grimoireSelectedArea = null;
            if(this.selectorPopup) {
                this.selectorPopup.setContent(this.buildGrimoireSelectorContent());
            }
        };
        headerRow.appendChild(backBtn);
        
        const areaIcon = document.createElement('img');
        areaIcon.className = 'skill-icon-xs mr-2';
        areaIcon.src = area.media;
        headerRow.appendChild(areaIcon);
        
        const areaName = document.createElement('span');
        areaName.className = 'font-w600';
        areaName.textContent = area.name;
        headerRow.appendChild(areaName);
        
        container.appendChild(headerRow);
        
        // Get monsters and collect unique abilities with their source monsters
        const monsters = area.monsters || [];
        const abilityKey = this.selectorType === 'generator' ? 'generator' : 'spender';
        const registry = this.selectorType === 'generator' ? this.skill.generators : this.skill.spenders;
        
        if(monsters.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'text-center text-muted p-2';
            emptyMsg.textContent = 'No monsters in this area.';
            container.appendChild(emptyMsg);
            return container;
        }
        
        // Build ability -> monsters map for deduplication
        const abilityMonsterMap = new Map();
        for(const monster of monsters) {
            const abilityId = monster[abilityKey];
            if(!abilityId) continue;
            
            const ability = registry.getObjectByID(abilityId);
            if(!ability) continue;
            
            // Filter out the "none" spender
            if(ability.id === 'adventuring:none') continue;
            
            if(!abilityMonsterMap.has(ability)) {
                abilityMonsterMap.set(ability, []);
            }
            abilityMonsterMap.get(ability).push(monster);
        }
        
        if(abilityMonsterMap.size === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'text-center text-muted p-2';
            emptyMsg.textContent = 'No abilities of this type in this area.';
            container.appendChild(emptyMsg);
            return container;
        }
        
        // Build rows for each unique ability
        for(const [ability, sourceMonsters] of abilityMonsterMap) {
            const learned = grimoire.learnedAbilities.has(ability.id);
            // Check if ANY source monster has been seen
            const anySeen = sourceMonsters.some(m => bestiary && bestiary.seen.get(m) === true);
            
            const row = this.buildSlayerAbilityRow(ability, sourceMonsters, anySeen, learned);
            container.appendChild(row);
        }
        
        return container;
    }

    /**
     * Build a row showing a slayer ability with its source monsters.
     */
    buildSlayerAbilityRow(ability, sourceMonsters, anySeen, learned) {
        const bestiary = this.skill.bestiary;
        const row = document.createElement('div');
        row.className = 'd-flex align-items-center p-2 rounded mb-1';
        
        if(learned) {
            row.classList.add('bg-combat-inner-dark', 'pointer-enabled');
            row.style.cursor = 'pointer';
        } else {
            row.classList.add('bg-secondary');
            row.style.opacity = '0.6';
        }
        
        // Ability icon (use ability media if learned/seen, else first monster icon if any seen, else question mark)
        const iconContainer = document.createElement('div');
        iconContainer.className = 'mr-2 d-flex align-items-center justify-content-center';
        iconContainer.style.width = '24px';
        iconContainer.style.height = '24px';
        
        // Show first monster icon as a hint, or question mark if no monsters
        const firstMonster = sourceMonsters[0];
        if(firstMonster) {
            const icon = document.createElement('img');
            icon.className = 'skill-icon-xs';
            icon.src = firstMonster.media;
            iconContainer.appendChild(icon);
        } else {
            const question = document.createElement('i');
            question.className = 'fa fa-question text-muted';
            question.style.fontSize = '16px';
            iconContainer.appendChild(question);
        }
        row.appendChild(iconContainer);
        
        // Ability name (or ??? if not seen)
        const nameSpan = document.createElement('span');
        nameSpan.className = 'font-size-sm';
        if(anySeen) {
            nameSpan.textContent = ability.name;
        } else {
            nameSpan.textContent = '???';
            nameSpan.classList.add('text-muted');
        }
        row.appendChild(nameSpan);
        
        // Learned badge or lock icon
        const statusContainer = document.createElement('div');
        statusContainer.className = 'ml-auto';
        
        if(learned) {
            const badge = document.createElement('span');
            badge.className = 'badge badge-success font-size-xs';
            badge.textContent = 'Learned';
            statusContainer.appendChild(badge);
        } else if(anySeen) {
            const lockIcon = document.createElement('i');
            lockIcon.className = 'fa fa-lock text-muted';
            statusContainer.appendChild(lockIcon);
        }
        row.appendChild(statusContainer);
        
        // Add tooltip with ability info and monster sources
        if(anySeen) {
            const tooltipContent = this.buildSlayerAbilityTooltip(ability, sourceMonsters);
            tippy(row, {
                content: tooltipContent,
                placement: 'right',
                allowHTML: true,
                interactive: false
            });
        }
        
        // Click to equip if learned
        if(learned) {
            const isSelected = this.selectorCharacter[this.selectorType] === ability;
            if(isSelected) {
                row.classList.add('border', 'border-success');
            }
            
            row.onclick = () => {
                if(this.selectorType === 'generator') {
                    this.selectorCharacter.setGenerator(ability);
                } else {
                    this.selectorCharacter.setSpender(ability);
                }
                if(this.selectorPopup) this.selectorPopup.hide();
            };
        }
        
        return row;
    }
    
    /**
     * Build tooltip for a slayer ability showing ability info + monster sources
     */
    buildSlayerAbilityTooltip(ability, sourceMonsters) {
        const bestiary = this.skill.bestiary;
        
        // Start with normal ability tooltip
        const tooltip = TooltipBuilder.forAbility(ability, {
            character: this.selectorCharacter,
            manager: this.skill,
            showUnlockLevel: false
        });
        
        // Add monster sources section
        tooltip.separator();
        tooltip.text('Learned from:', 'text-muted font-size-sm');
        
        const seenMonsters = sourceMonsters.filter(m => bestiary && bestiary.seen.get(m) === true);
        const unseenCount = sourceMonsters.length - seenMonsters.length;
        
        // Show seen monsters with icons
        for(const monster of seenMonsters) {
            tooltip.text(`<img class="skill-icon-xxs mr-1" src="${monster.media}">${monster.name}`, 'font-size-sm');
        }
        
        // Show unseen count if any
        if(unseenCount > 0) {
            tooltip.text(`<i class="fa fa-question mr-1 text-muted"></i>??? (${unseenCount} more)`, 'text-muted font-size-sm');
        }
        
        return tooltip.build();
    }

    /**
     * Build a single ability row for the picker.
     */
    buildAbilityRow(ability) {
        const row = new AdventuringAbilitySelectorRowElement();
        const isSelected = this.selectorCharacter[this.selectorType] === ability;
        const tooltipContent = this.buildAbilityTooltip(ability);
        
        row.setAbility(ability, isSelected, tooltipContent, (selectedAbility) => {
            if(this.selectorType === 'generator') {
                this.selectorCharacter.setGenerator(selectedAbility);
            } else {
                this.selectorCharacter.setSpender(selectedAbility);
            }
            if(this.selectorPopup) this.selectorPopup.hide();
        });
        
        return row;
    }

    setCharacter(character) {
        this.character = character;
    }

    /**
     * Build tooltip for an ability in the selector
     */
    buildAbilityTooltip(ability, character) {
        const char = character || this.character || this.selectorCharacter;
        // For enemies (non-heroes), always show the ability description
        const forceShow = char && char.isHero === false;
        return TooltipBuilder.forAbility(ability, {
            character: char,
            manager: this.skill,
            showUnlockLevel: true,
            forceShowDescription: forceShow
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