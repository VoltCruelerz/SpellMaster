package spellparser;

import com.sun.xml.internal.ws.util.StringUtils;

import java.io.File;

import java.nio.charset.Charset;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import java.util.ArrayList;
import java.util.List;

import com.google.gson.*;

import java.io.FileNotFoundException;
import java.io.PrintWriter;

public class Parser {
    public String ExciseString(String src, String leftTag, String rightTag){
        String trimmedSrc = src.trim();
        //System.out.println("SRC: " + src);
        String noLeft = trimmedSrc.substring(trimmedSrc.indexOf(leftTag) + leftTag.length()).trim();
        //System.out.println("  Noleft: " + noLeft);
        //System.out.println("  L: " + leftTag);
        //System.out.println("  R: " + rightTag);
        return noLeft.substring(0, noLeft.indexOf(rightTag)).trim();
    }
    
    public Spell ParseRawSpellFile(Object[] lines){
        // Tags for catching fields
        String titleStartTag = "<h1 class=\"classic-title\"><span>";
        String titleEndTag = "</span></h1>";
        String levelTag = "Level: <strong>";
        String castTag = "Casting time: <strong>";
        String rangeTag = "Range: <strong>";
        String componentsTag = "Components: <strong>";
        String durationTag = "Duration: <strong>";
        String strongEndTag = "</strong>";
        String pStart = "<p>";
        String pEnd = "</p>";
        String higherLevelLine = "<h4 class=\"classic-title\"><span>At higher level</span></h4>";
        String classStartTag = "<a href=\"https://www.dnd-spells.com/spells/class/";
        String classStopTag = "\"";
        String badBreakTag = "<br />";
        String goodBreakTag = "<br/>";
        
        int level = -1;
        String name = "";
        String school = "";
        boolean isRitual = false;
        String castTime = "";
        String range = "";
        SpellComponents components = null;
        String duration = "";
        String ability = "Spell";
        String desc = "";
        String classes = "";
        ArrayList<String> classList = new ArrayList<String>();

        for(int i = 0; i < lines.length; i++){
            String line = (String)lines[i];
            line = line.trim();
            // Name
            if(line.indexOf(titleStartTag) == 0){
                name = ExciseString(line, titleStartTag, titleEndTag);
                int ritualIndex = name.indexOf(" (Ritual)");
                if (ritualIndex != -1){
                    name = name.substring(0, ritualIndex);
                    isRitual = true;
                }
                //System.out.println(name);
            // Level
            } else if(line.indexOf(levelTag) == 0){
                String levelString = ExciseString(line, levelTag, strongEndTag);
                level = levelString.equals("Cantrip") ? 0 : Integer.parseInt(levelString);
                school = ExciseString((String)lines[i-2], pStart, pEnd);
            // Cast Time    
            } else if(line.indexOf(castTag) == 0){
                castTime = ExciseString(line, castTag, strongEndTag);
            // Range    
            } else if(line.indexOf(rangeTag) == 0){
                range = ExciseString(line, rangeTag, strongEndTag);
            // Components
            } else if(line.indexOf(componentsTag) == 0){
                components = new SpellComponents(ExciseString(line, componentsTag, strongEndTag));
            // Duration    
            } else if(line.indexOf(durationTag) == 0){
                duration = ExciseString(line, durationTag, strongEndTag);
                
                // Skip ahead a few lines and begin parsing the description
                for(int j = i+4; j < lines.length; j++){
                    String descLine = ((String)lines[j]).replace(badBreakTag, goodBreakTag).trim();
                    if(descLine.equals(pEnd)){
                        break;
                    } else {
                        desc = desc + descLine;
                    }
                }
            // Higher Level Description    
            } else if(line.indexOf(higherLevelLine) == 0){
                desc = desc + goodBreakTag + "At higher level: ";
                // Skip ahead a few lines and begin parsing the higher-level description
                for(int j = i+2; j < lines.length; j++){
                    String descLine = ((String)lines[j]).replace(badBreakTag, goodBreakTag).trim();
                    if(descLine.equals(pEnd)){
                        break;
                    } else {
                        desc = desc + descLine;
                    }
                }
            // Classes    
            } else if(line.indexOf(classStartTag) == 0){
                String curClass = ExciseString(line, classStartTag, classStopTag);
                classList.add(curClass);
            }
        }
        classes = classList.toString();
        classes = classes.substring(1, classes.length()-2);// Remove brackets from outside
        
        return new Spell(name, level, school, isRitual, castTime, range, components, duration, ability, desc, classes);
    }
    
