import * as vscode from "vscode";
import { simpleGit, SimpleGit } from "simple-git";

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
      ),
      vscode.commands.registerCommand(
        "worktrees.copyToClipboard",
        (value: string) => {
          vscode.env.clipboard.writeText(value);
          vscode.window.showInformationMessage(`Copied to clipboard: ${value}`);
        }
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
    if (element && element.children) {
      // Return the children of the selected worktree
      return element.children;
    } else if (!element) {
      // Root level, return all worktrees
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

      // Create hierarchical WorktreeItem instances
      return worktreeLines.map((line) => {
        const match = line.match(/^(.+?)\s+\S+\s+\[([^\]]+)\]$/);
        if (match) {
          const fullPath = match[1].trim();
          const branch = match[2].trim();
          const relativePath = this.removeCommonPrefix(fullPath);

          // Create child items (branch and path)
          const branchItem = new WorktreeItem(
            branch,
            branch,
            undefined,
            "git-branch"
          );
          const pathItem = new WorktreeItem(
            fullPath,
            fullPath,
            undefined,
            "folder"
          );

          // Create parent item (worktree name) with children
          const worktreeItem = new WorktreeItem(relativePath, fullPath, [
            branchItem,
            pathItem,
          ]);
          worktreeItem.collapsibleState =
            vscode.TreeItemCollapsibleState.Expanded;

          return worktreeItem;
        } else {
          return new WorktreeItem(line.trim(), line.trim());
        }
      });
    } else {
      return [];
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
  children: WorktreeItem[] | undefined;

  constructor(
    public readonly label: string,
    public readonly value: string,
    children?: WorktreeItem[],
    iconPath?: string
  ) {
    super(
      label,
      children && children.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    // this.tooltip = value;

    if (iconPath) {
      this.iconPath = new vscode.ThemeIcon(iconPath);
    }

    this.command = children
      ? undefined
      : {
          command: "worktrees.copyToClipboard",
          title: "Copy to Clipboard",
          arguments: [value],
        };
    this.contextValue = "worktreeItem";
    this.children = children;
  }
}
