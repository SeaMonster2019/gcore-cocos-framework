/**
 * @file main.ts
 * @description gcore-framework 扩展主进程入口文件
 * 负责扩展加载生命周期管理，并在编辑器启动时自动初始化多语言数据查询与 IPC 通信服务
 */

// @ts-ignore
import packageJSON from '../package.json';
import { I18nDataMgr } from './panels/default/common/i18n-data-mgr';
import { StorageMgr } from './panels/default/common/storage-mgr';

/**
 * 扩展主进程消息暴露接口
 */
export const methods: { [key: string]: (...any: any) => any } = {
    /** 打开工具面板 */
    openPanel() {
        Editor.Panel.open(packageJSON.name);
    },

    /** 通过 IPC 消息查询多语言实时文本 */
    queryI18nText(key: string, fallback?: string, lang?: string): string {
        const workspace = Editor.Project.path;
        return I18nDataMgr.getText(workspace, key, fallback, lang);
    },

    /** 通过 IPC 消息获取全量多语言字典 */
    queryI18nAll(lang?: string): Record<string, string> {
        const workspace = Editor.Project.path;
        return I18nDataMgr.getAllTexts(workspace, lang);
    },

    /** 设置预览语言 */
    setPreviewLang(previewLang: string) {
        const workspace = Editor.Project.path;
        StorageMgr.saveState({ previewLang }, workspace);
        I18nDataMgr.setPreviewLang(previewLang);
    },

    /** 重新加载多语言 CSV 数据 */
    reloadCsvData() {
        const workspace = Editor.Project.path;
        I18nDataMgr.loadCsvData(workspace, (msg, level) => console.log(`[gcore I18n] [${level || 'info'}] ${msg}`));
    },
};

/**
 * 编辑器启动 / 扩展加载时触发
 * 自动装载多语言 CSV 数据，为场景与组件提供高效的 IPC 查询服务
 */
export function load() {
    try {
        const workspace = Editor.Project.path;
        const state = StorageMgr.loadState(workspace);

        console.log('[gcore-framework] 编辑器已启动，自动加载多语言数据（支持编辑器实时 IPC 预览）...');
        I18nDataMgr.setPreviewLang(state.previewLang || 'zh-Hans');
        I18nDataMgr.loadCsvData(workspace, (msg, level) => console.log(`[gcore I18n] [${level || 'info'}] ${msg}`));
    } catch (e) {
        console.error('[gcore-framework] 自动加载多语言数据失败:', e);
    }
}

/**
 * 卸载扩展 / 编辑器关闭时触发
 */
export function unload() {}
