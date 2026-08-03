import { exec } from 'child_process';
import { readFileSync } from 'fs';
import { isAbsolute, join, relative, resolve } from 'path';

type TabName = 'tab-1' | 'tab-2';
const STORAGE_KEY = 'gcore-framework.luban-tool.state';

interface LubanToolState {
    activeTab: TabName;
    cfgConfFile: string;
    cfgCodeDir: string;
    cfgDataDir: string;
    langConfFile: string;
    langCodeDir: string;
    langDataDirZh: string;
    langDataDirEn: string;
}

const DEFAULT_STATE: LubanToolState = {
    activeTab: 'tab-1',
    cfgConfFile: 'design/配置/配置表/luban.conf',
    cfgCodeDir: 'assets/scripts/config/base',
    cfgDataDir: 'assets/resources/config',
    langConfFile: 'design/配置/多语言/luban.conf',
    langCodeDir: 'assets/scripts/localization/base',
    langDataDirZh: 'assets/language/pack-zh-Hans',
    langDataDirEn: 'assets/language/pack-en',
};

function getWorkspacePath(): string {
    const editor = (globalThis as any).Editor;
    if (editor && editor.Project && editor.Project.path) {
        return editor.Project.path;
    }
    return resolve(__dirname, '../../../../');
}

function normalizePathForStorage(inputPath: string, workspace: string): string {
    if (!inputPath) return '';
    const cleanPath = inputPath.trim();
    if (isAbsolute(cleanPath) && cleanPath.startsWith(workspace)) {
        return relative(workspace, cleanPath).replace(/\\/g, '/');
    }
    return cleanPath.replace(/\\/g, '/');
}

function resolvePathForExec(inputPath: string, workspace: string): string {
    const cleanPath = inputPath.trim();
    if (isAbsolute(cleanPath)) {
        return cleanPath;
    }
    return join(workspace, cleanPath);
}

function loadState(): LubanToolState {
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<LubanToolState>;
                return {
                    activeTab: parsed.activeTab === 'tab-2' ? 'tab-2' : 'tab-1',
                    cfgConfFile: parsed.cfgConfFile ?? DEFAULT_STATE.cfgConfFile,
                    cfgCodeDir: parsed.cfgCodeDir ?? DEFAULT_STATE.cfgCodeDir,
                    cfgDataDir: parsed.cfgDataDir ?? DEFAULT_STATE.cfgDataDir,
                    langConfFile: parsed.langConfFile ?? DEFAULT_STATE.langConfFile,
                    langCodeDir: parsed.langCodeDir ?? DEFAULT_STATE.langCodeDir,
                    langDataDirZh: parsed.langDataDirZh ?? DEFAULT_STATE.langDataDirZh,
                    langDataDirEn: parsed.langDataDirEn ?? DEFAULT_STATE.langDataDirEn,
                };
            }
        }
    } catch (e) {
        console.warn('[gcore-luban] load state failed', e);
    }
    return { ...DEFAULT_STATE };
}

function saveState(patch: Partial<LubanToolState>) {
    const current = loadState();
    const next = { ...current, ...patch };
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
    } catch (e) {
        console.warn('[gcore-luban] save state failed', e);
    }
}

