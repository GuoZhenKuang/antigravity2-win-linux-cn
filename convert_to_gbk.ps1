# 仅供维护 Windows 批处理文件编码时使用；不要从安装/卸载 .bat 中调用本脚本。
# 两份 UTF-8 临时源文件准备好后，在任意工作目录执行本脚本即可。
$files = @(
    @{ Source = '_inst_utf8.tmp'; Target = '双击安装中文汉化.bat' },
    @{ Source = '_uninst_utf8.tmp'; Target = '双击卸载还原官方英文.bat' }
)
$gbk = [System.Text.Encoding]::GetEncoding(936)
$contents = @{}

# 先验证并读取全部输入，避免其中一个临时文件缺失时只转换了一半目标文件。
foreach ($file in $files) {
    $sourcePath = Join-Path $PSScriptRoot $file.Source
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "未找到 UTF-8 临时文件：$sourcePath"
    }
    $contents[$file.Source] = [System.IO.File]::ReadAllText($sourcePath, [System.Text.Encoding]::UTF8)
}

foreach ($file in $files) {
    $targetPath = Join-Path $PSScriptRoot $file.Target
    [System.IO.File]::WriteAllText($targetPath, $contents[$file.Source], $gbk)
}

# 只有全部目标文件成功写入后，才删除临时源文件。
foreach ($file in $files) {
    Remove-Item -LiteralPath (Join-Path $PSScriptRoot $file.Source) -Force
}
