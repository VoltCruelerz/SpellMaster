package spellparser;

public class Spell implements Comparable<Spell>{
    public String Name = "";
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
    
    public Spell(String name, int level, String school, boolean isRitual, String castTime, String range, SpellComponents components, String duration, String ability, String desc, String classes) {
        Name = name;
        Level = level;
        School = school;
        IsRitual = isRitual;
        CastTime = castTime;
        Range = range;
        Components = components;
        Duration = duration;
        Ability = ability;
        Desc = desc;
        Classes = classes;
    }
    
    public void Dump() {
        System.out.println("[" + Level + "] " + Name);
        System.out.println("- School: " + School);
        System.out.println("- IsRitual: " + IsRitual);
        System.out.println("- CastTime: " + CastTime);
        System.out.println("- Range: " + Range);
        System.out.println("- Components: " + Components);
        System.out.println("- Duration: " + Duration);
        System.out.println("- Desc: " + Desc);
        System.out.println("- Classes: " + Classes);
    }
    
    public String PrintJS() {
        String tab = "    ";
        String quote = "\"";
        String comma = ",";
        String newLine = "\n";
        
        String str = tab + "{" + newLine;
        str = str + tab + tab + "Name: " + quote + Name + quote + comma + newLine;
        str = str + tab + tab + "Level: " + Level + comma + newLine;
        str = str + tab + tab + "School: " + quote + School + quote + comma + newLine;
        str = str + tab + tab + "IsRitual: " + IsRitual + comma + newLine;
        str = str + tab + tab + "CastTime: " + quote + CastTime + quote + comma + newLine;
        str = str + tab + tab + "Range: " + quote + Range + quote + comma + newLine;
        str = str + tab + tab + "Components: " + Components.PrintJS() + comma + newLine;
        str = str + tab + tab + "Duration: " + quote + Duration + quote + comma + newLine;
        str = str + tab + tab + "Desc: " + quote + Desc.replace(quote, "\\\"").replace(newLine, "<br/>" + quote + newLine + tab + tab + "+ " + quote) + quote + comma + newLine;
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
