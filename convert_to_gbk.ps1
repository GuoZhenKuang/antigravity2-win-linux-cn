$c1 = [System.IO.File]::ReadAllText("c:\Users\Lucian\Project\antigravity2-win-linux-cn\_inst_utf8.tmp", [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText("c:\Users\Lucian\Project\antigravity2-win-linux-cn\双击安装中文汉化.bat", $c1, [System.Text.Encoding]::GetEncoding(936))

$c2 = [System.IO.File]::ReadAllText("c:\Users\Lucian\Project\antigravity2-win-linux-cn\_uninst_utf8.tmp", [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText("c:\Users\Lucian\Project\antigravity2-win-linux-cn\双击卸载还原官方英文.bat", $c2, [System.Text.Encoding]::GetEncoding(936))

Remove-Item "c:\Users\Lucian\Project\antigravity2-win-linux-cn\_inst_utf8.tmp"
Remove-Item "c:\Users\Lucian\Project\antigravity2-win-linux-cn\_uninst_utf8.tmp"
