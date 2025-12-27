const { loadModule } = mod.getContext(import.meta);

const { formatRequirement } = await loadModule('src/adventuring-utils.mjs');

/**
 * Tooltip builder utility - creates styled tooltips matching Melvor's style
 */
export class TooltipBuilder {
    constructor() {
        this.sections = [];
        this.currentSection = null;
    }

    /**
     * Start a new tooltip
     */
    static create() {
        return new TooltipBuilder();
    }

    /**
     * Add a header/title with optional icon
     */
    header(text, iconSrc = null) {
        let html = '<div class="text-center">';
        if(iconSrc) {
            html += `<img class="skill-icon-xs mr-1" src="${iconSrc}">`;
        }
        html += `<span class="font-w600 text-warning">${text}</span>`;
        html += '</div>';
        this.sections.push(html);
        return this;
    }

    /**
     * Add a subheader/subtitle
     */
    subheader(text, color = 'text-info') {
        this.sections.push(`<div class="text-center"><small class="font-w600 ${color}">${text}</small></div>`);
        return this;
    }

    /**
     * Add a separator line
     */
    separator() {
        this.sections.push('<hr class="my-1 border-secondary">');
        return this;
    }

    /**
     * Add a section title
     */
    sectionTitle(text) {
        this.sections.push(`<div class="font-w600 text-info mb-1">${text}</div>`);
        return this;
    }

    /**
     * Add a stat line with icon
     */
    stat(label, value, iconSrc = null, color = '') {
        let html = '<div class="d-flex justify-content-between">';
        html += '<span class="text-muted">';
        if(iconSrc) {
            html += `<img class="skill-icon-xxs mr-1" src="${iconSrc}">`;
        }
        html += `${label}</span>`;
        html += `<span class="${color}">${value}</span>`;
        html += '</div>';
        this.sections.push(html);
        return this;
    }

    /**
     * Add a simple text line
     */
    text(text, color = '') {
        this.sections.push(`<div><small class="${color}">${text}</small></div>`);
        return this;
    }

    /**
     * Add a bonus/positive modifier (green text)
     */
    bonus(text) {
        this.sections.push(`<div><small class="text-success">${text}</small></div>`);
        return this;
    }

    /**
     * Add a penalty/negative modifier (red text)
     */
    penalty(text) {
        this.sections.push(`<div><small class="text-danger">${text}</small></div>`);
        return this;
    }

    /**
     * Add an info line
     */
    info(text) {
        this.sections.push(`<div><small class="text-info">${text}</small></div>`);
        return this;
    }

    /**
     * Add a muted/hint line
     */
    hint(text) {
        this.sections.push(`<div><small class="text-muted">${text}</small></div>`);
        return this;
    }

    /**
     * Add a warning line
     */
    warning(text) {
        this.sections.push(`<div><small class="text-warning">${text}</small></div>`);
        return this;
    }

    /**
     * Add a progress bar
     */
    progress(current, max, label = '', color = 'bg-info') {
        const percent = Math.min(100, (current / max) * 100);
        let html = '';
        if(label) {
            html += `<div class="text-center"><small class="text-muted">${label}</small></div>`;
        }
        html += '<div class="progress active my-1" style="height: 6px;">';
        html += `<div class="progress-bar ${color}" style="width: ${percent}%"></div>`;
        html += '</div>';
        html += `<div class="text-center"><small>${current} / ${max}</small></div>`;
        this.sections.push(html);
        return this;
    }

    /**
     * Add XP progress with mastery styling
     * @param {number} currentXP - XP within current level (total XP - currentLevelXP)
     * @param {number} xpToNextLevel - XP needed for next level (nextLevelXP - currentLevelXP)
     * @param {number} level - Current mastery level
     * @param {number} percent - Progress percentage (0-100)
     */
    masteryProgress(currentXP, xpToNextLevel, level, percent = null) {
        if(percent === null) {
            percent = xpToNextLevel > 0 ? Math.min(100, (currentXP / xpToNextLevel) * 100) : 100;
        }
        let html = `<div class="text-center"><small class="text-info">Level ${level}</small></div>`;
        html += '<div class="progress active my-1" style="height: 5px;">';
        html += `<div class="progress-bar bg-info" style="width: ${percent}%"></div>`;
        html += '</div>';
        html += `<div class="text-center"><small class="text-muted">${numberWithCommas(currentXP)} / ${numberWithCommas(xpToNextLevel)} XP</small></div>`;
        this.sections.push(html);
        return this;
    }

    /**
     * Add mastery progress from a manager and action
     * Calculates the correct level-relative XP values
     * @param {Object} manager - The adventuring manager
     * @param {Object} action - The mastery action
     */
    masteryProgressFor(manager, action) {
        const totalXP = manager.getMasteryXP(action);
        const level = manager.getMasteryLevel(action);
        const currentLevelXP = exp.levelToXP(level);
        const nextLevelXP = exp.levelToXP(level + 1);
        const xpInLevel = Math.floor(totalXP - currentLevelXP);
        const xpToNextLevel = nextLevelXP - currentLevelXP;
        const percent = level >= 99 ? 100 : Math.min(100, (xpInLevel / xpToNextLevel) * 100);
        return this.masteryProgress(xpInLevel, xpToNextLevel, level, percent);
    }

