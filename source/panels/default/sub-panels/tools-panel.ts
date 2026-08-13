/**
 * @file tools-panel.ts
 * @description 小工具集合分面板控制器，处理 .meta 无效文件清理与预制体/场景 JSON 文件字体批量修改
 */

import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { extname, join, relative } from 'path';
import { bindPickerBtn, queryElement } from '../common/dom-util';
import { normalizePathForStorage } from '../common/path-util';
import { StorageMgr } from '../common/storage-mgr';
import { PanelContext } from '../common/types';

export class ToolsPanel {
    private context: PanelContext;

    // 工具 1：.meta 清理控制节点
    private metaCleanDirInp: HTMLInputElement | null = null;
    private metaCleanDirBtn: HTMLButtonElement | null = null;
    private cleanMetaBtn: HTMLButtonElement | null = null;

    // 工具 2：字体替换控制节点
    private fontFilePathInp: HTMLInputElement | null = null;
    private fontFileBtn: HTMLButtonElement | null = null;

    private fontTargetLocInp: HTMLInputElement | null = null;
    private fontTargetCurrentBtn: HTMLButtonElement | null = null;
    private fontTargetFileBtn: HTMLButtonElement | null = null;
    private fontTargetDirBtn: HTMLButtonElement | null = null;

    private replaceFontBtn: HTMLButtonElement | null = null;

    constructor(context: PanelContext) {
        this.context = context;
    }

    /**
     * 初始化小工具分面板节点与事件监听
     */
    public init(): void {
        const { panel, workspace, appendLog, setAllButtonsDisabled } = this.context;
        const state = StorageMgr.loadState(workspace);

        // 检索 DOM 节点
        this.metaCleanDirInp = (panel.$ && panel.$.metaCleanDir) || queryElement<HTMLInputElement>(panel, '#meta-clean-dir');
        this.metaCleanDirBtn = (panel.$ && panel.$.metaCleanDirBtn) || queryElement<HTMLButtonElement>(panel, '#meta-clean-dir-btn');
        this.cleanMetaBtn = (panel.$ && panel.$.cleanMetaBtn) || queryElement<HTMLButtonElement>(panel, '#clean-meta-btn');

        this.fontFilePathInp = (panel.$ && panel.$.fontFilePath) || queryElement<HTMLInputElement>(panel, '#font-file-path');
        this.fontFileBtn = (panel.$ && panel.$.fontFileBtn) || queryElement<HTMLButtonElement>(panel, '#font-file-btn');

        this.fontTargetLocInp = (panel.$ && panel.$.fontTargetLoc) || queryElement<HTMLInputElement>(panel, '#font-target-loc');
        this.fontTargetCurrentBtn = (panel.$ && panel.$.fontTargetCurrentBtn) || queryElement<HTMLButtonElement>(panel, '#font-target-current-btn');
        this.fontTargetFileBtn = (panel.$ && panel.$.fontTargetFileBtn) || queryElement<HTMLButtonElement>(panel, '#font-target-file-btn');
        this.fontTargetDirBtn = (panel.$ && panel.$.fontTargetDirBtn) || queryElement<HTMLButtonElement>(panel, '#font-target-dir-btn');

        this.replaceFontBtn = (panel.$ && panel.$.replaceFontBtn) || queryElement<HTMLButtonElement>(panel, '#replace-font-btn');

        // 应用初始状态
        if (this.metaCleanDirInp) this.metaCleanDirInp.value = state.metaCleanDir;
        if (this.fontFilePathInp) this.fontFilePathInp.value = state.fontFilePath;
        if (this.fontTargetLocInp) this.fontTargetLocInp.value = state.fontTargetLocation || 'assets';

        // 绑定手动输入事件
        if (this.metaCleanDirInp) {
            this.metaCleanDirInp.addEventListener('input', () => {
                const val = normalizePathForStorage(this.metaCleanDirInp!.value, workspace);
                StorageMgr.saveState({ metaCleanDir: val }, workspace);
            });
        }

        if (this.fontFilePathInp) {
            this.fontFilePathInp.addEventListener('input', () => {
                const val = normalizePathForStorage(this.fontFilePathInp!.value, workspace);
                StorageMgr.saveState({ fontFilePath: val }, workspace);
            });
        }

        if (this.fontTargetLocInp) {
            this.fontTargetLocInp.addEventListener('input', () => {
                const val = normalizePathForStorage(this.fontTargetLocInp!.value, workspace);
                StorageMgr.saveState({ fontTargetLocation: val }, workspace);
            });
        }

        // 绑定文件夹选择器：.meta 清理目标目录
        bindPickerBtn(
            this.metaCleanDirBtn,
            this.metaCleanDirInp,
            '选择需要清理 .meta 文件的目标文件夹',
            'directory',
            workspace,
            (val) => StorageMgr.saveState({ metaCleanDir: val }, workspace),
            appendLog
        );

        // 绑定文件选择器：字体替换资源文件
        bindPickerBtn(
            this.fontFileBtn,
            this.fontFilePathInp,
            '选择目标字体资源文件 (.ttf / .otf / .fnt)',
            'file',
            workspace,
            (val) => StorageMgr.saveState({ fontFilePath: val }, workspace),
            appendLog,
            [
                { name: 'Font Files (*.ttf, *.otf, *.fnt)', extensions: ['ttf', 'otf', 'fnt', 'font', 'TTF', 'OTF', 'FNT'] },
                { name: 'All Files (*.*)', extensions: ['*'] },
            ]
        );

        // 绑定“选中当前打开”按钮
        if (this.fontTargetCurrentBtn) {
            this.fontTargetCurrentBtn.addEventListener('click', async () => {
                setAllButtonsDisabled(true);
                try {
                    await this.selectCurrentEditingAsset();
                } finally {
                    setAllButtonsDisabled(false);
                }
            });
        }

        // 绑定文件选择器：字体替换目标预制体/场景文件
        bindPickerBtn(
            this.fontTargetFileBtn,
            this.fontTargetLocInp,
            '选择目标预制体或场景文件 (.prefab / .scene)',
            'file',
            workspace,
            (val) => StorageMgr.saveState({ fontTargetLocation: val }, workspace),
            appendLog,
            [
                { name: 'Prefab / Scene (*.prefab, *.scene)', extensions: ['prefab', 'scene', 'PREFAB', 'SCENE'] },
                { name: 'All Files (*.*)', extensions: ['*'] },
            ]
        );

        // 绑定文件夹选择器：字体替换目标文件夹
        bindPickerBtn(
            this.fontTargetDirBtn,
            this.fontTargetLocInp,
            '选择包含预制体或场景的目标文件夹',
            'directory',
            workspace,
            (val) => StorageMgr.saveState({ fontTargetLocation: val }, workspace),
            appendLog
        );

        // 绑定工具 1 执行按钮：.meta 清理
        if (this.cleanMetaBtn) {
            this.cleanMetaBtn.addEventListener('click', () => {
                setAllButtonsDisabled(true);
                try {
                    this.executeMetaClean();
                } finally {
                    setAllButtonsDisabled(false);
                }
            });
        }

        // 绑定工具 2 执行按钮：字体替换
        if (this.replaceFontBtn) {
            this.replaceFontBtn.addEventListener('click', async () => {
                setAllButtonsDisabled(true);
                try {
                    await this.executeFontReplaceFiles();
                } finally {
                    setAllButtonsDisabled(false);
                }
            });
        }
    }

