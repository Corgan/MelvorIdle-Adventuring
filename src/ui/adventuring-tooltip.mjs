const { loadModule } = mod.getContext(import.meta);

const { formatRequirement, describeEffect } = await loadModule('src/core/adventuring-utils.mjs');

/**
 * Tooltip builder utility - creates styled tooltips matching Melvor's style
 */
export class TooltipBuilder {
    constructor() {
        this.sections = [];
        this.currentSection = null;
    }

    /**
     * Start a new tooltip
     */
    static create() {
        return new TooltipBuilder();
    }

    /**
     * Add a header/title with optional icon
     */
    header(text, iconSrc = null) {
        let html = '<div class="text-center">';
        if(iconSrc) {
            html += `<img class="skill-icon-xs mr-1" src="${iconSrc}">`;
        }
        html += `<span class="font-w600 text-warning">${text}</span>`;
        html += '</div>';
        this.sections.push(html);
        return this;
    }

    /**
     * Add a subheader/subtitle
     */
    subheader(text, color = 'text-info') {
        this.sections.push(`<div class="text-center"><small class="font-w600 ${color}">${text}</small></div>`);
        return this;
    }

    /**
     * Add a separator line
     */
    separator() {
        this.sections.push('<hr class="my-1 border-secondary">');
        return this;
    }

    /**
     * Add a section title
     */
    sectionTitle(text) {
        this.sections.push(`<div class="font-w600 text-info mb-1">${text}</div>`);
        return this;
    }

    /**
     * Add a stat line with icon
     */
    stat(label, value, iconSrc = null, color = '') {
        let html = '<div class="d-flex justify-content-between">';
        html += '<span class="text-muted">';
        if(iconSrc) {
            html += `<img class="skill-icon-xxs mr-1" src="${iconSrc}">`;
        }
        html += `${label}</span>`;
        html += `<span class="${color}">${value}</span>`;
        html += '</div>';
        this.sections.push(html);
        return this;
    }

    /**
     * Add a simple text line
     */
    text(text, color = '') {
        this.sections.push(`<div><small class="${color}">${text}</small></div>`);
        return this;
    }

    /**
     * Add a bonus/positive modifier (green text)
     */
    bonus(text) {
        this.sections.push(`<div><small class="text-success">${text}</small></div>`);
        return this;
    }

    /**
     * Add a penalty/negative modifier (red text)
     */
    penalty(text) {
        this.sections.push(`<div><small class="text-danger">${text}</small></div>`);
        return this;
    }

    /**
     * Add an info line
     */
    info(text) {
        this.sections.push(`<div><small class="text-info">${text}</small></div>`);
        return this;
    }

    /**
     * Add a muted/hint line
     */
    hint(text) {
        this.sections.push(`<div><small class="text-muted">${text}</small></div>`);
        return this;
    }

    /**
     * Add a source hint with optional icon
     * Used to show where an item/monster/etc comes from
     * @param {string} text - The source description (e.g., "Drops from: Goblin")
     * @param {string} [iconSrc] - Optional icon URL
     */
    source(text, iconSrc = null) {
        let html = '<div class="text-center"><small class="text-muted">';
        if(iconSrc) {
            html += `<img class="skill-icon-xxs mr-1" src="${iconSrc}">`;
        }
        html += `${text}</small></div>`;
        this.sections.push(html);
        return this;
    }

    /**
     * Add source hints from an array of source objects (monsters, areas, etc.)
     * Shows up to 3 sources with "+N more" if there are more
     * @param {Array} sources - Array of source objects with .name property
     * @param {string} prefix - Prefix text (e.g., "Drops from", "Found in")
     */
    sourceHint(sources, prefix) {
        if(!sources || sources.length === 0) return this;
        const sourceNames = sources.slice(0, 3).map(s => s.name);
        let sourceText = sourceNames.join(', ');
        if(sources.length > 3) {
            sourceText += ` +${sources.length - 3} more`;
        }
        return this.source(`${prefix}: ${sourceText}`);
    }

