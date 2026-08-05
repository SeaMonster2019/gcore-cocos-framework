import { _decorator, CCString, Component, RichText } from "cc";
import { EDITOR } from "cc/env";
import { GCoreEvent, gcoreEvent } from "../../event";
import { i18n } from "../i18n-mgr";

const { ccclass, property, menu, executeInEditMode } = _decorator;

/** 程序多语言富文本组件 */
@ccclass("I18nRichText")
@menu("Game/I18n/I18nRichText")
@executeInEditMode
export class I18nRichText extends Component {

    /** 多语言 key */
    @property({ displayName: "Key", tooltip: "多语言 key" })
    public i18nKey = "";

    /** 默认文本 */
    @property({ displayName: "Fallback", tooltip: "当 key 不存在时显示的默认文本" })
    public fallback = "";

    /** 占位参数 */
    @property({ type: [CCString], displayName: "Params", tooltip: "占位参数，按顺序替换 {0}、{1}..." })
    public params: string[] = [];

    /** 富文本组件 */
    private _richText: RichText | null = null;

    /****************  生命周期方法  ****************/

    /** 节点加载 */
    protected onLoad(): void {
        this._richText = this.getComponent(RichText);
    }

    /** 节点使能 */
    protected onEnable(): void {
        gcoreEvent.on(GCoreEvent.LANGUAGE_CHANGED.SWITCH_LANGUAGE, this.refresh, this);
        this.refresh();
    }

    /** 节点禁用 */
    protected onDisable(): void {
        gcoreEvent.off(GCoreEvent.LANGUAGE_CHANGED.SWITCH_LANGUAGE, this.refresh, this);
    }

    /****************  公共方法  ****************/

    /** 设置多语言信息
     * @param key 多语言 key
     * @param fallback 默认文本
     * @param params 占位参数数组
     */
    public setKey(key: string, fallback?: string, params?: Array<string | number>): void {
        this.i18nKey = key;
        if (fallback !== undefined) {
            this.fallback = fallback;
        }
        if (params) {
            this.params = params.map((item) => String(item));
        }
        this.refresh();
    }

    /** 刷新文本显示 */
    public refresh(): void {
        if (!this._richText) {
            this._richText = this.getComponent(RichText);
        }
        if (!this._richText || !this.i18nKey) {
            return;
        }

        if (EDITOR) {
            // 缓存获取（0ms 无阻塞）
            const cached = i18n.getEditorText(this.i18nKey, this.fallback);
            this._richText.string = this.format(cached);

            // 异步通过 Cocos Editor.Message IPC 通信实时请求最新文本
            i18n.getEditorTextAsync(this.i18nKey, this.fallback).then((text) => {
                if (this.node && this.node.isValid && this._richText) {
                    this._richText.string = this.format(text);
                }
            }).catch(() => {});
        } else {
            this._richText.string = this.format(i18n.getText(this.i18nKey, this.fallback));
        }
    }

    /****************  私有方法  ****************/

    /** 格式化文本参数
     * @param text 原始文本
     * @returns 替换占位参数后的文本
     */
    private format(text: string): string {
        return text.replace(/\{(\d+)\}/g, (match, index) => this.params[Number(index)] ?? match);
    }

}
