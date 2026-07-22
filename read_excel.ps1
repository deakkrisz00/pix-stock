$src = "C:\Users\Krisztian\Desktop\pix stock\pix nevek.xlsx"
$zip = "C:\Users\Krisztian\Desktop\pix stock\pix_nevek_tmp.zip"
$tmp = "C:\Users\Krisztian\Desktop\pix stock\xlsx_tmp"
$out = "C:\Users\Krisztian\Desktop\pix stock\import_pens.sql"

if (Test-Path $zip) { Remove-Item $zip -Force }
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
Copy-Item $src $zip
Expand-Archive -Path $zip -DestinationPath $tmp -Force
Remove-Item $zip

[xml]$ss = Get-Content (Join-Path $tmp "xl\sharedStrings.xml") -Encoding UTF8
$shared = [System.Collections.Generic.List[string]]::new()
foreach ($si in $ss.sst.si) {
    $parts = @()
    if ($si.t) { $parts += $si.t }
    if ($si.r) { foreach ($r in $si.r) { if ($r.t) { $parts += $r.t } } }
    $shared.Add(($parts -join "").Trim())
}

$seen  = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$names = [System.Collections.Generic.List[string]]::new()

Get-ChildItem (Join-Path $tmp "xl\worksheets") -Filter "*.xml" | Sort-Object Name | ForEach-Object {
    [xml]$ws = Get-Content $_.FullName -Encoding UTF8
    foreach ($row in $ws.worksheet.sheetData.row) {
        foreach ($c in $row.c) {
            $val = ""
            if ($c.t -eq "s" -and $null -ne $c.v) {
                $idx = [int]$c.v
                if ($idx -lt $shared.Count) { $val = $shared[$idx] }
            } elseif ($null -ne $c.v) {
                $val = "$($c.v)".Trim()
            }
            if ($val -ne "" -and $val -notmatch "^\d+$" -and $val.Length -ge 2) {
                if ($seen.Add($val)) { $names.Add($val) }
            }
        }
    }
}

$sorted = $names | Sort-Object { $_.ToLower() }
Write-Host "Egyedi nevek: $($sorted.Count)"

$rows = $sorted | ForEach-Object {
    $esc = $_ -replace "'", "''"
    "  ('$esc')"
}

$sql = "INSERT INTO public.names (name) VALUES`n" + ($rows -join ",`n") + ";"
[System.IO.File]::WriteAllText($out, $sql, [System.Text.Encoding]::UTF8)
Write-Host "SQL mentve: $out"

Remove-Item $tmp -Recurse -Force