    /**
     * Add modifier bonuses from the manager's modifier system
     * Uses describeEffect to format the bonus descriptions
     * @param {Object} manager - The adventuring manager
     * @param {Object} action - The mastery action to get bonuses for
     * @param {Array<string>} modifierTypes - Array of modifier type strings to check
     */
    modifierBonuses(manager, action, modifierTypes) {
        const bonuses = modifierTypes
            .map(type => ({ type, value: manager.modifiers.getBonus(type, { action }) }))
            .filter(b => b.value > 0);
        
        if(bonuses.length === 0) return this;
        
        this.separator();
        bonuses.forEach(b => {
            this.bonus(describeEffect(b, manager));
        });
        return this;
    }

    /**
     * Add a list of effects as bonus/penalty lines using describeEffect
     * @param {Array} effects - Array of effect objects {type, value, ...}
     * @param {Object} [manager] - Optional manager for describeEffect
     * @param {boolean} [addSeparator=true] - Whether to add separator before effects
     */
    effects(effects, manager = null, addSeparator = true) {
        if(!effects || effects.length === 0) return this;
        
        if(addSeparator) this.separator();
        effects.forEach(e => {
            const description = describeEffect(e, manager);
            // Negative values or penalty types get penalty styling
            const isPenalty = e.value < 0 || (e.type !== undefined && (e.type.includes('enemy_') || e.type.includes('_cost')));
            if(isPenalty) {
                this.penalty(description);
            } else {
                this.bonus(description);
            }
        });
        return this;
    }

    /**
     * Add difficulty mode header and effects
     * @param {Object} difficulty - Difficulty object with name, color, getTooltipEffects(), isEndless
     * @param {Object} [manager] - Optional manager for describeEffect
     */
    difficultyInfo(difficulty, manager = null) {
        if(!difficulty) return this;
        
        this.separator();
        this.subheader(`${difficulty.name} Mode`, difficulty.color);
        
        // Use the difficulty's tooltip effects method
        const effects = difficulty.getTooltipEffects !== undefined ? difficulty.getTooltipEffects() : [];
        effects.forEach(e => {
            const description = describeEffect(e, manager);
            const isPenalty = (e.type !== undefined && e.type.includes('enemy_')) || e.value < 0;
            if(isPenalty) {
                this.penalty(description);
            } else {
                this.bonus(description);
            }
        });
        
        if(difficulty.isEndless) {
            this.info('Difficulty scales with each wave');
        }
        return this;
    }

    /**
     * Add a warning line
     */
    warning(text) {
        this.sections.push(`<div><small class="text-warning">${text}</small></div>`);
        return this;
    }

    /**
     * Add a progress bar
     */
    progress(current, max, label = '', color = 'bg-info') {
        const percent = Math.min(100, (current / max) * 100);
        let html = '';
        if(label) {
            html += `<div class="text-center"><small class="text-muted">${label}</small></div>`;
        }
        html += '<div class="progress active my-1" style="height: 6px;">';
        html += `<div class="progress-bar ${color}" style="width: ${percent}%"></div>`;
        html += '</div>';
        html += `<div class="text-center"><small>${current} / ${max}</small></div>`;
        this.sections.push(html);
        return this;
    }

    /**
     * Add XP progress with mastery styling
     * @param {number} currentXP - XP within current level (total XP - currentLevelXP)
     * @param {number} xpToNextLevel - XP needed for next level (nextLevelXP - currentLevelXP)
     * @param {number} level - Current mastery level
     * @param {number} percent - Progress percentage (0-100)
     */
    masteryProgress(currentXP, xpToNextLevel, level, percent = null) {
        if(percent === null) {
            percent = xpToNextLevel > 0 ? Math.min(100, (currentXP / xpToNextLevel) * 100) : 100;
        }
        let html = `<div class="text-center"><small class="text-info">Level ${level}</small></div>`;
        html += '<div class="progress active my-1" style="height: 5px;">';
        html += `<div class="progress-bar bg-info" style="width: ${percent}%"></div>`;
        html += '</div>';
        html += `<div class="text-center"><small class="text-muted">${numberWithCommas(currentXP)} / ${numberWithCommas(xpToNextLevel)} XP</small></div>`;
        this.sections.push(html);
        return this;
    }

    /**
     * Add mastery progress from a manager and action
     * Calculates the correct level-relative XP values
     * @param {Object} manager - The adventuring manager
     * @param {Object} action - The mastery action
     */
    masteryProgressFor(manager, action) {
        const totalXP = manager.getMasteryXP(action);
        const level = manager.getMasteryLevel(action);
        const currentLevelXP = exp.levelToXP(level);
        const nextLevelXP = exp.levelToXP(level + 1);
        const xpInLevel = Math.floor(totalXP - currentLevelXP);
        const xpToNextLevel = nextLevelXP - currentLevelXP;
        const percent = level >= 99 ? 100 : Math.min(100, (xpInLevel / xpToNextLevel) * 100);
        return this.masteryProgress(xpInLevel, xpToNextLevel, level, percent);
    }

