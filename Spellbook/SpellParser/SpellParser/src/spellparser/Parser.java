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
import java.io.OutputStreamWriter;
import java.io.PrintWriter;

import java.nio.charset.StandardCharsets;

import java.util.Arrays;
import java.util.Collections;

import javax.sound.sampled.Line;

public class Parser {
    public String FixLine(String line, String type, int lineNumber) {
        String oldLine = line;
        // Get rid of bad quotes -_-
        line = line.replaceAll("&rsquo;", "'");
        
        /*if (!oldLine.equals(line)) {
            System.out.println(" - Fixed " + type + " Line at " + lineNumber);
            System.out.println("   - Old Line: " + oldLine);
            System.out.println("   - New Line: " + line);
        }*/
        
        return line;
    }
    
    public String ExciseString(String src, String leftTag, String rightTag){
        try{
            String trimmedSrc = src.trim();
            int leftIndex = trimmedSrc.indexOf(leftTag);
            String noLeft = trimmedSrc.substring(leftIndex + leftTag.length()).trim();
            //System.out.println("  Noleft: " + noLeft);
            int rightIndex = noLeft.indexOf(rightTag);
            return noLeft.substring(0, rightIndex).trim();
        }
        catch(Exception e){
            System.out.println("SRC: " + src);
            System.out.println("  L: " + leftTag);
            System.out.println("  R: " + rightTag);
            throw e;
        }
    }
    
    public String GetOldName(String src){
        String leftTag = "[";
        String rightTag = "]";
        String fromTag = " from ";
        try{
            // System.out.println("Get Old Name - Start: " + src);
            String trimmedSrc = src.trim();
            int leftIndex = trimmedSrc.lastIndexOf(leftTag);
            int rightIndex = trimmedSrc.lastIndexOf(rightTag);
            String changeString = trimmedSrc.substring(leftIndex + 1, rightIndex).trim();
            
            int fromIndex = changeString.indexOf(fromTag);
            boolean isNew = changeString.startsWith("New");
            boolean isUpdate = changeString.startsWith("Update");
            boolean isRename = changeString.startsWith("Rename");
            String output = "";
            if (fromIndex > -1 && (isNew || isUpdate || isRename)) {
                output = changeString.substring(fromIndex + fromTag.length());
            }
            // System.out.println("Get Old Name - End: " + output);
            return output;
        }
        catch(Exception e){
            System.out.println("SRC: " + src);
            throw e;
        }
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
            line = FixLine(line.trim(), "Raw", i);
            
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
                    descLine = FixLine(descLine, "House Desc", j);
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
        classes = classes.replace("[", "");
        classes = classes.replace("]", "");
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
        String oldName = "";
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
        boolean foundCantripsYet = false;
        
        for(int i = 0; i < lines.length; i++){
            try{
                String line = (String)lines[i];
                if (line.indexOf("Cantrips") == 0) {
                    foundCantripsYet = true;
                    continue;
                }
                if (!foundCantripsYet || line.indexOf("Level ") == 0 || line.trim().length() == 0) {
                    continue;
                }            
                line = FixLine(line, "Homebrew", i);
                name = ExciseString(line, "] ", " [");
                oldName = GetOldName(line);
                //System.out.println("Name: " + name);
                String excisedLevelString = ExciseString(line, "[", "]");
                level = Integer.parseInt(excisedLevelString);
                //System.out.println("Level: " + level);
                school = ((String)lines[i+1]).substring(schoolTag.length());
                //System.out.println("School: " + school);
                castTime = ((String)lines[i+2]).substring(castTag.length());
                if(castTime.indexOf(" Ritual") != -1){
                    castTime = castTime.substring(0, castTime.length() - " Ritual".length());
                    isRitual = true;
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
                    } else if(level == 0 && (descLine.startsWith("5th: ") || descLine.startsWith("11th: ") || descLine.startsWith("17th: "))){
                        descLine = "- " + descLine;
                    }
                    desc = desc + "\n" + descLine;
                }
                
                Spell spell = new Spell(name, oldName, level, school, isRitual, castTime, range, components, duration, ability, desc, classes);
                isRitual = false;
                retVal.add(spell);
            } catch (Exception e){
                System.err.println("WARNING! Skipping " + name + " Line " + i + ": " + (String)lines[i]);
                System.err.println("  " + e.getMessage());
                e.printStackTrace();
            }
        }
        
