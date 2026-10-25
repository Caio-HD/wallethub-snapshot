# Script PowerShell para limpar diretórios problemáticos no Windows
param(
    [switch]$Force,
    [switch]$KillProcesses
)

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$nodeModulesPath = Join-Path $projectRoot "node_modules"

Write-Host "Limpando ambiente Windows..." -ForegroundColor Cyan
Write-Host ""

function Unlock-File {
    param(
        [string]$FilePath
    )
    
    if (-not (Test-Path $FilePath)) {
        return $true
    }
    
    try {
        # Tenta remover atributos de somente leitura
        $file = Get-Item -Path $FilePath -Force -ErrorAction SilentlyContinue
        if ($file) {
            $file.Attributes = 'Normal'
        }
        
        # Tenta usar handle.exe se disponível (Sysinternals)
        $handlePath = Join-Path $env:ProgramFiles "Sysinternals\handle.exe"
        if (Test-Path $handlePath) {
            $processIds = & $handlePath -a -p $FilePath 2>&1 | Select-String -Pattern "pid:\s*(\d+)" | ForEach-Object {
                if ($_.Matches.Success) {
                    $_.Matches.Groups[1].Value
                }
            }
            
            foreach ($processId in $processIds) {
                try {
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                } catch {
                    # Ignora se não conseguir encerrar
                }
            }
        }
        
        return $true
    }
    catch {
        return $false
    }
}

function Remove-DirectoryWithRetry {
    param(
        [string]$Path,
        [int]$MaxRetries = 3
    )
    
    if (-not (Test-Path $Path)) {
        return $true
    }
    
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            if ($i -gt 1) {
                Write-Host "   Tentativa $i/$MaxRetries para remover: $Path" -ForegroundColor Yellow
                Start-Sleep -Seconds (2 * $i)
            }
            
            # Tenta desbloquear arquivos binários problemáticos primeiro
            if ($i -gt 1) {
                $binFiles = @(
                    (Join-Path $Path "bin\esbuild"),
                    (Join-Path $Path "bin\esbuild.exe"),
                    (Join-Path $Path "bin\rollup"),
                    (Join-Path $Path "bin\rollup.exe")
                )
                
                foreach ($binFile in $binFiles) {
                    if (Test-Path $binFile) {
                        Unlock-File -FilePath $binFile | Out-Null
                    }
                }
            }
            
            # Tenta remover atributos de somente leitura recursivamente
            try {
                Get-ChildItem -Path $Path -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
                    try {
                        $_.Attributes = 'Normal'
                    } catch {
                        # Ignora erros ao alterar atributos de arquivos específicos
                    }
                }
            } catch {
                # Continua mesmo se não conseguir alterar atributos
            }
            
            # Tenta remover usando Remove-Item primeiro
            try {
                Remove-Item -Path $Path -Recurse -Force -ErrorAction Stop
                Write-Host "   Removido: $Path" -ForegroundColor Green
                return $true
            }
            catch {
                # Se falhar, tenta usar robocopy para limpar (técnica do Windows)
                if ($i -eq $MaxRetries) {
                    $tempDir = Join-Path $env:TEMP "rmdir_$(New-Guid)"
                    try {
                        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
                        $null = robocopy $tempDir $Path /MIR /R:0 /W:0 /NFL /NDL /NJH /NJS 2>&1
                        Remove-Item -Path $tempDir -Force -ErrorAction SilentlyContinue
                        Remove-Item -Path $Path -Recurse -Force -ErrorAction SilentlyContinue
                        
                        if (-not (Test-Path $Path)) {
                            Write-Host "   Removido (usando robocopy): $Path" -ForegroundColor Green
                            return $true
                        }
                    }
                    catch {
                        # Se robocopy também falhar, retorna false
                    }
                }
                
                $errorMsg = $_.Exception.Message
                if ($i -eq $MaxRetries) {
                    Write-Host "   Falha ao remover: $Path" -ForegroundColor Red
                    Write-Host "      Erro: $errorMsg" -ForegroundColor Red
                    Write-Host "      Sugestao: Tente executar como Administrador ou feche programas que possam estar usando os arquivos" -ForegroundColor Yellow
                    return $false
                }
            }
        }
        catch {
            $errorMsg = $_.Exception.Message
            if ($i -eq $MaxRetries) {
                Write-Host "   Falha ao remover: $Path" -ForegroundColor Red
                Write-Host "      Erro: $errorMsg" -ForegroundColor Red
                return $false
            }
        }
    }
    return $false
}