    /**
     * Add an icon with value (for stats)
     */
    iconValue(iconSrc, value, color = '') {
        let html = '<span>';
        html += `<img class="skill-icon-xxs" style="height: .75rem; width: .75rem;" src="${iconSrc}">`;
        html += `<small class="${color}">${value}</small>`;
        html += '</span>';
        return html;
    }

    /**
     * Add a row of icon values (for multiple stats on one line)
     */
    statRow(...items) {
        let html = '<div class="d-flex justify-content-center flex-wrap">';
        items.forEach((item, i) => {
            if(i > 0) html += '<span class="mx-1"></span>';
            html += item;
        });
        html += '</div>';
        this.sections.push(html);
        return this;
    }

    /**
     * Create a simple material tooltip showing name, icon, and owned count.
     * Used for material displays in costs, rewards, etc.
     * @param {Object} material - Material object with name, media, count
     * @param {Object} [manager] - Optional adventuring manager for source hints
     * @returns {TooltipBuilder} This builder for chaining
     */
    static forMaterial(material, manager = null) {
        const tooltip = TooltipBuilder.create()
            .header(material.name, material.media)
            .separator()
            .text(`Owned: ${material.count}`, 'text-center');
        
        // Add source hints if manager is available
        if(manager !== undefined && manager.materialSources !== undefined) {
            tooltip.sourceHint(manager.materialSources.get(material), 'Drops from');
        }
        
        return tooltip;
    }

    /**
     * Create a job tooltip showing name, icon, mastery progress, stats, and milestones.
     * @param {Object} job - Job object with name, media, stats, requirements, isMilestoneReward
     * @param {Object} manager - The adventuring manager
     * @returns {TooltipBuilder} This builder for chaining
     */
    static forJob(job, manager) {
        const tooltip = TooltipBuilder.create()
            .header(job.name, job.media);

        if(job.unlocked && job.isMilestoneReward) {
            tooltip.masteryProgressFor(manager, job);
            tooltip.stats(job.stats);
            tooltip.nextMilestone(manager, job);
        } else if(!job.unlocked) {
            tooltip.unlockRequirements(job.requirements, manager);
        }
        
        return tooltip;
    }