        return retVal;
    }
    
    public Parser(boolean srdOnly) {
        Gson gson = new Gson();
        String[] srdSpellNames = new String[0];
        System.out.println("Reading SRD list");
        Charset charset = Charset.forName("UTF-8");
        try {
            Path path = new File("D:\\Documents\\Roll20 API\\Private Development\\SpellMaster\\Spellbook\\SpellParser\\SpellParser\\src\\SRD\\SRD.txt").toPath();
            Object[]objAr = Files.readAllLines(path, charset).toArray();
            srdSpellNames = Arrays.copyOf(objAr, objAr.length, String[].class);
            System.out.println("SRD Spell Names: " + srdSpellNames.length);
        }
        catch (Exception e) {
            System.err.println("SRD Exception: " + e.toString());
        }
        
        ArrayList<Spell> spells = new ArrayList<Spell>();
        
        // Create Raw spells
        System.out.println("Creating Raw Spells");
        try {
            String rawFolder = "D:\\Documents\\Roll20 API\\Private Development\\SpellMaster\\Spellbook\\SpellParser\\SpellParser\\src\\SpellHTML";
            String[] rawFiles = (new File(rawFolder)).list();
            System.out.println("Raw Spell Files Count: " + rawFiles.length);
            PrintWriter pw = new PrintWriter("D:\\Documents\\Roll20 API\\Private Development\\SpellMaster\\Spellbook\\SpellParser\\SpellParser\\out\\rawSpells.json");
            pw.println("[");
            for(String file : rawFiles) {
                //System.out.println("Parsing " + file);
                Path path = Paths.get(rawFolder, file);
                
                Object[] lines = null;
                try {
                    lines = Files.readAllLines(path, charset).toArray();
                } catch (IOException e) {
                    System.err.println("IO Error: " + e.toString());
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
        }
        catch (FileNotFoundException e) {
            System.err.println("Raw Exception: " + e.toString());
        }

        System.out.println("Spells Ready for Homebrew Count: " + spells.size());
        
        // Sort for legibility
        Collections.sort(spells);
        
        // Create Homebrew spells and override same-named raw spells
        System.out.println("Creating House Spells");
        if(!srdOnly) {   
            try {        
                String homebrewFolder = "D:\\Documents\\Roll20 API\\Private Development\\SpellMaster\\Spellbook\\SpellParser\\SpellParser\\src\\SpellHomebrew";
                String[] homebrewFiles = (new File(homebrewFolder)).list();
                PrintWriter homebrewPW = new PrintWriter("D:\\Documents\\Roll20 API\\Private Development\\SpellMaster\\Spellbook\\SpellParser\\SpellParser\\out\\homebrewSpells.json");
                homebrewPW.println("[");
                
                for(String file : homebrewFiles) {
                    Path path = Paths.get(homebrewFolder, file);
                    
                    Object[] lines = null;
                    try {
                        lines = Files.readAllLines(path, charset).toArray();
                    } catch (IOException e) {
                        System.err.println("IO Error: " + e.toString());
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
                            if(defunctSpell.Name.equals(houseSpell.Name)){//TODO FIX FRONT PARSE: || defunctSpell.Name.equals(houseSpell.OldName)){
                                defunctSpell.Name = houseSpell.Name;
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
            }
            catch (Exception e) {
                System.err.println("House Exception: " + e.toString());
            }
        }

        // Flag SRD spells as such
        System.out.println("Flagging SRD Spells");
        for(int i = 0; i < spells.size(); i++) {
            Spell spell = spells.get(i);
            for(int j = 0; j < srdSpellNames.length; j++) {
                String srdSpellName = srdSpellNames[j].trim();
                if(spell.Name.equals(srdSpellName)) {
                    spell.Classes = spell.Classes + ", SRD";
                    break;
                }
            }
        }

        System.out.println("Spells Ready for Merge Count: " + spells.size());
        
        // Sort for legibility
        System.out.println("Sorting Spells");
        Collections.sort(spells);
        
        // Merged JSON
        System.out.println("Printing Merged JSON");
        try {
            PrintWriter mergedPW = new PrintWriter("D:\\Documents\\Roll20 API\\Private Development\\SpellMaster\\Spellbook\\SpellParser\\SpellParser\\out\\mergedSpells.json");
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
        }
        catch(Exception e){
            
        }

        System.out.println("Spells Ready for JS Count: " + spells.size());
        
        // Spellbook JS
        System.out.println("Printing Spellbook JS");
        try {
            System.out.println("  - Printing to SRD Only? " + srdOnly);
            ArrayList<String> actualPrinted = new ArrayList<>();
            String outputDestination = srdOnly
                ? "D:\\Documents\\Roll20 API\\Private Development\\SpellMaster\\SRD.js"
                : "D:\\Documents\\Roll20 API\\Private Development\\SpellMaster\\Spellbook\\SpellParser\\SpellParser\\out\\SpellbookConst.js";
            PrintWriter jsPW = new PrintWriter(outputDestination, "UTF-8");
            jsPW.println("if (typeof MarkStart != 'undefined') {MarkStart('SpellList');}");
            jsPW.println("var SpellList = [");
            for(int i = 0; i < spells.size(); i++) {
                Spell spell = spells.get(i);
                if (srdOnly && spell.Classes.indexOf("SRD") == -1) {
                    continue;
                }
                String js = spell.PrintJS();
                //System.out.println("JS: " + js);
                jsPW.print(js);
                
                // Add commas if not done
                if(!spells.get(spells.size()-1).equals(spell)) {
                    jsPW.println(",");
                } else {
                    jsPW.println();
                }
                jsPW.flush();
                if (spell.OldName.equals("")) {
                    actualPrinted.add(spell.Name);
                } else {
                    actualPrinted.add(spell.OldName);
                }
            }
            jsPW.println("];");
            jsPW.println("if (typeof MarkStop != 'undefined') {MarkStop('SpellList');}");
            jsPW.flush();
            System.out.println("Printed " + actualPrinted.size() + " spells");
            
            for (int i = 0; i < srdSpellNames.length; i++) {
                String srdName = srdSpellNames[i].trim().toLowerCase();
                boolean found = false;
                for (int j = 0; j < actualPrinted.size(); j++) {
                    String printName = actualPrinted.get(j).trim().toLowerCase();
                    if (srdName.equals(printName)) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    System.out.println("WARNING: Unablet to locate " + srdName);
                }
            }
        }
        catch(Exception e){
            System.err.println("Exception: " + e.toString());
        }
    }

    public static void main(String[] args) {
        boolean srdOnly = true;
        new Parser(srdOnly);
    }
}
