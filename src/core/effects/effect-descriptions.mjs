let descriptionData = null;
let descriptionMap = null;

/**
 * Load effect description data from JSON
 * @param {object} data - The skill data containing effect descriptions
 */
export function loadEffectDescriptions(data) {
    descriptionData = descriptionData || { 
        effectDescriptions: [], 
        triggers: {}, 
        targets: {}, 
        layouts: { default: '{effect}' },
        conditions: {},
        starterLoadouts: {}
    };
    
    if (data.effectDescriptions) {
        for (const desc of data.effectDescriptions) {
            descriptionData.effectDescriptions.push(desc);
        }
        
        // Build/rebuild lookup map
        descriptionMap = new Map();
        for (const desc of descriptionData.effectDescriptions) {
            descriptionMap.set(desc.type, desc);
        }
    }
    
    if (data.triggers) {
        Object.assign(descriptionData.triggers, data.triggers);
    }
    
    if (data.targets) {
        Object.assign(descriptionData.targets, data.targets);
    }
    
    if (data.layouts) {
        Object.assign(descriptionData.layouts, data.layouts);
    }
    
    if (data.conditions) {
        Object.assign(descriptionData.conditions, data.conditions);
    }
    
    if (data.starterLoadouts) {
        Object.assign(descriptionData.starterLoadouts, data.starterLoadouts);
    }
}

/**
 * Get the description data for an effect type
 * @param {string} type - The effect type
 * @returns {object|null} The description data or null
 */
export function getEffectDescriptionData(type) {
    return descriptionMap?.get(type) || null;
}

/**
 * Check if effect descriptions are loaded
 * @returns {boolean}
 */