    /**
     * Create an ability tooltip (generator, spender, or passive).
     * @param {Object} ability - Ability object with name, description, energy/cost, requirements
     * @param {Object} options - Configuration options
     * @param {Object} [options.character] - Character object for stat-based description scaling
     * @param {Object} [options.manager] - Adventuring manager for job lookups
     * @param {string} [options.type] - Ability type: 'generator', 'spender', or 'passive'
     * @param {boolean} [options.showUnlockLevel=false] - Whether to show unlock level info
     * @param {Object} [options.masteryAction] - Action to check mastery level for unlock requirements
     * @param {boolean} [options.hideIfLocked=false] - Whether to show ??? for locked abilities (grimoire mode)
     * @returns {TooltipBuilder} This builder for chaining
     */
    static forAbility(ability, options = {}) {
        const { character, manager, type, showUnlockLevel = false, masteryAction, hideIfLocked = false, forceShowDescription = false, displayMode = 'total' } = options;
        const isUnlocked = ability.unlocked !== undefined ? ability.unlocked : true;
        const showDetails = isUnlocked || !hideIfLocked || forceShowDescription;
        
        const tooltip = TooltipBuilder.create()
            .header(showDetails ? ability.name : '???');
        
        // Type badge if provided
        if(type) {
            const typeColors = { generator: 'text-info', spender: 'text-warning', passive: 'text-success' };
            const typeLabels = { generator: 'Generator', spender: 'Spender', passive: 'Passive' };
            tooltip.info(`<span class="${typeColors[type]}">${typeLabels[type]}</span>`);
        }
        
        // Usable by section (before description when type is provided)
        if(manager && type) {
            const req = ability.requirements !== undefined ? ability.requirements.find(r => r.type === 'job_level' || r.type === 'current_job_level') : undefined;
            if(ability.isEnemy) {
                // Enemy abilities are usable only by Slayer
                const slayerJob = manager.cached.slayerJob;
                tooltip.separator();
                if(slayerJob) {
                    tooltip.hint(`Usable by: <img class="skill-icon-xxs mr-1" src="${slayerJob.media}">${slayerJob.name}`);
                } else {
                    tooltip.hint(`Usable by: Slayer`);
                }
            } else if(req) {
                const job = manager.jobs.getObjectByID(req.job);
                if(job) {
                    tooltip.separator();
                    if(req.type === 'current_job_level') {
                        tooltip.hint(`Usable by: <img class="skill-icon-xxs mr-1" src="${job.media}">${job.name}`);
                    } else {
                        tooltip.hint(`Usable by: All Jobs`);
                    }
                }
            } else {
                tooltip.separator();
                tooltip.hint(`Usable by: All Jobs`);
            }
        }
        
        // Description with stats - displayMode controls how scaling is shown
        tooltip.separator();
        if(isUnlocked || forceShowDescription) {
            const desc = ability.getDescription ? ability.getDescription(character, displayMode) : ability.description;
            tooltip.info(desc);
        } else {
            tooltip.warning('???');
        }
        
        // Energy cost/generation (for non-passives when unlocked)
        if(type !== 'passive' && isUnlocked) {
            if(ability.energy !== undefined) {
                tooltip.separator();
                tooltip.bonus(`+${ability.energy} Energy`);
            } else if(ability.cost !== undefined) {
                tooltip.separator();
                tooltip.penalty(`-${ability.cost} Energy`);
            }
        }
        
        // Usable by section (after description when no type is provided - combat selector style)
        if(manager && !type) {
            const req = ability.requirements !== undefined ? ability.requirements.find(r => r.type === 'job_level' || r.type === 'current_job_level') : undefined;
            if(ability.isEnemy) {
                // Enemy abilities are usable only by Slayer
                const slayerJob = manager.cached.slayerJob;
                tooltip.separator();
                if(slayerJob) {
                    tooltip.hint(`Usable by: <img class="skill-icon-xxs mr-1" src="${slayerJob.media}">${slayerJob.name}`);
                } else {
                    tooltip.hint(`Usable by: Slayer`);
                }
            } else if(req) {
                const job = manager.jobs.getObjectByID(req.job);
                if(job) {
                    tooltip.separator();
                    if(req.type === 'current_job_level') {
                        tooltip.hint(`Usable by: <img class="skill-icon-xxs mr-1" src="${job.media}">${job.name}`);
                    } else {
                        tooltip.hint(`Usable by: All Jobs`);
                    }
                    if(showUnlockLevel) {
                        tooltip.text(`<img class="skill-icon-xxs mr-1" src="${job.media}">Learned from ${job.name} Lv.${req.level}`, 'text-muted text-center');
                    }
                }
            } else {
                tooltip.separator();
                tooltip.hint(`Usable by: All Jobs`);
            }
        }
        
        // Unlock requirement with progress
        if(showUnlockLevel && masteryAction && manager) {
            const req = ability.requirements !== undefined ? ability.requirements.find(r => r.type === 'job_level' || r.type === 'current_job_level') : undefined;
            if(req) {
                const currentLevel = manager.getMasteryLevel(masteryAction);
                tooltip.separator();
                if(isUnlocked) {
                    tooltip.text(`Unlocked at Lv.${req.level}`, 'text-success');
                } else {
                    tooltip.warning(`Requires Lv.${req.level} (${currentLevel}/${req.level})`);
                }
            }
        }
        
        return tooltip;
    }

