const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { AdventuringGrimoireRowElement } = await loadModule('src/ui/components/adventuring-grimoire-row.mjs');
const { AdventuringEmptyStateElement } = await loadModule('src/ui/components/adventuring-empty-state.mjs');

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

    setCharacter(character) {
        this.character = character;
    }

    attachSelector(character, type) {
        this.selectorType = type;
        this.selectorCharacter = character;
        this.grimoireSelectedArea = null; // Track drill-down state
        this.character = character;

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

                if(this.isSlayerActive()) {
                    instance.setContent(this.buildGrimoireSelectorContent());
                } else {
                    instance.setContent(this.buildSelectorContent());
                }
            }
        });
    }

    isSlayerActive() {
        if (this.skill === undefined || this.skill.cached === undefined) return false;
        const slayerJob = this.skill.cached.slayerJob;
        if (slayerJob === undefined) return false;
        if (this.selectorCharacter === undefined) return false;
        return this.selectorCharacter.combatJob === slayerJob;
    }

    buildGrimoireSelectorContent() {
        if (this.skill === undefined) return this.buildSelectorContent();
        const grimoire = this.skill.grimoire;
        if(!grimoire) return this.buildSelectorContent();

        if(this.grimoireSelectedArea) {
            return this.buildGrimoireDetailView(this.grimoireSelectedArea);
        }

        return this.buildGrimoireAreaListView();
    }

    buildGrimoireAreaListView() {
        const grimoire = this.skill !== undefined ? this.skill.grimoire : undefined;
        const container = document.createElement('div');
        container.className = 'p-2 adventuring-scrollbar';
        container.style.maxHeight = '400px';
        container.style.overflowY = 'auto';
        container.style.minWidth = '280px';

        const header = document.createElement('h6');
        header.className = 'font-w600 text-center mb-2 text-info';
        header.textContent = this.selectorType === 'generator' ? 'Grimoire: Generators' : 'Grimoire: Spenders';
        container.appendChild(header);

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

        const areaLabel = document.createElement('div');
        areaLabel.className = 'font-size-sm text-muted mb-1';
        areaLabel.textContent = 'Learned by Area:';
        container.appendChild(areaLabel);

        const unlockedAreas = this.skill.crossroads.areas.filter(a => a.unlocked);

        if(unlockedAreas.length === 0) {
            const emptyMsg = new AdventuringEmptyStateElement();
            emptyMsg.setMessage('No areas discovered yet.', 'p-2');
            container.appendChild(emptyMsg);
        } else {
            unlockedAreas.forEach(area => {
                const row = this.buildAreaRow(area);
                container.appendChild(row);
            });
        }

        return container;
    }

    buildAreaRow(area) {
        const grimoire = this.skill.grimoire;
        const learnedCount = grimoire.getLearnedForArea(area, this.selectorType).length;

        const row = new AdventuringGrimoireRowElement();
        row.setArea({
            icon: area.media,
            name: area.name,
            count: learnedCount,
            showChevron: true,
            onClick: () => {
                this.grimoireSelectedArea = area;
                if(this.selectorPopup) {
                    this.selectorPopup.setContent(this.buildGrimoireSelectorContent());
                }
            }
        });

        return row;
    }

    buildGrimoireDetailView(area) {
        const grimoire = this.skill.grimoire;
        const bestiary = this.skill.bestiary;

        const container = document.createElement('div');
        container.className = 'p-2 adventuring-scrollbar';
        container.style.maxHeight = '400px';
        container.style.overflowY = 'auto';
        container.style.minWidth = '280px';

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

        const monsters = area.monsters || [];
        const abilityKey = this.selectorType === 'generator' ? 'generator' : 'spender';
        const registry = this.selectorType === 'generator' ? this.skill.generators : this.skill.spenders;

        if(monsters.length === 0) {
            const emptyMsg = new AdventuringEmptyStateElement();
            emptyMsg.setMessage('No monsters in this area.', 'p-2');
            container.appendChild(emptyMsg);
            return container;
        }

        const abilityMonsterMap = new Map();
        for(const monster of monsters) {
            const abilityId = monster[abilityKey];
            if(!abilityId) continue;

            const ability = registry.getObjectByID(abilityId);
            if(!ability) continue;

            if(ability.id === 'adventuring:none') continue;

            if(!abilityMonsterMap.has(ability)) {
                abilityMonsterMap.set(ability, []);
            }
            abilityMonsterMap.get(ability).push(monster);
        }

        if(abilityMonsterMap.size === 0) {
            const emptyMsg = new AdventuringEmptyStateElement();
            emptyMsg.setMessage('No abilities of this type in this area.', 'p-2');
            container.appendChild(emptyMsg);
            return container;
        }

        for(const [ability, sourceMonsters] of abilityMonsterMap) {
            const learned = grimoire.learnedAbilities.has(ability.id);

            const anySeen = sourceMonsters.some(m => bestiary && bestiary.seen.get(m) === true);

            const row = this.buildSlayerAbilityRow(ability, sourceMonsters, anySeen, learned);
            container.appendChild(row);
        }

        return container;
    }

    buildSlayerAbilityRow(ability, sourceMonsters, anySeen, learned) {
        const firstMonster = sourceMonsters[0];
        const isSelected = learned && this.selectorCharacter[this.selectorType] === ability;

        const row = new AdventuringGrimoireRowElement();
        row.setSlayerAbility({
            icon: firstMonster ? firstMonster.media : null,
            name: ability.name,
            isLearned: learned,
            isEquipped: isSelected,
            isSeen: anySeen,
            onClick: learned ? () => {
                if(this.selectorType === 'generator') {
                    this.selectorCharacter.setGenerator(ability);
                } else {
                    this.selectorCharacter.setSpender(ability);
                }
                if(this.selectorPopup) this.selectorPopup.hide();
            } : null,
            tooltipContent: anySeen ? this.buildSlayerAbilityTooltip(ability, sourceMonsters) : null
        });

        return row;
    }

    buildSlayerAbilityTooltip(ability, sourceMonsters) {
        const bestiary = this.skill.bestiary;

        const tooltip = TooltipBuilder.forAbility(ability, {
            character: this.selectorCharacter,
            manager: this.skill,
            showUnlockLevel: false
        });

        tooltip.separator();
        tooltip.text('Learned from:', 'text-muted font-size-sm');

        const seenMonsters = sourceMonsters.filter(m => bestiary && bestiary.seen.get(m) === true);
        const unseenCount = sourceMonsters.length - seenMonsters.length;

        for(const monster of seenMonsters) {
            tooltip.text(`<img class="skill-icon-xxs mr-1" src="${monster.media}">${monster.name}`, 'font-size-sm');
        }

        if(unseenCount > 0) {
            tooltip.text(`<i class="fa fa-question mr-1 text-muted"></i>??? (${unseenCount} more)`, 'text-muted font-size-sm');
        }

        return tooltip.build();
    }

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

    buildAbilityTooltip(ability, character) {
        const char = character || this.character || this.selectorCharacter;

        const forceShow = char && char.isHero === false;
        return TooltipBuilder.forAbility(ability, {
            character: char,
            manager: this.skill,
            showUnlockLevel: true,
            forceShowDescription: forceShow
        }).build();
    }

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

        // Sort by source priority: current job > other jobs > slayer > achievement
        const character = this.selectorCharacter;
        const currentCombatJob = character ? character.combatJob : null;
        const currentPassiveJob = character ? character.passiveJob : null;

        const getAbilitySourcePriority = (ability) => {
            // Check if ability is from current job
            if (currentCombatJob && ability.unlockedBy && ability.unlockedBy(currentCombatJob)) {
                return 0; // Highest priority - current combat job
            }
            if (currentPassiveJob && ability.unlockedBy && ability.unlockedBy(currentPassiveJob)) {
                return 1; // Current passive job
            }
            // Check if ability is from any job (but not current)
            if (ability.requirements) {
                const jobReq = ability.requirements.find(r => r.type === 'job_level' || r.type === 'current_job_level');
                if (jobReq) {
                    return 2; // Other job abilities
                }
            }
            // Slayer abilities (isEnemy)
            if (ability.isEnemy) {
                return 3;
            }
            // Achievement abilities
            if (ability.isAchievementAbility) {
                return 4;
            }
            // Fallback
            return 5;
        };

        abilities.sort((a, b) => {
            const priorityA = getAbilitySourcePriority(a);
            const priorityB = getAbilitySourcePriority(b);
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            // Within same priority, sort by unlock level
            return this.getUnlockLevel(a) - this.getUnlockLevel(b);
        });

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