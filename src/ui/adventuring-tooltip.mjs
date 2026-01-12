const { loadModule } = mod.getContext(import.meta);

const { formatRequirement, describeEffectsInline, describeEffectFull, describeEffect } = await loadModule('src/core/adventuring-utils.mjs');

export class TooltipBuilder {
    constructor() {
        this.sections = [];
        this.currentSection = null;
    }

    static create() {
        return new TooltipBuilder();
    }

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

    subheader(text, color = 'text-info') {
        this.sections.push(`<div class="text-center"><small class="font-w600 ${color}">${text}</small></div>`);
        return this;
    }

    separator() {
        this.sections.push('<hr class="my-1 border-secondary">');
        return this;
    }

    sectionTitle(text) {
        this.sections.push(`<div class="font-w600 text-info mb-1">${text}</div>`);
        return this;
    }

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

    text(text, color = '') {
        this.sections.push(`<div><small class="${color}">${text}</small></div>`);
        return this;
    }

    bonus(text) {
        this.sections.push(`<div><small class="text-success">${text}</small></div>`);
        return this;
    }

    penalty(text) {
        this.sections.push(`<div><small class="text-danger">${text}</small></div>`);
        return this;
    }

    info(text) {
        this.sections.push(`<div><small class="text-info">${text}</small></div>`);
        return this;
    }

    hint(text) {
        this.sections.push(`<div><small class="text-muted">${text}</small></div>`);
        return this;
    }

    flavor(text) {
        this.sections.push(`<div><small class="text-muted font-italic">${text}</small></div>`);
        return this;
    }

    source(text, iconSrc = null) {
        let html = '<div class="text-center"><small class="text-muted">';
        if(iconSrc) {
            html += `<img class="skill-icon-xxs mr-1" src="${iconSrc}">`;
        }
        html += `${text}</small></div>`;
        this.sections.push(html);
        return this;
    }

    sourceHint(sources, prefix) {
        if(!sources || sources.length === 0) return this;

        const unlockedSources = sources.filter(s => s.unlocked);
        const hasLockedSources = unlockedSources.length < sources.length;

        if(unlockedSources.length === 0) {

            return this.source('Explore to discover sources');
        }

        const sourceNames = unlockedSources.slice(0, 3).map(s => s.name);
        let sourceText = sourceNames.join(', ');
        if(unlockedSources.length > 3) {
            sourceText += ` +${unlockedSources.length - 3} more`;
        }
        if(hasLockedSources) {
            sourceText += ' (explore for more)';
        }
        return this.source(`${prefix}: ${sourceText}`);
    }

    modifierBonuses(manager, action, modifierTypes) {
        const bonuses = modifierTypes
            .map(type => ({ type, amount: manager.modifiers.getBonus(type, { action }) }))
            .filter(b => b.amount > 0);

        if(bonuses.length === 0) return this;

        this.separator();
        bonuses.forEach(b => {
            this.bonus(describeEffect(b, manager));
        });
        return this;
    }

    effects(effects, manager = null, addSeparator = true) {
        if(!effects || effects.length === 0) return this;

        if(addSeparator) this.separator();
        effects.forEach(e => {
            const description = describeEffectFull(e, manager);

            const isPenalty = e.value < 0 || (e.type !== undefined && (e.type.includes('enemy_') || e.type.includes('_cost')));
            if(isPenalty) {
                this.penalty(description);
            } else {
                this.bonus(description);
            }
        });
        return this;
    }