    /**
     * Create an equipment tooltip showing name, stats, upgrade info, and requirements.
     * @param {Object} item - Equipment item with name, media, stats, upgradeLevel, jobs, etc.
     * @param {Object} manager - The adventuring manager
     * @returns {TooltipBuilder} This builder for chaining
     */
    static forEquipment(item, manager) {
        const tooltip = TooltipBuilder.create()
            .header(item.name, item.media);

        if(item.unlocked) {
            // Upgrade stars
            const empty = `<i class="far fa-star text-muted"></i>`;
            const solid = `<i class="fa fa-star text-warning"></i>`;
            const half = `<i class="fa fa-star-half-alt text-warning"></i>`;
    
            const starCount = Math.floor(item.upgradeLevel / 2);
            const halfStarCount = item.upgradeLevel % 2;
            const emptyStarCount = ((item.maxUpgrades/2) - (starCount + halfStarCount));
            const stars = [...new Array(starCount).fill(solid), ...new Array(halfStarCount).fill(half), ...new Array(emptyStarCount).fill(empty)];

            tooltip.text(stars.join(''), 'text-center');
            
            // Level info
            if(item.upgradeLevel > 0) {
                if(item.level < item.levelCap) {
                    tooltip.masteryProgressFor(manager, item);
                    tooltip.hint(`Max Level: ${item.levelCap}`);
                } else {
                    tooltip.subheader(`Level ${item.level} / ${item.levelCap}`, 'text-warning');
                }
            } else {
                tooltip.hint(`Max Level: ${item.levelCap} (unlock to level up)`);
            }

            // Stats
            tooltip.stats(item.stats);

            // Usable by jobs
            tooltip.usableByJobs(item.jobs, manager);
            
            // Equipment Set info
            if(item.set) {
                tooltip.separator();
                tooltip.subheader(item.set.name, 'text-info');
                item.set.bonuses.forEach(bonus => {
                    tooltip.text(`<span class="text-muted">(${bonus.pieces}pc)</span> ${bonus.description}`, 'small');
                });
            }
            
            // Special effects
            if(item.effects && item.effects.length > 0) {
                tooltip.separator();
                item.getEffectDescriptions().forEach(desc => {
                    tooltip.info(desc);
                });
            }
            
            // Next milestone
            tooltip.nextMilestone(manager, item);
        }
        
        return tooltip;
    }

    /**
     * Create a monster tooltip showing name, icon, mastery progress, and drop bonuses.
     * @param {Object} monster - Monster object with name, media, unlocked
     * @param {Object} manager - The adventuring manager
     * @returns {TooltipBuilder} This builder for chaining
     */
    static forMonster(monster, manager) {
        const tooltip = TooltipBuilder.create()
            .header(monster.name, monster.media);

        if(monster.unlocked) {
            tooltip.masteryProgressFor(manager, monster);
            
            // Get mastery bonuses from modifier system
            tooltip.modifierBonuses(manager, monster, ['drop_rate_percent', 'drop_quantity_percent']);
            
            // Next milestone
            tooltip.nextMilestone(manager, monster);
        } else {
            tooltip.separator();
            tooltip.hint('Defeat this monster to unlock');
        }
        
        // Source hints - which areas contain this monster
        if (manager.monsterSources !== undefined) {
            tooltip.sourceHint(manager.monsterSources.get(monster), 'Found in');
        }
        
        return tooltip;
    }

    /**
     * Create an area tooltip showing name, mastery progress, bonuses, and difficulty.
     * @param {Object} area - Area object with name, media, unlocked, etc.
     * @param {Object} manager - The adventuring manager
     * @returns {TooltipBuilder} This builder for chaining
     */
    static forArea(area, manager) {
        const tooltip = TooltipBuilder.create()
            .header(area.name, area.media);

        if(area.unlocked) {
            tooltip.masteryProgressFor(manager, area);
            
            // Dungeon Mastery bonuses from area
            tooltip.effects(area.getMasteryBonusEffects(), manager);
            
            // Auto-run status (special case - not an effect)
            if(area.autoRepeatUnlocked) {
                const isActive = manager.autoRepeatArea === area;
                if(isActive) {
                    tooltip.info('Auto-Run ACTIVE');
                } else {
                    tooltip.hint('Auto-Run Available');
                }
            }
            
            // Next milestone
            const nextMilestone = area.getNextMilestone();
            if(nextMilestone) {
                let description = nextMilestone.description;
                if (!description && nextMilestone.effects !== undefined) {
                    description = nextMilestone.effects.map(e => describeEffect(e, manager)).join(', ');
                }
                if (!description) description = 'Unknown';
                tooltip.separator().nextUnlock(nextMilestone.level, description);
            } else {
                tooltip.separator().warning('Mastered!');
            }

            // Difficulty modes
            tooltip.difficultyInfo(area.getDifficulty(), manager);
            
            if(area.bestEndlessStreak > 0) {
                tooltip.separator().warning(`Best Endless: ${area.bestEndlessStreak} waves`);
            }

            // Mastery Aura (Level 99)
            if(area.masteryAura) {
                tooltip.separator();
                if(area.masteryAuraUnlocked) {
                    tooltip.warning(area.masteryAura.name);
                    tooltip.bonus(area.masteryAura._description || area.masteryAura.description);
                } else {
                    tooltip.nextUnlock(99, area.masteryAura.name);
                }
            }
        } else {
            // Show unlock requirements for locked areas
            tooltip.unlockRequirements(area.requirements, manager);
        }
        
        return tooltip;
    }