    public ArrayList<Spell> ParseHouseSpellFile(Object[] lines) {
        String schoolTag = "School: ";
        String castTag = "Casting Time: ";
        String rangeTag = "Range: ";
        String compTag = "Components: ";
        String durTag = "Duration: ";
        String detailsTag = "Details: ";
        String classesTag = "Classes: ";
        
        int level = -1;
        String name = "";
        String school = "";
        boolean isRitual = false;
        String castTime = "";
        String range = "";
        SpellComponents components = null;
        String duration = "";
        String ability = "Spell";
        String desc = "";
        String classes = "";
        ArrayList<String> classList = new ArrayList<String>();
        
        ArrayList<Spell> retVal = new ArrayList<Spell>();
        
        for(int i = 0; i < lines.length; i++){
            try{
                String line = (String)lines[i];
                name = ExciseString(line, "] ", " [");
                //System.out.println("Name: " + name);
                level = Integer.parseInt(ExciseString(line, "[", "]"));
                //System.out.println("Level: " + level);
                school = ((String)lines[i+1]).substring(schoolTag.length());
                //System.out.println("School: " + school);
                castTime = ((String)lines[i+2]).substring(castTag.length());
                if(castTime.indexOf(" Ritual") != -1){
                    castTime = castTime.substring(0, castTime.length() - " Ritual".length());
                }
                else if(castTime.indexOf(" (R)") != -1){
                    castTime = castTime.substring(0, castTime.length() - " (R)".length());
                }
                //System.out.println("Cast Time: " + castTime);
                //System.out.println("Is Ritual: " + isRitual);
                
                range = ((String)lines[i+3]).substring(rangeTag.length());
                //System.out.println("Range: " + range);
                components = new SpellComponents(((String)lines[i+4]).substring(compTag.length()));
                duration = ((String)lines[i+5]).substring(durTag.length());
                //System.out.println("Duration: " + duration);
                desc = ((String)lines[i+6]).substring(detailsTag.length());
                for(int j = i+7; j < lines.length; j++){
                    String descLine = ((String)lines[j]);
                    int classesIndex = descLine.indexOf(classesTag);
                    if(classesIndex != -1){
                        classes = descLine.substring(schoolTag.length());
                        i=j;
                        break;
                    }
                    desc = desc + "\n" + descLine;
                }
                
                retVal.add(new Spell(name, level, school, isRitual, castTime, range, components, duration, ability, desc, classes));
            } catch (Exception e){
                System.out.println("WARNING! Skipping " + name + " Line " + i + ": " + (String)lines[i]);
            }
        }
        
        return retVal;
    }
    
