import * as vscode from "vscode";
import { simpleGit, SimpleGit } from "simple-git";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    const rootPath = workspaceFolders[0].uri.fsPath;
    const git: SimpleGit = simpleGit(rootPath);

    const worktreeProvider = new WorktreeProvider(git, rootPath);
    vscode.window.registerTreeDataProvider("worktrees", worktreeProvider);

    context.subscriptions.push(
      vscode.commands.registerCommand("worktrees.refresh", () =>
        worktreeProvider.refresh()
      )
    );
  } else {
    vscode.window.showErrorMessage("No workspace folder found");
  }
}

class WorktreeProvider implements vscode.TreeDataProvider<WorktreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    WorktreeItem | undefined | void
  > = new vscode.EventEmitter<WorktreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<WorktreeItem | undefined | void> =
    this._onDidChangeTreeData.event;
  private commonPrefix: string = "";

  constructor(private git: SimpleGit, private rootPath: string) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorktreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorktreeItem): Promise<WorktreeItem[]> {
    if (element) {
      return [];
    } else {
      const worktrees = await this.git.raw(["worktree", "list"]);
      const worktreeLines = worktrees
        .split("\n")
        .filter((line) => line.trim() !== "");

      // Find the common prefix
      const paths = worktreeLines
        .map((line) => {
          const match = line.match(/^(.+?)\s+\S+\s+\[([^\]]+)\]$/);
          return match ? match[1].trim() : "";
        })
        .filter((p) => p !== "");

      this.commonPrefix = this.findCommonPrefix(paths);

      // Create WorktreeItem instances
      return worktreeLines.map((line) => {
        const match = line.match(/^(.+?)\s+\S+\s+\[([^\]]+)\]$/);
        if (match) {
          const fullPath = match[1].trim();
          const branch = match[2].trim();
          const relativePath = this.removeCommonPrefix(fullPath);
          return new WorktreeItem(relativePath, fullPath, branch);
        } else {
          return new WorktreeItem(line.trim(), line.trim(), "");
        }
      });
    }
  }

  private findCommonPrefix(paths: string[]): string {
    if (paths.length === 0) return "";
    let prefix = paths[0];
    for (const path of paths) {
      while (!path.startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
        if (prefix === "") return "";
      }
    }
    return prefix;
  }

  private removeCommonPrefix(fullPath: string): string {
    if (fullPath.startsWith(this.commonPrefix)) {
      return fullPath.substring(this.commonPrefix.length).replace(/^\/+/, "");
    }
    return fullPath;
  }
}

class WorktreeItem extends vscode.TreeItem {
  constructor(
    public readonly relativePath: string,
    public readonly fullPath: string,
    public readonly branch: string
  ) {
    super(relativePath, vscode.TreeItemCollapsibleState.None);
    this.description = branch;
    this.tooltip = fullPath;
    this.contextValue = "worktreeItem";
  }
}
