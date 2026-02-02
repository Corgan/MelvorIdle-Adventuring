/**
 * Combat targeting utilities for resolving effect targets.
 */

/**
 * Get a random element from an array
 * @param {Array} array - The array to pick from
 * @returns {*} A random element or undefined if empty
 */
function randomElement(array) {
    if(!array || array.length === 0) return undefined;
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Check if a character is participating in combat (has a combat job that isn't "none")
 * @param {Object} character - The character to check
 * @returns {boolean} True if in combat
 */
export function isInCombat(character) {
    // Enemies are always in combat
    if (!character.combatJob) return true;
    return character.combatJob.id !== 'adventuring:none';
}

/**
 * Resolve targets for an effect based on targeting type.
 * Handles both single-target (self/attacker/target) and multi-target (all/front/back/etc).
 * 
 * @param {string} targetType - The targeting type (self, attacker, target, all, front, back, etc.)
 * @param {Object} context - Resolution context
 * @param {Object} context.party - The party to resolve multi-targets from
 * @param {Object} context.self - The source character (for 'self' targeting)
 * @param {Object} context.attacker - The attacker (for 'attacker' targeting)
 * @param {Object} context.target - The target (for 'target' targeting)
 * @param {Object} context.exclude - Character to exclude from multi-targeting
 * @param {boolean} context.allowDead - Whether to include dead targets (for remove effects)
 * @returns {Array} Array of target characters
 */
export function resolveTargets(targetType, context) {
    const { party, self, attacker, target, exclude, allowDead } = context;
    
    // Handle single-target types
    switch(targetType) {
        case "self":
            return self && (allowDead || !self.dead) ? [self] : [];
            
        case "attacker":
            return attacker && !attacker.dead ? [attacker] : [];
            
        case "target":
            return target && !target.dead ? [target] : [];
            
        case "none":
            return [];
    }
    
    // Multi-target types require a party
    if (!party) return [];
    
    // Filter to only include combatants (not "none" combat job heroes)
    const alive = party.all.filter(t => !t.dead && t !== exclude && isInCombat(t));

    switch(targetType) {
        case "front": {
            // Check front, then center, then back - but only if they're in combat
            if(!party.front.dead && party.front !== exclude && isInCombat(party.front)) return [party.front];
            if(!party.center.dead && party.center !== exclude && isInCombat(party.center)) return [party.center];
            if(!party.back.dead && party.back !== exclude && isInCombat(party.back)) return [party.back];
            return [];
        }

        case "back": {
            // Check back, then center, then front - but only if they're in combat
            if(!party.back.dead && party.back !== exclude && isInCombat(party.back)) return [party.back];
            if(!party.center.dead && party.center !== exclude && isInCombat(party.center)) return [party.center];
            if(!party.front.dead && party.front !== exclude && isInCombat(party.front)) return [party.front];
            return [];
        }

        case "center": {
            // Check center, then front, then back - but only if they're in combat
            if(!party.center.dead && party.center !== exclude && isInCombat(party.center)) return [party.center];
            if(!party.front.dead && party.front !== exclude && isInCombat(party.front)) return [party.front];
            if(!party.back.dead && party.back !== exclude && isInCombat(party.back)) return [party.back];
            return [];
        }

        case "cleave": {
            // Hits front and center (if alive and in combat)
            const targets = [];
            if(!party.front.dead && party.front !== exclude && isInCombat(party.front)) targets.push(party.front);
            if(!party.center.dead && party.center !== exclude && isInCombat(party.center)) targets.push(party.center);
            return targets;
        }

        case "random":
            return alive.length > 0 ? [randomElement(alive)] : [];

        case "lowest": {
            if(alive.length === 0) return [];
            const lowest = alive.reduce((min, t) =>
                (min === undefined || t.hitpointsPercent < min.hitpointsPercent) ? t : min
            , undefined);
            return lowest ? [lowest] : [];
        }

        case "aoe":
        case "all":
            return alive;

        case "dead":
            // Dead targeting still only considers combatants
            return party.all.filter(t => t.dead && t !== exclude && isInCombat(t));

        default:
            return [];
    }
}

/**
 * Sort characters by agility stat (highest first)
 * @param {Array} characters - Characters to sort
 * @param {Object} statsRegistry - Stats registry for stat lookup
 * @returns {Array} Sorted copy of characters array
 */
export function sortByAgility(characters, statsRegistry) {
    const agility = statsRegistry.getObjectByID("adventuring:agility");
    return [...characters].sort((a, b) =>
        b.getEffectiveStat(agility) - a.getEffectiveStat(agility)
    );
}
