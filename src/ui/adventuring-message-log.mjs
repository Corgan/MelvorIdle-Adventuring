const { loadModule } = mod.getContext(import.meta);

const { AdventuringMessageLogElement } = await loadModule('src/ui/components/adventuring-message-log.mjs');

const { AdventuringMessage, LOG_CATEGORIES, LOG_PRESETS } = await loadModule('src/ui/adventuring-message.mjs');

const DEFAULT_MESSAGE_LIMIT = 100;
const MIN_MESSAGE_LIMIT = 25;
const MAX_MESSAGE_LIMIT = 500;

class AdventuringMessageLogRenderQueue {
    constructor() {
        this.messages = false;
    }
    queueAll() {
        this.messages = true;
    }
}

/**
 * Manages filter settings for the message log
 */
class LogFilterSettings {
    constructor() {
        // Category filters - all enabled by default
        this.enabledCategories = new Set(Object.keys(LOG_CATEGORIES));
        
        // Slot filters - 0=front, 1=center, 2=back - all enabled by default
        this.enabledSlots = new Set([0, 1, 2]);
        this.showAllSlots = true;  // When true, slot filter is bypassed
        this.showEnemyOnly = true; // Show messages with no hero involvement
        
        // Message limit
        this.messageLimit = DEFAULT_MESSAGE_LIMIT;
        
        // Settings panel state
        this.settingsOpen = false;
    }
    
    /**
     * Apply a preset filter configuration
     */
    applyPreset(presetId) {
        const preset = LOG_PRESETS[presetId];
        if (!preset) return;
        
        this.enabledCategories.clear();
        for (const cat of preset.categories) {
            this.enabledCategories.add(cat);
        }
    }
    
    /**
     * Toggle a category on/off
     */
    toggleCategory(categoryId) {
        if (this.enabledCategories.has(categoryId)) {
            this.enabledCategories.delete(categoryId);
        } else {
            this.enabledCategories.add(categoryId);
        }
    }
    
    /**
     * Toggle a slot on/off (0=front, 1=center, 2=back)
     */
    toggleSlot(slot) {
        this.showAllSlots = false;
        if (this.enabledSlots.has(slot)) {
            this.enabledSlots.delete(slot);
        } else {
            this.enabledSlots.add(slot);
        }
    }
    
    /**
     * Enable all slots
     */
    enableAllSlots() {
        this.enabledSlots = new Set([0, 1, 2]);
        this.showAllSlots = true;
    }
    
    /**
     * Toggle showing enemy-only messages
     */
    toggleEnemyOnly() {
        this.showEnemyOnly = !this.showEnemyOnly;
    }
    
    /**
     * Get filter object for message filtering
     */
    getFilters() {
        return {
            categories: this.enabledCategories,
            slots: this.enabledSlots,
            showAllSlots: this.showAllSlots,
            showEnemyOnly: this.showEnemyOnly
        };
    }
    
    /**
     * Set message limit with bounds checking
     */
    setMessageLimit(limit) {
        this.messageLimit = Math.max(MIN_MESSAGE_LIMIT, Math.min(MAX_MESSAGE_LIMIT, limit));
    }
}

export class AdventuringMessageLog {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.renderQueue = new AdventuringMessageLogRenderQueue();
        this.component = createElement('adventuring-message-log');

        this.messages = [];
        this.filterSettings = new LogFilterSettings();
        
        // Wire up component callbacks
        this.component.onApplyPreset = (id) => this.applyPreset(id);
        this.component.onToggleCategory = (id) => this.toggleCategory(id);
        this.component.onToggleSlot = (slot) => this.toggleSlot(slot);
        this.component.onShowAllSlots = () => this.showAllSlots();
        this.component.onToggleEnemyOnly = () => this.toggleEnemyOnly();
        this.component.onSetLimit = (limit) => this.setMessageLimit(limit);
        
