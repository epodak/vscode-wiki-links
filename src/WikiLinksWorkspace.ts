import * as vscode from 'vscode';
import { basename, dirname, join } from 'path';
import { existsSync } from 'fs';
import { TextEncoder } from 'util';
import findNonIgnoredFiles from './findNonIgnoredFiles';
import GithubSlugger from 'github-slugger';
const SLUGGER = new GithubSlugger();

enum WorkspaceFilenameConvention {
  uniqueFilenames = 'uniqueFilenames',
  relativePaths = 'relativePaths',
}

type Config = {
  createNoteOnGoToDefinitionWhenMissing: boolean;
  workspaceFilenameConvention: WorkspaceFilenameConvention;
  newNoteTemplate: string;
  newNoteFromSelectionReplacementTemplate: string;
  lowercaseNewNoteFilenames: boolean;
  triggerSuggestOnReplacement: boolean;
  newNoteDirectory: string;
};

export class WikiLinksWorkspace {
  static _rxWikiLink = '\\[\\[[^\\]]+\\]\\]'; // [[wiki-link]]
  static _rxMarkdownWordPattern = '([_\\p{L}\\d\\.\\/\\\\]+)';
  static _rxFileExtensions = '\\.(md|markdown|mdx|fountain|txt)$';
  static NEW_NOTE_SAME_AS_ACTIVE_NOTE = 'SAME_AS_ACTIVE_NOTE';
  static NEW_NOTE_WORKSPACE_ROOT = 'WORKSPACE_ROOT';
  
  static DEFAULT_CONFIG: Config = {
    createNoteOnGoToDefinitionWhenMissing: true,
    workspaceFilenameConvention: WorkspaceFilenameConvention.uniqueFilenames,
    newNoteTemplate: '# ${noteName}\n\n',
    newNoteFromSelectionReplacementTemplate: '[[${wikiLink}]]',
    lowercaseNewNoteFilenames: true,
    triggerSuggestOnReplacement: true,
    newNoteDirectory: WikiLinksWorkspace.NEW_NOTE_SAME_AS_ACTIVE_NOTE,
  };

  static DOCUMENT_SELECTOR = [
    { scheme: 'file', language: 'markdown' },
    { scheme: 'file', language: 'mdx' },
    { scheme: 'file', language: 'markdown-notes' },
  ];

  // Cache object to store results from noteFiles() in order to provide a synchronous method to the preview renderer.
  static noteFileCache: vscode.Uri[] = [];

  static cfg(): Config {
    const c = vscode.workspace.getConfiguration('vscodeWikiLinks');
    return {
      createNoteOnGoToDefinitionWhenMissing: c.get('createNoteOnGoToDefinitionWhenMissing') as boolean,
      workspaceFilenameConvention: c.get('workspaceFilenameConvention') as WorkspaceFilenameConvention,
      newNoteTemplate: c.get('newNoteTemplate') as string,
      newNoteFromSelectionReplacementTemplate: c.get('newNoteFromSelectionReplacementTemplate') as string,
      lowercaseNewNoteFilenames: c.get('lowercaseNewNoteFilenames') as boolean,
      triggerSuggestOnReplacement: c.get('triggerSuggestOnReplacement') as boolean,
      newNoteDirectory: c.get('newNoteDirectory') as string,
    };
  }

  static rxWikiLink(): RegExp {
    return new RegExp(this._rxWikiLink, 'gui');
  }

  static rxMarkdownWordPattern(): RegExp {
    return new RegExp(this._rxMarkdownWordPattern, 'gui');
  }

  static rxFileExtensions(): RegExp {
    return new RegExp(this._rxFileExtensions, 'i');
  }

  static useUniqueFilenames(): boolean {
    return this.cfg().workspaceFilenameConvention === WorkspaceFilenameConvention.uniqueFilenames;
  }

  static createNoteOnGoToDefinitionWhenMissing(): boolean {
    return this.cfg().createNoteOnGoToDefinitionWhenMissing;
  }

  static triggerSuggestOnReplacement() {
    return this.cfg().triggerSuggestOnReplacement;
  }

  static newNoteTemplate(): string {
    return this.cfg().newNoteTemplate;
  }

  static newNoteFromSelectionReplacementTemplate(): string {
    return this.cfg().newNoteFromSelectionReplacementTemplate;
  }

  static lowercaseNewNoteFilenames(): boolean {
    return this.cfg().lowercaseNewNoteFilenames;
  }

  static newNoteDirectory(): string {
    return this.cfg().newNoteDirectory;
  }

  static stripExtension(noteName: string): string {
    return noteName.replace(/\.(md|markdown|mdx|fountain|txt)$/i, '');
  }

  static normalizeNoteNameForFuzzyMatch(noteName: string): string {
    // Remove file extension first
    const nameWithoutExt = this.stripExtension(noteName);
    // Convert to lowercase and remove only spaces and special characters, keep Japanese characters
    return nameWithoutExt.toLowerCase().replace(/[\s\-_.]+/g, '');
  }

  static noteNamesFuzzyMatch(left: string, right: string): boolean {
    const leftNormalized = this.normalizeNoteNameForFuzzyMatch(basename(left));
    const rightNormalized = this.normalizeNoteNameForFuzzyMatch(right);
    return leftNormalized === rightNormalized;
  }

