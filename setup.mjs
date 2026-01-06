export async function setup({ gameData, patch, loadTemplates, loadModule, loadStylesheet, getResourceUrl, onModsLoaded, onInterfaceAvailable, onInterfaceReady }) {
    
    // Helper to load packages with error logging
    const load = async (path) => {
        try {
            await gameData.addPackage(path);
        } catch(e) {
            console.error(`Error loading ${path}:`, e);
            throw e;
        }
    };

    // Helper to set image sources for mod assets (data-adv-src) and game assets (data-src)
    const setDocumentImageSources = (elem) => {
        // Handle mod-specific images (data-adv-src)
        const modImages = elem.querySelectorAll('img[data-adv-src]:not([src])');
        modImages.forEach((image) => {
            const baseURI = image.getAttribute('data-adv-src');
            image.src = getResourceUrl(baseURI);
        });
    };
    
    const setImageSources = () => {
        setDocumentImageSources(document);
        // Also handle templates
        const templates = document.querySelectorAll('template:not([data-adv-init])');
        templates.forEach((template) => {
            setDocumentImageSources(template.content);
            template.setAttribute('data-adv-init', 'true');
        });
        // Let melvor handle data-src images
        if(typeof assets !== 'undefined' && assets.setImageSources) {
            assets.setImageSources();
        }
    };

    try {

    await loadTemplates("templates.html");
    await loadStylesheet("style.css");

    sidebar.category('Party', { before: 'Combat' });
  
    const { Adventuring } = await loadModule('src/core/adventuring.mjs');

    game.adventuring = game.registerSkill(game.registeredNamespaces.getNamespace('adventuring'), Adventuring);

    await load('data/base.json');
    await load('data/difficulties.json');

    // Tier 1 combat jobs
    await load('data/jobs/combat/fighter.json');
    await load('data/jobs/combat/ranger.json');
    await load('data/jobs/combat/cleric.json');
    await load('data/jobs/combat/paladin.json');
    await load('data/jobs/combat/rogue.json');
    await load('data/jobs/combat/wizard.json');

    // Passive jobs
    await load('data/jobs/passive/astrologist.json');
    await load('data/jobs/passive/chef.json');
    await load('data/jobs/passive/crafter.json');
    await load('data/jobs/passive/farmer.json');
    await load('data/jobs/passive/firemaker.json');
    await load('data/jobs/passive/fisherman.json');
    await load('data/jobs/passive/fletcher.json');
    await load('data/jobs/passive/herbalist.json');
    await load('data/jobs/passive/lumberjack.json');
    await load('data/jobs/passive/miner.json');
    await load('data/jobs/passive/runecrafter.json');
    await load('data/jobs/passive/smith.json');
    await load('data/jobs/passive/summoner.json');
    await load('data/jobs/passive/thief.json');
    await load('data/jobs/passive/archaeologist.json');
    await load('data/jobs/passive/cartographer.json');

    // Tier 2 combat jobs
    await load('data/jobs/combat/berserker.json');
    await load('data/jobs/combat/knight.json');
    await load('data/jobs/combat/monk.json');
    await load('data/jobs/combat/priest.json');
    await load('data/jobs/combat/sniper.json');
    await load('data/jobs/combat/hunter.json');
    await load('data/jobs/combat/warlock.json');
    await load('data/jobs/combat/elementalist.json');
    await load('data/jobs/combat/assassin.json');
    await load('data/jobs/combat/bard.json');
    await load('data/jobs/combat/guardian.json');
    await load('data/jobs/combat/crusader.json');
    await load('data/jobs/combat/slayer.json');

    // Tier 3 combat jobs
    await load('data/jobs/combat/warlord.json');
    await load('data/jobs/combat/shadowblade.json');
    await load('data/jobs/combat/battlemage.json');
    await load('data/jobs/combat/templar.json');
    await load('data/jobs/combat/druid.json');
    await load('data/jobs/combat/reaper.json');
    await load('data/jobs/combat/samurai.json');
    await load('data/jobs/combat/inquisitor.json');

    // Tier 4 combat jobs
    await load('data/jobs/combat/champion.json');
    await load('data/jobs/combat/archmage.json');
    await load('data/jobs/combat/highpriest.json');
    await load('data/jobs/combat/nightblade.json');
    await load('data/jobs/combat/dreadnought.json');
    await load('data/jobs/combat/sage.json');

    // Cross-class abilities
    await load('data/jobs/combat/shared-abilities.json');

    // Tier 5+ combat jobs
    await load('data/jobs/combat/achievement-abilities.json');
    await load('data/jobs/combat/arcane_archer.json');
    await load('data/jobs/combat/avatar.json');
    await load('data/jobs/combat/beastmaster.json');
    await load('data/jobs/combat/chronomancer.json');
    await load('data/jobs/combat/deadeye.json');
    await load('data/jobs/combat/harbinger.json');
    await load('data/jobs/combat/hierophant.json');
    await load('data/jobs/combat/marksman.json');
    await load('data/jobs/combat/necromancer.json');
    await load('data/jobs/combat/paragon.json');
    await load('data/jobs/combat/primordial.json');
    await load('data/jobs/combat/saint.json');
    await load('data/jobs/combat/shadow_monk.json');
    await load('data/jobs/combat/shadowdancer.json');
    await load('data/jobs/combat/shaman.json');
    await load('data/jobs/combat/spellblade.json');
    await load('data/jobs/combat/warden.json');

    // Items - Types
    await load('data/items/types.json');
    
    // Items - Materials and Uniques
    await load('data/items/materials.json');

    // Items - Tier 1
    await load('data/items/tier1_armor.json');
    await load('data/items/tier1_weapons.json');
    await load('data/items/tier1_accessories.json');
    
    // Items - Tier 2
    await load('data/items/tier2_armor.json');
    await load('data/items/tier2_weapons.json');
    await load('data/items/tier2_themed.json');
    
    // Items - Tier 3
    await load('data/items/tier3_armor.json');
    await load('data/items/tier3_weapons.json');
    await load('data/items/tier3_themed.json');
    
    // Items - Tier 4
    await load('data/items/tier4_armor.json');
    await load('data/items/tier4_weapons.json');
    await load('data/items/tier4_themed.json');
    
    // Items - Tier 5
    await load('data/items/tier5_armor.json');
    await load('data/items/tier5_weapons.json');
    await load('data/items/tier5_themed.json');

    // Items - Tier 6+
    await load('data/items/tier6_armor.json');
    await load('data/items/tier6_weapons.json');

    // Items - Uniques
    await load('data/items/uniques.json');
    await load('data/items/tier7_uniques.json');
    await load('data/items/tier8_uniques.json');
    await load('data/items/tier9_uniques.json');

    // Items - Accessories and Offhands
    await load('data/items/artifacts.json');
    await load('data/items/unique_accessories.json');
    await load('data/items/unique_offhands.json');
    await load('data/items/tiered_offhands.json');

    // Items - Boss Material Items
    await load('data/items/boss_material_armor.json');
    await load('data/items/boss_material_weapons.json');
    
    await load('data/areas/chicken_coop.json');
    await load('data/areas/farmlands.json');
    await load('data/areas/graveyard.json');
    await load('data/areas/golbin_village.json');
    await load('data/areas/hall_of_wizards.json');
    await load('data/areas/spider_nest.json');
    await load('data/areas/pirate_cove.json');
    await load('data/areas/frozen_wastes.json');
    await load('data/areas/fire_temple.json');
    await load('data/areas/water_temple.json');
    await load('data/areas/earth_temple.json');
    await load('data/areas/giants_plateau.json');
    await load('data/areas/vampire_crypt.json');
    await load('data/areas/mummys_tomb.json');
    await load('data/areas/dragons_peak.json');
    await load('data/areas/dragons_lair.json');
    await load('data/areas/into_the_mist.json');

    // Additional areas
    await load('data/areas/abyssal_depths.json');
    await load('data/areas/air_temple.json');
    await load('data/areas/ancient_forest.json');
    await load('data/areas/bandit_hideout.json');
    await load('data/areas/bat_cave.json');
    await load('data/areas/cave_of_trolls.json');
    await load('data/areas/celestial_sanctum.json');
    await load('data/areas/crystal_caverns.json');
    await load('data/areas/demons_domain.json');
    await load('data/areas/elemental_plane.json');
    await load('data/areas/eternal_colosseum.json');
    await load('data/areas/golbin_fortress.json');
    await load('data/areas/haunted_catacombs.json');
    await load('data/areas/holy_grounds.json');
    await load('data/areas/knights_fortress.json');
    await load('data/areas/primordial_forge.json');
    await load('data/areas/realm_of_chaos.json');
    await load('data/areas/shadow_temple.json');
    await load('data/areas/slime_caves.json');
    await load('data/areas/underwater_ruins.json');
    await load('data/areas/void_citadel.json');

    // Gauntlet areas
    await load('data/gauntlet.json');

    // Tavern drinks (passive run-length effects)
    await load('data/tavern-drinks.json');

    // Slayer task types
    await load('data/slayer-tasks.json');

    // Mastery system
    await load('data/mastery.json');

    // Tutorial system
    await load('data/tutorials.json');

    // Achievement system
    await load('data/achievements.json');
    
    if(cloudManager.hasAoDEntitlementAndIsEnabled)
        await load('data/data-aod.json');

    } catch(e) { console.error('ADVENTURING SETUP ERROR:', e); throw e; }

    onModsLoaded(async () => {
        try {
        if(cloudManager.hasAoDEntitlementAndIsEnabled) {
            const levelCapIncreases = ['adventuring:Pre99Dungeons', 'adventuring:ImpendingDarknessSet100'];

            if(cloudManager.hasTotHEntitlementAndIsEnabled) {
                levelCapIncreases.push(...['adventuring:Post99Dungeons', 'adventuring:ThroneOfTheHeraldSet120']);
            }

            const gamemodes = game.gamemodes.filter(gamemode => gamemode.defaultInitialLevelCap !== undefined && gamemode.levelCapIncreases.length > 0 && gamemode.useDefaultSkillUnlockRequirements === true && gamemode.allowSkillUnlock === false);

            await gameData.addPackage({
                $schema: '',
                namespace: 'adventuring',
                modifications: {
                    gamemodes: gamemodes.map(gamemode => ({
                        id: gamemode.id,
                        levelCapIncreases: {
                            add: levelCapIncreases
                        },
                        startingSkills: {
                            add: ['adventuring:Adventuring']
                        },
                        skillUnlockRequirements: [
                            {
                                skillID: 'adventuring:Adventuring',
                                requirements: [
                                    {
                                        type: 'SkillLevel',
                                        skillID: 'melvorD:Attack',
                                        level: 1
                                    }
                                ]
                            }
                        ]
                    }))
                }
            });
        }
    
        patch(EventManager, 'loadEvents').after(() => {
            if(game.currentGamemode.startingSkills !== undefined && game.currentGamemode.startingSkills.has(game.adventuring)) {
                game.adventuring.setUnlock(true);
            }
        });
        } catch(e) { console.error('ADVENTURING onModsLoaded ERROR:', e); throw e; }
    });

    onInterfaceAvailable(async () => {
        try {
        game.adventuring.component.mount(document.getElementById('main-container')); // Add skill container
        
        // Hook offline loop exit to trigger tutorial checks after offline progress completes
        game._events.on('offlineLoopExited', () => {
            game.adventuring.tutorialManager.onOfflineLoopExited();
        });
        
        // Load and mount the game guide
        await loadModule('src/ui/components/adventuring-game-guide.mjs');
        const gameGuide = document.createElement('adventuring-game-guide');
        const gameGuideContainer = document.querySelector('#modal-game-guide .block-content.block-content-full');
        if (gameGuideContainer) {
            gameGuideContainer.appendChild(gameGuide);
        }
        
        // Set image sources for game guide and other templates
        setImageSources();
        } catch(e) { console.error('ADVENTURING onInterfaceAvailable ERROR:', e); throw e; }
    });
}