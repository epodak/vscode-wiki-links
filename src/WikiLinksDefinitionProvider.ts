import * as vscode from 'vscode';
import { WikiLinkRef, getWikiLinkAt } from './WikiLinksRef';
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
    const ref = getWikiLinkAt(document, position);
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

  static filesForWikiLinkRefFromCache(
    ref: WikiLinkRef,
    relativeToDocument: vscode.TextDocument | undefined | null
  ) {
    const files = WikiLinksWorkspace.noteFilesFromCache();
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