  static noteNamesFuzzyMatchText(left: string, right: string): boolean {
    const leftNormalized = this.normalizeNoteNameForFuzzyMatch(left);
    const rightNormalized = this.normalizeNoteNameForFuzzyMatch(right);
    return leftNormalized === rightNormalized;
  }

  static slugifyClassic(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '');
  }

  static slugifyGithub(title: string): string {
    return SLUGGER.slug(title);
  }

  static slugifyTitle(title: string): string {
    return this.slugifyClassic(title);
  }

  static noteFileNameFromTitle(title: string): string {
    return this.slugifyTitle(title) + '.md';
  }

  static showNewNoteInputBox() {
    return vscode.window.showInputBox({
      prompt: 'Enter note name',
      placeHolder: 'my-note',
    });
  }

  static newNote(_context: vscode.ExtensionContext) {
    this.showNewNoteInputBox().then((noteName) => {
      if (noteName) {
        this.createNewNoteFile(noteName).then(({ filepath }) => {
          if (filepath) {
            vscode.workspace.openTextDocument(filepath).then((doc) => {
              vscode.window.showTextDocument(doc);
            });
          }
        });
      }
    });
  }

  static newNoteFromSelection(_context: vscode.ExtensionContext) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (selectedText.trim() === '') {
      vscode.window.showWarningMessage('No text selected');
      return;
    }

    this.showNewNoteInputBox().then((noteName) => {
      if (noteName) {
        this.createNewNoteFile(noteName).then(({ filepath }) => {
          if (filepath) {
            // Create the new note with selected text
            const noteContent = this.newNoteContent(noteName);
            const fullContent = noteContent + selectedText + '\n\n';
            
            vscode.workspace.fs.writeFile(vscode.Uri.file(filepath), new TextEncoder().encode(fullContent)).then(() => {
              // Replace the selection with a wiki-link
              const replacementText = this.selectionReplacementContent(noteName, noteName);
              editor.edit((editBuilder) => {
                editBuilder.replace(selection, replacementText);
              });

              // Open the new note
              vscode.workspace.openTextDocument(filepath).then((doc) => {
                vscode.window.showTextDocument(doc);
              });
            });
          }
        });
      }
    });
  }

  static async createNewNoteFile(noteTitle: string) {
    const filename = vscode.window.activeTextEditor?.document.fileName;
    if (!filename) {
      return { filepath: undefined, fileAlreadyExists: false };
    }

    let targetDir: string;
    const newNoteDirectory = this.newNoteDirectory();

    if (newNoteDirectory === this.NEW_NOTE_SAME_AS_ACTIVE_NOTE) {
      targetDir = dirname(filename);
    } else if (newNoteDirectory === this.NEW_NOTE_WORKSPACE_ROOT) {
      targetDir = vscode.workspace.rootPath || dirname(filename);
    } else {
      // Custom subdirectory path
      const workspaceRoot = vscode.workspace.rootPath;
      if (workspaceRoot) {
        targetDir = join(workspaceRoot, newNoteDirectory);
      } else {
        targetDir = dirname(filename);
      }
    }

    const noteFileName = this.noteFileNameFromTitle(noteTitle);
    if (this.lowercaseNewNoteFilenames()) {
      noteFileName.toLowerCase();
    }

    const filepath = join(targetDir, noteFileName);
    const fileAlreadyExists = existsSync(filepath);

    if (!fileAlreadyExists) {
      const noteContent = this.newNoteContent(noteTitle);
      await vscode.workspace.fs.writeFile(vscode.Uri.file(filepath), new TextEncoder().encode(noteContent));
    }

    return { filepath, fileAlreadyExists };
  }

  static newNoteContent(noteName: string) {
    const template = this.newNoteTemplate();
    const timestamp = new Date().toISOString();
    return template
      .replace('${noteName}', noteName)
      .replace('${timestamp}', timestamp);
  }

  static selectionReplacementContent(wikiLink: string, noteName: string) {
    const template = this.newNoteFromSelectionReplacementTemplate();
    return template
      .replace('${wikiLink}', wikiLink)
      .replace('${noteName}', noteName);
  }

  static overrideMarkdownWordPattern() {
    // Override the markdown word pattern to include wiki-link syntax
    vscode.languages.setLanguageConfiguration('markdown', {
      wordPattern: this.rxMarkdownWordPattern(),
    });
  }

  static async noteFiles(): Promise<Array<vscode.Uri>> {
    if (this.noteFileCache.length > 0) {
      return this.noteFileCache;
    }

    const files = await findNonIgnoredFiles('**/*');
    this.noteFileCache = files.filter((f) => this.rxFileExtensions().test(f.fsPath));
    return this.noteFileCache;
  }

  static noteFilesFromCache(): Array<vscode.Uri> {
    return this.noteFileCache;
  }

  static updateCacheFor(_fsPath: string) {
    // Clear cache when files change
    this.noteFileCache = [];
  }

  static async hydrateCache(): Promise<Array<vscode.Uri>> {
    return this.noteFiles();
  }
} 