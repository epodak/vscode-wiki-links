import * as vscode from 'vscode';
import { basename } from 'path';
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
  triggerSuggestOnReplacement: boolean;
};

export class WikiLinksWorkspace {
  static _rxWikiLink = '\\[\\[[^\\]]+\\]\\]'; // [[wiki-link]]
  static _rxMarkdownWordPattern = '([_\\p{L}\\d\\.\\/\\\\\\-\\s]+)';
  static _rxFileExtensions = '\\.(md|markdown|mdx|fountain|txt)$';
  static NEW_NOTE_SAME_AS_ACTIVE_NOTE = 'SAME_AS_ACTIVE_NOTE';
  static NEW_NOTE_WORKSPACE_ROOT = 'WORKSPACE_ROOT';
  
  static DEFAULT_CONFIG: Config = {
    createNoteOnGoToDefinitionWhenMissing: true,
    workspaceFilenameConvention: WorkspaceFilenameConvention.uniqueFilenames,
    triggerSuggestOnReplacement: true,
  };

  // Cache is disabled for now to ensure correctness.
  // static noteFileCache: vscode.Uri[] = [];

  static cfg(): Config {
    const c = vscode.workspace.getConfiguration('vscodeWikiLinks');
    const config = {
      createNoteOnGoToDefinitionWhenMissing: c.get('createNoteOnGoToDefinitionWhenMissing') as boolean,
      workspaceFilenameConvention: c.get('workspaceFilenameConvention') as WorkspaceFilenameConvention,
      triggerSuggestOnReplacement: c.get('triggerSuggestOnReplacement') as boolean,
    };
    return config;
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

  static useRelativePaths(): boolean {
    return this.cfg().workspaceFilenameConvention === WorkspaceFilenameConvention.relativePaths;
  }

  static getDisplayName(filePath: string, relativeToDocument?: vscode.TextDocument): string {
    if (this.useRelativePaths() && relativeToDocument) {
      const workspaceRoot = vscode.workspace.getWorkspaceFolder(relativeToDocument.uri);
      if (workspaceRoot) {
        const relativePath = vscode.workspace.asRelativePath(filePath);
        const displayName = this.stripExtension(relativePath);
        return displayName;
      }
    }
    const basenameOnly = this.stripExtension(basename(filePath));
    return basenameOnly;
  }

  static getRelativePath(filePath: string, relativeToDocument?: vscode.TextDocument): string {
    if (relativeToDocument) {
      const workspaceRoot = vscode.workspace.getWorkspaceFolder(relativeToDocument.uri);
      if (workspaceRoot) {
        const relativePath = vscode.workspace.asRelativePath(filePath);
        return this.stripExtension(relativePath);
      }
    }
    return this.stripExtension(basename(filePath));
  }

  static getRelativePathFromDocument(filePath: string, relativeToDocument: vscode.TextDocument): string {
    const workspaceRoot = vscode.workspace.getWorkspaceFolder(relativeToDocument.uri);
    if (workspaceRoot) {
      const relativePath = vscode.workspace.asRelativePath(filePath);
      return this.stripExtension(relativePath);
    }
    return this.stripExtension(basename(filePath));
  }

  static createNoteOnGoToDefinitionWhenMissing(): boolean {
    return this.cfg().createNoteOnGoToDefinitionWhenMissing;
  }

  static triggerSuggestOnReplacement() {
    return this.cfg().triggerSuggestOnReplacement;
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



  static overrideMarkdownWordPattern() {
    // Override the markdown word pattern to include wiki-link syntax
    vscode.languages.setLanguageConfiguration('markdown', {
      wordPattern: this.rxMarkdownWordPattern(),
    });
  }

  static async noteFiles(): Promise<Array<vscode.Uri>> {
    const files = await findNonIgnoredFiles('**/*');
    const noteFiles = files.filter((f) => this.rxFileExtensions().test(f.fsPath));
    return noteFiles;
  }
} 