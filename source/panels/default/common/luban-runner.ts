/**
 * @file luban-runner.ts
 * @description Luban 命令行转表核心执行器，封装子进程调用与日志回调
 */

import { exec } from 'child_process';
import { join } from 'path';
import { resolvePathForExec } from './path-util';
import { LogCallback } from './types';

export class LubanRunner {
    /**
     * 执行 Luban 转表命令
     * @param confFile 配置文件路径 (luban.conf)
     * @param target 转表目标 (如: client, zh-Hans, en)
     * @param outputCodeDir 代码输出目录 (outputCodeDir)
     * @param outputDataDir 数据输出目录 (outputDataDir)
     * @param workspace 工作区根路径
     * @param appendLog 日志打印回调函数
     * @returns Promise<boolean> 是否转表成功
     */
    public static run(
        confFile: string,
        target: string,
        outputCodeDir: string,
        outputDataDir: string,
        workspace: string,
        appendLog: LogCallback
    ): Promise<boolean> {
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
                    appendLog(`[${target}] 转表成功！`, 'success');
                    resolvePromise(true);
                }
            });
        });
    }
}
