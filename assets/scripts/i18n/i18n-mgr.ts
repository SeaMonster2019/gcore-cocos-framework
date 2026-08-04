import { BufferAsset } from "cc";
import { GCoreEvent, gcoreEvent } from "../event";
import ByteBuf from "./base/ByteBuf";

/** 程序本地化表管理器 */
export class I18nMgr {

	private _language = "";
	private _textMap: { [key: string]: string } = {};

	public get language(): string {
		return this._language;
	}

	public get textMap(): Readonly<{ [key: string]: string }> {
		return this._textMap;
	}

	/** 将 BufferAsset 转换为多语言键值对数据
	 * @param asset BufferAsset 资源
	 */
	public parseBufferAsset(asset: BufferAsset): Record<string, string> {
		if (!asset || !asset.buffer()) {
			return {};
		}
		return this.parseBinary(asset.buffer());
	}

	/** 从二进制数据（ArrayBuffer 或 Uint8Array）解析多语言键值对 */
	public parseBinary(buffer: ArrayBuffer | Uint8Array): Record<string, string> {
		const byteBuf = new ByteBuf(buffer);
		const map: Record<string, string> = {};
		const count = byteBuf.readInt();
		for (let i = 0; i < count; i++) {
			const key = byteBuf.readString();
			const value = byteBuf.readString();
			map[key] = value;
		}
		return map;
	}

	/** 切换语言从 JSON 数据 
	 * @param language 
	 * @param json 
	 */
	public async switchLanguageFromJson(language: string, json: string): Promise<void> {
		const data = JSON.parse(json);
		this.switchLanguageFromData(language, data);
	}

	/** 从 BufferAsset 资源切换语言
	 * @param language 
	 * @param asset 
	 */
	public switchLanguageFromBufferAsset(language: string, asset: BufferAsset): void {
		const data = this.parseBufferAsset(asset);
		this.switchLanguageFromData(language, data);
	}

	/** 从二进制 Buffer 切换语言
	 * @param language 
	 * @param buffer 
	 */
	public switchLanguageFromBuffer(language: string, buffer: ArrayBuffer | Uint8Array): void {
		const data = this.parseBinary(buffer);
		this.switchLanguageFromData(language, data);
	}

	/** 从对象或二进制数据切换语言
	 * @param language
	 * @param data 可为 Record<string, string>、BufferAsset 或 ArrayBuffer/Uint8Array
	 */
	public switchLanguageFromBinary(language: string, data: { [key: string]: string } | BufferAsset | ArrayBuffer | Uint8Array): void {
		if (data instanceof BufferAsset) {
			this.switchLanguageFromBufferAsset(language, data);
		} else if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
			this.switchLanguageFromBuffer(language, data);
		} else {
			this.switchLanguageFromData(language, data);
		}
	}

	/** 从键值对对象直接设置语言数据 */
	public switchLanguageFromData(language: string, data: { [key: string]: string }): void {
		this._language = language;
		this._textMap = data;
		this._sendEvent();
	}

	/** 获取本地化文本 */
	public getText(key: string, fallback?: string): string {
		return this._textMap?.[key] ?? fallback ?? key;
	}

	/** 是否包含指定 key */
	public has(key: string): boolean {
		return key in this._textMap;
	}

	/** 清理本地化数据 */
	public clear(): void {
		this._language = "";
		this._textMap = {};
	}

	/** 发送语言切换事件 */
	private _sendEvent() {
		gcoreEvent.emit(GCoreEvent.LANGUAGE_CHANGED.SWITCH_LANGUAGE, this._language);
	}

}

export const i18n = new I18nMgr();

