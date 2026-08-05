/**
 * @file storage-mgr.ts
 * @description 本地持久化存储管理器，支持在面板渲染进程 (localStorage) 与主进程 (文件存储) 之间同步状态
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
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
     * 获取状态缓存文件路径
     */
    private static getFilePath(projectPath?: string): string | null {
        const root = projectPath || (typeof Editor !== 'undefined' && Editor.Project && Editor.Project.path ? Editor.Project.path : null);
        if (!root) return null;
        return join(root, 'temp', 'gcore-lang-state.json');
    }

    /**
     * 加载持久化状态
     * @param projectPath 可选项目根路径（主要用于主进程）
     * @returns LubanToolState 状态对象
     */
    public static loadState(projectPath?: string): LubanToolState {
        try {
            // 优先尝试从 localStorage 读取（面板渲染进程）
            if (typeof localStorage !== 'undefined') {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    return this.parseAndMergeState(JSON.parse(raw));
                }
            }

            // 若在主进程或 localStorage 无数据，尝试从 temp 状态文件读取
            const filePath = this.getFilePath(projectPath);
            if (filePath && existsSync(filePath)) {
                const raw = readFileSync(filePath, 'utf-8');
                if (raw) {
                    return this.parseAndMergeState(JSON.parse(raw));
                }
            }
        } catch (e) {
            console.warn('[StorageMgr] 加载本地状态失败:', e);
        }
        return { ...DEFAULT_STATE };
    }

    /**
     * 保存增量状态到 localStorage 及本地 temp 状态文件
     * @param patch 待更新的增量状态
     * @param projectPath 可选项目根路径
     */
    public static saveState(patch: Partial<LubanToolState>, projectPath?: string): void {
        const current = StorageMgr.loadState(projectPath);
        const next = { ...current, ...patch };
        const jsonStr = JSON.stringify(next, null, 2);

        try {
            // 保存到 localStorage（面板渲染进程）
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, jsonStr);
            }
        } catch (e) {
            console.warn('[StorageMgr] 保存 localStorage 状态失败:', e);
        }

        try {
            // 保存到本地文件（主进程与持久化共享）
            const filePath = this.getFilePath(projectPath);
            if (filePath) {
                const tempDir = join(filePath, '..');
                if (!existsSync(tempDir)) {
                    mkdirSync(tempDir, { recursive: true });
                }
                writeFileSync(filePath, jsonStr, 'utf-8');
            }
        } catch (e) {
            console.warn('[StorageMgr] 保存状态文件失败:', e);
        }
    }

    /**
     * 解析与合并增量状态
     */
    private static parseAndMergeState(parsed: Partial<LubanToolState>): LubanToolState {
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
            httpServerEnabled: false,
            httpServerPort: 8989,
            previewLang: parsed.previewLang ?? DEFAULT_STATE.previewLang,
        };
    }
}
