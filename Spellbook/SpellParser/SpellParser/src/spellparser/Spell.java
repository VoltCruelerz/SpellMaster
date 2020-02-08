package spellparser;

public class Spell implements Comparable<Spell>{
    public String Name = "";
    public String OldName = "";
    public int Level = -1;
    public String School = "";
    public boolean IsRitual = false;
    public String CastTime = "";
    public String Range = "";
    public SpellComponents Components = null;
    public String Duration = "";
    public String Ability = "";
    public String Desc = "";
    public String Classes = "";
    
    public Spell(boolean srdOnly, String name, int level, String school, boolean isRitual, String castTime, String range, SpellComponents components, String duration, String ability, String desc, String classes) {
        Name = handleSRD(srdOnly, name);
        Level = level;
        School = school;
        IsRitual = isRitual;
        CastTime = castTime;
        Range = range;
        Components = components;
        Duration = duration;
        Ability = ability;
        Desc = desc;
        Classes = classes.trim();
    }
    
    // Specify Old Name
    public Spell(boolean srdOnly, String name, String oldName, int level, String school, boolean isRitual, String castTime, String range, SpellComponents components, String duration, String ability, String desc, String classes) {
        Name = name;
        OldName = handleSRD(srdOnly, oldName);
        Level = level;
        School = school;
        IsRitual = isRitual;
        CastTime = castTime;
        Range = range;
        Components = components;
        Duration = duration;
        Ability = ability;
        Desc = desc;
        Classes = classes.trim();
    }
    
    public String handleSRD(boolean srdOnly, String originalName) {
        // The SRD is OGL, and OGL means we need to rip out proper names...
        if (srdOnly) {
            if (originalName.equals("Tenser's Floating Disk")) {
                return "Floating Disk";
            } else if (originalName.equals("Tasha's Hideous Laughter")) {
                return "Hideous Laughter";
            } else if (originalName.equals("Melf's Acid Arrow")) {
                return "Acid Arrow";
            } else if (originalName.equals("Nystul's Magic Aura")) {
                return "Magic Aura";
            } else if (originalName.equals("Leomund's Tiny Hut")) {
                return "Tiny Hut";
            } else if (originalName.equals("Evard's Black Tentacles")) {
                return "Black Tentacles";
            } else if (originalName.equals("Mordenkainen's Faithful Hound")) {
                return "Faithful Hound";
            } else if (originalName.equals("Mordenkainen's Private Sanctum")) {
                return "Private Sanctum";
            } else if (originalName.equals("Otiluke's Resilient Sphere")) {
                return "Resilient Sphere";
            } else if (originalName.equals("Leomund's Secret Chest")) {
                return "Secret Chest";
            } else if (originalName.equals("Bigby's Hand")) {
                return "Arcane Hand";
            } else if (originalName.equals("Rary's Telepathic Bond")) {
                return "Telepathic Bond";
            } else if (originalName.equals("Otiluke's Freezing Sphere")) {
                return "Freezing Sphere";
            } else if (originalName.equals("Drawmij's Instant Summons")) {
                return "Instant Summons";
            } else if (originalName.equals("Otto's Irresistible Dance")) {
                return "Irresistible Dance";
            } else if (originalName.equals("Mordenkainen's Sword")) {
                return "Arcane Sword";
            } else if (originalName.equals("Mordenkainen's Magnificent Mansion")) {
                return "Magnificent Mansion";
            }
        }
        return originalName;
    }
    
    public void Dump() {
        System.out.println("[" + Level + "] " + Name);
        if (OldName.length() > 0) {
            System.out.println("- Old Name: " + OldName);
        }
        System.out.println("- School: " + School);
        System.out.println("- IsRitual: " + IsRitual);
        System.out.println("- CastTime: " + CastTime);
        System.out.println("- Range: " + Range);
        System.out.println("- Components: " + Components.Dump());
        System.out.println("- Duration: " + Duration);
        System.out.println("- Desc: " + Desc);
        System.out.println("- Classes: " + Classes);
    }
    
    public String PrintJS() {
        String tab = "    ";
        String quote = "\"";
        String comma = ",";
        String backslash = "\\";
        String newLine = "\n";
        String divOpen = "<div>";
        String divClose = "</div>";
        
        String escapedQuoteDesc = Desc.replace(quote, backslash + quote).replace(divOpen, "").replace(divClose, "");
        String beautifiedDesc = escapedQuoteDesc.replace(newLine, "|" + quote + newLine + tab + tab + "+ " + quote);
        
        String str = tab + "{" + newLine;
        str = str + tab + tab + "Name: " + quote + Name + quote + comma + newLine;
        str = str + tab + tab + "Level: " + Level + comma + newLine;
        str = str + tab + tab + "School: " + quote + School + quote + comma + newLine;
        str = str + tab + tab + "IsRitual: " + IsRitual + comma + newLine;
        str = str + tab + tab + "CastTime: " + quote + CastTime + quote + comma + newLine;
        str = str + tab + tab + "Range: " + quote + Range + quote + comma + newLine;
        str = str + tab + tab + "Components: " + Components.PrintJS() + comma + newLine;
        str = str + tab + tab + "Duration: " + quote + Duration + quote + comma + newLine;
        str = str + tab + tab + "Desc: " + quote + beautifiedDesc + quote + comma + newLine;
        str = str + tab + tab + "Classes: " + quote + Classes + quote + newLine;
        str = str + tab + "}";
        return str;
    }
    
    public int compareTo(Spell o) {
        int diff = this.Level - o.Level;
        if(diff == 0){
            return this.Name.compareTo(o.Name);
        }
        return diff;
    }
}
