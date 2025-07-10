import * as vscode from 'vscode';
import { getWikiLinkOrEmptyAt } from './WikiLinksRef';
import { WikiLinksWorkspace } from './WikiLinksWorkspace';

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

    // デバッグ用のログを追加
    console.log('WikiLinksCompletionProvider: provideCompletionItems called');
    console.log('Context trigger character:', _context.triggerCharacter);
    console.log('Position:', position.line, position.character);

    return (await WikiLinksWorkspace.noteFiles()).map((f) => {
      const kind = vscode.CompletionItemKind.File;
      const label = basename(f.fsPath, '.md');
      const item = new WikiLinksCompletionItem(label, kind, f.fsPath);
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

function basename(path: string, ext?: string): string {
  const name = path.split('/').pop() || path.split('\\').pop() || path;
  if (ext && name.endsWith(ext)) {
    return name.slice(0, -ext.length);
  }
  return name;
} 