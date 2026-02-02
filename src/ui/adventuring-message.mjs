const { loadModule } = mod.getContext(import.meta);

const { AdventuringMessageElement } = await loadModule('src/ui/components/adventuring-message.mjs');

// All available log categories
export const LOG_CATEGORIES = {
    // Combat (5)
    combat_damage: { id: 'combat_damage', name: 'Combat: Damage', group: 'combat' },
    combat_heal: { id: 'combat_heal', name: 'Combat: Healing', group: 'combat' },
    combat_miss: { id: 'combat_miss', name: 'Combat: Miss/Dodge', group: 'combat' },
    combat_death: { id: 'combat_death', name: 'Combat: Death', group: 'combat' },
    combat_mechanics: { id: 'combat_mechanics', name: 'Combat: Mechanics', group: 'combat' },
    // Status (3)
    status_buff: { id: 'status_buff', name: 'Status: Buffs', group: 'status' },
    status_debuff: { id: 'status_debuff', name: 'Status: Debuffs', group: 'status' },
    status_cleanse: { id: 'status_cleanse', name: 'Status: Cleanse/Dispel', group: 'status' },
    // Loot (3)
    loot_items: { id: 'loot_items', name: 'Loot: Items', group: 'loot' },
    loot_materials: { id: 'loot_materials', name: 'Loot: Materials', group: 'loot' },
    loot_xp: { id: 'loot_xp', name: 'Loot: XP', group: 'loot' },
    // Dungeon (2)
    dungeon_progress: { id: 'dungeon_progress', name: 'Dungeon: Progress', group: 'dungeon' },
    dungeon_events: { id: 'dungeon_events', name: 'Dungeon: Events', group: 'dungeon' },
    // Other (4)
    slayer: { id: 'slayer', name: 'Slayer Tasks', group: 'other' },
    achievements: { id: 'achievements', name: 'Achievements', group: 'other' },
    town: { id: 'town', name: 'Town/Crafting', group: 'other' },
    system: { id: 'system', name: 'System', group: 'other' }
};

// Preset filter configurations
export const LOG_PRESETS = {
    all: {
        name: 'All',
        description: 'Show all messages',
        categories: Object.keys(LOG_CATEGORIES)
    },
    combat: {
        name: 'Combat',
        description: 'Combat and status effects',
        categories: ['combat_damage', 'combat_heal', 'combat_miss', 'combat_death', 'combat_mechanics', 
                     'status_buff', 'status_debuff', 'status_cleanse']
    },
    loot: {
        name: 'Loot',
        description: 'Items, materials, and XP',
        categories: ['loot_items', 'loot_materials', 'loot_xp', 'achievements']
    },
    minimal: {
        name: 'Minimal',
        description: 'Deaths and important loot only',
        categories: ['combat_death', 'loot_items', 'achievements']
    },
    progress: {
        name: 'Progress',
        description: 'Dungeon and slayer progress',
        categories: ['dungeon_progress', 'dungeon_events', 'slayer', 'achievements']
    }
};

export class AdventuringMessage {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-message');
        this.body = "";
        this.type = "info";
        this.media = null;
        this.ts = null;
        
        // New metadata for filtering
        this.category = 'system';  // Default category
        this.source = null;        // Source character object (hero/enemy)
        this.target = null;        // Target character object (hero/enemy)
    }
    
    /**
     * Get the slot position for a character (0=front, 1=center, 2=back, -1=enemy/unknown)
     */
    _getSlot(character) {
        if (!character) return -1;
        // Check if it's a hero with a slot
        if (character.isHero && this.manager?.party?.all) {
            const idx = this.manager.party.all.indexOf(character);
            if (idx >= 0) return idx;
        }
        return -1; // Enemy or unknown
    }

    /**
     * Check if this message passes the given filters
     * @param {Object} filters - { categories: Set, slots: Set, showAllSlots: boolean, showEnemyOnly: boolean }
     * @returns {boolean}
     */
    passesFilters(filters) {
        // Category filter
        if (filters.categories && !filters.categories.has(this.category)) {
            return false;
        }
        
        // Slot filter (if slot filtering is enabled)
        if (filters.slots && !filters.showAllSlots) {
            const sourceSlot = this._getSlot(this.source);
            const targetSlot = this._getSlot(this.target);
            
            const sourceIsHero = sourceSlot >= 0;
            const targetIsHero = targetSlot >= 0;
            
            if (sourceIsHero || targetIsHero) {
                // At least one hero is involved - require at least one enabled hero
                const sourceIsEnabledHero = sourceIsHero && filters.slots.has(sourceSlot);
                const targetIsEnabledHero = targetIsHero && filters.slots.has(targetSlot);
                
                if (!sourceIsEnabledHero && !targetIsEnabledHero) {
                    return false;
                }
            } else {
                // No heroes involved (enemy-only message)
                if (filters.showEnemyOnly === false) {
                    return false;
                }
            }
        }
        
        return true;
    }

    render() {
        this.component.body.innerHTML = this.body;

        this.component.classList.remove('msg-info', 'msg-rare', 'msg-epic', 'msg-legendary');
        this.component.classList.add(`msg-${this.type}`);

        if(this.media && this.component.icon) {
            this.component.icon.src = this.media;
            this.component.icon.classList.remove('d-none');
        } else if(this.component.icon) {
            this.component.icon.classList.add('d-none');
        }
    }
}