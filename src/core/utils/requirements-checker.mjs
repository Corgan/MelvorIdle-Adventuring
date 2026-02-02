/**
 * Checks requirements for unlocking content.
 */
export class RequirementsChecker {

    constructor(manager, requirements = []) {
        this.manager = manager;
        this.requirements = requirements;
    }

    check(context = {}) {
        if (!this.requirements || this.requirements.length === 0) return true;
        return this.requirements.every(req => this.checkSingle(req, context));
    }

    checkSingle(req, context = {}) {
        if (!req || !req.type) {
            console.warn(`Malformed requirement:`, req);
            return true;
        }

        const { character } = context;

        switch (req.type) {
            case 'skill_level':
                return this.manager.level >= req.level;

            case 'melvor_skill_level': {
                const skill = this.manager.game.skills.getObjectByID(req.skill);
                if (!skill) {
                    console.warn(`[Adventuring] Unknown Melvor skill: ${req.skill}`);
                    return true;
                }
                return skill.level >= req.level;
            }

            case 'job_level':
                return this._checkJobLevel(req.job, req.level);

            case 'current_job_level':
                return this._checkCurrentJobLevel(req.job, req.level, character);

            case 'slayer_tasks_completed': {
                const totalTasks = this.manager.slayers !== undefined ? this.manager.slayers.totalTasksCompleted : 0;
                return totalTasks >= req.count;
            }

            case 'current_job':
                return this._hasCurrentJob(req.job, character);

            case 'dead':
                return character !== undefined ? character.dead : false;

            case 'comparison':
                return this._checkComparison(req, character);

            case 'area_mastery': {
                const area = this.manager.areas.getObjectByID(req.area);
                return area ? this.manager.getMasteryLevel(area) >= req.level : false;
            }

            case 'item_upgrade': {
                const item = this.manager.baseItems.getObjectByID(req.item);
                return item ? item.upgradeLevel >= req.level : false;
            }

            case 'achievement_completion': {
                if (this.manager.achievements === undefined) return false;
                const achievement = this.manager.achievements.getObjectByID(req.id);
                return achievement ? achievement.isComplete() : false;
            }

            case 'achievement_milestone': {
                if (this.manager.achievements === undefined) return false;
                const achievement = this.manager.achievements.getObjectByID(req.achievement);
                if (!achievement) return false;
                if (achievement.isMilestoneChain) {
                    return achievement.isMilestoneComplete(req.milestone);
                }
                return achievement.isComplete();
            }

            case 'area_cleared': {
                const area = this.manager.areas.getObjectByID(req.area);
                if (!area) return false;
                return this.manager.crossroads.clearedAreas.has(area.id);
            }

            case 'area_cleared_difficulty': {
                // Check if area has been cleared at least once on specific difficulty
                const fullAreaId = req.area.includes(':') ? req.area : `adventuring:${req.area}`;
                const fullDiffId = req.difficulty.includes(':') ? req.difficulty : `adventuring:${req.difficulty}`;
                const area = this.manager.areas.getObjectByID(fullAreaId);
                const difficulty = this.manager.difficulties.getObjectByID(fullDiffId);
                if (!area || !difficulty) return false;
                const areaDiffStat = this.manager.achievementStats.getObjectByID('adventuring:clears_by_area_difficulty');
                if (!areaDiffStat) return false;
                const clears = this.manager.achievementManager.stats.getNested(areaDiffStat, area, difficulty) || 0;
                return clears >= (req.count || 1);
            }

            case 'dropped':
                return context.item && context.item.dropped === true;

            case 'always_false':
                return false;

            case 'is_solo': {
                if (!this.manager.party) return false;
                const party = this.manager.party.all || [];
                if (party.length === 0) return false;
                const noneJobId = 'adventuring:none';
                const activeCombatants = party.filter(h =>
                    h.combatJob && h.combatJob.id !== noneJobId
                );
                return activeCombatants.length === 1;
            }

            default:
                console.warn(`Unknown requirement type: ${req.type}`);
                return false;
        }
    }

