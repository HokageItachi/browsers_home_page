# Task Scheduler Setup

## General
- Task name: `Run Home page` (rename if desired).
- Select **Run only when user is logged on** so the terminal can appear on the desktop.

## Trigger
- **On workstation unlock**.
- Select the intended Windows user.
- Keep the trigger enabled.
- Do not add **On workstation lock** for this design.

## Action
Action: **Start a program**

**Program/script**
```text
powershell.exe
```

**Add arguments**
```text
-NoProfile -ExecutionPolicy Bypass -File "D:\____Drive_Files\AI_projects\browser_home_page\launch.ps1"
```

**Start in**
```text
D:\____Drive_Files\AI_projects\browser_home_page
```

## Settings
- **If the task is already running:** `Do not start a new instance` is reasonable, but it is not the main duplicate guard. Task Scheduler may consider the launcher finished after it spawns CMD.
- No lock-trigger cleanup task is required.

## Checklist
- [ ] `start.bat` works when run manually.
- [ ] `launch.ps1` contains the correct project path and port.
- [ ] The action launches `launch.ps1`, not `start.bat` directly.
- [ ] The trigger is **On workstation unlock**.
- [ ] **Start in** points to the project directory.
- [ ] If port 48173 is listening, running the launcher opens no terminal.
- [ ] If the port is not listening, running the launcher opens CMD and runs `start.bat`.