export function isLoaded() {
    return descriptionMap !== null && descriptionMap.size > 0;
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

/**
 * Helper functions for values
 */
const helpers = {
    sign: (val) => val >= 0 ? '+' : '-',
    abs: (val) => Math.abs(val),
    percent: (val) => {
        if (val === undefined || val === null) return 0;
        return Math.abs(val) < 1 && val !== 0 ? Math.round(val * 100) : val;
    },
    plural: (val, suffix = 's') => val !== 1 ? suffix : '',
    capitalize: (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '',
    prettify: (id) => {
        if (!id) return 'Unknown';
        const parts = id.split(':');
        const lastPart = parts.length > 0 ? parts[parts.length - 1] : '';
        return lastPart ? lastPart.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown';
    }
};

/**
 * Resolve a stat name from ID
 */
function resolveStatName(statId, manager) {
    if (statId === 'all') return 'All Stats';
    if (!statId) return 'Unknown';
    
    if (manager?.stats) {
        const stat = manager.stats.getObjectByID(statId);
        if (stat?.name) return stat.name;
    }
    
    return helpers.prettify(statId);
}

/**
 * Resolve an aura name from ID
 */
function resolveAuraName(auraId, manager) {
    if (!manager?.auras) return helpers.prettify(auraId);
    
    let aura = manager.auras.getObjectByID(auraId);
    if (!aura && auraId && !auraId.includes(':')) {
        aura = manager.auras.getObjectByID(`adventuring:${auraId}`);
    }
    
    return aura?.name || helpers.prettify(auraId);
}

/**
 * Get value from effect, handling scaling objects
 */
function getEffectValue(effect, key, displayMode) {
    const raw = effect[key];
    if (raw === undefined || raw === null) return undefined;
    
    if (typeof raw !== 'object') return raw;
    
    const methodName = key === 'amount' ? 'getAmount' : key === 'stacks' ? 'getStacks' : null;
    if (methodName && typeof effect[methodName] === 'function') {
        return effect[methodName](null, displayMode !== false ? displayMode : 'multiplier');
    }
    
    if (raw.base !== undefined) return raw.base;
    return raw;
}

/**
 * Get a nested property using dot notation
 * @param {object} obj - The object to query
 * @param {string} path - Dot-separated path like "condition.type"
 * @returns {*} The value at the path, or undefined
 */
function getNestedValue(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
    }
    return current;
}

/**
 * Evaluate a single condition against an object
 * Supports: key, key=value, key!=value, key>value, key<value, key>=value, key<=value, !key
 */
function evaluateSingleCondition(condition, context) {
    condition = condition.trim();
    
    // NOT operator
    if (condition.startsWith('!')) {
        const key = condition.slice(1);
        const val = getNestedValue(context, key);
        return !val;
    }
    
    // Comparison operators (check longer ones first)
    const operators = ['>=', '<=', '!=', '=', '>', '<'];
    for (const op of operators) {
        const idx = condition.indexOf(op);
        if (idx > 0) {
            const key = condition.slice(0, idx);
            const compareVal = condition.slice(idx + op.length);
            const actualVal = getNestedValue(context, key);
            
            // Try numeric comparison
            const numCompare = parseFloat(compareVal);
            const numActual = parseFloat(actualVal);
            const isNumeric = !isNaN(numCompare) && !isNaN(numActual);
            
            switch (op) {
                case '=':
                    return isNumeric ? numActual === numCompare : String(actualVal) === compareVal;
                case '!=':
                    return isNumeric ? numActual !== numCompare : String(actualVal) !== compareVal;
                case '>':
                    return isNumeric && numActual > numCompare;
                case '<':
                    return isNumeric && numActual < numCompare;
                case '>=':
                    return isNumeric && numActual >= numCompare;
                case '<=':
                    return isNumeric && numActual <= numCompare;
            }
        }
    }
    
    // Bare key = truthy check
    const val = getNestedValue(context, condition);
    return val !== undefined && val !== null && val !== false && val !== 0 && val !== '';
}

/**
 * Evaluate a compound condition (supports && and ||)
 * @param {string} condition - Condition string like "random && count>1"
 * @param {object} context - The context object to evaluate against
 * @returns {boolean}
 */
function evaluateCompoundCondition(condition, context) {
    // Handle OR (lower precedence)
    if (condition.includes('||')) {
        const parts = condition.split('||');
        return parts.some(part => evaluateCompoundCondition(part.trim(), context));
    }
    
    // Handle AND (higher precedence)
    if (condition.includes('&&')) {
        const parts = condition.split('&&');
        return parts.every(part => evaluateSingleCondition(part.trim(), context));
    }
    
    // Single condition
    return evaluateSingleCondition(condition, context);
}

/**
 * Process inline conditionals in a template
 * Syntax: {?condition|text if true} or {?condition|text if true|text if false}
 * Supports nested {placeholder} inside conditional text.
 * @param {string} template - Template with inline conditionals
 * @param {object} context - The context object for condition evaluation
 * @param {object} values - The interpolation values
 * @returns {string}
 */
function processInlineConditionals(template, context, values) {
    // Process conditionals iteratively to handle nested structures
    let result = template;
    let changed = true;
    let iterations = 0;
    const maxIterations = 10; // Prevent infinite loops
    
    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        
        let i = 0;
        let newResult = '';
        
        while (i < result.length) {
            // Look for {?
            if (result[i] === '{' && result[i + 1] === '?') {
                const startIdx = i;
                i += 2; // Skip {?
                
                // Find the condition (up to first |)
                let condition = '';
                while (i < result.length && result[i] !== '|') {
                    condition += result[i];
                    i++;
                }
                
                if (i >= result.length) {
                    // Malformed, just copy as-is
                    newResult += result.slice(startIdx);
                    break;
                }
                
                i++; // Skip |
                
                // Parse true text (may contain {placeholders} or nested {?conditionals})
                let trueText = '';
                let depth = 1; // We're inside one { from the {?
                let foundPipe = false;
                let falseText = '';
                
                while (i < result.length && depth > 0) {
                    const char = result[i];
                    
                    if (char === '{') {
                        depth++;
                        if (!foundPipe) trueText += char;
                        else falseText += char;
                    } else if (char === '}') {
                        depth--;
                        if (depth === 0) {
                            // End of this conditional
                            i++;
                            break;
                        }
                        if (!foundPipe) trueText += char;
                        else falseText += char;
                    } else if (char === '|' && depth === 1 && !foundPipe) {
                        // This is the separator between true and false text
                        foundPipe = true;
                    } else {
                        if (!foundPipe) trueText += char;
                        else falseText += char;
                    }
                    i++;
                }
                
                // Evaluate the condition
                const condResult = evaluateCompoundCondition(condition.trim(), context);
                if (condResult) {
                    newResult += interpolate(trueText, values);
                } else if (foundPipe) {
                    newResult += interpolate(falseText, values);
                }
                // else: condition false and no false text, output nothing
                
                changed = true;
            } else {
                newResult += result[i];
                i++;
            }
        }
        
        result = newResult;
    }
    
    return result;
}

/**
 * Interpolate simple {key} placeholders
 */