    _checkJobLevel(jobId, level) {
        const job = this.manager.jobs.getObjectByID(jobId);
        if (!job) return false;
        // Access actionMastery directly to avoid recursive job.unlocked checks
        // For requirement purposes, having the mastery level is sufficient
        const masteryData = this.manager.actionMastery.get(job);
        const masteryLevel = masteryData?.level ?? 1;
        return masteryLevel >= level;
    }

    _checkCurrentJobLevel(jobId, level, character) {
        if (!character) return this._checkJobLevel(jobId, level);

        const hasCombatJob = character.combatJob !== undefined && character.combatJob.id === jobId;
        const hasPassiveJob = character.passiveJob !== undefined && character.passiveJob.id === jobId;

        if (!hasCombatJob && !hasPassiveJob) return false;

        const job = this.manager.jobs.getObjectByID(jobId);
        if (!job) return false;
        // Access actionMastery directly to avoid recursive job.unlocked checks
        const masteryData = this.manager.actionMastery.get(job);
        const masteryLevel = masteryData?.level ?? 1;
        return masteryLevel >= level;
    }

    _hasCurrentJob(jobId, character) {
        if (!character) return false;
        const combatMatch = character.combatJob !== undefined && character.combatJob.id === jobId;
        const passiveMatch = character.passiveJob !== undefined && character.passiveJob.id === jobId;
        return combatMatch || passiveMatch;
    }

    _checkComparison(req, character) {
        let value;

        const property = req.property;
        const target = req.value;

        switch (property) {
            case 'hitpoints_percent':
                if (!character) return false;
                value = character.hitpointsPercent;
                break;
            case 'hitpoints':
                if (!character) return false;
                value = character.hitpoints;
                break;
            case 'energy':
                if (!character) return false;
                value = character.energy;
                break;
            case 'material_count': {
                const material = this.manager.materials.getObjectByID(req.material);
                if (!material) return false;
                const count = this.manager.stash.materialCounts.get(material);
                value = count !== undefined ? count : 0;
                break;
            }
            default:
                return false;
        }

        const op = req.operator;
        switch (op) {
            case '<':
                return value < target;
            case '<=':
                return value <= target;
            case '>':
                return value > target;
            case '>=':
                return value >= target;
            case '==':
                return value === target;
            default:
                return false;
        }
    }

    referencesJob(jobId) {
        return this.requirements.some(req =>
            (req.type === 'job_level' || req.type === 'current_job_level') &&
            req.job === jobId
        );
    }
}

/**
 * Format a single requirement for display.
 * @param {Object} req - The requirement object
 * @param {Object} manager - The manager instance
 * @param {Object} context - Optional context (e.g., item for drop requirements)
 * @returns {{ text: string, met: boolean }}
 */
