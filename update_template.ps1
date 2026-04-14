$currentDir = Get-Location
$img_path = Join-Path $currentDir "images\email_hero.jpg"
$html_path = Join-Path $currentDir "email_template.html"

Write-Host "Image Path: $img_path"
Write-Host "HTML Path: $html_path"

if (-Not (Test-Path $img_path)) { Write-Host "Image not found"; exit }
if (-Not (Test-Path $html_path)) { Write-Host "HTML not found"; exit }

$bytes = [IO.File]::ReadAllBytes($img_path)
$b64 = [Convert]::ToBase64String($bytes)

$html = [IO.File]::ReadAllText($html_path, [System.Text.Encoding]::UTF8)
$new_html = $html.Replace('data:image/jpeg;base64,<?= imageBase64 ?>', "data:image/jpeg;base64,$b64")

[IO.File]::WriteAllText($html_path, $new_html, [System.Text.Encoding]::UTF8)
Write-Host "Success"