function interpolate(template, values) {
    if (!template) return '';
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        return values[key] !== undefined ? values[key] : match;
    });
}

/**
 * Full template interpolation with conditionals
 */
function interpolateFull(template, context, values) {
    let result = processInlineConditionals(template, context, values);
    result = interpolate(result, values);
    return result;
}

/**
 * Build template values from effect
 */
function buildTemplateValues(effect, manager, displayMode) {
    const amount = getEffectValue(effect, 'amount', displayMode);
    const stacks = getEffectValue(effect, 'stacks', displayMode);
    const value = amount ?? stacks ?? effect.value ?? 0;
    const absValue = Math.abs(value);
    
    // Resolve target for use in templates
    const targetText = resolveTarget(effect.target, effect.party);
    
    return {
        // Basic values
        value: value,
        absValue: absValue,
        amount: amount ?? 0,
        stacks: stacks ?? 1,
        count: effect.count ?? 1,
        
        // Signed value (e.g., "+5" or "-5")
        signedValue: `${helpers.sign(value)}${absValue}`,
        
        // Legacy support
        sign: helpers.sign(value),
        
        // Percent conversion
        percent: helpers.percent(value),
        
        // Plurals
        pluralStacks: helpers.plural(stacks ?? 1),
        pluralCount: helpers.plural(effect.count ?? 1),
        
        // Lookups
        stat: resolveStatName(effect.stat, manager),
        aura: resolveAuraName(effect.id, manager),
        target: targetText,
        
        // Condition values
        chance: effect.condition?.value ?? effect.chance ?? value,
        threshold: (() => {
            let t = effect.threshold ?? effect.condition?.threshold ?? value ?? 0.2;
            if (t > 0 && t < 1) t = Math.round(t * 100);
            return t;
        })(),
        
        // Special fields
        category: helpers.capitalize(helpers.prettify(effect.category)),
        spawnType: helpers.capitalize(effect.spawnType || 'unknown'),
        difficulty: helpers.capitalize(helpers.prettify(effect.difficultyID)),
        unlockType: helpers.prettify(effect.unlockType || 'unknown')
    };
}

/**
 * Select template based on `when` conditions
 * @param {object} descData - Description data with template and optional when
 * @param {object} effect - The effect object
 * @returns {string} The selected template
 */
function selectTemplate(descData, effect) {
    if (descData.when) {
        for (const [condition, template] of Object.entries(descData.when)) {
            if (evaluateCompoundCondition(condition, effect)) {
                return template;
            }
        }
    }
    return descData.template;
}

/**
 * Resolve target to display string
 * @param {string} targetId - The target ID
 * @param {string} party - The party type (enemy/hero/ally)
 * @returns {string} The resolved target string
 */
function resolveTarget(targetId, party) {
    if (!targetId || targetId === 'self') return '';
    
    const targetEntry = descriptionData?.targets?.[targetId];
    if (targetEntry === undefined) return targetId.replace(/_/g, ' ');
    
    // String = absolute (no party needed)
    if (typeof targetEntry === 'string') {
        return targetEntry;
    }
    
    // Object = party-dependent lookup
    const partyKey = (party === 'ally' || party === 'player') ? 'hero' : (party || 'enemy');
    return targetEntry[partyKey] || targetEntry.enemy || targetId.replace(/_/g, ' ');
}

/**
 * Resolve trigger to display string
 * @param {string} triggerId - The trigger ID
 * @returns {string} The resolved trigger string (suffix form)
 */
function resolveTrigger(triggerId) {
    if (!triggerId) return '';
    const triggerText = descriptionData?.triggers?.[triggerId];
    if (triggerText !== undefined) return triggerText;
    return triggerId.replace(/_/g, ' ');
}

/**
 * Describe an effect using data-driven templates (effect only, no layout)
 * @param {object} effect - The effect to describe
 * @param {object} manager - The adventuring manager
 * @param {boolean|string} displayMode - Display mode for scaling values
 * @returns {string} The effect description
 */
export function describeEffectFromData(effect, manager, displayMode = false) {
    if (!effect) return '';
    if (effect.describe === false) return '';
    if (effect.description) return effect.description;
    
    const descData = descriptionMap?.get(effect.type);
    if (!descData) {
        const amount = getEffectValue(effect, 'amount', displayMode);
        if (amount !== undefined) {
            return `${effect.type}: ${amount}`;
        }
        return effect.type || 'Unknown effect';
    }
    
    const values = buildTemplateValues(effect, manager, displayMode);
    const template = selectTemplate(descData, effect);
    
    if (!template) {
        return effect.type || 'Unknown effect';
    }
    
    return interpolateFull(template, effect, values);
}