    /**
     * Add an icon with value (for stats)
     */
    iconValue(iconSrc, value, color = '') {
        let html = '<span>';
        html += `<img class="skill-icon-xxs" style="height: .75rem; width: .75rem;" src="${iconSrc}">`;
        html += `<small class="${color}">${value}</small>`;
        html += '</span>';
        return html;
    }

    /**
     * Add a row of icon values (for multiple stats on one line)
     */
    statRow(...items) {
        let html = '<div class="d-flex justify-content-center flex-wrap">';
        items.forEach((item, i) => {
            if(i > 0) html += '<span class="mx-1"></span>';
            html += item;
        });
        html += '</div>';
        this.sections.push(html);
        return this;
    }

    /**
     * Create a simple material tooltip showing name, icon, and owned count.
     * Used for material displays in costs, rewards, etc.
     * @param {Object} material - Material object with name, media, count
     * @returns {TooltipBuilder} This builder for chaining
     */
    static forMaterial(material) {
        return TooltipBuilder.create()
            .header(material.name, material.media)
            .separator()
            .text(`Owned: ${material.count}`, 'text-center');
    }

    /**
     * Add stats from a Map<Stat, number> with standard formatting.
     * Adds separator before stats.
     * @param {Map} stats - Map of stat objects to values
     * @param {boolean} [addSeparator=true] - Whether to add separator before stats
     */
    stats(stats, addSeparator = true) {
        if(!stats || stats.size === 0) return this;
        if(addSeparator) this.separator();
        const statItems = [];
        stats.forEach((value, stat) => {
            const prefix = value >= 0 ? '+' : '';
            const color = value >= 0 ? 'text-success' : 'text-danger';
            statItems.push(this.iconValue(stat.media, `${prefix}${value}`, color));
        });
        this.statRow(...statItems);
        return this;
    }

    /**
     * Add "Usable By:" section showing job icons.
     * Only shows if there are valid jobs and not all jobs.
     * @param {Array} jobs - Array of job objects
     * @param {Object} manager - The adventuring manager (for total job count)
     * @param {boolean} [addSeparator=true] - Whether to add separator
     */
    usableByJobs(jobs, manager, addSeparator = true) {
        if(!jobs || jobs.length === 0) return this;
        const validJobs = jobs.filter(job => job.id !== "adventuring:none");
        if(validJobs.length === 0 || validJobs.length >= manager.jobs.size) return this;
        
        if(addSeparator) this.separator();
        this.hint('Usable By:');
        const jobIcons = validJobs.map(job => 
            `<img class="skill-icon-xxs mr-1" src="${job.media}" title="${job.name}">`
        ).join('');
        this.text(jobIcons, 'text-center');
        return this;
    }

    /**
     * Add a requirements section
     */
    requirements(reqs) {
        if(!reqs || reqs.length === 0) return this;
        this.sectionTitle('Requirements');
        reqs.forEach(req => {
            const met = req.met !== false;
            const color = met ? 'text-success' : 'text-danger';
            this.text(`${req.text}`, color);
        });
        return this;
    }

    /**
     * Add a next unlock preview
     */
    nextUnlock(level, description) {
        this.sections.push(`<div class="mt-1"><small class="text-muted">${level}: ${description}</small></div>`);
        return this;
    }

    /**
     * Add the next milestone section for a mastery action.
     * Shows next unlock or "Mastered!" if at 99.
     * @param {Object} manager - The adventuring manager
     * @param {Object} action - The mastery action with category property
     * @param {boolean} [addSeparator=true] - Whether to add separator before content
     */
    nextMilestone(manager, action, addSeparator = true) {
        const level = manager.getMasteryLevel(action);
        const categoryId = action.category?.id;
        if(!categoryId) return this;
        
        const nextMilestone = manager.getNextMasteryUnlock(level, categoryId);
        if(nextMilestone) {
            if(addSeparator) this.separator();
            this.nextUnlock(nextMilestone.level, nextMilestone.description);
        } else if(level >= 99) {
            if(addSeparator) this.separator();
            this.warning('Mastered!');
        }
        return this;
    }

    /**
     * Add unlock requirements for locked items
     * @param {Array} requirements - Array of requirement objects
     * @param {Object} manager - The adventuring manager for checking current levels
     */
    unlockRequirements(requirements, manager) {
        if(!requirements || requirements.length === 0) return this;
        
        this.separator();
        this.sectionTitle('Unlock Requirements');
        
        requirements.forEach(req => {
            const { text, met } = formatRequirement(req, manager);
            const color = met ? 'text-success' : 'text-danger';
            this.sections.push(`<div><small class="${color}">${text}</small></div>`);
        });
        
        return this;
    }

    /**
     * Build the final tooltip HTML
     */
    build() {
        return `<div class="text-left p-1" style="min-width: 150px; max-width: 300px;">${this.sections.join('')}</div>`;
    }
}