function escapeHtml(s: string): string {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function queryElement<T extends HTMLElement = HTMLElement>(panel: any, selector: string): T | null {
    if (!panel) return null;

    // 1. Check shadowRoot
    if (panel.shadowRoot && typeof panel.shadowRoot.querySelector === 'function') {
        const found = panel.shadowRoot.querySelector(selector);
        if (found) return found as T;
    }

    // 2. Check panel.root
    if (panel.root && typeof panel.root.querySelector === 'function') {
        const found = panel.root.querySelector(selector);
        if (found) return found as T;
    }

    // 3. Check parent container of tabContent/tabHeader
    const rootContainer =
        (panel.$ && panel.$.tabContent && panel.$.tabContent.parentElement) ||
        (panel.$ && panel.$.tabHeader && panel.$.tabHeader.parentElement);

    if (rootContainer && typeof rootContainer.querySelector === 'function') {
        const found = rootContainer.querySelector(selector);
        if (found) return found as T;
    }

    // 4. Search within $ elements
    if (panel.$) {
        for (const k of Object.keys(panel.$)) {
            const el = panel.$[k];
            if (el && typeof el.querySelector === 'function') {
                const found = el.querySelector(selector);
                if (found) return found as T;
            }
        }
    }

    // 5. Check direct querySelector
    if (typeof panel.querySelector === 'function') {
        const found = panel.querySelector(selector);
        if (found) return found as T;
    }

    return null;
}

function setupTabSwitcher(panel: any, initialTab: TabName = 'tab-1') {
    const tabHeader = (panel.$ && panel.$.tabHeader) || queryElement(panel, '.tab-header');
    if (!tabHeader) return;

    const tabButtons = tabHeader.querySelectorAll('.tab-btn');
    const tabContent = (panel.$ && panel.$.tabContent) || queryElement(panel, '.tab-content');
    const tabPanes = tabContent ? tabContent.querySelectorAll('.tab-pane') : [];

    const activateTab = (tabId: TabName) => {
        tabButtons.forEach((button: HTMLElement) => button.classList.remove('active'));
        tabPanes.forEach((pane: HTMLElement) => pane.classList.remove('active'));

        const activeButton = tabHeader.querySelector(`.tab-btn[data-tab="${tabId}"]`) as HTMLElement | null;
        const activePane = tabContent ? (tabContent.querySelector(`#${tabId}`) as HTMLElement | null) : null;

        activeButton?.classList.add('active');
        activePane?.classList.add('active');
    };

    tabButtons.forEach((button: HTMLElement) => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab') as TabName | null;
            if (!tabId || (tabId !== 'tab-1' && tabId !== 'tab-2')) {
                return;
            }
            activateTab(tabId);
            saveState({ activeTab: tabId });
        });
    });

    activateTab(initialTab);
}