    public Parser() {
        String rawFolder = "D:/Dropbox/Public/D&D/Tools/API Scripts/Spellbook/SpellParser/SpellParser/src/SpellHTML";
        String[] rawFiles = (new File(rawFolder)).list();
        Gson gson = new Gson();
        ArrayList<Spell> spells = new ArrayList<Spell>();
        
        // Create Raw spells
        try {
            PrintWriter pw = new PrintWriter("D:\\Dropbox\\Public\\D&D\\Tools\\API Scripts\\Spellbook\\SpellMaster\\SpellParser\\SpellParser\\out\\rawSpells.json");
            pw.println("[");
            for(String file : rawFiles) {
                //System.out.println("Parsing " + file);
                Path path = Paths.get(rawFolder, file);
                Charset charset = Charset.forName("ISO-8859-1");
                
                Object[] lines = null;
                try {
                    lines = Files.readAllLines(path, charset).toArray();
                } catch (IOException e) {
                }
                
                Spell spell = ParseRawSpellFile(lines);
                String json = gson.toJson(spell);
                pw.print(json);
                if(!rawFiles[rawFiles.length-1].equals(file)) {
                    pw.println(",");
                } else {
                    pw.println();
                }
                pw.flush();
                spells.add(spell);
            }
            pw.println("]");
            pw.flush();
        } catch (FileNotFoundException e) {
        }
        
        String homebrewFolder = "D:/Dropbox/Public/D&D/Tools/API Scripts/SpellMaster/Spellbook/SpellParser/SpellParser/src/SpellHomebrew";
        String[] homebrewFiles = (new File(homebrewFolder)).list();
        
        // Create Homebrew spells
        try {
            PrintWriter homebrewPW = new PrintWriter("D:\\Dropbox\\Public\\D&D\\Tools\\API Scripts\\SpellMaster\\Spellbook\\SpellParser\\SpellParser\\out\\homebrewSpells.json");
            homebrewPW.println("[");
            
            for(String file : homebrewFiles) {
                Path path = Paths.get(homebrewFolder, file);
                Charset charset = Charset.forName("ISO-8859-1");
                
                Object[] lines = null;
                try {
                    lines = Files.readAllLines(path, charset).toArray();
                } catch (IOException e) {
                }
                
                ArrayList<Spell> houseSpells = ParseHouseSpellFile(lines);
                for(Spell houseSpell : houseSpells){
                    //houseSpell.Dump();
                    String json = gson.toJson(houseSpell);
                    homebrewPW.print(json);
                    if(!houseSpells.get(houseSpells.size()-1).equals(houseSpell)) {
                        homebrewPW.println(",");
                    } else {
                        homebrewPW.println();
                    }
                    homebrewPW.flush();
                    
                    // Overwrite old spells
                    boolean overwroteOldSpell = false;
                    for(Spell defunctSpell: spells){
                        if(defunctSpell.Name.equals(houseSpell.Name)){                            
                            defunctSpell.Level = houseSpell.Level;
                            defunctSpell.School = houseSpell.School;
                            defunctSpell.IsRitual = houseSpell.IsRitual;
                            defunctSpell.CastTime = houseSpell.CastTime;
                            defunctSpell.Range = houseSpell.Range;
                            defunctSpell.Components = houseSpell.Components;
                            defunctSpell.Duration = houseSpell.Duration;
                            defunctSpell.Desc = houseSpell.Desc;
                            defunctSpell.Classes = houseSpell.Classes;
                            
                            overwroteOldSpell = true;
                            break;
                        }
                    }
                    if(!overwroteOldSpell){
                        spells.add(houseSpell);
                    }
                }
            }
            homebrewPW.println("]");
            homebrewPW.flush();
        } catch (FileNotFoundException e) {
        }
        
        // Merged JSON
        try {
            PrintWriter mergedPW = new PrintWriter("D:\\Dropbox\\Public\\D&D\\Tools\\API Scripts\\SpellMaster\\Spellbook\\SpellParser\\SpellParser\\out\\mergedSpells.json");
            mergedPW.println("[");
            for(Spell spell : spells){
                String json = gson.toJson(spell);
                mergedPW.print(json);
                if(!spells.get(spells.size()-1).equals(spell)) {
                    mergedPW.println(",");
                } else {
                    mergedPW.println();
                }
                mergedPW.flush();
            }
            mergedPW.println("]");
            mergedPW.flush();
        } catch(Exception e){
            
        }
        
        // Spellbook JS
        try {
            System.out.println("Spells Count: " + spells.size());
            PrintWriter jsPW = new PrintWriter("D:\\Dropbox\\Public\\D&D\\Tools\\API Scripts\\SpellMaster\\Spellbook\\SpellParser\\SpellParser\\out\\SpellbookConst.js");
            jsPW.println("if (typeof MarkStart != 'undefined') MarkStart('SpellList');");
            jsPW.println("const SpellList = [");
            for(int i = 0; i < spells.size(); i++) {
                Spell spell = spells.get(i);
                String js = spell.PrintJS();
                System.out.println("JS: " + js);
                jsPW.print(js);
                
                // Add commas if not done
                if(!spells.get(spells.size()-1).equals(spell)) {
                    jsPW.println(",");
                } else {
                    jsPW.println();
                }
                jsPW.flush();
            }
            jsPW.println("];");
            jsPW.println("if (typeof MarkStop != 'undefined') MarkStop('SpellList');");
            jsPW.flush();
        } catch(Exception e){
            System.err.println(e);
        }
    }

    public static void main(String[] args) {
        Parser parser = new Parser();
    }
}