    /**
     * 工具 1：扫描并清理指定目录下找不到对应文件/文件夹的残留 .meta 文件
     */
    private executeMetaClean(): void {
        const { workspace, appendLog } = this.context;
        const state = StorageMgr.loadState(workspace);
        const targetDirRel = state.metaCleanDir || 'assets';
        const targetDirAbs = targetDirRel.startsWith(workspace) ? targetDirRel : join(workspace, targetDirRel);

        if (!existsSync(targetDirAbs)) {
            appendLog(`[.meta 清理失败] 目标目录不存在: ${targetDirRel}`, 'error');
            return;
        }

        appendLog(`=== 开始扫描并清理无效 .meta 文件 [${targetDirRel}] ===`, 'info');

        let scannedMetaCount = 0;
        let deletedMetaCount = 0;

        const scanAndClean = (currentDir: string) => {
            if (!existsSync(currentDir)) return;

            let entries: any[] = [];
            try {
                entries = readdirSync(currentDir, { withFileTypes: true });
            } catch (e) {
                return;
            }

            for (const entry of entries) {
                const fullPath = join(currentDir, entry.name.toString());

                if (entry.isDirectory()) {
                    scanAndClean(fullPath);
                }

                if (entry.isFile() && entry.name.toString().endsWith('.meta')) {
                    scannedMetaCount++;
                    const targetPath = fullPath.slice(0, -5);
                    if (!existsSync(targetPath)) {
                        try {
                            unlinkSync(fullPath);
                            deletedMetaCount++;
                            const relMetaPath = relative(workspace, fullPath);
                            appendLog(`[已清理] 删除残留无效 meta: ${relMetaPath}`, 'info');
                        } catch (err: any) {
                            appendLog(`[清理失败] 删除 ${fullPath} 异常: ${err?.message ?? String(err)}`, 'error');
                        }
                    }
                }
            }
        };

        scanAndClean(targetDirAbs);

        if (deletedMetaCount === 0) {
            appendLog(`扫描完成：共检索 ${scannedMetaCount} 个 .meta 文件，未发现任何残留无效的 .meta 文件。`, 'success');
        } else {
            appendLog(`=== 清理完成 === 共检索 ${scannedMetaCount} 个 .meta 文件，成功自动删除 ${deletedMetaCount} 个残留无效 .meta 文件！`, 'success');
        }
    }

