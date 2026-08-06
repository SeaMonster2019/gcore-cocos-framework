/**
 * @file scene-script.ts
 * @description gcore-framework 场景进程入口脚本，运行在 Cocos Creator Scene 视图渲染上下文中
 */

export const methods = {
    /** 当主进程广播预览语言变更时触发 */
    onPreviewLangChanged() {
        try {
            const globalCce = (typeof window !== 'undefined' ? (window as any).cce : (globalThis as any).cce);
            if (globalCce && globalCce.Engine && typeof globalCce.Engine.repaintInEditMode === 'function') {
                globalCce.Engine.repaintInEditMode();
            }
        } catch (e) {
            console.error('[gcore SceneScript] 刷新预览语言失败:', e);
        }
    },
};
