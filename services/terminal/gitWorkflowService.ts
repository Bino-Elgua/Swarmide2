/**
 * Git Workflow Service
 * Provides git operations integrated with SwarmIDE2's orchestration phases.
 * Uses simple-git for programmatic git access.
 *
 * Phase integration points:
 *  - Phase 4 (Ralph Loop): auto-checkpoint after each iteration batch
 *  - Phase 7 (Integration): emit webhook events on git operations
 */

let simpleGit: typeof import('simple-git') | null = null;
async function getSimpleGit() {
  if (!simpleGit) {
    simpleGit = await import('simple-git');
  }
  return simpleGit;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  conflicted: string[];
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitOperationResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: unknown;
}

/**
 * Get a configured simple-git instance for a repository path.
 */
async function git(repoPath: string) {
  const sg = await getSimpleGit();
  return sg.default(repoPath);
}

/**
 * Get the current git status of a repository.
 */
export async function getStatus(repoPath: string): Promise<GitStatus> {
  const g = await git(repoPath);
  const status = await g.status();
  return {
    branch: status.current ?? 'HEAD',
    ahead: status.ahead,
    behind: status.behind,
    staged: status.staged,
    unstaged: status.modified,
    untracked: status.not_added,
    conflicted: status.conflicted,
  };
}

/**
 * Get recent commit log.
 */
export async function getLog(repoPath: string, maxCount = 20): Promise<GitCommit[]> {
  const g = await git(repoPath);
  const log = await g.log({ maxCount });
  return log.all.map(c => ({
    hash: c.hash.slice(0, 7),
    message: c.message,
    author: c.author_name,
    date: c.date,
  }));
}

/**
 * Stage files and create a commit with a descriptive message.
 * Used by Phase 4 (Ralph Loop) to checkpoint after each iteration.
 */
export async function createCheckpointCommit(
  repoPath: string,
  message: string,
  files: string[] = ['.'],
): Promise<GitOperationResult> {
  try {
    const g = await git(repoPath);
    await g.add(files);
    const result = await g.commit(message);
    return {
      success: true,
      output: `Committed ${result.summary.changes} changes: ${result.commit}`,
      data: { hash: result.commit, summary: result.summary },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Create a new branch for agent work.
 * Used when spawning parallel agents to isolate their changes.
 */
export async function createAgentBranch(
  repoPath: string,
  agentId: string,
  baseBranch = 'main',
): Promise<GitOperationResult> {
  const branchName = `agent/${agentId}-${Date.now()}`;
  try {
    const g = await git(repoPath);
    await g.checkoutBranch(branchName, baseBranch);
    return { success: true, output: `Created branch: ${branchName}`, data: { branchName } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Get the diff of unstaged or staged changes.
 */
export async function getDiff(repoPath: string, staged = false): Promise<string> {
  const g = await git(repoPath);
  return staged ? g.diff(['--staged']) : g.diff();
}

/**
 * Push current branch to remote.
 */
export async function pushBranch(
  repoPath: string,
  remote = 'origin',
  branch?: string,
): Promise<GitOperationResult> {
  try {
    const g = await git(repoPath);
    const status = await g.status();
    const targetBranch = branch ?? status.current ?? 'main';
    await g.push(remote, targetBranch, ['--set-upstream']);
    return { success: true, output: `Pushed to ${remote}/${targetBranch}` };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Pull latest from remote.
 */
export async function pullLatest(
  repoPath: string,
  remote = 'origin',
  branch?: string,
): Promise<GitOperationResult> {
  try {
    const g = await git(repoPath);
    const status = await g.status();
    const targetBranch = branch ?? status.current ?? 'main';
    const result = await g.pull(remote, targetBranch);
    return {
      success: true,
      output: `Pulled: +${result.insertions} -${result.deletions} in ${result.summary.changes} files`,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * List all local branches.
 */
export async function listBranches(repoPath: string): Promise<string[]> {
  const g = await git(repoPath);
  const branches = await g.branchLocal();
  return branches.all;
}

/**
 * Phase 4 integration: auto-commit checkpoint after a Ralph Loop iteration.
 */
export async function ralphLoopCheckpoint(
  repoPath: string,
  iteration: number,
  completedItems: string[],
): Promise<GitOperationResult> {
  const message = [
    `chore(ralph-loop): iteration ${iteration} checkpoint`,
    '',
    `Completed ${completedItems.length} PRD items:`,
    ...completedItems.slice(0, 10).map(item => `  - ${item}`),
    completedItems.length > 10 ? `  ... and ${completedItems.length - 10} more` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return createCheckpointCommit(repoPath, message);
}

/**
 * Generic git operation dispatcher — used by the WebSocket hub.
 */
export async function executeGitOperation(
  op: string,
  args: Record<string, unknown>,
): Promise<GitOperationResult> {
  const repoPath = (args.repoPath as string) ?? process.cwd();

  switch (op) {
    case 'status':
      return { success: true, data: await getStatus(repoPath) };
    case 'log':
      return { success: true, data: await getLog(repoPath, (args.maxCount as number) ?? 20) };
    case 'commit':
      return createCheckpointCommit(
        repoPath,
        args.message as string,
        args.files as string[] | undefined,
      );
    case 'branch':
      return createAgentBranch(repoPath, args.agentId as string, args.base as string | undefined);
    case 'diff':
      return { success: true, data: await getDiff(repoPath, args.staged as boolean) };
    case 'push':
      return pushBranch(repoPath, args.remote as string | undefined, args.branch as string | undefined);
    case 'pull':
      return pullLatest(repoPath, args.remote as string | undefined, args.branch as string | undefined);
    case 'branches':
      return { success: true, data: await listBranches(repoPath) };
    default:
      return { success: false, error: `Unknown git operation: ${op}` };
  }
}