    /**
     * 工具 2：直接解析并修改 .prefab / .scene 文件 JSON 结构批量替换字体
     */
    private async executeFontReplaceFiles(): Promise<void> {
        const { workspace, appendLog } = this.context;
        const state = StorageMgr.loadState(workspace);
        const fontPathRel = state.fontFilePath;
        const targetLocRel = state.fontTargetLocation || 'assets';

        if (!fontPathRel) {
            appendLog('请先选择目标字体资源文件 (.ttf / .otf / .fnt)。', 'error');
            return;
        }

        const normalizedFontPath = normalizePathForStorage(fontPathRel, workspace);
        const absFontPath = fontPathRel.startsWith(workspace) ? fontPathRel : join(workspace, normalizedFontPath);

        if (!existsSync(absFontPath)) {
            appendLog(`字体资源文件不存在: ${normalizedFontPath}`, 'error');
            return;
        }

        // 构建 Cocos Asset DB db:// 资源路径并查询 UUID
        let dbUrl = normalizedFontPath;
        if (!dbUrl.startsWith('db://')) {
            dbUrl = `db://${normalizedFontPath}`;
        }

        let fontUuid: string | null = null;
        let fontType = extname(normalizedFontPath).toLowerCase() === '.fnt' ? 'cc.BitmapFont' : 'cc.TTFFont';

        try {
            if (typeof Editor !== 'undefined' && Editor.Message && Editor.Message.request) {
                const info: any = await Editor.Message.request('asset-db', 'query-asset-info', dbUrl);
                if (info) {
                    fontUuid = info.uuid || null;
                    if (info.type === 'cc.BitmapFont') fontType = 'cc.BitmapFont';
                    else if (info.type === 'cc.TTFFont') fontType = 'cc.TTFFont';

                    if (info.subAssets && Object.keys(info.subAssets).length > 0) {
                        for (const key of Object.keys(info.subAssets)) {
                            const sub = info.subAssets[key];
                            if (sub && (sub.type === 'cc.BitmapFont' || sub.type === 'cc.TTFFont' || sub.type === 'cc.Font')) {
                                fontUuid = sub.uuid;
                                fontType = sub.type === 'cc.BitmapFont' ? 'cc.BitmapFont' : 'cc.TTFFont';
                                break;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[ToolsPanel] query-asset-info 尝试失败...', e);
        }

        if (!fontUuid) {
            try {
                if (typeof Editor !== 'undefined' && Editor.Message && Editor.Message.request) {
                    fontUuid = await Editor.Message.request('asset-db', 'query-uuid', dbUrl);
                    if (!fontUuid) {
                        fontUuid = await Editor.Message.request('asset-db', 'query-uuid', normalizedFontPath);
                    }
                }
            } catch (e) {}
        }

        if (!fontUuid) {
            appendLog(`无法获取字体文件 [${normalizedFontPath}] 的 Asset UUID。请确认文件位于项目 assets 目录内并由 Cocos 导入。`, 'error');
            return;
        }

        // 解析目标文件或文件夹
        const normalizedTargetLoc = normalizePathForStorage(targetLocRel, workspace);
        const absTargetLoc = targetLocRel.startsWith(workspace) ? targetLocRel : join(workspace, normalizedTargetLoc);

        if (!existsSync(absTargetLoc)) {
            appendLog(`目标预制体/场景位置不存在: ${normalizedTargetLoc}`, 'error');
            return;
        }

        const filesToProcess: string[] = [];
        const stat = statSync(absTargetLoc);

        if (stat.isFile()) {
            if (absTargetLoc.endsWith('.prefab') || absTargetLoc.endsWith('.scene')) {
                filesToProcess.push(absTargetLoc);
            } else {
                appendLog(`选中的文件不是 .prefab 或 .scene 预制体/场景文件: ${normalizedTargetLoc}`, 'error');
                return;
            }
        } else if (stat.isDirectory()) {
            const collectFiles = (dir: string) => {
                let entries: any[] = [];
                try {
                    entries = readdirSync(dir, { withFileTypes: true });
                } catch (e) {
                    return;
                }
                for (const entry of entries) {

                    const fullPath = join(dir, entry.name.toString());
                    if (entry.isDirectory()) {
                        collectFiles(fullPath);
                    } else if (entry.isFile()) {
                        const nameLower = entry.name.toString().toLowerCase();
                        if (nameLower.endsWith('.prefab') || nameLower.endsWith('.scene')) {
                            filesToProcess.push(fullPath);
                        }
                    }
                }
            };
            collectFiles(absTargetLoc);
        }

        if (filesToProcess.length === 0) {
            appendLog(`在 [${normalizedTargetLoc}] 中未找到任何 .prefab 或 .scene 文件。`, 'error');
            return;
        }

        appendLog(`=== 开始批量替换预制体/场景 JSON 字体结构 ===`, 'info');
        appendLog(`目标字体: ${normalizedFontPath} (UUID: ${fontUuid}, Type: ${fontType})`, 'info');
        appendLog(`扫描预制体/场景文件数量: ${filesToProcess.length}`, 'info');

        let totalModifiedFiles = 0;
        let totalReplacedComponents = 0;

        for (const filePath of filesToProcess) {
            let rawContent = '';
            try {
                rawContent = readFileSync(filePath, 'utf-8');
            } catch (e) {
                continue;
            }

            let jsonArray: any[];
            try {
                jsonArray = JSON.parse(rawContent);
            } catch (e) {
                continue;
            }

            if (!Array.isArray(jsonArray)) continue;

            // 递归构建节点全路径
            const getNodePath = (nodeId: number): string => {
                const parts: string[] = [];
                let currId = nodeId;
                const visited = new Set<number>();
                while (currId !== undefined && currId !== null && jsonArray[currId] && jsonArray[currId].__type__ === 'cc.Node' && !visited.has(currId)) {
                    visited.add(currId);
                    const nodeObj = jsonArray[currId];
                    if (nodeObj._name) {
                        parts.unshift(nodeObj._name);
                    }
                    if (nodeObj._parent && typeof nodeObj._parent.__id__ === 'number') {
                        currId = nodeObj._parent.__id__;
                    } else {
                        break;
                    }
                }
                return parts.join('/') || 'Node';
            };

            let fileReplacedCount = 0;
            const replacedNodeNames: string[] = [];

            for (let i = 0; i < jsonArray.length; i++) {
                const item = jsonArray[i];
                if (!item || typeof item !== 'object') continue;

                const typeName = item.__type__ || '';
                const isLabel = typeName === 'cc.Label';
                const isRichText = typeName === 'cc.RichText';
                const hasFontProp = '_font' in item || '_isSystemFontUsed' in item;

                if (isLabel || isRichText || hasFontProp) {
                    let changed = false;

                    const newFontObj = {
                        __uuid__: fontUuid,
                        __expectedType__: fontType,
                    };

                    if (JSON.stringify(item._font) !== JSON.stringify(newFontObj)) {
                        item._font = newFontObj;
                        changed = true;
                    }

                    if (isRichText || '_userDefinedFont' in item) {
                        if (JSON.stringify(item._userDefinedFont) !== JSON.stringify(newFontObj)) {
                            item._userDefinedFont = newFontObj;
                            changed = true;
                        }
                    }

                    if (item._isSystemFontUsed !== false) {
                        item._isSystemFontUsed = false;
                        changed = true;
                    }

                    if (changed) {
                        fileReplacedCount++;
                        if (item.node && typeof item.node.__id__ === 'number') {
                            replacedNodeNames.push(getNodePath(item.node.__id__));
                        }
                    }
                }
            }

            if (fileReplacedCount > 0) {
                totalModifiedFiles++;
                totalReplacedComponents += fileReplacedCount;
                const relFilePath = relative(workspace, filePath).replace(/\\/g, '/');

                try {
                    writeFileSync(filePath, JSON.stringify(jsonArray, null, 2), 'utf-8');
                    appendLog(`[已修改] ${relFilePath} (替换了 ${fileReplacedCount} 处组件字体)`, 'success');
                    appendLog(`  节点: ${replacedNodeNames.join(', ')}`, 'info');

                    // 尝试以安全方式通知 AssetDB 刷新单个资源（无需重启编辑器）
                    try {
                        if (typeof Editor !== 'undefined' && Editor.Message && Editor.Message.request) {
                            Editor.Message.request('asset-db', 'refresh-asset', `db://${relFilePath}`).catch(() => {});
                        }
                    } catch (e) {}
                } catch (err: any) {
                    appendLog(`[写入失败] 修改文件 ${relFilePath} 异常: ${err?.message ?? String(err)}`, 'error');
                }
            }
        }

        if (totalModifiedFiles === 0) {
            appendLog(`=== 替换完成 === 共检索 ${filesToProcess.length} 个文件，未发现需要更新的 Label / RichText 组件。`, 'info');
        } else {
            appendLog(`=== 替换完成 === 共扫描 ${filesToProcess.length} 个预制体/场景，成功修改 ${totalModifiedFiles} 个文件，累计替换了 ${totalReplacedComponents} 处文本组件字体！`, 'success');
        }
    }

    /**
     * 自动查询当前处于打开/编辑模式下的场景 (.scene) 或预制体 (.prefab) 路径并填入输入框
     */
    private async selectCurrentEditingAsset(): Promise<void> {
        const { workspace, appendLog } = this.context;
        appendLog('正在查询 Cocos 编辑器当前打开的场景/预制体文件...', 'info');

        let targetUuid: string | null = null;
        let diagInfo = '';

        // 1. 尝试从场景脚本获取当前打开的场景/预制体 UUID
        try {
            if (typeof Editor !== 'undefined' && Editor.Message && Editor.Message.request) {
                const res: any = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'gcore-framework',
                    method: 'getCurrentEditingAssetUuid',
                    args: [],
                });
                if (res && res.uuid) {
                    targetUuid = res.uuid;
                } else if (res && res.error) {
                    diagInfo = res.error;
                }
            }
        } catch (e: any) {
            console.warn('[ToolsPanel] 查询场景脚本当前编辑 UUID 异常:', e);
        }

        // 2. 机制 fallback：尝试从 Editor.Selection 获取在资源管理器中选中的 asset
        if (!targetUuid) {
            try {
                if (typeof Editor !== 'undefined' && Editor.Selection && typeof Editor.Selection.getSelected === 'function') {
                    const selectedAssets = Editor.Selection.getSelected('asset');
                    if (selectedAssets && selectedAssets.length > 0) {
                        for (const sUuid of selectedAssets) {
                            const info: any = await Editor.Message.request('asset-db', 'query-asset-info', sUuid);
                            if (info && info.url && (info.url.endsWith('.prefab') || info.url.endsWith('.scene'))) {
                                targetUuid = sUuid;
                                appendLog(`[自动感知] 检测到在资源管理器中选中了预制体/场景: ${info.url}`, 'info');
                                break;
                            }
                        }
                    }
                }
            } catch (e) {}
        }

        const applyUuidPath = async (uuid: string): Promise<boolean> => {
            try {
                let assetUrl = '';
                if (typeof Editor !== 'undefined' && Editor.Message && Editor.Message.request) {
                    const info: any = await Editor.Message.request('asset-db', 'query-asset-info', uuid);
                    if (info && info.url) {
                        assetUrl = info.url;
                    } else {
                        const urlRes = await Editor.Message.request('asset-db', 'query-url', uuid);
                        assetUrl = urlRes || '';
                    }
                }
                if (assetUrl) {
                    let cleanRel = assetUrl;
                    if (cleanRel.startsWith('db://')) {
                        cleanRel = cleanRel.substring(5);
                    }
                    cleanRel = normalizePathForStorage(cleanRel, workspace);
                    if (this.fontTargetLocInp) {
                        this.fontTargetLocInp.value = cleanRel;
                    }
                    StorageMgr.saveState({ fontTargetLocation: cleanRel }, workspace);
                    appendLog(`[定位成功] 已自动选中当前打开/选中的资源文件: ${cleanRel}`, 'success');
                    return true;
                }
            } catch (err: any) {
                console.warn('[ToolsPanel] 解析 UUID 资源路径失败:', err);
            }
            return false;
        };

        if (targetUuid) {
            const ok = await applyUuidPath(targetUuid);
            if (ok) return;
        }

        if (diagInfo) {
            appendLog(`[信息] 场景诊断提示: ${diagInfo}`, 'info');
        }
        appendLog('未能自动获取到当前打开的场景/预制体路径。请在资源管理器中单击选中目标 .prefab/.scene 文件，或使用“选择文件”按钮。', 'error');
    }
}
