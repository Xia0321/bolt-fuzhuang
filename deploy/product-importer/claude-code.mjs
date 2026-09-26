// 以无人值守模式运行 Claude Code（claude -p），使用 CLAUDE_CODE_OAUTH_TOKEN 对应的 Claude 订阅额度。
// 翻译与找货源共用。

import { execFile, spawn } from 'node:child_process';
import os from 'node:os';

function baseEnv() {
  const env = { ...process.env };
  // 同时存在 API Key 时 Claude Code 会优先使用 API Key，这里去掉以确保使用订阅额度
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

function baseArgs({ system, schema, tools, model, effort, maxTurns, outputFormat }) {
  const args = [
    '-p', '--tools', tools, '--no-session-persistence', '--output-format', outputFormat,
    '--model', model, '--effort', effort, '--max-turns', String(maxTurns),
    '--system-prompt', system, '--json-schema', JSON.stringify(schema),
  ];
  if (tools) args.push('--allowedTools', tools);
  // stream-json 需要 --verbose 才会输出每一步
  if (outputFormat === 'stream-json') args.push('--verbose');
  return args;
}

const failure = reason => new Error(`Claude Code 执行失败：${String(reason || '无输出').slice(0, 300)}`);

/**
 * 一次性执行，返回结构化结果。
 * @param {object} o
 * @param {string} o.system      系统提示
 * @param {string} o.input       用户输入（经标准输入传入，避免命令行长度限制）
 * @param {object} o.schema      结构化输出的 JSON Schema
 * @param {string} [o.tools]     允许使用的工具，逗号分隔；默认 "" 表示关闭所有工具
 * @param {string} [o.model]     opus / sonnet / haiku 或完整模型名
 */
export function runClaudeCode({ system, input, schema, tools = '', model = 'opus', effort = 'medium', maxTurns = 4, timeoutMs = 240_000 }) {
  const args = baseArgs({ system, schema, tools, model, effort, maxTurns, outputFormat: 'json' });
  return new Promise((resolve, reject) => {
    const child = execFile('claude', args, { cwd: os.tmpdir(), env: baseEnv(), timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      let out = null;
      try {
        out = JSON.parse(stdout);
      } catch {
        // 下面统一报错
      }
      if (out?.structured_output) return resolve(out.structured_output);
      // 订阅额度用完、令牌过期等情况都会在这里体现
      reject(failure(out?.result || stderr?.trim() || (err?.killed ? '超时' : err?.message)));
    });
    child.stdin.end(input);
  });
}

/**
 * 流式执行：每次调用工具（如联网搜索）时回调 onTool(name, input)，结束后返回结构化结果。
 */
export function runClaudeCodeStream({ system, input, schema, tools = '', model = 'opus', effort = 'medium', maxTurns = 4, timeoutMs = 240_000, onTool }) {
  const args = baseArgs({ system, schema, tools, model, effort, maxTurns, outputFormat: 'stream-json' });
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { cwd: os.tmpdir(), env: baseEnv() });
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    let buffer = '';
    let stderr = '';
    let result = null;
    const handleLine = line => {
      if (!line.trim()) return;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }
      if (event.type === 'assistant') {
        for (const block of event.message?.content ?? []) {
          if (block.type === 'tool_use') onTool?.(block.name, block.input ?? {});
        }
      } else if (event.type === 'result') {
        result = event;
      }
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      lines.forEach(handleLine);
    });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', e => { clearTimeout(timer); reject(failure(e.message)); });
    child.on('close', () => {
      clearTimeout(timer);
      handleLine(buffer);
      if (result?.structured_output) return resolve(result.structured_output);
      reject(failure(result?.result || stderr.trim() || '超时或中断'));
    });
    child.stdin.end(input);
  });
}
