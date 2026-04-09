import { exec } from 'child_process';
import { getAgent } from './whatsapp-agents';

export function sshExec(agentName: string, command: string, timeoutMs = 10000): Promise<string> {
  const agent = getAgent(agentName);
  if (!agent) return Promise.reject(new Error(`Agent ${agentName} not found`));

  const sshHost = agent.pc.ssh;
  const fullCmd = agent.useWSL
    ? `ssh ${sshHost} "wsl ${command}"`
    : `ssh ${sshHost} "${command}"`;

  return new Promise((resolve, reject) => {
    exec(fullCmd, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export function sshReadFile(agentName: string, filePath: string): Promise<string> {
  const agent = getAgent(agentName);
  if (!agent) return Promise.reject(new Error(`Agent ${agentName} not found`));

  if (agent.useWSL) {
    return sshExec(agentName, `cat '${filePath}'`, 15000);
  } else {
    // Windows: use powershell Get-Content
    const cmd = `powershell -Command "Get-Content '${filePath}' -Raw"`;
    return sshExec(agentName, cmd, 15000);
  }
}

export function sshTailFile(agentName: string, filePath: string, lines = 50): Promise<string> {
  const agent = getAgent(agentName);
  if (!agent) return Promise.reject(new Error(`Agent ${agentName} not found`));

  if (agent.useWSL) {
    return sshExec(agentName, `tail -n ${lines} '${filePath}'`, 15000);
  } else {
    const cmd = `powershell -Command "Get-Content '${filePath}' -Tail ${lines}"`;
    return sshExec(agentName, cmd, 15000);
  }
}

export function sshListDir(agentName: string, dirPath: string): Promise<string[]> {
  const agent = getAgent(agentName);
  if (!agent) return Promise.reject(new Error(`Agent ${agentName} not found`));

  const cmd = agent.useWSL
    ? `ls -1 '${dirPath}'`
    : `powershell -Command "Get-ChildItem '${dirPath}' -Name"`;

  return sshExec(agentName, cmd, 15000).then(out => out.split('\n').filter(Boolean));
}
