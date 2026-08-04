#!/bin/bash
# Antigravity 中文汉化 - Ubuntu 一键安装脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "=========================================="
echo "  Antigravity 中文汉化安装工具 (Linux)"
echo "=========================================="
echo ""
echo "请选择左上角品牌显示方式："
echo "  [1] 显示英文 Antigravity（默认推荐）"
echo "  [2] 不显示品牌名"
echo "  [3] 显示中文品牌名"
echo ""
read -rp "请输入选项 [1/2/3]（直接按 Enter 默认为 1）: " CHOICE_VAL

BRAND_ARG="--brand-title english"
case "$CHOICE_VAL" in
    2) BRAND_ARG="--brand-title hidden" ;;
    3) BRAND_ARG="--brand-title translated" ;;
    *) BRAND_ARG="--brand-title english" ;;
esac

echo ""
echo "[1/2] 正在注入汉化代码..."
if ! node "$SCRIPT_DIR/localization_engine.js" $BRAND_ARG "$@"; then
    echo ""
    echo "[错误] 注入失败，请检查上方错误信息。"
    echo "提示：如果上方显示“权限不足”或 “EACCES”，请使用 sudo 重新运行此脚本。"
    echo "示例：sudo ./install.sh"
    # 从文件管理器双击启动时，给用户时间阅读上方的权限提示；管道和 CI 不等待输入。
    if [ -t 0 ]; then
        read -rp "按 Enter 键退出..." _
    fi
    exit 1
fi

echo ""
echo "[2/2] 注入完成！"
echo ""
echo "提示：汉化已成功部署。"
echo "请重新启动 Antigravity 软件即可畅享全中文界面！"