function initLubanTools(panel: any) {
    const workspace = getWorkspacePath();
    const state = loadState();

    // Elements
    const statusArea = (panel.$ && panel.$.statusArea) || queryElement<HTMLElement>(panel, '#status-area');

    // Tab 1 Elements
    const cfgConfFileInp = (panel.$ && panel.$.cfgConfFile) || queryElement<HTMLInputElement>(panel, '#cfg-conf-file');
    const cfgConfBtn = (panel.$ && panel.$.cfgConfBtn) || queryElement<HTMLButtonElement>(panel, '#cfg-conf-btn');
    const cfgCodeDirInp = (panel.$ && panel.$.cfgCodeDir) || queryElement<HTMLInputElement>(panel, '#cfg-code-dir');
    const cfgCodeBtn = (panel.$ && panel.$.cfgCodeBtn) || queryElement<HTMLButtonElement>(panel, '#cfg-code-btn');
    const cfgDataDirInp = (panel.$ && panel.$.cfgDataDir) || queryElement<HTMLInputElement>(panel, '#cfg-data-dir');
    const cfgDataBtn = (panel.$ && panel.$.cfgDataBtn) || queryElement<HTMLButtonElement>(panel, '#cfg-data-btn');
    const genCfgBtn = (panel.$ && panel.$.genCfgBtn) || queryElement<HTMLButtonElement>(panel, '#gen-cfg-btn');

    // Tab 2 Elements
    const langConfFileInp = (panel.$ && panel.$.langConfFile) || queryElement<HTMLInputElement>(panel, '#lang-conf-file');
    const langConfBtn = (panel.$ && panel.$.langConfBtn) || queryElement<HTMLButtonElement>(panel, '#lang-conf-btn');
    const langCodeDirInp = (panel.$ && panel.$.langCodeDir) || queryElement<HTMLInputElement>(panel, '#lang-code-dir');
    const langCodeBtn = (panel.$ && panel.$.langCodeBtn) || queryElement<HTMLButtonElement>(panel, '#lang-code-btn');
    const langDataZhInp = (panel.$ && panel.$.langDataZh) || queryElement<HTMLInputElement>(panel, '#lang-data-zh');
    const langDataZhBtn = (panel.$ && panel.$.langDataZhBtn) || queryElement<HTMLButtonElement>(panel, '#lang-data-zh-btn');
    const langDataEnInp = (panel.$ && panel.$.langDataEn) || queryElement<HTMLInputElement>(panel, '#lang-data-en');
    const langDataEnBtn = (panel.$ && panel.$.langDataEnBtn) || queryElement<HTMLButtonElement>(panel, '#lang-data-en-btn');
    const genLangBtn = (panel.$ && panel.$.genLangBtn) || queryElement<HTMLButtonElement>(panel, '#gen-lang-btn');
    const genLangZhBtn = (panel.$ && panel.$.genLangZhBtn) || queryElement<HTMLButtonElement>(panel, '#gen-lang-zh-btn');
    const genLangEnBtn = (panel.$ && panel.$.genLangEnBtn) || queryElement<HTMLButtonElement>(panel, '#gen-lang-en-btn');

    const clearLogBtn = (panel.$ && panel.$.clearLogBtn) || queryElement<HTMLButtonElement>(panel, '#clear-log-btn');

    // Logging helper
    const appendLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
        const targetArea = (panel.$ && panel.$.statusArea) || statusArea || queryElement<HTMLElement>(panel, '#status-area');
        if (targetArea) {
            const cls = type === 'error' ? 'status-error' : type === 'success' ? 'status-success' : 'status-info';
            targetArea.innerHTML += `<div class="${cls}">${escapeHtml(msg)}</div>`;
            targetArea.scrollTop = targetArea.scrollHeight;
        }
    };

    const clearLog = () => {
        const targetArea = (panel.$ && panel.$.statusArea) || statusArea || queryElement<HTMLElement>(panel, '#status-area');
        if (targetArea) {
            targetArea.textContent = '';
        }
    };

    // Apply saved state to inputs
    if (cfgConfFileInp) cfgConfFileInp.value = state.cfgConfFile;
    if (cfgCodeDirInp) cfgCodeDirInp.value = state.cfgCodeDir;
    if (cfgDataDirInp) cfgDataDirInp.value = state.cfgDataDir;

    if (langConfFileInp) langConfFileInp.value = state.langConfFile;
    if (langCodeDirInp) langCodeDirInp.value = state.langCodeDir;
    if (langDataZhInp) langDataZhInp.value = state.langDataDirZh;
    if (langDataEnInp) langDataEnInp.value = state.langDataDirEn;

    // Save change listeners
    const bindInputChange = (inp: HTMLInputElement | null, stateKey: keyof LubanToolState) => {
        if (!inp) return;
        inp.addEventListener('input', () => {
            const pathVal = normalizePathForStorage(inp.value, workspace);
            saveState({ [stateKey]: pathVal });
        });
    };

    bindInputChange(cfgConfFileInp, 'cfgConfFile');
    bindInputChange(cfgCodeDirInp, 'cfgCodeDir');
    bindInputChange(cfgDataDirInp, 'cfgDataDir');
    bindInputChange(langConfFileInp, 'langConfFile');
    bindInputChange(langCodeDirInp, 'langCodeDir');
    bindInputChange(langDataZhInp, 'langDataDirZh');
    bindInputChange(langDataEnInp, 'langDataDirEn');

    // Dialog picker helpers
    const pickPath = async (title: string, defaultPath: string, type: 'file' | 'directory'): Promise<string> => {
        const editor = (globalThis as any).Editor;
        if (!editor?.Dialog?.select) {
            throw new Error('Editor.Dialog.select 不可用');
        }

        const resolvedDefault = resolvePathForExec(defaultPath || '', workspace);
        const options: any = {
            title,
            type,
            path: resolvedDefault || undefined,
            button: '选择',
            multi: false,
        };

        if (type === 'file') {
            options.filters = [{ name: 'Luban Conf', extensions: ['conf', 'json'] }];
        }

        const result = await editor.Dialog.select(options);
        if (!result || result.canceled || !result.filePaths || result.filePaths.length === 0) {
            return '';
        }

        return result.filePaths[0] as string;
    };

    const bindPickerBtn = (
        btn: HTMLButtonElement | null,
        inp: HTMLInputElement | null,
        title: string,
        type: 'file' | 'directory',
        stateKey: keyof LubanToolState
    ) => {
        if (!btn || !inp) return;
        btn.addEventListener('click', async () => {
            try {
                const picked = await pickPath(title, inp.value.trim(), type);
                if (picked) {
                    const normalized = normalizePathForStorage(picked, workspace);
                    inp.value = normalized;
                    saveState({ [stateKey]: normalized });
                    appendLog(`已选择: ${normalized}`);
                }
            } catch (e) {
                appendLog(`选择路径失败: ${(e as any)?.message ?? String(e)}`, 'error');
            }
        });
    };

    bindPickerBtn(cfgConfBtn, cfgConfFileInp, '选择配置表 luban.conf 文件', 'file', 'cfgConfFile');
    bindPickerBtn(cfgCodeBtn, cfgCodeDirInp, '选择代码输出文件夹', 'directory', 'cfgCodeDir');
    bindPickerBtn(cfgDataBtn, cfgDataDirInp, '选择数据输出文件夹', 'directory', 'cfgDataDir');

    bindPickerBtn(langConfBtn, langConfFileInp, '选择多语言 luban.conf 文件', 'file', 'langConfFile');
    bindPickerBtn(langCodeBtn, langCodeDirInp, '选择多语言代码输出文件夹', 'directory', 'langCodeDir');
    bindPickerBtn(langDataZhBtn, langDataZhInp, '选择中文数据输出文件夹', 'directory', 'langDataDirZh');
    bindPickerBtn(langDataEnBtn, langDataEnInp, '选择英文数据输出文件夹', 'directory', 'langDataDirEn');

    const setButtonsDisabled = (disabled: boolean) => {
        const buttons = [genCfgBtn, genLangBtn, genLangZhBtn, genLangEnBtn];
        buttons.forEach((b) => {
            if (b) b.disabled = disabled;
        });
    };

    const runLubanCmd = (confFile: string, target: string, outputCodeDir: string, outputDataDir: string): Promise<boolean> => {
        return new Promise((resolvePromise) => {
            const lubanDll = join(workspace, 'extensions/gcore-framework/tools/luban/Luban.dll');
            const confPath = resolvePathForExec(confFile, workspace);
            const codePath = resolvePathForExec(outputCodeDir, workspace);
            const dataPath = resolvePathForExec(outputDataDir, workspace);

            const command = `dotnet "${lubanDll}" -t ${target} -c typescript-bin -d bin --conf "${confPath}" -x outputCodeDir="${codePath}" -x outputDataDir="${dataPath}" -x tableImporter.tableNameFormat={0}Tbl -x tableImporter.valueTypeNameFormat={0}Cfg -x bin.fileExt=bin`;

            appendLog(`执行 Luban 转表命令 [target=${target}]...`);
            appendLog(`Command: ${command}`);

            exec(command, { cwd: workspace }, (error, stdout, stderr) => {
                if (stdout) {
                    appendLog(stdout.trim());
                }
                if (stderr) {
                    appendLog(stderr.trim(), 'error');
                }
                if (error) {
                    appendLog(`转表执行失败: ${error.message}`, 'error');
                    resolvePromise(false);
                } else {
                    appendLog(`[${target}] 转表完成！`, 'success');
                    resolvePromise(true);
                }
            });
        });
    };

    // Actions
    if (genCfgBtn) {
        genCfgBtn.addEventListener('click', async () => {
            const curState = loadState();
            setButtonsDisabled(true);
            try {
                appendLog('=== 开始导出配置表 ===');
                await runLubanCmd(curState.cfgConfFile, 'client', curState.cfgCodeDir, curState.cfgDataDir);
            } finally {
                setButtonsDisabled(false);
            }
        });
    }

    if (genLangZhBtn) {
        genLangZhBtn.addEventListener('click', async () => {
            const curState = loadState();
            setButtonsDisabled(true);
            try {
                appendLog('=== 开始导出中文多语言 (zh-Hans) ===');
                await runLubanCmd(curState.langConfFile, 'zh-Hans', curState.langCodeDir, curState.langDataDirZh);
            } finally {
                setButtonsDisabled(false);
            }
        });
    }

    if (genLangEnBtn) {
        genLangEnBtn.addEventListener('click', async () => {
            const curState = loadState();
            setButtonsDisabled(true);
            try {
                appendLog('=== 开始导出英文多语言 (en) ===');
                await runLubanCmd(curState.langConfFile, 'en', curState.langCodeDir, curState.langDataDirEn);
            } finally {
                setButtonsDisabled(false);
            }
        });
    }

    if (genLangBtn) {
        genLangBtn.addEventListener('click', async () => {
            const curState = loadState();
            setButtonsDisabled(true);
            try {
                appendLog('=== 开始全量导出多语言包 ===');
                const zhOk = await runLubanCmd(curState.langConfFile, 'zh-Hans', curState.langCodeDir, curState.langDataDirZh);
                if (zhOk) {
                    await runLubanCmd(curState.langConfFile, 'en', curState.langCodeDir, curState.langDataDirEn);
                }
            } finally {
                setButtonsDisabled(false);
            }
        });
    }

    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', clearLog);
    }

    setupTabSwitcher(panel, state.activeTab);
}

