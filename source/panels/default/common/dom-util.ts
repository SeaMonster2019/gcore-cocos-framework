/**
 * @file dom-util.ts
 * @description DOM 节点安全检索、面板弹窗交互与事件绑定工具库
 */

import { normalizePathForStorage, resolvePathForExec } from './path-util';

/**
 * 通用 DOM 元素查询工具函数，安全穿透 Shadow DOM 与 Cocos 扩展面板作用域
 * @param panel 面板实例
 * @param selector CSS 选择器
 * @returns 对应 HTML 元素或 null
 */
export function queryElement<T extends HTMLElement = HTMLElement>(panel: any, selector: string): T | null {
    if (!panel) return null;

    // 1. 尝试从 panel.shadowRoot 检索
    if (panel.shadowRoot && typeof panel.shadowRoot.querySelector === 'function') {
        const found = panel.shadowRoot.querySelector(selector);
        if (found) return found as T;
    }

    // 2. 尝试从 panel.root 检索
    if (panel.root && typeof panel.root.querySelector === 'function') {
        const found = panel.root.querySelector(selector);
        if (found) return found as T;
    }

    // 3. 尝试从 tabContent/tabHeader 的父级节点检索
    const rootContainer =
        (panel.$ && panel.$.tabContent && panel.$.tabContent.parentElement) ||
        (panel.$ && panel.$.tabHeader && panel.$.tabHeader.parentElement);

    if (rootContainer && typeof rootContainer.querySelector === 'function') {
        const found = rootContainer.querySelector(selector);
        if (found) return found as T;
    }

    // 4. 尝试从 panel.$ 定义的选择器对象中检索
    if (panel.$) {
        for (const k of Object.keys(panel.$)) {
            const el = panel.$[k];
            if (el && typeof el.querySelector === 'function') {
                const found = el.querySelector(selector);
                if (found) return found as T;
            }
        }
    }

    // 5. 尝试面板直接 querySelector
    if (typeof panel.querySelector === 'function') {
        const found = panel.querySelector(selector);
        if (found) return found as T;
    }

    return null;
}

export interface PickFilter {
    name: string;
    extensions: string[];
}

/**
 * 封装调用 Cocos 编辑器原生对话框选择文件/文件夹
 * @param title 对话框标题
 * @param defaultPath 默认路径
 * @param type 选择类型 ('file' | 'directory')
 * @param workspace 工作区根目录
 * @param filters 文件后缀名过滤器列表
 * @returns 选择的目标绝对路径，取消选择则返回空字符串
 */
export async function pickPath(
    title: string,
    defaultPath: string,
    type: 'file' | 'directory',
    workspace: string,
    filters?: PickFilter[]
): Promise<string> {
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
        if (filters && filters.length > 0) {
            options.filters = filters;
        } else {
            options.filters = [{ name: 'All Files', extensions: ['*'] }];
        }
    }

    const result = await editor.Dialog.select(options);
    if (!result || result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return '';
    }

    return result.filePaths[0] as string;
}

/**
 * 绑定选择路径按钮与输入框
 * @param btn 触发选择的按钮
 * @param inp 路径显示的输入框
 * @param title 弹窗标题
 * @param type 选择类型 ('file' | 'directory')
 * @param workspace 工作区根目录
 * @param onPick 选择完成回调函数
 * @param logger 日志打印回调
 * @param filters 文件后缀名过滤器列表
 */
export function bindPickerBtn(
    btn: HTMLButtonElement | null,
    inp: HTMLInputElement | null,
    title: string,
    type: 'file' | 'directory',
    workspace: string,
    onPick: (val: string) => void,
    logger?: (msg: string, type?: 'info' | 'success' | 'error') => void,
    filters?: PickFilter[]
): void {
    if (!btn || !inp) return;
    btn.addEventListener('click', async () => {
        try {
            const picked = await pickPath(title, inp.value.trim(), type, workspace, filters);
            if (picked) {
                const normalized = normalizePathForStorage(picked, workspace);
                inp.value = normalized;
                onPick(normalized);
                if (logger) logger(`已选择: ${normalized}`);
            }
        } catch (e) {
            if (logger) logger(`选择路径失败: ${(e as any)?.message ?? String(e)}`, 'error');
        }
    });
}
