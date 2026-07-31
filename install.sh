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
node "$SCRIPT_DIR/localization_engine.js" $BRAND_ARG "$@"

if [ $? -ne 0 ]; then
    echo ""
    echo "[错误] 注入失败，请检查上方错误信息。"
    exit 1
fi

echo ""
echo "[2/2] 注入完成！"
echo ""
echo "提示：汉化已成功部署。"
echo "请重新启动 Antigravity 软件即可畅享全中文界面！"