    difficultyInfo(difficulty, manager = null) {
        if(!difficulty) return this;

        this.separator();
        this.subheader(`${difficulty.name} Mode`, difficulty.color);

        const effects = difficulty.effects || [];
        effects.forEach(e => {
            const description = describeEffectFull(e, manager);

            if(!description) return;
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

    warning(text) {
        this.sections.push(`<div><small class="text-warning">${text}</small></div>`);
        return this;
    }

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

    masteryProgressFor(manager, action, levelCap = null) {
        const totalXP = manager.getMasteryXP(action);
        const level = manager.getMasteryLevel(action);
        const currentLevelXP = exp.levelToXP(level);
        const nextLevelXP = exp.levelToXP(level + 1);
        const xpInLevel = Math.floor(totalXP - currentLevelXP);
        const xpToNextLevel = nextLevelXP - currentLevelXP;
        const percent = level >= 99 ? 100 : Math.min(100, (xpInLevel / xpToNextLevel) * 100);

        if (levelCap !== null) {

            const levelText = `Level ${level} / ${levelCap}`;
            this.sections.push(`<div class="text-center"><small class="text-info">${levelText}</small></div>`);
        }

        return this.masteryProgress(xpInLevel, xpToNextLevel, level, percent);
    }

    iconValue(iconSrc, value, color = '') {
        let html = '<span>';
        html += `<img class="skill-icon-xxs" style="height: .75rem; width: .75rem;" src="${iconSrc}">`;
        html += `<small class="${color}">${value}</small>`;
        html += '</span>';
        return html;
    }

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

    static forMaterial(material, manager = null) {
        const tooltip = TooltipBuilder.create()
            .header(material.name, material.media)
            .separator()
            .text(`Owned: ${material.count}`, 'text-center');

        if(manager !== undefined && manager.materialSources !== undefined) {
            tooltip.sourceHint(manager.materialSources.get(material), 'Drops from');
        }

        return tooltip;
    }

    static forJob(job, manager) {
        const displayName = job.unlocked ? job.name : '???';
        const tooltip = TooltipBuilder.create()
            .header(displayName, job.media);

        if(job.unlocked && job.isMilestoneReward) {
            tooltip.masteryProgressFor(manager, job);
            tooltip.stats(job.stats);
            tooltip.nextMilestone(manager, job);
        } else if(!job.unlocked) {
            tooltip.unlockRequirements(job.requirements, manager);
        }

        return tooltip;
    }

    static forAbility(ability, options = {}) {
        const { character, manager, type, showUnlockLevel = false, masteryAction, hideIfLocked = false, forceShowDescription = false, displayMode = 'total', skipUsableBy = false } = options;
        const isUnlocked = ability.unlocked !== undefined ? ability.unlocked : true;
        const showDetails = isUnlocked || !hideIfLocked || forceShowDescription;

        const tooltip = TooltipBuilder.create()
            .header(showDetails ? ability.name : '???');

        if(type) {
            const typeColors = { generator: 'text-info', spender: 'text-warning', passive: 'text-success' };
            const typeLabels = { generator: 'Generator', spender: 'Spender', passive: 'Passive' };
            tooltip.info(`<span class="${typeColors[type]}">${typeLabels[type]}</span>`);
        }

        if(manager && type && !skipUsableBy) {
            const req = ability.requirements !== undefined ? ability.requirements.find(r => r.type === 'job_level' || r.type === 'current_job_level') : undefined;
            if(ability.isEnemy) {

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

        tooltip.separator();
        if(isUnlocked || forceShowDescription) {
            const desc = ability.getDescription ? ability.getDescription(character, displayMode) : ability.description;
            tooltip.info(desc);
        } else {
            tooltip.warning('???');
        }

        if(type !== 'passive' && isUnlocked) {
            if(ability.energy !== undefined) {
                tooltip.separator();
                tooltip.bonus(`+${ability.energy} Energy`);
            } else if(ability.cost !== undefined) {
                tooltip.separator();
                tooltip.penalty(`-${ability.cost} Energy`);
            }
        }

        if(manager && !type && !skipUsableBy) {
            const req = ability.requirements !== undefined ? ability.requirements.find(r => r.type === 'job_level' || r.type === 'current_job_level') : undefined;
            if(ability.isEnemy) {

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

    static forEquipment(item, manager, character = null) {

        const isDropped = item.dropped;
        const displayName = isDropped ? item.name : '???';

        const tooltip = TooltipBuilder.create()
            .header(displayName, item.media);

        if(!isDropped) {
            return tooltip;
        }

        // Check if item is invalid for current job
        const isInvalidForJob = character && item.unlocked && item.upgradeLevel > 0 &&
            !item.jobs.includes(character.combatJob) && !item.jobs.includes(character.passiveJob);

        if(isInvalidForJob) {
            tooltip.separator();
            tooltip.text('<span class="text-danger"><i class="fas fa-exclamation-circle mr-1"></i>Invalid for current job - provides no stats</span>', 'small');
        }

        if(item.unlocked) {

            const empty = `<i class="far fa-star text-muted"></i>`;
            const solid = `<i class="fa fa-star text-warning"></i>`;
            const half = `<i class="fa fa-star-half-alt text-warning"></i>`;

            const starCount = Math.floor(item.upgradeLevel / 2);
            const halfStarCount = item.upgradeLevel % 2;
            const emptyStarCount = ((item.maxUpgrades/2) - (starCount + halfStarCount));
            const stars = [...new Array(starCount).fill(solid), ...new Array(halfStarCount).fill(half), ...new Array(emptyStarCount).fill(empty)];

            tooltip.sections.push(`<div class="text-center">${stars.join('')}</div>`);


            if(item.upgradeLevel > 0) {
                if(item.level < item.levelCap) {
                    tooltip.masteryProgressFor(manager, item);
                }

                if(character && item.isLevelCapped(character)) {
                    const effectiveLevel = item.getEffectiveLevel(character);
                    const jobName = character.combatJob ? character.combatJob.name : 'Job';
                    tooltip.subheader(`Level ${item.level}/${item.levelCap}`, '');
                    tooltip.text(`<span class="text-warning"><i class="fas fa-exclamation-triangle mr-1"></i>Effective: L${effectiveLevel} (${jobName} L${manager.getMasteryLevel(character.combatJob)})</span>`, 'small');
                } else {
                    tooltip.subheader(`Level ${item.level}/${item.levelCap}`, item.level >= item.levelCap ? 'text-warning' : '');
                }
            } else {
                tooltip.hint(`Level 1/${item.levelCap} (unlock to level up)`);
            }

            tooltip.stats(item.stats);

            tooltip.usableByJobs(item.jobs, manager);

            if(item.set) {
                tooltip.separator();
                tooltip.subheader(item.set.name, 'text-info');


                let equippedCount = 0;
                if(character) {
                    equippedCount = item.set.countEquippedPieces(character);
                } else if(manager.party && manager.party.all) {
                    for(const member of manager.party.all) {
                        const count = item.set.countEquippedPieces(member);
                        if(count > equippedCount) {
                            equippedCount = count;
                        }
                    }
                }
                item.set.bonuses.forEach(bonus => {
                    const isActive = equippedCount >= bonus.pieces;
                    const cssClass = isActive ? 'text-success' : 'text-muted';

                    let desc = bonus.description;
                    if(!desc && bonus.effects) {
                        desc = describeEffectsInline(bonus.effects, manager);
                    }
                    tooltip.text(`<span class="${cssClass}">(${bonus.pieces})</span> <span class="${cssClass}">${desc || 'Set Bonus'}</span>`, 'small');
                });
            }

            if(item.effects && item.effects.length > 0) {
                tooltip.separator();
                item.getEffectDescriptions().forEach(desc => {
                    tooltip.info(desc);
                });
            }

            tooltip.nextMilestone(manager, item);
        }

        return tooltip;
    }

    static forMonster(monster, manager) {
        const displayName = monster.unlocked ? monster.name : '???';
        const tooltip = TooltipBuilder.create()
            .header(displayName, monster.media);

        if(monster.unlocked) {
            tooltip.masteryProgressFor(manager, monster);

            tooltip.modifierBonuses(manager, monster, ['drop_rate_percent', 'drop_quantity_percent']);

            tooltip.nextMilestone(manager, monster);
        } else {
            tooltip.separator();
            tooltip.hint('Defeat this monster to unlock');
        }

        if (manager.monsterSources !== undefined) {
            tooltip.sourceHint(manager.monsterSources.get(monster), 'Found in');
        }

        return tooltip;
    }

    static forArea(area, manager) {
        const tooltip = TooltipBuilder.create()
            .header(area.name, area.media);

        if(area.unlocked) {
            tooltip.masteryProgressFor(manager, area);

            tooltip.effects(area.getMasteryBonusEffects(), manager);

            if(area.autoRunUnlocked) {
                const isActive = manager.autoRepeatArea === area;
                if(isActive) {
                    tooltip.info('Auto-Run ACTIVE');
                } else {
                    tooltip.hint('Auto-Run Available');
                }
            }

            const nextMilestone = area.getNextMilestone();
            if(nextMilestone) {
                let description = nextMilestone.description;
                if (!description && nextMilestone.effects !== undefined) {
                    description = describeEffectsInline(nextMilestone.effects, manager);
                }
                if (!description) description = 'Unknown';
                tooltip.separator().nextUnlock(nextMilestone.level, description);
            } else {
                tooltip.separator().warning('Mastered!');
            }

            tooltip.difficultyInfo(area.getDifficulty(), manager);

            if(area.bestEndlessStreak > 0) {
                tooltip.separator().warning(`Best Endless: ${area.bestEndlessStreak} waves`);
            }

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

            tooltip.unlockRequirements(area.requirements, manager);
        }

        return tooltip;
    }

    static forConsumable(consumable) {
        const tooltip = TooltipBuilder.create()
            .header(consumable.name, consumable.media);

        const effects = consumable.getTierEffects ? consumable.getTierEffects(1) : null;
        if (effects && effects.length > 0) {
            tooltip.effects(effects, consumable.manager);
        }

        const flavorText = consumable.getTierFlavorText ? consumable.getTierFlavorText(1) : null;
        if (flavorText) {
            tooltip.separator().flavor(flavorText);
        }

        const totalCharges = consumable.totalCharges;
        if (totalCharges > 0) {
            tooltip.separator().warning(`${totalCharges} charge${totalCharges !== 1 ? 's' : ''}`);
        }

        return tooltip;
    }

    static forConsumableTier(consumable, tier) {
        const tierName = consumable.getTierName(tier);
        const tierMedia = consumable.getTierMedia(tier);
        const charges = consumable.getCharges(tier);
        const materials = consumable.getTierMaterials(tier);

        const tooltip = TooltipBuilder.create()
            .header(tierName, tierMedia);

        const effects = consumable.getTierEffects ? consumable.getTierEffects(tier) : null;
        if (effects && effects.length > 0) {
            tooltip.effects(effects, consumable.manager);
        }

        const flavorText = consumable.getTierFlavorText ? consumable.getTierFlavorText(tier) : null;
        if (flavorText) {
            tooltip.separator().flavor(flavorText);
        }

        if (charges > 0) {
            tooltip.separator().warning(`${charges} charge${charges !== 1 ? 's' : ''}`);
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

    static forTavernDrink(drink, chargesOrRuns = 0) {
        const tooltip = TooltipBuilder.create()
            .header(drink.name, drink.media);

        const effects = drink.getTierEffects ? drink.getTierEffects(1) : null;
        if (effects && effects.length > 0) {
            tooltip.effects(effects, drink.manager);
        }

        const flavorText = drink.getTierFlavorText ? drink.getTierFlavorText(1) : null;
        if (flavorText) {
            tooltip.separator().flavor(flavorText);
        }

        if (chargesOrRuns > 0) {
            tooltip.separator().warning(`${chargesOrRuns} charge${chargesOrRuns !== 1 ? 's' : ''}`);
        }

        return tooltip;
    }

    static forBuilding(building, manager) {
        const tooltip = TooltipBuilder.create()
            .header(building.name, building.media)
            .hint(building.description);

        if(!building.unlocked) {
            tooltip.unlockRequirements(building.requirements, manager);
        }

        return tooltip;
    }

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

    nextUnlock(level, description) {
        this.sections.push(`<div class="mt-1"><small class="text-muted">${level}: ${description}</small></div>`);
        return this;
    }

    nextMilestone(manager, action, addSeparator = true) {
        const level = manager.getMasteryLevel(action);
        const categoryId = action.category !== undefined ? action.category.id : undefined;
        if(!categoryId) return this;

        const nextMilestone = manager.getNextMasteryUnlock(level, categoryId);
        if(nextMilestone) {
            if(addSeparator) this.separator();

            let description = nextMilestone.description;
            if (!description && nextMilestone.effects !== undefined) {
                description = describeEffectsInline(nextMilestone.effects, manager);
            }
            if (!description) description = 'Unknown';
            this.nextUnlock(nextMilestone.level, description);
        } else if(level >= 99) {
            if(addSeparator) this.separator();
            this.warning('Mastered!');
        }
        return this;
    }

    unlockRequirements(requirements, manager, context = {}) {
        if(!requirements || requirements.length === 0) return this;

        this.separator();
        this.sectionTitle('Unlock Requirements');

        requirements.forEach(req => {
            const { text, met } = formatRequirement(req, manager, context);
            const color = met ? 'text-success' : 'text-danger';
            this.sections.push(`<div><small class="${color}">${text}</small></div>`);
        });

        return this;
    }

    build() {
        return `<div class="text-left p-1" style="min-width: 150px; max-width: 300px;">${this.sections.join('')}</div>`;
    }
}
