# Browser Home Page unlock launcher
# If TCP port 48173 accepts connections on localhost, do nothing.
# Otherwise, open CMD and run start.bat in the project directory.

$port = 48173
$bat = "D:\____Drive_Files\AI_projects\browser_home_page\start.bat"
$folder = Split-Path $bat

# Exit silently if the server is already accepting connections.
$connection = Test-NetConnection 127.0.0.1 `
    -Port $port `
    -InformationLevel Quiet `
    -WarningAction SilentlyContinue

if ($connection) {
    exit 0
}

# Start the BAT file in a visible terminal only when needed.
Start-Process "cmd.exe" `
    -ArgumentList "/k `"$bat`"" `
    -WorkingDirectory $folder
