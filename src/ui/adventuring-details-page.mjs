const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');

export class AdventuringDetailsPage extends AdventuringPage {

    constructor(manager, game, componentTag, getBackPage) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this._getBackPage = getBackPage;

        this.component = createElement(componentTag);
        this.renderQueue = this.createRenderQueue();
        if(this.component.back) {
            this.component.back.onclick = () => this.back();
        }
        this._entity = null;
    }

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

    back() {
        if(this.active && this._getBackPage) {
            const backPage = this._getBackPage();
            if(backPage) {
                backPage.go();
            }
        }
    }

    get entity() {
        return this._entity;
    }

    setEntity(entity) {
        this._entity = entity;
        this.renderQueue.queueAll();
        this.onEntityChanged(entity);
    }

    onEntityChanged(entity) {
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
    }

    render() {
        if(!this._entity) return;
        this.renderName();
        this.renderIcon();
    }

    renderName() {
        if(!this.renderQueue.name) return;
        if(this.component.nameText && this._entity) {
            this.component.nameText.textContent = this._entity.name;
        }
        this.renderQueue.name = false;
    }

    renderIcon() {
        if(!this.renderQueue.icon) return;
        if(this.component.icon && this._entity) {
            this.component.icon.src = this._entity._media || this._entity.media;
        }
        this.renderQueue.icon = false;
    }

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
