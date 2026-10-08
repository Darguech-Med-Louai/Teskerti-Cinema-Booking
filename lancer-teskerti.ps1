param(
    [switch]$Stop
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$runtimeRoot = Join-Path $env:LOCALAPPDATA 'TeskertiRuntime'
$logsDirectory = Join-Path $runtimeRoot 'logs'
$stateFile = Join-Path $runtimeRoot 'started-processes.json'
$phpPath = Join-Path $runtimeRoot 'php-8.4.26\php.exe'
$phpExtensions = Join-Path $runtimeRoot 'php-8.4.26\ext'
$mysqlRoot = 'C:\xampp\mysql'
$mysqlServer = Join-Path $mysqlRoot 'bin\mysqld.exe'
$mysqlClient = Join-Path $mysqlRoot 'bin\mysql.exe'
$mysqlAdmin = Join-Path $mysqlRoot 'bin\mysqladmin.exe'
$databasePort = 3307

function Write-Status([string]$Message) {
    Write-Host "[Teskerti] $Message" -ForegroundColor Cyan
}

function Quote-Argument([string]$Value) {
    '"' + $Value.Replace('"', '\"') + '"'
}

function Test-TcpPort([string]$HostName, [int]$Port) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $connect = $client.ConnectAsync($HostName, $Port)
        return $connect.Wait(1000) -and $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

function Test-Database {
    $result = & $mysqlClient '--protocol=TCP' '--host=127.0.0.1' "--port=$databasePort" '--user=root' '--batch' '--skip-column-names' '--execute=SELECT COUNT(*) FROM teskerti_db.movies; SELECT COUNT(*) FROM teskerti_db.cinemas; SELECT COUNT(*) FROM teskerti_db.sessions;' 2>$null
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        return $false
    }

    $counts = @($result | ForEach-Object { "$_".Trim() } | Where-Object { $_ -match '^\d+$' })
    return $counts.Count -eq 3 -and [int]$counts[0] -gt 0 -and [int]$counts[1] -gt 0 -and [int]$counts[2] -gt 0
}

function Get-ManagedProcesses {
    if (-not (Test-Path -LiteralPath $stateFile)) {
        return @()
    }

    $saved = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    return @($saved | Where-Object {
        $process = Get-Process -Id ([int]$_.ProcessId) -ErrorAction SilentlyContinue
        $null -ne $process -and $process.Path -and
            $process.Path.Equals([string]$_.Path, [System.StringComparison]::OrdinalIgnoreCase)
    })
}

function Save-ManagedProcesses($Processes) {
    @($Processes) | ConvertTo-Json -Depth 3 |
        Set-Content -LiteralPath $stateFile -Encoding UTF8
}

function Start-LoggedProcess(
    [string]$Name,
    [string]$Executable,
    [string[]]$Arguments,
    [string]$WorkingDirectory
) {
    $stdout = Join-Path $logsDirectory "$Name.log"
    $stderr = Join-Path $logsDirectory "$Name-error.log"
    $argumentLine = ($Arguments | ForEach-Object { Quote-Argument $_ }) -join ' '

    return Start-Process -FilePath $Executable -ArgumentList $argumentLine `
        -WorkingDirectory $WorkingDirectory -WindowStyle Hidden `
        -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
}

function Wait-ForService([scriptblock]$Check, [System.Diagnostics.Process]$Process, [string]$Name) {
    for ($attempt = 0; $attempt -lt 45; $attempt++) {
        if (& $Check) {
            return
        }
        $Process.Refresh()
        if ($Process.HasExited) {
            $errorLog = Join-Path $logsDirectory "$Name-error.log"
            $details = if (Test-Path -LiteralPath $errorLog) {
                (Get-Content -LiteralPath $errorLog -Tail 12) -join "`n"
            } else {
                'Aucun detail supplementaire dans le journal.'
            }
            throw "$Name s'est arrete au demarrage.`n$details"
        }
        Start-Sleep -Seconds 1
    }
    throw "$Name n'a pas repondu dans le delai prevu."
}

function Stop-Teskerti {
    $managed = @(Get-ManagedProcesses)
    if ($managed.Count -eq 0) {
        Write-Status 'Aucun processus lance par ce script n''est a arreter.'
        Remove-Item -LiteralPath $stateFile -Force -ErrorAction SilentlyContinue
        return
    }

    foreach ($role in @('api', 'frontend', 'database')) {
        foreach ($entry in @($managed | Where-Object { $_.Role -eq $role })) {
            $process = Get-Process -Id ([int]$entry.ProcessId) -ErrorAction SilentlyContinue
            if ($null -eq $process -or -not $process.Path -or
                -not $process.Path.Equals([string]$entry.Path, [System.StringComparison]::OrdinalIgnoreCase)) {
                continue
            }

            if ($role -eq 'database') {
                $shutdown = & $mysqlAdmin '--protocol=TCP' '--host=127.0.0.1' "--port=$databasePort" '--user=root' 'shutdown' 2>&1
                if ($LASTEXITCODE -ne 0) {
                    throw "MariaDB n'a pas pu s'arreter proprement : $($shutdown -join ' ')"
                }
                $process.WaitForExit(15000) | Out-Null
            } else {
                Stop-Process -Id $process.Id
                $process.WaitForExit(10000) | Out-Null
            }
            Write-Status "$($entry.Role) arrete."
        }
    }

    Remove-Item -LiteralPath $stateFile -Force -ErrorAction SilentlyContinue
}

