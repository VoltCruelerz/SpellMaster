if (typeof MarkStart != 'undefined') MarkStart('SpellMaster');
if(!SpellList) throw new Exception("Spell List Not Included!");
const SpellDict = {};

if(!state.SpellMaster) {
    state.SpellMaster = {
        Sheet: 'OGL'
    };
}

on('ready', () => {
    const chatTrigger = '!SpellMaster';// This is the trigger that makes the script listen
    const scname = 'SpellMaster';// How this script shows up when it sends chat messages
    const maxSpellLevel = 10;// My campaign has a few NPCs with 10th-level magic
    const debugLog = false;

    const dlog = (str) => {
        if (debugLog) {
            log(str);
        }
    }

    const flog = (str, errorCode) => {
        log('SPELL MASTER FATAL ERROR CODE ' + errorCode + ' = ' + str);
        log('DUMPING STATE.SPELLMASTER');
        log(JSON.stringify(state.SpellMaster));
    }
    
    // Alias state so we don't accidentally break it.
    let BookDict = state.SpellMaster;
    let SpellsIndexed = false;

    // A cache of data so not everything is recreated every time the page is drawn.
    const Cache = {};

    // Creates dictionary of spell
    const IndexSpellbook = () => {
        for(let i = 0; i < SpellList.length; i++){
            let spell = SpellList[i];
            SpellDict[spell.Name] = spell;
        }
        SpellsIndexed = true;
    };
    IndexSpellbook();
    log("Spellbook Indexed with " + SpellList.length + " spells.");

    // Retrieves a handout by name
    const GetHandout = (nameOrId) => {
        let list = findObjs({
            _type: 'handout',
            name: nameOrId,
        });
        if (list.length === 1) {
            return list[0];
        }

        list = findObjs({
            _type: 'handout',
            id: nameOrId
        });
        if (list.length === 1) {
            return list[0];
        }
    };

    // Retrieves a character by name or id
    const GetCharByAny = (nameOrId) => {
        let character = null;

        // Try to directly load the character ID
        character = getObj('character', nameOrId);
        if (character) {
            return character;
        }

        // Try to load indirectly from the token ID
        const token = getObj('graphic', nameOrId);
        if (token) {
            character = getObj('character', token.get('represents'));
            if (character) {
                return character;
            }
        }

        // Try loading through char name
        const list = findObjs({
            _type: 'character',
            name: nameOrId,
        });
        if (list.length === 1) {
            return list[0];
        }

        // Default to null
        return null;
    };

    const getattr = (charId, att) => {
        const attr = findObjs({
            type: 'attribute',
            characterid: charId,
            name: att,
        })[0];
        if (attr) {
            return attr.get('current');
        }
        return '';
    };

    const setattr = (charId, attrName, val) => {
        const attr = findObjs({
            type: 'attribute',
            characterid: charId,
            name: attrName,
        })[0];
        if (typeof attr === 'undefined' || attr == null) {
            const attr = createObj('attribute', { name: attrName, characterid: charId, current: parseFloat(val) });
        } else {
            attr.setWithWorker({
            current: parseFloat(val),
        });
        }
    };

    // Retrieves the value stored in the parameter with the provided name
    const GetParamValue = (argParams, paramName) => {
        const id = GetParamId(argParams, paramName);
        if(id === -1){
            return null;
        }
        return Decaret(argParams[id]);
    };

    // Retrieves the index in the array of params for the specified parameter
    const GetParamId = (argParams, paramName) => {
        for(let i = 0; i < argParams.length; i++){
            let arg = argParams[i];
            const argWords = arg.split(/\s+/);
            if(argWords[0] == paramName){
                return i;
            }
        }
        return -1;
    };

    // Pulls the interior message out of carets
    const Decaret = (quotedString) => {
        const startQuote = quotedString.indexOf('^');
        const endQuote = quotedString.lastIndexOf('^');
        if (startQuote >= endQuote) {
            if (!quietMode) {
                sendChat(scname, `**ERROR:** You must have a string within carets in the phrase ${string}`);
            }
            return null;
        }
        return quotedString.substring(startQuote + 1, endQuote);
    };
    
    // Enum of caster types
    const CasterMode = {
        Invalid: -1,
        Full: 0,
        Half: 1,
        Third: 2,
        Pact: 3,
        None: 4
    };

    // A dictionary of caster types
    const CasterTypeMap = {};

    // Perform initial configuration for caster type mappings
    const MapCasterTypes = () => {
        CasterTypeMap['Artificer'] = CasterMode.Full;
        CasterTypeMap['Barbarian'] = CasterMode.None;
        CasterTypeMap['Bard'] = CasterMode.Full;
        CasterTypeMap['Cleric'] = CasterMode.Full;
        CasterTypeMap['Druid'] = CasterMode.Full;
        CasterTypeMap['Fighter'] = CasterMode.Third;
        CasterTypeMap['Monk'] = CasterMode.Full;
        CasterTypeMap['Paladin'] = CasterMode.Half;
        CasterTypeMap['Ranger'] = CasterMode.Half;
        CasterTypeMap['Rogue'] = CasterMode.Third;
        CasterTypeMap['Shaman'] = CasterMode.Full;
        CasterTypeMap['Sorcerer'] = CasterMode.Full;
        CasterTypeMap['Warlock'] = CasterMode.Pact;
        CasterTypeMap['Wizard'] = CasterMode.Full;
        CasterTypeMap[null] = CasterMode.None;
        CasterTypeMap['undefined'] = CasterMode.None;
        CasterTypeMap['SRD'] = CasterMode.Full;
    };
    MapCasterTypes();

    // Get a caster type from the map
    const GetCasterTypeFromClass = (className) => {
        try {
            return CasterTypeMap[className];
        } catch (e) {
            log('Invalid class: ' + className);
            return CasterMode.Invalid;
        }
    };

    // Get default spell slot array for a caster type and level
    const GetBaseSpellSlots = (casterMode, level) => {
        if (casterMode === CasterMode.Full){
            const fullCasterSlots = [
                [2,0,0,0,0,0,0,0,0],// 1
                [3,0,0,0,0,0,0,0,0],// 2
                [4,2,0,0,0,0,0,0,0],// 3
                [4,3,0,0,0,0,0,0,0],// 4
                [4,3,2,0,0,0,0,0,0],// 5
                [4,3,3,0,0,0,0,0,0],// 6
                [4,3,3,1,0,0,0,0,0],// 7
                [4,3,3,2,0,0,0,0,0],// 8
                [4,3,3,3,1,0,0,0,0],// 9
                [4,3,3,3,2,0,0,0,0],// 10
                [4,3,3,3,2,1,0,0,0],// 11
                [4,3,3,3,2,1,0,0,0],// 12
                [4,3,3,3,2,1,1,0,0],// 13
                [4,3,3,3,2,1,1,0,0],// 14
                [4,3,3,3,2,1,1,1,0],// 15
                [4,3,3,3,2,1,1,1,0],// 16
                [4,3,3,3,2,1,1,1,1],// 17
                [4,3,3,3,3,1,1,1,1],// 18
                [4,3,3,3,3,2,1,1,1],// 19
                [4,3,3,3,3,2,2,1,1],// 20
            ];
            return fullCasterSlots[level-1];
        } else if(casterMode === CasterMode.Half) {
            const halfCasterSlots = [
                [0,0,0,0,0,0,0,0,0],// 1
                [2,0,0,0,0,0,0,0,0],// 2
                [3,0,0,0,0,0,0,0,0],// 3
                [3,0,0,0,0,0,0,0,0],// 4
                [4,2,0,0,0,0,0,0,0],// 5
                [4,2,0,0,0,0,0,0,0],// 6
                [4,3,0,0,0,0,0,0,0],// 7
                [4,3,0,0,0,0,0,0,0],// 8
                [4,3,2,0,0,0,0,0,0],// 9
                [4,3,2,0,0,0,0,0,0],// 10
                [4,3,3,0,0,0,0,0,0],// 11
                [4,3,3,0,0,0,0,0,0],// 12
                [4,3,3,1,0,0,0,0,0],// 13
                [4,3,3,1,0,0,0,0,0],// 14
                [4,3,3,2,0,0,0,0,0],// 15
                [4,3,3,2,0,0,0,0,0],// 16
                [4,3,3,2,1,0,0,0,0],// 17
                [4,3,3,2,1,0,0,0,0],// 18
                [4,3,3,2,2,0,0,0,0],// 19
                [4,3,3,2,2,0,0,0,0],// 20
            ];
            return halfCasterSlots[level-1];
        } else if (casterMode === CasterMode.Third) {
            const thirdCasterSlots = [
                [0,0,0,0,0,0,0,0,0],// 1
                [0,0,0,0,0,0,0,0,0],// 2
                [2,0,0,0,0,0,0,0,0],// 3
                [3,0,0,0,0,0,0,0,0],// 4
                [3,0,0,0,0,0,0,0,0],// 5
                [3,0,0,0,0,0,0,0,0],// 6
                [4,2,0,0,0,0,0,0,0],// 7
                [4,2,0,0,0,0,0,0,0],// 8
                [4,2,0,0,0,0,0,0,0],// 9
                [4,3,0,0,0,0,0,0,0],// 10
                [4,3,0,0,0,0,0,0,0],// 11
                [4,3,0,0,0,0,0,0,0],// 12
                [4,3,2,0,0,0,0,0,0],// 13
                [4,3,2,0,0,0,0,0,0],// 14
                [4,3,2,0,0,0,0,0,0],// 15
                [4,3,3,0,0,0,0,0,0],// 16
                [4,3,3,0,0,0,0,0,0],// 17
                [4,3,3,0,0,0,0,0,0],// 18
                [4,3,3,1,0,0,0,0,0],// 19
                [4,3,3,1,0,0,0,0,0],// 20
            ];
            return thirdCasterSlots[level-1];
        } else if (casterMode === CasterMode.Pact) {
            const pactCasterSlots = [
                [1,0,0,0,0,0,0,0,0],// 1
                [2,0,0,0,0,0,0,0,0],// 2
                [0,2,0,0,0,0,0,0,0],// 3
                [0,2,0,0,0,0,0,0,0],// 4
                [0,0,2,0,0,0,0,0,0],// 5
                [0,0,2,0,0,0,0,0,0],// 6
                [0,0,0,2,0,0,0,0,0],// 7
                [0,0,0,2,0,0,0,0,0],// 8
                [0,0,0,0,2,0,0,0,0],// 9
                [0,0,0,0,2,0,0,0,0],// 10
                [0,0,0,0,3,1,0,0,0],// 11
                [0,0,0,0,3,1,0,0,0],// 12
                [0,0,0,0,3,1,1,0,0],// 13
                [0,0,0,0,3,1,1,0,0],// 14
                [0,0,0,0,3,1,1,1,0],// 15
                [0,0,0,0,3,1,1,1,0],// 16
                [0,0,0,0,3,1,1,1,1],// 17
                [0,0,0,0,3,1,1,1,1],// 18
                [0,0,0,0,3,1,1,1,1],// 19
                [0,0,0,0,3,1,1,1,1],// 20
            ];
            return pactCasterSlots[level-1];
        } else {
            return [0,0,0,0,0,0,0,0,0];
        }
    };

    const StatMap = {};
    const MapAbilities = () => {
        StatMap['Strength'] = 'STR';
        StatMap['Dexterity'] = 'DEX';
        StatMap['Constitution'] = 'CON';
        StatMap['Intelligence'] = 'INT';
        StatMap['Wisdom'] = 'WIS';
        StatMap['Charisma'] = 'CHA';
    }
    MapAbilities();

    // Creates a link 
    const CreateLink = (text, linkTo) => {
        return `<a href="${linkTo}">${text}</a>`;
    };

    // All sorters available to SpellMaster
    const Sorters = {
        NameAlpha: (a, b) => {
            const nameA=a.Name.toLowerCase();
            const nameB=b.Name.toLowerCase();
            if (nameA < nameB) //sort string ascending
            {
                return -1;
            }
            if (nameA > nameB)
            {
                return 1;
            }
            return 0 //default return value (no sorting)
        }
    };

    // Filtration options
    const Filters = {
        WithFlag: 0,
        WithoutFlag: 1,
        NotApplicable: 2
    };
    const FilterSymbols = ['X', '!', '_'];

    // Sends a message to a gm and a player.  If the player is a gm, don't double-send
    const sendToGmAndPlayer = (chatMessage, target, msg) => {
        let sendSuccess = false;
        try {
            sendChat(scname, `/w "${chatMessage.who.replace(' (GM)', '')}" ${msg}`);
            sendSuccess = true;
        }
        catch(e) {
            log('Error sending spellcast: ' + e.Message);
            log('Spell Text: ' + msg);
        }
        if(!sendSuccess || !playerIsGM(chatMessage.playerid)) {
            sendChat(scname, `/w gm ${msg}`);
        }
    };

    const GetMaxPreparationString = (char) => {
        const classDisplay = getattr(char.id, 'class_display');
        const leveledClasses = classDisplay.split(',');
        let prepString = '';
        for(let i = 0; i < leveledClasses.length; i++) {
            const classDetails = leveledClasses[i].trim().split(' ');
            const className = classDetails[0];
            const classLevel = parseInt(classDetails[1]);
            if (className === 'Cleric' || className === 'Druid' || className === 'Shaman') {
                const statMod = parseInt(getattr(char.id, 'wisdom_mod')) || 0;
                prepString += `/ ${classLevel + statMod} (${className}) `;
            } else if (className === 'Wizard' || className === 'Artificer') {
                const statMod = parseInt(getattr(char.id, 'intelligence_mod')) || 0;
                prepString += `/ ${classLevel + statMod} (${className}) `;
            } else if (className === 'Warlock' || className === 'Witch') {
                const spellsKnownAtLevel = [2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15];
                let maxKnown = spellsKnownAtLevel[classLevel-1];
                maxKnown += classLevel >= 11 ? 1 : 0;// Mystic Arcanum L6
                maxKnown += classLevel >= 13 ? 1 : 0;// Mystic Arcanum L7
                maxKnown += classLevel >= 15 ? 1 : 0;// Mystic Arcanum L8
                maxKnown += classLevel >= 17 ? 1 : 0;// Mystic Arcanum L9
                const statMod = parseInt(getattr(char.id, 'charisma_mod')) || 0;
                prepString += `/ ${maxKnown} (${className}) `;
            } else if (className === 'Sorcerer') {
                const spellsKnownAtLevel = [2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,15,15];
                let maxKnown = spellsKnownAtLevel[classLevel-1];
                const statMod = parseInt(getattr(char.id, 'charisma_mod')) || 0;
                prepString += `/ ${maxKnown} (${className}) `;
            } else if (className === 'Paladin') {
                const statMod = parseInt(getattr(char.id, 'charisma_mod')) || 0;
                prepString += `/ ${Math.floor(classLevel/2) + statMod} (${className}) `;
            } else if (className === 'Bard') {
                const spellsKnownAtLevel = [4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22];
                let maxKnown = spellsKnownAtLevel[classLevel-1];
                const statMod = parseInt(getattr(char.id, 'charisma_mod')) || 0;
                prepString += `/ ${maxKnown} (${className}) `;
            } 
        }
        return prepString;
    }

    // Returns a string that contains the details of a spell (used by expansion and casting)
    const GetSpellDetails = (book, instance, spell, createLinks) => {
        text = "";
        text += `<b>- School:</b> ${spell.School}<br/>`;
        text += `<b>- Cast Time:</b> ${spell.CastTime}<br/>`;
        text += `<b>- Range:</b> ${spell.Range}<br/>`;
        let componentStr = "";
        componentStr += spell.Components.V ? "V" : "";
        componentStr += spell.Components.S ? "S" : "";
        componentStr += spell.Components.M ? "M" : "";
        componentStr += spell.Components.MDetails ? ` (${spell.Components.MDetails})` : "";
        text += `<b>- Components:</b> ${componentStr}<br/>`;
        text += `<b>- Duration:</b> ${spell.Duration}<br/>`;
        let descStr = spell.Desc
            .replace("Higher Level:", "HLCODE")// This order matters to prevent double-hits
            .replace("Higher Levels:", "HLCODE")
            .replace("At Higher Level:", "HLCODE")
            .replace("Higher level:", "HLCODE")
            .replace("At higher level:", "HLCODE")
            .replace("HLCODE", '<b>- Higher Levels:</b>');
        text += `<b>- Description:</b> ${descStr}<br/>`;
        if(createLinks) {
            const abilityLink = CreateLink('Ability:', `!SpellMaster --UpdateBook ^${book.Name}^ --UpdateSpell ^${instance.Name}^ --ParamName ^Ability^ --ParamValue ^?{Please select the ability to use when casting this spell.|Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma}^`);
            text += `<b>- ${abilityLink}</b> ${instance.Stat}<br/>`;
            const notesLink = CreateLink('Notes:',`!SpellMaster --UpdateBook ^${book.Name}^ --UpdateSpell ^${instance.Name}^ --ParamName ^Notes^ --ParamValue ^?{Please type the new notes section.  You may want to type outside this window and paste for longer messages.  Use html br tag for line breaks.}^`);
            text += `<b>- ${notesLink}</b> ${instance.Notes}<br/>`;
        } else {
            text += `<b>- Ability:</b> ${instance.Stat}<br/>`;
            text += `<b>- Notes:</b> ${instance.Notes}<br/>`;
        }
        text += `<b>- Classes:</b> ${spell.Classes}<br/>`;

        return text;
    };

    // Prints the spell to the chat
    const PrintSpell = (book, instance, spell, castLevel, chatMessage) => {        
        const char = GetCharByAny(book.Owner);
        const pb = parseInt(getattr(char.id, 'pb')) || 0;
        const statMod = parseInt(getattr(char.id, instance.Stat.toLowerCase() + '_mod')) || 0;
        const attackMod = parseInt(getattr(char.id, 'globalmagicmod')) || 0;
        const dcMod = parseInt(getattr(char.id, 'spell_dc_mod')) || 0;
        const casterLevel = parseInt(getattr(char.id, 'level')) || 0;
        const dc = 8 + pb + statMod + dcMod;

        const statString = statMod !== 0 ? ` + ${statMod}[${StatMap[instance.Stat]}]` : '';
        const atkString = attackMod !== 0 ? ` + ${attackMod}[ATKMOD]` : '';
        let attackRollStr = `[[@{${book.Owner}|d20}cs>20${statString} + ${pb}[PROF]${atkString}]]`;
        let spellDetails = GetSpellDetails(book, instance, spell, false);

        const upcastIndex = spellDetails.indexOf('Higher Levels:');
        spellDetails = spellDetails.replace(/(\d+)d(\d+)/gmi, (match, p1, p2, offset, string) => {

            // Allow upcasting in higher-level casting section
            let levelScalar = 1;
            let autoEval = false;
            let prefix = '';
            let suffix = '';
            
            if (castLevel > 0) {
                if (offset > upcastIndex && upcastIndex !== -1) {
                    levelScalar = castLevel - spell.Level;
                    prefix = match + ' (for a total of ';
                    suffix = ')';
                }
                autoEval = true;
            } else if (castLevel === 0 && offset <= upcastIndex) {
                if(casterLevel >= 5) {levelScalar++;}
                if(casterLevel >= 11) {levelScalar++;}
                if(casterLevel >= 17) {levelScalar++;}
                autoEval = true;
            }
            
            const retVal = autoEval ? `${prefix}[[${levelScalar*p1}d${p2}]]${suffix}` : match;
            return retVal;
        });
        let parseableDetails = spellDetails.toLowerCase();
        let isSpellAttack = parseableDetails.includes('spell attack');
        let saveString = "";
        saveString += parseableDetails.includes('strength saving throw') || parseableDetails.includes('strength save') ? "Strength Save" : "";
        saveString += parseableDetails.includes('dexterity saving throw') || parseableDetails.includes('dexterity save') ? "Dexterity Save" : "";
        saveString += parseableDetails.includes('constitution saving throw') || parseableDetails.includes('constitution save') ? "Constitution Save" : "";
        saveString += parseableDetails.includes('intelligence saving throw') || parseableDetails.includes('intelligence save') ? "Intelligence Save" : "";
        saveString += parseableDetails.includes('wisdom saving throw') || parseableDetails.includes('wisdom save') ? "Wisdom Save" : "";
        saveString += parseableDetails.includes('charisma saving throw') || parseableDetails.includes('charisma save') ? "Charisma Save" : "";

        const descriptionFull = `<b>- DC:</b> ${dc} ${saveString}<br>${spellDetails}`;

        let spellContents = `&{template:npcatk} `
            +`{{attack=1}}  `
            +`{{name=${book.Owner}}}  `
            +`{{rname=${spell.Name}}}  `
            +`{{rnamec=${spell.Name}}}  `
            +`{{r1=${isSpellAttack ? attackRollStr : '[[0d1]]'}}}  `
            +`{{always=0}}  `
            +`{{r2=${isSpellAttack ? attackRollStr : '[[0d1]]'}}}  `
            +`{{description=${descriptionFull}}}`;

        dlog("Spell Contents: " + spellContents);
        sendToGmAndPlayer(chatMessage, book.Owner, spellContents);
        return spellContents;
    };

    // The various subsections of a spellbook that can be cached
    const CacheOptions = {
        All: 0,
        Owner: 1,
        Filtering: 2,
        Tools: 3,
        Prepared: 4,
        Spells: 5,
        PrepLists: 6
    };

    // Checks specified level and all levels above to see if a spell is castable
    const HasSlotsOfAtLeastLevel = (spellbook, level) => {
        if (level === 0) {
            return true;
        }
        for (let i = level-1; i < spellbook.CurSlots.length; i++) {
            const slotsAtLevel = spellbook.CurSlots[i];
            if (slotsAtLevel > 0) {
                return true;
            }
        }
        return false;
    }

    // Prints a spellbook out to its handout.
    // spellbook: the spellbook object
    // forceReload: an array of CacheOptions that must be rebuilt.
    const PrintSpellbook = (spellbook, forceReload) => {
        const activePrepList = spellbook.PreparationLists[spellbook.ActivePrepList];
        const char = GetCharByAny(spellbook.Owner);
        let text = "";
        let br = "<br/>";
        let hr = "<hr>";

        // Load the cache or build a new one
        let cachedBook = Cache[spellbook.Name];
        if (!cachedBook) {
            // Create a new cache object
            cachedBook = {
                OwnerStr: '',
                FilteringStr: '',
                ToolsStr: '',
                PreparedStr: '',
                SpellsStr: '',
                PrepListsStr: ''
            };
            Cache[spellbook.Name] = cachedBook;
            // There is no cache.  Build everything.
            forceReload = [CacheOptions.All];
        }

        // =================================================================================
        // Owner
        let ownerStr = '';
        if (forceReload.includes(CacheOptions.All) || forceReload.includes(CacheOptions.Owner)) {
            dlog('Rebuilding Owner');
            let uri = `http://journal.roll20.net/character/${char.id}`;
            ownerStr += `<i>A spellbook for </i>${CreateLink(spellbook.Owner, uri)}`;
            ownerStr += '<hr>';
            cachedBook.OwnerStr = ownerStr;
        } else {
            dlog('Using Cached Owner');
            ownerStr = cachedBook.OwnerStr;
        }
        text += ownerStr;

        // =================================================================================
        // Filter bar
        let filterStr = '';
        if (forceReload.includes(CacheOptions.All) || forceReload.includes(CacheOptions.Filtering)) {
            dlog('Rebuilding Filtering');
            const vFilter = CreateLink(`[${FilterSymbols[spellbook.Filter.V]}]`, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --ParamName ^V^ --ParamValue ^?{Please enter the new filter option|V,${Filters.WithFlag}|No-V,${Filters.WithoutFlag}|No Filter,${Filters.NotApplicable}}^`);
            const sFilter = CreateLink(`[${FilterSymbols[spellbook.Filter.S]}]`, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --ParamName ^S^ --ParamValue ^?{Please enter the new filter option|S,${Filters.WithFlag}|No-S,${Filters.WithoutFlag}|No Filter,${Filters.NotApplicable}}^`);
            const mFilter = CreateLink(`[${FilterSymbols[spellbook.Filter.M]}]`, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --ParamName ^M^ --ParamValue ^?{Please enter the new filter option|M,${Filters.WithFlag}|No-M,${Filters.WithoutFlag}|No Filter,${Filters.NotApplicable}}^`);
            const concFilter = CreateLink(`[${FilterSymbols[spellbook.Filter.Concentration]}]`, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --ParamName ^Concentration^ --ParamValue ^?{Please enter the new filter option|Concentration,${Filters.WithFlag}|No-Concentration,${Filters.WithoutFlag}|No Filter,${Filters.NotApplicable}}^`);
            const rituFilter = CreateLink(`[${FilterSymbols[spellbook.Filter.Ritual]}]`, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --ParamName ^Ritual^ --ParamValue ^?{Please enter the new filter option|Ritual,${Filters.WithFlag}|No-Ritual,${Filters.WithoutFlag}|No Filter,${Filters.NotApplicable}}^`);
            const prepFilter = CreateLink(`[${FilterSymbols[spellbook.Filter.Prepared]}]`, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --ParamName ^Prepared^ --ParamValue ^?{Please enter the new filter option|Prepared,${Filters.WithFlag}|No-Prepared,${Filters.WithoutFlag}|No Filter,${Filters.NotApplicable}}^`);
            const slotsFilter = CreateLink(`[${FilterSymbols[spellbook.Filter.Slots]}]`, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --ParamName ^Slots^ --ParamValue ^?{Please enter the new filter option|Slots Remaining,${Filters.WithFlag}|Slots Empty,${Filters.WithoutFlag}|No Filter,${Filters.NotApplicable}}^`);
            const searchFilter = CreateLink(`["${spellbook.Filter.Search}"]`, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --ParamName ^Search^ --ParamValue ^?{Please enter the new search string}^`);
            filterStr += `<b>Filtering:</b> ${vFilter} V ${sFilter} S ${mFilter} M - ${concFilter} Concentration - ${rituFilter} Ritual - ${prepFilter} Prepared - ${slotsFilter} Slots Remaining - ${searchFilter} Search<br/>`;
            cachedBook.FilteringStr = filterStr;
        } else {
            dlog('Using Cached Filtering');
            filterStr = cachedBook.FilteringStr;
        }
        text += filterStr;
        
        // =================================================================================
        // Tools
        let toolsStr = '';
        if (forceReload.includes(CacheOptions.All) || forceReload.includes(CacheOptions.Tools)) {
            dlog('Rebuilding Tools');
            const fillSlotsLink = CreateLink(`[Long Rest]`, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --SetSlots ^Full^`);
            toolsStr += `<b>Tools:</b> ${fillSlotsLink}<br/>`;
            cachedBook.ToolsStr = toolsStr;
        } else {
            dlog('Using Cached Tools');
            toolsStr = cachedBook.ToolsStr;
        }
        text += toolsStr;

        // =================================================================================
        // Prepared Spell Count
        let preparedStr = '';
        if (forceReload.includes(CacheOptions.All) || forceReload.includes(CacheOptions.Prepared)) {
            dlog('Rebuilding Prepared');
            const prepString = `${activePrepList.PreparedSpells.length} ${GetMaxPreparationString(char)}`;
            preparedStr += `<b>Prepared:</b> ${prepString}<br/>`;
            preparedStr += '<hr>';
            cachedBook.PreparedStr = preparedStr;
        } else {
            dlog('Using Cached Prepared');
            preparedStr = cachedBook.PreparedStr;
        }
        text += preparedStr;

        // =================================================================================
        // Spells
        let spellStr = '';
        if (forceReload.includes(CacheOptions.All) || forceReload.includes(CacheOptions.Spells)) {
            dlog('Rebuilding Spells');
            // Perform alpha sort on known spells (in case one got added)
            spellbook.KnownSpells.sort(Sorters.NameAlpha);

            spellStr += '<h2>Spells</h2>';
            spellStr += '<hr>';
            for (let i = 0; i < maxSpellLevel; i++) {
                const hasSlotsOfAtLeastLevel = HasSlotsOfAtLeastLevel(spellbook, i);
                if (i > 0 && ((spellbook.Filter.Slots === Filters.WithFlag && !hasSlotsOfAtLeastLevel) || (spellbook.Filter.Slots === Filters.WithoutFlag && hasSlotsOfAtLeastLevel))) {
                    continue;
                }
                const curSlotLink = CreateLink(`[${spellbook.CurSlots[i-1]}]`, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --UpdateSlot ^${i}^ --ParamName ^Cur^ --ParamValue ^?{Please enter the new current value for Slot Level ${i}}^`);
                const maxSlotLink = CreateLink(`[${spellbook.MaxSlots[i-1]}]`, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --UpdateSlot ^${i}^ --ParamName ^Max^ --ParamValue ^?{Please enter the new maximum value for Slot Level ${i}}^`);
                spellStr += i > 0
                    ? `<h3>Level ${i} Spells - ${curSlotLink} / ${maxSlotLink} </h3>`
                    : `<h3>Cantrips</h3>`;
    
                // Print all spells at current level
                spellbook.KnownSpells.forEach((spellInstance) => {
                    const spell = SpellDict[spellInstance.Name];
                    if (!spell) {
                        sendChat(scname, `ERROR: No such spell ${spellInstance.Name} exists!  This is likely due to a spell rename.  Please use '!SpellMaster --Menu' to manually delete the offending spell.  In the event this does not resolve it, please contact the script author.  state.SpellMaster is being dumped to the logs.`);
                        flog(`Spell ${spellInstance.Name} does not exist.`, 0);
                        return;
                    }
                    if (spell.Level !== i) {
                        return;
                    }
    
                    const spellIsPrepared = activePrepList.PreparedSpells.map((item) => {return item.Name;}).indexOf(spellInstance.Name) > -1
                        || spell.Level === 0
                        || spellInstance.Lock;
                    if (spell.Level !== 0 && ((spellbook.Filter.Prepared === Filters.WithFlag && !spellIsPrepared) || (spellbook.Filter.Prepared === Filters.WithoutFlag && spellIsPrepared))) {
                        return;
                    }

                    // Check filtering
                    if ((spellbook.Filter.V === Filters.WithFlag && !spell.Components.V) 
                        || (spellbook.Filter.V === Filters.WithoutFlag && spell.Components.V)) {
                        return;
                    }
                    if ((spellbook.Filter.S === Filters.WithFlag && !spell.Components.S) 
                        || (spellbook.Filter.S === Filters.WithoutFlag && spell.Components.S)) {
                        return;
                    }
                    if ((spellbook.Filter.M === Filters.WithFlag && !spell.Components.M) 
                        || (spellbook.Filter.M === Filters.WithoutFlag && spell.Components.M)) {
                        return;
                    }
                    if ((spellbook.Filter.Concentration === Filters.WithFlag && spell.Duration.toLowerCase().indexOf('concentration') === -1) 
                        || (spellbook.Filter.Concentration === Filters.WithoutFlag && spell.Duration.toLowerCase().indexOf('concentration') > -1)) {
                        return;
                    }
                    if ((spellbook.Filter.Ritual === Filters.WithFlag && !spell.IsRitual) 
                        || (spellbook.Filter.Ritual === Filters.WithoutFlag && spell.IsRitual)) {
                        return;
                    }
    
                    if (spellbook.Filter.Search.length > 0 
                        && !(spell.Name.includes(spellbook.Filter.Search) 
                            || spell.Components.MDetails.includes(spellbook.Filter.Search) 
                            || spell.Desc.includes(spellbook.Filter.Search) 
                            || spell.Duration.includes(spellbook.Filter.Search) 
                            || spellInstance.Notes.includes(spellbook.Filter.Search)
                            || (spell.Ability && spell.Ability.includes(spellbook.Filter.Search)) 
                            || spell.Classes.includes(spellbook.Filter.Search))) {
                        return;
                    }
                    
                    // Create the preparation button.
                    let prepButton = '';
                    if (spellInstance.Lock) {
                        prepButton = '[O]';
                    } else {
                        prepButton = spellIsPrepared
                            ? CreateLink('[X]', `!SpellMaster --UpdateBook ^${spellbook.Name}^ --UpdateSpell ^${spellInstance.Name}^ --ParamName ^Prepared^ --ParamValue ^False^`)
                            : CreateLink('[_]', `!SpellMaster --UpdateBook ^${spellbook.Name}^ --UpdateSpell ^${spellInstance.Name}^ --ParamName ^Prepared^ --ParamValue ^True^`);
                    }
                    // Cantrips are always prepared
                    prepButton = spell.Level === 0
                        ? '[X]'
                        : prepButton;

                    let tagStr = "";
                    tagStr += spell.IsRitual ? " (R)" : "";
                    tagStr += spell.Duration.toLowerCase().includes('concentration') ? " (C)" : "";

                    const expandedText = spellInstance.IsExpanded 
                        ? CreateLink('[-]', `!SpellMaster --UpdateBook ^${spellbook.Name}^ --UpdateSpell ^${spellInstance.Name}^ --ParamName ^Expanded^ --ParamValue ^False^`)
                        : CreateLink('[+]', `!SpellMaster --UpdateBook ^${spellbook.Name}^ --UpdateSpell ^${spellInstance.Name}^ --ParamName ^Expanded^ --ParamValue ^True^`);

                    // Generate upcast string
                    let canUpcast = false;
                    let levelString = spell.Level;
                    if (spell.Level > 0) {// Ignore cantrips
                        let upcastOptions = "";
                        // Start at current level and scale up, recording all that have valid options
                        for(let j = spell.Level-1; j < maxSpellLevel; j++) {
                            // If the spell level has slots or the individual spell instance has slots, mark it
                            if (spellbook.CurSlots[j] > 0 || (spell.Level-1 === j && spellInstance.CurSlots > 0)) {
                                upcastOptions += `|${j+1}`;
                                if (j >= spell.Level) {
                                    canUpcast = true;
                                }
                            }
                        }
                        if (canUpcast) {
                            levelString = `?{Select the level at which to cast ${spell.Name}${upcastOptions}}`;
                        }
                    }

                    const castLink = CreateLink(spell.Name, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --CastSpell ^${spellInstance.Name}^ --ParamName ^Level^ --ParamValue ^${levelString}^`);
                    const indiCur = CreateLink(`[${spellInstance.CurSlots}]`, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --UpdateSpell ^${spellInstance.Name}^ --ParamName ^CurSlots^ --ParamValue ^?{Please type the new current slots for ${spell.Name}}^`);
                    const indiMax = CreateLink(`[${spellInstance.MaxSlots}]`, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --UpdateSpell ^${spellInstance.Name}^ --ParamName ^MaxSlots^ --ParamValue ^?{Please type the new maximum slots for ${spell.Name}}^`);
                    let titleSlotDisplayStr = '';
                    let innerSlotDisplayStr = '';
                    if (spellInstance.CurSlots > 0 || spellInstance.MaxSlots > 0) {
                        titleSlotDisplayStr = ` - ${indiCur} / ${indiMax}`;
                    } else {
                        innerSlotDisplayStr = `<b>${indiCur} / ${indiMax}</b>`;
                    }

                    spellStr += `<h4>${prepButton} ${castLink}${tagStr}${titleSlotDisplayStr} - ${expandedText}</h4>`;
                    if (spellInstance.IsExpanded) {
                        spellStr += innerSlotDisplayStr;
                        spellStr += hr;
                        spellStr += GetSpellDetails(spellbook, spellInstance, spell, true);
                        spellStr += br;
                        spellStr += CreateLink('[Delete]', `!SpellMaster --UpdateBook ^${spellbook.Name}^ --RemoveSpell ^${spell.Name}^ --Confirm ^?{Type Yes to delete ${spell.Name}}^`);
                        spellStr += ' - ';
                        spellStr += CreateLink('[Lock]', `!SpellMaster --UpdateBook ^${spellbook.Name}^ --UpdateSpell ^${spellInstance.Name}^ --ParamName ^Lock^ --ParamValue ^${spellInstance.Lock ? 'False' : 'True'}^`);
                        spellStr += hr;
                    }
                });
                spellStr += br;
                spellStr += CreateLink('<b>[+]</b>', `!SpellMaster --UpdateBook ^${spellbook.Name}^ --ImportSpell ^?{Please enter the name of the spell you would like to import.}^`);
                spellStr += hr;
            }
            cachedBook.SpellsStr = spellStr;
        } else {
            dlog('Using Cached Spells');
            spellStr = cachedBook.SpellsStr;
        }
        text += spellStr;
        

        // =================================================================================
        // Preparation Tabs
        let prepListStr = '';
        if (forceReload.includes(CacheOptions.All) || forceReload.includes(CacheOptions.PrepLists)) {
            dlog('Rebuilding Prep Lists');
            prepListStr += '<h2>Preparation Lists</h2>';
            for (let i = 0; i < spellbook.PreparationLists.length; i++) {
                const curList = spellbook.PreparationLists[i];
                const isActive = spellbook.ActivePrepList === i;
                const radioButtonActive = isActive
                    ? '[X]'
                    : '[_]';
                const radioButtonLink = CreateLink(radioButtonActive, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --SetActive ^${i}^`);
                const deletePrepLink = CreateLink('[-]', `!SpellMaster --UpdateBook ^${spellbook.Name}^ --RemovePrepList ^${i}^ --Confirm ^?{Type Yes to delete ${curList.Name}}^`);
                const nameLink = CreateLink(curList.Name, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --RenamePrepList ^${i}^ --ParamValue ^?{Please enter the new name for ${curList.Name}}^`);
                prepListStr += `<h4>${radioButtonLink} ${nameLink} (${curList.PreparedSpells.length}) ${deletePrepLink}</h4>`;
            }
            prepListStr += br;
            prepListStr += CreateLink(`<b>[+]</b>`, `!SpellMaster --UpdateBook ^${spellbook.Name}^ --AddPrepList ^?{Please enter the new preparation list name below.}^`);
            cachedBook.PrepListsStr = prepListStr;
        } else {
            dlog('Using Cached Prep List');
            prepListStr = cachedBook.PrepListsStr;
        }
        text += prepListStr;

        // =================================================================================
        // Print
        //log(text);
        GetHandout(spellbook.Handout).set('notes', text);
    };

    // Parse chat messages
    on('chat:message', (msg) => {
        if (msg.type !== 'api') return;
        if (!msg.content.startsWith(chatTrigger)) return;
        if (!SpellsIndexed) {
            sendChat(scname, "SpellMaster is still indexing spells.  Please wait a few seconds and try again.");
            return;
        }
        
        const argWords = msg.content.split(/\s+/);
        const argParams = msg.content.split('--');

        // Prints the chat UI menu
        // !SpellMaster --Menu
        const printMenu = '--Menu';
        if(argWords.includes(printMenu)) {
            let menu = `/w gm &{template:desc} {{desc=<h3>Spell Master</h3><hr>`
                + `[Create Spellbook](!SpellMaster `
                    + `--CreateBook ^?{Please type the name of your previously-created handout to be used for this spellbook.}^ `
                    + `--Owner ^?{Please enter the name of the character that will use this.}^ `
                    + `--Stat ^?{Please list their primary spellcasting ability.|Intelligence|Wisdom|Charisma}^ `
                    + `--ImportClass ^?{Please select a spell list to import in its entirety.  Only recommended for Cleric and Druid.|Artificer|Bard|Cleric|Druid|Paladin|Ranger|Shaman|Warlock|Wizard|None}^ `
                    + `--Level ^?{Please input their total spell-caster level.  Do not count pact magic levels.}^)<br/>`
                + `[Delete Spellbook](!SpellMaster --DeleteBook ^?{Please type the name of the spellbook to delete.}^ --Confirm ^?{Please type Yes to confirm}^)<br/>`
                + `[Delete Spell](!SpellMaster --UpdateBook ^?{Spellbook Name}^ --RemoveSpell ^?{Spell Name}^ --Confirm ^?{Type Yes to confirm deletion of this spell from this spell list.}^)`
                + `}}`;
            log('Menu: ' + menu);
            sendChat(scname, menu);
            return;
        }

        // Create new spell book handout
        // !SpellMaster --CreateBook ^Tazeka's Spells^ --Owner ^Tazeka Liranov^ --Stat ^Wisdom^ --ImportClass ^Druid^ --Level ^11^
        const createBookTag = '--CreateBook';
        if(argWords.includes(createBookTag)) {
            const bookName = GetParamValue(argParams, 'CreateBook');
            const owner = GetParamValue(argParams, 'Owner');
            const stat = GetParamValue(argParams, 'Stat');
            const casterClass = GetParamValue(argParams, 'ImportClass');
            const level = parseInt(GetParamValue(argParams, 'Level')) || 1;

            log("To Configure Handout \"" + bookName + "\" as a spellbook");
            const handout = GetHandout(bookName);
            if(!handout){
                sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" ERROR: No such handout as ${bookName} exists!`);
                return;
            }
            const char = GetCharByAny(owner);
            if (!char) {
                sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" ERROR: No such character ${owner} exists!`);
                return;
            }

            // Get spells for class
            let knownSpells = [];
            if (casterClass !== null && casterClass.length > 0 && casterClass !== 'None') {
                for (let i = 0; i < SpellList.length; i++) {
                    const curSpell = SpellList[i];

                    // Do not autopopulate cantrips
                    if (curSpell.Level === 0) {
                        continue;
                    }

                    // Import the spells
                    if (curSpell.Classes.includes(casterClass)) {
                        knownSpells.push({
                            Name: curSpell.Name,
                            IsExpanded: false,
                            Stat: stat,
                            Lock: false,
                            Notes: '',
                            CurSlots: 0,
                            MaxSlots: 0
                        });
                    }
                }
            }

            // Get caster type
            const type = GetCasterTypeFromClass(casterClass);

            // Create state entry
            BookDict[bookName] = {
                IsSpellbook: true,
                Name: bookName,
                Handout: handout.id,
                Stat: stat,
                Owner: owner,
                CasterClass: casterClass,
                PreparationLists: [// An array of arrays of spell names
                    {
                        Name: 'General',
                        PreparedSpells: []// Will be formatted as an array of spell names that are prepared when a certain list is active
                    }
                ],
                Filter: {
                    V: Filters.NotApplicable,
                    S: Filters.NotApplicable,
                    M: Filters.NotApplicable,
                    Concentration: Filters.NotApplicable,
                    Ritual: Filters.NotApplicable,
                    Slots: Filters.WithFlag,
                    Prepared: Filters.NotApplicable,
                    Search: "",
                },
                ActivePrepList: 0,
                KnownSpells: knownSpells,
                CurSlots: GetBaseSpellSlots(type, level),
                MaxSlots: GetBaseSpellSlots(type, level)
            };
            log("Successfully created a new spell list!");
            PrintSpellbook(BookDict[bookName], [CacheOptions.All]);
            sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" Spellbook created.`);
            return;
        }

        // Update existing book
        // !SpellMaster --UpdateBook ^Tazeka's Spellbook^ --ImportSpell ^Moonbeam^
        // !SpellMaster --UpdateBook ^Tazeka's Spellbook^ --RemoveSpell ^Moonbeam^ --Confirm ^Yes^
        // !SpellMaster --UpdateBook ^Tazeka's Spellbook^ --UpdateSpell ^Moonbeam^ --ParamName ^Prepared^ --ParamValue ^True^
        // !SpellMaster --UpdateBook ^Tazeka's Spellbook^ --UpdateSlot ^3^ --ParamName ^Cur^ --ParamValue ^5^
        // !SpellMaster --UpdateBook ^Tazeka's Spellbook^ --UpdateSlot ^3^ --ParamName ^Max^ --ParamValue ^5^
        // !SpellMaster --UpdateBook ^Tazeka's Spellbook^ --ParamName ^V^ --ParamValue ^Filters.WithFlag^
        // !SpellMaster --UpdateBook ^Tazeka's Spellbook^ --AddPrepList ^Offense^
        // !SpellMaster --UpdateBook ^Tazeka's Spellbook^ --RemovePrepList ^0^ --Confirm ^Yes^
        // !SpellMaster --UpdateBook ^Tazeka's Spellbook^ --RenamePrepList ^0^ --ParamValue ^MyNewName^
        // !SpellMaster --UpdateBook ^Tazeka's Spellbook^ --CastSpell ^Moonbeam^ --ParamName ^Level^ --ParamValue ^3^
        // !SpellMaster --UpdateBook ^Izzy's Spellbook^ --UpdateSpell ^Hex^ --ParamName ^Ability^ --ParamValue ^Charisma^
        // !SpellMaster --UpdateBook ^Tazeka's Spellbook^ --SetSlots ^Full^
        const updateBookTag = '--UpdateBook';
        if (argWords.includes(updateBookTag)) {
            // Book to use
            const bookName = GetParamValue(argParams, 'UpdateBook');
            const spellbook = BookDict[bookName];
            if (!spellbook) {
                sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" No such book as ${bookName}`);
                return;
            }

            // Other operation codes
            const importSpell = GetParamValue(argParams, 'ImportSpell');
            const removeSpell = GetParamValue(argParams, 'RemoveSpell');
            const updateSpell = GetParamValue(argParams, 'UpdateSpell');
            const updateSlot = GetParamValue(argParams, 'UpdateSlot');
            const addPrepList = GetParamValue(argParams, 'AddPrepList');
            const setActive = GetParamValue(argParams, 'SetActive');
            const removePrepList = GetParamValue(argParams, 'RemovePrepList');
            const renamePrepList = GetParamValue(argParams, 'RenamePrepList');
            const castSpell = GetParamValue(argParams, 'CastSpell');
            const setSlots = GetParamValue(argParams, 'SetSlots');

            // Parameters
            const paramName = GetParamValue(argParams, 'ParamName');
            const paramValue = GetParamValue(argParams, 'ParamValue');
            const confirm = GetParamValue(argParams, 'Confirm');

            // the list of caches that need to be updated.  Duplicates are fine.
            reloadCacheFor = [];

            // Interaction buttons
            if (importSpell) {
                const spell = SpellDict[importSpell];
                if (!spell) {
                    sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" Invalid spell name to import: ${importSpell}`);
                    return;
                }
                for (let i = 0; i < spellbook.KnownSpells.length; i++) {
                    const knownSpell = spellbook.KnownSpells[i];
                    if (knownSpell.Name === importSpell) {
                        sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" ${importSpell} cannot be imported as it is already in your list!`);
                        return;
                    }
                }
                BookDict[bookName].KnownSpells.push({
                    Name: spell.Name,
                    IsExpanded: false,
                    Stat: BookDict[bookName].Stat,
                    Lock: false,
                    Notes: '',
                    CurSlots: 0,
                    MaxSlots: 0
                });
                reloadCacheFor.push(CacheOptions.Spells);
            } else if (removeSpell) {
                if (confirm !== 'Yes') {
                    return;
                }
                const knownSpells = spellbook.KnownSpells;
                let spellUnprepared = false;
                let spellDeleted = false;

                // Remove from any preparation lists
                for(let i = 0; i < spellbook.KnownSpells.length; i++) {
                    const knownSpell = spellbook.KnownSpells[i];
                    if (knownSpell.Name === removeSpell) {
                        for(let j = 0; j < spellbook.PreparationLists.length; j++) {
                            const prepList = spellbook.PreparationLists[j].PreparedSpells;
                            const prepIndex = prepList.indexOf(knownSpell);
                            if (prepIndex > -1) {
                                prepList.splice(prepIndex, 1);
                                spellUnprepared = true;
                            }
                        }
                    }
                }

                // Remove from known list
                for (let i = 0; i < knownSpells.length; i++) {
                    const curSpellInstance = knownSpells[i];
                    if (curSpellInstance.Name === removeSpell) {
                        knownSpells.splice(i,1);
                        spellDeleted = true;
                        break;
                    }
                }

                if (!spellDeleted) {
                    sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" Invalid spell name to delete: ${removeSpell}`);
                    return;
                }

                // Set cache options
                reloadCacheFor.push(CacheOptions.Spells);
                if (spellUnprepared) {
                    reloadCacheFor.push(CacheOptions.Prepared);
                    reloadCacheFor.push(CacheOptions.PrepLists);
                }
            } else if (updateSpell) {
                if (paramName === 'Prepared') {
                    const prepList = spellbook.PreparationLists[spellbook.ActivePrepList].PreparedSpells;
                    if (paramValue === 'True') {
                        for(let i = 0; i < spellbook.KnownSpells.length; i++) {
                            const knownSpell = spellbook.KnownSpells[i];
                            if (knownSpell.Name === updateSpell) {
                                if (!prepList.includes(knownSpell)) {
                                    prepList.push(knownSpell);
                                }
                                break;
                            }
                        }
                    } else {
                        for(let i = 0; i < spellbook.KnownSpells.length; i++) {
                            const knownSpell = spellbook.KnownSpells[i];
                            if (knownSpell.Name === updateSpell) {
                                const prepIndex = prepList.indexOf(knownSpell);
                                if (prepIndex > -1) {
                                    prepList.splice(prepIndex, 1);
                                }
                                break;
                            }
                        }
                    }
                    reloadCacheFor.push(CacheOptions.Spells);
                    reloadCacheFor.push(CacheOptions.Prepared);
                    reloadCacheFor.push(CacheOptions.PrepLists);
                } else if (paramName === 'Expanded') {
                    for (let i = 0; i < spellbook.KnownSpells.length; i++) {
                        const knownSpell = spellbook.KnownSpells[i];
                        if (knownSpell.Name === updateSpell) {
                            knownSpell.IsExpanded = paramValue === 'True';
                            break;
                        }
                    }
                    reloadCacheFor.push(CacheOptions.Spells);
                } else if (paramName === 'Ability') {
                    for (let i = 0; i < spellbook.KnownSpells.length; i++) {
                        const knownSpell = spellbook.KnownSpells[i];
                        if (knownSpell.Name === updateSpell) {
                            knownSpell.Stat = paramValue;
                            break;
                        }
                    }
                    reloadCacheFor.push(CacheOptions.Spells);
                } else if (paramName === 'Notes') {
                    for (let i = 0; i < spellbook.KnownSpells.length; i++) {
                        const knownSpell = spellbook.KnownSpells[i];
                        if (knownSpell.Name === updateSpell) {
                            knownSpell.Notes = paramValue;
                            break;
                        }
                    }
                    reloadCacheFor.push(CacheOptions.Spells);
                } else if (paramName === 'Lock') {
                    for (let i = 0; i < spellbook.KnownSpells.length; i++) {
                        const knownSpell = spellbook.KnownSpells[i];
                        if (knownSpell.Name === updateSpell) {
                            knownSpell.Lock = paramValue === 'True';

                            break;
                        }
                    }
    
                    if (paramValue === 'True') {
                        // Remove from any preparation lists (since it's now in all and none of them)
                        for(let i = 0; i < spellbook.KnownSpells.length; i++) {
                            const knownSpell = spellbook.KnownSpells[i];
                            if (knownSpell.Name === updateSpell) {
                                for(let j = 0; j < spellbook.PreparationLists.length; j++) {
                                    const prepList = spellbook.PreparationLists[j].PreparedSpells;
                                    const prepIndex = prepList.indexOf(knownSpell);
                                    if (prepIndex > -1) {
                                        prepList.splice(prepIndex, 1);
                                    }
                                }
                            }
                        }
                    }

                    reloadCacheFor.push(CacheOptions.Prepared);
                    reloadCacheFor.push(CacheOptions.PrepLists);
                    reloadCacheFor.push(CacheOptions.Spells);
                } else if (paramName === 'CurSlots') {
                    const newVal = parseInt(paramValue) || 0;
                    for (let i = 0; i < spellbook.KnownSpells.length; i++) {
                        const knownSpell = spellbook.KnownSpells[i];
                        if (knownSpell.Name === updateSpell) {
                            knownSpell.CurSlots = newVal;
                            break;
                        }
                    }
                    reloadCacheFor.push(CacheOptions.Spells);
                } else if (paramName === 'MaxSlots') {
                    const newVal = parseInt(paramValue) || 0;
                    for (let i = 0; i < spellbook.KnownSpells.length; i++) {
                        const knownSpell = spellbook.KnownSpells[i];
                        if (knownSpell.Name === updateSpell) {
                            knownSpell.MaxSlots = newVal;
                            break;
                        }
                    }
                    reloadCacheFor.push(CacheOptions.Spells);
                }
            } else if (updateSlot) {
                const slotIndex = (parseInt(updateSlot) || 0) - 1;
                const newVal = parseInt(paramValue);
                if (paramName === 'Max') {
                    spellbook.MaxSlots[slotIndex] = newVal;
                } else if (paramName === 'Cur') {
                    spellbook.CurSlots[slotIndex] = newVal;
                }
                reloadCacheFor.push(CacheOptions.Spells);
            } else if (addPrepList) {
                for(let i = 0; i < spellbook.PreparationLists.length; i++) {
                    const existingPrepList = spellbook.PreparationLists[i];
                    if (existingPrepList.Name === addPrepList) {
                        sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" Invalid preparation list name ${addPrepList} as it already exists in this spellbook.`);
                        return;
                    }
                }
                spellbook.PreparationLists.push({
                    Name: addPrepList,
                    PreparedSpells: []// Will be formatted as an array of spell names that are prepared when a certain list is active
                });

                reloadCacheFor.push(CacheOptions.PrepLists);
            } else if (setActive) {
                const activeIndex = parseInt(setActive) || 0;
                spellbook.ActivePrepList = activeIndex;

                reloadCacheFor.push(CacheOptions.Prepared);
                reloadCacheFor.push(CacheOptions.Spells);
                reloadCacheFor.push(CacheOptions.PrepLists);
            } else if (removePrepList) {
                if (confirm !== 'Yes') {
                    return;
                }
                const prepIdToRemove = parseInt(removePrepList);
                if (spellbook.ActivePrepList == prepIdToRemove) {
                    sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" Cannot remove currently-active preparation list.`);
                    return;
                }
                spellbook.PreparationLists.splice(parseInt(removePrepList), 1);
                
                reloadCacheFor.push(CacheOptions.PrepLists);
            } else if (renamePrepList) {
                const prepIdToRename = parseInt(renamePrepList);

                // Make sure not empty string
                if (paramValue.length === 0) {
                    sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" Cannot set name to empty string.`);
                    return;
                }

                // Names must be exclusive
                for (let i = 0; i < spellbook.PreparationLists.length; i++) {
                    if (spellbook.PreparationLists[i].Name === paramValue && i !== prepIdToRename) {
                        sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" Name already exists.`);
                        return;
                    }
                }

                spellbook.PreparationLists[prepIdToRename].Name = paramValue;

                reloadCacheFor.push(CacheOptions.PrepLists);
            } else if (castSpell) {
                const spell = SpellDict[castSpell];
                dlog(spellbook.Owner + ' is casting ' + spell.Name + ' with level ' + paramValue + ' when base spell level is ' + spell.Level);
                const level = parseInt(paramValue) || 0;
                if (level < 0 || level < spell.Level) {
                    sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" Invalid cast level ${paramValue}.`);
                    return;
                }
                if (spellbook.CurSlots[level-1] === 0 && level === 0) {
                    sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" Unable to cast spell from expended slot level.`);
                    return;
                }
                let instance = false;
                for (let i in spellbook.KnownSpells) {
                    let curInstance = spellbook.KnownSpells[i];
                    if (curInstance.Name === castSpell) {
                        instance = curInstance;
                        break;
                    }
                }
                if (!instance) {
                    sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" Instance does not exist.`);
                    return;
                }
                dlog(`Available slots: Individual=${instance.CurSlots} - Global=${spellbook.CurSlots[level-1]}`);
                if(level > 0 && instance.CurSlots < 1 && spellbook.CurSlots[level-1] < 1) {
                    sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" Spell slots of that level are exhausted.`);
                    return;
                }
                PrintSpell(spellbook, instance, spell, level, msg);
                if(level > 0) {
                    // Attempt to cast from per-spell slots first since they sometimes recharge faster, but only if casting at base level
                    if (instance.CurSlots > 0 && spell.Level === level) {
                        instance.CurSlots--;
                    } else {
                        spellbook.CurSlots[level-1]--;
                    }
                }

                reloadCacheFor.push(CacheOptions.Spells);
            } else if (setSlots) {
                if (setSlots === 'Full') {
                    // Refill spell level slots
                    for(let i = 0; i < spellbook.CurSlots.length; i++) {
                        spellbook.CurSlots[i] = spellbook.MaxSlots[i];
                    }

                    // Refill class/other feature slots
                    for (let i = 0; i < spellbook.KnownSpells.length; i++) {
                        const knownSpell = spellbook.KnownSpells[i];
                        knownSpell.CurSlots = knownSpell.MaxSlots;
                    }
                }
                reloadCacheFor.push(CacheOptions.Spells);
            }
            
            // Filtration
            else if (paramName === 'V') {
                spellbook.Filter.V = parseInt(paramValue);
                reloadCacheFor.push(CacheOptions.Spells);
                reloadCacheFor.push(CacheOptions.Filtering);
            } else if (paramName === 'S') {
                spellbook.Filter.S = parseInt(paramValue);
                reloadCacheFor.push(CacheOptions.Spells);
                reloadCacheFor.push(CacheOptions.Filtering);
            } else if (paramName === 'M') {
                spellbook.Filter.M = parseInt(paramValue);
                reloadCacheFor.push(CacheOptions.Spells);
                reloadCacheFor.push(CacheOptions.Filtering);
            } else if (paramName === 'Ritual') {
                spellbook.Filter.Ritual = parseInt(paramValue);
                reloadCacheFor.push(CacheOptions.Spells);
                reloadCacheFor.push(CacheOptions.Filtering);
            } else if (paramName === 'Slots') {
                spellbook.Filter.Slots = parseInt(paramValue);
                reloadCacheFor.push(CacheOptions.Spells);
                reloadCacheFor.push(CacheOptions.Filtering);
            } else if (paramName === 'Concentration') {
                spellbook.Filter.Concentration = parseInt(paramValue);
                reloadCacheFor.push(CacheOptions.Spells);
                reloadCacheFor.push(CacheOptions.Filtering);
            } else if (paramName === 'Prepared') {
                spellbook.Filter.Prepared = parseInt(paramValue);
                reloadCacheFor.push(CacheOptions.Spells);
                reloadCacheFor.push(CacheOptions.Filtering);
            } else if (paramName === 'Search') {
                spellbook.Filter.Search = paramValue;
                reloadCacheFor.push(CacheOptions.Spells);
                reloadCacheFor.push(CacheOptions.Filtering);
            }

            PrintSpellbook(BookDict[bookName], reloadCacheFor);
            return;
        }

        // Remove existing book
        // !SpellMaster --DeleteBook ^Tazeka's Spellbook^ --Confirm ^Yes^
        const deleteBookTag = '--DeleteBook';
        if (argWords.includes(deleteBookTag)) {
            const bookToDelete = GetParamValue(argParams, 'DeleteBook');
            const confirm = GetParamValue(argParams, 'Confirm');
            const spellbook = BookDict[bookToDelete];
            if (!spellbook) {
                sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" No such spellbook as ${bookToDelete} exists`);
                return;
            }
            if (confirm === 'Yes') {
                delete BookDict[bookToDelete];
                GetHandout(spellbook.Handout).set('notes', '');
                sendChat(scname, `/w "${msg.who.replace(' (GM)', '')}" Spellbook deleted.`);
            }
        }
    });

    // Perform garbage collection on orphaned spellbooks
    const PurgeOldSpellbooks = () => {
        // This won't clean up *instantly* but this runs every time, so this will anneal state over time
        for (let bookName in BookDict) {
            const book = BookDict[bookName];
            // Don't accidentally delete any non-spellbook properties
            if (book.IsSpellbook) {
                // Attempt to get the handout.
                const handout = GetHandout(book);
                // If it's dead, delete it because the user destroyed it.
                if (handout === null) {
                    log("WARNING: SpellMaster detected orphan book to be delted: " + bookName);
                    delete BookDict[bookName];
                    break;
                }
            }
        }
    }
    PurgeOldSpellbooks();
});

if (typeof MarkStop != 'undefined') MarkStop('SpellMaster');