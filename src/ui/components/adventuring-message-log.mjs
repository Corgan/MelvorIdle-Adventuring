const { loadModule } = mod.getContext(import.meta);

const { createTooltip } = await loadModule('src/core/adventuring-tooltip-element.mjs');
const { AdventuringLogSettingsElement } = await loadModule('src/ui/components/adventuring-log-settings.mjs');

export class AdventuringMessageLogElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-message-log-template'));

        this.settingsBtn = getElementFromFragment(this._content, 'settings-btn', 'button');
        this.messages = getElementFromFragment(this._content, 'messages', 'div');
        
        this.settingsPopup = null;
        this.settingsPanel = null;
        
        this._filterSettings = null;
        this._categories = null;
        this._presets = null;
        
        this.onApplyPreset = null;
        this.onToggleCategory = null;
        this.onToggleSlot = null;
        this.onShowAllSlots = null;
        this.onSetLimit = null;
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
        
        // Create the settings panel element
        this.settingsPanel = new AdventuringLogSettingsElement();
        
        // Wire up callbacks
        this.settingsPanel.onApplyPreset = (id) => {
            if (this.onApplyPreset) this.onApplyPreset(id);
            this._refreshSettings();
        };
        this.settingsPanel.onToggleCategory = (id) => {
            if (this.onToggleCategory) this.onToggleCategory(id);
            this._refreshSettings();
        };
        this.settingsPanel.onToggleSlot = (slot) => {
            if (this.onToggleSlot) this.onToggleSlot(slot);
            this._refreshSettings();
        };
        this.settingsPanel.onShowAllSlots = () => {
            if (this.onShowAllSlots) this.onShowAllSlots();
            this._refreshSettings();
        };
        this.settingsPanel.onSetLimit = (limit) => {
            if (this.onSetLimit) this.onSetLimit(limit);
        };
        
        // Create interactive tippy with settings panel as content
        this.settingsPopup = createTooltip(this.settingsBtn, this.settingsPanel, {
            interactive: true,
            trigger: 'click',
            placement: 'bottom-end',
            maxWidth: 350,
            theme: 'adventuring-selector',
            appendTo: document.body,
            onShow: () => {
                this._refreshSettings();
            }
        });
    }

    disconnectedCallback() {
        if (this.settingsPopup) {
            this.settingsPopup.destroy();
            this.settingsPopup = null;
        }
    }
    
    /**
     * Update settings data (called by parent to keep settings in sync)
     */
    setSettingsData(filterSettings, categories, presets) {
        this._filterSettings = filterSettings;
        this._categories = categories;
        this._presets = presets;
    }
    
    /**
     * Refresh the settings panel with current state
     */
    _refreshSettings() {
        if (this.settingsPanel && this._filterSettings) {
            this.settingsPanel.render(this._filterSettings, this._categories, this._presets);
        }
    }
}
window.customElements.define('adventuring-message-log', AdventuringMessageLogElement);