module.exports = Editor.Panel.define({
    listeners: {
        show() {
            console.log('[gcore-panel]: show');
        },
        hide() {
            console.log('[gcore-panel]: hide');
        },
    },
    template: readFileSync(join(__dirname, '../../../static/template/default/index.html'), 'utf-8'),
    style: readFileSync(join(__dirname, '../../../static/style/default/index.css'), 'utf-8'),
    $: {
        tabHeader: '.tab-header',
        tabContent: '.tab-content',
        statusArea: '#status-area',
        clearLogBtn: '#clear-log-btn',
        cfgConfFile: '#cfg-conf-file',
        cfgConfBtn: '#cfg-conf-btn',
        cfgCodeDir: '#cfg-code-dir',
        cfgCodeBtn: '#cfg-code-btn',
        cfgDataDir: '#cfg-data-dir',
        cfgDataBtn: '#cfg-data-btn',
        genCfgBtn: '#gen-cfg-btn',
        langConfFile: '#lang-conf-file',
        langConfBtn: '#lang-conf-btn',
        langCodeDir: '#lang-code-dir',
        langCodeBtn: '#lang-code-btn',
        langDataZh: '#lang-data-zh',
        langDataZhBtn: '#lang-data-zh-btn',
        langDataEn: '#lang-data-en',
        langDataEnBtn: '#lang-data-en-btn',
        genLangBtn: '#gen-lang-btn',
        genLangZhBtn: '#gen-lang-zh-btn',
        genLangEnBtn: '#gen-lang-en-btn',
    },
    methods: {
        hello() {
            console.log('[gcore-panel]: hello');
        },
    },
    ready() {
        try {
            initLubanTools(this);
        } catch (e) {
            console.error('initLubanTools error', e);
        }
    },
    beforeClose() {},
    close() {
        console.log('[gcore-panel]: closed');
    },
});
