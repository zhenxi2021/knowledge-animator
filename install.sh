#!/usr/bin/env bash
#
# install.sh —— 把 knowledge-animator 安装到各类 AI 编码助手（通用安装）
#
# 用法：
#   ./install.sh                     检测本机已安装的助手，装到它们的 skills 目录
#   ./install.sh --all              装到所有已知助手（即便没检测到，也会建好目录）
#   ./install.sh claude workbuddy   只装到指定助手（名字见下方 TOOLS 表）
#   ./install.sh --dir /path/skills 装到自定义目录（会在其下建 knowledge-animator 子目录）
#   ./install.sh --project          改用「项目级」目录（如 ./.claude/skills），而非用户级
#   ./install.sh --list             列出所有已知助手及本机检测状态
#   ./install.sh -h | --help        显示本帮助
#
# 已支持的助手：claude / codex / workbuddy / qoder / openclaw / opencode / gemini / cursor
# 想加新助手，往下方 TOOLS 表里加一行即可：
#     名称 | 用户级 skills 目录 | 项目级 skills 目录 | 探测路径(:分隔，命中其一即视为已安装)
# 注意：各助手的 skills 目录约定以官方文档为准；表内为常见约定，如与你的环境不符请自行调整。
#
# 注意：这里只用 `set -o pipefail`，**不要用 `set -u`（nounset）**。
# macOS 自带 bash 是 3.2 版，其 `set -u` 有个已知缺陷：在 while 循环里用 read 赋值的变量，
# 经过内部带 `local` 的函数调用后会被错误地当成「未绑定变量」而崩溃。
# 见 install.sh 历史：原 `set -uo pipefail` 会在第一个「未检测到」的助手处报 `name: unbound variable`。
set -o pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
SKILL="$SRC/SKILL.md"

if [ ! -f "$SKILL" ]; then
  echo "✗ 找不到 SKILL.md（脚本位置异常：$SRC）" >&2
  exit 1
fi

# 助手表： name | 用户级目录 | 项目级目录 | 探测路径(:分隔)
TOOLS='claude|~/.claude/skills|.claude/skills|~/.claude:/usr/local/bin/claude:/opt/homebrew/bin/claude
workbuddy|~/.workbuddy/skills|.workbuddy/skills|~/.workbuddy:/usr/local/bin/workbuddy
codex|~/.codex/skills|.codex/skills|~/.codex:/usr/local/bin/codex
opencode|~/.config/opencode/skills|.config/opencode/skills|~/.config/opencode:/usr/local/bin/opencode
qoder|~/.qoder/skills|.qoder/skills|~/.qoder:/usr/local/bin/qoder
openclaw|~/.openclaw/skills|.openclaw/skills|~/.openclaw:/usr/local/bin/openclaw
gemini|~/.gemini/skills|.gemini/skills|~/.gemini:/usr/local/bin/gemini
cursor|~/.cursor/skills|.cursor/skills|~/.cursor:/usr/local/bin/cursor'

expand() { case "$1" in "~"*) echo "$HOME${1#\~}";; *) echo "$1";; esac; }

probe_installed() {
  local probes="$1" x; local IFS=':'
  for x in $probes; do [ -e "$(expand "$x")" ] && return 0; done
  return 1
}

is_known() { echo "$TOOLS" | grep -q "^$1|"; }

print_help() { sed -n '2,/^set -uo pipefail$/p' "$0" | sed '$d;s/^# *//'; }

# ---- 参数解析 ----
SCOPE=user
MODE=detect          # detect | all | named | dir | list
TARGET_DIR=""
NAMES=""

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) print_help; exit 0;;
    --list)    MODE=list;;
    --all)     MODE=all;;
    --project) SCOPE=project;;
    --dir)
      MODE=dir
      TARGET_DIR="${2:-}"
      [ -z "$TARGET_DIR" ] && { echo "✗ --dir 需要一个路径参数" >&2; exit 2; }
      shift;;
    -*) echo "✗ 未知选项：$1（用 -h 看帮助）" >&2; exit 2;;
    *)
      case "$1" in
        /*|~/*|./|.) MODE=dir; TARGET_DIR="$1";;           # 兼容老用法：./install.sh /some/dir
        *)
          if is_known "$1"; then MODE=named; NAMES="$NAMES $1";
          else echo "✗ 未知助手：$1（用 --list 看支持列表）" >&2; exit 2; fi;;
      esac;;
  esac
  shift
done

# ---- 列出 ----
if [ "$MODE" = "list" ]; then
  echo "已知助手及本机检测状态："
  echo "$TOOLS" | while IFS='|' read -r name user proj probes; do
    [ -z "$name" ] && continue
    if probe_installed "$probes"; then st="已安装"; else st="未检测到"; fi
    printf "  %-10s %s\n" "$name" "$st"
  done
  exit 0
fi

# ---- 安装到单个目标 ----
do_install() {
  local dest="$1" label="$2"
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  cp -R "$SRC" "$dest"
  echo "  ✓ $label → $dest"
}

# ---- 执行 ----
case "$MODE" in
  dir)
    DEST="$(expand "$TARGET_DIR")/knowledge-animator"
    do_install "$DEST" "custom"
    ;;
  detect|all|named)
    echo "安装 knowledge-animator …"
    echo "$TOOLS" | while IFS='|' read -r name user proj probes; do
      [ -z "$name" ] && continue
      dir="$user"; [ "$SCOPE" = "project" ] && dir="$proj"
      dest="$(expand "$dir")/knowledge-animator"
      if [ "$MODE" = "detect" ]; then
        probe_installed "$probes" || { echo "  · 跳过 $name（未检测到，用 --all 强制）"; continue; }
      elif [ "$MODE" = "named" ]; then
        echo " $NAMES " | grep -q " $name " || continue
      fi
      do_install "$dest" "$name"
    done
    ;;
esac

echo ""
echo "完成。重新加载对应助手的会话后，调用该技能即可（如 WorkBuddy 输入 /knowledge-animator）。"
