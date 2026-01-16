const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../data/achievements/job_mastery.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Map achievement IDs to weapon IDs
const weaponMap = {
    "fighter_weapon_mastery": "fighters_claymore",
    "ranger_weapon_mastery": "rangers_longbow",
    "cleric_weapon_mastery": "clerics_mace",
    "wizard_weapon_mastery": "wizards_staff",
    "berserker_weapon_mastery": "berserkers_greataxe",
    "rogue_weapon_mastery": "rogues_daggers",
    "paladin_weapon_mastery": "paladins_blade",
    "monk_weapon_mastery": "monks_staff",
    "priest_weapon_mastery": "priests_scepter",
    "sniper_weapon_mastery": "snipers_crossbow",
    "hunter_weapon_mastery": "hunters_shortbow",
    "warlock_weapon_mastery": "warlocks_tome",
    "elementalist_weapon_mastery": "elementalists_orb",
    "assassin_weapon_mastery": "assassins_blade",
    "bard_weapon_mastery": "bards_lute",
    "guardian_weapon_mastery": "guardians_tower_shield",
    "knight_weapon_mastery": "knights_lance",
    "crusader_weapon_mastery": "crusaders_hammer",
    "slayer_weapon_mastery": "slayers_blade",
    "samurai_weapon_mastery": "samurais_katana",
    "druid_weapon_mastery": "druids_focus",
    "warlord_weapon_mastery": "warlords_greatsword",
    "shadowblade_weapon_mastery": "shadowblades_edge",
    "battlemage_weapon_mastery": "battlemages_spellblade",
    "templar_weapon_mastery": "templars_blessed_blade",
    "reaper_weapon_mastery": "reapers_scythe",
    "inquisitor_weapon_mastery": "inquisitors_seal",
    "champion_weapon_mastery": "champions_warblade",
    "necromancer_weapon_mastery": "necromancers_skull",
    "arcane_archer_weapon_mastery": "arcane_archers_bow",
    "arcanearcher_weapon_mastery": "arcane_archers_bow",
    "shaman_weapon_mastery": "shamans_totem",
    "shadow_monk_weapon_mastery": "shadow_monks_fist",
    "shadowmonk_weapon_mastery": "shadow_monks_fist",
    "spellblade_weapon_mastery": "spellblades_saber",
    "deadeye_weapon_mastery": "deadeyes_rifle",
    "chronomancer_weapon_mastery": "chronomancers_hourglass",
    "beastmaster_weapon_mastery": "beastmasters_spear",
    "hierophant_weapon_mastery": "hierophants_crook",
    "harbinger_weapon_mastery": "harbingers_scythe",
    "nightblade_weapon_mastery": "nightblades_kris",
    "warden_weapon_mastery": "wardens_hammer",
    "archmage_weapon_mastery": "archmages_staff",
    "sage_weapon_mastery": "sages_tome",
    "saint_weapon_mastery": "saints_relic",
    "high_priest_weapon_mastery": "high_priests_censer",
    "highpriest_weapon_mastery": "high_priests_censer",
    "primordial_weapon_mastery": "primordials_gauntlet",
    "dreadnought_weapon_mastery": "dreadnoughts_wall",
    "paragon_weapon_mastery": "paragons_blade",
    "avatar_weapon_mastery": "avatars_fists",
    "marksman_weapon_mastery": "marksmans_longbow",
    "shadowdancer_weapon_mastery": "shadowdancers_fans"
};

const achievements = data.data.skillData[0].data.achievements;

let updated = 0;
for (const achievement of achievements) {
    const weaponId = weaponMap[achievement.id];
    if (weaponId) {
        // Check if equipment reward already exists
        const hasEquipment = achievement.rewards.some(r => r.type === 'equipment');
        if (!hasEquipment) {
            achievement.rewards.push({
                type: "equipment",
                id: `adventuring:${weaponId}`
            });
            updated++;
            console.log(`Added equipment reward to ${achievement.id}: ${weaponId}`);
        }
    }
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
console.log(`\nUpdated ${updated} achievements with equipment rewards`);
