import * as vscode from 'vscode';
import { WikiLinksWorkspace } from './WikiLinksWorkspace';
import { WikiLinksDefinitionProvider } from './WikiLinksDefinitionProvider';
import { WikiLinksCompletionProvider } from './WikiLinksCompletionProvider';
import { WikiLinksReferenceProvider } from './WikiLinksReferenceProvider';
import { getWikiLinkOrEmptyAt } from './WikiLinksRef';

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

const DOCUMENT_SELECTOR = [
  { scheme: 'file', language: 'markdown' },
  { scheme: 'file', language: 'mdx' },
  { scheme: 'file', language: 'markdown-notes' },
];

export function activate(context: vscode.ExtensionContext) {
  WikiLinksWorkspace.overrideMarkdownWordPattern();

  // Register completion provider for wiki-links
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      DOCUMENT_SELECTOR, 
      new WikiLinksCompletionProvider(), 
      '[' // 只在输入开括号时触发，简单有效
    )
  );

  // Register definition provider for wiki-links
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(DOCUMENT_SELECTOR, new WikiLinksDefinitionProvider())
  );

  // Register reference provider for wiki-links
  context.subscriptions.push(
    vscode.languages.registerReferenceProvider(DOCUMENT_SELECTOR, new WikiLinksReferenceProvider())
  );

  // 简化的实时建议触发机制
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
      if (!documentPathOK(e.document)) {
        return;
      }

      const config = vscode.workspace.getConfiguration('vscodeWikiLinks');
      if (!config.get('triggerSuggestOnReplacement', true)) {
        return;
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document !== e.document) {
        return;
      }

      // 检查是否在wiki链接内编辑
      const ref = getWikiLinkOrEmptyAt(e.document, editor.selection.active);
      if (ref && ref.type === 'WikiLink') {
        // 简短延迟后触发建议
        setTimeout(() => {
          const currentRef = getWikiLinkOrEmptyAt(e.document, editor.selection.active);
          if (currentRef && currentRef.type === 'WikiLink') {
            vscode.commands.executeCommand('editor.action.triggerSuggest');
          }
        }, 100);
      }
    })
  );
}

export function deactivate() {}
