if (typeof MarkStart != 'undefined') MarkStart('SpellMaster');
if(!SpellList) throw new Exception("Spell List Not Included!");
const SpellDict = {};

if(!state.SpellMaster) {
    state.SpellMaster = {};
}

on('ready', () => {
    const chatTrigger = '!SpellMaster';
    const scname = 'SpellMaster';

    // Creates dictionary of spell
    const IndexSpellbook = () => {
        for(let i = 0; i < SpellList.length; i++){
            let spell = SpellList[i];
            SpellDict[spell.Name] = spell;
        }
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

    // Creates a link 
    const CreateLink = (text, linkTo) => {
        return `<a href="${linkTo}">${text}</a>`;
    };

    // Prints a spellbook out to its handout
    const PrintSpellbook = (spellbook) => {
        let text = "";
        let br = "<br/>";

        // Owner
        let uri = `http://journal.roll20.net/character/${GetCharByAny(spellbook.Owner).id}`;
        text += `<i>A spellbook for </i>${CreateLink(spellbook.Owner, uri)}`;
        text += '<hr>';

        // Filter bar
        text += `|Export|   |Import|${br}`;
        text += `Filtering: |_| V |_| S |_| M   |_| Concentration  |_| Hide Unprepared   |Search|`;
        text += '<hr>';

        // Spells
        text += '<h2>Spells</h2>';
        const activePrepList = spellbook.PreparationLists[spellbook.ActivePrepList];
        for (let i = 0; i < 10; i++) {
            text += i > 0
                ? `<h3>Level ${i} Spells - |${spellbook.CurSlots[i-1]}| / |${spellbook.MaxSlots[i-1]}| </h3>`
                : `<h3>Cantrips</h3>`;
            spellbook.KnownSpells.forEach((spellInstance) => {
                const spell = SpellDict[spellInstance.Name];
                if (spell.Level === i) {
                    const prepButton = activePrepList.PreparedSpells.indexOf(spellInstance) === -1
                        ? CreateLink('[_]', `!SpellMaster --UpdateBook ^${spellbook.Name}^ --UpdateSpell ^${spellInstance.Name}^ --ParamName ^Prepared^ --ParamValue ^True^`)
                        : CreateLink('[X]', `!SpellMaster --UpdateBook ^${spellbook.Name}^ --UpdateSpell ^${spellInstance.Name}^ --ParamName ^Prepared^ --ParamValue ^False^`);
                    const expandedText = spellInstance.IsExpanded ? '|-|' : '|+|';
                    text += `<h4>${prepButton} ${spell.Name} ${expandedText}</h4>`;
                }
            });
            text += `<h4>|+|</h4>`;
            text += '<hr>';
        }

        // Preparation Tabs
        text += '<h2>Preparation Lists</h2>';
        for (let i = 0; i < spellbook.PreparationLists.length; i++) {
            const curList = spellbook.PreparationLists[i];
            const isActive = spellbook.ActivePrepList === i;
            text += `<h4>|_| ${curList.Name} |-|`;
        }
        text += `<h4>|+|</h4>`;

        // Print
        log(text);
        GetHandout(spellbook.Handout).set('notes', text);
    };

    // Parse chat messages
    on('chat:message', (msg) => {
        if (msg.type !== 'api') return;
        if (!msg.content.startsWith(chatTrigger)) return;
        
        const argWords = msg.content.split(/\s+/);
        const argParams = msg.content.split('--');

        // Create new spell book handout
        // !SpellMaster --CreateBook ^Tazeka's Spells^ --Owner ^Tazeka Liranov^ --Stat ^Wisdom^ --ImportClass ^Druid^ --Level ^11^
        const createBookTag = '--CreateBook';
        if(argWords.includes(createBookTag)){
            const bookName = GetParamValue(argParams, 'CreateBook');
            const owner = GetParamValue(argParams, 'Owner');
            const stat = GetParamValue(argParams, 'Stat');
            const casterClass = GetParamValue(argParams, 'ImportClass');
            const level = parseInt(GetParamValue(argParams, 'Level')) || 1;

            log("To Configure Handout \"" + bookName + "\" as a spellbook");
            const handout = GetHandout(bookName);
            if(!handout){
                log("ERROR: No such handout exists!");
                return;
            }

            // Get spells for class
            let knownSpells = [];
            if (casterClass !== null) {
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
                            Stat: stat
                        });
                    }
                }
            }

            // Get caster type
            const type = GetCasterTypeFromClass(casterClass);

            // Create state entry
            state.SpellMaster[bookName] = {
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
                ActivePrepList: 0,
                KnownSpells: knownSpells,
                CurSlots: GetBaseSpellSlots(type, level),
                MaxSlots: GetBaseSpellSlots(type, level)
            };
            log("Successfully created a new spell list!");

            PrintSpellbook(state.SpellMaster[bookName]);
            return;
        }

        // Update existing book
        // !SpellMaster --UpdateBook ^Tazeka's Spellbook^ --ImportSpell ^Moonbeam^
        // !SpellMaster --UpdateBook ^Tazeka's Spellbook^ --RemoveSpell ^Moonbeam^
        // !SpellMaster --UpdateBook ^Tazeka's Spellbook^ --UpdateSpell ^Moonbeam^ --ParamName ^Prepared^ --ParamValue ^True^
        const updateBookTag = '--UpdateBook';
        if (argWords.includes(updateBookTag)) {
            const bookName = GetParamValue(argParams, 'UpdateBook');
            const importSpell = GetParamValue(argParams, 'ImportSpell');
            const removeSpell = GetParamValue(argParams, 'RemoveSpell');
            const updateSpell = GetParamValue(argParams, 'UpdateSpell');
            const paramName = GetParamValue(argParams, 'ParamName');
            const paramValue = GetParamValue(argParams, 'ParamValue');

            log("Updating book " + bookName);

            if (importSpell) {
                sendChat(scname, 'IMPORT UNSUPPORTED! :(');
                return;
            } else if (removeSpell) {
                sendChat(scname, 'REMOVE UNSUPPORTED! :(');
                return;
            } else if (updateSpell) {
                const spellbook = state.SpellMaster[bookName];
                if (paramName === 'Prepared') {
                    const prepList = spellbook.PreparationLists[spellbook.ActivePrepList].PreparedSpells;
                    log("Prep List: " + prepList);
                    if (paramValue === 'True') {
                        for(let i = 0; i < spellbook.KnownSpells.length; i++) {
                            const knownSpell = spellbook.KnownSpells[i];
                            if (knownSpell.Name === updateSpell) {
                                log("Adding known spell " + knownSpell + " to prepared list");
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
                }
            }

            PrintSpellbook(state.SpellMaster[bookName]);
            return;
        }

        // Remove existing book
        // !SpellMaster --DeleteBook "Tazeka's Spellbook"
    });
});

if (typeof MarkStop != 'undefined') MarkStop('SpellMaster');