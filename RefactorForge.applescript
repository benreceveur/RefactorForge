#!/usr/bin/osascript

(*
RefactorForge macOS Application
This AppleScript creates a native macOS app that launches RefactorForge
*)

on run
    -- Set the working directory
    set refactorForgeDir to "/Users/benreceveur/GitHub/RefactorForge"
    set startScript to refactorForgeDir & "/start-refactorforge.sh"
    
    -- Check if RefactorForge is already running
    set isRunning to do shell script "lsof -i :8745 > /dev/null 2>&1 && echo 'true' || echo 'false'"
    
    if isRunning is "true" then
        -- If already running, just open the browser
        display notification "RefactorForge is already running" with title "RefactorForge"
        delay 1
        do shell script "open http://localhost:8745"
    else
        -- Start RefactorForge
        display notification "Starting RefactorForge services..." with title "RefactorForge"
        
        -- Launch the startup script (using bash with PATH set)
        do shell script "cd " & quoted form of refactorForgeDir & " && bash " & quoted form of startScript & " > /tmp/refactorforge-launch.log 2>&1 &"
        
        -- Wait for services to start up and show progress
        display notification "Waiting for services to initialize..." with title "RefactorForge"
        
        -- Wait and check for service startup (up to 30 seconds)
        set serviceStarted to false
        repeat with i from 1 to 30
            delay 1
            try
                set serviceCheck to do shell script "lsof -i :8745 > /dev/null 2>&1 && echo 'running' || echo 'waiting'"
                if serviceCheck is "running" then
                    set serviceStarted to true
                    exit repeat
                end if
            end try
        end repeat
        
        if serviceStarted then
            -- Open in browser
            do shell script "open http://localhost:8745"
            display notification "RefactorForge is now running!" with title "RefactorForge" subtitle "Access at http://localhost:8745"
        else
            display notification "RefactorForge startup may be slow - check logs if needed" with title "RefactorForge" 
            do shell script "open http://localhost:8745"
        end if
    end if
end run

on quit
    -- Stop RefactorForge when quitting the app
    set stopScript to "/Users/benreceveur/GitHub/RefactorForge/stop-refactorforge.sh"
    
    display dialog "Do you want to stop RefactorForge services?" buttons {"Cancel", "Stop Services"} default button 2
    
    if button returned of result is "Stop Services" then
        do shell script stopScript
        display notification "RefactorForge services stopped" with title "RefactorForge"
    end if
    
    continue quit
end quit