if ($KillProcesses -or $Force) {
    Write-Host "Encerrando processos npm/node..." -ForegroundColor Yellow
    
    # Obtém PID do processo atual e dos processos pais para proteger a cadeia de execução
    $currentPid = $PID
    $parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId = $currentPid" -ErrorAction SilentlyContinue).ParentProcessId
    $protectedPids = @($currentPid, $parentPid) | Where-Object { $_ -ne $null }
    
    # Whitelist de padrões que NÃO devem ser mortos (processos do workflow)
    $whitelistPatterns = @(
        "npm exec",
        "npm.cmd exec",
        "wallethub workflow",
        "wallethub setup",
        "wallethub menu"
    )
    
    # Whitelist de caminhos que indicam processos do workflow
    $whitelistPaths = @(
        "WalletHub",
        "wallethub"
    )
    
    $processes = Get-Process -Name "node","npm" -ErrorAction SilentlyContinue
    if ($processes) {
        $killedCount = 0
        $skippedCount = 0
        
        foreach ($proc in $processes) {
            try {
                # Pula processos protegidos (processo atual e pai)
                if ($protectedPids -contains $proc.Id) {
                    Write-Host "   Pulando (processo protegido): $($proc.Name) (PID: $($proc.Id))" -ForegroundColor Cyan
                    $skippedCount++
                    continue
                }
                
                # Verifica se o processo está na whitelist (verifica linha de comando e caminho)
                $shouldSkip = $false
                try {
                    $procInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue
                    $cmdLine = $procInfo.CommandLine
                    $procPath = $procInfo.ExecutablePath
                    
                    if ($cmdLine) {
                        # Verifica padrões na linha de comando
                        foreach ($pattern in $whitelistPatterns) {
                            if ($cmdLine -match [regex]::Escape($pattern)) {
                                $shouldSkip = $true
                                Write-Host "   Pulando (whitelist): $($proc.Name) (PID: $($proc.Id))" -ForegroundColor Cyan
                                Write-Host "      Comando: $($cmdLine.Substring(0, [Math]::Min(100, $cmdLine.Length)))..." -ForegroundColor Gray
                                $skippedCount++
                                break
                            }
                        }
                    }
                    
                    # Se ainda não está na whitelist, verifica o caminho do executável
                    if (-not $shouldSkip -and $procPath) {
                        foreach ($pathPattern in $whitelistPaths) {
                            if ($procPath -match [regex]::Escape($pathPattern)) {
                                $shouldSkip = $true
                                Write-Host "   Pulando (whitelist path): $($proc.Name) (PID: $($proc.Id))" -ForegroundColor Cyan
                                Write-Host "      Caminho: $procPath" -ForegroundColor Gray
                                $skippedCount++
                                break
                            }
                        }
                    }
                    
                    # Verifica se é processo pai de algum processo protegido
                    if (-not $shouldSkip) {
                        $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $($proc.Id)" -ErrorAction SilentlyContinue
                        foreach ($child in $children) {
                            if ($protectedPids -contains $child.ProcessId) {
                                $shouldSkip = $true
                                Write-Host "   Pulando (processo pai protegido): $($proc.Name) (PID: $($proc.Id))" -ForegroundColor Cyan
                                $skippedCount++
                                break
                            }
                        }
                    }
                } catch {
                    # Se não conseguir obter informações, por segurança, pula o processo
                    Write-Host "   Pulando (erro ao obter info): $($proc.Name) (PID: $($proc.Id))" -ForegroundColor Yellow
                    $shouldSkip = $true
                    $skippedCount++
                }
                
                if (-not $shouldSkip) {
                    Write-Host "   Encerrando: $($proc.Name) (PID: $($proc.Id))" -ForegroundColor Yellow
                    Stop-Process -Id $proc.Id -Force -ErrorAction Stop
                    $killedCount++
                }
            }
            catch {
                Write-Host "   Nao foi possivel encerrar: $($proc.Name) (PID: $($proc.Id))" -ForegroundColor Yellow
            }
        }
        
        if ($killedCount -gt 0) {
            Write-Host "   Aguardando liberacao de recursos..." -ForegroundColor Yellow
            Start-Sleep -Seconds 5
            Write-Host "   Processos encerrados: $killedCount, Pulados (whitelist/protegidos): $skippedCount" -ForegroundColor Green
        } elseif ($skippedCount -gt 0) {
            Write-Host "   Nenhum processo encerrado (todos estavam na whitelist ou protegidos)" -ForegroundColor Green
        } else {
            Write-Host "   Nenhum processo encontrado para encerrar" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "   Nenhum processo npm/node encontrado" -ForegroundColor Gray
    }
    Write-Host ""
}

if (Test-Path $nodeModulesPath) {
    Write-Host "Limpando diretorios temporarios em node_modules..." -ForegroundColor Cyan
    
    try {
        $entries = Get-ChildItem -Path $nodeModulesPath -Directory -ErrorAction SilentlyContinue
        $tempDirs = $entries | Where-Object { 
            $_.Name -match '^\.(web|api|cli)-' -or $_.Name -eq 'web' 
        }
        
        if ($tempDirs) {
            foreach ($dir in $tempDirs) {
                $dirPath = $dir.FullName
                Write-Host "   Removendo: $($dir.Name)" -ForegroundColor Yellow
                Remove-DirectoryWithRetry -Path $dirPath | Out-Null
            }
        }
        else {
            Write-Host "   Nenhum diretorio temporario encontrado" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "   Erro ao acessar node_modules: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    Write-Host ""
    
    # Remover pacotes de plataformas não-Windows que podem causar problemas
    Write-Host "Removendo pacotes de plataformas nao-Windows..." -ForegroundColor Cyan
    try {
        $platformPatterns = @(
            "*linux-x64*",
            "*linux-arm64*",
            "*darwin-x64*",
            "*darwin-arm64*",
            "*freebsd*",
            "*openbsd*",
            "*sunos*",
            "*win32-ia32*"
        )
        
        $found = $false
        foreach ($pattern in $platformPatterns) {
            $platformDirs = Get-ChildItem -Path $nodeModulesPath -Directory -Filter $pattern -ErrorAction SilentlyContinue -Recurse -Depth 2
            if ($platformDirs) {
                foreach ($dir in $platformDirs) {
                    $found = $true
                    $dirPath = $dir.FullName
                    Write-Host "   Removendo: $($dir.Name)" -ForegroundColor Yellow
                    Remove-DirectoryWithRetry -Path $dirPath | Out-Null
                }
            }
        }
        
        if (-not $found) {
            Write-Host "   Nenhum pacote de plataforma nao-Windows encontrado" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "   Erro ao remover pacotes de plataforma: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "Limpando diretorios dist..." -ForegroundColor Cyan
$distPaths = @(
    (Join-Path $projectRoot "services\api\dist"),
    (Join-Path $projectRoot "services\web\dist"),
    (Join-Path $projectRoot "tools\cli\dist")
)

foreach ($distPath in $distPaths) {
    if (Test-Path $distPath) {
        Write-Host "   Removendo: $distPath" -ForegroundColor Yellow
        Remove-DirectoryWithRetry -Path $distPath | Out-Null
    }
}
Write-Host ""

if ($Force) {
    Write-Host "Limpando cache do npm..." -ForegroundColor Cyan
    try {
        npm cache clean --force 2>&1 | Out-Null
        Write-Host "   Cache do npm limpo" -ForegroundColor Green
    }
    catch {
        Write-Host "   Nao foi possivel limpar cache do npm" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "Aguardando liberacao de recursos..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
Write-Host ""

# Tentar novamente remover ou renomear pacotes de plataforma que falharam anteriormente
if (Test-Path $nodeModulesPath) {
    Write-Host "Tentando remover ou renomear pacotes bloqueados..." -ForegroundColor Cyan
    try {
        $problematicPaths = @(
            (Join-Path $nodeModulesPath "@esbuild\linux-x64"),
            (Join-Path $nodeModulesPath "@rollup\rollup-linux-x64-gnu")
        )
        
        foreach ($problemPath in $problematicPaths) {
            if (Test-Path $problemPath) {
                $dirName = Split-Path -Leaf $problemPath
                Write-Host "   Tentando novamente: $dirName" -ForegroundColor Yellow
                
                # Tenta desbloquear arquivos binários específicos que causam problemas
                $binFiles = @(
                    (Join-Path $problemPath "bin\esbuild"),
                    (Join-Path $problemPath "bin\esbuild.exe")
                )
                
                foreach ($binFile in $binFiles) {
                    if (Test-Path $binFile) {
                        Write-Host "      Desbloqueando: $(Split-Path -Leaf $binFile)" -ForegroundColor Gray
                        Unlock-File -FilePath $binFile | Out-Null
                        Start-Sleep -Milliseconds 500
                    }
                }
                
                # Aguarda um pouco para garantir que os arquivos foram liberados
                Start-Sleep -Seconds 1
                
                # Tenta remover primeiro
                $removed = Remove-DirectoryWithRetry -Path $problemPath -MaxRetries 3
                
                # Se não conseguir remover, tenta renomear para que o npm possa continuar
                if (-not $removed) {
                    $parentPath = Split-Path -Parent $problemPath
                    $newName = ".$dirName-TO-DELETE-$(Get-Date -Format 'yyyyMMddHHmmss')"
                    $newPath = Join-Path $parentPath $newName
                    
                    try {
                        # Tenta renomear arquivos individuais primeiro se necessário
                        $binDir = Join-Path $problemPath "bin"
                        if (Test-Path $binDir) {
                            Get-ChildItem -Path $binDir -File -ErrorAction SilentlyContinue | ForEach-Object {
                                try {
                                    $newBinName = ".$($_.Name)-LOCKED"
                                    Rename-Item -Path $_.FullName -NewName $newBinName -ErrorAction SilentlyContinue
                                } catch {
                                    # Ignora se não conseguir renomear arquivo individual
                                }
                            }
                        }
                        
                        Rename-Item -Path $problemPath -NewName $newName -ErrorAction Stop
                        Write-Host "   Renomeado para: $newName (sera removido na proxima execucao)" -ForegroundColor Yellow
                        
                        # Tenta remover o diretório renomeado
                        Start-Sleep -Seconds 1
                        Remove-DirectoryWithRetry -Path $newPath -MaxRetries 2 | Out-Null
                    }
                    catch {
                        Write-Host "   Nao foi possivel renomear: $dirName" -ForegroundColor Red
                        Write-Host "      Erro: $($_.Exception.Message)" -ForegroundColor Red
                        Write-Host "      O npm pode falhar. Tente executar como Administrador." -ForegroundColor Yellow
                    }
                }
            }
        }
    }
    catch {
        Write-Host "   Erro ao processar pacotes bloqueados: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "Limpeza concluida!" -ForegroundColor Green
Write-Host ""