    /**
     * Create a consumable tooltip showing name, type, description, effects, and total charges.
     * @param {Object} consumable - Tiered consumable object with name, media, type, etc.
     * @returns {TooltipBuilder} This builder for chaining
     */
    static forConsumable(consumable) {
        const typeLabel = consumable.type ? (consumable.type.charAt(0).toUpperCase() + consumable.type.slice(1)) : 'Consumable';
        const tooltip = TooltipBuilder.create()
            .header(consumable.name, consumable.media)
            .subheader(typeLabel);
        
        // Show source job if defined
        if (consumable.sourceJob) {
            tooltip.hint(`Source: ${consumable.sourceJob.name}`);
        }
        
        // Show description
        if (consumable.description) {
            tooltip.separator().text(consumable.description, 'text-info');
        }
        
        // Show total charges
        const totalCharges = consumable.totalCharges;
        if (totalCharges > 0) {
            tooltip.separator().warning(`Charges: ${totalCharges}`);
        }
        
        return tooltip;
    }

    /**
     * Create a tooltip for a specific tier of a tiered consumable.
     * @param {Object} consumable - Tiered consumable object
     * @param {number} tier - The tier (1-4)
     * @returns {TooltipBuilder} This builder for chaining
     */
    static forConsumableTier(consumable, tier) {
        const typeLabel = consumable.type ? (consumable.type.charAt(0).toUpperCase() + consumable.type.slice(1)) : 'Consumable';
        const tierName = consumable.getTierName(tier);
        const tierMedia = consumable.getTierMedia(tier);
        const tierDesc = consumable.getTierDescription(tier);
        const charges = consumable.getCharges(tier);
        const materials = consumable.getTierMaterials(tier);
        
        const tooltip = TooltipBuilder.create()
            .header(tierName, tierMedia)
            .subheader(typeLabel);
        
        // Show description
        if (tierDesc) {
            tooltip.hint(tierDesc);
        }
        
        // Show charges
        if (charges > 0) {
            tooltip.separator().warning(`Charges: ${charges}`);
        }
        
        if(materials !== undefined && materials.size > 0) {
            tooltip.separator().hint('Craft Cost:');
            const costItems = [];
            materials.forEach((qty, material) => {
                const owned = material.count || 0;
                const color = owned >= qty ? 'text-success' : 'text-danger';
                costItems.push(tooltip.iconValue(material.media, `<span class="${color}">${qty}</span> <small class="text-muted">(${owned})</small>`));
            });
            tooltip.statRow(...costItems);
        }
        
        return tooltip;
    }

    /**
     * Create a tavern drink tooltip showing name, description, effects, and charges.
     * @param {Object} drink - TavernDrink object with name, media, description
     * @param {number} [chargesOrRuns=0] - Total charges or runs remaining
     * @returns {TooltipBuilder} This builder for chaining
     */
    static forTavernDrink(drink, chargesOrRuns = 0) {
        const tooltip = TooltipBuilder.create()
            .header(drink.name, drink.media)
            .subheader('Tavern Drink');
        
        if (drink.description) {
            tooltip.hint(drink.description);
        }
        
        // Show effects from tier 1 as representative
        const effects = drink.getTierEffects ? drink.getTierEffects(1) : null;
        if (effects && effects.length > 0) {
            tooltip.separator();
            tooltip.effects(effects);
        }
        
        if (chargesOrRuns > 0) {
            tooltip.separator().warning(`${chargesOrRuns} charge${chargesOrRuns !== 1 ? 's' : ''}`);
        }
        
        return tooltip;
    }

    /**
     * Create a building tooltip showing name, description, and unlock requirements.
     * @param {Object} building - Building object with name, media, description, unlocked, requirements
     * @param {Object} manager - The adventuring manager
     * @returns {TooltipBuilder} This builder for chaining
     */
    static forBuilding(building, manager) {
        const tooltip = TooltipBuilder.create()
            .header(building.name, building.media)
            .hint(building.description);
        
        if(!building.unlocked) {
            tooltip.unlockRequirements(building.requirements, manager);
        }
        
        return tooltip;
    }

