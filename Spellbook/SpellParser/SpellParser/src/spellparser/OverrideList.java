package spellparser;

import java.util.HashSet;

public class OverrideList {
    private String name;
    private HashSet<String> spells;
    
    public OverrideList(String name, String[] spells) {
        this.name = name;
        this.spells = new HashSet<>();
        for(int i = 0; i < spells.length; i++) {
            this.spells.add(spells[i]);
        }
    }
    
    public String getName() {
        return name;
    }
    
    public boolean hasSpell(String spell) {
        return spells.contains(spell);
    }
}
