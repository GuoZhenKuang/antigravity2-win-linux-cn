const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

// 自动向 PATH 补充 Node.js 路径（解决 Windows 下 npx / node 未加入环境变量的问题）
if (process.platform === 'win32') {
    const defaultNodePaths = [
        'C:\\Program Files\\nodejs',
        'C:\\Program Files (x86)\\nodejs',
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'node'),
        path.join(process.env.APPDATA || '', 'npm')
    ];
    for (const nodePath of defaultNodePaths) {
        if (fs.existsSync(nodePath)) {
            if (!process.env.PATH.includes(nodePath)) {
                process.env.PATH = `${nodePath};${process.env.PATH}`;
            }
        }
    }
}

const DICTS_FOLDER = 'dicts';
const BRAND_TITLE_ALIASES = {
    english: 'english',
    en: 'english',
    default: 'english',
    hidden: 'hidden',
    hide: 'hidden',
    none: 'hidden',
    translated: 'translated',
    chinese: 'translated',
    cn: 'translated',
    zh: 'translated'
};

function getOptionValue(name, defaultValue) {
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        if (args[i] === name) {
            return args[i + 1] || defaultValue;
        }
        if (args[i].startsWith(name + '=')) {
            return args[i].slice(name.length + 1);
        }
    }
    return defaultValue;
}

const BRAND_TITLE_MODE = BRAND_TITLE_ALIASES[String(getOptionValue('--brand-title', 'english')).toLowerCase()] || 'english';

const SIGNATURE_START = "/* --- ANTIGRAVITY CHINESE LOCALIZATION START --- */";
const SIGNATURE_END = "/* --- ANTIGRAVITY CHINESE LOCALIZATION END --- */";

function normalizeText(text) {
    if (!text) return "";
    return text.replace(/\s+/g, ' ')
               .trim()
               .replace(/’/g, "'")
               .replace(/‘/g, "'")
               .replace(/“/g, '"')
               .replace(/”/g, '"');
}

function loadDictionary() {
    const totalMap = {};
    const dictsDir = path.join(__dirname, DICTS_FOLDER);
    if (fs.existsSync(dictsDir)) {
        // 固定加载顺序，避免相同规范化键因文件系统枚举顺序不同而产生不稳定译文。
        const files = fs.readdirSync(dictsDir).filter(file => file.endsWith('.json')).sort();
        for (const file of files) {
            try {
                const filePath = path.join(dictsDir, file);
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(fileContent);
                for (const [k, v] of Object.entries(data)) {
                    const normK = normalizeText(k);
                    if (normK) totalMap[normK] = v;
                }
            } catch (e) {
                // ignore
            }
        }
    }
    if (BRAND_TITLE_MODE === 'english') {
        delete totalMap[normalizeText('Antigravity')];
    } else if (BRAND_TITLE_MODE === 'hidden') {
        totalMap[normalizeText('Antigravity')] = '';
    }
    return totalMap;
}