try {
    if ($Stop) {
        Stop-Teskerti
        exit 0
    }

    $requiredPaths = @($phpPath, $mysqlServer, $mysqlClient, $mysqlAdmin)
    foreach ($path in $requiredPaths) {
        if (-not (Test-Path -LiteralPath $path)) {
            throw "Fichier requis introuvable : $path. Relancez la configuration PHP/MariaDB avant d'utiliser ce lanceur."
        }
    }

    New-Item -ItemType Directory -Path $logsDirectory -Force | Out-Null
    $databaseDirectory = Get-ChildItem -LiteralPath $runtimeRoot -Directory -Filter 'mariadb-data-*' |
        Where-Object { (Test-Path -LiteralPath (Join-Path $_.FullName 'my.ini')) -and
            (Test-Path -LiteralPath (Join-Path $_.FullName 'mysql')) } |
        Sort-Object CreationTime -Descending |
        Select-Object -First 1 -ExpandProperty FullName
    if (-not $databaseDirectory) {
        throw "Base MariaDB de Teskerti introuvable dans $runtimeRoot."
    }

    $managed = @(Get-ManagedProcesses)
    $databaseRunning = $false
    if (Test-TcpPort '127.0.0.1' $databasePort) {
        $databaseRunning = Test-Database
        if (-not $databaseRunning) {
            throw "Le port $databasePort est occupe par une autre base ou les donnees Teskerti ne sont pas accessibles. Aucun processus existant n'a ete modifie."
        }
    }
    if (-not $databaseRunning) {
        Write-Status 'Demarrage de MariaDB...'
        $databaseProcess = Start-LoggedProcess -Name 'mariadb' -Executable $mysqlServer `
            -Arguments @("--defaults-file=$(Join-Path $databaseDirectory 'my.ini')",
                "--basedir=$mysqlRoot", "--plugin-dir=$(Join-Path $mysqlRoot 'lib\plugin')",
                "--tmpdir=$runtimeRoot", '--bind-address=127.0.0.1',
                "--log-error=$(Join-Path $logsDirectory 'mariadb-error.log')") `
            -WorkingDirectory $databaseDirectory
        try {
            Wait-ForService -Check { Test-Database } -Process $databaseProcess -Name 'mariadb'
        }
        catch {
            if (-not $databaseProcess.HasExited) {
                Stop-Process -Id $databaseProcess.Id
            }
            throw
        }
        $managed += [pscustomobject]@{ Role = 'database'; ProcessId = $databaseProcess.Id; Path = $mysqlServer }
        Save-ManagedProcesses $managed
        Write-Status 'Base de donnees prete.'
    } else {
        Write-Status 'Base de donnees deja operationnelle.'
    }

    $healthUrl = 'http://localhost:8000/api/v1/health'
    $apiReady = $false
    try {
        $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 4
        $apiReady = $health.success -and $health.data.database -eq 'ok'
    }
    catch {
        if (Test-TcpPort '127.0.0.1' 8000) {
            throw "Le port 8000 est occupe par un service qui ne repond pas a l'API Teskerti."
        }
    }

    if (-not $apiReady) {
        Write-Status 'Demarrage de l''API...'
        $apiProcess = Start-LoggedProcess -Name 'api' -Executable $phpPath `
            -Arguments @('-d', "extension_dir=$phpExtensions", '-d', 'extension=pdo_mysql',
                '-d', 'extension=openssl', '-d', 'extension=mbstring',
                '-S', 'localhost:8000', '-t', (Join-Path $projectRoot 'teskerti-api\public'),
                (Join-Path $projectRoot 'teskerti-api\public\index.php')) `
            -WorkingDirectory (Join-Path $projectRoot 'teskerti-api')
        try {
            Wait-ForService -Check {
                try {
                    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 3
                    $health.success -and $health.data.database -eq 'ok'
                } catch {
                    $false
                }
            } -Process $apiProcess -Name 'api'
        }
        catch {
            if (-not $apiProcess.HasExited) {
                Stop-Process -Id $apiProcess.Id
            }
            throw
        }
        $managed += [pscustomobject]@{ Role = 'api'; ProcessId = $apiProcess.Id; Path = $phpPath }
        Save-ManagedProcesses $managed
        Write-Status 'API prete.'
    } else {
        Write-Status 'API deja operationnelle.'
    }

    $frontendUrl = 'http://localhost:3000/'
    $frontendReady = $false
    try {
        $response = Invoke-WebRequest -Uri $frontendUrl -UseBasicParsing -TimeoutSec 4
        $frontendReady = $response.StatusCode -eq 200
    }
    catch {
        if (Test-TcpPort '127.0.0.1' 3000) {
            throw "Le port 3000 est occupe ou le site ne repond pas correctement : $($_.Exception.Message)"
        }
    }

    if (-not $frontendReady) {
        Write-Status 'Demarrage du site...'
        $frontendProcess = Start-LoggedProcess -Name 'frontend' -Executable $phpPath `
            -Arguments @('-d', "extension_dir=$phpExtensions", '-S', 'localhost:3000',
                '-t', (Join-Path $projectRoot 'teskerti')) `
            -WorkingDirectory (Join-Path $projectRoot 'teskerti')
        try {
            Wait-ForService -Check {
                try {
                    (Invoke-WebRequest -Uri $frontendUrl -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200
                } catch {
                    $false
                }
            } -Process $frontendProcess -Name 'frontend'
        }
        catch {
            if (-not $frontendProcess.HasExited) {
                Stop-Process -Id $frontendProcess.Id
            }
            throw
        }
        $managed += [pscustomobject]@{ Role = 'frontend'; ProcessId = $frontendProcess.Id; Path = $phpPath }
        Save-ManagedProcesses $managed
        Write-Status 'Site pret.'
    } else {
        Write-Status 'Site deja operationnel.'
    }

    Write-Status 'Teskerti est pret : http://localhost:3000'
    Start-Process 'http://localhost:3000'
}
catch {
    Write-Host "[Teskerti] ERREUR : $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
