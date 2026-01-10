const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');

/**
 * Base class for entity details pages (job details, monster details, etc.)
 * 
 * Provides common patterns:
 * - Entity management (setEntity, getEntity)
 * - Back button navigation
 * - Party lock/unlock on show/hide
 * - Common render patterns (name, icon)
 * - Render queue management
 * 
 * Subclasses should:
 * 1. Call super(manager, game, componentTag, backPage)
 * 2. Extend renderQueue in constructor with additional flags
 * 3. Override postDataRegistration() if needed
 * 4. Implement entity-specific render methods
 */
export class AdventuringDetailsPage extends AdventuringPage {
    /**
     * @param {Object} manager - Adventuring skill manager
     * @param {Object} game - Game instance
     * @param {string} componentTag - Custom element tag to create (e.g., 'adventuring-monster-details')
     * @param {Function} getBackPage - Function that returns the page to navigate to on back button
     */
    constructor(manager, game, componentTag, getBackPage) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this._getBackPage = getBackPage;
        
        this.component = createElement(componentTag);
        
        // Base render queue - subclasses can extend
        this.renderQueue = this.createRenderQueue();
        
        // Wire up back button if component has one
        if(this.component.back) {
            this.component.back.onclick = () => this.back();
        }
        
        // The entity being viewed (job, monster, etc.)
        this._entity = null;
    }

    /**
     * Create the render queue for this page
     * Override in subclasses to add additional flags
     * @returns {Object} Render queue with queueAll() method
     */
    createRenderQueue() {
        return {
            name: false,
            icon: false,
            queueAll() {
                this.name = true;
                this.icon = true;
            }
        };
    }

    /**
     * Navigate back
     */
    back() {
        if(this.active && this._getBackPage) {
            const backPage = this._getBackPage();
            if(backPage) {
                backPage.go();
            }
        }
    }

    /**
     * Get the current entity being viewed
     * @returns {Object|null}
     */
    get entity() {
        return this._entity;
    }

    /**
     * Set the entity to view
     * @param {Object} entity - The entity (job, monster, etc.)
     */
    setEntity(entity) {
        this._entity = entity;
        this.renderQueue.queueAll();
        this.onEntityChanged(entity);
    }

    /**
     * Called when the entity changes - override in subclasses for additional setup
     * @param {Object} entity - The new entity
     */
    onEntityChanged(entity) {
        // Override in subclass
    }

    onLoad() {
        super.onLoad();
    }

    onShow() {
        this.manager.party.setAllLocked(false);
    }

    onHide() {
        this.manager.party.setAllLocked(true);
    }

    postDataRegistration() {
        // Override in subclass if needed
    }

    /**
     * Main render method - calls individual render methods
     * Override to add additional render calls
     */
    render() {
        if(!this._entity) return;
        this.renderName();
        this.renderIcon();
    }

    /**
     * Render entity name
     */
    renderName() {
        if(!this.renderQueue.name) return;
        if(this.component.nameText && this._entity) {
            this.component.nameText.textContent = this._entity.name;
        }
        this.renderQueue.name = false;
    }

    /**
     * Render entity icon
     */
    renderIcon() {
        if(!this.renderQueue.icon) return;
        if(this.component.icon && this._entity) {
            this.component.icon.src = this._entity._media || this._entity.media;
        }
        this.renderQueue.icon = false;
    }

    /**
     * Helper to get mastery level required for an unlock type
     * @param {string} categoryId - Mastery category ID
     * @param {string} unlockType - The unlock type to find
     * @returns {number} The level required, or 0 if not found
     */
    getUnlockLevelForCategory(categoryId, unlockType) {
        const category = this.manager.masteryCategories.getObjectByID(categoryId);
        if(!category) return 0;
        
        for(const milestone of category.milestones) {
            if(milestone.effects) {
                for(const effect of milestone.effects) {
                    if(effect.type === 'unlock' && effect.unlockType === unlockType) {
                        return milestone.level;
                    }
                }
            }
        }
        return 0;
    }
}