export function formatRequirement(req, manager, context = {}) {
    const checker = new RequirementsChecker(manager, [req]);
    const met = checker.check(context);
    let text = '';

    switch (req.type) {
        case 'skill_level':
            text = `Adventuring Level ${req.level}`;
            break;

        case 'melvor_skill_level': {
            const skill = manager.game.skills.getObjectByID(req.skill);
            const skillName = skill !== undefined ? skill.name : req.skill;
            text = `${skillName} Level ${req.level}`;
            break;
        }

        case 'job_level': {
            const job = manager.jobs.getObjectByID(req.job);
            const jobName = job !== undefined ? job.name : req.job;
            text = `${jobName} Level ${req.level}`;
            break;
        }

        case 'current_job': {
            const job = manager.jobs.getObjectByID(req.job);
            const jobName = job !== undefined ? job.name : req.job;
            text = `Requires ${jobName} equipped`;
            break;
        }

        case 'current_job_level': {
            const job = manager.jobs.getObjectByID(req.job);
            const jobName = job !== undefined ? job.name : req.job;
            text = `${jobName} Level ${req.level} (equipped)`;
            break;
        }

        case 'area_mastery': {
            const area = manager.areas.getObjectByID(req.area);
            if (area && !area.unlocked) {
                text = 'Explore to discover unlock requirement';
            } else {
                const areaName = area !== undefined ? area.name : req.area;
                text = `${areaName} Mastery ${req.level}`;
            }
            break;
        }

        case 'item_upgrade': {
            const item = manager.baseItems.getObjectByID(req.item);
            const itemName = item !== undefined ? item.name : req.item;
            text = `${itemName} +${req.level}`;
            break;
        }

        case 'slayer_tasks_completed':
            text = `${req.count} Slayer Tasks Completed`;
            break;

        case 'comparison': {
            const operand = req.property || req.operand;
            const target = req.value !== undefined ? req.value : req.amount;
            const opSymbol = { '<': '<', 'lt': '<', '>': '>', 'gt': '>', '==': '=', 'eq': '=' }[req.operator] || req.operator;
            text = `${operand.replace(/_/g, ' ')} ${opSymbol} ${target}`;
            break;
        }

        case 'area_cleared': {
            const area = manager.areas.getObjectByID(req.area);
            const areaName = area !== undefined ? area.name : req.area;
            text = `Clear ${areaName}`;
            break;
        }

        case 'area_cleared_difficulty': {
            const area = manager.areas.getObjectByID(req.area);
            const areaName = area !== undefined ? area.name : req.area;
            const difficulty = manager.difficulties?.getObjectByID(req.difficulty);
            const diffName = difficulty !== undefined ? difficulty.name : req.difficulty;
            text = `Clear ${areaName} on ${diffName}`;
            break;
        }

        case 'dropped': {
            const monsters = manager?.equipmentSources?.get(context?.item);
            if (monsters && monsters.length > 0) {
                const monsterSources = manager?.monsterSources;
                const areaSet = new Set();

                for (const monster of monsters) {
                    const areas = monsterSources?.get(monster) || [];
                    for (const area of areas) {
                        areaSet.add(area);
                    }
                }

                const allAreas = [...areaSet];
                const unlockedAreas = allAreas.filter(a => a.unlocked);
                const hasLockedAreas = unlockedAreas.length < allAreas.length;

                if (unlockedAreas.length === 0) {
                    text = 'Explore to discover drop sources';
                } else if (unlockedAreas.length <= 3) {
                    text = `Drops in: ${unlockedAreas.map(a => a.name).join(', ')}`;
                    if (hasLockedAreas) {
                        text += ' (explore for more)';
                    }
                } else {
                    text = `Drops in: ${unlockedAreas.slice(0, 3).map(a => a.name).join(', ')} +${unlockedAreas.length - 3} more`;
                    if (hasLockedAreas) {
                        text += ' (explore for more)';
                    }
                }
            } else {
                text = 'Explore to discover drop sources';
            }
            break;
        }

        case 'always_false':
            text = req.hint || 'Special unlock required';
            break;

        case 'achievement_completion': {
            const achievement = manager.achievements?.getObjectByID(req.id);
            const achievementName = achievement !== undefined ? achievement.name : req.id;
            text = `Complete: ${achievementName}`;
            break;
        }

        case 'achievement_milestone': {
            const achievement = manager.achievements?.getObjectByID(req.achievement);
            if (achievement && achievement.isMilestoneChain) {
                const milestone = achievement.getMilestone(req.milestone);
                const milestoneName = milestone ? milestone.name : req.milestone;
                text = `Complete: ${milestoneName}`;
            } else {
                text = `Complete: ${req.achievement} (${req.milestone})`;
            }
            break;
        }

        case 'is_solo':
            text = 'Solo adventurer only';
            break;

        default:
            text = `${req.type}: ${req.level || req.value || '?'}`;
    }

    return { text, met };
}

/**
 * Format an array of requirements for display.
 * @param {Array} requirements - Array of requirement objects
 * @param {Object} manager - The manager instance
 * @param {Object} context - Optional context
 * @returns {Array<{ text: string, met: boolean }>}
 */
export function formatRequirements(requirements, manager, context = {}) {
    if (!requirements || requirements.length === 0) return [];
    return requirements.map(req => formatRequirement(req, manager, context));
}
