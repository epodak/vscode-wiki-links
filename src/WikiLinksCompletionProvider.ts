import * as vscode from 'vscode';
import { getWikiLinkOrEmptyAt } from './WikiLinksRef';
import { WikiLinksWorkspace } from './WikiLinksWorkspace';
import { basename } from 'path';

class WikiLinksCompletionItem extends vscode.CompletionItem {
  fsPath?: string | undefined;

  constructor(label: string, kind?: vscode.CompletionItemKind, fsPath?: string) {
    super(label, kind);
    this.fsPath = fsPath;
  }
}

export class WikiLinksCompletionProvider implements vscode.CompletionItemProvider {
  public async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ) {
    const ref = getWikiLinkOrEmptyAt(document, position);
    if (!ref || ref.type !== 'WikiLink') {
      return [];
    }

    return (await WikiLinksWorkspace.noteFiles()).map((f) => {
      const kind = vscode.CompletionItemKind.File;
      let label = WikiLinksWorkspace.getDisplayName(f.fsPath, document);

      // relativePathsモードで階層の違いを表示
      if (WikiLinksWorkspace.useRelativePaths()) {
        const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri);
        if (workspaceRoot) {
          const relativePath = vscode.workspace.asRelativePath(f.fsPath);
          const dirPath = relativePath.split('/').slice(0, -1).join('/');
          if (dirPath) {
            // ラベルに階層情報を含める
            label = `${label} (${dirPath})`;
          }
        }
      }
      
      const item = new WikiLinksCompletionItem(label, kind, f.fsPath);
      
      // relativePathsモードで詳細情報を追加
      if (WikiLinksWorkspace.useRelativePaths()) {
        const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri);
        if (workspaceRoot) {
          const relativePath = vscode.workspace.asRelativePath(f.fsPath);
          const dirPath = relativePath.split('/').slice(0, -1).join('/');
          if (dirPath) {
            item.detail = `📁 ${dirPath}`;
            // 挿入テキストを階層情報を含む相対パスに設定
            item.insertText = WikiLinksWorkspace.stripExtension(relativePath);
          } else {
            // ルートレベルのファイルの場合
            item.insertText = WikiLinksWorkspace.stripExtension(basename(f.fsPath));
          }
        }
      }
      
      if (ref && ref.range) {
        item.range = ref.range;
      }
      return item;
    });
  }

  public async resolveCompletionItem(
    item: WikiLinksCompletionItem,
    _token: vscode.CancellationToken
  ): Promise<WikiLinksCompletionItem> {
    const fsPath = item.fsPath;
    if (fsPath) {
      try {
        const content = await vscode.workspace.fs.readFile(vscode.Uri.file(fsPath));
        const text = content.toString();
        const lines = text.split('\n');
        const title = lines.find(line => line.startsWith('# '));
        if (title) {
          item.detail = title;
        }
      } catch (_error) {
        // Ignore errors when reading file
      }
    }
    return item;
  }
} 