        // Provide settings data to component
        this.component.setSettingsData(this.filterSettings, LOG_CATEGORIES, LOG_PRESETS);
    }

    /**
     * Add a message to the log
     * @param {string} body - Message HTML content
     * @param {Object} options - Message options
     * @param {string} [options.type='info'] - Visual style: info, rare, epic, legendary
     * @param {string} [options.category='system'] - Filter category
     * @param {Object} [options.source=null] - Source character object (for slot filtering)
     * @param {Object} [options.target=null] - Target character object (for slot filtering)
     * @param {string} [options.media=null] - Icon URL
     */
    add(body, options = {}) {
        if(loadingOfflineProgress)
            return;

        const type = options.type || 'info';
        const category = options.category || 'system';
        const source = options.source || null;
        const target = options.target || null;
        const iconMedia = options.media || null;

        let message;
        const limit = this.filterSettings.messageLimit;
        if(this.messages.length >= limit) {
            message = this.messages.shift();
        } else {
            message = new AdventuringMessage(this.manager, this.game, this);
        }
        message.body = body;
        message.type = type;
        message.media = iconMedia;
        message.ts = Date.now();
        message.category = category;
        message.source = source;
        message.target = target;
        
        this.messages.push(message);
        this.renderQueue.messages = true;
    }
    
    /**
     * Get filtered messages based on current filter settings
     */
    getFilteredMessages() {
        const filters = this.filterSettings.getFilters();
        return this.messages.filter(msg => msg.passesFilters(filters));
    }
    
    /**
     * Apply a preset and refresh display
     */
    applyPreset(presetId) {
        this.filterSettings.applyPreset(presetId);
        this.renderQueue.messages = true;
    }
    
    /**
     * Toggle a category and refresh display
     */
    toggleCategory(categoryId) {
        this.filterSettings.toggleCategory(categoryId);
        this.renderQueue.messages = true;
    }
    
    /**
     * Toggle hero visibility
     */
    toggleSlot(slot) {
        this.filterSettings.toggleSlot(slot);
        this.renderQueue.messages = true;
    }
    
    /**
     * Show all slots
     */
    showAllSlots() {
        this.filterSettings.enableAllSlots();
        this.renderQueue.messages = true;
    }
    
    /**
     * Toggle enemy-only messages
     */
    toggleEnemyOnly() {
        this.filterSettings.toggleEnemyOnly();
        this.renderQueue.messages = true;
    }
    
    /**
     * Update message limit
     */
    setMessageLimit(limit) {
        this.filterSettings.setMessageLimit(limit);
        // Trim messages if over new limit
        while (this.messages.length > this.filterSettings.messageLimit) {
            this.messages.shift();
        }
        this.renderQueue.messages = true;
    }

    render() {
        this.renderMessages();
    }

    renderMessages() {
        if(!this.renderQueue.messages)
            return;

        let scroll = this.component.parentElement;

        let atBottom = scroll.clientHeight + scroll.scrollTop + 5 >= scroll.scrollHeight;
        let oldScrollHeight = scroll.scrollHeight;
        let oldScrollTop = scroll.scrollTop;

        // Get filtered messages
        const filteredMessages = this.getFilteredMessages();
        
        // Render only filtered messages
        filteredMessages.forEach(message => message.render());

        this.component.messages.replaceChildren(...filteredMessages.map(message => message.component));

        if(atBottom) {
            let scrollToHeight = scroll.scrollHeight - scroll.clientHeight;
            scroll.scroll({
                top: scrollToHeight,
                left: 0
              });
        } else {
            if(oldScrollHeight === scroll.scrollHeight)
                scroll.scrollBy({
                    top: scroll.scrollTop - oldScrollTop,
                    left: 0
                });
        }

        this.renderQueue.messages = false;
    }
    
    /**
     * Encode filter settings for save
     */
    encode(writer) {
        // Encode enabled categories as bitmask (17 categories)
        const categoryIds = Object.keys(LOG_CATEGORIES);
        let bitmask = 0n;
        for (let i = 0; i < categoryIds.length; i++) {
            if (this.filterSettings.enabledCategories.has(categoryIds[i])) {
                bitmask |= (1n << BigInt(i));
            }
        }
        writer.writeUint32(Number(bitmask));
        
        // Encode message limit
        writer.writeUint16(this.filterSettings.messageLimit);
        
        // Encode slot settings (3 bits for slots + 1 bit for showAllSlots + 1 bit for showEnemyOnly)
        let slotBits = 0;
        if (this.filterSettings.showAllSlots) slotBits |= 0b01000;
        if (this.filterSettings.showEnemyOnly) slotBits |= 0b10000;
        if (this.filterSettings.enabledSlots.has(0)) slotBits |= 0b00001;
        if (this.filterSettings.enabledSlots.has(1)) slotBits |= 0b00010;
        if (this.filterSettings.enabledSlots.has(2)) slotBits |= 0b00100;
        writer.writeUint8(slotBits);
        
        return writer;
    }
    
    /**
     * Decode filter settings from save
     */
    decode(reader, version) {
        const categoryIds = Object.keys(LOG_CATEGORIES);
        const bitmask = BigInt(reader.getUint32());
        
        this.filterSettings.enabledCategories.clear();
        for (let i = 0; i < categoryIds.length; i++) {
            if (bitmask & (1n << BigInt(i))) {
                this.filterSettings.enabledCategories.add(categoryIds[i]);
            }
        }
        
        this.filterSettings.messageLimit = reader.getUint16();
        
        // Decode slot settings
        const slotBits = reader.getUint8();
        this.filterSettings.showAllSlots = (slotBits & 0b01000) !== 0;
        this.filterSettings.showEnemyOnly = (slotBits & 0b10000) !== 0 || !(slotBits & 0b10000); // Default true for old saves
        this.filterSettings.enabledSlots.clear();
        if (slotBits & 0b00001) this.filterSettings.enabledSlots.add(0);
        if (slotBits & 0b00010) this.filterSettings.enabledSlots.add(1);
        if (slotBits & 0b00100) this.filterSettings.enabledSlots.add(2);

        return reader;
    }
}

export { LOG_CATEGORIES, LOG_PRESETS };