function generateJs() {
    const fullDict = loadDictionary();
    const longEntries = Object.entries(fullDict).sort((a, b) => b[0].length - a[0].length);
    
    const dictJson = JSON.stringify(fullDict, null, 4);
    const entriesJson = JSON.stringify(longEntries);

    const jsSource = `${SIGNATURE_START}
(() => {
    // V12.0 终极隔离版：基于容器回溯的物理隔离引擎
    // 逻辑：不再仅仅检查当前标签，而是向上回溯父级，识别“代码/编辑器”禁区
    const map = new Map(Object.entries(DICT_PLACEHOLDER));
    const lowerMap = new Map();
    for (const [k, v] of map.entries()) lowerMap.set(k.toLowerCase(), v);
    
    const longEntries = REPLACEMENT_ENTRIES_PLACEHOLDER;
    const translatedValues = new WeakMap();

    // 禁区类名、标签与语义属性特征
    const BLOCKED_CLASSES = ['monaco-editor', 'editor-container', 'terminal', 'output-view', 'debug-console', 'code-view', 'artifact-container', 'suggest-widget'];
    const BLOCKED_TAGS = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'INPUT', 'TEXTAREA', 'SVG', 'CANVAS', 'SYMBOL', 'PATH'];
    // Antigravity 2.6.0 会为每条已发送/历史用户消息添加此稳定测试标识。
    // 排除消息本体，避免 UI 词条与用户原文相同时误译聊天气泡。
    const BLOCKED_TEST_IDS = new Set(['user-input-step']);
    // 为后续发现的第三方嵌入区或特殊内容区预留显式的手动禁用开关。
    const SKIP_TRANSLATION_ATTR = 'data-ag-localization-skip';

    function norm(s) {
        if (!s) return '';
        return s.replace(/\\s+/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
    }

    function translateWithShortcut(val) {
        if (!val) return null;
        const match = val.match(/^(.+?)\\s*\\((Ctrl|Cmd|Alt|Shift|⌘|⌥|⇧|⌃)\\+?([^)]*)\\)$/i);
        if (match) {
            const prefix = match[1].trim();
            const normPref = norm(prefix);
            const lowerPref = normPref.toLowerCase();
            let transPref = null;
            if (map.has(normPref)) {
                transPref = map.get(normPref);
            } else if (lowerMap.has(lowerPref)) {
                transPref = lowerMap.get(lowerPref);
            }
            if (transPref) {
                return transPref + " (" + match[2] + (match[3] ? "+" + match[3] : "") + ")";
            }
        }
        return null;
    }

    // 会话选择器的更新时间由前端在运行时生成，实际值会随数量和
    // 时间单位变化。只匹配完整的相对时间文本，不翻译孤立数字或单位。
    function getRelativeTimeTranslation(value) {
        const normalized = norm(value);
        let match = normalized.match(/^(\\d+)\\s*(s|m|h|d|w|mo|yr)$/i);
        if (match) {
            const compactUnits = {
                s: "秒前",
                m: "分钟前",
                h: "小时前",
                d: "天前",
                w: "周前",
                mo: "个月前",
                yr: "年前"
            };
            return match[1] + compactUnits[match[2].toLowerCase()];
        }

        match = normalized.match(/^(\\d+)\\s*(sec|secs|second|seconds|min|mins|minute|minutes|hr|hrs|hour|hours|day|days|wk|wks|week|weeks|mo|mos|month|months|yr|yrs|year|years)\\s+ago$/i);
        if (!match) return null;

        const unit = match[2].toLowerCase();
        let translatedUnit = "";
        if (/^sec/.test(unit)) translatedUnit = "秒前";
        else if (/^min/.test(unit)) translatedUnit = "分钟前";
        else if (/^(?:hr|hour)/.test(unit)) translatedUnit = "小时前";
        else if (/^day/.test(unit)) translatedUnit = "天前";
        else if (/^(?:wk|week)/.test(unit)) translatedUnit = "周前";
        else if (/^mo/.test(unit)) translatedUnit = "个月前";
        else if (/^(?:yr|year)/.test(unit)) translatedUnit = "年前";
        return translatedUnit ? match[1] + translatedUnit : null;
    }

    // 核心隔离判断：回溯检查当前节点是否逻辑上属于“禁止汉化区”
    function isInBlockedZone(node) {
        let curr = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        while (curr) {
            if (curr.nodeType === Node.ELEMENT_NODE) {
                if (curr.hasAttribute(SKIP_TRANSLATION_ATTR)) return true;
                if (BLOCKED_TEST_IDS.has(curr.getAttribute('data-testid'))) return true;

                const tag = curr.tagName.toUpperCase();
                if (BLOCKED_TAGS.includes(tag)) return true;
                if (curr.getAttribute('contenteditable') === 'true') return true;
                
                const className = curr.className || '';
                if (typeof className === 'string') {
                    if (BLOCKED_CLASSES.some(cls => className.includes(cls))) return true;
                }
            }
            curr = curr.parentElement || (curr.parentNode && curr.parentNode.host); // 支持 Shadow DOM 穿透
        }
        return false;
    }

    // 查找当前节点之前最近的、带有实际文本的文本节点。React 常会把一句 UI
    // 文案拆到多个 span / Text 节点中，不能只依赖当前节点的内容。
    function findLastTextNode(node) {
        if (!node) return null;
        if (node.nodeType === Node.TEXT_NODE) {
            return node.nodeValue && node.nodeValue.trim() ? node : null;
        }
        if (!node.childNodes) return null;
        for (let i = node.childNodes.length - 1; i >= 0; i--) {
            const found = findLastTextNode(node.childNodes[i]);
            if (found) return found;
        }
        return null;
    }

    function findPreviousTextNode(node) {
        let current = node;
        while (current) {
            let sibling = current.previousSibling;
            while (sibling) {
                const found = findLastTextNode(sibling);
                if (found) return found;
                sibling = sibling.previousSibling;
            }
            current = current.parentNode || current.host || null;
        }
        return null;
    }

    function replaceTextNode(node, value) {
        if (!node) return;
        translatedValues.set(node, value);
        node.nodeValue = value;
    }

    const EXPLORED_STATUS_SUFFIX = '[>v›∨˅⌄▼▽⋁\\u2228\\u02c5\\u2304\\u25bc\\u25bd\\u276f\\u2193]';

    function getExploredStatusUnit(type) {
        const normalizedType = String(type || '').toLowerCase();
        if (/^files?$/.test(normalizedType)) return "个文件";
        if (/^folders?$/.test(normalizedType)) return "个文件夹";
        if (/^pages?$/.test(normalizedType)) return "个页面";
        if (/^search(?:es)?$/.test(normalizedType)) return "次搜索";
        if (/^tasks?$/.test(normalizedType)) return "个任务";
        if (/^commands?$/.test(normalizedType)) return "条命令";
        if (/^tools?$/.test(normalizedType)) return "个工具";
        if (/^rules?$/.test(normalizedType)) return "条规则";
        if (/^repos(?:itories)?$/.test(normalizedType)) return "个仓库";
        if (/^images?$/.test(normalizedType)) return "张图片";
        return null;
    }

    // 状态项允许随数量、单复数和末尾展开箭头变化；只接受完整状态或完整计数片段，
    // 避免把一般页面内容误判为步骤状态。
    function translateExploredStatus(str) {
        if (!str || typeof str !== 'string') return null;
        const trimmed = str.trim();
        const match = trimmed.match(new RegExp('^(?:(Explored)\\\\s+)?(.+?)(\\\\s*' + EXPLORED_STATUS_SUFFIX + ')?\\\\s*$', 'i'));
        if (!match) return null;

        const items = match[2].trim().split(/\\s*,\\s*/);
        const translatedItems = [];
        for (const item of items) {
            const itemMatch = item.trim().match(/^(\\d+)\\s+(files?|folders?|pages?|search(?:es)?|tasks?|commands?|tools?|rules?|repos(?:itories)?|images?)$/i);
            if (!itemMatch) return null;
            const unit = getExploredStatusUnit(itemMatch[2]);
            if (!unit) return null;
            translatedItems.push(itemMatch[1] + " " + unit);
        }

        return (match[1] ? "探索了 " : "") + translatedItems.join("、") + (match[3] || "");
    }

    function collectTextNodes(element) {
        const nodes = [];
        if (!element || !element.childNodes) return nodes;
        const visit = current => {
            if (current.nodeType === Node.TEXT_NODE) {
                nodes.push(current);
                return;
            }
            if (!current.childNodes) return;
            for (const child of current.childNodes) visit(child);
        };
        visit(element);
        return nodes;
    }

    // 归档提示中的“History.”是可点击元素，React 会将它与前后文拆成不同节点。
    // 实际渲染时，各片段也可能先被词典分别改成中英混合文本。仅在整个容器精确
    // 符合这句话时重排文本，保留 History 对应的原始元素及其事件行为。
    function translateArchivedConversationNotice(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE || isInBlockedZone(element)) return false;
        const noticeText = norm(element.textContent);
        const noticePattern = /^(?:View|视图|查看)\\s*(?:an\\s+archived\\s+conversation|个?\\s*已归档(?:的)?对话)\\s*(?:in|，?请前往)\\s*(?:History|历史记录)[.。]?$/i;
        if (!noticePattern.test(noticeText)) return false;

        // History 在当前版本中不一定使用 <a>，也可能是 button/span。取第一个
        // 仅包含该标签文案的后代元素，确保中文后缀插入到可点击元素之外。
        const historyElement = Array.from(element.querySelectorAll('*')).find(candidate => {
            return /^(?:History|历史记录)[.。]?$/i.test(norm(candidate.textContent));
        });
        if (!historyElement) return false;

        const textNodes = collectTextNodes(element);
        const prefixNode = textNodes.find(textNode => !historyElement.contains(textNode));
        const historyTextNodes = collectTextNodes(historyElement);
        if (!prefixNode || historyTextNodes.length === 0) return false;

        replaceTextNode(prefixNode, "可在");
        for (const textNode of textNodes) {
            if (textNode !== prefixNode && !historyElement.contains(textNode)) replaceTextNode(textNode, '');
        }
        replaceTextNode(historyTextNodes[0], "历史记录");
        for (let i = 1; i < historyTextNodes.length; i++) replaceTextNode(historyTextNodes[i], '');
        historyElement.parentNode.insertBefore(document.createTextNode("中查看已归档的对话。"), historyElement.nextSibling);
        return true;
    }

    // 2.6.0 会将 “Show N more...” 拆入多个 span。按容器完整文本匹配，
    // 保留动态数量，不为截图中的某个固定数字建立词条。
    function translateShowMoreStatus(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE || isInBlockedZone(element)) return false;
        const match = norm(element.textContent).match(/^Show\\s+(\\d+)\\s+more(?:\\.\\.\\.|…)?$/i);
        if (!match) return false;

        const textNodes = collectTextNodes(element);
        if (textNodes.length === 0) return false;
        replaceTextNode(textNodes[0], "显示另外 " + match[1] + " 个...");
        for (let i = 1; i < textNodes.length; i++) replaceTextNode(textNodes[i], '');
        return true;
    }

    // 基线配额提示中的日期由运行时插入，且可能被 React 拆为多个节点。只有完整
    // 英文句子出现后才替换，防止日期尚未插入完时把首位数字误当作完整刷新时间。
    function getBaselineQuotaRefreshTranslation(value) {
        const match = norm(value).match(/^Your plan(?:'s|’s) baseline quota will refresh on\\s+(.+?)[.。]$/i);
        if (!match) return null;

        let refreshTime = match[1].trim();
        // “on 2.” 只是日期异步插入过程中的首位片段，不能提前生成“于 2 刷新”。
        // 等待 MutationObserver 收到完整日期时间后，再由容器规则重排整句。
        if (/^\\d+$/.test(refreshTime)) return null;
        // 某些构建会额外插入孤立的数字和句点，随后才渲染真正的日期时间。
        // 仅在其后紧跟完整日期时间时忽略该无语义的前缀。
        const strayPrefix = refreshTime.match(/^\\d+\\.\\s+(\\d{2}\\/\\d{1,2}\\/\\d{1,2}\\s+\\d{1,2}:\\d{2}:\\d{2})$/);
        if (strayPrefix) refreshTime = strayPrefix[1];

        return "您当前计划的基础配额将于 " + refreshTime + " 刷新。";
    }

    // 在不改动元素结构和可点击子元素的前提下，将文本节点范围替换为单个译文。
    // 用于“前缀 + 动态日期 + 后续链接”这类由多个 React 文本节点组成的句子。
    function replaceTextRange(textNodes, start, end, value) {
        let offset = 0;
        let replaced = false;
        for (const textNode of textNodes) {
            const original = textNode.nodeValue || '';
            const nodeStart = offset;
            const nodeEnd = nodeStart + original.length;
            offset = nodeEnd;

            if (nodeEnd <= start || nodeStart >= end) continue;

            const before = start > nodeStart ? original.slice(0, start - nodeStart) : '';
            const after = end < nodeEnd ? original.slice(end - nodeStart) : '';
            if (!replaced) {
                replaceTextNode(textNode, before + value);
                replaced = true;
                // 如果同一节点在原句后还有英文提示，将它拆到新节点中，让常规词典
                // 处理，而不是把整段中英混合文本标记为“已翻译”。
                if (after && textNode.parentNode) {
                    textNode.parentNode.insertBefore(document.createTextNode(after), textNode.nextSibling);
                }
            } else {
                if (after) {
                    translatedValues.delete(textNode);
                    textNode.nodeValue = after;
                } else {
                    replaceTextNode(textNode, '');
                }
            }
        }
        return replaced;
    }

    function translateBaselineQuotaNotice(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE || isInBlockedZone(element)) return false;
        // 由外至内遍历时，先让更小的实际提示容器处理，避免在页面根节点跨区域拼接文本。
        if (Array.from(element.children || []).some(child => /Your plan(?:'s|’s) baseline quota will refresh on/i.test(child.textContent || ''))) {
            return false;
        }
        // 父容器可能同时包含用户消息或编辑器等禁区；只拼接可翻译节点，绝不跨越禁区。
        const textNodes = collectTextNodes(element).filter(textNode => !isInBlockedZone(textNode));
        if (textNodes.length === 0) return false;

        const text = textNodes.map(textNode => textNode.nodeValue || '').join('');
        const match = text.match(/Your plan(?:'s|’s) baseline quota will refresh on\\s+(.+?)\\.(?=\\s*(?:To continue using this model now, enable AI Credit overages\\.|You can upgrade to a Google AI Ultra plan to receive higher rate limits\\.|View plans?\\.?|$))/i);
        if (!match || typeof match.index !== 'number') return false;

        const translated = getBaselineQuotaRefreshTranslation(match[0]);
        if (!translated) return false;
        return replaceTextRange(textNodes, match.index, match.index + match[0].length, translated);
    }

    function getDynamicSubagentStatusTranslation(value) {
        const normalized = norm(value);
        let match = normalized.match(/^Found\\s+(\\d+)\\s+subagents?(?:\\s*([>›❯〉→]))?$/i);
        if (match) return "找到 " + match[1] + " 个子智能体" + (match[2] ? " " + match[2] : "");

        match = normalized.match(/^(\\d+)\\s+questions?$/i);
        if (match) return match[1] + " 个问题";

        match = normalized.match(/^(\\d+)\\s+subagents?\\s+(running|blocked|completed|failed)$/i);
        if (match) {
            const stateMap = {
                running: "正在运行",
                blocked: "已阻塞",
                completed: "已完成",
                failed: "已失败"
            };
            return match[1] + " 个子智能体" + stateMap[match[2].toLowerCase()];
        }
        return null;
    }

    // 数量状态也可能被图标和嵌套 span 拆开。只匹配完整、无交互内容的状态文本。
    function translateDynamicSubagentStatusContainer(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE || isInBlockedZone(element)) return false;
        const textNodes = collectTextNodes(element).filter(textNode => !isInBlockedZone(textNode));
        if (textNodes.length === 0) return false;
        const translated = getDynamicSubagentStatusTranslation(textNodes.map(textNode => textNode.nodeValue || '').join(''));
        if (!translated) return false;
        replaceTextNode(textNodes[0], translated);
        for (let i = 1; i < textNodes.length; i++) replaceTextNode(textNodes[i], '');
        return true;
    }

    // 企业登录页的 “OR” 是两个分隔线之间的纯视觉分隔符。不能把 OR 加入全局
    // 词典，否则可能误改技术说明、代码或用户内容；仅匹配该组件的固定结构。
    function translateBusinessSsoOrDivider(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE || isInBlockedZone(element)) return false;
        if (element.tagName.toUpperCase() !== 'SPAN' || norm(element.textContent) !== 'OR') return false;

        const className = typeof element.className === 'string' ? element.className : '';
        const hasClass = (classes, classToken) => new RegExp('(?:^|\\\\s)' + classToken + '(?:\\\\s|$)').test(classes);
        if (!hasClass(className, 'uppercase') || !hasClass(className, 'select-none')) return false;

        const parent = element.parentElement;
        if (!parent) return false;
        const dividerCount = Array.from(parent.children || []).filter(sibling => {
            if (!sibling || sibling === element || sibling.tagName?.toUpperCase() !== 'DIV') return false;
            const siblingClasses = typeof sibling.className === 'string' ? sibling.className : '';
            return hasClass(siblingClasses, 'flex-1') && hasClass(siblingClasses, 'h-px');
        }).length;
        if (dividerCount !== 2) return false;

        const textNodes = collectTextNodes(element);
        if (textNodes.length !== 1) return false;
        replaceTextNode(textNodes[0], '或');
        return true;
    }

    // React 会把同一段 JSX 文案任意拆成多个相邻 Text 节点。先将同一元素中的
    // 连续文本片段拼接后匹配词典，再把译文写回第一个节点，避免残留英文碎片。
    function getCombinedStatusTranslation(value) {
        const normalized = norm(value);
        if (!normalized) return null;
        if (map.has(normalized)) return map.get(normalized);
        if (lowerMap.has(normalized.toLowerCase())) return lowerMap.get(normalized.toLowerCase());

        const baselineQuotaTranslation = getBaselineQuotaRefreshTranslation(normalized);
        if (baselineQuotaTranslation) return baselineQuotaTranslation;

        const subagentStatusTranslation = getDynamicSubagentStatusTranslation(normalized);
        if (subagentStatusTranslation) return subagentStatusTranslation;

        const relativeTimeTranslation = getRelativeTimeTranslation(normalized);
        if (relativeTimeTranslation) return relativeTimeTranslation;

        const showMoreMatch = normalized.match(/^Show\s+(\d+)\s+more(?:\.\.\.|…)?$/i);
        if (showMoreMatch) return "显示另外 " + showMoreMatch[1] + " 个...";

        const geminiAvailableMatch = normalized.match(/^Gemini\s+(.+?)\s+is now available$/i);
        if (geminiAvailableMatch) return "Gemini " + geminiAvailableMatch[1] + " 现已可用";

        const exploredTrans = translateExploredStatus(normalized);
        if (exploredTrans) return exploredTrans;

        const toolMatch = normalized.match(/^(\d+)\s+tools?\s+enabled$/i);
        if (toolMatch) return toolMatch[1] + " 个工具已启用";

        const scheduleMatch = normalized.match(/^All scheduled tasks run as\\s+(.+)$/i);
        if (scheduleMatch) {
            const model = scheduleMatch[1].replace(/[.。]+$/, '').trim();
            if (model) return "所有计划任务均以 " + model + " 模型运行。";
        }
        const viewArchivedHistMatch = normalized.match(/^View(?:\s+(\d+))?\s+archived conversations?\s+in\s+History\.?$/i);
        if (viewArchivedHistMatch) {
            return viewArchivedHistMatch[1]
                ? "在“历史记录”中查看 " + viewArchivedHistMatch[1] + " 个已归档对话。"
                : "可在“历史记录”中查看已归档的对话。";
        }
        const viewArchivedMatch = normalized.match(/^View(?:\s+(\d+))?\s+archived conversations?(?:\s+in)?$/i);
        if (viewArchivedMatch) {
            const countText = viewArchivedMatch[1] ? " " + viewArchivedMatch[1] + " 个" : "";
            return "查看" + countText + "已归档对话" + (/in$/i.test(normalized) ? "，请前往 " : "");
        }

        return null;
    }

    function translateCombinedTextChildren(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE || isInBlockedZone(element)) {
            return false;
        }

        let textRun = [];
        const translateRun = () => {
            if (textRun.length < 2) return false;
            const original = textRun.map(textNode => textNode.nodeValue || '').join('');
            const translated = getCombinedStatusTranslation(original);
            if (!translated || translated === original) return false;
            replaceTextNode(textRun[0], translated);
            for (let i = 1; i < textRun.length; i++) replaceTextNode(textRun[i], '');
            return true;
        };

        for (const child of element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                textRun.push(child);
                continue;
            }
            if (translateRun()) return true;
            textRun = [];
        }
        return translateRun();
    }

    // 处理被框架拆开的动态状态文案。比如：
    //   "29 " + "tool" + "s enabled"
    //   "All scheduled tasks run as " + "Flash."
    // 第一类在单节点词典匹配时会留下 "工具s enabled"；第二类的模型名是动态的，
    // 无法为每一个模型名添加静态词条。
    function translateFragmentedStatus(node, originalVal) {
        const currentText = norm(originalVal);
        const previous = findPreviousTextNode(node);
        const previousText = previous ? norm(previous.nodeValue) : '';

        // 步骤状态可拆为“Explored ”+“1”+“ folder”。除完整状态外，也只处理
        // 带有计数的精确资源片段，并保留逗号或展开箭头等独立 UI 元素。
        const statusItemMatch = currentText.match(new RegExp('^(files?|folders?|pages?|search(?:es)?|tasks?|commands?|tools?|rules?|repos(?:itories)?|images?)(\\s*,\\s*|\\s*' + EXPLORED_STATUS_SUFFIX + ')?$', 'i'));
        if (statusItemMatch && previous) {
            const unit = getExploredStatusUnit(statusItemMatch[1]);
            const tail = statusItemMatch[2] || '';
            const translatedTail = /,/.test(tail) ? '、' : tail;
            const prefixedCount = previousText.match(/^(?:Explored|探索了)\\s+(\\d+)$/i);
            if (prefixedCount) {
                replaceTextNode(previous, "探索了 " + prefixedCount[1]);
                return " " + unit + translatedTail;
            }
            if (/^\\d+$/.test(previousText)) return " " + unit + translatedTail;
        }

        // “No ” + “Projects” + “ found” 会由词典先将 Projects 翻成“项目列表”。
        // 在处理收尾节点时合并为完整中文短句，避免保留两侧英文碎片。
        if (/^found$/i.test(currentText) && previousText === "项目列表") {
            const noNode = findPreviousTextNode(previous);
            if (noNode && /^No$/i.test(norm(noNode.nodeValue))) {
                replaceTextNode(noNode, '');
                replaceTextNode(previous, "未找到项目列表");
                return '';
            }
        }

        // 权限选项会把“始终允许”和“不在项目中时”拆成相邻节点。
        // 合并后保持自然语序，并避免残留英文尾句。
        if (/^when not in a project$/i.test(currentText) && previousText === "是，且始终允许") {
            replaceTextNode(previous, "是，且在不属于任何项目时始终允许");
            return '';
        }

        // “29 tool” + “s enabled” 这类分割：直接在前一节点完成整句翻译。
        if (/^s\\s+enabled$/i.test(currentText) && previous) {
            const countAndTool = previousText.match(/^(\\d+)\\s+tools?$/i);
            if (countAndTool) {
                replaceTextNode(previous, countAndTool[1] + " 个工具已启用");
                return '';
            }
        }

        // “29 ” + “tool(s)” + “enabled” 或 “s enabled” 这类分割。
        // 工具节点可能已经被单词词典翻成“工具”，因此同时识别中英文。
        const isEnabledSuffix = /^s\\s+enabled$/i.test(currentText) || /^enabled$/i.test(currentText);
        if (isEnabledSuffix && previous) {
            let toolNode = previous;
            let toolText = previousText;

            // “tool” + “s” + “enabled” 会在处理 enabled 时遇到中间的 s 节点。
            if (/^s$/i.test(toolText) && /^enabled$/i.test(currentText)) {
                toolNode = findPreviousTextNode(previous);
                toolText = toolNode ? norm(toolNode.nodeValue) : '';
                replaceTextNode(previous, '');
            }

            const countNode = toolNode ? findPreviousTextNode(toolNode) : null;
            const countText = countNode ? norm(countNode.nodeValue) : '';
            if (/^(?:tool|tools|工具)$/i.test(toolText) && /^\\d+$/.test(countText)) {
                replaceTextNode(toolNode, '');
                return " 个工具已启用";
            }
        }

        // “所有计划任务均以 ”已经由前缀词典翻译后，再把其后的动态模型名补全。
        // 这也会在模型名异步插入时由 MutationObserver 自动生效。
        if (previousText === "所有计划任务均以" && currentText && !/[\\u4e00-\\u9fff]/.test(currentText)) {
            const model = currentText.replace(/[.。]+$/, '').trim();
            if (model) return model + " 模型运行。";
        }

        // 模型名与句号被拆成两个节点时，移除遗留的英文句号，避免显示“。.”。
        if (/^[.。]$/.test(currentText) && /模型运行。$/.test(previousText)) {
            return '';
        }

        // 删除计划任务确认提示会把“前缀 + 动态任务名 + 问号/撤销说明”拆成多个节点。
        // 前缀由词典先翻译；这里向前查找该前缀，再仅翻译紧随任务名的英文收尾。
        if (/^\\?\\s*(?:This action cannot be undone\\.?)?$/i.test(currentText) && previous) {
            let candidate = previous;
            for (let i = 0; i < 6 && candidate; i++) {
                if (norm(candidate.nodeValue) === "您确定要删除计划任务") {
                    return /This action cannot be undone/i.test(currentText)
                        ? "吗？此操作无法撤销。"
                        : "吗？";
                }
                candidate = findPreviousTextNode(candidate);
            }
        }

        if (/^in$/i.test(currentText) && (previousText === "个已归档对话" || previousText === "已归档对话" || previousText === "archived conversation" || previousText === "archived conversations")) {
            let viewNode = findPreviousTextNode(previous);
            let hasNumber = false;
            if (viewNode && /^\d+$/.test(norm(viewNode.nodeValue))) {
                hasNumber = true;
                viewNode = findPreviousTextNode(viewNode);
            }
            while (viewNode && /^(?:a|an|个)$/i.test(norm(viewNode.nodeValue))) {
                replaceTextNode(viewNode, '');
                viewNode = findPreviousTextNode(viewNode);
            }
            if (viewNode && /^View$/i.test(norm(viewNode.nodeValue))) {
                replaceTextNode(viewNode, "查看");
                if (!hasNumber) {
                    replaceTextNode(previous, "已归档的对话");
                }
                return "，请前往 ";
            }
        }

        return null;
    }

    function translateNode(node) {
        try {
            if (!node) return;

            // ShadowRoot 是 DocumentFragment；显式遍历它，确保已挂载的开放 Shadow DOM
            // 与常规 DOM 使用同一套安全检查与词典规则。
            if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                for (const child of node.childNodes) translateNode(child);
                return;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName.toUpperCase();
                
                // 给禁区元素打上 translate="no" 和 class="notranslate" 标记，物理防御网页自动翻译
                let isBlocked = BLOCKED_TAGS.includes(tag);
                if (!isBlocked) {
                    const className = node.className || '';
                    if (typeof className === 'string') {
                        if (BLOCKED_CLASSES.some(cls => className.includes(cls))) {
                            isBlocked = true;
                        }
                    }
                }
                if (node.getAttribute('contenteditable') === 'true') {
                    isBlocked = true;

                    // 反馈表单使用 contenteditable 编辑器实现，但其 placeholder 是固定
                    // 属性而非用户内容。仅翻译这些精确匹配的展示属性，绝不改动编辑器
                    // 的文本节点或已输入内容。
                    for (const attr of ['placeholder', 'aria-placeholder', 'data-placeholder', 'aria-label', 'title']) {
                        const value = node.getAttribute(attr);
                        if (!value) continue;
                        const normalizedValue = norm(value);
                        const shortcutTranslation = translateWithShortcut(normalizedValue);
                        if (shortcutTranslation) node.setAttribute(attr, shortcutTranslation);
                        else if (map.has(normalizedValue)) node.setAttribute(attr, map.get(normalizedValue));
                        else if (lowerMap.has(normalizedValue.toLowerCase())) node.setAttribute(attr, lowerMap.get(normalizedValue.toLowerCase()));
                    }
                }
                
                if (isBlocked) {
                    if (node.getAttribute('translate') !== 'no') {
                        node.setAttribute('translate', 'no');
                    }
                    try {
                        if (!node.classList.contains('notranslate')) {
                            node.classList.add('notranslate');
                        }
                    } catch (e) {}
                }

                // 1. 快速排除基础禁止标签
                if (BLOCKED_TAGS.includes(tag)) {
                    // 对于 INPUT, TEXTAREA 和 SVG，虽然不翻译其子元素或内容，但需要翻译其 placeholder, title, aria-label 等属性
                    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SVG') {
                        if (!isInBlockedZone(node.parentElement)) {
                            for (const attr of ['placeholder', 'aria-placeholder', 'data-placeholder', 'title', 'aria-label']) {
                                const v = node.getAttribute(attr);
                                if (v) {
                                    const t = norm(v);
                                    const shortcutTrans = translateWithShortcut(t);
                                    if (shortcutTrans) node.setAttribute(attr, shortcutTrans);
                                    else if (map.has(t)) node.setAttribute(attr, map.get(t));
                                    else if (lowerMap.has(t.toLowerCase())) node.setAttribute(attr, lowerMap.get(t.toLowerCase()));
                                }
                            }
                        }
                    }
                    return;
                }
                
                // 2. 只有当确实不在禁区时，才翻译其属性
                if (!isInBlockedZone(node)) {
                    translateArchivedConversationNotice(node);
                    translateShowMoreStatus(node);
                    translateBaselineQuotaNotice(node);
                    translateDynamicSubagentStatusContainer(node);
                    translateBusinessSsoOrDivider(node);
                    translateCombinedTextChildren(node);
                    for (const attr of ['placeholder', 'aria-placeholder', 'data-placeholder', 'title', 'aria-label']) {
                        const v = node.getAttribute(attr);
                        if (v) {
                            const t = norm(v);
                            const shortcutTrans = translateWithShortcut(t);
                            if (shortcutTrans) node.setAttribute(attr, shortcutTrans);
                            else if (map.has(t)) node.setAttribute(attr, map.get(t));
                            else if (lowerMap.has(t.toLowerCase())) node.setAttribute(attr, lowerMap.get(t.toLowerCase()));
                        }
                    }
                }

                if (node.shadowRoot) translateNode(node.shadowRoot);
                for (const child of node.childNodes) translateNode(child);

            } else if (node.nodeType === Node.TEXT_NODE) {
                let originalVal = node.nodeValue;
                if (!originalVal || originalVal.trim().length < 1) return;

                // 核心：如果是 skeleton 骨架占位文本，强制打上不翻译标记，防止自动翻译（例如 Google Translate 网页翻译）将其翻译为“装。资料。包装。资料。”
                if (originalVal.toLowerCase().includes('pack.info')) {
                    const parent = node.parentElement;
                    if (parent) {
                        if (parent.getAttribute('translate') !== 'no') {
                            parent.setAttribute('translate', 'no');
                        }
                        try {
                            if (!parent.classList.contains('notranslate')) {
                                parent.classList.add('notranslate');
                            }
                        } catch (e) {}
                    }
                    return;
                }

                // 核心：在处理文本节点前，必须确认其不在“禁止区”
                if (isInBlockedZone(node)) return;

                // 文案可能在当前节点刚插入时才拼接完整，需从父元素重新检查整段。
                if (translateArchivedConversationNotice(node.parentElement)) return;
                if (translateShowMoreStatus(node.parentElement)) return;
                if (translateBaselineQuotaNotice(node.parentElement)) return;
                if (translateDynamicSubagentStatusContainer(node.parentElement)) return;
                if (translateBusinessSsoOrDivider(node.parentElement)) return;
                if (translateCombinedTextChildren(node.parentElement)) return;

                if (translatedValues.get(node) === originalVal) return;

                let newVal = originalVal;
                // 剥除 UI 框架自动添加的 (Recommended) 前缀标记
                if (/^\(Recommended\)\s+/i.test(newVal)) {
                    newVal = newVal.replace(/^\(Recommended\)\s+/i, '');
                }
                const valNorm = norm(newVal);
                const valLower = valNorm.toLowerCase();

                
                // 1. 精确匹配（含大小写自动纠正与快捷键检测）
                const shortcutTrans = translateWithShortcut(valNorm);
                const fragmentedStatusTrans = translateFragmentedStatus(node, originalVal);
                const exploredTrans = translateExploredStatus(valNorm);
                const baselineQuotaRefreshTrans = getBaselineQuotaRefreshTranslation(valNorm);
                const subagentStatusTrans = getDynamicSubagentStatusTranslation(valNorm);
                const relativeTimeTrans = getRelativeTimeTranslation(valNorm);
                if (fragmentedStatusTrans !== null) {
                    newVal = fragmentedStatusTrans;
                } else if (shortcutTrans) {
                    newVal = shortcutTrans;
                } else if (exploredTrans) {
                    newVal = exploredTrans;
                } else if (baselineQuotaRefreshTrans) {
                    newVal = baselineQuotaRefreshTrans;
                } else if (subagentStatusTrans) {
                    newVal = subagentStatusTrans;
                } else if (relativeTimeTrans) {
                    newVal = relativeTimeTrans;
                } else if (map.has(valNorm)) {
                    newVal = map.get(valNorm);
                } else if (/^Gemini\\s+(.+?)\\s+is now available$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Gemini\\s+(.+?)\\s+is now available$/i, (m, model) => "Gemini " + model + " 现已可用");
                } else if (lowerMap.has(valLower)) {
                    newVal = lowerMap.get(valLower);
                } else if (/^Refreshes in (\\d+) days?, (\\d+) hours?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Refreshes in (\\d+) days?, (\\d+) hours?$/i, (match, d, h) => {
                        return d + " 天 " + h + " 小时后刷新";
                    });
                } else if (/^Refreshes in (\\d+) hours?, (\\d+) minutes?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Refreshes in (\\d+) hours?, (\\d+) minutes?$/i, (match, h, m) => {
                        return h + " 小时 " + m + " 分钟后刷新";
                    });
                } else if (/^Refreshes in (\\d+) days?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Refreshes in (\\d+) days?$/i, (match, d) => {
                        return d + " 天后刷新";
                    });
                } else if (/^Refreshes in (\\d+) hours?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Refreshes in (\\d+) hours?$/i, (match, h) => {
                        return h + " 小时后刷新";
                    });
                } else if (/^Refreshes in (\\d+) minutes?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Refreshes in (\\d+) minutes?$/i, (match, m) => {
                        return m + " 分钟后刷新";
                    });
                } else if (/^You have used some of your weekly limit, it will fully refresh in (\\d+) days?, (\\d+) hours?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have used some of your weekly limit, it will fully refresh in (\\d+) days?, (\\d+) hours?\\.$/i, (match, d, h) => {
                        return "您已使用部分每周配额，将在 " + d + " 天 " + h + " 小时后完全刷新。";
                    });
                } else if (/^You have used some of your weekly limit, it will fully refresh in (\\d+) hours?, (\\d+) minutes?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have used some of your weekly limit, it will fully refresh in (\\d+) hours?, (\\d+) minutes?\\.$/i, (match, h, m) => {
                        return "您已使用部分每周配额，将在 " + h + " 小时 " + m + " 分钟后完全刷新。";
                    });
                } else if (/^You have used some of your weekly limit, it will fully refresh in (\\d+) days?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have used some of your weekly limit, it will fully refresh in (\\d+) days?\\.$/i, (match, d) => {
                        return "您已使用部分每周配额，将在 " + d + " 天后完全刷新。";
                    });
                } else if (/^You have used some of your weekly limit, it will fully refresh in (\\d+) hours?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have used some of your weekly limit, it will fully refresh in (\\d+) hours?\\.$/i, (match, h) => {
                        return "您已使用部分每周配额，将在 " + h + " 小时后完全刷新。";
                    });
                } else if (/^You have used some of your weekly limit, it will fully refresh in (\\d+) minutes?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have used some of your weekly limit, it will fully refresh in (\\d+) minutes?\\.$/i, (match, m) => {
                        return "您已使用部分每周配额，将在 " + m + " 分钟后完全刷新。";
                    });
                } else if (/^You have used some of your weekly limit, it will fully refresh in less than a minute\.$/i.test(valNorm)) {
                    newVal = "您已使用部分每周配额，将在不到 1 分钟后完全刷新。";
                } else if (/^You have used some of your 5-hour limit, it will fully refresh in (\\d+) hours?, (\\d+) minutes?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have used some of your 5-hour limit, it will fully refresh in (\\d+) hours?, (\\d+) minutes?\\.$/i, (match, h, m) => {
                        return "您已使用部分 5 小时配额，将在 " + h + " 小时 " + m + " 分钟后完全刷新。";
                    });
                } else if (/^You have used some of your 5-hour limit, it will fully refresh in (\\d+) hours?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have used some of your 5-hour limit, it will fully refresh in (\\d+) hours?\\.$/i, (match, h) => {
                        return "您已使用部分 5 小时配额，将在 " + h + " 小时后完全刷新。";
                    });
                } else if (/^You have used some of your 5-hour limit, it will fully refresh in (\\d+) minutes?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have used some of your 5-hour limit, it will fully refresh in (\\d+) minutes?\\.$/i, (match, m) => {
                        return "您已使用部分 5 小时配额，将在 " + m + " 分钟后完全刷新。";
                    });
                } else if (/^You have used some of your 5-hour limit, it will fully refresh in less than a minute\.$/i.test(valNorm)) {
                    newVal = "您已使用部分 5 小时配额，将在不到 1 分钟后完全刷新。";
                } else if (/^Your 5-hour limit will refresh in (\\d+) days?, (\\d+) hours?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Your 5-hour limit will refresh in (\\d+) days?, (\\d+) hours?\\.$/i, (match, d, h) => {
                        return "您的 5 小时配额将在 " + d + " 天 " + h + " 小时后刷新。";
                    });
                } else if (/^Your 5-hour limit will refresh in (\\d+) hours?, (\\d+) minutes?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Your 5-hour limit will refresh in (\\d+) hours?, (\\d+) minutes?\\.$/i, (match, h, m) => {
                        return "您的 5 小时配额将在 " + h + " 小时 " + m + " 分钟后刷新。";
                    });
                } else if (/^Your 5-hour limit will refresh in (\\d+) days?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Your 5-hour limit will refresh in (\\d+) days?\\.$/i, (match, d) => {
                        return "您的 5 小时配额将在 " + d + " 天后刷新。";
                    });
                } else if (/^Your 5-hour limit will refresh in (\\d+) hours?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Your 5-hour limit will refresh in (\\d+) hours?\\.$/i, (match, h) => {
                        return "您的 5 小时配额将在 " + h + " 小时后刷新。";
                    });
                } else if (/^Your 5-hour limit will refresh in (\\d+) minutes?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Your 5-hour limit will refresh in (\\d+) minutes?\\.$/i, (match, m) => {
                        return "您的 5 小时配额将在 " + m + " 分钟后刷新。";
                    });
                } else if (/^Your 5-hour limit will refresh in less than a minute\.$/i.test(valNorm)) {
                    newVal = "您的 5 小时配额将在不到 1 分钟后刷新。";
                } else if (/^You have hit your 5-hour limit, it will refresh in (\\d+) days?, (\\d+) hours?\\. If on a supported paid plan, you can use AI credits in the interim\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have hit your 5-hour limit, it will refresh in (\\d+) days?, (\\d+) hours?\\. If on a supported paid plan, you can use AI credits in the interim\\.$/i, (match, d, h) => {
                        return "您已达到 5 小时配额限制，将在 " + d + " 天 " + h + " 小时后刷新。如果使用的是受支持的付费计划，您可以在此期间使用 AI 额度。";
                    });
                } else if (/^You have hit your 5-hour limit, it will refresh in (\\d+) hours?, (\\d+) minutes?\\. If on a supported paid plan, you can use AI credits in the interim\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have hit your 5-hour limit, it will refresh in (\\d+) hours?, (\\d+) minutes?\\. If on a supported paid plan, you can use AI credits in the interim\\.$/i, (match, h, m) => {
                        return "您已达到 5 小时配额限制，将在 " + h + " 小时 " + m + " 分钟后刷新。如果使用的是受支持的付费计划，您可以在此期间使用 AI 额度。";
                    });
                } else if (/^Error ID:\\s*(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Error ID:\\s*(.+)$/i, (match, id) => {
                        return "错误 ID: " + id;
                    });
                } else if (/^Models within this group:\\s*(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Models within this group:\\s*(.+)$/i, (match, models) => {
                        return "此组内的模型: " + models;
                    });
                } else if (/^Executor is not currently running \\(error ID:\\s*(.+)\\)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Executor is not currently running \\(error ID:\\s*(.+)\\)$/i, (match, id) => {
                        return "执行器当前未运行 (错误 ID: " + id + ")";
                    });
                } else if (/^Thought for ([\\d\\.]+)(s|ms|m|min)(?:\\s*>)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Thought for ([\\d\\.]+)(s|ms|m|min)(?:\\s*>)?$/i, (match, val, unit) => {
                        let unitStr = "秒";
                        if (unit.toLowerCase() === 'ms') unitStr = "毫秒";
                        else if (unit.toLowerCase() === 'm' || unit.toLowerCase() === 'min') unitStr = "分钟";
                        return "思考了 " + val + " " + unitStr;
                    });
                } else if (/^Worked for ([\\d\\.]+)(s|ms|m|min)(?:\\s*>)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Worked for ([\\d\\.]+)(s|ms|m|min)(?:\\s*>)?$/i, (match, val, unit) => {
                        let unitStr = "秒";
                        if (unit.toLowerCase() === 'ms') unitStr = "毫秒";
                        else if (unit.toLowerCase() === 'm' || unit.toLowerCase() === 'min') unitStr = "分钟";
                        return "工作了 " + val + " " + unitStr;
                    });
                } else if (/^You have hit your 5-hour limit, it will refresh in (\\d+) days?\\. If on a supported paid plan, you can use AI credits in the interim\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have hit your 5-hour limit, it will refresh in (\\d+) days?\\. If on a supported paid plan, you can use AI credits in the interim\\.$/i, (match, d) => {
                        return "您已达到 5 小时配额限制，将在 " + d + " 天后刷新。如果使用的是受支持的付费计划，您可以在此期间使用 AI 额度。";
                    });
                } else if (/^You have hit your 5-hour limit, it will refresh in (\\d+) hours?\\. If on a supported paid plan, you can use AI credits in the interim\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have hit your 5-hour limit, it will refresh in (\\d+) hours?\\. If on a supported paid plan, you can use AI credits in the interim\\.$/i, (match, h) => {
                        return "您已达到 5 小时配额限制，将在 " + h + " 小时后刷新。如果使用的是受支持的付费计划，您可以在此期间使用 AI 额度。";
                    });
                } else if (/^You have hit your 5-hour limit, it will refresh in (\\d+) minutes?\\. If on a supported paid plan, you can use AI credits in the interim\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have hit your 5-hour limit, it will refresh in (\\d+) minutes?\\. If on a supported paid plan, you can use AI credits in the interim\\.$/i, (match, m) => {
                        return "您已达到 5 小时配额限制，将在 " + m + " 分钟后刷新。如果使用的是受支持的付费计划，您可以在此期间使用 AI 额度。";
                    });
                } else if (/^You have hit your 5-hour limit, it will refresh in less than a minute\\. If on a supported paid plan, you can use AI credits in the interim\\.$/i.test(valNorm)) {
                    newVal = "您已达到 5 小时配额限制，将在不到 1 分钟后刷新。如果使用的是受支持的付费计划，您可以在此期间使用 AI 额度。";
                } else if (/^You have hit your weekly limit, it will fully refresh in (\\d+) days?, (\\d+) hours?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have hit your weekly limit, it will fully refresh in (\\d+) days?, (\\d+) hours?\\.$/i, (match, d, h) => {
                        return "您已达到每周配额限制，将在 " + d + " 天 " + h + " 小时后完全刷新。";
                    });
                } else if (/^You have hit your weekly limit, it will fully refresh in (\\d+) hours?, (\\d+) minutes?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have hit your weekly limit, it will fully refresh in (\\d+) hours?, (\\d+) minutes?\\.$/i, (match, h, m) => {
                        return "您已达到每周配额限制，将在 " + h + " 小时 " + m + " 分钟后完全刷新。";
                    });
                } else if (/^You have hit your weekly limit, it will fully refresh in (\\d+) days?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have hit your weekly limit, it will fully refresh in (\\d+) days?\\.$/i, (match, d) => {
                        return "您已达到每周配额限制，将在 " + d + " 天后完全刷新。";
                    });
                } else if (/^You have hit your weekly limit, it will fully refresh in (\\d+) hours?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have hit your weekly limit, it will fully refresh in (\\d+) hours?\\.$/i, (match, h) => {
                        return "您已达到每周配额限制，将在 " + h + " 小时后完全刷新。";
                    });
                } else if (/^You have hit your weekly limit, it will fully refresh in (\\d+) minutes?\\.$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have hit your weekly limit, it will fully refresh in (\\d+) minutes?\\.$/i, (match, m) => {
                        return "您已达到每周配额限制，将在 " + m + " 分钟后完全刷新。";
                    });
                } else if (/^You have hit your weekly limit, it will fully refresh in less than a minute\.$/i.test(valNorm)) {
                    newVal = "您已达到每周配额限制，将在不到 1 分钟后完全刷新。";
                } else if (/^Match case \((.+)\)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Match case \((.+)\)$/i, (m, k) => "区分大小写 (" + k + ")");
                } else if (/^Match whole word \((.+)\)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Match whole word \((.+)\)$/i, (m, k) => "全字匹配 (" + k + ")");
                } else if (/^Use regular expression \((.+)\)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Use regular expression \((.+)\)$/i, (m, k) => "使用正则表达式 (" + k + ")");
                } else if (/^Previous match \((.+)\)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Previous match \((.+)\)$/i, (m, k) => "上一个匹配项 (" + k + ")");
                } else if (/^Next match \((.+)\)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Next match \((.+)\)$/i, (m, k) => "下一个匹配项 (" + k + ")");
                } else if (/^Close \((.+)\)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Close \((.+)\)$/i, (m, k) => "关闭 (" + k + ")");
                } else if (/^Learn more about (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Learn more about (.+)$/i, (match, p) => {
                        let translatedPreset = p;
                        if (p.toLowerCase() === 'default') translatedPreset = "默认 (Default)";
                        else if (p.toLowerCase() === 'full machine') translatedPreset = "全机访问 (Full Machine)";
                        else if (p.toLowerCase() === 'turbo mode') translatedPreset = "极速模式 (Turbo Mode)";
                        else if (p.toLowerCase() === 'custom') translatedPreset = "自定义 (Custom)";
                        return "了解更多关于 " + translatedPreset + " 的信息";
                    });
                } else if (/^Yes, and always allow '(.+)' in this project$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Yes, and always allow '(.+)' in this project$/i, (match, cmd) => {
                        return "是，且在此项目中始终允许运行 '" + cmd + "'";
                      });
                } else if (/^Yes, and always allow '(.+)'$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Yes, and always allow '(.+)'$/i, (match, cmd) => {
                        return "是, 且始终允许运行 '" + cmd + "'";
                    });
                } else if (/^(\\d+) tools? enabled$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\\d+) tools? enabled$/i, (match, num) => {
                        return num + " 个工具已启用";
                    });
                } else if (/^(\\d+) active conversations?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\\d+) active conversations?$/i, (match, num) => {
                        return num + " 个活跃对话";
                    });
                } else if (/^(\\d+) archived conversations?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\\d+) archived conversations?$/i, (match, num) => {
                        return num + " 个已归档对话";
                    });
                } else if (/^(\\d+) tasks? running$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\\d+) tasks? running$/i, (match, num) => {
                        return num + " 个任务正在运行";
                    });
                } else if (/^(\\d+) files? changed$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\\d+) files? changed$/i, (match, num) => {
                        return num + " 个文件已更改";
                    });
                } else if (/^Show (\\d+) more(\\.\\.\\.|…)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Show (\\d+) more(\\.\\.\\.|…)?$/i, (match, num) => {
                        return "显示另外 " + num + " 个...";
                    });
                } else if (/^Show (\\d+) breakdowns?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Show (\\d+) breakdowns?$/i, (match, num) => {
                        return "显示 " + num + " 项明细";
                    });
                } else if (/^See all \\((\\d+)\\)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^See all \\((\\d+)\\)$/i, (match, num) => {
                        return "显示全部 (" + num + ")";
                    });
                } else if (/^Available AI Credits: (\\d+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Available AI Credits: (\\d+)$/i, (match, num) => {
                        return "可用 AI 额度: " + num;
                    });
                } else if (/^Send feedback as\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Send feedback as\\s+(.+)$/i, (match, email) => {
                        return "发送反馈身份为 " + email;
                    });
                } else if (/^Media\\s*\\((.+)\\)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Media\\s*\\((.+)\\)$/i, (match, timeStr) => {
                        let t = timeStr.replace(/Today/i, '今天').replace(/Yesterday/i, '昨天');
                        return "媒体 (" + t + ")";
                    });
                } else if (/^Updated\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Updated\\s+(.+)$/i, (match, rest) => {
                        return "更新于 " + rest;
                    });
                } else if (/^All scheduled tasks run as (.+?)[\.\s]*$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^All scheduled tasks run as (.+?)[\.\s]*$/i, (match, model) => {
                        return "所有计划任务均以 " + model + " 模型运行。";
                    });
                } else if (/^Individual quota reached\. Please upgrade your subscription to increase your limits\. Resets in (.+?)\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Individual quota reached\. Please upgrade your subscription to increase your limits\. Resets in (.+?)\.?$/i, (match, t) => {
                        return "个人配额已达上限。请升级订阅以提高限额。将于 " + t + " 后重置。";
                    });
                } else if (/^Mark\s+(\d+)\s+conversations?\s+as\s+read$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Mark\s+(\d+)\s+conversations?\s+as\s+read$/i, (match, num) => {
                        return "将 " + num + " 个对话标记为已读";
                    });
                } else if (/^Mark\s+(\d+)\s+conversations?\s+as\s+unread$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Mark\s+(\d+)\s+conversations?\s+as\s+unread$/i, (match, num) => {
                        return "将 " + num + " 个对话标记为未读";
                    });
                } else if (/^Mark\s+all\s+(?:conversations?\s+)?as\s+read$/i.test(valNorm)) {
                    newVal = "将所有对话标记为已读";
                } else if (/^Mark\s+all\s+(?:conversations?\s+)?as\s+unread$/i.test(valNorm)) {
                    newVal = "将所有对话标记为未读";
                } else if (/^Version\\s+([\\d\\.]+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Version\\s+([\\d\\.]+)$/i, (match, v) => {
                        return "版本 " + v;
                    });
                } else if (/^(\d+)\s+subagents?\s+(running|blocked|completed|failed)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\d+)\s+subagents?\s+(running|blocked|completed|failed)$/i, (match, num, state) => {
                        const stateLower = state.toLowerCase();
                        let stateStr = "";
                        if (stateLower === "running") stateStr = "正在运行";
                        else if (stateLower === "blocked") stateStr = "已阻塞";
                        else if (stateLower === "completed") stateStr = "已完成";
                        else if (stateLower === "failed") stateStr = "已失败";
                        return num + " 个子智能体" + stateStr;
                    });
                } else if (/^(\d+)\s+questions?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\d+)\s+questions?$/i, (match, num) => {
                        return num + " 个问题";
                    });
                } else if (/^Asking\s+(\d+)\s+questions?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Asking\s+(\d+)\s+questions?$/i, (match, num) => {
                        return "正在询问 " + num + " 个问题";
                    });
                } else if (/^This will permanently delete (\d+) active (?:conversations?|chats?)(?: and (\d+) archived (?:conversations?|chats?))? within it\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^This will permanently delete (\d+) active (?:conversations?|chats?)(?: and (\d+) archived (?:conversations?|chats?))? within it\.?$/i, (match, active, archived) => {
                        if (archived) {
                            return "这将永久删除 " + active + " 个活跃对话及 " + archived + " 个已归档对话。";
                        }
                        return "这将永久删除 " + active + " 个活跃对话。";
                    });
                } else if (/^(.+?): context deadline exceeded$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(.+?): context deadline exceeded$/i, (match, prefix) => {
                        return prefix + ": 请求超时 (context deadline exceeded)";
                    });
                } else if (/^(.+?): i\\/o timeout$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(.+?): i\\/o timeout$/i, (match, prefix) => {
                        return prefix + ": I/O 超时 (i/o timeout)";
                    });
                } else if (/^Are you sure you want to delete the scheduled task (.+?)\\? This action cannot be undone\\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Are you sure you want to delete the scheduled task (.+?)\\? This action cannot be undone\\.?$/i, (match, name) => {
                        return "您确定要删除计划任务 " + name + " 吗？此操作无法撤销。";
                    });
                } else if (/^Are you sure you want to delete (the |this )?project (.+?)\\??$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Are you sure you want to delete (the |this )?project (.+?)\\??$/i, (match, article, name) => {
                        return "您确定要删除项目 " + name + " 吗？";
                    });
                } else if (/^Permanently delete (.+?) including (\\d+) active conversations? and (\\d+) archived conversations?\\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Permanently delete (.+?) including (\\d+) active conversations? and (\\d+) archived conversations?\\.?$/i, (match, name, active, archived) => {
                        return "永久删除 " + name + "，包含 " + active + " 个活跃对话及 " + archived + " 个已归档对话。";
                    });
                } else if (/^This will permanently delete (.+?) including (\\d+) active conversations? and (\\d+) archived conversations?(?:\\. This action cannot be undone\\.)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^This will permanently delete (.+?) including (\\d+) active conversations? and (\\d+) archived conversations?(?:\\. This action cannot be undone\\.)?$/i, (match, name, active, archived) => {
                        return "这将永久删除 " + name + "，包含 " + active + " 个活跃对话及 " + archived + " 个已归档对话。此操作无法撤销。";
                    });
                } else {
                    // 2. 长句子串滑动替换
                    for (const [key, translated] of longEntries) {
                        if (key.length > 20 && valNorm.includes(key)) {
                            newVal = newVal.split(key).join(translated);
                        }
                    }
                    
                    // 3. 动态局部正则替换（处理合并在同一文本节点中的动态句子）
                    newVal = newVal.replace(/Your 5-hour limit will refresh in (\\d+) days?, (\\d+) hours?\\./gi, (match, d, h) => {
                        return "您的 5 小时配额将在 " + d + " 天 " + h + " 小时后刷新。";
                    });
                    newVal = newVal.replace(/Your 5-hour limit will refresh in (\\d+) hours?, (\\d+) minutes?\\./gi, (match, h, m) => {
                        return "您的 5 小时配额将在 " + h + " 小时 " + m + " 分钟后刷新。";
                    });
                    newVal = newVal.replace(/Your 5-hour limit will refresh in (\\d+) days?\\./gi, (match, d) => {
                        return "您的 5 小时配额将在 " + d + " 天后刷新。";
                    });
                    newVal = newVal.replace(/Your 5-hour limit will refresh in (\\d+) hours?\\./gi, (match, h) => {
                        return "您的 5 小时配额将在 " + h + " 小时后刷新。";
                    });
                    newVal = newVal.replace(/Your 5-hour limit will refresh in (\\d+) minutes?\\./gi, (match, m) => {
                        return "您的 5 小时配额将在 " + m + " 分钟后刷新。";
                    });
                    newVal = newVal.replace(/You have hit your 5-hour limit, it will refresh in (\\d+) days?, (\\d+) hours?\\. If on a supported paid plan, you can use AI credits in the interim\\./gi, (match, d, h) => {
                        return "您已达到 5 小时配额限制，将在 " + d + " 天 " + h + " 小时后刷新。如果使用的是受支持的付费计划，您可以在此期间使用 AI 额度。";
                    });
                    newVal = newVal.replace(/You have hit your 5-hour limit, it will refresh in (\\d+) hours?, (\\d+) minutes?\\. If on a supported paid plan, you can use AI credits in the interim\\./gi, (match, h, m) => {
                        return "您已达到 5 小时配额限制，将在 " + h + " 小时 " + m + " 分钟后刷新。如果使用的是受支持的付费计划，您可以在此期间使用 AI 额度。";
                    });
                    newVal = newVal.replace(/You have hit your 5-hour limit, it will refresh in (\\d+) days?\\. If on a supported paid plan, you can use AI credits in the interim\\./gi, (match, d) => {
                        return "您已达到 5 小时配额限制，将在 " + d + " 天后刷新。如果使用的是受支持的付费计划，您可以在此期间使用 AI 额度。";
                    });
                    newVal = newVal.replace(/You have hit your 5-hour limit, it will refresh in (\\d+) hours?\\. If on a supported paid plan, you can use AI credits in the interim\\./gi, (match, h) => {
                        return "您已达到 5 小时配额限制，将在 " + h + " 小时后刷新。如果使用的是受支持的付费计划，您可以在此期间使用 AI 额度。";
                    });
                    newVal = newVal.replace(/You have hit your 5-hour limit, it will refresh in (\\d+) minutes?\\. If on a supported paid plan, you can use AI credits in the interim\\./gi, (match, m) => {
                        return "您已达到 5 小时配额限制，将在 " + m + " 分钟后刷新。如果使用的是受支持的付费计划，您可以在此期间使用 AI 额度。";
                    });
                    newVal = newVal.replace(/You have used some of your weekly limit, it will fully refresh in (\\d+) days?, (\\d+) hours?\\./gi, (match, d, h) => {
                        return "您已使用部分每周配额，将在 " + d + " 天 " + h + " 小时后完全刷新。";
                    });
                    newVal = newVal.replace(/You have used some of your weekly limit, it will fully refresh in (\\d+) hours?, (\\d+) minutes?\\./gi, (match, h, m) => {
                        return "您已使用部分每周配额，将在 " + h + " 小时 " + m + " 分钟后完全刷新。";
                    });
                    newVal = newVal.replace(/You have used some of your weekly limit, it will fully refresh in (\\d+) days?\\./gi, (match, d) => {
                        return "您已使用部分每周配额，将在 " + d + " 天后完全刷新。";
                    });
                    newVal = newVal.replace(/You have used some of your weekly limit, it will fully refresh in (\\d+) hours?\\./gi, (match, h) => {
                        return "您已使用部分每周配额，将在 " + h + " 小时后完全刷新。";
                    });
                    newVal = newVal.replace(/You have used some of your weekly limit, it will fully refresh in (\\d+) minutes?\\./gi, (match, m) => {
                        return "您已使用部分每周配额，将在 " + m + " 分钟后完全刷新。";
                    });
                    newVal = newVal.replace(/You have hit your weekly limit, it will fully refresh in (\\d+) days?, (\\d+) hours?\\./gi, (match, d, h) => {
                        return "您已达到每周配额限制，将在 " + d + " 天 " + h + " 小时后完全刷新。";
                    });
                    newVal = newVal.replace(/You have hit your weekly limit, it will fully refresh in (\\d+) hours?, (\\d+) minutes?\\./gi, (match, h, m) => {
                        return "您已达到每周配额限制，将在 " + h + " 小时 " + m + " 分钟后完全刷新。";
                    });
                    newVal = newVal.replace(/You have hit your weekly limit, it will fully refresh in (\\d+) days?\\./gi, (match, d) => {
                        return "您已达到每周配额限制，将在 " + d + " 天后完全刷新。";
                    });
                    newVal = newVal.replace(/You have hit your weekly limit, it will fully refresh in (\\d+) hours?\\./gi, (match, h) => {
                        return "您已达到每周配额限制，将在 " + h + " 小时后完全刷新。";
                    });
                    newVal = newVal.replace(/You have hit your weekly limit, it will fully refresh in (\\d+) minutes?\\./gi, (match, m) => {
                        return "您已达到每周配额限制，将在 " + m + " 分钟后完全刷新。";
                    });
                    newVal = newVal.replace(/You have used some of your weekly limit, it will fully refresh in less than a minute\./gi, "您已使用部分每周配额，将在不到 1 分钟后完全刷新。");
                    newVal = newVal.replace(/You have hit your weekly limit, it will fully refresh in less than a minute\./gi, "您已达到每周配额限制，将在不到 1 分钟后完全刷新。");
                    newVal = newVal.replace(/Your 5-hour limit will refresh in less than a minute\./gi, "您的 5 小时配额将在不到 1 分钟后刷新。");
                    newVal = newVal.replace(/You have hit your 5-hour limit, it will refresh in less than a minute\. If on a supported paid plan, you can use AI credits in the interim\./gi, "您已达到 5 小时配额限制，将在不到 1 分钟后刷新。如果使用的是受支持的付费计划，您可以在此期间使用 AI 额度。");
                    newVal = newVal.replace(/Match case \((.+)\)/gi, (m, k) => "区分大小写 (" + k + ")");
                    newVal = newVal.replace(/Match whole word \((.+)\)/gi, (m, k) => "全字匹配 (" + k + ")");
                    newVal = newVal.replace(/Use regular expression \((.+)\)/gi, (m, k) => "使用正则表达式 (" + k + ")");
                    newVal = newVal.replace(/Previous match \((.+)\)/gi, (m, k) => "上一个匹配项 (" + k + ")");
                    newVal = newVal.replace(/Next match \((.+)\)/gi, (m, k) => "下一个匹配项 (" + k + ")");
                    newVal = newVal.replace(/Close \((.+)\)/gi, (m, k) => "关闭 (" + k + ")");
                    // 步骤节点量词片段翻译（处理 Explored N search / file / page 等拆分文本节点）
                    const exploredSec3 = translateExploredStatus(newVal);
                    if (exploredSec3) {
                        newVal = exploredSec3;
                    }
                    newVal = newVal.replace(/^(\\d+)\\s+searches?\\s*>?\\s*$/i, (m, n) => n + " 次搜索");
                    newVal = newVal.replace(/^searches?\\s*>?\\s*$/i, () => "次搜索");
                    newVal = newVal.replace(/^files?\\s*>?\\s*$/i, () => "个文件");
                    newVal = newVal.replace(/^(\\d+)\\s+pages?(\\s*[>›]?)\\s*$/i, (m, n, suffix) => n + " 个页面" + suffix);
                    newVal = newVal.replace(/^pages?(\\s*[>›]?)\\s*$/i, (m, suffix) => "个页面" + suffix);
                }
                if (newVal !== originalVal) {
                    translatedValues.set(node, newVal);
                    node.nodeValue = newVal;
                }
            }
        } catch (e) {}
    }

    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            if (m.type === 'childList') {
                for (const n of m.addedNodes) translateNode(n);
            } else if (m.type === 'characterData') {
                translateNode(m.target);
            } else if (m.type === 'attributes') {
                // 反馈类型切换时 React 会复用同一个 textarea，只更新 placeholder
                // 属性；此时不会产生 childList 或 characterData 变更。
                translateNode(m.target);
            }
        }
    });

    const obsOpts = {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['placeholder', 'aria-placeholder', 'data-placeholder', 'title', 'aria-label']
    };

    const startEngine = () => {
        const target = document.body || document.documentElement;
        if (target) {
            try {
                observer.observe(target, obsOpts);
                translateNode(target);
            } catch (e) {}
        }
    };

    const origAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function() {
        const sr = origAttachShadow.apply(this, arguments);
        try { observer.observe(sr, obsOpts); } catch(e) {}
        return sr;
    };

    // 强力多阶段触发绑定
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startEngine);
    } else {
        startEngine();
    }
    window.addEventListener('load', startEngine);
    setTimeout(startEngine, 100);
    setTimeout(startEngine, 300);
    setTimeout(startEngine, 1000);
    setTimeout(startEngine, 3000);
    setTimeout(startEngine, 6000);
})();
${SIGNATURE_END}`;

    return jsSource.replace("DICT_PLACEHOLDER", dictJson).replace("REPLACEMENT_ENTRIES_PLACEHOLDER", entriesJson);
}

