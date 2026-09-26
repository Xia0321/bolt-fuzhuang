// 以无人值守模式运行 Claude Code（claude -p），使用 CLAUDE_CODE_OAUTH_TOKEN 对应的 Claude 订阅额度。
// 翻译与找货源共用。

import { execFile } from 'node:child_process';
import os from 'node:os';

/**
 * @param {object} o
 * @param {string} o.system      系统提示
 * @param {string} o.input       用户输入（经标准输入传入，避免命令行长度限制）
 * @param {object} o.schema      结构化输出的 JSON Schema
 * @param {string} [o.tools]     允许使用的工具，逗号分隔；默认 "" 表示关闭所有工具
 * @param {number} [o.maxTurns]
 * @param {number} [o.timeoutMs]
 * @param {string} [o.effort]
 */
export function runClaudeCode({ system, input, schema, tools = '', maxTurns = 4, timeoutMs = 240_000, effort = 'medium' }) {
  const env = { ...process.env };
  // 同时存在 API Key 时 Claude Code 会优先使用 API Key，这里去掉以确保使用订阅额度
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  const args = [
    '-p', '--tools', tools, '--no-session-persistence', '--output-format', 'json',
    '--model', 'opus', '--effort', effort, '--max-turns', String(maxTurns),
    '--system-prompt', system, '--json-schema', JSON.stringify(schema),
  ];
  if (tools) args.push('--allowedTools', tools);
  return new Promise((resolve, reject) => {
    const child = execFile('claude', args, { cwd: os.tmpdir(), env, timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      let out = null;
      try {
        out = JSON.parse(stdout);
      } catch {
        // 下面统一报错
      }
      if (out?.structured_output) return resolve(out.structured_output);
      const reason = out?.result || stderr?.trim() || (err?.killed ? '超时' : err?.message) || '无输出';
      // 订阅额度用完、令牌过期等情况都会在这里体现
      reject(new Error(`Claude Code 执行失败：${String(reason).slice(0, 300)}`));
    });
    child.stdin.end(input);
  });
}