/**
 * Describe an effect with full layout (effect + trigger + target + condition)
 * @param {object} effect - The effect to describe
 * @param {object} manager - The adventuring manager
 * @param {object} options - Options { displayMode, trigger, target, party, condition, includeTrigger }
 * @returns {string} The full description with layout applied
 */
export function describeEffectFull(effect, manager, options = {}) {
    if (!effect) return '';
    if (effect.describe === false) return '';
    
    const { displayMode = false, trigger, target, party, condition, includeTrigger = true } = options;
    
    // Get the effect description
    const effectText = describeEffectFromData(effect, manager, displayMode);
    
    // Resolve trigger, target, and condition
    // If includeTrigger is false, don't include trigger in layout
    const triggerText = includeTrigger ? resolveTrigger(trigger || effect.trigger) : '';
    const targetText = resolveTarget(target || effect.target, party || effect.party);
    
    // Get condition text - skip for types that have built-in condition handling
    const typesWithBuiltInCondition = ['skip', 'miss', 'confuse', 'dodge'];
    const effectCondition = condition || effect.condition;
    const conditionText = (effectCondition && !typesWithBuiltInCondition.includes(effect.type))
        ? describeConditionFromData(effectCondition, manager)
        : '';
    
    // Get layout - per-effect override or named preset or default
    const descData = descriptionMap?.get(effect.type);
    let layout = descData?.layout;
    
    if (layout && descriptionData?.layouts?.[layout]) {
        // It's a named preset
        layout = descriptionData.layouts[layout];
    } else if (!layout) {
        // Use default
        layout = descriptionData?.layouts?.default || '{effect}';
    }
    
    // Build layout context and values
    const layoutContext = {
        trigger: !!triggerText,
        target: !!targetText,
        condition: !!conditionText
    };
    
    const layoutValues = {
        effect: effectText,
        trigger: triggerText,
        target: targetText,
        condition: conditionText
    };
    
    return interpolateFull(layout, layoutContext, layoutValues);
}

/**
 * Format a trigger name using data (for standalone use)
 * @param {string} trigger - The trigger ID
 * @returns {string} The formatted trigger name
 */
export function formatTriggerFromData(trigger) {
    return resolveTrigger(trigger);
}

/**
 * Format a target name using data (for standalone use)
 * @param {string} target - The target ID
 * @param {string} party - The party type (enemy/hero/ally)
 * @returns {string} The formatted target name
 */
export function formatTargetFromData(target, party) {
    return resolveTarget(target, party);
}

/**
 * Get all loaded trigger names
 * @returns {object} Map of trigger ID to display name
 */
export function getTriggers() {
    return descriptionData?.triggers || {};
}

/**
 * Get all loaded target names
 * @returns {object} Map of target ID to display name
 */
export function getTargets() {
    return descriptionData?.targets || {};
}

/**
 * Get all loaded layouts
 * @returns {object} Map of layout name to layout template
 */
export function getLayouts() {
    return descriptionData?.layouts || {};
}

/**
 * Get all loaded condition templates
 * @returns {object} Map of condition type to description template
 */
export function getConditions() {
    return descriptionData?.conditions || {};
}

/**
 * Get starter loadouts data
 * @returns {object} Map of position to loadout config
 */
export function getStarterLoadouts() {
    return descriptionData?.starterLoadouts || {};
}

/**
 * Describe a condition using data-driven templates
 * @param {object} condition - The condition object with type and params
 * @param {object} manager - The adventuring manager for lookups
 * @returns {string} Human-readable description
 */
export function describeConditionFromData(condition, manager) {
    if (!condition) return '';
    
    const template = descriptionData?.conditions?.[condition.type];
    if (!template) return condition.type;
    
    // Build values for interpolation
    const values = {
        threshold: condition.threshold ?? 30,
        min: condition.min ?? 1,
        value: condition.value ?? 0,
        aura: resolveAuraName(condition.id, manager)
    };
    
    return interpolate(template, values);
}

// ============================================================================
// Description Wrapper Functions
// ============================================================================

/**
 * Get aura name with fallback to prettified ID
 * @param {Object} manager - The adventuring manager
 * @param {string} auraId - The aura ID
 * @returns {string} The aura name
 */