    /**
     * Add stats from a Map<Stat, number> with standard formatting.
     * Adds separator before stats.
     * @param {Map} stats - Map of stat objects to values
     * @param {boolean} [addSeparator=true] - Whether to add separator before stats
     */
    stats(stats, addSeparator = true) {
        if(!stats || stats.size === 0) return this;
        if(addSeparator) this.separator();
        const statItems = [];
        stats.forEach((value, stat) => {
            if(!stat || !stat.media) return; // Skip invalid stats
            const prefix = value >= 0 ? '+' : '';
            const color = value >= 0 ? 'text-success' : 'text-danger';
            statItems.push(this.iconValue(stat.media, `${prefix}${value}`, color));
        });
        if(statItems.length > 0) {
            this.statRow(...statItems);
        }
        return this;
    }

    /**
     * Add "Usable By:" section showing job icons.
     * Only shows if there are valid jobs and not all jobs.
     * @param {Array} jobs - Array of job objects
     * @param {Object} manager - The adventuring manager (for total job count)
     * @param {boolean} [addSeparator=true] - Whether to add separator
     */
    usableByJobs(jobs, manager, addSeparator = true) {
        if(!jobs || jobs.length === 0) return this;
        const validJobs = jobs.filter(job => job !== manager.cached.noneJob);
        if(validJobs.length === 0 || validJobs.length >= manager.jobs.size) return this;
        
        if(addSeparator) this.separator();
        this.hint('Usable By:');
        const jobIcons = validJobs.map(job => 
            `<img class="skill-icon-xxs mr-1" src="${job.media}" title="${job.name}">`
        ).join('');
        this.text(jobIcons, 'text-center');
        return this;
    }

    /**
     * Add a requirements section
     */
    requirements(reqs) {
        if(!reqs || reqs.length === 0) return this;
        this.sectionTitle('Requirements');
        reqs.forEach(req => {
            const met = req.met !== false;
            const color = met ? 'text-success' : 'text-danger';
            this.text(`${req.text}`, color);
        });
        return this;
    }

    /**
     * Add a next unlock preview
     */
    nextUnlock(level, description) {
        this.sections.push(`<div class="mt-1"><small class="text-muted">${level}: ${description}</small></div>`);
        return this;
    }

    /**
     * Add the next milestone section for a mastery action.
     * Shows next unlock or "Mastered!" if at 99.
     * @param {Object} manager - The adventuring manager
     * @param {Object} action - The mastery action with category property
     * @param {boolean} [addSeparator=true] - Whether to add separator before content
     */
    nextMilestone(manager, action, addSeparator = true) {
        const level = manager.getMasteryLevel(action);
        const categoryId = action.category !== undefined ? action.category.id : undefined;
        if(!categoryId) return this;
        
        const nextMilestone = manager.getNextMasteryUnlock(level, categoryId);
        if(nextMilestone) {
            if(addSeparator) this.separator();
            // Generate description from effects if not explicitly provided
            let description = nextMilestone.description;
            if (!description && nextMilestone.effects !== undefined) {
                description = nextMilestone.effects.map(e => describeEffect(e, manager)).join(', ');
            }
            if (!description) description = 'Unknown';
            this.nextUnlock(nextMilestone.level, description);
        } else if(level >= 99) {
            if(addSeparator) this.separator();
            this.warning('Mastered!');
        }
        return this;
    }

    /**
     * Add unlock requirements for locked items
     * @param {Array} requirements - Array of requirement objects
     * @param {Object} manager - The adventuring manager for checking current levels
     */
    unlockRequirements(requirements, manager) {
        if(!requirements || requirements.length === 0) return this;
        
        this.separator();
        this.sectionTitle('Unlock Requirements');
        
        requirements.forEach(req => {
            const { text, met } = formatRequirement(req, manager);
            const color = met ? 'text-success' : 'text-danger';
            this.sections.push(`<div><small class="${color}">${text}</small></div>`);
        });
        
        return this;
    }

    /**
     * Build the final tooltip HTML
     */
    build() {
        return `<div class="text-left p-1" style="min-width: 150px; max-width: 300px;">${this.sections.join('')}</div>`;
    }
}
