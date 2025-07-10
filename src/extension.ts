import * as vscode from 'vscode';
import { WikiLinksWorkspace } from './WikiLinksWorkspace';
import { WikiLinksDefinitionProvider } from './WikiLinksDefinitionProvider';
import { WikiLinksCompletionProvider } from './WikiLinksCompletionProvider';
import { WikiLinksReferenceProvider } from './WikiLinksReferenceProvider';

function documentPathOK(document: vscode.TextDocument): boolean {
  if (
    document.uri.scheme === 'git' ||
    document.uri.scheme === 'output' ||
    document.uri.scheme === 'vscode' ||
    document.uri.scheme === 'debug'
  ) {
    return false;
  }
  if (document.isUntitled) {
    return false;
  }
  return true;
}

export function activate(context: vscode.ExtensionContext) {
  const ds = WikiLinksWorkspace.DOCUMENT_SELECTOR;
  WikiLinksWorkspace.overrideMarkdownWordPattern();

  // Register completion provider for wiki-links
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(ds, new WikiLinksCompletionProvider(), '[', '[')
  );

  // Register definition provider for wiki-links
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(ds, new WikiLinksDefinitionProvider())
  );

  // Register reference provider for wiki-links
  context.subscriptions.push(
    vscode.languages.registerReferenceProvider(ds, new WikiLinksReferenceProvider())
  );

  // Handle text document changes for cache updates
  vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
    if (documentPathOK(e.document)) {
      WikiLinksWorkspace.updateCacheFor(e.document.uri.fsPath);
    }
  });

  // Register commands
  const newNoteDisposable = vscode.commands.registerCommand(
    'vscodeWikiLinks.newNote',
    WikiLinksWorkspace.newNote
  );
  context.subscriptions.push(newNoteDisposable);

  const newNoteFromSelectionDisposable = vscode.commands.registerCommand(
    'vscodeWikiLinks.newNoteFromSelection',
    WikiLinksWorkspace.newNoteFromSelection
  );
  context.subscriptions.push(newNoteFromSelectionDisposable);

  // Initialize cache
  WikiLinksWorkspace.hydrateCache();
}

export function deactivate() {}
