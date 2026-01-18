/**
 * Evaluate a condition object against a context.
 * @param {Object} condition - The condition to evaluate
 * @param {Object} context - Context with character, target, manager, party, etc.
 * @returns {boolean} Whether the condition is met
 */
export function evaluateCondition(condition, context) {
    if (!condition) return true; // No condition = always true

    const { character, target, manager } = context;

    switch (condition.type) {
        case 'hp_below': {
            if (!character) return false;
            const hpPercent = (character.hitpoints / character.maxHitpoints) * 100;
            return hpPercent < (condition.threshold || 30);
        }

        case 'hp_above': {
            if (!character) return false;
            const hpPercent = (character.hitpoints / character.maxHitpoints) * 100;
            return hpPercent > (condition.threshold || 50);
        }

        case 'missing_hp': {
            if (!character) return false;
            const missingHp = character.maxHitpoints - character.hitpoints;
            return missingHp >= (condition.min || 1);
        }

        case 'has_buff': {
            if (!character || !character.auras) return false;
            return character.auras.has(condition.id);
        }

        case 'has_debuff': {
            if (!character || !character.auras) return false;
            return character.auras.has(condition.id);
        }

        case 'buff_stacks': {
            if (!character || !character.auras) return false;
            const aura = character.auras.get(condition.id);
            return aura && aura.stacks >= (condition.min || 1);
        }

        case 'enemy_hp_below': {
            if (!target) return false;
            const hpPercent = (target.hitpoints / target.maxHitpoints) * 100;
            return hpPercent < (condition.threshold || 25);
        }

        case 'enemy_hp_above': {
            if (!target) return false;
            const hpPercent = (target.hitpoints / target.maxHitpoints) * 100;
            return hpPercent > (condition.threshold || 50);
        }

        case 'chance': {
            const roll = Math.random() * 100;
            return roll < (condition.value || 0);
        }

        case 'is_injured': {
            if (!character) return false;
            return character.hitpoints < character.maxHitpoints;
        }

        case 'is_full_hp': {
            if (!character) return false;
            return character.hitpoints >= character.maxHitpoints;
        }

        case 'any_ally_injured': {
            if (!context.party) return false;
            return context.party.some(member =>
                !member.dead && member.hitpoints < member.maxHitpoints
            );
        }

        case 'all_allies_alive': {
            if (!context.party) return false;
            return context.party.every(member => !member.dead);
        }

        case 'hp_crossed_below': {
            if (!character) return false;
            const hpPercent = (character.hitpoints / character.maxHitpoints) * 100;
            const hpBefore = (context.hpPercentBefore !== undefined) ? context.hpPercentBefore : 100;
            const threshold = condition.threshold || 30;
            return hpBefore >= threshold && hpPercent < threshold;
        }

        case 'hp_crossed_above': {
            if (!character) return false;
            const hpPercent = (character.hitpoints / character.maxHitpoints) * 100;
            const hpBefore = (context.hpPercentBefore !== undefined) ? context.hpPercentBefore : 0;
            const threshold = condition.threshold || 50;
            return hpBefore < threshold && hpPercent >= threshold;
        }

        case 'is_solo': {
            // Check if character is the only active combatant in the party
            if (!context.party && !manager) return false;
            const party = context.party || (manager && manager.party ? manager.party.all : []);
            if (!party || party.length === 0) return false;
            const noneJobId = 'adventuring:none';
            const activeCombatants = party.filter(h =>
                h.combatJob && h.combatJob.id !== noneJobId
            );
            return activeCombatants.length === 1;
        }

        default:
            console.warn(`Unknown condition type: ${condition.type}`);
            return true;
    }
}

/**
 * Describe a condition in human-readable form.
 * @param {Object} condition - The condition object
 * @param {Object} manager - The manager for looking up aura names
 * @returns {string} Human-readable description
 */
export function describeCondition(condition, manager) {
    if (!condition) return '';

    const auraName = (auraId) => {
        if (manager === undefined) return auraId || 'Unknown';
        let aura = undefined;
        if (manager.auras !== undefined) aura = manager.auras.getObjectByID(auraId);
        if (aura === undefined && manager.buffs !== undefined) aura = manager.buffs.getObjectByID(auraId);
        if (aura === undefined && manager.debuffs !== undefined) aura = manager.debuffs.getObjectByID(auraId);
        return aura !== undefined ? aura.name : (auraId || 'Unknown');
    };

    switch (condition.type) {
        case 'hp_below':
            return `when below ${condition.threshold}% HP`;
        case 'hp_above':
            return `when above ${condition.threshold}% HP`;
        case 'missing_hp':
            return `when missing ${condition.min}+ HP`;
        case 'has_buff':
            return `while has ${auraName(condition.id)}`;
        case 'has_debuff':
            return `while has ${auraName(condition.id)}`;
        case 'buff_stacks':
            return `with ${condition.min}+ ${auraName(condition.id)} stacks`;
        case 'enemy_hp_below':
            return `vs enemies below ${condition.threshold}% HP`;
        case 'enemy_hp_above':
            return `vs enemies above ${condition.threshold}% HP`;
        case 'chance':
            return `(${condition.value}% chance)`;
        case 'is_injured':
            return `when injured`;
        case 'is_full_hp':
            return `at full HP`;
        case 'any_ally_injured':
            return `if any ally is injured`;
        case 'all_allies_alive':
            return `if all allies are alive`;
        case 'hp_crossed_below':
            return `when dropping below ${condition.threshold}% HP`;
        case 'hp_crossed_above':
            return `when rising above ${condition.threshold}% HP`;
        case 'is_solo':
            return `while adventuring solo`;
        default:
            return condition.type;
    }
}

/**
 * Describe a limit suffix for effect descriptions.
 * @param {string} limitType - The limit type (combat, round, turn)
 * @param {number} times - How many times per limit period
 * @returns {string} Human-readable suffix
 */
export function describeLimitSuffix(limitType, times) {
    if (!limitType) return '';

    const timesText = times === 1 ? 'once' : `${times} times`;

    switch (limitType) {
        case 'combat':
        case 'encounter':
            return `(${timesText} per encounter)`;
        case 'round':
            return `(${timesText} per round)`;
        case 'turn':
            return `(${timesText} per turn)`;
        default:
            return `(${timesText} per ${limitType})`;
    }
}
