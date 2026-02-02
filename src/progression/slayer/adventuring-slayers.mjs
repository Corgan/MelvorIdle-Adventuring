const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { AdventuringSlayerTask, SlayerTaskGenerator } = await loadModule('src/progression/slayer/adventuring-slayer-task.mjs');
const { getEffectDescriptionsList } = await loadModule('src/core/utils/adventuring-utils.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { AdventuringIconButtonElement } = await loadModule('src/ui/components/adventuring-icon-button.mjs');

await loadModule('src/progression/components/adventuring-slayers.mjs');
const { AdventuringTaskRewardElement } = await loadModule('src/progression/components/adventuring-task-reward.mjs');
const { AdventuringStatBadgeElement } = await loadModule('src/progression/components/adventuring-stat-badge.mjs');
const { AdventuringAchievementRewardElement } = await loadModule('src/progression/components/adventuring-achievement-reward.mjs');
const { AdventuringInfoMessageElement } = await loadModule('src/ui/components/adventuring-info-message.mjs');
const { AdventuringEmptyStateElement } = await loadModule('src/ui/components/adventuring-empty-state.mjs');
const { AdventuringRunHistoryElement } = await loadModule('src/ui/components/adventuring-run-history.mjs');

class SlayersRenderQueue {
    constructor() {
        this.availableTasks = false;
        this.activeTasks = false;
        this.achievements = false;
        this.runs = false;
        this.stats = false;
        this.all = false;
    }
    queueAll() {
        this.availableTasks = true;
        this.activeTasks = true;
        this.achievements = true;
        this.runs = true;
        this.stats = true;
        this.all = true;
    }
}

export class AdventuringSlayers extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-slayers');
        this.renderQueue = new SlayersRenderQueue();

        this.activeTasks = [];           // Currently accepted tasks
        this.availableTasks = [];        // Tasks available to accept
        this.maxActiveTasks = 3;         // Max concurrent tasks
        this.maxAvailableTasks = 6;      // Number of available tasks shown
        this.totalTasksCompleted = 0;    // Lifetime completed tasks count

        this.abandonCost = 100;          // Cost to abandon a task
        this.refreshCost = 250;          // Cost to refresh available tasks

        this.currentTab = 'tasks';
        this.selectedCategory = null;  // null means show first category
        this.selectedRun = null;  // Currently selected run for details view

        this.taskGenerator = new SlayerTaskGenerator(manager, game);

        this.component.back.onclick = () => this.back();
        this.component.refreshButton.onclick = () => this.tryRefreshTasks();

        this.component.tabTasks.onclick = () => this.switchTab('tasks');
        this.component.tabAchievements.onclick = () => this.switchTab('achievements');
        this.component.tabRuns.onclick = () => this.switchTab('runs');
        this.component.tabStats.onclick = () => this.switchTab('stats');
        
        // Set up embedded run history component
        this.runHistoryComponent = new AdventuringRunHistoryElement();
        this.runHistoryComponent.setEmbedded(true);
    }

    switchTab(tab) {
        this.currentTab = tab;

        this.component.tabTasks.classList.toggle('active', tab === 'tasks');
        this.component.tabAchievements.classList.toggle('active', tab === 'achievements');
        this.component.tabRuns.classList.toggle('active', tab === 'runs');
        this.component.tabStats.classList.toggle('active', tab === 'stats');

        this.component.tasksContent.classList.toggle('d-none', tab !== 'tasks');
        this.component.achievementsContent.classList.toggle('d-none', tab !== 'achievements');
        this.component.runsContent.classList.toggle('d-none', tab !== 'runs');
        this.component.statsContent.classList.toggle('d-none', tab !== 'stats');

        if(tab === 'achievements') {
            this.renderQueue.achievements = true;
            this.render();
        } else if(tab === 'runs') {
            this.renderQueue.runs = true;
            this.render();
        } else if(tab === 'stats') {
            this.renderQueue.stats = true;
            this.render();
        }
    }

    back() {
        if(this.active) {
            this.manager.town.setBuilding(undefined);
        }
    }

    destroyTippyIn(container) {
        const elements = container.querySelectorAll('*');
        elements.forEach(el => {
            if(el._tippy) el._tippy.destroy();
        });
    }

    onLoad() {
        super.onLoad();
        this.renderQueue.queueAll();
        
        // Listen for events via conductor
        this.manager.conductor.listen('monster_killed', (type, context) => {
            if (context.monster) {
                this._onMonsterKilled(context.monster);
            }
        });
        
        this.manager.conductor.listen('dungeon_end', (type, context) => {
            if (context.area) {
                this._onDungeonCleared(context.area);
            }
            // Queue runs tab to re-render with new history
            this.renderQueue.runs = true;
        });
        
        this.manager.conductor.listen('material_collected', (type, context) => {
            if (context.material && context.quantity) {
                this._onMaterialCollected(context.material, context.quantity);
            }
        });
    }

    onShow() {
        this.manager.party.setAllLocked(false);

        this.fillAvailableTasks();

        this.renderQueue.all = true;
    }

    onHide() {
        this.manager.party.setAllLocked(true);
    }

    // Required by base class contract - no additional registration needed
    postDataRegistration() {
    }

    getTaskKey(task) {
        const typeId = task.taskType ? task.taskType.id : 'unknown';
        const targetId = task.targetId || 'unknown';
        const tier = task.tier || 1;
        return `${typeId}:${targetId}:${tier}`;
    }

    fillAvailableTasks() {

        const existingKeys = new Set();
        this.availableTasks.forEach(task => existingKeys.add(this.getTaskKey(task)));
        this.activeTasks.forEach(task => existingKeys.add(this.getTaskKey(task)));

        let attempts = 0;
        const maxAttempts = 50; // Prevent infinite loop

        while(this.availableTasks.length < this.maxAvailableTasks && attempts < maxAttempts) {
            attempts++;
            const newTasks = this.taskGenerator.generateAvailableTasks(1);
            if(newTasks.length === 0) {
                break; // No more tasks can be generated
            }

            const newTask = newTasks[0];
            const taskKey = this.getTaskKey(newTask);

            if(!existingKeys.has(taskKey)) {
                this.availableTasks.push(newTask);
                existingKeys.add(taskKey);
            }
        }
        this.renderQueue.availableTasks = true;
    }

    tryRefreshTasks() {
        const slayerCoins = this.manager.cached.slayerCoins;
        const currentCoins = this.manager.stash.materialCounts.get(slayerCoins) || 0;

        if(currentCoins < this.refreshCost) {
            this.manager.log.add(`Not enough Slayer Coins to refresh tasks! Need ${this.refreshCost}.`, {
                category: 'slayer'
            });
            return false;
        }

        this.manager.stash.remove(slayerCoins, this.refreshCost);
        this.manager.log.add(`Spent ${this.refreshCost} Slayer Coins to refresh tasks.`, {
            category: 'slayer'
        });

        this.availableTasks = [];
        this.fillAvailableTasks();

        return true;
    }

    acceptTask(task) {
        if(this.activeTasks.length >= this.maxActiveTasks) {
            this.manager.log.add("You have too many active tasks!", {
                category: 'slayer'
            });
            return false;
        }

        const index = this.availableTasks.indexOf(task);
        if(index === -1) return false;

        // Initialize starting value for stat-based tasks
        task.initializeStatTask();

        this.availableTasks.splice(index, 1);
        this.activeTasks.push(task);

        this.manager.log.add(`Accepted task: ${task.description}`, {
            category: 'slayer'
        });

        this.fillAvailableTasks();

        this.renderQueue.availableTasks = true;
        this.renderQueue.activeTasks = true;
        return true;
    }

    abandonTask(task) {
        const index = this.activeTasks.indexOf(task);
        if(index === -1) return false;

        const slayerCoins = this.manager.cached.slayerCoins;
        const currentCoins = this.manager.stash.materialCounts.get(slayerCoins) || 0;

        if(currentCoins < this.abandonCost) {
            this.manager.log.add(`Not enough Slayer Coins to abandon task! Need ${this.abandonCost}.`, {
                category: 'slayer'
            });
            return false;
        }

        this.manager.stash.remove(slayerCoins, this.abandonCost);

        this.activeTasks.splice(index, 1);
        this.manager.log.add(`Abandoned task: ${task.description} (-${this.abandonCost} Slayer Coins)`, {
            category: 'slayer'
        });

        this.renderQueue.activeTasks = true;
        return true;
    }

    claimTask(task) {
        if(!task.completed) return false;

        const index = this.activeTasks.indexOf(task);
        if(index === -1) return false;

        if(task.claim()) {
            this.activeTasks.splice(index, 1);
            this.totalTasksCompleted++;

            // Fire slayer_task_complete trigger (achievements listen)
            this.manager.conductor.trigger('slayer_task_complete', {
                task: task,
                taskType: task.taskType,
                tier: task.tier,
                targetId: task.targetId,
                totalCompleted: this.totalTasksCompleted,
                rewards: task.rewards
            });

            const rewardStrings = task.rewards.map(r => {
                if(r.type === 'currency') return `${r.qty} Slayer Coins`;
                if(r.type === 'xp') return `${r.qty} XP`;
                if(r.type === 'material') {
                    const mat = this.manager.materials.getObjectByID(r.id);
                    return `${r.qty} ${mat ? mat.name : r.id}`;
                }
                return '';
            }).filter(s => s);

            this.manager.log.add(`Claimed rewards: ${rewardStrings.join(', ')}`, {
                category: 'slayer'
            });
            this.renderQueue.activeTasks = true;
            return true;
        }
        return false;
    }

    /**
     * Internal handler for monster kill events.
     * @param {Object} monster - The monster that was killed
     */
    _onMonsterKilled(monster) {
        this.activeTasks.forEach(task => {

            if(task.taskType && task.taskType.id === 'adventuring:kill' && task.targetId === monster.id) {
                task.addProgress(1);
                this.renderQueue.activeTasks = true;
            }

            // Handle kill_tag tasks - the tag is stored on task.target.tag
            if(task.taskType && task.taskType.targetType === 'monster_tag' && task.target && task.target.isTagTarget) {
                const tag = task.target.tag;
                const tagId = tag ? tag.localID : null;
                if(tagId && monster.tags && monster.tags.includes(tagId)) {
                    task.addProgress(1);
                    this.renderQueue.activeTasks = true;
                }
            }
        });
    }

    /**
     * Internal handler for material collection events.
     * @param {Object} material - The material collected
     * @param {number} amount - Amount collected
     */
    _onMaterialCollected(material, amount) {
        this.activeTasks.forEach(task => {
            if(task.taskType && task.taskType.id === 'adventuring:collect' && task.targetId === material.id) {
                task.addProgress(amount);
                this.renderQueue.activeTasks = true;
            }
        });
    }

    /**
     * Internal handler for dungeon clear events.
     * @param {Object} area - The area that was cleared
     */
    _onDungeonCleared(area) {
        this.activeTasks.forEach(task => {
            if(task.taskType && task.taskType.id === 'adventuring:clear' && task.targetId === area.id) {
                task.addProgress(1);
                this.renderQueue.activeTasks = true;
            }
        });
    }

    render() {
        this.renderAvailableTasks();
        this.renderActiveTasks();
        this.renderAchievements();
        this.renderRuns();
        this.renderStats();
        this.renderQueue.all = false;
    }

    renderAchievements() {
        if(!this.renderQueue.achievements && !this.renderQueue.all)
            return;

        this.manager.achievementManager.checkIfDirty();

        this.renderAchievementSummary();
        this.renderAchievementCategoryFilter();
        this.renderAchievementList();

        this.renderQueue.achievements = false;
    }

    renderAchievementSummary() {
        if (!this.component?.achievementSummary) return;
        
        // Count total achievable items (regular achievements + all milestones in chains)
        let total = 0;
        let completed = 0;
        
        for (const achievement of this.manager.achievements.allObjects) {
            if (achievement.isMilestoneChain) {
                // Count each milestone separately
                total += achievement.milestones.length;
                completed += achievement._completedMilestones.size;
            } else {
                // Regular achievement counts as 1
                total += 1;
                if (achievement.isComplete()) {
                    completed += 1;
                }
            }
        }
        
        const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;

        this.component.achievementSummary.textContent = `${completed} / ${total} Complete`;
        this.component.achievementProgressBar.style.width = `${percent}%`;

        const stats = this.getAchievementStatTotals();
        this.component.achievementStats.replaceChildren();

        for(const stat of this.manager.stats.allObjects) {
            const value = stats[stat.localID] || 0;
            if(value > 0) {
                const badge = new AdventuringStatBadgeElement();
                badge.setStatDataFromStat(stat, value);
                this.component.achievementStats.appendChild(badge);
            }
        }
    }

    getAchievementStatTotals() {
        const totals = { currency: 0 };

        for(const achievement of this.manager.achievements.allObjects) {
            if(achievement.isComplete()) {
                for(const reward of achievement.rewards) {
                    if(reward.type === 'stat') {
                        const statId = reward.stat.replace('adventuring:', '');
                        totals[statId] = (totals[statId] || 0) + reward.value;
                    }
                }
            }
        }

        return totals;
    }

    renderAchievementCategoryFilter() {
        this.component.achievementCategoryFilter.replaceChildren();

        // Sort categories by ID for consistent display order
        const sortedCategories = [...this.manager.achievementCategories.allObjects]
            .sort((a, b) => a.id.localeCompare(b.id));

        // Default to first category if none selected
        if (!this.selectedCategory && sortedCategories.length > 0) {
            this.selectedCategory = sortedCategories[0].id;
        }

        for(const category of sortedCategories) {
            const btn = document.createElement('button');
            btn.className = `btn btn-sm btn-outline-info m-1 ${this.selectedCategory === category.id ? 'active' : ''}`;
            btn.textContent = category.name;
            btn.onclick = () => {
                this.selectedCategory = category.id;
                this.renderQueue.achievements = true;
                this.render();
            };
            this.component.achievementCategoryFilter.appendChild(btn);
        }
    }

    renderAchievementList() {
        this.component.achievementList.replaceChildren();

        let achievements = [...this.manager.achievements.allObjects];

        // Always filter by selected category
        if(this.selectedCategory) {
            achievements = achievements.filter(a => a.category && a.category.id === this.selectedCategory);
        }

        // Sort: incomplete first (by progress %), then complete
        achievements.sort((a, b) => {
            const aComplete = a.isComplete();
            const bComplete = b.isComplete();

            if(!aComplete && bComplete) return -1;
            if(aComplete && !bComplete) return 1;
            // Both same status - sort by progress (higher first for incomplete, doesn't matter for complete)
            return b.getProgressPercent() - a.getProgressPercent();
        });

        for(const achievement of achievements) {
            const card = this.createAchievementCard(achievement);
            this.component.achievementList.appendChild(card);
        }
    }

    createAchievementCard(achievement) {
        const template = document.getElementById('adventuring-achievement-card-template');
        const frag = template.content.cloneNode(true);

        const row = frag.firstElementChild;
        const card = frag.querySelector('#card');
        const icon = frag.querySelector('#icon');
        const name = frag.querySelector('#name');
        const categoryBadge = frag.querySelector('#category-badge');
        const description = frag.querySelector('#description');
        const progressBar = frag.querySelector('#progress-bar');
        const progressText = frag.querySelector('#progress-text');
        const rewards = frag.querySelector('#rewards');
        const claimBtn = frag.querySelector('#claim-btn');

        // Store card element refs for milestone selection updates
        const cardRefs = { card, icon, name, description, progressBar, progressText, rewards };

        icon.src = achievement.media;

        if(achievement.category) {
            categoryBadge.textContent = achievement.category.name;
            categoryBadge.className = `badge badge-${this.getCategoryColor(achievement.category.id)} font-size-xs`;
        }

        // For milestone chains, show milestone chain progress bar
        let milestoneProgress = null;
        let selectedMilestoneIndex = null;
        
        if(achievement.isMilestoneChain) {
            milestoneProgress = achievement.getMilestoneProgress();
            if(milestoneProgress && milestoneProgress.milestones.length > 1) {
                const chainRow = frag.querySelector('#milestone-chain');
                const iconsContainer = frag.querySelector('#milestone-icons');
                chainRow.classList.remove('d-none');
                
                // Find current milestone index for initial selection
                selectedMilestoneIndex = milestoneProgress.milestones.findIndex(m => m.isCurrent);
                if(selectedMilestoneIndex === -1) {
                    // All complete - select last one
                    selectedMilestoneIndex = milestoneProgress.milestones.length - 1;
                }
                
                this.renderMilestoneChain(iconsContainer, milestoneProgress, achievement, cardRefs, selectedMilestoneIndex);
            }
        }

        // Update card with current/selected milestone data
        this.updateCardForMilestone(cardRefs, achievement, milestoneProgress, selectedMilestoneIndex);

        // Hide claim button - achievements auto-complete
        claimBtn.classList.add('d-none');

        return row;
    }

    /**
     * Update achievement card display for a specific milestone (or the achievement itself)
     */
    updateCardForMilestone(cardRefs, achievement, milestoneProgress, milestoneIndex) {
        const { card, icon, name, description, progressBar, progressText, rewards } = cardRefs;

        let displayName, displayDesc, displayRewards, progress, target, isComplete;

        if(milestoneProgress && milestoneIndex !== null && milestoneIndex >= 0) {
            const milestone = milestoneProgress.milestones[milestoneIndex];
            displayName = milestone.name;
            displayDesc = milestone.description;
            displayRewards = milestone.rewards || [];
            isComplete = milestone.isComplete;
            
            // Get progress for this specific milestone
            progress = achievement.getProgress(milestone.requirement);
            target = achievement.getTarget(milestone.requirement);
        } else {
            displayName = achievement.name;
            displayDesc = achievement.description;
            displayRewards = achievement.rewards || [];
            isComplete = achievement.isComplete();
            progress = achievement.getProgress();
            target = achievement.getTarget();
        }

        const percent = Math.min(100, Math.floor((progress / target) * 100));

        name.textContent = displayName;
        description.textContent = displayDesc;
        progressBar.style.width = `${percent}%`;
        progressBar.className = `progress-bar ${isComplete ? 'bg-success' : 'bg-info'}`;
        progressText.textContent = `${progress} / ${target}`;

        // Update card border based on complete state (always have border to prevent pixel shift)
        card.classList.remove('border-success', 'border-transparent');
        card.classList.add('border');
        card.style.opacity = '';
        if(isComplete) {
            card.classList.add('border-success');
            card.style.opacity = '0.6';
        } else {
            card.classList.add('border-transparent');
        }

        // Clear and re-render rewards
        rewards.replaceChildren();
        this.renderRewards(rewards, displayRewards);
    }

    /**
     * Render reward icons into a container
     */
    renderRewards(container, rewardList) {
        for(const reward of rewardList) {
            const rewardEl = new AdventuringAchievementRewardElement();
            rewardEl.classList.add('mr-1');

            if(reward.type === 'currency') {
                rewardEl.setCurrency(reward.qty, this.manager.stash.currencyMedia, 'Adventuring Coins');
            } else if(reward.type === 'stat') {
                const stat = this.manager.achievementStats?.getObjectByID(reward.stat);
                const statName = stat ? stat.name : reward.stat.replace('adventuring:', '');
                const statIcon = stat ? stat.media : null;
                rewardEl.setStat(reward.value, statIcon, statName);
            } else if(reward.type === 'material') {
                const mat = this.manager.materials.getObjectByID(reward.id);
                if(mat) {
                    const tooltipContent = TooltipBuilder.forMaterial(mat, this.manager).build();
                    rewardEl.setMaterial(reward.qty, mat.media, tooltipContent);
                }
            } else if(reward.type === 'ability') {
                const ability = this.manager.getAbilityByID(reward.id);
                if(ability) {
                    const tooltipContent = TooltipBuilder.forAbility(ability, {
                        manager: this.manager,
                        showUnlockLevel: false,
                        displayMode: 'scale'
                    }).build();
                    rewardEl.setAbility(ability.name, null, tooltipContent);
                }
            } else if(reward.type === 'equipment') {
                const equip = this.manager.itemBase.getObjectByID(reward.id);
                if(equip) {
                    const tooltipContent = TooltipBuilder.forEquipment(equip, this.manager).build();
                    rewardEl.setMaterial(1, equip.media, tooltipContent);
                }
            } else if(reward.type === 'job') {
                const job = this.manager.jobs.getObjectByID(reward.id);
                if(job) {
                    rewardEl.setJob(job.name, job.media, `Unlock the ${job.name} job`);
                }
            } else if(reward.type === 'effect') {
                // Handle stat effects with icons instead of text
                let hasStatEffect = false;
                for(const effect of reward.effects) {
                    if(effect.type === 'stat_flat' || effect.type === 'stat_percent') {
                        hasStatEffect = true;
                        const statRewardEl = new AdventuringAchievementRewardElement();
                        statRewardEl.classList.add('mr-1');
                        const stat = this.manager.achievementStats?.getObjectByID(effect.stat);
                        const statName = stat ? stat.name : effect.stat.replace('adventuring:', '');
                        const statIcon = stat ? stat.media : null;
                        statRewardEl.setStat(effect.amount, statIcon, statName);
                        container.appendChild(statRewardEl);
                    }
                }
                // For non-stat effects, show as text
                if(!hasStatEffect) {
                    const descs = getEffectDescriptionsList(reward.effects, this.manager);
                    if(descs.length > 0) {
                        rewardEl.setEffect(descs.join(', '), 'Permanent bonus');
                        container.appendChild(rewardEl);
                    }
                }
                continue; // Skip the default appendChild since we handle it above
            }

            container.appendChild(rewardEl);
        }
    }

    /**
     * Render the milestone chain progress bar with icons
     * Format: [icon]──[icon]──[icon]──[icon]──[icon]
     */
    renderMilestoneChain(container, milestoneProgress, achievement, cardRefs, initialSelectedIndex) {
        const { milestones } = milestoneProgress;
        const iconButtons = [];
        
        for(let i = 0; i < milestones.length; i++) {
            const m = milestones[i];
            
            // Add connector line before icon (except for first)
            if(i > 0) {
                const connector = document.createElement('div');
                connector.className = 'milestone-connector';
                connector.style.cssText = `
                    width: 12px;
                    height: 2px;
                    background: ${m.isComplete ? '#28a745' : 'rgba(255,255,255,0.2)'};
                    flex-shrink: 0;
                    align-self: center;
                `;
                container.appendChild(connector);
            }
            
            // Create milestone icon using standard icon button
            const iconBtn = new AdventuringIconButtonElement();
            iconBtn.classList.add('milestone-icon');
            iconBtn.style.cssText = 'margin: 0; --icon-size: 28px; cursor: pointer;';
            
            // Determine border and badge based on milestone state
            let borderClass = 'border-secondary';
            let cornerBadgeText;
            let cornerBadgeClass;
            
            if(m.isComplete) {
                borderClass = 'border-success';
                cornerBadgeText = '✓';
                cornerBadgeClass = 'badge-success';
            } else if(m.isCurrent) {
                borderClass = 'border-warning';
            } else {
                // Locked - dim it
                iconBtn.style.opacity = '0.4';
                iconBtn.style.filter = 'grayscale(100%)';
            }
            
            // Build tooltip using TooltipBuilder
            const tooltipContent = TooltipBuilder.forMilestone(m, achievement, this.manager).build();
            
            iconBtn.setIcon({
                icon: achievement.media,
                borderClass,
                cornerBadgeText,
                cornerBadgeClass,
                tooltipContent
            });
            
            iconButtons.push(iconBtn);
            
            // Add click handler to select this milestone
            iconBtn.addEventListener('click', () => {
                this.selectMilestone(i, iconButtons, milestoneProgress, achievement, cardRefs);
            });
            
            container.appendChild(iconBtn);
        }
        
        // Apply initial selection styling
        if(initialSelectedIndex !== null && initialSelectedIndex >= 0) {
            this.updateMilestoneIcons(iconButtons, milestoneProgress, initialSelectedIndex);
        }
    }

    /**
     * Handle milestone selection - update card and icon styling
     */
    selectMilestone(index, iconButtons, milestoneProgress, achievement, cardRefs) {
        // Update icon styling
        this.updateMilestoneIcons(iconButtons, milestoneProgress, index);
        
        // Update card display
        this.updateCardForMilestone(cardRefs, achievement, milestoneProgress, index);
    }

    /**
     * Update milestone icon styling based on selection
     */
    updateMilestoneIcons(iconButtons, milestoneProgress, selectedIndex) {
        const { milestones } = milestoneProgress;
        
        for(let i = 0; i < iconButtons.length; i++) {
            const iconBtn = iconButtons[i];
            const m = milestones[i];
            
            // Determine border class based on state
            // Priority: selected (yellow) > complete (green) > incomplete (grey)
            let borderClass;
            if(i === selectedIndex) {
                borderClass = 'border-warning'; // Yellow for selected
            } else if(m.isComplete) {
                borderClass = 'border-success'; // Green for complete
            } else {
                borderClass = 'border-secondary'; // Grey for incomplete
            }
            
            // Reset opacity/filter
            iconBtn.style.opacity = '';
            iconBtn.style.filter = '';
            
            // Locked (not complete, not current, not selected) - dim it
            if(!m.isComplete && !m.isCurrent && i !== selectedIndex) {
                iconBtn.style.opacity = '0.4';
                iconBtn.style.filter = 'grayscale(100%)';
            }
            
            // Update border class using the component's border element
            if(iconBtn.border) {
                iconBtn.border.className = `border-2x border-rounded-equip combat-equip-img fishing-img m-0 ${borderClass}`;
            }
            
            // Update corner badge for complete milestones
            if(iconBtn.cornerBadge) {
                if(m.isComplete) {
                    iconBtn.cornerBadge.textContent = '✓';
                    iconBtn.cornerBadge.className = 'badge badge-success';
                    iconBtn.cornerBadge.style.cssText = 'position: absolute; top: 2px; right: 2px; font-size: 0.5rem; z-index: 10;';
                    iconBtn.cornerBadge.classList.remove('d-none');
                } else {
                    iconBtn.cornerBadge.classList.add('d-none');
                }
            }
        }
    }

    getCategoryColor(categoryId) {
        const colors = {
            'adventuring:combat': 'danger',
            'adventuring:dungeons': 'info',
            'adventuring:collection': 'warning',
            'adventuring:challenges': 'primary',
            'adventuring:town_jobs': 'secondary',
            'adventuring:job_mastery': 'success',
            'adventuring:area_mastery': 'info',
            'adventuring:monster_mastery': 'danger',
            'adventuring:equipment_mastery': 'warning',
            'adventuring:town': 'success',
            'adventuring:slayer': 'primary',
            'adventuring:gauntlets': 'warning',
            'adventuring:combat_jobs': 'danger'
        };
        return colors[categoryId] || 'secondary';
    }

    // ======== RUN HISTORY METHODS ========

    renderRuns() {
        if (!this.renderQueue.runs && !this.renderQueue.all)
            return;

        // Init the run history component if not done yet
        if (!this.runHistoryComponent._initialized) {
            this.runHistoryComponent.init(this.manager);
            this.runHistoryComponent._initialized = true;
            this.component.runsContainer.appendChild(this.runHistoryComponent);
        }
        
        // Queue a full render on the component
        this.runHistoryComponent.renderQueue.queueAll();
        this.runHistoryComponent.render();
        
        this.renderQueue.runs = false;
    }

    // ======== END RUN HISTORY METHODS ========

    renderStats() {
        if(!this.renderQueue.stats && !this.renderQueue.all)
            return;

        if (!this.component?.globalStatsList) {
            this.renderQueue.stats = false;
            return;
        }

        this.component.globalStatsList.replaceChildren();

        // Define which stats to show and their display configuration
        const statsToShow = [
            { id: 'adventuring:total_kills', icon: 'fa-skull', color: 'danger', label: 'Monsters Slain' },
            { id: 'adventuring:slayer_tasks_completed', icon: 'fa-scroll', color: 'warning', label: 'Slayer Tasks' },
            { id: 'adventuring:total_damage', icon: 'fa-bolt', color: 'danger', label: 'Total Damage' },
            { id: 'adventuring:total_healing', icon: 'fa-heart', color: 'success', label: 'Total Healing' },
            { id: 'adventuring:floors_explored', icon: 'fa-map', color: 'info', label: 'Floors Explored' },
            { id: 'adventuring:special_tiles_found', icon: 'fa-gem', color: 'warning', label: 'Special Tiles Found' },
            { id: 'adventuring:unique_monsters_seen', icon: 'fa-book', color: 'primary', label: 'Bestiary Entries' },
            { id: 'adventuring:combat_currency_earned', icon: 'fa-coins', color: 'warning', label: 'Currency Earned' },
            { id: 'adventuring:combat_materials_collected', icon: 'fa-box', color: 'info', label: 'Materials Collected' },
            { id: 'adventuring:equipment_upgrades', icon: 'fa-arrow-up', color: 'success', label: 'Equipment Upgrades' },
            { id: 'adventuring:buffs_applied', icon: 'fa-plus-circle', color: 'success', label: 'Buffs Applied' },
            { id: 'adventuring:debuffs_applied', icon: 'fa-minus-circle', color: 'danger', label: 'Debuffs Applied' }
        ];

        for(const statConfig of statsToShow) {
            const value = this.manager.achievementManager.stats.get(statConfig.id) || 0;

            const col = document.createElement('div');
            col.className = 'col-6 col-md-4 col-lg-3 mb-3';

            const block = document.createElement('div');
            block.className = 'block block-rounded-double bg-combat-inner-dark p-3 text-center h-100';

            const icon = document.createElement('i');
            icon.className = `fa ${statConfig.icon} fa-2x text-${statConfig.color} mb-2`;

            const valueEl = document.createElement('div');
            valueEl.className = 'font-w700 font-size-h4';
            valueEl.textContent = this.formatStatValue(value);

            const label = document.createElement('small');
            label.className = 'text-muted';
            label.textContent = statConfig.label;

            block.appendChild(icon);
            block.appendChild(valueEl);
            block.appendChild(label);
            col.appendChild(block);
            this.component.globalStatsList.appendChild(col);
        }

        this.renderQueue.stats = false;
    }

    formatStatValue(value) {
        if(value >= 1000000) {
            return (value / 1000000).toFixed(1) + 'M';
        } else if(value >= 1000) {
            return (value / 1000).toFixed(1) + 'K';
        }
        return Math.floor(value).toLocaleString();
    }

    getDifficultyColor(difficulty) {
        if(!difficulty) return 'secondary';
        const id = difficulty.localID || difficulty.id.replace('adventuring:', '');
        const colors = {
            'normal': 'secondary',
            'heroic': 'warning',
            'mythic': 'danger',
            'endless': 'info'
        };
        return colors[id] || 'secondary';
    }

    formatNumber(num) {
        if(num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if(num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return Math.floor(num).toString();
    }

    // ======== END RUN HISTORY METHODS ========

    hasSeenMonsters() {
        return this.manager.bestiary.seen.size > 0;
    }

    renderAvailableTasks() {
        if(!this.renderQueue.availableTasks && !this.renderQueue.all)
            return;

        if (!this.component?.availableTasks) {
            this.renderQueue.availableTasks = false;
            return;
        }

        this.destroyTippyIn(this.component.availableTasks);
        this.component.availableTasks.replaceChildren();

        if(!this.hasSeenMonsters()) {
            const message = new AdventuringInfoMessageElement();
            message.setMessage({
                icon: 'fa-map-signs',
                title: 'No tasks available yet!',
                titleClass: 'text-warning',
                description: 'Visit the <strong>Chicken Coop</strong> and defeat some monsters first.<br>Then return here to pick up slayer tasks.'
            });
            this.component.availableTasks.appendChild(message);
            this.component.refreshButton.classList.add('d-none');
        } else {
            this.component.refreshButton.classList.remove('d-none');

            this.availableTasks.forEach(task => {
                const card = this.createTaskCard(task, 'available');
                this.component.availableTasks.appendChild(card);
            });

            this.component.refreshCost.textContent = `${this.refreshCost}`;
        }

        this.renderQueue.availableTasks = false;
    }

    renderActiveTasks() {
        if(!this.renderQueue.activeTasks && !this.renderQueue.all)
            return;

        if (!this.component?.activeTasks) {
            this.renderQueue.activeTasks = false;
            return;
        }

        this.destroyTippyIn(this.component.activeTasks);
        this.component.activeTasks.replaceChildren();

        if(this.activeTasks.length === 0) {
            const empty = new AdventuringEmptyStateElement();
            empty.setFullWidthMessage('No active tasks. Accept a task from the board!');
            this.component.activeTasks.appendChild(empty);
        } else {
            this.activeTasks.forEach(task => {
                const card = this.createTaskCard(task, 'active');
                this.component.activeTasks.appendChild(card);
            });
        }

        this.renderQueue.activeTasks = false;
    }

    createTaskCard(task, mode) {
        const frag = getTemplateNode('adventuring-slayer-task-template');

        const col = getElementFromFragment(frag, 'col', 'div');
        const card = getElementFromFragment(frag, 'card', 'div');
        const tierBadge = getElementFromFragment(frag, 'tierBadge', 'span');
        const typeName = getElementFromFragment(frag, 'typeName', 'small');
        const targetIcon = getElementFromFragment(frag, 'targetIcon', 'img');
        const description = getElementFromFragment(frag, 'description', 'span');
        const progressContainer = getElementFromFragment(frag, 'progressContainer', 'div');
        const progressBar = getElementFromFragment(frag, 'progressBar', 'div');
        const rewards = getElementFromFragment(frag, 'rewards', 'span');
        const actionBtn = getElementFromFragment(frag, 'actionBtn', 'button');

        if(task.completed) {
            card.classList.add('border', 'border-success');
        }

        tierBadge.className = `badge badge-${this.getTierColor(task.tier)}`;
        tierBadge.textContent = `Tier ${task.tier}`;

        typeName.textContent = task.taskType ? task.taskType.name : 'Task';

        targetIcon.src = task.targetMedia;
        description.textContent = task.description;

        if(mode === 'active') {
            progressContainer.classList.remove('d-none');
            progressBar.className = `progress-bar ${task.completed ? 'bg-success' : 'bg-info'}`;
            progressBar.style.width = `${task.progressPercent}%`;
            progressBar.textContent = task.progressText;
        }

        this.renderTaskRewards(rewards, task);

        if(mode === 'available') {
            actionBtn.className = 'btn btn-sm btn-block btn-primary';
            actionBtn.textContent = 'Accept';
            actionBtn.onclick = () => this.acceptTask(task);
            if(this.activeTasks.length >= this.maxActiveTasks) {
                actionBtn.disabled = true;
                actionBtn.textContent = 'Task Limit Reached';
            }
        } else if(mode === 'active') {
            if(task.completed) {
                actionBtn.className = 'btn btn-sm btn-block btn-success';
                actionBtn.textContent = 'Claim Rewards';
                actionBtn.onclick = () => this.claimTask(task);
            } else {
                actionBtn.className = 'btn btn-sm btn-block btn-danger';
                actionBtn.textContent = `Abandon (${this.abandonCost} Slayer Coins)`;
                actionBtn.onclick = () => this.abandonTask(task);
            }
        }

        return col;
    }

    renderTaskRewards(container, task) {
        task.rewards.forEach((r, i) => {
            if(i > 0) {
                const comma = document.createElement('span');
                comma.textContent = ', ';
                comma.className = 'mr-1';
                container.appendChild(comma);
            }

            const reward = new AdventuringTaskRewardElement();
            container.appendChild(reward);

            const rewardLocalID = (r.rewardType && r.rewardType.localID) ? r.rewardType.localID : null;

            if(rewardLocalID === 'material' && r.item) {

                reward.setReward({
                    quantity: r.qty + ' ',
                    iconSrc: r.item.media,
                    tooltipContent: r.item.name
                });
            } else if(rewardLocalID === 'job_xp' && r.item) {

                reward.setReward({
                    quantity: r.qty + ' ',
                    iconSrc: r.item.media,
                    tooltipContent: `${r.item.name} XP`,
                    colorClass: 'text-success'
                });
            } else if(rewardLocalID === 'consumable' && r.item) {

                reward.setReward({
                    quantity: r.qty + ' ',
                    iconSrc: r.item.media,
                    tooltipContent: r.item.name
                });
            } else {

                reward.setReward({
                    quantity: `${r.qty}`
                });
            }
        });
    }

    getTierColor(tier) {
        const colors = ['secondary', 'info', 'primary', 'warning', 'danger'];
        return colors[tier - 1] || 'secondary';
    }

    resetTasks() {
        this.totalTasksCompleted = 0;
        this.activeTasks = [];
        this.availableTasks = [];
        this.fillAvailableTasks();
        this.renderQueue.queueAll();
    }

    encode(writer) {
        writer.writeUint32(this.totalTasksCompleted);

        writer.writeUint8(this.activeTasks.length);
        this.activeTasks.forEach((task, i) => {
            task.encode(writer);
        });

        writer.writeUint8(this.availableTasks.length);
        this.availableTasks.forEach((task, i) => {
            task.encode(writer);
        });
    }

    decode(reader, version) {

        this.totalTasksCompleted = reader.getUint32();

        const numActive = reader.getUint8();
        this.activeTasks = [];
        for(let i = 0; i < numActive; i++) {
            const task = new AdventuringSlayerTask(this.manager, this.game);
            task.decode(reader, version);
            this.activeTasks.push(task);
        }

        const numAvailable = reader.getUint8();
        this.availableTasks = [];
        for(let i = 0; i < numAvailable; i++) {
            const task = new AdventuringSlayerTask(this.manager, this.game);
            task.decode(reader, version);
            this.availableTasks.push(task);
        }
    }
}