function cleanJsContent(content) {
    const regex = new RegExp(escapeRegExp(SIGNATURE_START) + "[\\s\\S]*?" + escapeRegExp(SIGNATURE_END), "g");
    return content.replace(regex, "");
}

function cleanMenuJsContent(content) {
    const startMark = "// ==========================================";
    const endMark = "translateMenu(menu.items);";
    const startIdx = content.indexOf(startMark);
    const endIdx = content.indexOf(endMark);
    if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
        return content.substring(0, startIdx) + content.substring(endIdx + endMark.length);
    }
    return content;
}

function cleanTrayJsContent(content) {
    const startMark = "/* --- TRAY TRANSLATION START --- */";
    const endMark = "/* --- TRAY TRANSLATION END --- */";
    const startIdx = content.indexOf(startMark);
    const endIdx = content.indexOf(endMark);
    if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
        return content.substring(0, startIdx) + content.substring(endIdx + endMark.length);
    }
    return content;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let wasAppRunning = false;

function checkIfAppIsRunning() {
    try {
        if (process.platform === 'win32') {
            const stdout = child_process.execSync('tasklist /fi "imagename eq Antigravity.exe" /nh', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
            return stdout.toLowerCase().includes('antigravity.exe');
        } else {
            // 使用 pgrep -x 精确匹配进程名，避免匹配到当前 node 脚本自身
            const stdout = child_process.execSync('pgrep -x -i antigravity 2>/dev/null || true', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
            return stdout.trim().length > 0;
        }
    } catch (e) {
        // pgrep/tasklist exits non-zero when no process found — not an error
    }
    return false;
}

function closeAntigravityProcesses() {
    console.log("[1] 检测到 Antigravity 客户端正在运行，正在关闭以解除文件锁...");
    try {
        if (process.platform === 'win32') {
            child_process.execSync('taskkill /f /im Antigravity.exe /t >nul 2>nul');
        } else {
            // 使用 pkill -x 精确匹配进程名，避免误杀当前 node 脚本
            child_process.execSync('pkill -x -i antigravity 2>/dev/null || true', { stdio: 'ignore' });
        }
    } catch (e) {
        // ignore
    }
    const start = Date.now();
    while (Date.now() - start < 1500) {}
}

function detectInstallationDir(manualDir) {
    if (manualDir) {
        if (fs.existsSync(manualDir)) {
            let resolved = path.resolve(manualDir);
            if (fs.statSync(resolved).isFile() && resolved.endsWith('app.asar')) {
                resolved = path.dirname(resolved);
            }
            return resolved;
        } else {
            console.error(`[错误] 手动指定的路径不存在: ${manualDir}`);
            process.exit(1);
        }
    }

    const candidates = [];
    const seenCandidates = new Set();
    const addCandidate = (candidate) => {
        if (!candidate) return;
        const normalized = path.resolve(candidate);
        const key = normalized.toLowerCase();
        if (!seenCandidates.has(key)) {
            candidates.push(normalized);
            seenCandidates.add(key);
        }
    };
    const hasAntigravityResources = (candidate) => {
        return fs.existsSync(path.join(candidate, "resources", "app.asar")) ||
            fs.existsSync(path.join(candidate, "app.asar")) ||
            fs.existsSync(path.join(candidate, "Contents", "Resources", "app.asar")) ||
            fs.existsSync(path.join(candidate, "resources", "app", "product.json"));
    };

    // 环境变量
    addCandidate(process.env.ANTIGRAVITY_INSTALL_DIR);
    addCandidate(process.env.ANTIGRAVITY_HOME);

    if (process.platform === 'win32') {
        // Windows 注册表探测
        const registryRoots = [
            'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
            'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
            'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
        ];
        for (const root of registryRoots) {
            try {
                const output = child_process.execSync(`reg query "${root}" /s /f Antigravity /d`, { encoding: 'utf-8', stdio: 'pipe' });
                for (const line of output.split(/\r?\n/)) {
                    const match = line.match(/^\s*(InstallLocation|DisplayIcon)\s+REG_\w+\s+(.+)$/i);
                    if (!match) continue;
                    let value = match[2].trim().replace(/^"|"$/g, '');
                    if (/Antigravity\.exe/i.test(value)) {
                        value = path.dirname(value);
                    }
                    addCandidate(value);
                }
            } catch (e) {
                // Registry probing is best-effort
            }
        }
        // Windows 常见路径
        const driveLetters = ['C', 'D', 'E', 'F'];
        for (const drive of driveLetters) {
            addCandidate(`${drive}:\\Programs\\Antigravity`);
            addCandidate(`${drive}:\\Antigravity`);
        }
        addCandidate("C:\\Program Files\\Antigravity");
        const localAppdata = process.env.LOCALAPPDATA;
        if (localAppdata) {
            addCandidate(path.join(localAppdata, 'Programs', 'antigravity'));
        }
    } else {
        // Linux 常见安装路径
        const homeDir = process.env.HOME || '';
        addCandidate('/opt/Antigravity');
        addCandidate('/opt/Antigravity/Antigravity-x64');
        addCandidate('/opt/antigravity');
        addCandidate('/opt/antigravity/antigravity-x64');
        addCandidate('/usr/share/antigravity');
        addCandidate('/usr/share/Antigravity');
        addCandidate('/usr/lib/antigravity');
        addCandidate('/usr/lib/Antigravity');
        if (homeDir) {
            addCandidate(path.join(homeDir, '.local', 'share', 'antigravity'));
            addCandidate(path.join(homeDir, '.local', 'share', 'Antigravity'));
            addCandidate(path.join(homeDir, 'antigravity'));
        }
        // 解析 .desktop 文件
        const desktopFiles = [
            '/usr/share/applications/antigravity.desktop',
            '/usr/share/applications/Antigravity.desktop',
            path.join(homeDir, '.local', 'share', 'applications', 'antigravity.desktop'),
            path.join(homeDir, '.local', 'share', 'applications', 'Antigravity.desktop')
        ];
        for (const df of desktopFiles) {
            if (fs.existsSync(df)) {
                try {
                    const content = fs.readFileSync(df, 'utf-8');
                    const execMatch = content.match(/^Exec=(.+)$/m);
                    if (execMatch) {
                        let execPath = execMatch[1].trim().split(/\s+/)[0].replace(/^"|"$/g, '');
                        if (fs.existsSync(execPath)) {
                            try { execPath = fs.realpathSync(execPath); } catch (e) {}
                            addCandidate(path.dirname(execPath));
                        }
                    }
                } catch (e) {}
            }
        }
        // 解析 which 输出
        try {
            const whichOut = child_process.execSync('which antigravity 2>/dev/null || which agy 2>/dev/null', { encoding: 'utf-8' }).trim();
            if (whichOut && fs.existsSync(whichOut)) {
                const realP = fs.realpathSync(whichOut);
                addCandidate(path.dirname(realP));
            }
        } catch (e) {}
        // Snap
        addCandidate('/snap/antigravity/current');
        addCandidate('/snap/antigravity/current/usr/share/antigravity');
        // Flatpak
        if (homeDir) {
            addCandidate(path.join(homeDir, '.local', 'share', 'flatpak', 'app', 'com.antigravity', 'current', 'active', 'files', 'share', 'antigravity'));
        }
        addCandidate('/var/lib/flatpak/app/com.antigravity/current/active/files/share/antigravity');
    }

    for (const p of candidates) {
        if (fs.existsSync(p)) {
            if (hasAntigravityResources(p)) {
                console.log(`[探测] 成功自动识别到 Antigravity 安装目录: ${p}`);
                return path.resolve(p);
            }
            try {
                if (fs.statSync(p).isDirectory()) {
                    const subItems = fs.readdirSync(p);
                    for (const sub of subItems) {
                        const subPath = path.join(p, sub);
                        if (fs.existsSync(subPath) && fs.statSync(subPath).isDirectory() && hasAntigravityResources(subPath)) {
                            console.log(`[探测] 成功自动识别到 Antigravity 安装目录: ${subPath}`);
                            return path.resolve(subPath);
                        }
                    }
                }
            } catch (e) {}
        }
    }

    console.error("[错误] 未找到默认安装目录，请使用 --install-dir 手动指定您的安装路径！");
    process.exit(1);
}

function runCommandSync(cmd) {
    try {
        const out = child_process.execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
        return { success: true, stdout: out, stderr: '' };
    } catch (e) {
        return { success: false, stdout: e.stdout || '', stderr: e.stderr || e.message };
    }
}

function reportWritePermissionError(resourcesDir, error, action, entryScript = 'install.sh') {
    const detail = error && (error.code || error.message);
    console.error(`\n[权限不足] 无法${action} Antigravity 安装目录: ${resourcesDir}`);
    if (detail) console.error(`[详情] ${detail}`);

    if (process.platform === 'win32') {
        console.error("[提示] 请右键安装脚本并选择“以管理员身份运行”，然后重试。");
    } else {
        console.error("[提示] 此安装位于系统目录，需要管理员权限。请完全退出客户端后，在汉化包目录运行：");
        console.error(`  sudo ./${entryScript}`);
    }
}

function canWriteAntigravityResources(resourcesDir, entryScript) {
    const asarPath = path.join(resourcesDir, "app.asar");
    // app.asar 缺失由后续安装逻辑报告为“未找到文件”，避免误报为权限问题。
    if (!fs.existsSync(asarPath)) return true;

    try {
        // 安装需要创建 app.asar.bak，重打包时需要覆盖 app.asar；两项权限缺一不可。
        fs.accessSync(resourcesDir, fs.constants.W_OK | fs.constants.X_OK);
        fs.accessSync(asarPath, fs.constants.R_OK | fs.constants.W_OK);
        return true;
    } catch (e) {
        reportWritePermissionError(resourcesDir, e, '写入', entryScript);
        return false;
    }
}


// ==========================================
// Antigravity 2.0 汉化引擎 (ASAR打包注入模式)
// ==========================================
function install20(resourcesDir) {
    const asarPath = path.join(resourcesDir, "app.asar");
    const bakPath = path.join(resourcesDir, "app.asar.bak");

    if (!fs.existsSync(asarPath)) {
        console.error(`[错误] 未在资源目录中找到 app.asar: ${resourcesDir}`);
        return false;
    }

    // 1. 备份
    if (!fs.existsSync(bakPath)) {
        console.log(`[备份] 正在创建官方原始包备份: app.asar.bak ...`);
        try {
            fs.copyFileSync(asarPath, bakPath);
        } catch (e) {
            if (e.code === 'EACCES' || e.code === 'EPERM' || e.code === 'EROFS') {
                reportWritePermissionError(resourcesDir, e, '备份到');
            } else {
                console.error(`[错误] 创建 app.asar.bak 备份失败: ${e.message}`);
            }
            return false;
        }
        console.log(`[备份] 备份成功！`);
    } else {
        // 尝试用官方备份覆盖当前 app.asar，以确保每次汉化都基于最干净的官方英文包
        try {
            fs.copyFileSync(bakPath, asarPath);
            console.log(`[还原] 已重置当前 app.asar 为官方原始备份包，以进行全新注入...`);
        } catch (e) {
            if (e.code === 'EACCES' || e.code === 'EPERM' || e.code === 'EROFS') {
                reportWritePermissionError(resourcesDir, e, '写入');
                return false;
            }
            console.log(`[提示] 当前 app.asar 被锁定（可能是客户端正在运行），将使用当前包进行增量注入。`);
        }
    }

    // 2. 临时提取目录
    const tempDir = path.join(__dirname, "_temp_asar");
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.log(`[解包] 正在使用 npx 提取 app.asar...`);
    const extractRes = runCommandSync(`npx -y @electron/asar extract "${asarPath}" "${tempDir}"`);
    if (!extractRes.success || !fs.existsSync(tempDir)) {
        console.error(`[错误] 解包失败，可能是由于系统未安装 Node.js/npm 或者网络限制。`);
        console.error(`详情: ${extractRes.stderr}\n${extractRes.stdout}`);
        return false;
    }

    // 3. 注入 preload.js
    const preloadPath = path.join(tempDir, "dist", "preload.js");
    if (!fs.existsSync(preloadPath)) {
        console.error(`[错误] 解压后未能在指定路径找到 preload.js: ${preloadPath}`);
        fs.rmSync(tempDir, { recursive: true, force: true });
        return false;
    }

    console.log(`[修改] 正在向 preload.js 注入汉化代码...`);
    let content = fs.readFileSync(preloadPath, 'utf-8');

    // 清理已有的汉化，重新注入
    const cleanedContent = cleanJsContent(content);
    const translationJs = generateJs();
    const newContent = cleanedContent + "\n" + translationJs;

    fs.writeFileSync(preloadPath, newContent, 'utf-8');
    console.log(`[修改] 注入成功！`);

    // 3.1 注入 menu.js (系统菜单汉化)
    const menuPath = path.join(tempDir, "dist", "menu.js");
    if (fs.existsSync(menuPath)) {
        console.log(`[修改] 正在向 menu.js 注入菜单汉化代码...`);
        let menuContent = fs.readFileSync(menuPath, 'utf-8');
        
        const menuCleaned = cleanMenuJsContent(menuContent);
        
        const menuTranslationJs = `
    // ==========================================
    // Antigravity Native Menu Chinese Translation
    // ==========================================
    const translations = {
        'File': '文件',
        'Edit': '编辑',
        'View': '视图',
        'Window': '窗口',
        'Help': '帮助',
        'New Window': '新建窗口',
        'Create Project': '创建项目',
        'Command Palette': '命令面板',
        'Docs': '文档',
        'Check for Updates': '检查更新',
        'Toggle Developer Tools': '切换开发者工具',
        'Undo': '撤销',
        'Redo': '重做',
        'Cut': '剪切',
        'Copy': '复制',
        'Paste': '粘贴',
        'Select All': '全选',
        'Minimize': '最小化',
        'Maximize': '最大化',
        'Close': '关闭',
        'Zoom': '缩放',
        'Reset Zoom': '重置缩放',
        'Zoom In': '放大',
        'Zoom Out': '缩小',
        'Toggle Full Screen': '切换全屏',
        'Version': '版本'
    };
    function translateMenu(items) {
        for (const item of items) {
            let label = item.label || '';
            let mnemonic = '';
            let cleanLabel = label;
            const m = label.match(/&([a-zA-Z])/);
            if (m) {
                mnemonic = "(&" + m[1] + ")";
                cleanLabel = label.replace('&', '');
            }
            if (translations[cleanLabel]) {
                item.label = translations[cleanLabel] + mnemonic;
            } else if (translations[label]) {
                item.label = translations[label];
            } else if (/^Version\\s*([\\d\\.]*)$/i.test(cleanLabel)) {
                item.label = cleanLabel.replace(/^Version\\s*([\\d\\.]*)$/i, (match, v) => v ? "版本 " + v : "版本");
            }
            if (item.submenu && item.submenu.items) {
                translateMenu(item.submenu.items);
            }
        }
    }
    translateMenu(menu.items);
    `;

        const targetStr = "electron_1.Menu.setApplicationMenu(menu);";
        const idx = menuCleaned.indexOf(targetStr);
        if (idx !== -1) {
            const patchedMenuContent = menuCleaned.substring(0, idx) + menuTranslationJs + "\n    " + menuCleaned.substring(idx);
            fs.writeFileSync(menuPath, patchedMenuContent, 'utf-8');
            console.log(`[修改] 菜单汉化注入成功！`);
        } else {
            console.warn(`[警告] 未能在 menu.js 中找到设定的插入点。`);
        }
    }

    // 3.2 注入 tray.js (任务栏右键菜单汉化)
    const trayPath = path.join(tempDir, "dist", "tray.js");
    if (fs.existsSync(trayPath)) {
        console.log(`[修改] 正在向 tray.js 注入任务栏菜单汉化...`);
        let trayContent = fs.readFileSync(trayPath, 'utf-8');
        
        // 先清理已有的汉化块
        let trayCleaned = cleanTrayJsContent(trayContent);
        
        // 1. 注入 createTray 里的翻译块 (带标记)
        const targetCreate = "function createTray(actions) {";
        const replacementCreate = `function createTray(actions) {
    /* --- TRAY TRANSLATION START --- */
    const translations = {
        'No agents running': '无运行中的智能体',
        'Open Antigravity': '打开反重力智能编程',
        'Quit': '退出'
    };
    for (const item of actions) {
        if (translations[item.label]) {
            item.label = translations[item.label];
        }
    }
    /* --- TRAY TRANSLATION END --- */`;
        
        let trayPatched = trayCleaned.replace(targetCreate, replacementCreate);
        
        // 2. 使用正则替换 updateTrayAgentCount 里的动态显示文本
        const countRegex = /countItem\.label\s*=\s*\([\s\S]*?' running';/g;
        const replacementCount = "countItem.label = count > 0 ? `${count} 个智能体运行中` : '无运行中的智能体';";
        trayPatched = trayPatched.replace(countRegex, replacementCount);
        
        fs.writeFileSync(trayPath, trayPatched, 'utf-8');
        console.log(`[修改] 任务栏菜单汉化注入成功！`);
    }

    // 3.3 注入 loadingOverlay.js (加载页汉化)
    const loadingPath = path.join(tempDir, "dist", "loadingOverlay.js");
    if (fs.existsSync(loadingPath)) {
        console.log(`[修改] 正在向 loadingOverlay.js 注入加载页汉化...`);
        let loadingContent = fs.readFileSync(loadingPath, 'utf-8');
        
        const targetText = '<div class="text">Loading Antigravity</div>';
        const replacementText = '<div class="text">反重力引擎已启动，正在努力摆脱地心引力...</div>';
        
        loadingContent = loadingContent.replace(targetText, replacementText);
        
        fs.writeFileSync(loadingPath, loadingContent, 'utf-8');
        console.log(`[修改] 加载页汉化注入成功！`);
    }

    // 3.4 注入 updater.js (更新弹窗汉化)
    const updaterPath = path.join(tempDir, "dist", "updater.js");
    if (fs.existsSync(updaterPath)) {
        console.log(`[修改] 正在向 updater.js 注入更新弹窗汉化...`);
        let updaterContent = fs.readFileSync(updaterPath, 'utf-8');
        
        // 替换 Check for Updates 弹窗的属性
        const targetOptions = `                title: 'Check for Updates',
                message: 'No updates available',
                buttons: ['OK'],`;
        const replacementOptions = `                title: '检查更新',
                message: '暂无可用更新',
                buttons: ['确定'],`;
        
        updaterContent = updaterContent.replace(targetOptions, replacementOptions);
        fs.writeFileSync(updaterPath, updaterContent, 'utf-8');
        console.log(`[修改] 更新弹窗汉化注入成功！`);
    }

    // 4. 重新打包
    console.log(`[打包] 正在将修改后的内容打包回 app.asar...`);
    const packRes = runCommandSync(`npx -y @electron/asar pack "${tempDir}" "${asarPath}"`);
    
    // 5. 清理临时文件夹
    fs.rmSync(tempDir, { recursive: true, force: true });

    if (!packRes.success) {
        console.error(`[错误] 打包失败。`);
        console.error(`详情: ${packRes.stderr}\n${packRes.stdout}`);
        return false;
    }

    console.log(`[√] Antigravity 2.0 汉化部署完成！`);
    return true;
}

function restore20(resourcesDir) {
    const asarPath = path.join(resourcesDir, "app.asar");
    const bakPath = path.join(resourcesDir, "app.asar.bak");

    if (!fs.existsSync(bakPath)) {
        console.log("[!] 未找到备份文件 app.asar.bak，可能尚未安装过汉化或备份被删除。");
        return false;
    }

    console.log("[还原] 正在用官方备份文件恢复...");
    fs.copyFileSync(bakPath, asarPath);
    fs.unlinkSync(bakPath);
    console.log("[√] 官方 app.asar 已成功恢复！");
    return true;
}

// ==========================================
// 入口
// ==========================================
function main() {
    let huifu = false;
    let manualDir = "";
    let noKill = false;

    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--huifu') {
            huifu = true;
        } else if (args[i] === '--install-dir') {
            manualDir = args[i + 1] || "";
            i++;
        } else if (args[i] === '--no-kill') {
            noKill = true;
        } else if (args[i] === '--brand-title') {
            i++;
        }
    }

    // 1. 探测路径
    const installDir = detectInstallationDir(manualDir);

    // 2. 找到 resources 资源目录
    let resourcesDir = "";
    if (fs.existsSync(path.join(installDir, "resources"))) {
        resourcesDir = path.join(installDir, "resources");
    } else if (fs.existsSync(path.join(installDir, "Contents", "Resources"))) {
        resourcesDir = path.join(installDir, "Contents", "Resources");
    } else if (installDir.replace(/\/$/, "").toLowerCase().endsWith("/resources")) {
        resourcesDir = installDir;
    } else if (fs.existsSync(path.join(installDir, "app.asar"))) {
        resourcesDir = installDir;
    } else {
        resourcesDir = path.join(installDir, "resources");
    }

    if (!fs.existsSync(resourcesDir)) {
        console.error(`[错误] 无法定位有效的资源(resources)目录: ${resourcesDir}`);
        process.exit(1);
    }

    // 3. 在关闭客户端前先检查权限，避免失败时无谓关闭用户正在使用的客户端。
    if (!canWriteAntigravityResources(resourcesDir, huifu ? 'uninstall.sh' : 'install.sh')) {
        process.exit(1);
    }

    // 4. 检测客户端是否正在运行，并根据参数决定是否关闭以解除文件锁定
    wasAppRunning = checkIfAppIsRunning();
    if (noKill) {
        console.log("[跳过] 检测到 --no-kill 参数，跳过关闭 Antigravity 运行进程。");
    } else {
        closeAntigravityProcesses();
    }

    // 5. 执行汉化或还原
    let success = false;
    if (huifu) {
        console.log("====== 正在卸载中文汉化，恢复官方原版 ======");
        success = restore20(resourcesDir);
    } else {
        console.log("====== 正在安装 Antigravity 中文汉化 ======");
        success = install20(resourcesDir);
    }

    if (!success) {
        process.exit(1);
    }

    // 6. 校验通过且原来客户端在运行，则自动重新启动客户端
    if (success && wasAppRunning) {
        console.log("\n[启动] 检测到安装前反重力客户端处于开启状态，正在重新启动客户端...");
        try {
            let launched = false;
            if (process.platform === 'win32') {
                const exePath = path.join(installDir, 'Antigravity.exe');
                if (fs.existsSync(exePath)) {
                    const child = child_process.spawn(exePath, [], { detached: true, stdio: 'ignore' });
                    child.unref();
                    console.log("[启动] 客户端启动成功！");
                    launched = true;
                }
            } else {
                const exeCandidates = [
                    path.join(installDir, 'antigravity'),
                    path.join(installDir, 'Antigravity'),
                    path.join(installDir, 'bin', 'antigravity'),
                ];
                for (const exePath of exeCandidates) {
                    if (fs.existsSync(exePath)) {
                        const child = child_process.spawn(exePath, [], { detached: true, stdio: 'ignore' });
                        child.unref();
                        console.log("[启动] 客户端启动成功！");
                        launched = true;
                        break;
                    }
                }
                if (!launched) {
                    try {
                        const whichOut = child_process.execSync('which antigravity 2>/dev/null || which Antigravity 2>/dev/null', { encoding: 'utf-8' }).trim();
                        if (whichOut) {
                            const child = child_process.spawn(whichOut, [], { detached: true, stdio: 'ignore' });
                            child.unref();
                            console.log("[启动] 客户端启动成功！");
                            launched = true;
                        }
                    } catch (e) {}
                }
            }
            if (!launched) {
                console.warn("[警告] 未找到客户端可执行文件，请手动启动 Antigravity。");
            }
        } catch (e) {
            console.warn(`[警告] 客户端启动失败: ${e.message}`);
        }
    }
}

main();
