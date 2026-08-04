/**
 * @file storage-mgr.ts
 * @description 本地持久化存储管理器，负责 Luban 工具面板配置状态的读取与写入
 */

import { LubanToolState } from './types';

/** 本地存储 Key */
const STORAGE_KEY = 'gcore-framework.luban-tool.state';

/** 默认初始状态数据 */
export const DEFAULT_STATE: LubanToolState = {
    activeTab: 'tab-1',
    cfgConfFile: 'design/配置/配置表/luban.conf',
    cfgCodeDir: 'assets/scripts/config/base',
    cfgDataDir: 'assets/resources/config',
    langConfFile: 'design/配置/多语言/luban.conf',
    langCodeDir: 'assets/scripts/localization/base',
    languages: [
        { code: 'zh-Hans', name: '中文' },
        { code: 'en', name: '英文' },
    ],
    langDataDirs: {
        'zh-Hans': 'assets/language/pack-zh-Hans',
        'en': 'assets/language/pack-en',
    },
    httpServerEnabled: false,
    httpServerPort: 8989,
    previewLang: 'zh-Hans',
};

/**
 * 状态存储管理器类
 */
export class StorageMgr {
    /**
     * 从 localStorage 加载持久化状态
     * @returns LubanToolState 状态对象
     */
    public static loadState(): LubanToolState {
        try {
            if (typeof localStorage !== 'undefined') {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw) as Partial<LubanToolState>;
                    const langs = Array.isArray(parsed.languages) ? parsed.languages : DEFAULT_STATE.languages;
                    const langDirs = parsed.langDataDirs || { ...DEFAULT_STATE.langDataDirs };
                    return {
                        activeTab: parsed.activeTab === 'tab-2' ? 'tab-2' : 'tab-1',
                        cfgConfFile: parsed.cfgConfFile ?? DEFAULT_STATE.cfgConfFile,
                        cfgCodeDir: parsed.cfgCodeDir ?? DEFAULT_STATE.cfgCodeDir,
                        cfgDataDir: parsed.cfgDataDir ?? DEFAULT_STATE.cfgDataDir,
                        langConfFile: parsed.langConfFile ?? DEFAULT_STATE.langConfFile,
                        langCodeDir: parsed.langCodeDir ?? DEFAULT_STATE.langCodeDir,
                        languages: langs,
                        langDataDirs: langDirs,
                        httpServerEnabled: parsed.httpServerEnabled ?? DEFAULT_STATE.httpServerEnabled,
                        httpServerPort: parsed.httpServerPort ?? DEFAULT_STATE.httpServerPort,
                        previewLang: parsed.previewLang ?? DEFAULT_STATE.previewLang,
                    };
                }
            }
        } catch (e) {
            console.warn('[StorageMgr] 加载本地状态失败:', e);
        }
        return { ...DEFAULT_STATE };
    }

    /**
     * 保存增量状态到 localStorage
     * @param patch 待更新的增量状态
     */
    public static saveState(patch: Partial<LubanToolState>): void {
        const current = StorageMgr.loadState();
        const next = { ...current, ...patch };
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            }
        } catch (e) {
            console.warn('[StorageMgr] 保存本地状态失败:', e);
        }
    }
}
