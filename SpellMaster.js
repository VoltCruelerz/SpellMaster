if (typeof MarkStart != 'undefined') MarkStart('Spellbook');
if(!SpellList) throw new Exception("Spell List Not Included!");
const Spellbook = {};
if(!state.SpellMaster) {
    state.SpellMaster = {};
}

on('ready', () => {
    const chatTrigger = '!SpellMaster';
    const scname = 'SpellMaster';

    // Creates dictionary of spell
    const IndexSpellbook = () => {
        for(var i = 0; i < SpellList.Count; i++){
            var spell = SpellList[i];
            Spellbook[spell.Name] = spell;
        }
    };
    IndexSpellbook();
    log("Spellbook Indexed with " + SpellList.length + " spells.");

    // Retrieves a handout by name
    const GetHandout = (name) => {
        const list = findObjs({
            _type: 'handout',
            name: name,
        });
        if (list.length === 1) {
            return list[0];
        }
    }

    // Pulls the interior message out of double quotes
    const dequote = (quotedString) => {
        const startQuote = string.indexOf('"');
        const endQuote = string.lastIndexOf('"');
        if (startQuote >= endQuote) {
            if (!quietMode) {
                sendChat(scname, `**ERROR:** You must specify a target by name within double quotes in the phrase ${string}`);
            }
            return null;
        }
        return string.substring(startQuote + 1, endQuote);
    }

    // Do the thing!
    on('chat:message', (msg) => {
        if (msg.type !== 'api') return;
        if (!msg.content.startsWith(chatTrigger)) return;
        
        const argWords = msg.content.split(/\s+/);

        // Create new spell book handout
        // !SpellMaster --CreateBook "Tazeka's Spellbook" --Owner "Tazeka Liranov" --Ability "Wisdom" --ImportClass "Druid" 
        const createBookTag = '--CreateBook';
        if(argWords.includes(createBookTag)){
            const bookName = msg.content.substring((chatTrigger + ' ' + createBookTag).length + 1);
            log("To Configure Handout " + bookName + " as a spellbook");
            const handout = GetHandout(bookName);
            if(!handout){
                log("No such handout exists!");
            }
            state.SpellMaster[bookName] = {
                Name: bookName,
                Handout: handout,
                Stat: "",
                PreparationLists: [// An array of arrays of spell names
                    []// Will be formatted as an array of spell names that are prepared when a certain list is active
                ],
                ActivePrepList: 0,
                KnownSpells: [],
                SlotsCurrent = [2,0,0,0,0,0,0,0,0],
                SlotsMax =     [2,0,0,0,0,0,0,0,0]
            };
            log("Successfully created a new spell list!");
            return;
        }

        // Update existing book
        // !SpellMaster --UpdateBook "Tazeka's Spellbook" --ImportSpell "Moonbeam"

        // Remove existing book
        // !SpellMaster --DeleteBook "Tazeka's Spellbook"
    });
});

if (typeof MarkStop != 'undefined') MarkStop('Spellbook');