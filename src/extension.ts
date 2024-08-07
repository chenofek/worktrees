import * as vscode from "vscode";
import * as simpleGit from "simple-git";

export function activate(context: vscode.ExtensionContext) {
  const git = simpleGit.default();

  vscode.window.registerTreeDataProvider(
    "worktrees",
    new WorktreeProvider(git)
  );
}

class WorktreeProvider implements vscode.TreeDataProvider<WorktreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    WorktreeItem | undefined | void
  > = new vscode.EventEmitter<WorktreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<WorktreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor(private git: simpleGit.SimpleGit) {}

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
      return worktreeLines.map((line) => {
        const match = line.match(/(.+)\s+\[(.+)\]/);
        if (match) {
          return new WorktreeItem(match[1], match[2]);
        } else {
          return new WorktreeItem(line, "");
        }
      });
    }
  }
}

class WorktreeItem extends vscode.TreeItem {
  constructor(public readonly path: string, public readonly branch: string) {
    super(path, vscode.TreeItemCollapsibleState.None);
    this.description = branch;
  }
}
