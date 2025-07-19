import * as vscode from 'vscode';
import { WikiLinkRef, getWikiLinkOrEmptyAt } from './WikiLinksRef';
import { WikiLinksWorkspace } from './WikiLinksWorkspace';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';
import { TextEncoder } from 'util';

export class WikiLinksDefinitionProvider implements vscode.DefinitionProvider {
  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ) {
    const ref = getWikiLinkOrEmptyAt(document, position);
    if (!ref || ref.type !== 'WikiLink') {
      return [];
    }

    let files: Array<vscode.Uri> = [];
    files = await WikiLinksDefinitionProvider.filesForWikiLinkRef(ref, document);

    // If no files found, create the file
    if (files.length === 0) {
      const path = await WikiLinksDefinitionProvider.createMissingNote(ref);
      if (path !== undefined) {
        files.push(vscode.Uri.file(path));
      }
    }

    const p = new vscode.Position(0, 0);
    return files.map((f) => new vscode.Location(f, p));
  }

  static async filesForWikiLinkRef(
    ref: WikiLinkRef,
    relativeToDocument: vscode.TextDocument | undefined | null
  ): Promise<Array<vscode.Uri>> {
    const files: Array<vscode.Uri> = await WikiLinksWorkspace.noteFiles();
    return this._filesForWikiLinkRefAndNoteFiles(ref, relativeToDocument, files);
  }

  static _filesForWikiLinkRefAndNoteFiles(
    ref: WikiLinkRef,
    relativeToDocument: vscode.TextDocument | undefined | null,
    noteFiles: Array<vscode.Uri>
  ): Array<vscode.Uri> {
    let files: Array<vscode.Uri> = [];
    
    if (WikiLinksWorkspace.useUniqueFilenames()) {
      // there should be exactly 1 file with name = ref.word
      files = noteFiles.filter((f) => {
        return WikiLinksWorkspace.noteNamesFuzzyMatch(f.fsPath, ref.word);
      });
    } else if (WikiLinksWorkspace.useRelativePaths()) {
      // For relativePaths mode, try to match by relative path
      files = noteFiles.filter((f) => {
        const relativePath = WikiLinksWorkspace.getRelativePath(f.fsPath, relativeToDocument || undefined);
        // 複数のマッチング方法を試す
        let isMatch = WikiLinksWorkspace.noteNamesFuzzyMatchText(relativePath, ref.word);
        
        // 相対パス全体でのマッチングも試す
        if (!isMatch && relativeToDocument) {
          const workspaceRoot = vscode.workspace.getWorkspaceFolder(relativeToDocument.uri);
          if (workspaceRoot) {
            const fullRelativePath = vscode.workspace.asRelativePath(f.fsPath);
            const normalizedPath = WikiLinksWorkspace.stripExtension(fullRelativePath);
            isMatch = WikiLinksWorkspace.noteNamesFuzzyMatchText(normalizedPath, ref.word);
          }
        }
        
        // 階層情報を含むwikiリンクの処理
        if (!isMatch && ref.word.includes('(')) {
          const match = ref.word.match(/^(.+?)\s*\((.+?)\)$/);
          if (match && match[1] && match[2]) {
            const fileName = match[1].trim();
            const dirPath = match[2].trim();
            const expectedRelativePath = `${dirPath}/${fileName}`;
            const actualRelativePath = WikiLinksWorkspace.stripExtension(vscode.workspace.asRelativePath(f.fsPath));
            isMatch = WikiLinksWorkspace.noteNamesFuzzyMatchText(actualRelativePath, expectedRelativePath);
          }
        }

        return isMatch;
      });
    }

    // If we did not find any files in the workspace,
    // see if a file exists at the relative path:
    if (files.length === 0 && relativeToDocument && relativeToDocument.uri) {
      const relativePath = ref.word;
      const fromDir = dirname(relativeToDocument.uri.fsPath.toString());
      const absPath = resolve(fromDir, relativePath);
      if (existsSync(absPath)) {
        const f = vscode.Uri.file(absPath);
        files.push(f);
      }
    }
    return files;
  }

  static createMissingNote = async (ref: WikiLinkRef): Promise<string | undefined> => {
    if (ref.type !== 'WikiLink') {
      return undefined;
    }
    if (!WikiLinksWorkspace.createNoteOnGoToDefinitionWhenMissing()) {
      return undefined;
    }
    const filename = vscode.window.activeTextEditor?.document.fileName;
    if (filename !== undefined) {
      if (!WikiLinksWorkspace.useUniqueFilenames()) {
        vscode.window.showWarningMessage(
          `createNoteOnGoToDefinitionWhenMissing only works when vscodeWikiLinks.workspaceFilenameConvention = 'uniqueFilenames'`
        );
        return;
      }
      const title = WikiLinksWorkspace.stripExtension(ref.word);
      const noteFileName = WikiLinksWorkspace.noteFileNameFromTitle(title);
      const fromDir = dirname(filename);
      const filepath = resolve(fromDir, noteFileName);
      
      if (!existsSync(filepath)) {
        const noteContent = `# ${title}\n\n`;
        await vscode.workspace.fs.writeFile(vscode.Uri.file(filepath), new TextEncoder().encode(noteContent));
      }
      
      return filepath;
    }
    return undefined;
  };
} 