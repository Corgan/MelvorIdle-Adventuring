/**
 * Build complex descriptions for items, abilities, and skills with hits and effects.
 */

const { loadModule } = mod.getContext(import.meta);

const { 
    describeEffectFull, 
    formatTargetFromData 
} = await loadModule('src/core/effects/effect-descriptions.mjs');

/**
 * Parse a description template with replacements
 * @param {string} template - Template with {key} placeholders
 * @param {Object} replacements - Key-value pairs for replacement
 * @returns {string} Parsed description
 */
function parseDescription(template, replacements) {
    if(!template) return '';

    let result = template;
    for(const [key, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
}

/**
 * Build replacements from effects for template interpolation
 * @param {Array} effects - Array of effect objects
 * @param {Object} context - Context for getAmount calls
 * @param {boolean|string} displayMode - Display mode for scaling values
 * @returns {Object} Replacements object
 */
export function buildEffectReplacements(effects, context, displayMode = false) {
    const replacements = {};
    effects.forEach((effect, i) => {
        if(effect.getAmount) {
            replacements[`effect.${i}.amount`] = effect.getAmount(context, displayMode);
        }
        if(effect.getStacks) {
            replacements[`effect.${i}.stacks`] = effect.getStacks(context, displayMode);
        }
    });
    return replacements;
}

/**
 * Build replacements from hits for template interpolation
 * @param {Array} hits - Array of hit objects with effects
 * @param {Object} stats - Stats context for getAmount calls
 * @param {boolean|string} displayMode - Display mode for scaling values
 * @returns {Object} Replacements object
 */
export function buildHitEffectReplacements(hits, stats, displayMode = false) {
    const replacements = {};
    hits.forEach((hit, i) => {
        hit.effects.forEach((effect, e) => {
            if(effect.getAmount) {
                replacements[`hit.${i}.effect.${e}.amount`] = effect.getAmount(stats, displayMode);
            }
            if(effect.getStacks) {
                replacements[`hit.${i}.effect.${e}.stacks`] = effect.getStacks(stats, displayMode);
            }
        });
    });
    return replacements;
}

/**
 * Join multiple effect descriptions into a natural sentence
 * @param {Array} descriptions - Array of description strings
 * @returns {string} Combined description
 */
function joinEffectDescriptions(descriptions) {
    const filtered = descriptions.filter(d => d && d.trim());
    if (filtered.length === 0) return '';
    if (filtered.length === 1) return filtered[0];

    const lowercaseFirst = (str) => {
        if (!str) return str;
        const firstWord = str.split(/[\s,]/)[0];
        if (firstWord.length >= 2 && firstWord === firstWord.toUpperCase()) {
            return str;  // Keep as-is for acronyms like "XP", "HP", etc.
        }
        return str.charAt(0).toLowerCase() + str.slice(1);
    };

    const actionWords = ['Apply', 'Deal', 'Heal', 'Remove', 'Grant'];

    const groups = [];
    let currentGroup = null;

    for (const desc of filtered) {
        const firstWord = desc.split(' ')[0];
        const isActionWord = actionWords.includes(firstWord);

        if (isActionWord && currentGroup && currentGroup.action === firstWord) {
            currentGroup.items.push(desc);
        } else {
            currentGroup = {
                action: isActionWord ? firstWord : null,
                items: [desc]
            };
            groups.push(currentGroup);
        }
    }

    const processedParts = [];
    for (const group of groups) {
        if (group.action && group.items.length > 1) {
            const first = group.items[0];
            const rest = group.items.slice(1).map(d => d.substring(group.action.length + 1));
            processedParts.push(first);
            processedParts.push(...rest);
        } else {
            processedParts.push(...group.items);
        }
    }

    if (processedParts.length === 1) {
        return processedParts[0];
    } else if (processedParts.length === 2) {
        return `${processedParts[0]} and ${lowercaseFirst(processedParts[1])}`;
    }

    const parts = processedParts.map((d, idx) =>
        idx > 0 ? lowercaseFirst(d) : d
    );
    const lastPart = parts.pop();
    return `${parts.join(', ')}, and ${lastPart}`;
}

/**
 * Build a complete description for an item, ability, or skill.
 * Handles hits (multi-hit abilities), effects (passive/triggered), and templates.
 * 
 * @param {Object} config - Configuration object
 * @param {Array} [config.effects] - Array of effect objects
 * @param {Array} [config.hits] - Array of hit objects (for abilities)
 * @param {Object} config.manager - The adventuring manager
 * @param {string} [config.template] - Custom description template
 * @param {string} [config.flavorText] - Flavor text to append
 * @param {Object} [config.stats] - Stats context for scaling
 * @param {boolean|string} [config.displayMode='total'] - Display mode for values
 * @param {boolean} [config.includeTrigger=true] - Whether to include trigger text
 * @param {Function} [config.buildReplacements] - Custom replacement builder
 * @returns {string} The built description
 */
export function buildDescription(config) {
    const {
        effects,
        hits,
        manager,
        template,
        flavorText,
        stats,
        displayMode = 'total',
        includeTrigger = true,
        buildReplacements
    } = config;

    let desc = '';

    if (template !== undefined && template !== null) {
        const source = hits !== undefined ? hits : effects;
        const replacements = buildReplacements
            ? buildReplacements(source, stats, displayMode)
            : buildEffectReplacements(effects, stats, true);
        desc = parseDescription(template, replacements);
    }

    else if (hits !== undefined && hits.length > 0) {
        const hitDescs = [];

        const isSelfTargetingEffect = (effectType, hitParty) => {
            if (hitParty === 'ally') return false;
            const selfTypes = ['heal_flat', 'heal_percent', 'buff', 'energy', 'shield'];
            return selfTypes.includes(effectType);
        };

        for (let i = 0; i < hits.length; i++) {
            const hit = hits[i];
            if (hit.effects === undefined || hit.effects.length === 0) continue;

            const selfEffects = [];
            const targetEffects = [];

            for (let j = 0; j < hit.effects.length; j++) {
                const effect = hit.effects[j];
                const effectObj = {
                    type: effect.type,
                    trigger: effect.trigger !== undefined ? effect.trigger : 'on_use',
                    amount: effect.getAmount !== undefined
                        ? effect.getAmount(stats, displayMode)
                        : (effect.amount !== undefined && effect.amount.base !== undefined
                            ? effect.amount.base
                            : (effect.amount !== undefined ? effect.amount : 0)),
                    stacks: effect.getStacks !== undefined
                        ? effect.getStacks(stats, displayMode)
                        : (effect.stacks !== undefined && effect.stacks.base !== undefined
                            ? effect.stacks.base
                            : (effect.stacks !== undefined ? effect.stacks : 0)),
                    id: effect.id,
                    condition: effect.condition,
                    chance: effect.chance,
                    random: effect.random,
                    count: effect.count,
                    threshold: effect.threshold
                };
                let effectDesc = describeEffectFull(effectObj, manager, { displayMode, includeTrigger: false });

                if (isSelfTargetingEffect(effect.type, hit.party)) {
                    selfEffects.push(effectDesc);
                } else {
                    targetEffects.push(effectDesc);
                }
            }

            const target = hit.target;
            const party = hit.party;
            const repeat = hit.repeat !== undefined ? hit.repeat : 1;
            const hitParts = [];

            if (targetEffects.length > 0) {
                let targetDesc = joinEffectDescriptions(targetEffects);
                if (target === 'self') {
                    if (targetDesc.toLowerCase().includes('deal')) {
                        targetDesc = `${targetDesc} to self`;
                    }
                } else if (target) {
                    const targetName = formatTargetFromData(target, party);
                    if (targetName && !targetDesc.toLowerCase().includes(targetName.toLowerCase())) {
                        targetDesc = `${targetDesc} to ${targetName}`;
                    }
                }
                hitParts.push(targetDesc);
            }

            if (selfEffects.length > 0) {
                let selfDesc = joinEffectDescriptions(selfEffects);
                if (hitParts.length > 0) {
                    selfDesc = selfDesc.charAt(0).toLowerCase() + selfDesc.slice(1);
                }
                hitParts.push(selfDesc);
            }

            if (hitParts.length > 0) {
                hitDescs.push({ text: hitParts.join(' and '), repeat });
            }
        }

        if (hitDescs.length === 1) {
            const h = hitDescs[0];
            if (h.repeat > 1) {
                desc = `${h.text} (x${h.repeat})`;
            } else {
                desc = h.text;
            }
        } else if (hitDescs.length === 2) {
            if (hitDescs[0].text === hitDescs[1].text && hitDescs[0].repeat === 1 && hitDescs[1].repeat === 1) {
                desc = `${hitDescs[0].text} (hits twice)`;
            } else {
                const parts = hitDescs.map((h, i) => {
                    let text = i === 0 ? h.text : h.text.charAt(0).toLowerCase() + h.text.slice(1);
                    if (h.repeat > 1) text = `${text} (x${h.repeat})`;
                    return text;
                });
                desc = parts.join(', then ');
            }
        } else if (hitDescs.length > 2) {
            const allSame = hitDescs.every(h => h.text === hitDescs[0].text && h.repeat === hitDescs[0].repeat);
            if (allSame && hitDescs[0].repeat === 1) {
                desc = `${hitDescs[0].text} (hits ${hitDescs.length} times)`;
            } else {
                const parts = hitDescs.map((h, i) => {
                    let text = i === 0 ? h.text : h.text.charAt(0).toLowerCase() + h.text.slice(1);
                    if (h.repeat > 1) text = `${text} (x${h.repeat})`;
                    return text;
                });
                desc = parts.join(', then ');
            }
        }

        if (desc !== '') {
            desc = desc + '.';
        }
    }

    else if (effects !== undefined && effects.length > 0) {
        // Import describeEffects dynamically to avoid circular dependency
        const effectObjs = effects.map(effect => ({
            type: effect.type,
            trigger: effect.trigger !== undefined ? effect.trigger : 'passive',
            amount: effect.getAmount !== undefined
                ? effect.getAmount(stats, displayMode)
                : (effect.amount !== undefined && effect.amount.base !== undefined
                    ? effect.amount.base
                    : (effect.amount !== undefined ? effect.amount : 0)),
            stacks: effect.getStacks !== undefined
                ? effect.getStacks(stats, displayMode)
                : (effect.stacks !== undefined && effect.stacks.base !== undefined
                    ? effect.stacks.base
                    : (effect.stacks !== undefined ? effect.stacks : 0)),
            id: effect.id,
            stat: effect.stat,
            target: effect.target,
            party: effect.party,
            condition: effect.condition,
            chance: effect.chance,
            random: effect.random,
            count: effect.count,
            threshold: effect.threshold,
            describe: effect.describe
        }));

        // Build descriptions inline using describeEffectFull
        const descriptions = effectObjs
            .filter(e => e.describe !== false)
            .map(e => describeEffectFull(e, manager, { displayMode, includeTrigger }));
        
        desc = joinEffectDescriptions(descriptions);
        if (desc !== '') {
            desc = desc + '.';
        }
    }

    if (flavorText !== undefined && flavorText !== null && flavorText !== '') {
        desc = desc !== '' ? `${desc}<br><br><em>${flavorText}</em>` : `<em>${flavorText}</em>`;
    }

    return desc !== '' ? desc : '';
}
