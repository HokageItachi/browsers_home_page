# Troubleshooting

## Check port 48173

```powershell
Test-NetConnection 127.0.0.1 -Port 48173 -InformationLevel Quiet
```

`True` means a TCP connection succeeded. It does not guarantee the intended application is healthy.

## Find the process listening on the port

```powershell
Get-NetTCPConnection -LocalPort 48173 -State Listen -ErrorAction SilentlyContinue |
    Select-Object LocalAddress, LocalPort, OwningProcess
```

Then inspect the process:

```powershell
Get-Process -Id <PID>
```

Replace `<PID>` with the numeric `OwningProcess` value.

## Duplicate terminal tabs

1. Open Task Scheduler → task → **Actions**.
2. Ensure the action runs `powershell.exe` with `launch.ps1`.
3. Ensure no other task or startup entry runs `start.bat`.
4. Confirm the port in `launch.ps1` matches the app's actual port.
5. If the server takes time to start, the simple port check may allow a second launch before the first instance starts listening. A stronger design would use a persistent lock or an application-specific health check.

## Terminal says the port is already in use

The listener may be an old app instance or another application. Identify the PID using the commands above. Do not kill all `cmd.exe` processes.

## Launcher does not open a terminal

If the port check returns `True`, the launcher intentionally exits. If the app is actually unavailable, identify which process owns the port and verify the app's configured port.
