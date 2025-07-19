import * as vscode from 'vscode';
import Fuse, { IFuseOptions } from 'fuse.js';
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
    context: vscode.CompletionContext
  ) {
    const ref = getWikiLinkOrEmptyAt(document, position);
    if (!ref || ref.type !== 'WikiLink') {
      return [];
    }

    const inputText = ref.word;
    const allFiles = await WikiLinksWorkspace.noteFiles();
    
    // Prepare data for Fuse.js
    const searchData = allFiles.map(f => ({
      file: f,
      displayName: WikiLinksWorkspace.getDisplayName(f.fsPath, document),
      fileNameWithoutExt: WikiLinksWorkspace.stripExtension(basename(f.fsPath)),
      relativePath: vscode.workspace.asRelativePath(f.fsPath),
    }));

    let results;
    
    if (inputText === '') {
      // If no input, return all files, sorted alphabetically
      results = searchData
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .map((item, index) => ({ item, score: 0, refIndex: index }));
    } else {
      // Configure Fuse.js with permissive settings for better matching
      const fuseOptions: IFuseOptions<any> = {
        includeScore: true,
        threshold: 0.8, // 更宽松的阈值，支持模糊匹配
        ignoreLocation: true,
        findAllMatches: true,
        useExtendedSearch: false,
        minMatchCharLength: 1,
        keys: [
          { name: 'displayName', weight: 0.6 },
          { name: 'fileNameWithoutExt', weight: 0.3 },
          { name: 'relativePath', weight: 0.1 },
        ],
      };
      const fuse = new Fuse(searchData, fuseOptions);
      results = fuse.search(inputText);
    }
    
    console.log(`[FuseJS] Found ${results.length} results for "${inputText}"`);

    const completionItems = results.map((result, index) => {
      const { item, score = 0 } = result;
      const label = item.displayName;
      const completionItem = new WikiLinksCompletionItem(label, vscode.CompletionItemKind.File, item.file.fsPath);

      // 关键修复：使用复合filterText来同时支持中英文
      // 这样既能让中文通过VS Code的过滤，又能保持英文的动态响应
      completionItem.filterText = `${inputText} ${label}`;
      
      completionItem.insertText = label;
      completionItem.preselect = index === 0;
      completionItem.commitCharacters = [']'];

      // 设置sortText来控制排序
      completionItem.sortText = `${String(score).padStart(6, '0')}_${index.toString().padStart(4, '0')}`;

      // 设置range用于替换
      if (ref.range) {
        completionItem.range = ref.range;
      }

      completionItem.kind = vscode.CompletionItemKind.File;
      
      console.log(`[COMPLETION] Creating: "${label}", Score: ${score?.toFixed(4) ?? 'N/A'}, FilterText: "${completionItem.filterText}"`);
      return completionItem;
    });

    // 返回简单的数组，不使用isIncomplete
    return completionItems;
  }

  public async resolveCompletionItem(
    item: WikiLinksCompletionItem,
    _token: vscode.CancellationToken
  ): Promise<WikiLinksCompletionItem> {
    if (item.fsPath) {
      try {
        const content = await vscode.workspace.fs.readFile(vscode.Uri.file(item.fsPath));
        const title = content.toString().split('\n').find(line => line.startsWith('# '));
        if (title) {
          item.detail = title;
        }
      } catch (_error) { /* Ignore */ }
    }
    return item;
  }
} 