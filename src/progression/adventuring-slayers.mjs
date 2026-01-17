const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { AdventuringSlayerTask, SlayerTaskGenerator } = await loadModule('src/progression/adventuring-slayer-task.mjs');
const { getEffectDescriptionsList } = await loadModule('src/core/adventuring-utils.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { AdventuringIconButtonElement } = await loadModule('src/ui/components/adventuring-icon-button.mjs');

await loadModule('src/progression/components/adventuring-slayers.mjs');
const { AdventuringTaskRewardElement } = await loadModule('src/progression/components/adventuring-task-reward.mjs');
const { AdventuringStatBadgeElement } = await loadModule('src/progression/components/adventuring-stat-badge.mjs');
const { AdventuringAchievementRewardElement } = await loadModule('src/progression/components/adventuring-achievement-reward.mjs');
const { AdventuringInfoMessageElement } = await loadModule('src/ui/components/adventuring-info-message.mjs');
const { AdventuringEmptyStateElement } = await loadModule('src/ui/components/adventuring-empty-state.mjs');

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
        this.component.runsBackBtn.onclick = () => this.showRunsList();
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
            this.showRunsList();
            this.renderQueue.runs = true;
            this.render();
        } else if(tab === 'stats') {
            this.renderQueue.stats = true;
            this.render();
        }
    }

    showRunsList() {
        this.selectedRun = null;
        this.component.runsListView.classList.remove('d-none');
        this.component.runsDetailsView.classList.add('d-none');
        this.renderQueue.runs = true;
        this.render();
    }

    showRunDetails(run, index) {
        this.selectedRun = { run, index };
        this.component.runsListView.classList.add('d-none');
        this.component.runsDetailsView.classList.remove('d-none');
        this.renderRunDetails();
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
    }

    onShow() {
        this.manager.party.setAllLocked(false);

        this.fillAvailableTasks();

        this.renderQueue.all = true;
    }

    onHide() {
        this.manager.party.setAllLocked(true);
    }

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

            this.manager.achievementManager.recordSlayerTask();

            // Fire slayer_task_complete trigger for achievements
            this.manager.achievementManager.trigger('slayer_task_complete', {
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

    onMonsterKilled(monster) {
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

    onMaterialCollected(material, amount) {
        this.activeTasks.forEach(task => {
            if(task.taskType && task.taskType.id === 'adventuring:collect' && task.targetId === material.id) {
                task.addProgress(amount);
                this.renderQueue.activeTasks = true;
            }
        });
    }

    onDungeonCleared(area) {
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
        const total = this.manager.achievements.allObjects.length;
        const completed = this.manager.achievementManager.completedAchievements.size;
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

        // Update card border based on complete state
        card.classList.remove('border', 'border-success');
        card.style.opacity = '';
        if(isComplete) {
            card.classList.add('border', 'border-success');
            card.style.opacity = '0.6';
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
                const equip = this.manager.equipment.getObjectByID(reward.id);
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
        if(!this.renderQueue.runs && !this.renderQueue.all)
            return;

        this.destroyTippyIn(this.component.runsList);
        this.component.runsList.replaceChildren();

        const history = this.manager.combatTracker.history;

        if(history.length === 0) {
            const empty = new AdventuringEmptyStateElement();
            empty.setFullWidthMessage('No run history yet. Complete some dungeon runs to see your stats!');
            this.component.runsList.appendChild(empty);
        } else {
            // Show runs in reverse chronological order (most recent first)
            for(let i = history.length - 1; i >= 0; i--) {
                const run = history[i];
                const card = this.createRunListItem(run, i);
                this.component.runsList.appendChild(card);
            }
        }

        this.renderQueue.runs = false;
    }

    renderStats() {
        if(!this.renderQueue.stats && !this.renderQueue.all)
            return;

        this.component.globalStatsList.replaceChildren();

        // Define which stats to show and their display configuration
        const statsToShow = [
            { id: 'adventuring:total_kills', icon: 'fa-skull', color: 'danger', label: 'Monsters Slain' },
            { id: 'adventuring:slayer_tasks_completed', icon: 'fa-scroll', color: 'warning', label: 'Slayer Tasks' },
            { id: 'adventuring:total_damage', icon: 'fa-bolt', color: 'danger', label: 'Total Damage' },
            { id: 'adventuring:total_healing', icon: 'fa-heart', color: 'success', label: 'Total Healing' },
            { id: 'adventuring:flawless_wins', icon: 'fa-star', color: 'warning', label: 'Flawless Wins' },
            { id: 'adventuring:solo_wins', icon: 'fa-user', color: 'info', label: 'Solo Wins' },
            { id: 'adventuring:last_stand_wins', icon: 'fa-fist-raised', color: 'danger', label: 'Last Stand Wins' },
            { id: 'adventuring:floors_explored', icon: 'fa-map', color: 'info', label: 'Floors Explored' },
            { id: 'adventuring:special_tiles_found', icon: 'fa-gem', color: 'warning', label: 'Special Tiles Found' },
            { id: 'adventuring:unique_monsters_seen', icon: 'fa-book', color: 'primary', label: 'Bestiary Entries' },
            { id: 'adventuring:combat_currency_earned', icon: 'fa-coins', color: 'warning', label: 'Currency Earned' },
            { id: 'adventuring:combat_materials_collected', icon: 'fa-box', color: 'info', label: 'Materials Collected' },
            { id: 'adventuring:equipment_upgrades', icon: 'fa-arrow-up', color: 'success', label: 'Equipment Upgrades' },
            { id: 'adventuring:equipment_crafted', icon: 'fa-hammer', color: 'primary', label: 'Equipment Crafted' },
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

    createRunListItem(run, index) {
        const frag = getTemplateNode('adventuring-run-list-item-template');

        const card = getElementFromFragment(frag, 'card', 'div');
        const areaIcon = getElementFromFragment(frag, 'area-icon', 'img');
        const areaName = getElementFromFragment(frag, 'area-name', 'span');
        const badges = getElementFromFragment(frag, 'badges', 'div');
        const damageDealt = getElementFromFragment(frag, 'damage-dealt', 'span');
        const damageTaken = getElementFromFragment(frag, 'damage-taken', 'span');
        const turns = getElementFromFragment(frag, 'turns', 'span');
        const encountersCount = getElementFromFragment(frag, 'encounters-count', 'small');

        // Area info
        if(run.area) {
            areaIcon.src = run.area.media;
            areaName.textContent = run.area.name;
        } else {
            areaIcon.src = this.manager.getResourceUrl('assets/media/empty.png');
            areaName.textContent = 'Unknown Area';
        }

        // Stats
        damageDealt.textContent = this.formatNumber(run.damageDealt);
        damageTaken.textContent = this.formatNumber(run.damageTaken);
        turns.textContent = run.turnsElapsed;
        encountersCount.textContent = `${run.encounters.length} encounters`;

        // Badges
        if(run.difficulty) {
            const diffBadge = document.createElement('span');
            diffBadge.className = `badge badge-${this.getDifficultyColor(run.difficulty)} mr-1`;
            diffBadge.textContent = run.difficulty.name;
            badges.appendChild(diffBadge);
        }

        if(run.wasFlawless) {
            const flawlessBadge = document.createElement('span');
            flawlessBadge.className = 'badge badge-success mr-1';
            flawlessBadge.textContent = 'Flawless';
            badges.appendChild(flawlessBadge);
        }

        if(run.isSolo) {
            const soloBadge = document.createElement('span');
            soloBadge.className = 'badge badge-dark';
            soloBadge.textContent = 'Solo';
            badges.appendChild(soloBadge);
        }

        card.onclick = () => this.showRunDetails(run, index);

        return frag.firstElementChild;
    }

    renderRunDetails() {
        if(!this.selectedRun) return;

        const { run, index } = this.selectedRun;

        // Title and subtitle
        if(run.area) {
            this.component.runDetailTitle.textContent = run.area.name;
        } else {
            this.component.runDetailTitle.textContent = 'Unknown Area';
        }
        this.component.runDetailSubtitle.textContent = `Run #${index + 1} • ${run.encounters.length} encounters • ${run.partySize} hero${run.partySize !== 1 ? 'es' : ''}`;

        // Badges
        this.component.runDetailBadges.replaceChildren();
        if(run.difficulty) {
            const diffBadge = document.createElement('span');
            diffBadge.className = `badge badge-${this.getDifficultyColor(run.difficulty)} mr-1`;
            diffBadge.textContent = run.difficulty.name;
            this.component.runDetailBadges.appendChild(diffBadge);
        }
        if(run.wasFlawless) {
            const flawlessBadge = document.createElement('span');
            flawlessBadge.className = 'badge badge-success mr-1';
            flawlessBadge.textContent = 'Flawless';
            this.component.runDetailBadges.appendChild(flawlessBadge);
        }
        if(run.isSolo) {
            const soloBadge = document.createElement('span');
            soloBadge.className = 'badge badge-dark';
            soloBadge.textContent = 'Solo';
            this.component.runDetailBadges.appendChild(soloBadge);
        }

        // Stats
        this.component.runStatDamageDealt.textContent = this.formatNumber(run.damageDealt);
        this.component.runStatDamageTaken.textContent = this.formatNumber(run.damageTaken);
        this.component.runStatHealing.textContent = this.formatNumber(run.healingReceived);
        this.component.runStatTurns.textContent = run.turnsElapsed;

        // Abilities used
        this.component.runDetailAbilities.replaceChildren();
        if(run.abilitiesUsed.size === 0) {
            const noAbilities = document.createElement('small');
            noAbilities.className = 'text-muted';
            noAbilities.textContent = 'No abilities recorded';
            this.component.runDetailAbilities.appendChild(noAbilities);
        } else {
            for(const ability of run.abilitiesUsed) {
                const abilityIcon = document.createElement('img');
                abilityIcon.className = 'skill-icon-sm mr-1 mb-1';
                abilityIcon.src = ability.media;
                abilityIcon.title = ability.name;
                this.component.runDetailAbilities.appendChild(abilityIcon);
            }
        }

        // Monsters fought
        this.component.runDetailMonsters.replaceChildren();
        const allMonsters = new Map();
        
        // Merge damage dealt and taken by monster
        for(const [monster, damage] of run.damageDealtByMonster) {
            if(!allMonsters.has(monster)) {
                allMonsters.set(monster, { dealt: 0, taken: 0 });
            }
            allMonsters.get(monster).dealt = damage;
        }
        for(const [monster, damage] of run.damageTakenByMonster) {
            if(!allMonsters.has(monster)) {
                allMonsters.set(monster, { dealt: 0, taken: 0 });
            }
            allMonsters.get(monster).taken = damage;
        }

        if(allMonsters.size === 0) {
            const noMonsters = document.createElement('div');
            noMonsters.className = 'col-12';
            noMonsters.innerHTML = '<small class="text-muted">No monster data recorded</small>';
            this.component.runDetailMonsters.appendChild(noMonsters);
        } else {
            for(const [monster, data] of allMonsters) {
                const card = this.createMonsterDamageCard(monster, data.dealt, data.taken);
                this.component.runDetailMonsters.appendChild(card);
            }
        }

        // Encounter breakdown
        this.component.runDetailEncounters.replaceChildren();
        if(run.encounters.length === 0) {
            const noEnc = document.createElement('div');
            noEnc.className = 'col-12';
            noEnc.innerHTML = '<small class="text-muted">No encounter data recorded</small>';
            this.component.runDetailEncounters.appendChild(noEnc);
        } else {
            run.encounters.forEach((enc, i) => {
                const card = this.createEncounterCard(enc, i);
                this.component.runDetailEncounters.appendChild(card);
            });
        }
    }

    createMonsterDamageCard(monster, damageDealt, damageTaken) {
        const frag = getTemplateNode('adventuring-run-monster-template');

        const monsterIcon = getElementFromFragment(frag, 'monster-icon', 'img');
        const monsterName = getElementFromFragment(frag, 'monster-name', 'div');
        const damageTo = getElementFromFragment(frag, 'damage-to', 'span');
        const damageFrom = getElementFromFragment(frag, 'damage-from', 'span');

        monsterIcon.src = monster.media;
        monsterName.textContent = monster.name;
        damageTo.textContent = this.formatNumber(damageDealt);
        damageFrom.textContent = this.formatNumber(damageTaken);

        return frag.firstElementChild;
    }

    createEncounterCard(encounter, index) {
        const frag = getTemplateNode('adventuring-run-encounter-template');

        const encounterNum = getElementFromFragment(frag, 'encounter-num', 'span');
        const flawlessBadge = getElementFromFragment(frag, 'flawless-badge', 'span');
        const encDamageDealt = getElementFromFragment(frag, 'enc-damage-dealt', 'span');
        const encDamageTaken = getElementFromFragment(frag, 'enc-damage-taken', 'span');
        const encTurns = getElementFromFragment(frag, 'enc-turns', 'span');

        encounterNum.textContent = `Encounter ${index + 1}`;
        encDamageDealt.textContent = this.formatNumber(encounter.damageDealt);
        encDamageTaken.textContent = this.formatNumber(encounter.damageTaken);
        encTurns.textContent = encounter.turnsElapsed;

        if(encounter.wasFlawless) {
            flawlessBadge.classList.remove('d-none');
        }

        return frag.firstElementChild;
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