export function getAuraName(manager, auraId) {
    if (!auraId) return 'Unknown';

    const idPart = auraId.split(':').pop();
    const prettified = idPart ? idPart.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown';
    if (manager === undefined || manager.auras === undefined) {
        return prettified;
    }
    const aura = manager.auras.getObjectByID(auraId);
    return aura !== undefined ? aura.name : prettified;
}

/**
 * Parse a description template with replacements
 * @param {string} template - Template with {key} placeholders
 * @param {Object} replacements - Key-value pairs for replacement
 * @returns {string} Parsed description
 */
export function parseDescription(template, replacements) {
    if(!template) return '';

    let result = template;
    for(const [key, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
}

/**
 * Describe a single effect (core text only, no layout)
 * @param {Object} effect - The effect to describe
 * @param {Object} manager - The adventuring manager
 * @param {boolean|string} displayMode - Display mode for scaling values
 * @returns {string} The effect description
 */
export function describeEffect(effect, manager, displayMode = false) {
    if (!effect) return '';
    if (effect.describe === false) return '';
    if (effect.description) return effect.description;
    return describeEffectFromData(effect, manager, displayMode);
}

/**
 * Format a trigger name (wrapper for formatTriggerFromData)
 * @param {string} trigger - The trigger ID
 * @returns {string} Formatted trigger text
 */
export function formatTrigger(trigger) {
    return formatTriggerFromData(trigger);
}

/**
 * Format a target name (wrapper for formatTargetFromData)
 * @param {string} target - The target ID
 * @param {string} party - The party type
 * @returns {string} Formatted target text
 */
export function formatTarget(target, party) {
    return formatTargetFromData(target, party);
}

/**
 * Format trigger as suffix (same as formatTrigger for data-driven)
 * @param {string} trigger - The trigger ID
 * @returns {string} Formatted trigger suffix
 */
export function formatTriggerSuffix(trigger) {
    return formatTriggerFromData(trigger);
}

/**
 * Join effect descriptions into natural sentence
 * @param {Array} descriptions - Array of description strings
 * @returns {string} Combined description
 */
export function joinEffectDescriptions(descriptions) {
    const filtered = descriptions.filter(d => d && d.trim());
    if (filtered.length === 0) return '';
    if (filtered.length === 1) return filtered[0];

    const lowercaseFirst = (str) => {
        if (!str) return str;
        const firstWord = str.split(/[\s,]/)[0];
        if (firstWord.length >= 2 && firstWord === firstWord.toUpperCase()) {
            return str;
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
 * Describe multiple effects with smart grouping by trigger/target
 * @param {Array} effects - Array of effect objects
 * @param {Object} manager - The adventuring manager
 * @param {Object} options - Options for description
 * @returns {string} Combined description
 */
export function describeEffects(effects, manager, options = {}) {
    if (!effects || effects.length === 0) return '';

    let mainEffects = effects.filter(e => e.describe !== false);
    
    if (mainEffects.length === 0) return '';

    const getTarget = (e) => e.target || options.target;
    const getParty = (e) => e.party || options.party;
    const getTrigger = (e) => e.trigger || options.trigger;

    const firstTarget = getTarget(mainEffects[0]);
    const firstParty = getParty(mainEffects[0]);
    const firstTrigger = getTrigger(mainEffects[0]);

    const allSameTarget = mainEffects.every(e =>
        getTarget(e) === firstTarget && getParty(e) === firstParty
    );
    const allSameTrigger = mainEffects.every(e => getTrigger(e) === firstTrigger);

    const lowercaseFirst = (str) => {
        if (!str) return str;
        const firstWord = str.split(/[\s,]/)[0];
        if (firstWord.length >= 2 && firstWord === firstWord.toUpperCase()) {
            return str;
        }
        return str.charAt(0).toLowerCase() + str.slice(1);
    };

    let combined;

    if (allSameTarget && allSameTrigger) {
        const descriptions = mainEffects.map(e =>
            describeEffectFullInternal(e, manager, {
                ...options,
                includeTrigger: false,
                target: null,
                party: null
            })
        );

        combined = joinEffectDescriptions(descriptions);

        if (firstTarget && firstTarget !== 'self') {
            const targetName = formatTargetFromData(firstTarget, firstParty);
            if (targetName && !combined.toLowerCase().includes(targetName.toLowerCase())) {
                combined = `${combined} to ${targetName}`;
            }
        }

        if (firstTrigger && firstTrigger !== 'passive' && firstTrigger !== 'on_use') {
            const triggerSuffix = formatTriggerFromData(firstTrigger);
            if (triggerSuffix && !combined.toLowerCase().includes('when below') && !combined.toLowerCase().includes('when above')) {
                combined = `${combined} ${triggerSuffix}`;
            }
        }
    } else {
        const triggerGroups = new Map();

        for (const e of mainEffects) {
            const trigger = getTrigger(e) || 'passive';
            if (!triggerGroups.has(trigger)) {
                triggerGroups.set(trigger, []);
            }
            triggerGroups.get(trigger).push(e);
        }

        const groupDescriptions = [];

        for (const [trigger, groupEffects] of triggerGroups) {
            const descriptions = groupEffects.map(e =>
                describeEffectFullInternal(e, manager, {
                    ...options,
                    includeTrigger: false
                })
            );

            let groupCombined = joinEffectDescriptions(descriptions);

            if (trigger && trigger !== 'passive' && trigger !== 'on_use') {
                const triggerSuffix = formatTriggerFromData(trigger);
                if (triggerSuffix && !groupCombined.toLowerCase().includes('when below') && !groupCombined.toLowerCase().includes('when above')) {
                    groupCombined = `${groupCombined} ${triggerSuffix}`;
                }
            }

            groupDescriptions.push(groupCombined);
        }

        if (groupDescriptions.length === 1) {
            combined = groupDescriptions[0];
        } else if (groupDescriptions.length === 2) {
            combined = `${groupDescriptions[0]} and ${lowercaseFirst(groupDescriptions[1])}`;
        } else {
            const first = groupDescriptions.shift();
            const last = groupDescriptions.pop();
            const middle = groupDescriptions.map(d => lowercaseFirst(d)).join(', ');
            combined = `${first}, ${middle}, and ${lowercaseFirst(last)}`;
        }
    }

    return combined;
}

/**
 * Describe effects as inline comma-separated list
 * @param {Array} effects - Array of effect objects
 * @param {Object} manager - The adventuring manager
 * @param {Object} options - Options including separator
 * @returns {string} Inline description
 */
export function describeEffectsInline(effects, manager, options = {}) {
    if (!effects || effects.length === 0) return '';
    const { separator = ', ' } = options;
    return effects
        .filter(e => e.describe !== false)
        .map(e => describeEffect(e, manager))
        .join(separator);
}

/**
 * Get array of effect descriptions (for list display)
 * @param {Array} effects - Array of effect objects
 * @param {Object} manager - The adventuring manager
 * @param {Object} options - Options including includeChance
 * @returns {Array} Array of description strings
 */
export function getEffectDescriptionsList(effects, manager, options = {}) {
    if (!effects || effects.length === 0) return [];
    const { includeChance = true } = options;

    return effects
        .filter(effect => effect.describe !== false)
        .map(effect => {
            if (effect.description) return effect.description;

            const trigger = formatTriggerFromData(effect.trigger);
            let desc = describeEffect(effect, manager);

            if (includeChance && effect.chance !== undefined && effect.chance < 100) {
                desc = `${effect.chance}% chance: ${desc}`;
            }

            if (trigger && effect.trigger !== 'passive') {
                return `${trigger}: ${desc}`;
            }

            return desc;
        });
}

/**
 * Internal function for describeEffectFull with limit suffix handling (sync)
 */
function describeEffectFullInternal(effect, manager, options = {}) {
    if (!effect) return '';
    if (effect.describe === false) return '';
    
    const { includeTrigger = true, includeChance = true, displayMode = false } = options;
    
    let desc = describeEffectFull(effect, manager, {
        displayMode,
        trigger: includeTrigger ? (effect.trigger || options.trigger) : null,
        target: effect.target || options.target,
        party: effect.party || options.party,
        condition: effect.condition
    });
    
    const chance = effect.chance || options.chance;
    if (includeChance && chance && chance < 100 && !desc.includes('% chance')) {
        desc = `${desc} (${chance}% chance)`;
    }
    
    if (effect.limit) {
        const times = effect.times || 1;
        const limitDesc = describeLimitSuffix(effect.limit, times);
        if (limitDesc) {
            desc = `${desc} ${limitDesc}`;
        }
    }
    
    if (effect.scope === 'party') {
        desc = `[Party] ${desc}`;
    }
    
    return desc;
}
